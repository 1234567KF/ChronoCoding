#!/usr/bin/env node
/**
 * Token 效率评测 — 聚合报告生成器
 *
 * 读取 cli-benchmark JSON 数据 + kf-token-tracker trace 日志，
 * 计算统计指标，生成 Markdown 综合报告 + 可视化用 JSON。
 *
 * 用法:
 *   node aggregate-report.cjs                          # 读取所有数据，生成报告
 *   node aggregate-report.cjs --days 7                 # 仅最近 7 天
 *   node aggregate-report.cjs --format json            # 仅输出 JSON（给 visualize 用）
 *   node aggregate-report.cjs --format md              # 仅输出 Markdown
 */

const fs = require('fs');
const path = require('path');

// ── 配置 ──────────────────────────────────────────────
const DATA_DIR = path.resolve(__dirname, '..', '数据');
const REPORT_DIR = path.resolve(__dirname, '..', '05-测评报告');
const AGG_PATH = path.join(DATA_DIR, 'aggregate.json');
const TRACE_LOG = path.resolve(__dirname, '..', '..', '..', '.claude-flow', 'data', 'skill-traces.jsonl');

const args = process.argv.slice(2);
const DAYS = parseInt(args[args.indexOf('--days') + 1]) || 30;
const FORMAT = args[args.indexOf('--format') + 1] || 'both'; // json | md | both

// ── 工具函数 ──────────────────────────────────────────
function mean(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length; }
function std(arr, avg) {
  avg = avg || mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - avg) ** 2, 0) / arr.length);
}
function cv(arr, avg) {
  avg = avg || mean(arr);
  return avg !== 0 ? (std(arr, avg) / Math.abs(avg)) * 100 : 0;
}
function median(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

// ── 数据加载 ──────────────────────────────────────────

/** 加载 cli-benchmark 聚合数据 */
function loadBenchmarkData() {
  const data = {};
  try {
    const aggregate = JSON.parse(fs.readFileSync(AGG_PATH, 'utf-8'));
    const cutoff = Date.now() - DAYS * 86400000;

    for (const [date, entry] of Object.entries(aggregate)) {
      if (new Date(date).getTime() >= cutoff) {
        data[date] = entry;
      }
    }
  } catch (_) { /* 无数据 */ }
  return data;
}

/** 加载 kf-token-tracker traces */
function loadTokenTraces() {
  const traces = [];
  try {
    const content = fs.readFileSync(TRACE_LOG, 'utf-8');
    for (const line of content.split('\n')) {
      if (line.trim()) {
        try { traces.push(JSON.parse(line)); } catch (_) { /* skip */ }
      }
    }
  } catch (_) { /* 无数据 */ }
  return traces;
}

/** 从 monitor SQLite 加载统计（如果可用） */
function loadMonitorStats() {
  try {
    const Database = require('better-sqlite3');
    const dbPath = path.resolve(__dirname, '..', '..', 'monitor', 'data', 'token-monitor.db');
    if (!fs.existsSync(dbPath)) return null;

    const db = new Database(dbPath, { readonly: true });
    const stats = {
      daily: db.prepare(`
        SELECT date, total_input, total_output, cache_hit_input, total_cost
        FROM token_daily_stats
        WHERE date >= date('now', '-' || ? || ' days')
        ORDER BY date DESC
      `).all(DAYS),
      skillUsage: db.prepare(`
        SELECT skill_name, COUNT(*) as call_count,
               SUM(input_tokens) as total_input, SUM(output_tokens) as total_output
        FROM skill_calls
        GROUP BY skill_name
        ORDER BY call_count DESC
      `).all(),
    };
    db.close();
    return stats;
  } catch (_) { return null; }
}

// ── 分析函数 ──────────────────────────────────────────

function analyzeLeanCtx(benchData) {
  const dates = Object.keys(benchData).sort();
  if (dates.length === 0) return { status: 'no_data', message: '无 cli-benchmark 数据' };

  const latest = benchData[dates[dates.length - 1]];
  const allRates = Object.values(benchData).map(d => d.overallSavingsRate);

  return {
    status: 'ok',
    latestDate: dates[dates.length - 1],
    totalRuns: dates.length,
    latestSavingsRate: latest.overallSavingsRate,
    meanSavingsRate: mean(allRates),
    medianSavingsRate: median(allRates),
    stdSavingsRate: std(allRates),
    cvPercent: cv(allRates),
    bestSavingsRate: Math.max(...allRates),
    worstSavingsRate: Math.min(...allRates),
    byCategory: latest.byCategory || {},
    trend: allRates.length >= 2 ? (allRates[allRates.length - 1] - allRates[0]) : 0,
  };
}

function analyzeTokenCosts(monitorStats) {
  if (!monitorStats || !monitorStats.daily || monitorStats.daily.length === 0) {
    return { status: 'no_data', message: '无 monitor 数据' };
  }

  const daily = monitorStats.daily;
  const totalInput = daily.reduce((s, d) => s + d.total_input, 0);
  const totalOutput = daily.reduce((s, d) => s + d.total_output, 0);
  const totalCache = daily.reduce((s, d) => s + (d.cache_hit_input || 0), 0);
  const totalCost = daily.reduce((s, d) => s + d.total_cost, 0);

  return {
    status: 'ok',
    days: daily.length,
    totalInputTokens: totalInput,
    totalOutputTokens: totalOutput,
    totalCacheHitTokens: totalCache,
    totalCostCny: totalCost,
    avgDailyInput: totalInput / daily.length,
    avgDailyOutput: totalOutput / daily.length,
    avgDailyCost: totalCost / daily.length,
    cacheHitRate: totalInput > 0 ? (totalCache / totalInput * 100) : 0,
    inputOutputRatio: totalOutput > 0 ? (totalInput / totalOutput) : 0,
  };
}

function analyzeSkillCoverage(traces) {
  if (traces.length === 0) return { status: 'no_data' };

  const skillMap = {};
  for (const t of traces) {
    const name = t.skill || t.agent || 'unknown';
    if (!skillMap[name]) skillMap[name] = { count: 0, tokensIn: 0, tokensOut: 0 };
    skillMap[name].count++;
    skillMap[name].tokensIn += t.tokens_in || 0;
    skillMap[name].tokensOut += t.tokens_out || 0;
  }

  return {
    status: 'ok',
    totalTraces: traces.length,
    uniqueSkills: Object.keys(skillMap).length,
    topSkills: Object.entries(skillMap)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([name, s]) => ({ name, ...s })),
  };
}

