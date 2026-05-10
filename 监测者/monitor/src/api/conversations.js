const { Router } = require('express');
const { getDB } = require('../db');

const router = Router();

// GET /api/conversations — list with pagination + search
router.get('/conversations', (req, res) => {
  const db = getDB();
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;
  const search = req.query.search || '';
  const dateFrom = req.query.date_from || '';
  const dateTo = req.query.date_to || '';

  let where = 'WHERE 1=1';
  const params = [];
  if (search) {
    where += ' AND title LIKE ?';
    params.push(`%${search}%`);
  }
  if (dateFrom) {
    where += ' AND started_at >= ?';
    params.push(dateFrom);
  }
  if (dateTo) {
    where += ' AND started_at <= ?';
    params.push(dateTo + 'T23:59:59');
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM conversations ${where}`).get(...params).count;
  const data = db.prepare(
    `SELECT id, session_id, title, model, total_input_tokens, total_output_tokens,
            total_cost, total_baseline_cost, started_at, ended_at, restored_from
     FROM conversations ${where}
     ORDER BY started_at DESC LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);

  // Per-conversation message-type breakdown
  for (const conv of data) {
    // Count user vs A2A messages and their token/cost sums
    const breakdown = db.prepare(
      `SELECT
         m.role,
         COUNT(*) as msg_count,
         COALESCE(SUM(m.input_tokens), 0) as uncached_input,
         COALESCE(SUM(CASE WHEN m.cache_hit > 0 THEN m.cache_hit ELSE 0 END), 0) as cached_input,
         COALESCE(SUM(m.output_tokens), 0) as total_output,
         COALESCE(SUM(m.input_cost), 0) as input_cost,
         COALESCE(SUM(m.output_cost), 0) as output_cost,
         COALESCE(SUM(m.cache_cost), 0) as cache_cost,
          COALESCE(SUM(m.baseline_cost), 0) as baseline_cost
       FROM messages m
       WHERE m.conversation_id = ?
       GROUP BY m.role`
    ).all(conv.id);

    conv.msg_breakdown = {
      user: breakdown.find(r => r.role === 'user') || { msg_count: 0, uncached_input: 0, cached_input: 0, total_output: 0, input_cost: 0, output_cost: 0, cache_cost: 0, baseline_cost: 0 },
      a2a: breakdown.find(r => r.role === 'assistant') || { msg_count: 0, uncached_input: 0, cached_input: 0, total_output: 0, input_cost: 0, output_cost: 0, cache_cost: 0, baseline_cost: 0 },
    };

    // Derive total_cost / total_baseline_cost from msg_breakdown (messages table is authoritative)
    const userB = conv.msg_breakdown.user;
    const a2aB = conv.msg_breakdown.a2a;
    const computedCost = (userB.input_cost || 0) + (userB.output_cost || 0) + (userB.cache_cost || 0)
                      + (a2aB.input_cost || 0) + (a2aB.output_cost || 0) + (a2aB.cache_cost || 0);
    const computedBaseline = (userB.baseline_cost || 0) + (a2aB.baseline_cost || 0);
    conv.total_cost = computedCost || conv.total_cost || 0;
    conv.total_baseline_cost = computedBaseline || conv.total_baseline_cost || 0;

    // Skills: name + call count list
    const skills = db.prepare(
      `SELECT sc.skill_name, COUNT(*) as call_count
       FROM skill_calls sc
       JOIN messages m ON sc.message_id = m.id
       WHERE m.conversation_id = ?
       GROUP BY sc.skill_name
       ORDER BY call_count DESC`
    ).all(conv.id);
    conv.skill_count = skills.length;
    conv.skills = skills;

    // Agent info
    const agentRow = db.prepare(
      `SELECT COUNT(DISTINCT sc.agent_name) as count
       FROM skill_calls sc
       JOIN messages m ON sc.message_id = m.id
       WHERE m.conversation_id = ?
         AND sc.agent_name IS NOT NULL`
    ).get(conv.id);
    conv.agent_count = agentRow?.count || 0;

    if (conv.agent_count > 0) {
      const agents = db.prepare(
        `SELECT DISTINCT sc.agent_name, sc.agent_team
         FROM skill_calls sc
         JOIN messages m ON sc.message_id = m.id
         WHERE m.conversation_id = ?
           AND sc.agent_name IS NOT NULL
         ORDER BY sc.agent_name`
      ).all(conv.id);
      conv.agents = agents.map(a => a.agent_name).join(', ');
      conv.agentTeams = agents.map(a => a.agent_team).filter(Boolean);
    } else {
      conv.agents = '';
      conv.agentTeams = [];
    }

    // Distinct models used in this conversation
    const models = db.prepare(
      `SELECT DISTINCT model FROM messages
       WHERE conversation_id = ? AND model IS NOT NULL AND model != ''
       ORDER BY model`
    ).all(conv.id);
    conv.models_used = models.map(r => r.model);

    // First user message content preview
    const firstUserMsg = db.prepare(
      `SELECT content FROM messages
       WHERE conversation_id = ? AND role = 'user' AND content IS NOT NULL AND content != ''
       ORDER BY created_at ASC, id ASC LIMIT 1`
    ).get(conv.id);
    conv.last_user_message = firstUserMsg?.content?.slice(0, 200) || '';
  }

  res.json({ data, total, page, limit });
});

