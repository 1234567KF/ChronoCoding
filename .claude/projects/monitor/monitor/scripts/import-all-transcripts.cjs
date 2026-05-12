#!/usr/bin/env node
/**
 * import-all-transcripts — 扫描所有 Claude Code transcript 文件，批量导入 monitor DB
 *
 * Usage: node scripts/import-all-transcripts.cjs
 */
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { calcCost, calcBaselineCost, MODEL_ALIASES } = require('../src/pricing');

const DB_PATH = path.join(__dirname, '..', 'data', 'monitor.db');
const TRANSCRIPT_DIR = path.join(os.homedir(), '.claude', 'projects', 'D--AICoding');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = OFF'); // for performance during bulk insert

const SYSTEM_MSGS = new Set(['会话开始','会话结束','会话继续','会话重启','会话恢复']);

function extractMsgText(entry) {
  const c = entry.message?.content;
  if (typeof c === 'string') return c.trim();
  if (Array.isArray(c)) return c.filter(x => x.type === 'text').map(x => x.text || '').join('\n').trim();
  return '';
}

function countMessages(content) {
  const lines = content.split('\n').filter(Boolean);
  let userMsgs = 0, asstMsgs = 0;
  for (const line of lines) {
    try {
      const e = JSON.parse(line);
      if (e.message?.role === 'user') userMsgs++;
      if (e.message?.role === 'assistant' && e.message?.usage) asstMsgs++;
    } catch {}
  }
  return { userMsgs, asstMsgs };
}