// ── 综合评分计算 ──────────────────────────────────────

function computeComprehensiveScore(benchResult, costResult) {
  // 评分维度 (与评测体系 v1.0 对齐)
  // Token节省率 40% | 质量等价性 30% | 稳定性 20% | 易用性 10%

  const savingsScore = benchResult.status === 'ok'
    ? Math.min(100, benchResult.meanSavingsRate) * 0.40
    : 20 * 0.40;

  // 质量等价性 — 基于稳定性（CV低则质量稳定）
  const qualityScore = benchResult.status === 'ok'
    ? Math.max(0, 100 - benchResult.cvPercent) * 0.30
    : 15 * 0.30;

  // 稳定性 — 基于方差
  const stabilityScore = benchResult.status === 'ok'
    ? Math.max(0, 100 - benchResult.stdSavingsRate) * 0.20
    : 10 * 0.20;

  // 易用性 — 基于数据覆盖度（有数据↔无数据）
  const usabilityScore = benchResult.status === 'ok'
    ? Math.min(benchResult.totalRuns, 10) / 10 * 100 * 0.10
    : 5 * 0.10;

  return {
    total: Math.round(savingsScore + qualityScore + stabilityScore + usabilityScore),
    breakdown: {
      savings: Math.round(savingsScore),
      quality: Math.round(qualityScore),
      stability: Math.round(stabilityScore),
      usability: Math.round(usabilityScore),
    },
    grade: (() => {
      const t = savingsScore + qualityScore + stabilityScore + usabilityScore;
      if (t >= 90) return 'A+';
      if (t >= 80) return 'A';
      if (t >= 70) return 'B+';
      if (t >= 60) return 'B';
      if (t >= 40) return 'C';
      return 'D';
    })(),
  };
}

// ── 主流程 ────────────────────────────────────────────

