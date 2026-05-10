const { Router } = require('express');
const { getDB } = require('../db');
const { getPricingInfo } = require('../pricing');

const router = Router();

// GET /api/stats/tokens?range=7d|30d
router.get('/stats/tokens', (req, res) => {
  const db = getDB();
  const range = req.query.range || '7d';
  const days = range === '30d' ? 30 : 7;
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  const daily = db.prepare(
    `SELECT date, total_input, total_output, cache_hit_input, total_cost, total_baseline_cost
     FROM token_daily_stats WHERE date >= ? ORDER BY date ASC`
  ).all(since);

  // Summary: prefer messages table (authoritative) over token_daily_stats (may be stale/incomplete)
  const msgTotals = db.prepare(
    `SELECT
       COALESCE(SUM(m.input_tokens + m.cache_hit), 0) as total_input,
       COALESCE(SUM(m.output_tokens), 0) as total_output,
       COALESCE(SUM(m.input_cost + m.output_cost + m.cache_cost), 0) as total_cost,
       COALESCE(SUM(m.baseline_cost), 0) as total_baseline_cost
     FROM messages m
     JOIN conversations c ON m.conversation_id = c.id
     WHERE date(c.started_at) >= ?`
  ).get(since);
  const statsTotals = db.prepare(
    `SELECT
       COALESCE(SUM(total_input), 0) as total_input,
       COALESCE(SUM(total_output), 0) as total_output,
       COALESCE(SUM(total_cost), 0) as total_cost,
       COALESCE(SUM(total_baseline_cost), 0) as total_baseline_cost
     FROM token_daily_stats WHERE date >= ?`
  ).get(since);

  // Merge: use max of both sources (messages authoritative for costs, daily_stats for token counts)
  const summary = {
    total_input: Math.max(statsTotals.total_input, msgTotals.total_input),
    total_output: Math.max(statsTotals.total_output, msgTotals.total_output),
    total_cost: msgTotals.total_cost || statsTotals.total_cost || 0,
    total_baseline_cost: msgTotals.total_baseline_cost || statsTotals.total_baseline_cost || 0,
  };

  res.json({ daily, summary, range, pricing: getPricingInfo() });
});

// GET /api/stats/by-message-type?range=7d|30d — user vs A2A breakdown
router.get('/stats/by-message-type', (req, res) => {
  const db = getDB();
  const range = req.query.range || '7d';
  const days = range === '30d' ? 30 : 7;
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const rows = db.prepare(
    `SELECT
       m.role,
       COUNT(*) as msg_count,
       COALESCE(SUM(m.input_tokens), 0) as uncached_input,
       COALESCE(SUM(CASE WHEN m.cache_hit > 0 THEN m.cache_hit ELSE 0 END), 0) as cached_input,
       COALESCE(SUM(m.output_tokens), 0) as total_output,
       COALESCE(SUM(m.input_cost), 0) as input_cost,
       COALESCE(SUM(m.output_cost), 0) as output_cost,
       COALESCE(SUM(m.cache_cost), 0) as cache_cost,
       COALESCE(SUM(m.baseline_cost), 0) as baseline_cost,
       COALESCE(AVG(m.cache_hit), 0) as avg_cache_hit
     FROM messages m
     JOIN conversations c ON m.conversation_id = c.id
     WHERE c.started_at >= ?
     GROUP BY m.role
     ORDER BY m.role`
  ).all(since);

  // Build response: separate user / assistant / total
  let userRow = rows.find(r => r.role === 'user') || { msg_count: 0, uncached_input: 0, cached_input: 0, total_output: 0, input_cost: 0, output_cost: 0, cache_cost: 0, baseline_cost: 0, avg_cache_hit: 0 };
  let assistantRow = rows.find(r => r.role === 'assistant') || { msg_count: 0, uncached_input: 0, cached_input: 0, total_output: 0, input_cost: 0, output_cost: 0, cache_cost: 0, baseline_cost: 0, avg_cache_hit: 0 };

  const totalCost = (userRow.input_cost + userRow.output_cost + userRow.cache_cost + assistantRow.input_cost + assistantRow.output_cost + assistantRow.cache_cost);
  const totalBaseline = (userRow.baseline_cost || 0) + (assistantRow.baseline_cost || 0);

  res.json({
    range,
    user: {
      label: '用户消息',
      msg_count: userRow.msg_count,
      uncached_input: userRow.uncached_input,
      cached_input: userRow.cached_input,
      total_input: userRow.uncached_input + userRow.cached_input,
      total_output: userRow.total_output,
      input_cost: userRow.input_cost,
      output_cost: userRow.output_cost,
      cache_cost: userRow.cache_cost,
      total_cost: userRow.input_cost + userRow.output_cost + userRow.cache_cost,
      baseline_cost: userRow.baseline_cost || 0,
    },
    a2a: {
      label: 'A2A 消息',
      msg_count: assistantRow.msg_count,
      uncached_input: assistantRow.uncached_input,
      cached_input: assistantRow.cached_input,
      total_input: assistantRow.uncached_input + assistantRow.cached_input,
      total_output: assistantRow.total_output,
      input_cost: assistantRow.input_cost,
      output_cost: assistantRow.output_cost,
      cache_cost: assistantRow.cache_cost,
      total_cost: assistantRow.input_cost + assistantRow.output_cost + assistantRow.cache_cost,
      baseline_cost: assistantRow.baseline_cost || 0,
    },
    total: {
      msg_count: userRow.msg_count + assistantRow.msg_count,
      uncached_input: userRow.uncached_input + assistantRow.uncached_input,
      cached_input: userRow.cached_input + assistantRow.cached_input,
      total_input: (userRow.uncached_input + userRow.cached_input) + (assistantRow.uncached_input + assistantRow.cached_input),
      total_output: userRow.total_output + assistantRow.total_output,
      input_cost: userRow.input_cost + assistantRow.input_cost,
      output_cost: userRow.output_cost + assistantRow.output_cost,
      cache_cost: userRow.cache_cost + assistantRow.cache_cost,
      total_cost: totalCost,
      baseline_cost: totalBaseline,
    },
  });
});