function importSingleTranscript(convId, transcriptPath, existingKeys) {
  const content = fs.readFileSync(transcriptPath, 'utf-8');
  const lines = content.split('\n').filter(Boolean);

  const messages = [];
  let pendingUser = null;

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      const role = entry.message?.role;
      if (role !== 'user' && role !== 'assistant') continue;
      const text = extractMsgText(entry);
      if (!text || SYSTEM_MSGS.has(text)) continue;
      const ts = entry.timestamp || entry.message?.timestamp || new Date().toISOString();
      const m = entry.message?.model || null;
      const model = MODEL_ALIASES[m] || m || null;

      if (role === 'user') {
        pendingUser = { role, content: text, input_tokens: 0, output_tokens: 0, cache_hit: 0, model, created_at: ts };
      } else if (role === 'assistant') {
        const usage = entry.message?.usage || {};
        const hasUsage = usage.input_tokens !== undefined;
        if (hasUsage && pendingUser) {
          // DeepSeek new format: input_tokens = uncached only, cache_read_input_tokens = cached
          pendingUser.input_tokens = usage.input_tokens || 0;
          pendingUser.cache_hit = usage.cache_read_input_tokens || 0;
          if (model && !pendingUser.model) pendingUser.model = model;
          messages.push(pendingUser);
          pendingUser = null;
          messages.push({
            role: 'assistant', content: text,
            input_tokens: 0, output_tokens: usage.output_tokens || 0, cache_hit: 0,
            model, created_at: ts
          });
        } else {
          if (pendingUser) { messages.push(pendingUser); pendingUser = null; }
          messages.push({
            role, content: text,
            input_tokens: hasUsage ? (usage.input_tokens || 0) : 0,
            output_tokens: hasUsage ? (usage.output_tokens || 0) : 0,
            cache_hit: hasUsage ? (usage.cache_read_input_tokens || 0) : 0,
            model, created_at: ts
          });
        }
      }
    } catch {}
  }
  if (pendingUser) messages.push(pendingUser);

  // Insert with dedup
  const insertMsg = db.prepare(
    `INSERT INTO messages (conversation_id, role, content, input_tokens, output_tokens, cache_hit, input_cost, output_cost, cache_cost, baseline_cost, model, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  );

  let imported = 0, skipped = 0;
  let totalIn = 0, totalOut = 0, totalCache = 0, totalCost = 0, totalBaseline = 0;
  let sessionModel = null;

  try {
    const tx = db.transaction(() => {
      for (const msg of messages) {
        const key = convId + ':' + msg.role + ':' + (msg.content || '').slice(0, 120);
        if (existingKeys.has(key)) { skipped++; continue; }
        existingKeys.add(key);

        const inTok = msg.role === 'user' ? msg.input_tokens : 0;
        const outTok = msg.role === 'assistant' ? msg.output_tokens : 0;
        const cache = msg.role === 'user' ? msg.cache_hit : 0;
        const model = msg.model || 'deepseek-v4-flash';
        if (!sessionModel && msg.model) sessionModel = msg.model;

        const cost = calcCost(model, inTok, outTok, cache);
        const baseline = calcBaselineCost(inTok, outTok, cache);

        insertMsg.run(
          convId, msg.role,
          msg.content.length > 10000 ? msg.content.slice(0, 10000) + '...' : msg.content,
          inTok, outTok, cache || null,
          cost?.input_cost ?? null, cost?.output_cost ?? null, cost?.cache_cost ?? null,
          baseline?.total_cost ?? null,
          model || null, msg.created_at
        );

        totalIn += inTok + (cache || 0);
        totalOut += outTok;
        totalCache += cache || 0;
        totalCost += cost?.total_cost || 0;
        totalBaseline += baseline?.total_cost || 0;
        imported++;
      }
    });
    tx();
  } catch (e) {
    return { error: e.message, imported: 0 };
  }

  // Title from first user message
  const firstUser = messages.find(m => m.role === 'user');
  const title = firstUser ? firstUser.content.slice(0, 60) : ('会话 ' + convId.slice(0, 16));

  // Upsert conversation
  const finalModel = sessionModel || 'deepseek-v4-flash';
  const existing = db.prepare('SELECT id FROM conversations WHERE id = ?').get(convId);
  if (existing) {
    db.prepare(`UPDATE conversations SET title=?, model=?, total_input_tokens=?, total_output_tokens=?, total_cost=?, total_baseline_cost=?, ended_at=? WHERE id=?`).run(
      title, finalModel, totalIn, totalOut, totalCost, totalBaseline, new Date().toISOString(), convId);
  } else {
    // Get started_at from first message timestamp
    const firstTs = messages[0]?.created_at || new Date().toISOString();
    db.prepare(`INSERT INTO conversations (id, session_id, title, model, total_input_tokens, total_output_tokens, total_cost, total_baseline_cost, started_at, ended_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
      convId, convId, title, finalModel, totalIn, totalOut, totalCost, totalBaseline, firstTs, new Date().toISOString());
  }

  return { imported, skipped, totalIn, totalOut, totalCost, totalBaseline, title, model: finalModel };
}

// ---- Main ----
console.log('=== Scanning transcript files ===');
const files = fs.readdirSync(TRANSCRIPT_DIR)
  .filter(f => f.endsWith('.jsonl'))
  .map(f => {
    const stat = fs.statSync(path.join(TRANSCRIPT_DIR, f));
    return { name: f, id: f.replace('.jsonl', ''), mtime: stat.mtime, size: stat.size };
  })
  .sort((a, b) => b.mtime - a.mtime);

console.log(`Found ${files.length} transcript files\n`);

// Build set of existing message keys for dedup
const existingRaw = db.prepare('SELECT conversation_id, role, content FROM messages').all();
const existingKeys = new Set();
for (const row of existingRaw) {
  existingKeys.add(row.conversation_id + ':' + row.role + ':' + (row.content || '').slice(0, 120));
}
console.log(`Existing dedup keys: ${existingKeys.size}\n`);

let totalImported = 0, totalSkipped = 0, totalFiles = 0;
let grandTotalCost = 0;