console.log('🔍 加载数据源...');
const benchData = loadBenchmarkData();
const traces = loadTokenTraces();
const monitorStats = loadMonitorStats();

console.log('📊 分析中...');
const leanCtxAnalysis = analyzeLeanCtx(benchData);
const costAnalysis = analyzeTokenCosts(monitorStats);
const skillAnalysis = analyzeSkillCoverage(traces);
const score = computeComprehensiveScore(leanCtxAnalysis, costAnalysis);

// ── 构建结果 JSON ─────────────────────────────────────

const result = {
  meta: {
    generatedAt: new Date().toISOString(),
    days: DAYS,
    dataSources: {
      cliBenchmark: benchData ? Object.keys(benchData).length : 0,
      tokenTraces: traces.length,
      monitorDb: !!monitorStats,
    },
  },
  leanCtx: leanCtxAnalysis,
  tokenCosts: costAnalysis,
  skillCoverage: skillAnalysis,
  comprehensiveScore: score,
};

// ── 输出 ──────────────────────────────────────────────

if (FORMAT === 'json' || FORMAT === 'both') {
  const jsonPath = path.join(DATA_DIR, 'comprehensive-report.json');
  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`✅ JSON 报告: ${jsonPath}`);
}

if (FORMAT === 'md' || FORMAT === 'both') {
  const md = generateMarkdown(result);
  const mdPath = path.join(REPORT_DIR, `benchmark_${new Date().toISOString().slice(0, 10)}.md`);
  fs.mkdirSync(path.dirname(mdPath), { recursive: true });
  fs.writeFileSync(mdPath, md, 'utf-8');
  console.log(`✅ Markdown 报告: ${mdPath}`);

  // 同时写入综合报告路径
  const mainReport = path.join(REPORT_DIR, '综合报告_最新.md');
  fs.writeFileSync(mainReport, md, 'utf-8');
  console.log(`✅ 综合报告: ${mainReport}`);
}

// ── Markdown 生成 ─────────────────────────────────────

