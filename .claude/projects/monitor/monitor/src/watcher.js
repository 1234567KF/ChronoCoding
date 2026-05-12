/**
 * watcher — 文件级轮询，将 skill-traces.jsonl + session-state.json 导入 monitor DB
 *
 * 独立于 hooks 的 POST /api/records 推送，作为兜底机制。
 * 即便 hooks 的 stdin 管道在 Windows 上失效，数据也能进入 dashboard。
 */
const fs = require('fs');
const path = require('path');
const { getDB } = require('./db');
const { calcCost, calcBaselineCost, calcContextWindowPct, MODEL_PRICES, MODEL_ALIASES, MODEL_MAX_CONTEXT } = require('./pricing');

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
    `INSERT INTO messages (conversation_id, role, content, input_tokens, output_tokens, cache_hit, input_cost, output_cost, cache_cost, baseline_cost, model, context_window_pct, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertSkill = db.prepare(
    `INSERT INTO skill_calls (message_id, skill_name, skill_type, input_tokens, output_tokens, duration_ms, status, agent_name, agent_team)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  // Build dedup set from existing messages for this batch
  const dedupKeys = new Set();
  try {
    const convIds = [...new Set(pending.map(l => { try { const e = JSON.parse(l); return e._session_id || e.trace_id; } catch { return null; } }).filter(Boolean))];
    for (const cid of convIds) {
      const existing = db.prepare("SELECT role, content FROM messages WHERE conversation_id = ?").all(cid);
      for (const row of existing) {
        dedupKeys.add(`${cid}:${row.role}:${(row.content || '').slice(0, 120)}`);
      }
    }
  } catch {}

  let imported = 0;
  let batchTokensIn = 0, batchTokensOut = 0, batchCost = 0, batchBaseline = 0;
  const tx = db.transaction(() => {
    for (const line of pending) {
      let entry;
      try { entry = JSON.parse(line); } catch { continue; }
      if (!entry || !entry.skill) continue;
      if (entry.skill_type === 'session') continue;
      // Skip agent lifecycle events (subagent start/end) — these are status signals, not real messages
      const note = entry.note || '';
      if (/^agent subagent (开始|结束)/.test(note)) continue;

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

      // Anomaly detection: cache_hit > model max context → skip (dirty data)
      const maxCtx = MODEL_MAX_CONTEXT[model];
      if (maxCtx && (entry.cache_hit || 0) > maxCtx) {
        console.warn(`[watcher] SKIP: cache_hit ${entry.cache_hit} > ${model} max_ctx ${maxCtx} (conv=${convId})`);
        imported++;
        continue;
      }

      const cost = calcCost(model, entry.tokens_in || 0, entry.tokens_out || 0, entry.cache_hit || 0);
      const baseline = calcBaselineCost(entry.tokens_in || 0, entry.tokens_out || 0, entry.cache_hit || 0);

      // Dedup against existing messages (hook push + watcher import race)
      const dk = `${convId}:assistant:${(entry.note || '').slice(0, 120)}`;
      if (dedupKeys.has(dk)) { imported++; continue; }
      dedupKeys.add(dk);

      const ctxPct = calcContextWindowPct(model, entry.tokens_in || 0, entry.cache_hit || 0);

      const msg = insertMsg.run(
        convId, 'assistant', entry.note || '',
        entry.tokens_in || 0, entry.tokens_out || 0,
        entry.cache_hit ?? null,
        cost?.input_cost ?? null, cost?.output_cost ?? null,
        cost?.cache_cost ?? null,
        baseline?.total_cost ?? null,
        model,
        ctxPct,
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

      // UPDATE conversation model/ended_at only (not token totals — transcript import
      // is the authoritative source for cumulative totals; trace data would double-count)
      db.prepare('UPDATE conversations SET ended_at = ? WHERE id = ?').run(now, convId);

      batchTokensIn += totalInput;
      batchTokensOut += entry.tokens_out || 0;
      batchCost += cost?.total_cost || 0;
      batchBaseline += baseline?.total_cost || 0;
      imported++;
    }
  });

  tx();
  writeCursor(lines.length);

  // Update daily stats for traces (mirrors transcript import behavior)
  if (batchCost > 0) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const existingStats = db.prepare('SELECT * FROM token_daily_stats WHERE date = ?').get(today);
      if (existingStats) {
        db.prepare(
          `UPDATE token_daily_stats SET
            total_input = total_input + ?,
            total_output = total_output + ?,
            total_cost = total_cost + ?,
            total_baseline_cost = total_baseline_cost + ?
           WHERE date = ?`
        ).run(batchTokensIn, batchTokensOut, batchCost, batchBaseline, today);
      } else {
        db.prepare(
          `INSERT INTO token_daily_stats (date, total_input, total_output, cache_hit_input, total_cost, total_baseline_cost)
           VALUES (?, ?, ?, 0, ?, ?)`
        ).run(today, batchTokensIn, batchTokensOut, batchCost, batchBaseline);
      }
    } catch (e) {
      console.error(`[watcher] Trace daily stats update failed: ${e.message}`);
    }
  }

  return imported;
}

/* ---------- transcript import 已移除 — SQLite 唯一数据源，不再从 .jsonl 文件中转 ---------- */

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
      `INSERT INTO conversations (id, session_id, title, model, started_at, restored_from)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(state.sessionId, state.sessionId, `会话 ${state.sessionId.slice(0, 16)}`, state.model || null, now, state.restoredFrom || null);

    const insertMsg = db.prepare(
      `INSERT INTO messages (conversation_id, role, content, input_tokens, output_tokens, cache_hit, model, context_window_pct, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    insertMsg.run(state.sessionId, 'assistant', '会话开始', 0, 0, 0, null, 0, now);

    return true;
  } catch { return false; }
}

