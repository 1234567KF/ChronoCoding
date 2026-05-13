#!/usr/bin/env node
/**
 * coverage-reporter.cjs — 覆盖率数据采集器 + 门控判断
 *
 * 从 Vitest/V8 覆盖率输出中提取指标，执行阈值门控判断。
 * 支持 JSON summary、text output、和直接运行 vitest 三种数据来源。
 *
 * 用法:
 *   node .claude/helpers/coverage-reporter.cjs --check [--branches 70] [--lines 80] [--functions 65]
 *   node .claude/helpers/coverage-reporter.cjs --report [--json] [--team <队名>]
 *   node .claude/helpers/coverage-reporter.cjs --collect --team <队名>
 *   node .claude/helpers/coverage-reporter.cjs --compare --baseline <文件> --current <文件>
 *
 * API:
 *   const cov = require('./coverage-reporter.cjs');
 *   cov.collect({ team, cwd }) → { metrics, reportPath }
 *   cov.check({ branches, lines, functions, cwd }) → { pass, metrics, violations }
 *   cov.report({ team, format, cwd }) → { metrics, summary }
 *   cov.compare({ baseline, current }) → { improved, regressed, delta }
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const COVERAGE_DIR = path.join(ROOT, '.claude-flow', 'coverage');

// ─── Default thresholds ───
const DEFAULTS = {
  branches: 70,
  lines: 80,
  functions: 65,
  statements: 80,
};

// ─── Coverage Collection ───

function collect({ team, cwd } = {}) {
  const workDir = cwd || ROOT;
  const reportPath = path.join(COVERAGE_DIR, team ? `${team}-coverage.json` : 'coverage-latest.json');

  // Ensure output dir
  if (!fs.existsSync(COVERAGE_DIR)) {
    fs.mkdirSync(COVERAGE_DIR, { recursive: true });
  }

  let metrics = { branches: null, lines: null, functions: null, statements: null };
  let rawOutput = '';

  // Try existing coverage-summary.json first
  const summaryPath = path.join(workDir, 'coverage', 'coverage-summary.json');
  if (fs.existsSync(summaryPath)) {
    try {
      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
      if (summary.total) {
        metrics = {
          branches: summary.total.branches ? roundPct(summary.total.branches.pct) : null,
          lines: summary.total.lines ? roundPct(summary.total.lines.pct) : null,
          functions: summary.total.functions ? roundPct(summary.total.functions.pct) : null,
          statements: summary.total.statements ? roundPct(summary.total.statements.pct) : null,
          source: 'coverage-summary.json',
        };
      }
    } catch (e) {
      rawOutput += `[WARN] Failed to parse coverage-summary.json: ${e.message}\n`;
    }
  }

  // Try running vitest --coverage
  if (Object.values(metrics).every(v => v === null)) {
    try {
      const result = execSync('npx vitest run --coverage 2>&1', {
        cwd: workDir,
        timeout: 300000,
        stdio: 'pipe',
      });
      rawOutput += result.stdout.toString();
      const parsed = parseCoverageText(rawOutput);
      if (parsed) {
        metrics = { ...parsed, source: 'vitest-run' };
      }
    } catch (e) {
      rawOutput += (e.stdout ? e.stdout.toString() : '') + '\n';
      rawOutput += (e.stderr ? e.stderr.toString() : '') + '\n';
      const parsed = parseCoverageText(rawOutput);
      if (parsed) {
        metrics = { ...parsed, source: 'vitest-run (with failures)' };
      }
    }
  }

  // Try reading from coverage-output.txt
  if (Object.values(metrics).every(v => v === null)) {
    const outputPath = path.join(workDir, 'coverage-output.txt');
    if (fs.existsSync(outputPath)) {
      const content = fs.readFileSync(outputPath, 'utf-8');
      const parsed = parseCoverageText(content);
      if (parsed) {
        metrics = { ...parsed, source: 'coverage-output.txt' };
      }
    }
  }

  const result = {
    metrics,
    reportPath,
    rawOutput: rawOutput.substring(0, 2000),
    collectedAt: new Date().toISOString(),
  };

  // Persist
  fs.writeFileSync(reportPath, JSON.stringify(result, null, 2));

  return result;
}

// ─── Threshold Check ───

function check({ branches, lines, functions, statements, cwd } = {}) {
  const thresholds = {
    branches: branches || DEFAULTS.branches,
    lines: lines || DEFAULTS.lines,
    functions: functions || DEFAULTS.functions,
    statements: statements || DEFAULTS.statements,
  };

  // Collect coverage data
  const { metrics } = collect({ cwd });
  const violations = [];
  let pass = true;

  const checks = [
    { key: 'branches', label: '分支覆盖', icon: '🔀', p0: true },
    { key: 'lines', label: '行覆盖', icon: '📝', p0: false },
    { key: 'functions', label: '函数覆盖', icon: '⚡', p0: false },
    { key: 'statements', label: '语句覆盖', icon: '📊', p0: false },
  ];

  for (const chk of checks) {
    const actual = metrics[chk.key];
    const threshold = thresholds[chk.key];

    if (actual == null) {
      violations.push({
        metric: chk.key,
        status: 'unknown',
        message: `${chk.label}: 无数据`,
        severity: 'warning',
      });
      continue;
    }

    if (actual < threshold) {
      const severity = chk.p0 ? 'P0' : (actual < threshold * 0.7 ? 'P0' : 'P1');
      violations.push({
        metric: chk.key,
        actual,
        threshold,
        status: 'below-threshold',
        message: `${chk.label}: ${actual}% < ${threshold}% (差 ${(threshold - actual).toFixed(1)}%)`,
        severity,
      });
      if (chk.p0) pass = false;
    }
  }

  // All metrics unknown → can't verify coverage
  const allUnknown = checks.every(chk => metrics[chk.key] == null);
  if (allUnknown) {
    pass = false;
    violations.push({
      metric: 'all',
      status: 'unknown',
      message: '无法获取覆盖率数据，请确认: npm install -D @vitest/coverage-v8 && vitest.config.ts 中配置 coverage.provider',
      severity: 'P0',
    });
  }

  const report = {
    pass,
    metrics,
    thresholds,
    violations,
    summary: pass
      ? `覆盖率达标 ✓ | 分支${metrics.branches}% 行${metrics.lines}% 函数${metrics.functions}%`
      : `覆盖率不达标 ✗ | ${violations.filter(v => v.severity === 'P0').map(v => v.message).join('; ') || '检查指标'}`,
  };

  return report;
}

// ─── Report Generation ───

function report({ team, format, cwd } = {}) {
  const { metrics } = collect({ team, cwd });
  const thresholds = DEFAULTS;
  const assessments = [];

  for (const [key, threshold] of Object.entries(thresholds)) {
    const actual = metrics[key];
    if (actual == null) {
      assessments.push({ metric: key, status: 'unknown', message: '无数据' });
      continue;
    }
    if (actual >= threshold) {
      assessments.push({ metric: key, actual, threshold, status: 'pass', icon: '✅' });
    } else if (actual >= threshold * 0.7) {
      assessments.push({ metric: key, actual, threshold, status: 'warn', icon: '⚠️' });
    } else {
      assessments.push({ metric: key, actual, threshold, status: 'fail', icon: '❌' });
    }
  }

  if (format === 'json') {
    return { metrics, assessments, thresholds };
  }

  // Markdown report
  const lines = [
    '## 覆盖率报告',
    '',
    `> 采集时间: ${new Date().toISOString()}`,
    '',
    '| 指标 | 实际值 | 阈值 | 状态 |',
    '|------|--------|------|------|',
  ];

  for (const a of assessments) {
    lines.push(`| ${a.metric} | ${a.actual != null ? a.actual + '%' : 'N/A'} | ${a.threshold}% | ${a.icon} ${a.status} |`);
  }

  lines.push('');
  lines.push(`### 结论: ${assessments.every(a => a.status === 'pass') ? '✅ 全部达标' : '❌ 存在未达标指标'}`);

  return { metrics, assessments, summary: lines.join('\n') };
}

// ─── Compare ───

function compare({ baseline, current } = {}) {
  let baselineMetrics = {};
  let currentMetrics = {};

  if (baseline && fs.existsSync(baseline)) {
    try {
      baselineMetrics = JSON.parse(fs.readFileSync(baseline, 'utf-8')).metrics || {};
    } catch (_) {}
  }

  if (current && fs.existsSync(current)) {
    try {
      currentMetrics = JSON.parse(fs.readFileSync(current, 'utf-8')).metrics || {};
    } catch (_) {}
  } else {
    currentMetrics = collect({}).metrics;
  }

  const delta = {};
  const regressed = [];
  const improved = [];
  const metrics = ['branches', 'lines', 'functions', 'statements'];

  for (const key of metrics) {
    const base = baselineMetrics[key];
    const curr = currentMetrics[key];
    if (base != null && curr != null) {
      delta[key] = roundPct(curr - base);
      if (delta[key] < -1) regressed.push({ metric: key, delta: delta[key] });
      if (delta[key] > 1) improved.push({ metric: key, delta: delta[key] });
    }
  }

  return {
    baseline: baselineMetrics,
    current: currentMetrics,
    delta,
    improved,
    regressed,
    summary: regressed.length > 0
      ? `覆盖率退化: ${regressed.map(r => `${r.metric} ${r.delta}%`).join(', ')}`
      : improved.length > 0
        ? `覆盖率提升: ${improved.map(r => `${r.metric} ${r.delta}%`).join(', ')}`
        : '覆盖率无显著变化',
  };
}

// ─── Parsing Helpers ───

function parseCoverageText(text) {
  // V8/vitest table format: All files | XX.XX | XX.XX | XX.XX | XX.XX |
  const allFilesMatch = text.match(/All files\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)/);
  if (allFilesMatch) {
    return {
      statements: parseFloat(allFilesMatch[1]),
      branches: parseFloat(allFilesMatch[2]),
      functions: parseFloat(allFilesMatch[3]),
      lines: parseFloat(allFilesMatch[4]),
    };
  }

  // Istanbul text format
  const metrics = {};
  const patterns = {
    statements: /Statements\s*:\s*([\d.]+)%/i,
    branches: /Branches\s*:\s*([\d.]+)%/i,
    functions: /Functions\s*:\s*([\d.]+)%/i,
    lines: /Lines\s*:\s*([\d.]+)%/i,
  };

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = text.match(pattern);
    if (match) metrics[key] = parseFloat(match[1]);
  }

  // Try coveralls/lcov format: "branches": "XX.XX"
  if (Object.values(metrics).every(v => v == null)) {
    for (const key of ['branches', 'lines', 'functions', 'statements']) {
      const match = text.match(new RegExp(`"${key}"\\s*:\\s*"([\\d.]+)"`));
      if (match) metrics[key] = parseFloat(match[1]);
    }
  }

  return Object.values(metrics).some(v => v != null) ? metrics : null;
}

function roundPct(val) {
  return Math.round(val * 100) / 100;
}

// ─── Main ───

function main() {
  const args = process.argv.slice(2);
  const opts = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--check': opts.cmd = 'check'; break;
      case '--report': opts.cmd = 'report'; break;
      case '--collect': opts.cmd = 'collect'; break;
      case '--compare': opts.cmd = 'compare'; break;
      case '--team': opts.team = args[++i]; break;
      case '--branches': opts.branches = parseInt(args[++i]); break;
      case '--lines': opts.lines = parseInt(args[++i]); break;
      case '--functions': opts.functions = parseInt(args[++i]); break;
      case '--statements': opts.statements = parseInt(args[++i]); break;
      case '--json': opts.json = true; break;
      case '--baseline': opts.baseline = args[++i]; break;
      case '--current': opts.current = args[++i]; break;
      case '--verbose': opts.verbose = true; break;
    }
  }

  let result;

  switch (opts.cmd) {
    case 'check':
      result = check({
        branches: opts.branches,
        lines: opts.lines,
        functions: opts.functions,
        statements: opts.statements,
      });
      break;
    case 'report':
      result = report({ team: opts.team, format: opts.json ? 'json' : 'markdown' });
      if (typeof result.summary === 'string') {
        console.log(result.summary);
        process.exit(result.metrics ? 0 : 1);
      }
      break;
    case 'collect':
      result = collect({ team: opts.team });
      break;
    case 'compare':
      result = compare({ baseline: opts.baseline, current: opts.current });
      break;
    default:
      // Default: run check
      result = check({
        branches: opts.branches,
        lines: opts.lines,
        functions: opts.functions,
        statements: opts.statements,
      });
      opts.cmd = 'check';
  }

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (opts.cmd === 'check') {
    console.log(result.summary);
    if (result.violations) {
      for (const v of result.violations) {
        console.error(`  [${v.severity}] ${v.message}`);
      }
    }
  } else {
    console.log(JSON.stringify(result, null, 2));
  }

  if (opts.verbose && result.metrics) {
    console.error('\n详细指标:');
    for (const [k, v] of Object.entries(result.metrics)) {
      if (v != null) console.error(`  ${k}: ${v}%`);
    }
  }

  process.exit(result.pass !== false ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = { collect, check, report, compare };
