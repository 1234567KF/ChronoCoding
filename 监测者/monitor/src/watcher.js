/**
 * watcher — 文件级轮询，将 skill-traces.jsonl + session-state.json 导入 monitor DB
 *
 * 独立于 hooks 的 POST /api/records 推送，作为兜底机制。
 * 即便 hooks 的 stdin 管道在 Windows 上失效，数据也能进入 dashboard。
 */
const fs = require('fs');
const path = require('path');
const { getDB } = require('./db');
const { calcCost, calcBaselineCost, MODEL_PRICES, MODEL_ALIASES } = require('./pricing');

function resolveModel(raw) {
  if (!raw) return null;
  const known = MODEL_ALIASES[raw];
  if (known) return known;
  if (MODEL_PRICES[raw]) return raw;
  return raw || null;
}

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const TRACE_PATH = path.join(PROJECT_ROOT, '.claude-flow', 'data', 'skill-traces.jsonl');
const SESSION_STATE_PATH = path.join(PROJECT_ROOT, '.claude-flow', 'data', 'session-state.json');
const PENDING_DIR = path.join(PROJECT_ROOT, '.claude-flow', 'data', 'pending-sessions');
const CURSOR_PATH = path.join(PROJECT_ROOT, '.claude-flow', 'data', 'watcher-cursor.json');

/* ---------- cursor ---------- */
function readCursor() {
  try {
    const raw = fs.readFileSync(CURSOR_PATH, 'utf-8');
    return JSON.parse(raw).offset || 0;
  } catch { return 0; }
}
function writeCursor(offset) {
  const dir = path.dirname(CURSOR_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CURSOR_PATH, JSON.stringify({ offset, updatedAt: new Date().toISOString() }), 'utf-8');
}