// GET /api/conversations/:id — detail with messages + per-message cost breakdown
router.get('/conversations/:id', (req, res) => {
  const db = getDB();
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  const messages = db.prepare(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC, id ASC'
  ).all(req.params.id);

  for (const msg of messages) {
    msg.skillCalls = db.prepare(
      'SELECT * FROM skill_calls WHERE message_id = ?'
    ).all(msg.id);

    // Add cost breakdown for each message
    msg.total_input = (msg.input_tokens || 0) + (msg.cache_hit || 0);
    msg.uncached_input = msg.input_tokens || 0;
    msg.cached_input = msg.cache_hit || 0;
    msg.total_cost = (msg.input_cost || 0) + (msg.output_cost || 0) + (msg.cache_cost || 0);
  }

  // Enrich user messages with skill calls from subsequent A2A responses
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === 'user') {
      const userSkills = [...(messages[i].skillCalls || [])];
      const seen = new Set(userSkills.map(s => s.id));
      for (let j = i + 1; j < messages.length && messages[j].role === 'assistant'; j++) {
        for (const sc of (messages[j].skillCalls || [])) {
          if (!seen.has(sc.id)) {
            seen.add(sc.id);
            userSkills.push(sc);
          }
        }
      }
      messages[i].skillCalls = userSkills;
    }
  }

  // Per-agent token breakdown
  const agentBreakdown = db.prepare(
    `SELECT
       COALESCE(sc.agent_name, 'main') as agent_name,
       COALESCE(sc.agent_team, 'main') as agent_team,
       COUNT(*) as call_count,
       SUM(sc.input_tokens) as total_input_tokens,
       SUM(sc.output_tokens) as total_output_tokens
     FROM skill_calls sc
     JOIN messages m ON sc.message_id = m.id
     WHERE m.conversation_id = ?
       AND sc.agent_name IS NOT NULL
     GROUP BY sc.agent_name, sc.agent_team
     ORDER BY total_input_tokens DESC`
  ).all(req.params.id);

  // Message-type summary for this conversation
  const typeSummary = db.prepare(
    `SELECT
       m.role,
       COUNT(*) as msg_count,
       COALESCE(SUM(m.input_tokens), 0) as uncached_input,
       COALESCE(SUM(CASE WHEN m.cache_hit > 0 THEN m.cache_hit ELSE 0 END), 0) as cached_input,
       COALESCE(SUM(m.output_tokens), 0) as total_output,
       COALESCE(SUM(m.input_cost), 0) as input_cost_sum,
       COALESCE(SUM(m.output_cost), 0) as output_cost_sum,
       COALESCE(SUM(m.cache_cost), 0) as cache_cost,
          COALESCE(SUM(m.baseline_cost), 0) as baseline_cost_sum
     FROM messages m
     WHERE m.conversation_id = ?
     GROUP BY m.role`
  ).all(req.params.id);

  // Derive total_cost / total_baseline_cost from typeSummary (messages table is authoritative)
  const typeCosts = { input_cost_sum: 0, output_cost_sum: 0, cache_cost: 0, baseline_cost_sum: 0 };
  for (const t of typeSummary) {
    typeCosts.input_cost_sum  += t.input_cost_sum || 0;
    typeCosts.output_cost_sum += t.output_cost_sum || 0;
    typeCosts.cache_cost      += t.cache_cost || 0;
    typeCosts.baseline_cost_sum += t.baseline_cost_sum || 0;
  }
  const computedCost = typeCosts.input_cost_sum + typeCosts.output_cost_sum + typeCosts.cache_cost;
  const computedBaseline = typeCosts.baseline_cost_sum;
  conv.total_cost = computedCost || conv.total_cost || 0;
  conv.total_baseline_cost = computedBaseline || conv.total_baseline_cost || 0;

  res.json({ ...conv, messages, agentBreakdown, typeSummary });
});

