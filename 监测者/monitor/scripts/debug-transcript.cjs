#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const HOME = process.env.USERPROFILE || process.env.HOME || '';
const transcriptPath = path.join(HOME, '.claude', 'projects', 'D--AICoding', 'ad08b099-f849-40ef-a03a-c68bc46a9939.jsonl');
const lines = fs.readFileSync(transcriptPath, 'utf-8').split('\n').filter(Boolean);
console.log('Total lines:', lines.length);

// Show lines 3046-3056 (0-indexed: 3045-3056)
for (let i = 3045; i < Math.min(3057, lines.length); i++) {
  try {
    const entry = JSON.parse(lines[i]);
    const role = entry.message?.role;
    const usage = entry.message?.usage;
    const content = entry.message?.content;
    let preview = '';
    if (typeof content === 'string') preview = content.slice(0, 80);
    else if (Array.isArray(content)) preview = content.filter(x => x.type === 'text').map(x => (x.text || '').slice(0, 80)).join(' | ');

    console.log(`\n[Line ${i+1}] type=${entry.type} role=${role || 'N/A'}`);
    if (usage) {
      console.log(`  usage: in=${usage.input_tokens} out=${usage.output_tokens} cache_read=${usage.cache_read_input_tokens} cache_create=${usage.cache_creation_input_tokens}`);
    }
    console.log(`  preview: ${preview}`);
  } catch (e) {
    console.log(`[Line ${i+1}] PARSE ERROR: ${e.message}`);
  }
}