/* ---------- import traces ---------- */
function importTraces() {
  if (!fs.existsSync(TRACE_PATH)) return 0;
  const raw = fs.readFileSync(TRACE_PATH, 'utf-8').trim();
  if (!raw) return 0;
  const lines = raw.split('\n').filter(Boolean);
  const cursor = readCursor();
  const pending = lines.slice(cursor);
  if (pending.length === 0) return 0;

  const db = getDB();
  const insertMsg = db.prepare(
    `INSERT INTO messages (conversation_id, role, content, input_tokens, output_tokens, cache_hit, input_cost, output_cost, baseline_cost, model, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertSkill = db.prepare(
    `INSERT INTO skill_calls (message_id, skill_name, skill_type, input_tokens, output_tokens, duration_ms, status, agent_name, agent_team)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  let imported = 0;
  const tx = db.transaction(() => {
    for (const line of pending) {
      let entry;
      try { entry = JSON.parse(line); } catch { continue; }
      if (!entry || !entry.skill) continue;
      if (entry.skill_type === 'session') continue;
      // subagent traces are now included (with per-agent token data from hooks)

      // Use real session ID for subagent/skill traces, not trace_id (avoids 0-cost ghost conversations)
      const sessionId = entry._session_id || entry.trace_id;
      const convId = sessionId || `trace_${Date.now()}`;
      const now = entry.timestamp || new Date().toISOString();
      const model = resolveModel(entry.model_used) || entry.model_used || 'deepseek-v4-pro';

      // upsert conversation (only for real sessions, not for orphan traces)
      const existing = db.prepare('SELECT id FROM conversations WHERE id = ?').get(convId);
      if (!existing) {
        const title = sessionId
          ? `会话 ${String(sessionId).slice(0, 16)}`
          : (entry.agent || entry.skill || 'unknown');
        db.prepare(
          `INSERT INTO conversations (id, session_id, title, model, started_at)
           VALUES (?, ?, ?, ?, ?)`
        ).run(convId, convId, title, model, now);
      } else if (model && model !== 'unknown') {
        db.prepare('UPDATE conversations SET model = ? WHERE id = ?').run(model, convId);
      }

      // 总输入 = 未缓存(token_in) + 缓存命中(cache_hit) — 相加关系
      const totalInput = (entry.tokens_in || 0) + (entry.cache_hit || 0);
      const cost = calcCost(model, entry.tokens_in || 0, entry.tokens_out || 0, entry.cache_hit || 0);
      const baseline = calcBaselineCost(entry.tokens_in || 0, entry.tokens_out || 0, entry.cache_hit || 0);

      const msg = insertMsg.run(
        convId, 'assistant', entry.note || '',
        entry.tokens_in || 0, entry.tokens_out || 0,
        entry.cache_hit ?? null,
        cost?.input_cost ?? null, cost?.output_cost ?? null,
        baseline?.total_cost ?? null,
        model,
        now
      );

      insertSkill.run(
        msg.lastInsertRowid,
        entry.skill, entry.skill_type || 'unknown',
        entry.tokens_in || 0, entry.tokens_out || 0,
        entry.duration_ms || null,
        entry.result === 'success' ? 'success' : entry.result === 'failure' ? 'error' : 'running',
        entry.agent || null, entry.team || null
      );

      // update conversation totals — 使用总输入 token（含缓存）
      db.prepare(
        `UPDATE conversations SET
          total_input_tokens = total_input_tokens + ?,
          total_output_tokens = total_output_tokens + ?,
          total_cost = total_cost + ?,
          total_baseline_cost = total_baseline_cost + ?,
          ended_at = ?
         WHERE id = ?`
      ).run(
        totalInput, entry.tokens_out || 0,
        cost?.total_cost || 0, baseline?.total_cost || 0, now, convId
      );

      imported++;
    }
  });

  tx();
  writeCursor(lines.length);
  return imported;
}

/* ---------- import session state (当前会话) ---------- */
function importSessionState() {
  if (!fs.existsSync(SESSION_STATE_PATH)) return false;
  try {
    const state = JSON.parse(fs.readFileSync(SESSION_STATE_PATH, 'utf-8'));
    if (!state.sessionId) return false;

    const db = getDB();
    const existing = db.prepare('SELECT id FROM conversations WHERE id = ?').get(state.sessionId);
    if (existing) return false;

    const now = state.startedAt || new Date().toISOString();
    db.prepare(
      `INSERT INTO conversations (id, session_id, title, model, started_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(state.sessionId, state.sessionId, `会话 ${state.sessionId.slice(0, 16)}`, state.model || null, now);

    const insertMsg = db.prepare(
      `INSERT INTO messages (conversation_id, role, content, input_tokens, output_tokens, cache_hit, model, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    insertMsg.run(state.sessionId, 'assistant', '会话开始', 0, 0, 0, null, now);

    return true;
  } catch { return false; }
}

/* ---------- transcript import (DeepSeek-aware, hook fallback) ---------- */
const HOME_DIR = process.env.USERPROFILE || process.env.HOME || '';
const PROJECT_NAME = path.basename(PROJECT_ROOT);

function resolveTranscriptPath(sessionId) {
  if (!sessionId || !HOME_DIR) return null;
  const candidate = path.join(HOME_DIR, '.claude', 'projects', `D--${PROJECT_NAME}`, `${sessionId}.jsonl`);
  return fs.existsSync(candidate) ? candidate : null;
}

// System messages to skip (carry cumulative session totals, not per-message usage)
const SYSTEM_MSGS = new Set(['会话开始', '会话结束', '会话继续', '会话重启', '会话恢复']);

function extractMsgText(entry) {
  const c = entry.message?.content;
  if (typeof c === 'string') return c.trim();
  if (Array.isArray(c)) return c.filter(x => x.type === 'text').map(x => x.text || '').join('\n').trim();
  return '';
}

function buildTranscriptMessages(lines) {
  const messages = [];
  let pendingUser = null;
  let pendingSkill = null; // attributionSkill from thinking/tool_use blocks without text

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      const role = entry.message?.role;

      // Track attributionSkill from thinking/tool_use blocks (no text content)
      if (entry.attributionSkill) {
        pendingSkill = entry.attributionSkill;
      }

      if (role !== 'user' && role !== 'assistant') continue;

      const text = extractMsgText(entry);
      if (!text) continue;
      if (SYSTEM_MSGS.has(text)) continue;

      const ts = entry.timestamp || entry.message?.timestamp || new Date().toISOString();
      const m = entry.message?.model || null;
      const model = MODEL_ALIASES[m] || m;

      if (role === 'user') {
        pendingUser = { role, content: text, input_tokens: 0, output_tokens: 0, cache_hit: 0, model, created_at: ts };
      } else if (role === 'assistant') {
        const usage = entry.message?.usage || {};
        const hasUsage = usage.input_tokens !== undefined;
        const skill = entry.attributionSkill || pendingSkill;
        pendingSkill = null; // consumed

        if (hasUsage && pendingUser) {
          // Attribute assistant's input_tokens to preceding user message (DeepSeek format)
          pendingUser.input_tokens = usage.input_tokens || 0;
          pendingUser.cache_hit = usage.cache_read_input_tokens || 0;
          pendingUser.model = model;
          messages.push(pendingUser);
          pendingUser = null;
          messages.push({
            role, content: text, input_tokens: 0,
            output_tokens: usage.output_tokens || 0, cache_hit: 0,
            model, created_at: ts, attributionSkill: skill,
          });
        } else {
          if (pendingUser) { messages.push(pendingUser); pendingUser = null; }
          messages.push({
            role, content: text,
            input_tokens: hasUsage ? (usage.input_tokens || 0) : 0,
            output_tokens: hasUsage ? (usage.output_tokens || 0) : 0,
            cache_hit: hasUsage ? (usage.cache_read_input_tokens || 0) : 0,
            model, created_at: ts, attributionSkill: skill,
          });
        }
      }
    } catch {}
  }
  if (pendingUser) messages.push(pendingUser);
  return messages;
}

/* ---------- transcript cursor ---------- */
function readTranscriptCursor(sessionId) {
  try {
    const raw = fs.readFileSync(CURSOR_PATH, 'utf-8');
    const data = JSON.parse(raw);
    return data.transcriptOffsets?.[sessionId] || 0;
  } catch { return 0; }
}

function writeTranscriptCursor(sessionId, offset) {
  const dir = path.dirname(CURSOR_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  let data = {};
  try { data = JSON.parse(fs.readFileSync(CURSOR_PATH, 'utf-8')); } catch {}
  if (!data.transcriptOffsets) data.transcriptOffsets = {};
  data.transcriptOffsets[sessionId] = offset;
  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(CURSOR_PATH, JSON.stringify(data), 'utf-8');
}

function importTranscriptMessages() {
  // 1. Get session ID from session state
  if (!fs.existsSync(SESSION_STATE_PATH)) return 0;
  let sessionId;
  try { sessionId = JSON.parse(fs.readFileSync(SESSION_STATE_PATH, 'utf-8')).sessionId; } catch { return 0; }
  if (!sessionId) return 0;

  // 2. Resolve transcript path
  const transcriptPath = resolveTranscriptPath(sessionId);
  if (!transcriptPath) return 0;

  // 3. Read cursor — skip already-imported lines
  const cursor = readTranscriptCursor(sessionId);
  let content;
  try { content = fs.readFileSync(transcriptPath, 'utf-8'); } catch { return 0; }
  const lines = content.split('\n').filter(Boolean);
  if (lines.length <= cursor) return 0;

  const newLines = lines.slice(cursor);
  const messages = buildTranscriptMessages(newLines);
  if (messages.length === 0) return 0;

  // 4. Import to DB with dedup
  const db = getDB();
  const existingKeys = new Set();
  try {
    const existing = db.prepare('SELECT role, content FROM messages WHERE conversation_id = ?').all(sessionId);
    for (const row of existing) {
      existingKeys.add(`${row.role}:${(row.content || '').slice(0, 100)}`);
    }
  } catch {}

  const insertMsg = db.prepare(
    `INSERT INTO messages (conversation_id, role, content, input_tokens, output_tokens, cache_hit, input_cost, output_cost, baseline_cost, model, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertSkill = db.prepare(
    `INSERT INTO skill_calls (message_id, skill_name, skill_type, input_tokens, output_tokens, status)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  let imported = 0;
  let batchInput = 0, batchOutput = 0, batchCost = 0, batchBaseline = 0, batchCache = 0;
  const tx = db.transaction(() => {
    for (const msg of messages) {
      const key = `${msg.role}:${(msg.content || '').slice(0, 100)}`;
      if (existingKeys.has(key)) continue;
      existingKeys.add(key);

      const cost = msg.model ? calcCost(msg.model, msg.input_tokens, msg.output_tokens, msg.cache_hit) : null;
      const baselineCost = calcBaselineCost(msg.input_tokens, msg.output_tokens, msg.cache_hit);

      const result = insertMsg.run(
        sessionId, msg.role,
        msg.content.length > 10000 ? msg.content.slice(0, 10000) + '...' : msg.content,
        msg.input_tokens, msg.output_tokens, msg.cache_hit || null,
        cost?.input_cost ?? null, cost?.output_cost ?? null,
        baselineCost?.total_cost ?? null,
        msg.model || null, msg.created_at
      );

      // Create skill_call record from attributionSkill
      if (msg.attributionSkill) {
        const skillType = msg.attributionSkill.startsWith('kf-') ? 'kf-custom' : 'builtin';
        insertSkill.run(
          result.lastInsertRowid,
          msg.attributionSkill, skillType,
          msg.input_tokens || 0, msg.output_tokens || 0,
          'success'
        );
      }

      const msgTotalIn = (msg.input_tokens || 0) + (msg.cache_hit || 0);
      batchInput += msgTotalIn;
      batchOutput += msg.output_tokens || 0;
      batchCache += msg.cache_hit || 0;
      batchCost += cost?.total_cost || 0;
      batchBaseline += baselineCost?.total_cost || 0;
      imported++;
    }
  });

  try { tx(); } catch (e) {
    console.error(`[watcher] Transcript import tx failed: ${e.message}`);
    return 0;
  }

  // 5. Update cursor
  writeTranscriptCursor(sessionId, lines.length);

  // 6. Update conversation cumulative totals (include cache_hit, and only increase — never decrease)
  try {
    const costRow = db.prepare('SELECT COALESCE(SUM(input_cost),0) as ic, COALESCE(SUM(output_cost),0) as oc FROM messages WHERE conversation_id = ?').get(sessionId);
    const tokenRow = db.prepare('SELECT COALESCE(SUM(input_tokens + COALESCE(cache_hit,0)),0) as it, COALESCE(SUM(output_tokens),0) as ot FROM messages WHERE conversation_id = ?').get(sessionId);
    const baselineRow = db.prepare('SELECT COALESCE(SUM(baseline_cost),0) as bc FROM messages WHERE conversation_id = ?').get(sessionId);
    const current = db.prepare('SELECT total_input_tokens, total_output_tokens, total_cost, total_baseline_cost FROM conversations WHERE id = ?').get(sessionId);

    // Use MAX to avoid overwriting with lower values from competing ingestion paths
    const newInput = current ? Math.max(current.total_input_tokens || 0, tokenRow.it) : tokenRow.it;
    const newOutput = current ? Math.max(current.total_output_tokens || 0, tokenRow.ot) : tokenRow.ot;
    const newCost = current ? Math.max(current.total_cost || 0, (costRow.ic || 0) + (costRow.oc || 0)) : (costRow.ic || 0) + (costRow.oc || 0);
    const newBaseline = current ? Math.max(current.total_baseline_cost || 0, baselineRow.bc || 0) : baselineRow.bc || 0;

    db.prepare(
      `UPDATE conversations SET
        total_input_tokens = ?, total_output_tokens = ?,
        total_cost = ?, total_baseline_cost = ?,
        ended_at = ?
       WHERE id = ?`
    ).run(
      newInput, newOutput,
      newCost, newBaseline,
      new Date().toISOString(),
      sessionId
    );
  } catch (e) {
    console.error(`[watcher] Transcript totals update failed: ${e.message}`);
  }

  // 7. Update daily stats from this batch
  if (batchCost > 0) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const existingStats = db.prepare('SELECT * FROM token_daily_stats WHERE date = ?').get(today);
      if (existingStats) {
        db.prepare(
          `UPDATE token_daily_stats SET
            total_input = total_input + ?,
            total_output = total_output + ?,
            cache_hit_input = cache_hit_input + ?,
            total_cost = total_cost + ?,
            total_baseline_cost = total_baseline_cost + ?
           WHERE date = ?`
        ).run(batchInput, batchOutput, batchCache, batchCost, batchBaseline, today);
      } else {
        db.prepare(
          `INSERT INTO token_daily_stats (date, total_input, total_output, cache_hit_input, total_cost, total_baseline_cost)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).run(today, batchInput, batchOutput, batchCache, batchCost, batchBaseline);
      }
    } catch (e) {
      console.error(`[watcher] Transcript daily stats update failed: ${e.message}`);
    }
  }

  if (imported > 0) {
    console.log(`[watcher] imported ${imported} message(s) from transcript (session ${sessionId.slice(0, 16)})`);
  }
  return imported;
}

/* ---------- start watcher ---------- */
let _interval = null;

function importPendingSessions() {
  if (!fs.existsSync(PENDING_DIR)) return 0;
  try {
    const db = getDB();
    const files = fs.readdirSync(PENDING_DIR).filter(f => f.endsWith('.json'));
    let imported = 0;
    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(PENDING_DIR, file), 'utf-8'));
        if (!data.sessionId) continue;
        const existing = db.prepare('SELECT id FROM conversations WHERE id = ?').get(data.sessionId);
        if (!existing) {
          db.prepare(
            `INSERT INTO conversations (id, session_id, title, model, started_at, total_input_tokens, total_output_tokens, total_cost, total_baseline_cost, ended_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(
            data.sessionId, data.sessionId,
            data.title || `会话 ${data.sessionId.slice(0, 16)}`,
            data.model || 'deepseek-v4-pro',
            data.startedAt || new Date().toISOString(),
            data.total_input_tokens || 0,
            data.total_output_tokens || 0,
            data.total_cost || 0,
            data.total_baseline_cost || 0,
            data.ended_at || null
          );
          console.log(`[watcher] Imported pending session: ${data.sessionId}`);
        } else if (data.phase === 'end') {
          const current = db.prepare('SELECT total_input_tokens, total_output_tokens, total_cost, total_baseline_cost FROM conversations WHERE id = ?').get(data.sessionId);
          db.prepare(
            `UPDATE conversations SET total_input_tokens=?, total_output_tokens=?, total_cost=?, total_baseline_cost=?, ended_at=? WHERE id=?`
          ).run(
            Math.max(current?.total_input_tokens || 0, data.total_input_tokens || 0),
            Math.max(current?.total_output_tokens || 0, data.total_output_tokens || 0),
            Math.max(current?.total_cost || 0, data.total_cost || 0),
            Math.max(current?.total_baseline_cost || 0, data.total_baseline_cost || 0),
            data.ended_at || null,
            data.sessionId
          );
          console.log(`[watcher] Updated pending session: ${data.sessionId}`);
        }
        fs.unlinkSync(path.join(PENDING_DIR, file));
        imported++;
      } catch (e) {
        console.error(`[watcher] Pending sync error for ${file}: ${e.message}`);
      }
    }
    return imported;
  } catch (e) {
    console.error(`[watcher] Pending sync error: ${e.message}`);
    return 0;
  }
}

function startWatcher(intervalMs = 10000) {
  importSessionState();
  importTraces();
  importPendingSessions();
  importTranscriptMessages();

  _interval = setInterval(() => {
    try {
      importSessionState();
      const n = importTraces();
      const p = importPendingSessions();
      const t = importTranscriptMessages();
      if (n > 0) {
        console.log(`[watcher] imported ${n} trace(s) from skill-traces.jsonl`);
      }
      if (p > 0) {
        console.log(`[watcher] imported ${p} pending session(s)`);
      }
      if (t > 0) {
        console.log(`[watcher] imported ${t} message(s) from transcript`);
      }
    } catch (err) {
      console.error(`[watcher] error: ${err.message}`);
    }
  }, intervalMs);

  return _interval;
}

function stopWatcher() {
  if (_interval) { clearInterval(_interval); _interval = null; }
}

module.exports = { startWatcher, stopWatcher, importTraces, importSessionState };