// PATCH /api/conversations/:id/tokens — update cumulative token totals (called mid-session)
router.patch('/conversations/:id/tokens', (req, res) => {
  const db = getDB();
  const conv = db.prepare('SELECT id, total_input_tokens, total_output_tokens, total_cost, total_baseline_cost FROM conversations WHERE id = ?').get(req.params.id);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  const { total_input_tokens, total_output_tokens, total_cost, total_baseline_cost, ended_at } = req.body;
  const updates = [];
  const params = [];
  if (total_input_tokens !== undefined) { updates.push('total_input_tokens = ?'); params.push(total_input_tokens); }
  if (total_output_tokens !== undefined) { updates.push('total_output_tokens = ?'); params.push(total_output_tokens); }
  if (total_cost !== undefined) { updates.push('total_cost = ?'); params.push(total_cost); }
  if (total_baseline_cost !== undefined) { updates.push('total_baseline_cost = ?'); params.push(total_baseline_cost); }
  if (ended_at !== undefined) { updates.push('ended_at = ?'); params.push(ended_at); }
  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

  params.push(req.params.id);

  // Compute deltas for daily stats (PATCH sends absolute values, compute delta from previous)
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const deltaIn = total_input_tokens !== undefined ? Math.max(0, total_input_tokens - (conv.total_input_tokens || 0)) : 0;
  const deltaOut = total_output_tokens !== undefined ? Math.max(0, total_output_tokens - (conv.total_output_tokens || 0)) : 0;
  const deltaCost = total_cost !== undefined ? Math.max(0, total_cost - (conv.total_cost || 0)) : 0;
  const deltaBaseline = total_baseline_cost !== undefined ? Math.max(0, total_baseline_cost - (conv.total_baseline_cost || 0)) : 0;

  const tx = db.transaction(() => {
    db.prepare(`UPDATE conversations SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    // Sync daily stats from delta (covers data when individual message import fails)
    if (deltaIn > 0 || deltaOut > 0 || deltaCost > 0) {
      const existingStats = db.prepare('SELECT * FROM token_daily_stats WHERE date = ?').get(today);
      if (existingStats) {
        db.prepare(
          `UPDATE token_daily_stats SET
            total_input = total_input + ?,
            total_output = total_output + ?,
            total_cost = total_cost + ?,
            total_baseline_cost = total_baseline_cost + ?
           WHERE date = ?`
        ).run(deltaIn, deltaOut, deltaCost, deltaBaseline, today);
      } else {
        db.prepare(
          `INSERT INTO token_daily_stats (date, total_input, total_output, cache_hit_input, total_cost, total_baseline_cost)
           VALUES (?, ?, ?, 0, ?, ?)`
        ).run(today, deltaIn, deltaOut, deltaCost, deltaBaseline);
      }
    }
  });

  tx();
  res.json({ ok: true });
});

module.exports = router;
