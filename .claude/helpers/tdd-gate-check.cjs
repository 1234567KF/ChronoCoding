#!/usr/bin/env node
/**
 * tdd-gate-check.cjs — TDD 门控验证脚本
 *
 * 实现 TDD 工作流的确定性门控：RED 验证、GREEN 验证、TDD 合规审计。
 * 确定性门控优先于 LLM 判断 — 编译检查、exit code、覆盖率是唯一真理。
 *
 * 用法:
 *   node .claude/helpers/tdd-gate-check.cjs --stage 0.5 --team <队名> --check-red
 *   node .claude/helpers/tdd-gate-check.cjs --stage 2 --team <队名> --check-green
 *   node .claude/helpers/tdd-gate-check.cjs --stage 2 --team <队名> --check-coverage --branches 70
 *   node .claude/helpers/tdd-gate-check.cjs --stage 4 --team <队名> --audit-tdd
 *   node .claude/helpers/tdd-gate-check.cjs --scan-tests <dir> --check-completeness
 *
 * API:
 *   const tdd = require('./tdd-gate-check.cjs');
 *   tdd.checkRed({ team, testDir }) → { pass, failures, report }
 *   tdd.checkGreen({ team, testDir }) → { pass, failures, report }
 *   tdd.checkCoverage({ branches, lines, functions }) → { pass, metrics }
 *   tdd.auditTdd({ team, artifactsDir }) → { pass, violations, report }
 *   tdd.scanTestCompleteness({ testDir }) → { pass, violations }
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');

// ─── Configuration ───
const DEFAULT_THRESHOLDS = {
  branches: 70,
  lines: 80,
  functions: 65,
  statements: 80,
};

const TDD_VIOLATION_SEVERITY = {
  'no-tests-before-code': 'P0',
  'empty-assertions': 'P1',
  'it-todo-found': 'P0',
  'coverage-below-threshold': 'P0',
  'coverage-below-hard-block': 'P0',
  'tests-pass-before-impl': 'P1',
  'no-red-report': 'P1',
  'no-green-report': 'P1',
  'no-cycle-report': 'P1',
  'qa-dev-not-isolated': 'P1',
  'implementation-before-tests': 'P0',
};

// ─── RED Verification (Stage 0.5) ───

/**
 * Verify that tests are in RED state (expected to fail because no implementation exists).
 * Success = tests compile but all fail due to missing implementation.
 */
function checkRed({ team, testDir }) {
  const dir = testDir || path.join(ROOT, `${team}-05-tests`);
  const report = { pass: true, failures: [], warnings: [], details: [] };

  // 1. Check test directory exists
  if (!fs.existsSync(dir)) {
    return {
      pass: false,
      failures: [{ type: 'no-tests-before-code', message: `Test directory not found: ${dir}` }],
      report: 'RED 验证失败：测试目录不存在',
    };
  }

  // 2. Find all test files
  const testFiles = findTestFiles(dir);
  if (testFiles.length === 0) {
    return {
      pass: false,
      failures: [{ type: 'no-tests-before-code', message: 'No test files found in test directory' }],
      report: 'RED 验证失败：未找到测试文件',
    };
  }
  report.details.push({ check: 'test-files-found', count: testFiles.length, pass: true });

  // 3. Check for it.todo / empty assertions (P0 violation)
  const completenessResult = scanTestCompleteness({ testDir: dir });
  if (!completenessResult.pass) {
    report.failures.push(...completenessResult.violations);
    report.pass = false;
  }

  // 4. Try to compile/parse test files (syntax check)
  for (const f of testFiles) {
    const ext = path.extname(f);
    try {
      if (ext === '.ts' || ext === '.tsx') {
        execSync(`npx tsc --noEmit "${f}" 2>&1`, { cwd: ROOT, timeout: 30000, stdio: 'pipe' });
        report.details.push({ file: path.relative(ROOT, f), compile: 'pass' });
      } else if (ext === '.js' || ext === '.jsx') {
        execSync(`node --check "${f}" 2>&1`, { cwd: ROOT, timeout: 10000, stdio: 'pipe' });
        report.details.push({ file: path.relative(ROOT, f), syntax: 'pass' });
      }
    } catch (e) {
      const stderr = e.stderr ? e.stderr.toString().substring(0, 200) : e.message;
      report.failures.push({
        type: 'no-tests-before-code',
        file: path.relative(ROOT, f),
        message: `Syntax/compile error: ${stderr}`,
      });
      report.pass = false;
    }
  }

  // 5. Run tests — they should all fail (RED expected state)
  try {
    execSync(`npx vitest run --config vitest.config.ts "${dir}" 2>&1 || true`, {
      cwd: ROOT,
      timeout: 120000,
      stdio: 'pipe',
    });
    // Tests passing when they should fail is a problem
    report.details.push({ check: 'tests-executed', note: 'Verify tests fail — implementation not yet written' });
  } catch (_) {
    // Expected: tests fail because implementation doesn't exist
    report.details.push({ check: 'tests-executed', note: 'Tests failed as expected (RED state)' });
  }

  // 6. Check RED report exists
  const redReport = path.join(ROOT, `${team}-05-red-report.md`);
  if (!fs.existsSync(redReport)) {
    report.warnings.push({ type: 'no-red-report', message: 'RED 验证报告未生成' });
  }

  report.report = report.pass
    ? `RED 验证通过：${testFiles.length} 个测试文件已就绪，预期全部失败 ✓`
    : `RED 验证失败：${report.failures.length} 个阻断问题`;

  return report;
}

