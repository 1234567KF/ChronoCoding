/**
 * watcher — 文件级轮询，将 skill-traces.jsonl + session-state.json 导入 monitor DB
 *
 * 独立于 hooks 的 POST /api/records 推送，作为兜底机制。
 * 即便 hooks 的 stdin 管道在 Windows 上失效，数据也能进入 dashboard。
 */
const fs = require('fs');
const path = require('path');
const { getDB } = require('./db');
const { calcCost, MODEL_PRICES, MODEL_ALIASES } = require('./pricing');

function resolveModel(raw) {
  if (!raw) return null;
  return MODEL_ALIASES[raw] || raw;
}

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const TRACE_PATH = path.join(PROJECT_ROOT, '.claude-flow', 'data', 'skill-traces.jsonl');
const SESSION_STATE_PATH = path.join(PROJECT_ROOT, '.claude-flow', 'data', 'session-state.json');
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
    `INSERT INTO messages (conversation_id, role, content, input_tokens, output_tokens, cache_hit, input_cost, output_cost, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertSkill = db.prepare(
    `INSERT INTO skill_calls (message_id, skill_name, skill_type, input_tokens, output_tokens, duration_ms, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  let imported = 0;
  const tx = db.transaction(() => {
    for (const line of pending) {
      let entry;
      try { entry = JSON.parse(line); } catch { continue; }
      if (!entry || !entry.skill) continue;
      // Skip session-start/session-end traces — handled by importSessionState()
      if (entry.skill_type === 'session') continue;
      // Skip subagent lifecycle events (start/end) — hook events, not actual skill calls
      if (entry.skill_type === 'subagent') continue;

      const convId = entry.trace_id || `trace_${Date.now()}`;
      const now = entry.timestamp || new Date().toISOString();
      const model = resolveModel(entry.model_used) || 'unknown';

      // upsert conversation
      const existing = db.prepare('SELECT id FROM conversations WHERE id = ?').get(convId);
      if (!existing) {
        db.prepare(
          `INSERT INTO conversations (id, session_id, title, model, started_at)
           VALUES (?, ?, ?, ?, ?)`
        ).run(convId, convId, entry.agent || entry.skill || 'unknown', model, now);
      } else if (model && model !== 'unknown') {
        db.prepare('UPDATE conversations SET model = ? WHERE id = ?').run(model, convId);
      }

      const cost = calcCost(model, entry.tokens_in || 0, entry.tokens_out || 0, entry.cache_hit || 0);
      const msg = insertMsg.run(
        convId, 'assistant', entry.note || '',
        entry.tokens_in || 0, entry.tokens_out || 0,
        entry.cache_hit ?? null,
        cost?.input_cost ?? null, cost?.output_cost ?? null,
        now
      );

      insertSkill.run(
        msg.lastInsertRowid,
        entry.skill, entry.skill_type || 'unknown',
        entry.tokens_in || 0, entry.tokens_out || 0,
        entry.duration_ms || null,
        entry.result === 'success' ? 'success' : entry.result === 'failure' ? 'error' : 'running'
      );

      // update conversation totals
      db.prepare(
        `UPDATE conversations SET
          total_input_tokens = total_input_tokens + ?,
          total_output_tokens = total_output_tokens + ?,
          total_cost = total_cost + ?,
          ended_at = ?
         WHERE id = ?`
      ).run(
        entry.tokens_in || 0, entry.tokens_out || 0,
        cost?.total_cost || 0, now, convId
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
    if (existing) return false; // already recorded

    const now = state.startedAt || new Date().toISOString();
    db.prepare(
      `INSERT INTO conversations (id, session_id, title, model, started_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(state.sessionId, state.sessionId, `会话 ${state.sessionId.slice(0, 16)}`, state.model || null, now);

    const insertMsg = db.prepare(
      `INSERT INTO messages (conversation_id, role, content, input_tokens, output_tokens, cache_hit, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    insertMsg.run(state.sessionId, 'assistant', '会话开始', 0, 0, 0, now);

    return true;
  } catch { return false; }
}

/* ---------- start watcher ---------- */
let _interval = null;

function startWatcher(intervalMs = 10000) {
  // import once immediately
  importSessionState();
  importTraces();

  _interval = setInterval(() => {
    try {
      importSessionState();
      const n = importTraces();
      if (n > 0) {
        console.log(`[watcher] imported ${n} trace(s) from skill-traces.jsonl`);
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
