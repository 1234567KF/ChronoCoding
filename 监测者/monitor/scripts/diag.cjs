#!/usr/bin/env node
const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '..', 'data', 'monitor.db'));
db.pragma('journal_mode = WAL');

console.log('=== messages ===');
const msgs = db.prepare('SELECT id, role, input_tokens, output_tokens, cache_hit, input_cost, output_cost, cache_cost, model, created_at, substr(content,1,100) as c FROM messages ORDER BY id').all();
console.log('Count:', msgs.length);
for (const m of msgs) {
  const totalIn = (m.input_tokens||0) + (m.cache_hit||0);
  const totalCost = (m.input_cost||0) + (m.output_cost||0) + (m.cache_cost||0);
  console.log(`  [${m.role}] in=${m.input_tokens} out=${m.output_tokens} cache=${m.cache_hit} (total_in=${totalIn}) cost=${totalCost.toFixed(6)} model=${m.model}`);
  console.log(`    ts=${m.created_at} content=${m.c}`);
}

console.log('\n=== conversations ===');
const convs = db.prepare('SELECT * FROM conversations').all();
for (const c of convs) {
  console.log(c.id, '|', c.title, '| in=', c.total_input_tokens, 'out=', c.total_output_tokens, 'cost=', c.total_cost, 'baseline=', c.total_baseline_cost);
}

console.log('\n=== daily_stats ===');
const stats = db.prepare('SELECT * FROM token_daily_stats ORDER BY date').all();
for (const s of stats) {
  console.log(s.date, 'in=', s.total_input, 'out=', s.total_output, 'cost=', s.total_cost);
}

db.close();