function generateMarkdown(r) {
  const lines = [];

  lines.push('# Token 效率评测 — 综合报告');
  lines.push('');
  lines.push(`> 生成时间: ${r.meta.generatedAt}`);
  lines.push(`> 数据周期: 最近 ${r.meta.days} 天`);
  lines.push('');

  // 综合评分
  lines.push('## 一、综合评分');
  lines.push('');
  lines.push('| 维度 | 得分 | 权重 |');
  lines.push('|------|------|------|');
  lines.push(`| Token 节省率 | ${r.comprehensiveScore.breakdown.savings} | 40% |`);
  lines.push(`| 质量等价性 | ${r.comprehensiveScore.breakdown.quality} | 30% |`);
  lines.push(`| 稳定性 | ${r.comprehensiveScore.breakdown.stability} | 20% |`);
  lines.push(`| 易用性 | ${r.comprehensiveScore.breakdown.usability} | 10% |`);
  lines.push(`| **总评** | **${r.comprehensiveScore.total}/100** | **等级: ${r.comprehensiveScore.grade}** |`);
  lines.push('');

  // CLI 压缩
  lines.push('## 二、CLI 输出压缩（lean-ctx）');
  lines.push('');
  if (r.leanCtx.status === 'ok') {
    lines.push('| 指标 | 值 |');
    lines.push('|------|----|');
    lines.push(`| 最新日期 | ${r.leanCtx.latestDate} |`);
    lines.push(`| 测试次数 | ${r.leanCtx.totalRuns} |`);
    lines.push(`| 最新节省率 | **${r.leanCtx.latestSavingsRate.toFixed(1)}%** |`);
    lines.push(`| 平均节省率 | **${r.leanCtx.meanSavingsRate.toFixed(1)}%** |`);
    lines.push(`| 中位数节省率 | ${r.leanCtx.medianSavingsRate.toFixed(1)}% |`);
    lines.push(`| 标准差 | ${r.leanCtx.stdSavingsRate.toFixed(1)}% |`);
    lines.push(`| 变异系数 | ${r.leanCtx.cvPercent.toFixed(1)}% |`);
    lines.push(`| 最佳 | ${r.leanCtx.bestSavingsRate.toFixed(1)}% |`);
    lines.push(`| 最差 | ${r.leanCtx.worstSavingsRate.toFixed(1)}% |`);
    lines.push('');

    if (Object.keys(r.leanCtx.byCategory).length > 0) {
      lines.push('### 按类别');
      lines.push('');
      lines.push('| 类别 | 平均节省率 |');
      lines.push('|------|----------|');
      for (const [cat, rate] of Object.entries(r.leanCtx.byCategory)) {
        lines.push(`| ${cat} | ${rate.toFixed(1)}% |`);
      }
      lines.push('');
    }
  } else {
    lines.push(`⚠️ ${r.leanCtx.message}`);
    lines.push('');
  }

  // Token 成本
  lines.push('## 三、Token 成本统计');
  lines.push('');
  if (r.tokenCosts.status === 'ok') {
    lines.push('| 指标 | 值 |');
    lines.push('|------|----|');
    lines.push(`| 统计天数 | ${r.tokenCosts.days} |`);
    lines.push(`| 总输入 Token | ${r.tokenCosts.totalInputTokens.toLocaleString()} |`);
    lines.push(`| 总输出 Token | ${r.tokenCosts.totalOutputTokens.toLocaleString()} |`);
    lines.push(`| 缓存命中 Token | ${r.tokenCosts.totalCacheHitTokens.toLocaleString()} |`);
    lines.push(`| 缓存命中率 | ${r.tokenCosts.cacheHitRate.toFixed(1)}% |`);
    lines.push(`| 输入/输出比 | ${r.tokenCosts.inputOutputRatio.toFixed(1)} |`);
    lines.push(`| 总成本 (CNY) | ¥${r.tokenCosts.totalCostCny.toFixed(4)} |`);
    lines.push(`| 日均成本 | ¥${r.tokenCosts.avgDailyCost.toFixed(4)} |`);
    lines.push('');
  } else {
    lines.push(`⚠️ ${r.tokenCosts.message}`);
    lines.push('');
  }

  // 技能覆盖
  lines.push('## 四、技能 Token 消耗覆盖');
  lines.push('');
  if (r.skillCoverage.status === 'ok') {
    lines.push(`- 总追踪记录: ${r.skillCoverage.totalTraces}`);
    lines.push(`- 独特技能: ${r.skillCoverage.uniqueSkills}`);
    lines.push('');
    lines.push('| 技能 | 调用次数 | 输入 Token | 输出 Token |');
    lines.push('|------|---------|-----------|-----------|');
    for (const s of r.skillCoverage.topSkills.slice(0, 10)) {
      lines.push(`| ${s.name} | ${s.count} | ${s.tokensIn.toLocaleString()} | ${s.tokensOut.toLocaleString()} |`);
    }
    lines.push('');
  }

  // 建议
  lines.push('## 五、建议与行动项');
  lines.push('');
  lines.push('| 优先级 | 建议 | 理由 |');
  lines.push('|--------|------|------|');
  if (r.leanCtx.status === 'no_data') {
    lines.push('| **P0** | 运行 `cli-benchmark.cjs` 获取实测数据 | 缺少 CLI 压缩基准数据 |');
  }
  if (r.leanCtx.status === 'ok' && r.leanCtx.cvPercent > 20) {
    lines.push('| **P1** | 检查压缩稳定性 | CV > 20%，波动较大 |');
  }
  if (r.leanCtx.status === 'ok' && r.leanCtx.meanSavingsRate < 50) {
    lines.push('| **P1** | 检查 lean-ctx 配置 | 压缩率低于预期（<50%） |');
  }
  if (r.tokenCosts.status === 'no_data') {
    lines.push('| **P2** | 启动 token-monitor 服务 | 缺少实时 Token 消耗数据 |');
  }
  if (r.tokenCosts.status === 'ok' && r.tokenCosts.cacheHitRate < 10) {
    lines.push('| **P2** | 优化缓存策略 | 缓存命中率过低（<10%） |');
  }
  lines.push('| **P3** | 每周运行一次基准测试 | 建立趋势追踪 |');
  lines.push('');

  lines.push('---');
  lines.push(`*报告工具: benchmark/aggregate-report.cjs*`);

  return lines.join('\n');
}