// GET /api/stats/messages?range=7d|30d — per-message breakdown
router.get('/stats/messages', (req, res) => {
  const db = getDB();
  const range = req.query.range || '7d';
  const days = range === '30d' ? 30 : 7;
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 100));
  const type = req.query.type || '';  // 'user' or 'assistant' or ''

  let where = 'WHERE c.started_at >= ?';
  const params = [since];
  if (type === 'user' || type === 'assistant') {
    where += ' AND m.role = ?';
    params.push(type);
  }

  const data = db.prepare(
    `SELECT
       m.id, m.conversation_id, m.role, m.content,
       m.input_tokens, m.output_tokens, m.cache_hit,
       m.input_cost, m.output_cost, m.model,
       m.created_at,
       c.title as conv_title,
       c.model as conv_model
     FROM messages m
     JOIN conversations c ON m.conversation_id = c.id
     ${where}
     ORDER BY m.created_at DESC
     LIMIT ?`
  ).all(...params, limit);

  res.json({ data, range });
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

// GET /api/stats/agents?range=7d|30d — per-agent token breakdown
router.get('/stats/agents', (req, res) => {
  const db = getDB();
  const range = req.query.range || '7d';
  const days = range === '30d' ? 30 : 7;
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const agents = db.prepare(
    `SELECT
       COALESCE(sc.agent_name, '(主会话)') as agent_name,
       COALESCE(sc.agent_team, 'main') as agent_team,
       COUNT(*) as call_count,
       COALESCE(SUM(sc.input_tokens), 0) as total_input,
       COALESCE(SUM(sc.output_tokens), 0) as total_output,
       COUNT(DISTINCT m.conversation_id) as session_count
     FROM skill_calls sc
     JOIN messages m ON sc.message_id = m.id
     JOIN conversations c ON m.conversation_id = c.id
     WHERE c.started_at >= ?
     GROUP BY sc.agent_name, sc.agent_team
     ORDER BY total_input DESC`
  ).all(since);

  res.json({ data: agents, range });
});

