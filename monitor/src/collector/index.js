const { getDB } = require('../db');
const { calcCost } = require('../pricing');

function saveRecord({ sessionId, title, model, messages, skillCalls }) {
  const db = getDB();
  const convId = sessionId || `conv_${Date.now()}`;
  const now = new Date().toISOString();

  let totalInput = 0, totalOutput = 0, totalCost = 0;

  const insertMsg = db.prepare(
    `INSERT INTO messages (conversation_id, role, content, input_tokens, output_tokens, cache_hit, input_cost, output_cost, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertSkill = db.prepare(
    `INSERT INTO skill_calls (message_id, skill_name, skill_type, input_tokens, output_tokens, duration_ms, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  const tx = db.transaction(() => {
    // upsert conversation
    const existing = db.prepare('SELECT id FROM conversations WHERE id = ?').get(convId);
    if (!existing) {
      db.prepare(
        `INSERT INTO conversations (id, session_id, title, started_at)
         VALUES (?, ?, ?, ?)`
      ).run(convId, sessionId || convId, title || '', now);
    }

    let usedTopLevelSkills = false;
    for (const msg of messages || []) {
      // Calc cost using unified pricing (per MTok, CNY)
      const cost = calcCost(model, msg.input_tokens || 0, msg.output_tokens || 0, msg.cache_hit || 0);

      const result = insertMsg.run(
        convId, msg.role, msg.content,
        msg.input_tokens || 0, msg.output_tokens || 0,
        msg.cache_hit ?? null,
        cost?.input_cost ?? null,
        cost?.output_cost ?? null,
        msg.created_at || now
      );
      const msgId = result.lastInsertRowid;

      // Attach skill calls: per-message first; top-level only once & only to assistant
      const msgSkills = msg.skillCalls;
      if (msgSkills && msgSkills.length > 0) {
        for (const skill of msgSkills) {
          insertSkill.run(msgId, skill.name, skill.type || 'local',
            skill.input_tokens || 0, skill.output_tokens || 0,
            skill.duration_ms || null, skill.status || 'success');
        }
      } else if (skillCalls && skillCalls.length > 0 && !usedTopLevelSkills && msg.role === 'assistant') {
        usedTopLevelSkills = true;
        for (const skill of skillCalls) {
          insertSkill.run(msgId, skill.name, skill.type || 'local',
            skill.input_tokens || 0, skill.output_tokens || 0,
            skill.duration_ms || null, skill.status || 'success');
        }
      }

      totalInput += msg.input_tokens || 0;
      totalOutput += msg.output_tokens || 0;
      totalCost += cost?.total_cost || 0;
    }

    // update conversation totals
    db.prepare(
      `UPDATE conversations SET
        total_input_tokens = total_input_tokens + ?,
        total_output_tokens = total_output_tokens + ?,
        total_cost_output = total_cost_output + ?,
        ended_at = ?
       WHERE id = ?`
    ).run(totalInput, totalOutput, totalCost, now, convId);

    // update daily stats
    const today = now.slice(0, 10);
    const existingStats = db.prepare('SELECT * FROM token_daily_stats WHERE date = ?').get(today);
    if (existingStats) {
      db.prepare(
        `UPDATE token_daily_stats SET
          total_input = total_input + ?,
          total_output = total_output + ?,
          total_cost = total_cost + ?
         WHERE date = ?`
      ).run(totalInput, totalOutput, totalCost, today);
    } else {
      db.prepare(
        `INSERT INTO token_daily_stats (date, total_input, total_output, total_cost)
         VALUES (?, ?, ?, ?)`
      ).run(today, totalInput, totalOutput, totalCost);
    }
  });

  tx();
  return convId;
}

module.exports = { saveRecord };