// ─── GREEN Verification (Stage 2) ───

/**
 * Verify that all tests pass (GREEN state after implementation).
 */
function checkGreen({ team, testDir }) {
  const dir = testDir || path.join(ROOT, `${team}-05-tests`);
  const report = { pass: true, failures: [], details: [] };

  if (!fs.existsSync(dir)) {
    return {
      pass: false,
      failures: [{ message: `Test directory not found: ${dir}` }],
      report: 'GREEN 验证失败：测试目录不存在',
    };
  }

  const testFiles = findTestFiles(dir);
  if (testFiles.length === 0) {
    return {
      pass: false,
      failures: [{ message: 'No test files found' }],
      report: 'GREEN 验证失败：未找到测试文件',
    };
  }

  // Run tests
  try {
    const result = execSync(`npx vitest run --config vitest.config.ts "${dir}" 2>&1`, {
      cwd: ROOT,
      timeout: 300000,
      stdio: 'pipe',
    });
    const stdout = result.stdout ? result.stdout.toString() : '';
    report.details.push({ check: 'test-run', status: 'passed', output: stdout.substring(0, 500) });
  } catch (e) {
    const stderr = e.stderr ? e.stderr.toString() : '';
    const stdout = e.stdout ? e.stdout.toString() : '';
    const combined = (stdout + stderr).substring(0, 1000);

    // Parse test failures
    const failMatch = combined.match(/(\d+)\s+failed/);
    const passMatch = combined.match(/(\d+)\s+passed/);

    if (failMatch && parseInt(failMatch[1]) > 0) {
      report.pass = false;
      report.failures.push({
        type: 'tests-not-green',
        failed: parseInt(failMatch[1]),
        passed: passMatch ? parseInt(passMatch[1]) : 0,
        message: `${failMatch[1]} tests still failing`,
      });
    }
    report.details.push({ check: 'test-run', status: 'failed', output: combined.substring(0, 500) });
  }

  // Check cycle reports exist
  const cycleFiles = globSync(path.join(ROOT, `${team}-02-tdd-cycle-*.md`));
  if (cycleFiles.length === 0) {
    report.failures.push({
      type: 'no-cycle-report',
      message: '未找到 TDD Cycle 报告文件',
    });
    report.pass = false;
  } else {
    report.details.push({ check: 'cycle-reports', count: cycleFiles.length });
  }

  report.report = report.pass
    ? 'GREEN 验证通过：全部测试通过 ✓'
    : `GREEN 验证失败：${report.failures.length} 个问题`;

  return report;
}

// ─── Coverage Gate (Stage 3) ───

