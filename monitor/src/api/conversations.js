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
    `SELECT id, session_id, title, total_input_tokens, total_output_tokens,
            total_cost_output, started_at, ended_at
     FROM conversations ${where}
     ORDER BY started_at DESC LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);

  // get skill count per conversation
  for (const conv of data) {
    const row = db.prepare(
      `SELECT COUNT(DISTINCT sc.skill_name) as count
       FROM skill_calls sc
       JOIN messages m ON sc.message_id = m.id
       WHERE m.conversation_id = ?`
    ).get(conv.id);
    conv.skill_count = row?.count || 0;
  }

  res.json({ data, total, page, limit });
});

// GET /api/conversations/:id — detail with messages + skill calls
router.get('/conversations/:id', (req, res) => {
  const db = getDB();
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  const messages = db.prepare(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY id ASC'
  ).all(req.params.id);

  for (const msg of messages) {
    msg.skillCalls = db.prepare(
      'SELECT * FROM skill_calls WHERE message_id = ?'
    ).all(msg.id);
  }

  res.json({ ...conv, messages });
});

module.exports = router;
