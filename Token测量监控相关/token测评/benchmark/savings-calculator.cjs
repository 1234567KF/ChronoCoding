#!/usr/bin/env node
/**
 * Token 节省计算器 — 对比「无技能优化」vs「全技能优化」的成本差异
 *
 * 重要区分：
 *   - 服务器端缓存（prompt cache）：不受我们控制，无论用不用技能都存在
 *     → 基线 和 实际 都按缓存价算，不纳入优化节省
 *   - 我们的可控优化：模型路由、CLI压缩、CCP调度、Lambda通信
 *     → 这些才是技能带来的真实节省
 *
 * 用法:
 *   node savings-calculator.cjs                           # 最新 session
 *   node savings-calculator.cjs --session SESSION_ID       # 指定 session
 *   node savings-calculator.cjs --all                      # 所有 session 汇总
 *   node savings-calculator.cjs --json                     # JSON 输出
 */

const fs = require('fs');
const path = require('path');

// ── 定价 ──────────────────────────────────────────────
const PRICE = {
  'deepseek-v4-pro':   { input: 3, output: 6, cache_read: 0.025 },
  'deepseek-v4-flash': { input: 1, output: 2, cache_read: 0.02 },
  '_default':          { input: 3, output: 6, cache_read: 0.025 },
};

function getPrice(model) {
  return PRICE[model] || PRICE['_default'];
}

// ── 扫描 transcript 目录 ──────────────────────────────
function findTranscripts(sessionId) {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const projectDir = path.resolve(__dirname, '..', '..', '..');
  const projectName = path.basename(projectDir);
  const base = path.join(home, '.claude', 'projects', `D--${projectName}`);

  if (!fs.existsSync(base)) return [];

  let files = fs.readdirSync(base)
    .filter(f => f.endsWith('.jsonl'))
    .map(f => ({
      name: f.replace('.jsonl', ''),
      path: path.join(base, f),
      size: fs.statSync(path.join(base, f)).size,
    }));

  if (sessionId) {
    files = files.filter(f => f.name === sessionId);
  }

  return files.sort((a, b) => b.size - a.size);
}

// ── 解析 transcript ───────────────────────────────────
function parseTranscript(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(Boolean);

  const calls = [];
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      const msg = entry.message;
      if (!msg || !msg.usage) continue;

      const u = msg.usage;
      calls.push({
        model: msg.model || 'unknown',
        input_tokens: u.input_tokens || 0,
        output_tokens: u.output_tokens || 0,
        cache_read: u.cache_read_input_tokens || 0,
      });
    } catch {}
  }
  return calls;
}

// ── 读取 token-tracker traces ─────────────────────────
function parseTraces() {
  const tracePath = path.resolve(__dirname, '..', '..', '..', '.claude-flow', 'data', 'skill-traces.jsonl');
  if (!fs.existsSync(tracePath)) return [];

  const content = fs.readFileSync(tracePath, 'utf-8').trim();
  if (!content) return [];
  const entries = [];
  for (const line of content.split('\n').filter(Boolean)) {
    try { entries.push(JSON.parse(line)); } catch {}
  }
  return entries;
}

// ── 成本计算（精确，基于实际 token * 实际单价）─────────
function calcCallCost(call, priceOverride) {
  const p = priceOverride || getPrice(call.model);
  return {
    inputCost:  (call.input_tokens / 1_000_000) * p.input,
    cacheCost:  (call.cache_read / 1_000_000) * p.cache_read,
    outputCost: (call.output_tokens / 1_000_000) * p.output,
  };
}

