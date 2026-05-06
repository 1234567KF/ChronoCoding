const { Router } = require('express');
const { getDB } = require('../db');

const router = Router();

// GET /api/stats/tokens?range=7d|30d
router.get('/stats/tokens', (req, res) => {
  const db = getDB();
  const range = req.query.range || '7d';
  const days = range === '30d' ? 30 : 7;
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  const daily = db.prepare(
    `SELECT date, total_input, total_output, cache_hit_input, total_cost
     FROM token_daily_stats WHERE date >= ? ORDER BY date ASC`
  ).all(since);

  const totals = db.prepare(
    `SELECT
       COALESCE(SUM(total_input), 0) as total_input,
       COALESCE(SUM(total_output), 0) as total_output,
       COALESCE(SUM(total_cost), 0) as total_cost
     FROM token_daily_stats WHERE date >= ?`
  ).get(since);

  res.json({ daily, summary: totals, range });
});

// GET /api/stats/skills?range=7d|30d
router.get('/stats/skills', (req, res) => {
  const db = getDB();
  const range = req.query.range || '7d';
  const days = range === '30d' ? 30 : 7;
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const skills = db.prepare(
    `SELECT
       sc.skill_name,
       sc.skill_type,
       COUNT(*) as call_count,
       COALESCE(SUM(sc.input_tokens), 0) as total_input,
       COALESCE(SUM(sc.output_tokens), 0) as total_output
     FROM skill_calls sc
     JOIN messages m ON sc.message_id = m.id
     JOIN conversations c ON m.conversation_id = c.id
     WHERE c.started_at >= ?
     GROUP BY sc.skill_name
     ORDER BY call_count DESC`
  ).all(since);

  res.json({ data: skills, range });
});

module.exports = router;
