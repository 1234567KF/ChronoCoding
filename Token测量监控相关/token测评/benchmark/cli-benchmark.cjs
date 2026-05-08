#!/usr/bin/env node
/**
 * Token 效率评测 — CLI 压缩基准测试
 *
 * 用法:
 *   node cli-benchmark.cjs                      # 默认 3 次运行
 *   node cli-benchmark.cjs --runs 5             # 5 次运行
 *   node cli-benchmark.cjs --skill lean-ctx     # 仅测试 lean-ctx
 *   node cli-benchmark.cjs --output report.json # 自定义输出路径
 *
 * 输出: Token测量监控相关/token测评/数据/lean-ctx/YYYY-MM-DD.json
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ── 配置 ──────────────────────────────────────────────
const DATA_DIR = path.resolve(__dirname, '..', '数据', 'lean-ctx');

const TEST_CASES = [
  // ── git ──
  {
    id: 'git-status',
    category: 'git',
    rawCmd: 'git status',
    ctxCmd: 'lean-ctx -c "git status"',
    description: 'Git 工作区状态',
  },
  {
    id: 'git-log',
    category: 'git',
    rawCmd: 'git log --oneline -20',
    ctxCmd: 'lean-ctx -c "git log --oneline -20"',
    description: 'Git 提交历史（20条）',
  },
  {
    id: 'git-diff-stat',
    category: 'git',
    rawCmd: 'git diff --stat HEAD~5',
    ctxCmd: 'lean-ctx -c "git diff --stat HEAD~5"',
    description: 'Git 差异统计（最近5次提交）',
  },
  {
    id: 'git-diff',
    category: 'git',
    rawCmd: 'git diff HEAD~3',
    ctxCmd: 'lean-ctx -c "git diff HEAD~3"',
    description: 'Git 差异全文（最近3次提交）',
  },
  // ── fs ──
  {
    id: 'ls-skills',
    category: 'fs',
    rawCmd: 'ls -R .claude/skills/',
    ctxCmd: 'lean-ctx -c "ls -R .claude/skills/"',
    description: '技能目录树（递归）',
  },
  {
    id: 'ls-claude',
    category: 'fs',
    rawCmd: 'ls -la .claude/',
    ctxCmd: 'lean-ctx -c "ls -la .claude/"',
    description: '.claude 目录列表',
  },
  {
    id: 'ls-node-modules',
    category: 'fs',
    rawCmd: 'ls "Token测量监控相关/monitor/node_modules/" 2>/dev/null || echo "(no node_modules)"',
    ctxCmd: 'lean-ctx -c "ls \\"Token测量监控相关/monitor/node_modules/\\" 2>/dev/null || echo \\"(no node_modules)\\""',
    description: 'node_modules 目录列表（大量输出）',
  },
  // ── file-read ──
  {
    id: 'cat-claude-md',
    category: 'file-read',
    rawCmd: 'cat .claude/CLAUDE.md',
    ctxCmd: 'lean-ctx -c "cat .claude/CLAUDE.md"',
    description: '读取 CLAUDE.md（~200行）',
  },
  {
    id: 'cat-settings',
    category: 'file-read',
    rawCmd: 'cat .claude/settings.json',
    ctxCmd: 'lean-ctx -c "cat .claude/settings.json"',
    description: '读取 settings.json（JSON）',
  },
  {
    id: 'cat-large-skill',
    category: 'file-read',
    rawCmd: 'cat ".claude/helpers/hooks/token-tracker.cjs"',
    ctxCmd: 'lean-ctx -c "cat \\".claude/helpers/hooks/token-tracker.cjs\\""',
    description: '读取大文件 token-tracker.cjs（~600行）',
  },
  // ── test ──
  {
    id: 'npm-ls',
    category: 'build',
    rawCmd: 'npm ls --depth=0 2>&1 || echo "(no npm)"',
    ctxCmd: 'lean-ctx -c "npm ls --depth=0 2>&1 || echo \\"(no npm)\\""',
    description: 'npm 包列表',
  },
  {
    id: 'node-version',
    category: 'build',
    rawCmd: 'node --version && npm --version 2>&1',
    ctxCmd: 'lean-ctx -c "node --version && npm --version 2>&1"',
    description: 'Node/npm 版本信息',
  },
  // ── other ──
  {
    id: 'env-vars',
    category: 'other',
    rawCmd: 'env | head -30',
    ctxCmd: 'lean-ctx -c "env | head -30"',
    description: '环境变量（前30行）',
  },
];

// ── 参数解析 ──────────────────────────────────────────
const args = process.argv.slice(2);
const runsIdx = args.indexOf('--runs');
const RUNS = runsIdx >= 0 ? parseInt(args[runsIdx + 1]) : 3;
const skillIdx = args.indexOf('--skill');
const SKILL = skillIdx >= 0 ? args[skillIdx + 1] : 'lean-ctx';
const outputIdx = args.indexOf('--output');
const OUTPUT = outputIdx >= 0 ? args[outputIdx + 1] : null;

// repo root = 3 levels up from benchmark/
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

// ── 工具函数 ──────────────────────────────────────────
function runCommand(cmd, timeout = 30000) {
  const start = Date.now();
  try {
    const output = execSync(cmd, {
      encoding: 'utf-8',
      timeout,
      maxBuffer: 50 * 1024 * 1024, // 50MB
      cwd: REPO_ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { output, stderr: '', durationMs: Date.now() - start, success: true };
  } catch (e) {
    return { output: e.stdout || '', stderr: e.stderr || '', durationMs: Date.now() - start, success: false, error: e.message };
  }
}

function charToTokenEstimate(chars) {
  // 粗略估算: 中文 ~1 char/token, 英文 ~4 chars/token, 取平均 ~2.5
  return Math.round(chars / 2.5);
}

// ── 主流程 ────────────────────────────────────────────
console.log('╔══════════════════════════════════════════╗');
console.log('║   Token 效率评测 — CLI 压缩基准测试     ║');
console.log('╠══════════════════════════════════════════╣');
console.log(`║  Skill:   ${SKILL.padEnd(32)}║`);
console.log(`║  Runs:    ${String(RUNS).padEnd(32)}║`);
console.log(`║  Cases:   ${String(TEST_CASES.length).padEnd(32)}║`);
console.log('╚══════════════════════════════════════════╝\n');

const allResults = [];
let totalRawChars = 0;
let totalCtxChars = 0;
let totalRawDuration = 0;
let totalCtxDuration = 0;

for (const tc of TEST_CASES) {
  console.log(`\n━━━ ${tc.id} — ${tc.description} ━━━`);

  const caseResult = {
    testCase: tc.id,
    category: tc.category,
    description: tc.description,
    skill: SKILL,
    runs: [],
  };

  for (let i = 1; i <= RUNS; i++) {
    const run = {
      runNumber: i,
      isFirstRun: i === 1,
      timestamp: new Date().toISOString(),
    };

    // 执行原始命令
    process.stdout.write(`  [${i}/${RUNS}] raw  → `);
    const raw = runCommand(tc.rawCmd);
    run.rawChars = raw.output.length;
    run.rawTokensEst = charToTokenEstimate(raw.output.length);
    run.rawDurationMs = raw.durationMs;
    run.rawSuccess = raw.success;
    totalRawChars += raw.output.length;
    totalRawDuration += raw.durationMs;
    console.log(`${raw.output.length} chars (${raw.durationMs}ms)`);

    // 执行压缩命令
    process.stdout.write(`  [${i}/${RUNS}] ctx  → `);
    const ctx = runCommand(tc.ctxCmd);
    run.ctxChars = ctx.output.length;
    run.ctxTokensEst = charToTokenEstimate(ctx.output.length);
    run.ctxDurationMs = ctx.durationMs;
    run.ctxSuccess = ctx.success;
    totalCtxChars += ctx.output.length;
    totalCtxDuration += ctx.durationMs;
    console.log(`${ctx.output.length} chars (${ctx.durationMs}ms)`);

    // 计算节省
    if (raw.output.length > 0) {
      run.savingsRate = ((raw.output.length - ctx.output.length) / raw.output.length * 100);
      run.savingsChars = raw.output.length - ctx.output.length;
      run.savingsRatio = raw.output.length / Math.max(ctx.output.length, 1);
    } else {
      run.savingsRate = 0;
      run.savingsChars = 0;
      run.savingsRatio = 1;
    }

    console.log(`         → 压缩率: ${run.savingsRate.toFixed(1)}% | 节省 ${run.savingsChars} chars`);

    caseResult.runs.push(run);
  }

  // 计算该用例的汇总统计
  const savingsRates = caseResult.runs.map(r => r.savingsRate);
  const mean = savingsRates.reduce((a, b) => a + b, 0) / savingsRates.length;
  const variance = savingsRates.reduce((s, r) => s + (r - mean) ** 2, 0) / savingsRates.length;
  const std = Math.sqrt(variance);
  const cv = mean !== 0 ? (std / Math.abs(mean)) * 100 : 0;

  caseResult.stats = {
    meanSavingsRate: mean,
    medianSavingsRate: savingsRates.sort((a, b) => a - b)[Math.floor(savingsRates.length / 2)],
    stdSavingsRate: std,
    cvPercent: cv,
    minSavingsRate: Math.min(...savingsRates),
    maxSavingsRate: Math.max(...savingsRates),
    avgRawChars: caseResult.runs.reduce((s, r) => s + r.rawChars, 0) / caseResult.runs.length,
    avgCtxChars: caseResult.runs.reduce((s, r) => s + r.ctxChars, 0) / caseResult.runs.length,
  };

  allResults.push(caseResult);
  console.log(`  📊 平均: ${mean.toFixed(1)}% (±${std.toFixed(1)}%) | CV: ${cv.toFixed(1)}%`);
}

// ── 汇总 ──────────────────────────────────────────────
const overallMean = allResults.reduce((s, r) => s + r.stats.meanSavingsRate, 0) / allResults.length;
const totalSavings = ((totalRawChars - totalCtxChars) / totalRawChars * 100);

console.log('\n╔══════════════════════════════════════════╗');
console.log('║           综合汇总                       ║');
console.log('╠══════════════════════════════════════════╣');
console.log(`║  总原始字符:   ${String(totalRawChars).padEnd(28)}║`);
console.log(`║  总压缩字符:   ${String(totalCtxChars).padEnd(28)}║`);
console.log(`║  综合压缩率:   ${totalSavings.toFixed(1)}%`.padEnd(42) + '║');
console.log(`║  平均压缩率:   ${overallMean.toFixed(1)}%`.padEnd(42) + '║');
console.log(`║  原始耗时:     ${totalRawDuration}ms`.padEnd(42) + '║');
console.log(`║  压缩耗时:     ${totalCtxDuration}ms`.padEnd(42) + '║');
console.log('╚══════════════════════════════════════════╝\n');

// ── 输出 ──────────────────────────────────────────────
const report = {
  meta: {
    generatedAt: new Date().toISOString(),
    skill: SKILL,
    runsPerCase: RUNS,
    totalCases: TEST_CASES.length,
    environment: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      cwd: process.cwd(),
    },
  },
  summary: {
    totalRawChars,
    totalCtxChars,
    overallSavingsRate: totalSavings,
    avgSavingsRate: overallMean,
    totalRawDurationMs: totalRawDuration,
    totalCtxDurationMs: totalCtxDuration,
  },
  cases: allResults,
};

// 按类别分组
const byCategory = {};
for (const r of allResults) {
  (byCategory[r.category] = byCategory[r.category] || []).push(r.stats.meanSavingsRate);
}
report.summary.byCategory = {};
for (const [cat, rates] of Object.entries(byCategory)) {
  report.summary.byCategory[cat] = rates.reduce((a, b) => a + b, 0) / rates.length;
}

// 写入文件
const dateStr = new Date().toISOString().slice(0, 10);
const outputPath = OUTPUT || path.join(DATA_DIR, `${dateStr}.json`);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
console.log(`✅ 结果已写入: ${outputPath}`);

// 同时更新 aggregate.json
const aggPath = path.join(DATA_DIR, '..', 'aggregate.json');
let aggregate = {};
try { aggregate = JSON.parse(fs.readFileSync(aggPath, 'utf-8')); } catch (_) {}
aggregate[dateStr] = {
  source: 'cli-benchmark',
  skill: SKILL,
  overallSavingsRate: totalSavings,
  avgSavingsRate: overallMean,
  cases: allResults.length,
  runsPerCase: RUNS,
  byCategory: report.summary.byCategory,
};
fs.writeFileSync(aggPath, JSON.stringify(aggregate, null, 2), 'utf-8');
console.log(`✅ 聚合索引已更新: ${aggPath}`);