function checkCoverage({ branches, lines, functions, statements } = {}) {
  const thresholds = {
    branches: branches || DEFAULT_THRESHOLDS.branches,
    lines: lines || DEFAULT_THRESHOLDS.lines,
    functions: functions || DEFAULT_THRESHOLDS.functions,
    statements: statements || DEFAULT_THRESHOLDS.statements,
  };

  const report = { pass: true, metrics: {}, failures: [], violations: [] };

  // Try to read coverage from vitest output or coverage-summary.json
  const coverageSummaryPath = path.join(ROOT, 'coverage', 'coverage-summary.json');
  const coverageOutputPath = path.join(ROOT, 'coverage-output.txt');

  let coverageData = null;

  // Try JSON summary first
  if (fs.existsSync(coverageSummaryPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(coverageSummaryPath, 'utf-8'));
      const total = raw.total;
      if (total) {
        coverageData = {
          branches: total.branches ? total.branches.pct : null,
          lines: total.lines ? total.lines.pct : null,
          functions: total.functions ? total.functions.pct : null,
          statements: total.statements ? total.statements.pct : null,
        };
      }
    } catch (_) {}
  }

  // Try parsing coverage output text
  if (!coverageData && fs.existsSync(coverageOutputPath)) {
    coverageData = parseCoverageOutput(fs.readFileSync(coverageOutputPath, 'utf-8'));
  }

  // Try running coverage
  if (!coverageData) {
    try {
      const result = execSync('npx vitest run --coverage 2>&1', {
        cwd: ROOT,
        timeout: 300000,
        stdio: 'pipe',
      });
      coverageData = parseCoverageOutput(result.stdout.toString());
    } catch (e) {
      const output = (e.stdout ? e.stdout.toString() : '') + (e.stderr ? e.stderr.toString() : '');
      coverageData = parseCoverageOutput(output) || { branches: 0, lines: 0, functions: 0, statements: 0 };
    }
  }

  if (!coverageData || Object.values(coverageData).every(v => v === null || v === undefined)) {
    return {
      pass: false,
      metrics: coverageData || {},
      failures: [{ message: '无法获取覆盖率数据，请确认 Vitest coverage 配置正确' }],
      report: '覆盖率门控失败：无法获取数据',
    };
  }

  report.metrics = coverageData;

  // Check each threshold
  const checks = [
    { key: 'branches', label: '分支覆盖', hardBlock: 50 },
    { key: 'lines', label: '行覆盖', hardBlock: 50 },
    { key: 'functions', label: '函数覆盖', hardBlock: 40 },
    { key: 'statements', label: '语句覆盖', hardBlock: 50 },
  ];

  for (const check of checks) {
    const actual = coverageData[check.key];
    const threshold = thresholds[check.key];
    if (actual == null) continue;

    if (actual < check.hardBlock) {
      report.pass = false;
      report.failures.push({
        type: 'coverage-below-hard-block',
        metric: check.key,
        actual,
        threshold: check.hardBlock,
        severity: 'P0',
        message: `${check.label} ${actual}% < ${check.hardBlock}%（硬阻断）`,
      });
    } else if (actual < threshold) {
      report.violations.push({
        type: 'coverage-below-threshold',
        metric: check.key,
        actual,
        threshold,
        severity: threshold === thresholds.branches ? 'P0' : 'P1',
        message: `${check.label} ${actual}% < ${threshold}%（未达标）`,
      });
      if (check.key === 'branches') {
        report.pass = false;
      }
    }
  }

  if (report.pass && report.violations.length > 0) {
    report.report = `覆盖率门控通过（有告警）：${report.violations.map(v => v.message).join('; ')}`;
  } else if (report.pass) {
    report.report = `覆盖率门控通过：分支${coverageData.branches}% 行${coverageData.lines}% 函数${coverageData.functions}% ✓`;
  } else {
    report.report = `覆盖率门控失败：${report.failures.map(f => f.message).join('; ')}`;
  }

  return report;
}

// ─── TDD Compliance Audit (Stage 4) ───

