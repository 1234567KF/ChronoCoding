#!/usr/bin/env node
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const db = new Database(path.join(__dirname, '..', 'data', 'monitor.db'));

// 1. Verify message-to-conversation mapping
console.log('=== All messages grouped by conversation_id ===');
const groups = db.prepare('SELECT conversation_id, COUNT(*) as cnt, SUM(input_tokens) as sit, SUM(output_tokens) as sot, SUM(COALESCE(cache_hit,0)) as sch, SUM(COALESCE(input_cost,0)) as sic, SUM(COALESCE(output_cost,0)) as soc, SUM(COALESCE(cache_cost,0)) as scc FROM messages GROUP BY conversation_id').all();
for (const g of groups) {
  console.log(`  conv=${g.conversation_id?.slice(0,16)} cnt=${g.cnt} in=${g.sit} out=${g.sot} cache=${g.sch} cost_in=${g.sic} cost_out=${g.soc} cost_cache=${g.scc}`);
}

// 2. Check conversations
console.log('\n=== All conversations ===');
const convs = db.prepare('SELECT id, total_input_tokens, total_output_tokens, total_cost, total_baseline_cost, started_at, ended_at FROM conversations').all();
for (const c of convs) {
  console.log(`  id=${c.id?.slice(0,16)} in=${c.total_input_tokens} out=${c.total_output_tokens} cost=${c.total_cost} baseline=${c.total_baseline_cost} started=${c.started_at} ended=${c.ended_at}`);
}

// 3. Check if any message has conversation_id different from the actual session
const orphan = db.prepare("SELECT id, conversation_id FROM messages WHERE conversation_id NOT IN (SELECT id FROM conversations)").all();
if (orphan.length > 0) {
  console.log('\n=== Orphan messages (no matching conversation) ===');
  for (const o of orphan) console.log(`  msg=${o.id} conv=${o.conversation_id}`);
}

// 4. Check daily_stats
console.log('\n=== daily_stats ===');
const stats = db.prepare('SELECT * FROM token_daily_stats').all();
for (const s of stats) console.log(JSON.stringify(s));

db.close();
