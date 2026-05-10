/**
 * 清理重复的汇总消息 + 重建 daily_stats
 *
 * 重复来源：token-accum.cjs 的 pushToMonitor 每次 PostToolUse hook 都会 POST
 * 一条包含 "K in (缓存" 字样的汇总消息，与 pushNewMessages 推送的明细消息重叠。
 *
 * 从 2026-05-09 起 pushToMonitor 不再 POST 汇总消息（已有改动），
 * 本脚本清理历史残留。
 */
const path = require('path');
const Database = require('better-sqlite3');
const { calcCost, calcBaselineCost } = require('../src/pricing');

const DB_PATH = path.join(__dirname, '..', 'data', 'monitor.db');
const db = new Database(DB_PATH);

console.log('=== Step 1: 统计当前数据 ===');
const before = db.prepare(`
  SELECT
    COUNT(*) as total_msgs,
    SUM(CASE WHEN content LIKE '%K in (缓存%' THEN 1 ELSE 0 END) as summary_msgs,
    COUNT(DISTINCT conversation_id) as convs
  FROM messages
`).get();
console.log(`  总消息: ${before.total_msgs}, 汇总消息: ${before.summary_msgs}, 会话数: ${before.convs}`);

const costBefore = db.prepare(`SELECT SUM(total_cost) as cost FROM token_daily_stats`).get();
console.log(`  daily_stats 累计总费用: ¥${(costBefore?.cost || 0).toFixed(4)}`);

console.log('\n=== Step 2: 删除重复的汇总消息 ===');
const deleted = db.prepare(`
  DELETE FROM messages WHERE content LIKE '%K in (缓存%'
`).run();
console.log(`  删除了 ${deleted.changes} 条汇总消息`);

const orphanSkills = db.prepare(`
  DELETE FROM skill_calls WHERE message_id NOT IN (SELECT id FROM messages)
`).run();
console.log(`  清理了 ${orphanSkills.changes} 条孤儿 skill_calls`);

console.log('\n=== Step 3: 基于现有 cost 列重建 token_daily_stats ===');
// 清空 daily_stats
db.prepare('DELETE FROM token_daily_stats').run();

// 从 messages 的已存储 cost 列聚合（使用同一 pricing 模块计算的值）
const dailyData = db.prepare(`
  SELECT
    substr(created_at, 1, 10) as day,
    SUM(COALESCE(input_tokens, 0)) as total_input,
    SUM(COALESCE(output_tokens, 0)) as total_output,
    SUM(COALESCE(cache_hit, 0)) as total_cache,
    SUM(COALESCE(input_cost, 0) + COALESCE(output_cost, 0) + COALESCE(cache_cost, 0)) as total_cost,
    SUM(COALESCE(baseline_cost, 0)) as total_baseline
  FROM messages
  WHERE created_at IS NOT NULL
  GROUP BY substr(created_at, 1, 10)
  ORDER BY day
`).all();

const insertDaily = db.prepare(`
  INSERT INTO token_daily_stats (date, total_input, total_output, cache_hit_input, total_cost, total_baseline_cost, skill_breakdown)
  VALUES (?, ?, ?, ?, ?, ?, '{}')
`);

let rebuiltCost = 0;
for (const d of dailyData) {
  insertDaily.run(d.day, d.total_input || 0, d.total_output || 0, d.total_cache || 0,
    d.total_cost || 0, d.total_baseline || 0);
  rebuiltCost += d.total_cost || 0;
  console.log(`  ${d.day}: in=${(d.total_input||0).toLocaleString()} cache=${(d.total_cache||0).toLocaleString()} out=${(d.total_output||0).toLocaleString()} cost=¥${(d.total_cost||0).toFixed(4)}`);
}

console.log(`\n=== Step 4: 重建会话汇总值（使用已存储的成本列）===`);
const convs = db.prepare('SELECT id FROM conversations').all();
const updateConv = db.prepare(`
  UPDATE conversations SET
    total_input_tokens = (SELECT COALESCE(SUM(COALESCE(input_tokens, 0) + COALESCE(cache_hit, 0)), 0) FROM messages WHERE conversation_id = ?),
    total_output_tokens = (SELECT COALESCE(SUM(COALESCE(output_tokens, 0)), 0) FROM messages WHERE conversation_id = ?),
    total_cost = (SELECT COALESCE(SUM(COALESCE(input_cost, 0) + COALESCE(output_cost, 0) + COALESCE(cache_cost, 0)), 0) FROM messages WHERE conversation_id = ?),
    total_baseline_cost = (SELECT COALESCE(SUM(COALESCE(baseline_cost, 0)), 0) FROM messages WHERE conversation_id = ?)
  WHERE id = ?
`);
let convCount = 0;
for (const c of convs) {
  updateConv.run(c.id, c.id, c.id, c.id, c.id);
  convCount++;
}
console.log(`  已更新 ${convCount} 个会话`);

console.log('\n=== 清理完成 ===');
console.log(`  daily_stats 重建后总费用: ¥${rebuiltCost.toFixed(4)}`);
console.log(`  (原: ¥${(costBefore?.cost || 0).toFixed(4)}, 差额: ¥${((costBefore?.cost || 0) - rebuiltCost).toFixed(4)})`);

const after = db.prepare(`SELECT COUNT(*) as cnt FROM messages`).get();
console.log(`  剩余消息: ${after.cnt} 条`);

db.close();