// ── 核心：分解节省来源 ────────────────────────────────
// 关键设计：缓存是服务器行为，基线也享受缓存 → 不纳入优化节省
function decomposeSavings(calls) {
  const pPro = getPrice('deepseek-v4-pro');
  const pFlash = getPrice('deepseek-v4-flash');

  // ── 1. 实际成本（有技能优化）──
  // 用真实模型定价 + 真实缓存定价
  let actual = { input: 0, cache: 0, output: 0 };

  // ── 2. 基准成本（无技能优化）──
  // 缓存：同样享受（服务器行为）
  // 模型：全部按 Pro 价（无模型路由）
  // CLI：无压缩（下文单独估算）
  // CCP：全部 spawn（下文单独估算）
  // Lambda：无压缩（下文单独估算）
  let baseline = { input: 0, cache: 0, output: 0 };

  // 各项节省追踪
  let flashTokensIn = 0, flashTokensOut = 0;
  let flashActualCost = 0, flashBaselineCost = 0;

  for (const call of calls) {
    const p = getPrice(call.model);

    // 实际成本
    const ac = calcCallCost(call);
    actual.input += ac.inputCost;
    actual.cache += ac.cacheCost;
    actual.output += ac.outputCost;

    // 基准成本：缓存同价，输入/输出全按 Pro
    baseline.cache += ac.cacheCost;  // ← 缓存同样享受！
    baseline.input += (call.input_tokens / 1_000_000) * pPro.input;
    baseline.output += (call.output_tokens / 1_000_000) * pPro.output;

    // 模型路由节省：Flash 调用的实际价 vs Pro 价
    if (call.model === 'deepseek-v4-flash') {
      flashTokensIn += call.input_tokens;
      flashTokensOut += call.output_tokens;
      flashActualCost += (call.input_tokens / 1_000_000) * pFlash.input
                      + (call.output_tokens / 1_000_000) * pFlash.output;
      flashBaselineCost += (call.input_tokens / 1_000_000) * pPro.input
                        + (call.output_tokens / 1_000_000) * pPro.output;
    }
  }

  // ── 3. CLI 压缩估算（cli-benchmark.cjs 实测, 2026-05-08）──
  // benchmark 实测：git/ls 输出已紧凑→lean-ctx pass-through(0%节省)
  // 主要节省来自文件读取: cat CLAUDE.md 95.9%, cat settings.json 78.9%
  // 保守假设: 5% 未缓存输入来自文件读取, 压缩率 87%
  const totalUncachedIn = calls.reduce((s, c) => s + c.input_tokens, 0);
  const fileReadFraction = 0.05;    // 估算: 5% Bash调用是文件读取
  const fileCompressionRate = 0.87; // benchmark实测: 文件读取平均压缩率
  const cliTokensActual = Math.round(totalUncachedIn * fileReadFraction);
  const cliTokensBaseline = Math.round(cliTokensActual / (1 - fileCompressionRate));
  const cliTokensSaved = cliTokensBaseline - cliTokensActual;
  const cliCostSaved = (cliTokensSaved / 1_000_000) * pPro.input;

  // ── 4. CCP 跳过 spawn 估算 ──
  const traces = parseTraces();
  const ccpSkips = traces.filter(t => t.skill === 'claude-code-pro' && t.note && t.note.includes('skip'));
  const spawnTokensPerSkip = 15000;
  const ccpTokensSaved = ccpSkips.length * spawnTokensPerSkip;
  const ccpCostSaved = (ccpTokensSaved / 1_000_000) * pPro.input;

  // ── 5. Lambda 通信压缩估算 ──
  const lambdaTraces = traces.filter(t => t.skill === 'lambda-lang');
  const lambdaTokensSaved = lambdaTraces.length * 400;
  const lambdaCostSaved = (lambdaTokensSaved / 1_000_000) * pPro.output;

  // ── 汇总 ──
  const actualTotal = actual.input + actual.cache + actual.output;
  const baselineTotal = baseline.input + baseline.cache + baseline.output;

  // 模型路由精确节省
  const modelRouterSaving = flashBaselineCost - flashActualCost;

  // 精确节省（仅模型路由是精确的）
  const preciseSavings = modelRouterSaving;
  // 含估算的总节省
  const estimatedSavings = cliCostSaved + ccpCostSaved + lambdaCostSaved;
  const totalSavings = preciseSavings + estimatedSavings;

  return {
    actual: { ...actual, total: actualTotal },
    baseline: { ...baseline, total: baselineTotal },
    savings: {
      total: totalSavings,
      totalPct: baselineTotal > 0 ? (totalSavings / baselineTotal * 100) : 0,
      precise: preciseSavings,
      precisePct: baselineTotal > 0 ? (preciseSavings / baselineTotal * 100) : 0,
    },
    breakdown: {
      modelRouter: {
        description: '模型路由 — Flash调用的token按Flash价 vs 如果全部用Pro价',
        tokensIn: flashTokensIn,
        tokensOut: flashTokensOut,
        actualCost: flashActualCost,
        baselineCost: flashBaselineCost,
        saving: modelRouterSaving,
      },
      cliCompression: {
        description: 'CLI输出压缩 (lean-ctx) — benchmark实测: 文件读取省87%, git/ls已紧凑→0%',
        tokensSaved: cliTokensSaved,
        costSaved: cliCostSaved,
      },
      ccp: {
        description: '智能调度 (CCP) — 跳过不必要的 Agent spawn（每次约 15K token）',
        skipCount: ccpSkips.length,
        tokensSaved: ccpTokensSaved,
        costSaved: ccpCostSaved,
      },
      lambda: {
        description: 'Agent通信压缩 (Lambda) — 自然语言 vs Lambda原子协议',
        callCount: lambdaTraces.length,
        tokensSaved: lambdaTokensSaved,
        costSaved: lambdaCostSaved,
      },
    },
    cacheInfo: {
      totalCacheTokens: calls.reduce((s, c) => s + c.cache_read, 0),
      totalCacheCost: actual.cache,
      note: '缓存是DeepSeek服务器行为，不受我们控制。基线和实际都按缓存价计算。',
    },
  };
}