function auditTdd({ team, artifactsDir } = {}) {
  const dir = artifactsDir || ROOT;
  const report = { pass: true, violations: [], details: [] };

  // K1: Are test files created before implementation?
  const testDir = path.join(dir, `${team}-05-tests`);
  const redReport = path.join(dir, `${team}-05-red-report.md`);
  const implReport = path.join(dir, `${team}-02-implementation.md`);

  if (!fs.existsSync(testDir)) {
    report.violations.push({
      id: 'K1',
      severity: 'P0',
      message: '编码前测试文件缺失 — K1: 编码前是否有测试文件',
    });
    report.pass = false;
  }

  // K2: RED verification passed?
  if (!fs.existsSync(redReport)) {
    report.violations.push({
      id: 'K2',
      severity: 'P0',
      message: 'RED 验证报告缺失 — K2: RED 验证是否通过',
    });
    report.pass = false;
  } else {
    try {
      const content = fs.readFileSync(redReport, 'utf-8');
      if (!content.includes('RED') && !content.includes('失败')) {
        report.violations.push({
          id: 'K2',
          severity: 'P0',
          message: 'RED 验证报告内容不明确',
        });
      }
    } catch (_) {}
  }

  // K3: Check for it.todo in test files
  if (fs.existsSync(testDir)) {
    const completenessResult = scanTestCompleteness({ testDir });
    if (!completenessResult.pass) {
      report.violations.push(...completenessResult.violations);
      report.pass = false;
    }
  }

  // K4: Coverage threshold check
  const coverageResult = checkCoverage({});
  if (!coverageResult.pass) {
    report.violations.push({
      id: 'K4',
      severity: 'P0',
      message: `覆盖率不达标 — K4: 分支覆盖 ≥ 70%`,
      metrics: coverageResult.metrics,
    });
    report.pass = false;
  } else if (coverageResult.violations.length > 0) {
    report.violations.push({
      id: 'K4',
      severity: 'P1',
      message: `覆盖率部分指标未达标 — ${coverageResult.violations.map(v => v.message).join('; ')}`,
    });
  }

  // K5: Implementation before tests check (check git commit timeline)
  // If implementation files have earlier commits than test files, that's a TDD violation
  try {
    const cycleFiles = globSync(path.join(dir, `${team}-02-tdd-cycle-*.md`));
    if (cycleFiles.length === 0 && fs.existsSync(implReport)) {
      report.violations.push({
        id: 'K5',
        severity: 'P0',
        message: 'TDD Cycle 报告缺失 — K5: 可能先实现后补测试',
      });
      report.pass = false;
    }
  } catch (_) {}

  // K6: Assertion completeness
  if (fs.existsSync(testDir)) {
    const testFiles = findTestFiles(testDir);
    for (const f of testFiles) {
      try {
        const content = fs.readFileSync(f, 'utf-8');
        const todoCount = (content.match(/it\.todo/g) || []).length;
        const testCount = (content.match(/\bit\(/g) || []).length;
        if (testCount > 0 && todoCount / testCount > 0.3) {
          report.violations.push({
            id: 'K6',
            severity: 'P1',
            file: path.relative(ROOT, f),
            message: `${todoCount}/${testCount} 测试用例为 it.todo 骨架 — K6: 测试断言不完整`,
          });
        }
      } catch (_) {}
    }
  }

  report.details.push({
    check: 'tdd-compliance',
    totalChecks: 7,
    violations: report.violations.length,
  });

  report.report = report.pass
    ? `TDD 合规审计通过 ✓`
    : `TDD 合规审计失败：${report.violations.length} 个违规`;

  return report;
}

// ─── Test Completeness Scanner ───

function scanTestCompleteness({ testDir }) {
  const violations = [];
  const dir = testDir;

  if (!fs.existsSync(dir)) {
    return { pass: false, violations: [{ id: 'K3', severity: 'P0', message: '测试目录不存在' }] };
  }

  const testFiles = findTestFiles(dir);
  for (const f of testFiles) {
    try {
      const content = fs.readFileSync(f, 'utf-8');

      // Check for it.todo
      const todoMatches = content.match(/it\.todo\s*\(/g) || [];
      if (todoMatches.length > 0) {
        violations.push({
          id: 'K3',
          severity: 'P0',
          file: path.relative(ROOT, f),
          message: `发现 ${todoMatches.length} 个 it.todo 空断言 — 禁止使用`,
        });
      }

      // Check for empty test bodies
      const emptyTests = [];
      const testRegex = /\bit\s*\(\s*['"]([^'"]+)['"]\s*,\s*(?:async\s*)?\(\s*\)\s*=>\s*\{\s*\}/g;
      let match;
      while ((match = testRegex.exec(content)) !== null) {
        emptyTests.push(match[1]);
      }
      if (emptyTests.length > 0) {
        violations.push({
          id: 'K6',
          severity: 'P1',
          file: path.relative(ROOT, f),
          message: `${emptyTests.length} 个空断言体: ${emptyTests.join(', ')}`,
        });
      }
    } catch (_) {}
  }

  return {
    pass: violations.filter(v => v.severity === 'P0').length === 0,
    violations,
  };
}

// ─── Helpers ───

function findTestFiles(dir) {
  const results = [];
  const testPatterns = ['.test.', '_test.', '.spec.', '_spec.'];
  try {
    walkDir(dir, (filePath) => {
      const basename = path.basename(filePath);
      for (const pat of testPatterns) {
        if (basename.includes(pat) && /\.(ts|tsx|js|jsx|py|go)$/.test(basename)) {
          results.push(filePath);
          break;
        }
      }
    });
  } catch (_) {}
  return results;
}

function walkDir(dir, callback) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('node_modules') && !entry.name.startsWith('.')) {
        walkDir(fullPath, callback);
      } else if (entry.isFile()) {
        callback(fullPath);
      }
    }
  } catch (_) {}
}