/* ---------- transcript import 已移除 — SQLite 唯一数据源，不再从 .jsonl 文件中转 ---------- */

/* ---------- review re-run detection ---------- */
const REVIEW_DIRS = [
  path.join(PROJECT_ROOT, '.claude-flow', 'reviews'),
  path.join(PROJECT_ROOT, '.claude-flow', 'quality-signals'),
];
const REVIEW_CURSOR_PATH = path.join(PROJECT_ROOT, '.claude-flow', 'data', 'review-rerun-cursor.json');

const MAX_RERUN_ROUNDS = 3;
const P1_DENSITY_THRESHOLD = 3;

function readReviewCursor() {
  try {
    const raw = fs.readFileSync(REVIEW_CURSOR_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch { return { seen: {} }; }
}

function writeReviewCursor(data) {
  const dir = path.dirname(REVIEW_CURSOR_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(REVIEW_CURSOR_PATH, JSON.stringify({ ...data, updatedAt: new Date().toISOString() }), 'utf-8');
}

/**
 * Independently detect re-review triggers from review JSON files.
 * This is the monitor's own assessment — does NOT trust agent self-reporting.
 */
function importReviewReruns() {
  const db = getDB();
  const cursor = readReviewCursor();
  let newRecords = 0;

  const insertRerun = db.prepare(
    `INSERT INTO review_reruns (review_path, skill_name, agent_team, round, triggered, p0_count, p1_count, p1_density, total_issues, total_lines, decision)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const dir of REVIEW_DIRS) {
    if (!fs.existsSync(dir)) continue;
    let files;
    try { files = fs.readdirSync(dir).filter(f => f.endsWith('.json')); } catch { continue; }

    for (const file of files) {
      const fullPath = path.join(dir, file);
      let stat;
      try { stat = fs.statSync(fullPath); } catch { continue; }

      const key = fullPath;
      const lastMtime = cursor.seen[key];
      if (lastMtime && stat.mtimeMs <= lastMtime) continue;

      // Parse review JSON
      let report;
      try {
        const raw = fs.readFileSync(fullPath, 'utf-8');
        const data = JSON.parse(raw);
        report = data.review_report || data;
      } catch { continue; }

      if (!report.issues && !report.severity) continue; // Not a review file

      // Calculate trigger conditions (same logic as review-rerun-check.cjs)
      const issues = report.issues || [];
      const p0Count = issues.filter(i => i.severity === 'P0').length;
      const p1Count = issues.filter(i => i.severity === 'P1').length;
      const totalLines = report.total_lines || report.line_count_total || 0;
      const p1Density = totalLines > 0 ? (p1Count / totalLines) * 1000 : 0;

      // Determine round from review path or metadata
      const round = report.round || report.review_round || 1;
      const triggers = [];
      if (p0Count > 0) triggers.push('P0_COUNT_GT_0');
      if (p1Density > P1_DENSITY_THRESHOLD) triggers.push('P1_DENSITY_GT_3');
      const atMaxRounds = round >= MAX_RERUN_ROUNDS;
      const shouldRerun = triggers.length > 0 && !atMaxRounds;

      let decision;
      if (shouldRerun) {
        decision = `触发第 ${round + 1}/${MAX_RERUN_ROUNDS} 轮重审`;
      } else if (atMaxRounds && triggers.length > 0) {
        decision = `已达上限 ${MAX_RERUN_ROUNDS} 轮，标记 UNRESOLVED`;
      } else {
        decision = '一次通过，无需重审';
      }

      // Extract team name from path
      const teamMatch = file.match(/(red|blue|green|红|蓝|绿)/i);
      const agentTeam = report.team || (teamMatch ? teamMatch[0].toLowerCase() : null);

      insertRerun.run(
        fullPath,
        report.skill_name || report.skill || 'kf-code-review-graph',
        agentTeam,
        round,
        shouldRerun ? 1 : 0,
        p0Count,
        p1Count,
        parseFloat(p1Density.toFixed(2)),
        issues.length,
        totalLines,
        decision
      );

      cursor.seen[key] = stat.mtimeMs;
      newRecords++;
    }
  }

  if (newRecords > 0) {
    writeReviewCursor(cursor);
    console.log(`[watcher] Recorded ${newRecords} review re-run check(s)`);
  }

  return newRecords;
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
            `INSERT INTO conversations (id, session_id, title, model, started_at, total_input_tokens, total_output_tokens, total_cost, total_baseline_cost, ended_at, restored_from)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(
            data.sessionId, data.sessionId,
            data.title || `会话 ${data.sessionId.slice(0, 16)}`,
            data.model || 'deepseek-v4-pro',
            data.startedAt || new Date().toISOString(),
            data.total_input_tokens || 0,
            data.total_output_tokens || 0,
            data.total_cost || 0,
            data.total_baseline_cost || 0,
            data.ended_at || null,
            data.restoredFrom || null
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
  importReviewReruns();

  _interval = setInterval(() => {
    try {
      importSessionState();
      const n = importTraces();
      const p = importPendingSessions();
      const r = importReviewReruns();
      if (n > 0) {
        console.log(`[watcher] imported ${n} trace(s) from skill-traces.jsonl`);
      }
      if (p > 0) {
        console.log(`[watcher] imported ${p} pending session(s)`);
      }
      if (r > 0) {
        console.log(`[watcher] detected ${r} review re-run(s)`);
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

module.exports = { startWatcher, stopWatcher, importTraces, importSessionState, importReviewReruns };
