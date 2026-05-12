/**
 * 消息去重 + 成本修正
 */
const path = require('path');
const Database = require('better-sqlite3');
const { calcCost, calcBaselineCost, MODEL_ALIASES } = require('../src/pricing');

const DB_PATH = path.join(__dirname, '..', 'data', 'monitor.db');
const db = new Database(DB_PATH);
db.pragma('foreign_keys = OFF');

console.log('=== Step 1: 统计当前数据 ===');
const before = db.prepare('SELECT COUNT(*) as cnt FROM messages').get();
console.log(`  messages: ${before.cnt} 条`);
const beforeSkills = db.prepare('SELECT COUNT(*) as cnt FROM skill_calls').get();
console.log(`  skill_calls: ${beforeSkills.cnt} 条`);
const beforeCost = db.prepare('SELECT SUM(total_cost) as cost FROM conversations').get();
console.log(`  conversations 累计: ¥${(beforeCost?.cost || 0).toFixed(4)}`);

console.log('\n=== Step 2: 计算重复 ===');
const unique = db.prepare('SELECT COUNT(*) as cnt FROM (SELECT MIN(id) FROM messages GROUP BY conversation_id, role, content, model)').get();
console.log(`  唯一消息: ${unique.cnt}, 重复: ${before.cnt - unique.cnt}`);

console.log('\n=== Step 3: 删除重复 (保留最小 id) ===');
// Delete skill_calls for messages that will be removed
db.prepare(`
  DELETE FROM skill_calls WHERE message_id NOT IN (
    SELECT MIN(id) FROM messages GROUP BY conversation_id, role, content, model
  )
`).run();
// Delete duplicate messages
db.prepare(`
  DELETE FROM messages WHERE id NOT IN (
    SELECT MIN(id) FROM messages GROUP BY conversation_id, role, content, model
  )
`).run();
const after = db.prepare('SELECT COUNT(*) as cnt FROM messages').get();
console.log(`  去重后 messages: ${after.cnt} 条`);

console.log('\n=== Step 4: 重建 per-message 成本 ===');
const allMsgs = db.prepare('SELECT id, model, input_tokens, output_tokens, cache_hit FROM messages').all();
const updateCost = db.prepare('UPDATE messages SET input_cost = ?, output_cost = ?, cache_cost = ?, baseline_cost = ? WHERE id = ?');
for (const msg of allMsgs) {
  const model = MODEL_ALIASES[msg.model] || msg.model || 'deepseek-v4-flash';
  const cost = calcCost(model, msg.input_tokens || 0, msg.output_tokens || 0, msg.cache_hit || 0);
  const baseline = calcBaselineCost(msg.input_tokens || 0, msg.output_tokens || 0, msg.cache_hit || 0);
  updateCost.run(cost?.input_cost ?? null, cost?.output_cost ?? null, cost?.cache_cost ?? null, baseline?.total_cost ?? null, msg.id);
}
console.log(`  已更新 ${allMsgs.length} 条消息的成本`);

console.log('\n=== Step 5: 重建 conversations 汇总 ===');
const convs = db.prepare('SELECT DISTINCT id FROM conversations').all();
const updateConv = db.prepare(`
  UPDATE conversations SET
    total_input_tokens = (SELECT COALESCE(SUM(COALESCE(input_tokens,0) + COALESCE(cache_hit,0)), 0) FROM messages WHERE conversation_id = ?),
    total_output_tokens = (SELECT COALESCE(SUM(output_tokens), 0) FROM messages WHERE conversation_id = ?),
    total_cost = (SELECT COALESCE(SUM(COALESCE(input_cost,0) + COALESCE(output_cost,0) + COALESCE(cache_cost,0)), 0) FROM messages WHERE conversation_id = ?),
    total_baseline_cost = (SELECT COALESCE(SUM(baseline_cost), 0) FROM messages WHERE conversation_id = ?)
  WHERE id = ?
`);
for (const c of convs) {
  updateConv.run(c.id, c.id, c.id, c.id, c.id);
}
console.log(`  已更新 ${convs.length} 个会话`);

const afterCost = db.prepare('SELECT SUM(total_cost) as cost FROM conversations').get();
console.log(`  修正后 conversations 累计: ¥${(afterCost?.cost || 0).toFixed(4)}`);

console.log('\n=== Step 6: 重建 token_daily_stats ===');
db.prepare('DELETE FROM token_daily_stats').run();
const dailyData = db.prepare(`
  SELECT substr(created_at, 1, 10) as day,
    SUM(COALESCE(input_tokens,0)) as total_input,
    SUM(COALESCE(output_tokens,0)) as total_output,
    SUM(COALESCE(cache_hit,0)) as total_cache,
    SUM(COALESCE(input_cost,0) + COALESCE(output_cost,0) + COALESCE(cache_cost,0)) as total_cost,
    SUM(COALESCE(baseline_cost,0)) as total_baseline
  FROM messages WHERE created_at IS NOT NULL
  GROUP BY substr(created_at, 1, 10) ORDER BY day
`).all();
const insertDaily = db.prepare(`INSERT INTO token_daily_stats (date, total_input, total_output, cache_hit_input, total_cost, total_baseline_cost) VALUES (?, ?, ?, ?, ?, ?)`);
let totalDailyCost = 0;
for (const d of dailyData) {
  insertDaily.run(d.day, d.total_input, d.total_output, d.total_cache, d.total_cost, d.total_baseline);
  totalDailyCost += d.total_cost;
  console.log(`  ${d.day}: in=${d.total_input.toLocaleString()} cache=${d.total_cache.toLocaleString()} out=${d.total_output.toLocaleString()} cost=¥${d.total_cost.toFixed(4)}`);
}
console.log(`\n  daily_stats 总费用: ¥${totalDailyCost.toFixed(4)}`);

db.pragma('foreign_keys = ON');
console.log('\n=== 清理完成 ===');
console.log(`  messages: ${before.cnt} → ${after.cnt}, 成本: ¥${(beforeCost?.cost || 0).toFixed(4)} → ¥${(afterCost?.cost || 0).toFixed(4)}`);
db.close();