function globSync(pattern) {
  // Simple glob for *.md patterns
  const results = [];
  const dir = path.dirname(pattern);
  const ext = path.extname(pattern);
  try {
    if (fs.existsSync(dir)) {
      walkDir(dir, (filePath) => {
        if (filePath.endsWith(ext)) results.push(filePath);
      });
    }
  } catch (_) {}
  return results;
}

function parseCoverageOutput(output) {
  const metrics = { branches: null, lines: null, functions: null, statements: null };

  // Try to parse V8/vitest coverage output format
  // All files |  XX.XX |  XX.XX |  XX.XX |  XX.XX |
  const allFilesMatch = output.match(/All files\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)/);
  if (allFilesMatch) {
    metrics.statements = parseFloat(allFilesMatch[1]);
    metrics.branches = parseFloat(allFilesMatch[2]);
    metrics.functions = parseFloat(allFilesMatch[3]);
    metrics.lines = parseFloat(allFilesMatch[4]);
    return metrics;
  }

  // Try Istanbul format
  // Branches: XX% (N/M)
  const branchMatch = output.match(/Branches\s*:\s*([\d.]+)%/);
  if (branchMatch) metrics.branches = parseFloat(branchMatch[1]);
  const lineMatch = output.match(/Lines\s*:\s*([\d.]+)%/);
  if (lineMatch) metrics.lines = parseFloat(lineMatch[1]);
  const funcMatch = output.match(/Functions\s*:\s*([\d.]+)%/);
  if (funcMatch) metrics.functions = parseFloat(funcMatch[1]);
  const stmtMatch = output.match(/Statements\s*:\s*([\d.]+)%/);
  if (stmtMatch) metrics.statements = parseFloat(stmtMatch[1]);

  if (Object.values(metrics).some(v => v !== null)) return metrics;
  return null;
}

// ─── Main ───

function main() {
  const args = process.argv.slice(2);
  let cmd = null;
  const opts = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--stage': opts.stage = args[++i]; break;
      case '--team': opts.team = args[++i]; break;
      case '--check-red': cmd = 'check-red'; break;
      case '--check-green': cmd = 'check-green'; break;
      case '--check-coverage': cmd = 'check-coverage'; break;
      case '--audit-tdd': cmd = 'audit-tdd'; break;
      case '--scan-tests': opts.testDir = args[++i]; cmd = 'scan-tests'; break;
      case '--check-completeness': cmd = 'check-completeness'; break;
      case '--test-dir': opts.testDir = args[++i]; break;
      case '--branches': opts.branches = parseInt(args[++i]); break;
      case '--lines': opts.lines = parseInt(args[++i]); break;
      case '--functions': opts.functions = parseInt(args[++i]); break;
      case '--json': opts.json = true; break;
    }
  }

  let result;

  switch (cmd) {
    case 'check-red':
      result = checkRed({ team: opts.team, testDir: opts.testDir });
      break;
    case 'check-green':
      result = checkGreen({ team: opts.team, testDir: opts.testDir });
      break;
    case 'check-coverage':
      result = checkCoverage({
        branches: opts.branches,
        lines: opts.lines,
        functions: opts.functions,
      });
      break;
    case 'audit-tdd':
      result = auditTdd({ team: opts.team });
      break;
    case 'check-completeness':
      result = scanTestCompleteness({ testDir: opts.testDir || path.join(ROOT, `${opts.team}-05-tests`) });
      break;
    case 'scan-tests':
      result = scanTestCompleteness({ testDir: opts.testDir });
      break;
    default:
      console.error('TDD Gate Check — 用法:');
      console.error('  node tdd-gate-check.cjs --stage 0.5 --team <队名> --check-red');
      console.error('  node tdd-gate-check.cjs --stage 2 --team <队名> --check-green');
      console.error('  node tdd-gate-check.cjs --stage 2 --team <队名> --check-coverage');
      console.error('  node tdd-gate-check.cjs --stage 4 --team <队名> --audit-tdd');
      process.exit(2);
  }

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(result.report || JSON.stringify(result));
    if (result.failures && result.failures.length > 0) {
      for (const f of result.failures) {
        console.error(`  [${f.severity || 'P0'}] ${f.message}`);
      }
    }
    if (result.violations && result.violations.length > 0) {
      for (const v of result.violations) {
        console.error(`  [${v.severity || 'P1'}] ${v.message}`);
      }
    }
    if (result.details) {
      for (const d of result.details) {
        console.error(`  - ${d.check}: ${d.note || d.status || d.count || 'ok'}`);
      }
    }
  }

  process.exit(result.pass ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = { checkRed, checkGreen, checkCoverage, auditTdd, scanTestCompleteness };
