#!/usr/bin/env node
const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '..', 'data', 'monitor.db'));

const msgs = db.prepare('SELECT id, role, input_tokens, output_tokens, cache_hit, input_cost, output_cost, cache_cost, baseline_cost, model, created_at FROM messages WHERE conversation_id = ?').all('ad08b099-f849-40ef-a03a-c68bc46a9939');
console.log('Messages:', msgs.length);
for (const m of msgs) {
  console.log(`  id=${m.id} role=${m.role} in=${m.input_tokens} out=${m.output_tokens} cache=${m.cache_hit} ic=${m.input_cost} oc=${m.output_cost} cc=${m.cache_cost} bc=${m.baseline_cost} model=${m.model}`);
}

const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get('ad08b099-f849-40ef-a03a-c68bc46a9939');
console.log('\nConversation:', JSON.stringify(conv, null, 2));

const sum = db.prepare('SELECT SUM(input_tokens) as sit, SUM(output_tokens) as sot, SUM(cache_hit) as sch, SUM(input_cost) as sic, SUM(output_cost) as soc, SUM(cache_cost) as scc, SUM(baseline_cost) as sbc, COUNT(*) as cnt FROM messages WHERE conversation_id = ?').get('ad08b099-f849-40ef-a03a-c68bc46a9939');
console.log('\nManual SUM:', JSON.stringify(sum, null, 2));
console.log('SUM(in+cache):', (sum.sit || 0) + (sum.sch || 0));

db.close();
