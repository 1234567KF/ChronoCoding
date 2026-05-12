const { getDB } = require('../db');
const { calcCost, calcBaselineCost, calcContextWindowPct, MODEL_ALIASES, MODEL_MAX_CONTEXT } = require('../pricing');

function resolveModel(raw) {
  if (!raw) return null;
  return MODEL_ALIASES[raw] || raw;
}

function saveRecord({ sessionId, title, model, messages, skillCalls, restoredFrom }) {
  const db = getDB();
  const convId = sessionId || `conv_${Date.now()}`;
  const now = new Date().toISOString();
  const resolvedModel = resolveModel(model);

  const insertMsg = db.prepare(
    `INSERT INTO messages (conversation_id, role, content, input_tokens, output_tokens, cache_hit, input_cost, output_cost, cache_cost, baseline_cost, model, context_window_pct, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertSkill = db.prepare(
    `INSERT INTO skill_calls (message_id, skill_name, skill_type, input_tokens, output_tokens, duration_ms, status, agent_name, agent_team)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const tx = db.transaction(() => {
    // upsert conversation (minimal — no longer the primary dimension)
    const existing = db.prepare('SELECT id FROM conversations WHERE id = ?').get(convId);
    if (!existing) {
      db.prepare(
        `INSERT INTO conversations (id, session_id, title, model, started_at, restored_from)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(convId, sessionId || convId, title || '', resolvedModel, now, restoredFrom || null);
    } else {
      if (resolvedModel) {
        db.prepare('UPDATE conversations SET model = ? WHERE id = ?').run(resolvedModel, convId);
      }
      // Update restored_from if not already set (first lineage wins)
      if (restoredFrom && !existing.restored_from) {
        db.prepare('UPDATE conversations SET restored_from = ? WHERE id = ?').run(restoredFrom, convId);
      }
    }

    let usedTopLevelSkills = false;
    const checkDup = db.prepare(
      `SELECT id FROM messages WHERE conversation_id = ? AND role = ? AND input_tokens = ? AND output_tokens = ? AND cache_hit = ? AND content = ? LIMIT 1`
    );

    for (const msg of messages || []) {
      // Skip system-level session messages
      const c = (msg.content || '').trim();
      if (c === '会话开始' || c === '会话结束' || c === '会话继续' || c === '会话重启') continue;
      // Skip agent lifecycle events (subagent start/end) — status signals, not real messages
      if (/^agent subagent (开始|结束)/.test(c)) continue;

      // Dedup check: skip if identical message already exists
      const existing = checkDup.get(convId, msg.role, msg.input_tokens || 0, msg.output_tokens || 0, msg.cache_hit ?? 0, c);
      if (existing) continue;

      // Per-message model: prefer message-level model, fall back to conversation model
      const msgModel = resolveModel(msg.model) || resolvedModel || model || 'deepseek-v4-pro';

      // Anomaly detection: cache_hit > model max context → skip (dirty data)
      const maxCtx = MODEL_MAX_CONTEXT[msgModel];
      if (maxCtx && (msg.cache_hit || 0) > maxCtx) {
        console.warn(`[collector] SKIP: cache_hit ${msg.cache_hit} > ${msgModel} max_ctx ${maxCtx} (conv=${convId})`);
        continue;
      }

      const cost = calcCost(msgModel, msg.input_tokens || 0, msg.output_tokens || 0, msg.cache_hit || 0);
      const baseline = calcBaselineCost(msg.input_tokens || 0, msg.output_tokens || 0, msg.cache_hit || 0);
      const ctxPct = calcContextWindowPct(msgModel, msg.input_tokens || 0, msg.cache_hit || 0);

      const result = insertMsg.run(
        convId, msg.role, c,
        msg.input_tokens || 0, msg.output_tokens || 0,
        msg.cache_hit ?? null,
        cost?.input_cost ?? null,
        cost?.output_cost ?? null,
        cost?.cache_cost ?? null,
        baseline?.total_cost ?? null,
        msgModel,
        ctxPct,
        msg.created_at || now
      );
      const msgId = result.lastInsertRowid;

      const msgSkills = msg.skillCalls;
      if (msgSkills && msgSkills.length > 0) {
        for (const skill of msgSkills) {
          insertSkill.run(msgId, skill.name, skill.type || 'local',
            skill.input_tokens || 0, skill.output_tokens || 0,
            skill.duration_ms || null, skill.status || 'success',
            skill.agent_name || null, skill.agent_team || null);
        }
      } else if (skillCalls && skillCalls.length > 0 && !usedTopLevelSkills && msg.role === 'assistant') {
        usedTopLevelSkills = true;
        for (const skill of skillCalls) {
          insertSkill.run(msgId, skill.name, skill.type || 'local',
            skill.input_tokens || 0, skill.output_tokens || 0,
            skill.duration_ms || null, skill.status || 'success',
            skill.agent_name || null, skill.agent_team || null);
        }
      }

      // Costs tracked in messages table only; conversation totals managed by PATCH handler
    }

    // conversation totals + daily stats managed by PATCH handler (avoids double-count)
  });

  tx();
  return convId;
}

module.exports = { saveRecord };