for (const file of files) {
  const tp = path.join(TRANSCRIPT_DIR, file.name);
  console.log(`${file.id.slice(0, 20)} (${(file.size/1024).toFixed(0)}KB, ${file.mtime.toISOString().slice(0,10)})...`);

  const r = importSingleTranscript(file.id, tp, existingKeys);
  if (r.error) {
    console.log(`  ERROR: ${r.error}`);
    continue;
  }

  if (r.imported > 0) {
    console.log(`  +${r.imported} msgs, ¥${r.totalCost.toFixed(4)}, "${r.title?.slice(0, 40)}"`);
  } else if (r.skipped > 0) {
    console.log(`  (${r.skipped} already imported)`);
  }

  totalImported += r.imported;
  totalSkipped += r.skipped;
  grandTotalCost += r.totalCost || 0;
  if (r.imported > 0 || r.skipped > 0) totalFiles++;
}

console.log(`\n=== Done ===`);
console.log(`Files processed: ${totalFiles}/${files.length}`);
console.log(`New messages: ${totalImported}, Skipped (dups): ${totalSkipped}`);

// ---- Rebuild daily_stats from all messages ----
console.log(`\n=== Rebuilding daily_stats ===`);
db.prepare('DELETE FROM token_daily_stats').run();
const dailyData = db.prepare(`
  SELECT substr(created_at,1,10) as day,
    SUM(COALESCE(input_tokens,0)+COALESCE(cache_hit,0)) as ti,
    SUM(COALESCE(output_tokens,0)) as t_o,
    SUM(COALESCE(cache_hit,0)) as tc,
    SUM(COALESCE(input_cost,0)+COALESCE(output_cost,0)+COALESCE(cache_cost,0)) as tcost,
    SUM(COALESCE(baseline_cost,0)) as tb
  FROM messages WHERE created_at IS NOT NULL
  GROUP BY substr(created_at,1,10) ORDER BY day
`).all();

const insertDaily = db.prepare(`INSERT INTO token_daily_stats (date, total_input, total_output, cache_hit_input, total_cost, total_baseline_cost, skill_breakdown) VALUES (?,?,?,?,?,?,?)`);
let dailyCost = 0;
for (const d of dailyData) {
  insertDaily.run(d.day, d.ti||0, d.t_o||0, d.tc||0, d.tcost||0, d.tb||0, '{}');
  dailyCost += d.tcost || 0;
  console.log(`  ${d.day}: in=${(d.ti||0).toLocaleString()} out=${(d.t_o||0).toLocaleString()} cache=${(d.tc||0).toLocaleString()} cost=¥${(d.tcost||0).toFixed(4)}`);
}

// Update watcher cursors for all imported files
const CURSOR_PATH = path.join(__dirname, '..', '..', '..', '.claude-flow', 'data', 'watcher-cursor.json');
try {
  let cursorData = {};
  try { cursorData = JSON.parse(fs.readFileSync(CURSOR_PATH, 'utf-8')); } catch {}
  if (!cursorData.transcriptOffsets) cursorData.transcriptOffsets = {};
  for (const file of files) {
    const tp = path.join(TRANSCRIPT_DIR, file.name);
    const lines = fs.readFileSync(tp, 'utf-8').split('\n').filter(Boolean).length;
    const mtimeMs = fs.statSync(tp).mtimeMs;
    cursorData.transcriptOffsets[file.id] = { offset: lines, mtimeMs };
  }
  cursorData.updatedAt = new Date().toISOString();
  fs.writeFileSync(CURSOR_PATH, JSON.stringify(cursorData), 'utf-8');
  console.log(`\nUpdated watcher cursors for ${files.length} files`);
} catch (e) {
  console.log(`\nCursor update skipped: ${e.message}`);
}

const totalMsgs = db.prepare('SELECT COUNT(*) as cnt FROM messages').get();
const totalConvs = db.prepare('SELECT COUNT(*) as cnt FROM conversations').get();
console.log(`\nDB now: ${totalConvs.cnt} conversations, ${totalMsgs.cnt} messages, ¥${dailyCost.toFixed(2)} total cost`);
db.close();
