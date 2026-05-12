#!/usr/bin/env node
/**
 * clean-reimport — 清空所有消息，从 transcript 单一来源干净重建
 *
 * Usage: node scripts/clean-reimport.cjs
 */
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { calcCost, calcBaselineCost, MODEL_ALIASES } = require('../src/pricing');

const DB_PATH = path.join(__dirname, '..', 'data', 'monitor.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// ---- WIPE ----
db.prepare('DELETE FROM skill_calls').run();
db.prepare('DELETE FROM messages').run();
db.prepare('DELETE FROM token_daily_stats').run();
console.log('Wiped all messages, skill_calls, daily_stats');

const SYSTEM_MSGS = new Set(['会话开始','会话结束','会话继续','会话重启','会话恢复']);

function extractMsgText(entry) {
  const c = entry.message?.content;
  if (typeof c === 'string') return c.trim();
  if (Array.isArray(c)) return c.filter(x => x.type === 'text').map(x => x.text || '').join('\n').trim();
  return '';
}

function reimportConversation(convId, transcriptPath) {
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

  // Dedup + insert
  const insertMsg = db.prepare(
    `INSERT INTO messages (conversation_id, role, content, input_tokens, output_tokens, cache_hit, input_cost, output_cost, cache_cost, baseline_cost, model, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  );

  const seenKeys = new Set();
  let imported = 0, skipped = 0;
  let totalIn = 0, totalOut = 0, totalCache = 0, totalCost = 0, totalBaseline = 0;
  let sessionModel = null;

  const tx = db.transaction(() => {
    for (const msg of messages) {
      const key = msg.role + ':' + (msg.content || '').slice(0, 120);
      if (seenKeys.has(key)) { skipped++; continue; }
      seenKeys.add(key);

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

  // Get title from first user message
  const firstUser = messages.find(m => m.role === 'user');
  const title = firstUser ? firstUser.content.slice(0, 50) : ('会话 ' + convId.slice(0, 16));

  // Upsert conversation
  const finalModel = sessionModel || 'deepseek-v4-flash';
  const existing = db.prepare('SELECT id FROM conversations WHERE id = ?').get(convId);
  if (existing) {
    db.prepare(`UPDATE conversations SET title=?, model=?, total_input_tokens=?, total_output_tokens=?, total_cost=?, total_baseline_cost=?, ended_at=? WHERE id=?`).run(
      title, finalModel, totalIn, totalOut, totalCost, totalBaseline, new Date().toISOString(), convId);
  } else {
    db.prepare(`INSERT INTO conversations (id, session_id, title, model, total_input_tokens, total_output_tokens, total_cost, total_baseline_cost, started_at, ended_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
      convId, convId, title, finalModel, totalIn, totalOut, totalCost, totalBaseline, new Date().toISOString(), new Date().toISOString());
  }

  return { imported, skipped, totalIn, totalOut, totalCache, totalCost, totalBaseline, lines: lines.length, title };
}

// ---- Reimport both conversations ----
const transcriptDir = path.join(os.homedir(), '.claude', 'projects', 'D--AICoding');

const results = [];
for (const convId of ['ad08b099-f849-40ef-a03a-c68bc46a9939', 'e4dd06c8-aa0e-409c-828a-021832536f2d']) {
  const tp = path.join(transcriptDir, convId + '.jsonl');
  if (fs.existsSync(tp)) {
    const r = reimportConversation(convId, tp);
    results.push({ convId, ...r });
    console.log(r.title || convId.slice(0,20));
    console.log('  Messages:', r.imported, '(skipped', r.skipped, 'dups)');
    console.log('  Input:', r.totalIn.toLocaleString(), '(cache:', r.totalCache.toLocaleString(), ')');
    console.log('  Output:', r.totalOut.toLocaleString());
    console.log('  Cost: ¥' + r.totalCost.toFixed(4), '| Baseline: ¥' + r.totalBaseline.toFixed(4));
  }
}

// ---- Update watcher cursors to end of files ----
const cursorPath = path.join(__dirname, '..', '..', '..', '.claude-flow', 'data', 'watcher-cursor.json');
for (const r of results) {
  try {
    let cursorData = {};
    try { cursorData = JSON.parse(fs.readFileSync(cursorPath, 'utf-8')); } catch {}
    if (!cursorData.transcriptOffsets) cursorData.transcriptOffsets = {};
    cursorData.transcriptOffsets[r.convId] = r.lines;
    cursorData.updatedAt = new Date().toISOString();
    fs.writeFileSync(cursorPath, JSON.stringify(cursorData), 'utf-8');
  } catch(e) { console.error('Cursor update failed:', e.message); }
}
console.log('\nUpdated watcher cursors to end of files');

// ---- Rebuild daily_stats from messages ----
db.prepare('DELETE FROM token_daily_stats').run();
const dailyData = db.prepare(`
  SELECT substr(created_at,1,10) as day,
    SUM(COALESCE(input_tokens,0)) as ti, SUM(COALESCE(output_tokens,0)) as t_o,
    SUM(COALESCE(cache_hit,0)) as tc,
    SUM(COALESCE(input_cost,0)+COALESCE(output_cost,0)+COALESCE(cache_cost,0)) as tcost,
    SUM(COALESCE(baseline_cost,0)) as tb
  FROM messages WHERE created_at IS NOT NULL
  GROUP BY substr(created_at,1,10) ORDER BY day
`).all();

const insertDaily = db.prepare(`INSERT INTO token_daily_stats (date, total_input, total_output, cache_hit_input, total_cost, total_baseline_cost, skill_breakdown) VALUES (?,?,?,?,?,?,?)`);
for (const d of dailyData) {
  insertDaily.run(d.day, d.ti||0, d.t_o||0, d.tc||0, d.tcost||0, d.tb||0, '{}');
  console.log('daily:', d.day, '| in:', (d.ti||0).toLocaleString(), 'out:', (d.t_o||0).toLocaleString(), 'cost: ¥' + (d.tcost||0).toFixed(4));
}

const totalMsgs = db.prepare('SELECT COUNT(*) as cnt FROM messages').get();
console.log('\nTotal messages in DB:', totalMsgs.cnt);
db.close();
console.log('Done.');
