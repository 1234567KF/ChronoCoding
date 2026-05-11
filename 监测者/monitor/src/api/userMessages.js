const { Router } = require('express');
const { getDB } = require('../db');

const router = Router();

// GET /api/user-messages — user messages as primary rows with aggregated A2A chain data
router.get('/user-messages', (req, res) => {
  const db = getDB();
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;
  const search = req.query.search || '';
  const dateFrom = req.query.date_from || '';
  const dateTo = req.query.date_to || '';

  // Count total user messages
  let where = 'WHERE m.role = ?';
  const params = ['user'];
  if (search) {
    where += ' AND m.content LIKE ?';
    params.push(`%${search}%`);
  }
  if (dateFrom) {
    where += ' AND m.created_at >= ?';
    params.push(dateFrom);
  }
  if (dateTo) {
    where += ' AND m.created_at <= ?';
    params.push(dateTo + 'T23:59:59');
  }

  const total = db.prepare(
    `SELECT COUNT(*) as count FROM messages m ${where}`
  ).get(...params).count;

  // Get user messages with pagination
  const userRows = db.prepare(`
    SELECT m.id, m.conversation_id, m.content, m.created_at, c.session_id, c.title, c.model, c.total_cost as conv_total_cost
    FROM messages m
    LEFT JOIN conversations c ON m.conversation_id = c.id
    ${where}
    ORDER BY m.created_at DESC, m.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  // For each user message, find the A2A chain (assistant messages after it, until next user message)
  for (const row of userRows) {
    // Find the next user message in the same conversation (after this one)
    const nextUser = db.prepare(`
      SELECT MIN(created_at) as next_time, MIN(id) as next_id
      FROM messages
      WHERE conversation_id = ? AND role = 'user' AND (created_at > ? OR (created_at = ? AND id > ?))
    `).get(row.conversation_id, row.created_at, row.created_at, row.id);

    // Get all assistant messages between this user message and the next one
    let chainMsgs;
    if (nextUser && nextUser.next_time) {
      chainMsgs = db.prepare(`
        SELECT m.*, GROUP_CONCAT(DISTINCT sc.skill_name) as skill_list,
               GROUP_CONCAT(DISTINCT sc.agent_name) as agent_list
        FROM messages m
        LEFT JOIN skill_calls sc ON sc.message_id = m.id
        WHERE m.conversation_id = ? AND m.role = 'assistant'
          AND (m.created_at > ? OR (m.created_at = ? AND m.id > ?))
          AND (m.created_at < ? OR (m.created_at = ? AND m.id < ?))
        GROUP BY m.id
        ORDER BY m.created_at ASC, m.id ASC
      `).all(
        row.conversation_id,
        row.created_at, row.created_at, row.id,
        nextUser.next_time, nextUser.next_time, nextUser.next_id
      );
    } else {
      // No next user message — all remaining assistant messages are in chain
      chainMsgs = db.prepare(`
        SELECT m.*, GROUP_CONCAT(DISTINCT sc.skill_name) as skill_list,
               GROUP_CONCAT(DISTINCT sc.agent_name) as agent_list
        FROM messages m
        LEFT JOIN skill_calls sc ON sc.message_id = m.id
        WHERE m.conversation_id = ? AND m.role = 'assistant'
          AND (m.created_at > ? OR (m.created_at = ? AND m.id > ?))
        GROUP BY m.id
        ORDER BY m.created_at ASC, m.id ASC
      `).all(
        row.conversation_id,
        row.created_at, row.created_at, row.id
      );
    }

    // Aggregate chain data
    let a2aCount = 0, totalInput = 0, totalOutput = 0, totalCache = 0, totalUncached = 0;
    let totalCost = 0, totalBaseline = 0;
    const skillsMap = {};
    const agentsSet = new Set();

    for (const msg of chainMsgs) {
      a2aCount++;
      totalInput += (msg.input_tokens || 0) + (msg.cache_hit || 0);
      totalUncached += msg.input_tokens || 0;
      totalOutput += msg.output_tokens || 0;
      totalCache += msg.cache_hit || 0;
      totalCost += (msg.input_cost || 0) + (msg.output_cost || 0) + (msg.cache_cost || 0);
      totalBaseline += msg.baseline_cost || 0;

      if (msg.skill_list) {
        for (const sk of msg.skill_list.split(',')) {
          const skName = sk.trim();
          if (skName) skillsMap[skName] = (skillsMap[skName] || 0) + 1;
        }
      }
      if (msg.agent_list) {
        for (const ag of msg.agent_list.split(',')) {
          const agName = ag.trim();
          if (agName) agentsSet.add(agName);
        }
      }
    }

    row.msg_id = row.id;
    row.user_content = row.content;
    row.a2a_count = a2aCount;
    row.total_uncached_input = totalUncached;
    row.total_cached_input = totalCache;
    row.total_input_tokens = totalInput;
    row.total_output_tokens = totalOutput;
    row.total_cache_hit = totalCache;
    row.total_cost = totalCost;
    row.total_baseline_cost = totalBaseline;
    row.savings = totalBaseline > 0 ? totalBaseline - totalCost : 0;
    row.skills = Object.entries(skillsMap).map(([name, count]) => ({ name, count }));
    row.agents = [...agentsSet];
    row.model = null; // We don't track model per-chain

    // Clean up raw fields
    delete row.content;
  }

  res.json({ data: userRows, total, page, limit });
});

// GET /api/user-messages/:id — user message detail with full A2A chain
router.get('/user-messages/:id', (req, res) => {
  const db = getDB();
  const userMsg = db.prepare(`
    SELECT m.*, c.title, c.session_id, c.model as conv_model
    FROM messages m
    LEFT JOIN conversations c ON m.conversation_id = c.id
    WHERE m.id = ? AND m.role = 'user'
  `).get(req.params.id);

  if (!userMsg) return res.status(404).json({ error: 'User message not found' });

  // Find next user message to delimit the chain
  const nextUser = db.prepare(`
    SELECT MIN(created_at) as next_time, MIN(id) as next_id
    FROM messages
    WHERE conversation_id = ? AND role = 'user' AND (created_at > ? OR (created_at = ? AND id > ?))
  `).get(userMsg.conversation_id, userMsg.created_at, userMsg.created_at, userMsg.id);

  let chain;
  if (nextUser && nextUser.next_time) {
    chain = db.prepare(`
      SELECT m.*, sc.skill_name, sc.skill_type, sc.agent_name, sc.agent_team, sc.input_tokens as sc_in, sc.output_tokens as sc_out, sc.duration_ms, sc.status
      FROM messages m
      LEFT JOIN skill_calls sc ON sc.message_id = m.id
      WHERE m.conversation_id = ? AND m.role = 'assistant'
        AND (m.created_at > ? OR (m.created_at = ? AND m.id > ?))
        AND (m.created_at < ? OR (m.created_at = ? AND m.id < ?))
      ORDER BY m.created_at ASC, m.id ASC
    `).all(
      userMsg.conversation_id,
      userMsg.created_at, userMsg.created_at, userMsg.id,
      nextUser.next_time, nextUser.next_time, nextUser.next_id
    );
  } else {
    chain = db.prepare(`
      SELECT m.*, sc.skill_name, sc.skill_type, sc.agent_name, sc.agent_team, sc.input_tokens as sc_in, sc.output_tokens as sc_out, sc.duration_ms, sc.status
      FROM messages m
      LEFT JOIN skill_calls sc ON sc.message_id = m.id
      WHERE m.conversation_id = ? AND m.role = 'assistant'
        AND (m.created_at > ? OR (m.created_at = ? AND m.id > ?))
      ORDER BY m.created_at ASC, m.id ASC
    `).all(
      userMsg.conversation_id,
      userMsg.created_at, userMsg.created_at, userMsg.id
    );
  }

  // Group chain messages with their skill_calls
  const chainMap = {};
  for (const row of chain) {
    if (!chainMap[row.id]) {
      chainMap[row.id] = {
        id: row.id,
        role: row.role,
        content: row.content,
        input_tokens: row.input_tokens,
        output_tokens: row.output_tokens,
        cache_hit: row.cache_hit,
        cache_cost: row.cache_cost,
        input_cost: row.input_cost,
        output_cost: row.output_cost,
        model: row.model,
        context_window_pct: row.context_window_pct,
        created_at: row.created_at,
        skillCalls: []
      };
    }
    if (row.skill_name) {
      chainMap[row.id].skillCalls.push({
        skill_name: row.skill_name,
        skill_type: row.skill_type,
        agent_name: row.agent_name,
        agent_team: row.agent_team,
        input_tokens: row.sc_in,
        output_tokens: row.sc_out,
        duration_ms: row.duration_ms,
        status: row.status
      });
    }
  }

  res.json({
    user_message: {
      id: userMsg.id,
      conversation_id: userMsg.conversation_id,
      content: userMsg.content,
      created_at: userMsg.created_at,
      title: userMsg.title,
      session_id: userMsg.session_id,
      model: userMsg.conv_model
    },
    chain: Object.values(chainMap),
    chain_count: Object.keys(chainMap).length,
    total_cost: Object.values(chainMap).reduce((s, m) => s + (m.input_cost || 0) + (m.output_cost || 0) + (m.cache_cost || 0), 0),
    total_uncached_input: Object.values(chainMap).reduce((s, m) => s + (m.input_tokens || 0), 0),
    total_cached_input: Object.values(chainMap).reduce((s, m) => s + (m.cache_hit || 0), 0),
    total_input_tokens: Object.values(chainMap).reduce((s, m) => s + (m.input_tokens || 0) + (m.cache_hit || 0), 0),
    total_output_tokens: Object.values(chainMap).reduce((s, m) => s + (m.output_tokens || 0), 0)
  });
});

module.exports = router;