// GET /api/v1/cache — 缓存命中率按模型分组（kf-monitor 端点）
router.get('/v1/cache', (req, res) => {
  const db = getDB();
  const range = req.query.range || '7d';
  const days = range === '30d' ? 30 : 7;
  const since = new Date(Date.now() - days * 86400000).toISOString();

  // 按模型的缓存统计
  const byModel = db.prepare(
    `SELECT
       COALESCE(m.model, 'unknown') as model,
       COUNT(*) as call_count,
       COALESCE(SUM(m.input_tokens), 0) as uncached_input,
       COALESCE(SUM(CASE WHEN m.cache_hit > 0 THEN m.cache_hit ELSE 0 END), 0) as cached_input,
       COALESCE(SUM(m.output_tokens), 0) as total_output,
       COALESCE(SUM(m.input_cost), 0) as input_cost,
       COALESCE(SUM(m.output_cost), 0) as output_cost,
       COALESCE(SUM(m.cache_cost), 0) as cache_cost
     FROM messages m
     JOIN conversations c ON m.conversation_id = c.id
     WHERE c.started_at >= ?
     GROUP BY m.model
     ORDER BY cached_input DESC`
  ).all(since);

  // 汇总
  let totalUncached = 0, totalCached = 0, totalOutput = 0;
  let totalInputCost = 0, totalOutputCost = 0, totalCacheCost = 0;
  byModel.forEach(row => {
    totalUncached += row.uncached_input;
    totalCached += row.cached_input;
    totalOutput += row.total_output;
    totalInputCost += row.input_cost;
    totalOutputCost += row.output_cost;
    totalCacheCost += row.cache_cost;
  });
  const totalInputAll = totalUncached + totalCached;
  const overallHitRate = totalInputAll > 0 ? (totalCached / totalInputAll * 100) : 0;

  // 每模型估算节省（按 baseline input 计费 - 实际 input 计费）
  const MODEL_BASELINE_INPUT_RATE = 3; // ¥3/MTok (pro 正价)
  const overallBaselineCost = (totalInputAll / 1000000) * MODEL_BASELINE_INPUT_RATE;
  const actualInputCost = totalInputCost + totalCacheCost;
  const estimatedSavings = Math.max(0, overallBaselineCost - actualInputCost);

  res.json({
    range,
    summary: {
      total_uncached_input: totalUncached,
      total_cached_input: totalCached,
      total_input: totalInputAll,
      total_output: totalOutput,
      overall_cache_hit_rate: Math.round(overallHitRate * 100) / 100,
      total_input_cost: Math.round(totalInputCost * 100000) / 100000,
      total_output_cost: Math.round(totalOutputCost * 100000) / 100000,
      total_cache_cost: Math.round(totalCacheCost * 100000) / 100000,
      total_actual_cost: Math.round((totalInputCost + totalOutputCost + totalCacheCost) * 100000) / 100000,
      estimated_baseline_cost: Math.round(overallBaselineCost * 100000) / 100000,
      estimated_savings: Math.round(estimatedSavings * 100000) / 100000,
      status: overallHitRate > 50 ? 'good' : overallHitRate > 20 ? 'warning' : 'critical',
    },
    by_model: byModel.map(row => {
      const total = row.uncached_input + row.cached_input;
      const rate = total > 0 ? (row.cached_input / total * 100) : 0;
      return {
        model: row.model,
        call_count: row.call_count,
        uncached_input: row.uncached_input,
        cached_input: row.cached_input,
        total_input: total,
        total_output: row.total_output,
        cache_hit_rate: Math.round(rate * 100) / 100,
        input_cost: row.input_cost,
        output_cost: row.output_cost,
        cache_cost: row.cache_cost,
      };
    }),
  });
});

// GET /api/stats/review-reruns?range=7d|30d — re-review trigger tracking
router.get('/stats/review-reruns', (req, res) => {
  const db = getDB();
  const range = req.query.range || '7d';
  const days = range === '30d' ? 30 : 7;
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  // Trigger counts by skill
  const bySkill = db.prepare(
    `SELECT skill_name, COUNT(*) as total_checks,
       SUM(CASE WHEN triggered = 1 THEN 1 ELSE 0 END) as trigger_count,
       SUM(p0_count) as total_p0,
       SUM(p1_count) as total_p1,
       MAX(round) as max_round
     FROM review_reruns
     WHERE date(created_at) >= ?
     GROUP BY skill_name
     ORDER BY trigger_count DESC`
  ).all(since);

  // Trigger counts by team
  const byTeam = db.prepare(
    `SELECT COALESCE(agent_team, 'unknown') as agent_team,
       COUNT(*) as total_checks,
       SUM(CASE WHEN triggered = 1 THEN 1 ELSE 0 END) as trigger_count,
       SUM(p0_count) as total_p0,
       SUM(p1_count) as total_p1
     FROM review_reruns
     WHERE date(created_at) >= ?
     GROUP BY agent_team
     ORDER BY trigger_count DESC`
  ).all(since);

  // Daily trigger trend
  const daily = db.prepare(
    `SELECT date(created_at) as date,
       COUNT(*) as total_checks,
       SUM(CASE WHEN triggered = 1 THEN 1 ELSE 0 END) as trigger_count
     FROM review_reruns
     WHERE date(created_at) >= ?
     GROUP BY date(created_at)
     ORDER BY date ASC`
  ).all(since);

  // Recent detailed records
  const recent = db.prepare(
    `SELECT id, review_path, skill_name, agent_team, round, triggered,
       p0_count, p1_count, p1_density, total_issues, total_lines, decision, created_at
     FROM review_reruns
     WHERE date(created_at) >= ?
     ORDER BY created_at DESC
     LIMIT 50`
  ).all(since);

  // Summary
  const summary = db.prepare(
    `SELECT COUNT(*) as total_checks,
       SUM(CASE WHEN triggered = 1 THEN 1 ELSE 0 END) as total_triggers,
       SUM(p0_count) as total_p0,
       SUM(p1_count) as total_p1
     FROM review_reruns
     WHERE date(created_at) >= ?`
  ).get(since);

  res.json({
    range,
    summary: {
      total_checks: summary.total_checks || 0,
      total_triggers: summary.total_triggers || 0,
      total_p0: summary.total_p0 || 0,
      total_p1: summary.total_p1 || 0,
      trigger_rate: summary.total_checks > 0
        ? Math.round((summary.total_triggers / summary.total_checks) * 10000) / 100
        : 0,
    },
    by_skill: bySkill,
    by_team: byTeam,
    daily,
    recent,
  });
});

module.exports = router;