// ── 生成报告 ──────────────────────────────────────────
function generateReport(result, sessionName) {
  const d = result.decomposition;
  const lines = [];

  lines.push('╔══════════════════════════════════════════════════╗');
  lines.push('║   Token 节省计算 — 无技能优化 vs 全技能优化     ║');
  lines.push('╠══════════════════════════════════════════════════╣');
  lines.push(`║  Session: ${sessionName.padEnd(30).slice(0, 30)}         ║`);
  lines.push(`║  API调用: ${String(result.totalCalls).padEnd(30)}         ║`);
  lines.push('╚══════════════════════════════════════════════════╝');
  lines.push('');
  lines.push('> ⚠️ 缓存是DeepSeek服务器行为，不受我们控制。');
  lines.push('> 基线（无技能）同样享受缓存 → 缓存不纳入优化节省。');
  lines.push('');

  // 总览
  lines.push('## 总览');
  lines.push('');
  lines.push('| 场景 | 输入成本 | 缓存成本 | 输出成本 | 总成本 |');
  lines.push('|------|---------|---------|---------|-------|');
  lines.push(`| **有技能优化** | ¥${d.actual.input.toFixed(4)} | ¥${d.actual.cache.toFixed(4)} | ¥${d.actual.output.toFixed(4)} | **¥${d.actual.total.toFixed(4)}** |`);
  lines.push(`| **无技能优化** | ¥${d.baseline.input.toFixed(4)} | ¥${d.baseline.cache.toFixed(4)} | ¥${d.baseline.output.toFixed(4)} | **¥${d.baseline.total.toFixed(4)}** |`);
  lines.push(`| **节省** | | | | **¥${d.savings.total.toFixed(4)} (${d.savings.totalPct.toFixed(1)}%)** |`);
  lines.push('');

  // Token 量
  const totalIn = result.calls.reduce((s, c) => s + c.input_tokens + c.cache_read, 0);
  const totalOut = result.calls.reduce((s, c) => s + c.output_tokens, 0);
  const totalCache = result.calls.reduce((s, c) => s + c.cache_read, 0);
  const totalUncached = result.calls.reduce((s, c) => s + c.input_tokens, 0);
  lines.push('## Token 量');
  lines.push('');
  lines.push('| 指标 | 值 |');
  lines.push('|------|----|');
  lines.push(`| 总输入 token (含缓存) | ${totalIn.toLocaleString()} |`);
  lines.push(`| ├─ 未缓存 (新输入) | ${totalUncached.toLocaleString()} |`);
  lines.push(`| └─ 缓存命中 (服务器) | ${totalCache.toLocaleString()} (${totalIn > 0 ? (totalCache / totalIn * 100).toFixed(1) : 0}%) |`);
  lines.push(`| 总输出 token | ${totalOut.toLocaleString()} |`);
  lines.push(`| 缓存命中成本 | ¥${d.cacheInfo.totalCacheCost.toFixed(4)} (服务器折扣，非我们控制) |`);
  lines.push('');

  // 模型分布
  const modelCounts = {};
  for (const call of result.calls) {
    const m = call.model || 'unknown';
    modelCounts[m] = (modelCounts[m] || 0) + 1;
  }
  lines.push('## 模型使用分布');
  lines.push('');
  lines.push('| 模型 | 调用次数 | 单价 (输入/输出) |');
  lines.push('|------|---------|-----------------|');
  for (const [m, c] of Object.entries(modelCounts)) {
    const p = getPrice(m);
    lines.push(`| ${m} | ${c} | ¥${p.input}/${p.output} /MTok |`);
  }
  lines.push('');

  // ── 节省来源分解 ──
  lines.push('## 💰 技能优化节省来源（均为我们的可控优化）');
  lines.push('');

  // 1. 模型路由（精确）
  const mr = d.breakdown.modelRouter;
  lines.push('### 1. 模型路由 🚀 (✅ 精确)');
  lines.push('');
  lines.push(`> ${mr.description}`);
  lines.push('');
  lines.push('| 指标 | 值 |');
  lines.push('|------|----|');
  lines.push(`| Flash 输入 token | ${mr.tokensIn.toLocaleString()} |`);
  lines.push(`| Flash 输出 token | ${mr.tokensOut.toLocaleString()} |`);
  lines.push(`| 按 Flash 价 | ¥${mr.actualCost.toFixed(4)} |`);
  lines.push(`| 如果全用 Pro 价 | ¥${mr.baselineCost.toFixed(4)} |`);
  lines.push(`| **此项节省** | **¥${mr.saving.toFixed(4)}** |`);
  lines.push('');

  // 2. CLI 压缩（估算）
  const cli = d.breakdown.cliCompression;
  lines.push('### 2. CLI 输出压缩 📦 (⚠️ 估算)');
  lines.push('');
  lines.push(`> ${cli.description}`);
  lines.push('');
  lines.push('| 指标 | 值 |');
  lines.push('|------|----|');
  lines.push(`| 估算节省 token | ${cli.tokensSaved.toLocaleString()} |`);
  lines.push(`| **此项估算节省** | **¥${cli.costSaved.toFixed(4)}** |`);
  lines.push('');

  // 3. CCP（估算）
  const ccp = d.breakdown.ccp;
  lines.push('### 3. 智能调度 ⚡ (⚠️ 估算)');
  lines.push('');
  lines.push(`> ${ccp.description}`);
  lines.push('');
  lines.push('| 指标 | 值 |');
  lines.push('|------|----|');
  lines.push(`| 跳过 spawn 次数 | ${ccp.skipCount} |`);
  lines.push(`| 估算节省 token | ${ccp.tokensSaved.toLocaleString()} |`);
  lines.push(`| **此项估算节省** | **¥${ccp.costSaved.toFixed(4)}** |`);
  lines.push('');

  // 4. Lambda（估算）
  const lam = d.breakdown.lambda;
  lines.push('### 4. Agent通信压缩 🔗 (⚠️ 估算)');
  lines.push('');
  lines.push(`> ${lam.description}`);
  lines.push('');
  lines.push('| 指标 | 值 |');
  lines.push('|------|----|');
  lines.push(`| Lambda 通信次数 | ${lam.callCount} |`);
  lines.push(`| 估算节省 token | ${lam.tokensSaved.toLocaleString()} |`);
  lines.push(`| **此项估算节省** | **¥${lam.costSaved.toFixed(4)}** |`);
  lines.push('');

  // ── 汇总 ──
  const preciseTotal = mr.saving;
  const estimatedTotal = cli.costSaved + ccp.costSaved + lam.costSaved;

  lines.push('## 节省汇总');
  lines.push('');
  lines.push('| 来源 | 节省金额 | 占比 | 类型 |');
  lines.push('|------|---------|------|------|');
  lines.push(`| 模型路由 (Flash vs Pro) | ¥${mr.saving.toFixed(4)} | ${d.savings.total > 0 ? (mr.saving / d.savings.total * 100).toFixed(1) : 0}% | ✅ 精确 |`);
  lines.push(`| CLI压缩 (lean-ctx) | ¥${cli.costSaved.toFixed(4)} | ${d.savings.total > 0 ? (cli.costSaved / d.savings.total * 100).toFixed(1) : 0}% | ⚠️ 估算 |`);
  lines.push(`| CCP调度 (跳过spawn) | ¥${ccp.costSaved.toFixed(4)} | ${d.savings.total > 0 ? (ccp.costSaved / d.savings.total * 100).toFixed(1) : 0}% | ⚠️ 估算 |`);
  lines.push(`| Lambda通信压缩 | ¥${lam.costSaved.toFixed(4)} | ${d.savings.total > 0 ? (lam.costSaved / d.savings.total * 100).toFixed(1) : 0}% | ⚠️ 估算 |`);
  lines.push(`| **精确合计** | **¥${preciseTotal.toFixed(4)}** | | ✅ |`);
  lines.push(`| **含估算合计** | **¥${(preciseTotal + estimatedTotal).toFixed(4)}** | | |`);
  lines.push('');
  lines.push('> ✅ 精确 = 从 transcript 直接计算，数据可靠');
  lines.push('> ⚠️ 估算 = 基于 benchmark 数据和合理假设，数量级正确但非逐笔精确');

  return lines.join('\n');
}

