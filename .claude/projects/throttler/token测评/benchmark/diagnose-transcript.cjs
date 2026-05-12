#!/usr/bin/env node
/**
 * 诊断脚本 — 检查 transcript 格式，定位数据不匹配原因
 *
 * 用法:
 *   node diagnose-transcript.cjs
 *   node diagnose-transcript.cjs --session SESSION_ID
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const HOME = process.env.USERPROFILE || process.env.HOME || '';

// 找到最新的 transcript 文件
function findTranscripts() {
  const projectName = path.basename(PROJECT_ROOT);
  const base = path.join(HOME, '.claude', 'projects', `D--${projectName}`);
  if (!fs.existsSync(base)) {
    console.log('❌ Transcript 目录不存在:', base);
    return [];
  }
  const files = fs.readdirSync(base)
    .filter(f => f.endsWith('.jsonl'))
    .map(f => ({ name: f, path: path.join(base, f), size: fs.statSync(path.join(base, f)).size }))
    .sort((a, b) => b.size - a.size);
  return files;
}

function analyzeFile(filePath) {
  console.log(`\n📄 分析: ${path.basename(filePath)} (${(fs.statSync(filePath).size / 1024).toFixed(0)} KB)`);

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(Boolean);

  console.log(`   总行数: ${lines.length}`);

  const findings = {
    messagesWithUsage: 0,
    messagesWithoutUsage: 0,
    messagesWithModel: 0,
    uniqueModels: new Set(),
    usageFields: new Set(),
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheRead: 0,
    totalCacheCreation: 0,
    altFieldCounts: {}, // track alternative field names
    sampleUsage: [],
  };

  // Track alternative field name patterns
  const altFields = {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
    prompt_cache_hit_tokens: 0,
    prompt_cache_miss_tokens: 0,
    cache_creation_input_tokens: 0,
  };

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      const msg = entry.message;
      if (!msg) continue;

      // Model
      if (msg.model) {
        findings.messagesWithModel++;
        findings.uniqueModels.add(msg.model);
      }

      // Usage — check BOTH Anthropic and DeepSeek field names
      const u = msg.usage;
      if (u) {
        findings.messagesWithUsage++;

        // Record all field names present
        for (const key of Object.keys(u)) {
          findings.usageFields.add(key);
        }

        // Try Anthropic format
        const inputTok = u.input_tokens || 0;
        const outputTok = u.output_tokens || 0;
        const cacheRead = u.cache_read_input_tokens || 0;
        const cacheCreation = u.cache_creation_input_tokens || 0;

        // Try DeepSeek format (alternative field names)
        const promptTok = u.prompt_tokens || 0;
        const completionTok = u.completion_tokens || 0;
        const dsCacheHit = u.prompt_cache_hit_tokens || 0;
        const dsCacheMiss = u.prompt_cache_miss_tokens || 0;

        if (promptTok > 0) altFields.prompt_tokens++;
        if (completionTok > 0) altFields.completion_tokens++;
        if (u.total_tokens) altFields.total_tokens++;
        if (dsCacheHit > 0) altFields.prompt_cache_hit_tokens++;
        if (dsCacheMiss > 0) altFields.prompt_cache_miss_tokens++;
        if (cacheCreation > 0) altFields.cache_creation_input_tokens++;

        // Use whichever format has data
        const effectiveInput = inputTok || promptTok;
        const effectiveOutput = outputTok || completionTok;
        const effectiveCache = cacheRead || dsCacheHit;

        findings.totalInputTokens += effectiveInput;
        findings.totalOutputTokens += effectiveOutput;
        findings.totalCacheRead += effectiveCache;

        // Save samples (first 5)
        if (findings.sampleUsage.length < 5) {
          findings.sampleUsage.push({
            model: msg.model || '?',
            raw: u,
            effective: { input: effectiveInput, output: effectiveOutput, cache: effectiveCache },
          });
        }
      } else {
        findings.messagesWithoutUsage++;
      }
    } catch {}
  }

  // Report
  console.log(`   含 usage 的消息: ${findings.messagesWithUsage}`);
  console.log(`   无 usage 的消息: ${findings.messagesWithoutUsage}`);
  console.log(`   含 model 的消息: ${findings.messagesWithModel}`);
  console.log(`   模型列表: ${[...findings.uniqueModels].join(', ') || '(无)'}`);
  console.log(`   usage 字段名: ${[...findings.usageFields].join(', ') || '(无)'}`);

  console.log(`\n   累计 Token (Anthropic格式):`);
  console.log(`     input_tokens:  ${findings.totalInputTokens.toLocaleString()}`);
  console.log(`     output_tokens: ${findings.totalOutputTokens.toLocaleString()}`);
  console.log(`     cache_read:    ${findings.totalCacheRead.toLocaleString()}`);

  // Check if DeepSeek format detected
  const dsDetected = altFields.prompt_tokens > 0 || altFields.completion_tokens > 0;
  if (dsDetected) {
    console.log(`\n   ⚠️ 检测到 DeepSeek 格式字段:`);
    console.log(`     prompt_tokens 出现次数: ${altFields.prompt_tokens}`);
    console.log(`     completion_tokens 出现次数: ${altFields.completion_tokens}`);
    console.log(`     prompt_cache_hit_tokens 出现次数: ${altFields.prompt_cache_hit_tokens}`);
    console.log(`     prompt_cache_miss_tokens 出现次数: ${altFields.prompt_cache_miss_tokens}`);
  }

  const hasCacheCreation = altFields.cache_creation_input_tokens > 0;
  if (hasCacheCreation) {
    console.log(`     cache_creation_input_tokens 出现次数: ${altFields.cache_creation_input_tokens}`);
  }

  if (findings.totalCacheRead === 0 && dsDetected) {
    console.log(`\n   🔴 可能 BUG: 当前代码只读 cache_read_input_tokens，`);
    console.log(`      但 transcript 使用的是 prompt_cache_hit_tokens！`);
    console.log(`      导致缓存命中全被当作未命中。`);
  }

  // Sample
  console.log(`\n   样本 usage (前5条):`);
  for (const s of findings.sampleUsage) {
    console.log(`     model=${s.model} effective={in:${s.effective.input}, out:${s.effective.output}, cache:${s.effective.cache}}`);
    console.log(`     raw: ${JSON.stringify(s.raw)}`);
  }

  // Summary
  const totalEffective = findings.totalInputTokens + findings.totalOutputTokens;
  console.log(`\n   📊 有效总 Token: ${totalEffective.toLocaleString()} (输入 ${findings.totalInputTokens.toLocaleString()} + 输出 ${findings.totalOutputTokens.toLocaleString()})`);
  if (findings.totalCacheRead > 0) {
    console.log(`   💾 缓存命中: ${findings.totalCacheRead.toLocaleString()} (${(findings.totalCacheRead / (findings.totalInputTokens + findings.totalCacheRead) * 100).toFixed(1)}%)`);
  }

  return findings;
}

// Main
console.log('🔍 Token 监控数据诊断\n');
console.log('═'.repeat(60));

const transcripts = findTranscripts();
if (transcripts.length === 0) {
  console.log('\n未找到 transcript 文件。请指定 session ID:');
  console.log('  node diagnose-transcript.cjs --session YOUR_SESSION_ID');
  process.exit(0);
}

console.log(`\n找到 ${transcripts.length} 个 transcript 文件:`);
for (const t of transcripts.slice(0, 10)) {
  console.log(`  ${t.name} (${(t.size / 1024).toFixed(0)} KB)`);
}

// 分析最大的几个（最近活跃的）
const toAnalyze = transcripts.slice(0, 3);
for (const t of toAnalyze) {
  console.log('\n' + '═'.repeat(60));
  analyzeFile(t.path);
}

console.log('\n' + '═'.repeat(60));
console.log('诊断完成。如果上面显示 prompt_tokens/completion_tokens 有数据，');
console.log('说明 DeepSeek API 返回的字段名与 Anthropic 不同，需要修复 token-accum.cjs。');