// ── 主流程 ────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const sessionIdx = args.indexOf('--session');
  const sessionId = sessionIdx >= 0 ? args[sessionIdx + 1] : null;
  const allSessions = args.includes('--all');
  const jsonOutput = args.includes('--json');

  const transcripts = findTranscripts(sessionId);
  if (transcripts.length === 0) {
    console.log('未找到 transcript 文件');
    process.exit(1);
  }

  const targets = allSessions ? transcripts : [transcripts[0]];

  const allResults = [];

  for (const t of targets) {
    const calls = parseTranscript(t.path);
    if (calls.length === 0) {
      console.log(`跳过 ${t.name}: 无 API 调用数据`);
      continue;
    }

    const decomposition = decomposeSavings(calls);
    const result = {
      sessionId: t.name,
      totalCalls: calls.length,
      calls,
      decomposition,
    };
    allResults.push(result);

    if (!jsonOutput) {
      console.log(generateReport(result, t.name));
    }
  }

  // 跨 session 汇总
  if (allResults.length > 1) {
    const totalActual = allResults.reduce((s, r) => s + r.decomposition.actual.total, 0);
    const totalBaseline = allResults.reduce((s, r) => s + r.decomposition.baseline.total, 0);
    const totalCalls = allResults.reduce((s, r) => s + r.totalCalls, 0);
    const totalTokens = allResults.reduce((s, r) =>
      s + r.calls.reduce((cs, c) => cs + c.input_tokens + c.cache_read + c.output_tokens, 0), 0);

    console.log('═'.repeat(60));
    console.log(`所有 ${allResults.length} 个 session 汇总:`);
    console.log(`  总调用: ${totalCalls} | 总 token: ${totalTokens.toLocaleString()}`);
    console.log(`  有技能优化: ¥${totalActual.toFixed(4)}`);
    console.log(`  无技能优化: ¥${totalBaseline.toFixed(4)}`);
    console.log(`  技能节省:   ¥${(totalBaseline - totalActual).toFixed(4)} (${((totalBaseline - totalActual) / totalBaseline * 100).toFixed(1)}%)`);
  }

  if (jsonOutput) {
    const outputPath = path.resolve(__dirname, '..', '数据', 'savings-report.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    const jsonReport = allResults.map(r => ({
      sessionId: r.sessionId,
      totalCalls: r.totalCalls,
      actualCost: r.decomposition.actual,
      baselineCost: r.decomposition.baseline,
      savings: r.decomposition.savings,
      cacheInfo: r.decomposition.cacheInfo,
      breakdown: {
        modelRouter: {
          tokensIn: r.decomposition.breakdown.modelRouter.tokensIn,
          tokensOut: r.decomposition.breakdown.modelRouter.tokensOut,
          saving: r.decomposition.breakdown.modelRouter.saving,
        },
        cliCompression: {
          estimatedTokens: r.decomposition.breakdown.cliCompression.tokensSaved,
          estimatedSaving: r.decomposition.breakdown.cliCompression.costSaved,
        },
        ccp: {
          skipCount: r.decomposition.breakdown.ccp.skipCount,
          estimatedTokens: r.decomposition.breakdown.ccp.tokensSaved,
          estimatedSaving: r.decomposition.breakdown.ccp.costSaved,
        },
        lambda: {
          callCount: r.decomposition.breakdown.lambda.callCount,
          estimatedTokens: r.decomposition.breakdown.lambda.tokensSaved,
          estimatedSaving: r.decomposition.breakdown.lambda.costSaved,
        },
      },
    }));
    fs.writeFileSync(outputPath, JSON.stringify(jsonReport, null, 2), 'utf-8');
    console.log(`\n✅ JSON 报告: ${outputPath}`);
  }
}

main().catch(console.error);
