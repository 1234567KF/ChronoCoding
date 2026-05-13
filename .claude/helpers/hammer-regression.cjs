#!/usr/bin/env node
/**
 * hammer-regression.cjs — 一键回归命令
 *
 * 串联完整测试流水线：DB reset → migrate → seed → test run → coverage → report
 * 所有产出归档到 .claude-flow/hammer-artifacts/regression-{timestamp}/
 *
 * 用法:
 *   node .claude/helpers/hammer-regression.cjs                    # 完整回归
 *   node .claude/helpers/hammer-regression.cjs --quick            # 快速回归（跳过 seed）
 *   node .claude/helpers/hammer-regression.cjs --unit-only        # 仅单元测试
 *   node .claude/helpers/hammer-regression.cjs --e2e-only         # 仅 E2E 测试
 *   node .claude/helpers/hammer-regression.cjs --report-only      # 仅从已有数据生成报告
 *   node .claude/helpers/hammer-regression.cjs --list             # 列出历史回归记录
 *   node .claude/helpers/hammer-regression.cjs --compare <id1> <id2>  # 比较两次回归
 *
 * API:
 *   const reg = require('./hammer-regression.cjs');
 *   reg.full({ projectRoot }) → { pass, report, archiveDir }
 *   reg.quick({ projectRoot }) → { pass, report, archiveDir }
 *   reg.list() → [{ id, date, pass, ... }]
 *   reg.compare({ id1, id2 }) → { delta, regressed }
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const ARTIFACTS_DIR = path.join(ROOT, '.claude-flow', 'hammer-artifacts');
const REGRESSION_INDEX = path.join(ARTIFACTS_DIR, 'regression-index.json');

// ─── Project Detection ───

function detectProjectType(cwd = ROOT) {
  const has = (file) => fs.existsSync(path.join(cwd, file));

  if (has('package.json')) {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    if (deps.vue) return { type: 'vue', runtime: 'node', testRunner: 'vitest' };
    if (deps.react) return { type: 'react', runtime: 'node', testRunner: 'vitest' };
    if (deps.next) return { type: 'nextjs', runtime: 'node', testRunner: 'vitest' };
    if (deps.express || deps.koa || deps.fastify) return { type: 'node-server', runtime: 'node', testRunner: 'vitest' };
    return { type: 'node', runtime: 'node', testRunner: 'vitest' };
  }

  if (has('go.mod')) return { type: 'go', runtime: 'go', testRunner: 'go-test' };
  if (has('requirements.txt') || has('pyproject.toml')) return { type: 'python', runtime: 'python', testRunner: 'pytest' };
  if (has('Cargo.toml')) return { type: 'rust', runtime: 'rust', testRunner: 'cargo-test' };

  return { type: 'unknown', runtime: 'node', testRunner: 'vitest' };
}

// ─── DB Operations ───

function resetDatabase(cwd = ROOT) {
  const log = { steps: [], errors: [] };
  const project = detectProjectType(cwd);

  // Detect DB type from config files
  const hasPrisma = fs.existsSync(path.join(cwd, 'prisma', 'schema.prisma'));
  const hasDrizzle = fs.existsSync(path.join(cwd, 'drizzle.config.ts')) || fs.existsSync(path.join(cwd, 'drizzle.config.js'));
  const hasKnex = fs.existsSync(path.join(cwd, 'knexfile.js')) || fs.existsSync(path.join(cwd, 'knexfile.ts'));
  const hasSQLite = fs.existsSync(path.join(cwd, '*.sqlite')) || fs.existsSync(path.join(cwd, 'data', '*.db'));
  const hasDockerCompose = fs.existsSync(path.join(cwd, 'docker-compose.yml')) || fs.existsSync(path.join(cwd, 'docker-compose.yaml'));

  try {
    if (hasPrisma) {
      execSync('npx prisma migrate reset --force 2>&1', { cwd, timeout: 60000, stdio: 'pipe' });
      log.steps.push('prisma:reset');
    }

    if (hasDrizzle) {
      execSync('npx drizzle-kit push 2>&1', { cwd, timeout: 60000, stdio: 'pipe' });
      log.steps.push('drizzle:push');
    }

    if (hasKnex) {
      execSync('npx knex migrate:rollback --all 2>&1', { cwd, timeout: 60000, stdio: 'pipe' });
      execSync('npx knex migrate:latest 2>&1', { cwd, timeout: 60000, stdio: 'pipe' });
      log.steps.push('knex:migrate');
    }

    // Generic: detect and run any migration script
    const migrationScripts = ['db:migrate', 'db:reset', 'migrate', 'db:setup'];
    if (fs.existsSync(path.join(cwd, 'package.json'))) {
      const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf-8'));
      const scripts = pkg.scripts || {};
      for (const key of migrationScripts) {
        if (scripts[key]) {
          execSync(`npm run ${key} 2>&1`, { cwd, timeout: 120000, stdio: 'pipe' });
          log.steps.push(`npm:${key}`);
          break;
        }
      }
    }

    if (log.steps.length === 0 && !hasSQLite && !hasDockerCompose) {
      log.steps.push('no-db-detected');
    }
  } catch (e) {
    log.errors.push({ step: 'db-reset', error: (e.stderr || e.message || '').toString().substring(0, 300) });
  }

  return log;
}

function seedDatabase(cwd = ROOT) {
  const log = { steps: [], errors: [] };
  const project = detectProjectType(cwd);

  try {
    if (fs.existsSync(path.join(cwd, 'package.json'))) {
      const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf-8'));
      const scripts = pkg.scripts || {};
      const seedKeys = ['db:seed', 'seed', 'db:fixtures'];
      for (const key of seedKeys) {
        if (scripts[key]) {
          execSync(`npm run ${key} 2>&1`, { cwd, timeout: 120000, stdio: 'pipe' });
          log.steps.push(`npm:${key}`);
          break;
        }
      }
    }

    // Prisma seed
    if (fs.existsSync(path.join(cwd, 'prisma', 'seed.ts')) || fs.existsSync(path.join(cwd, 'prisma', 'seed.js'))) {
      execSync('npx prisma db seed 2>&1', { cwd, timeout: 120000, stdio: 'pipe' });
      log.steps.push('prisma:seed');
    }

    if (log.steps.length === 0) {
      log.steps.push('no-seed-configured');
    }
  } catch (e) {
    log.errors.push({ step: 'seed', error: (e.stderr || e.message || '').toString().substring(0, 300) });
  }

  return log;
}

// ─── Test Execution ───

function runTests({ cwd = ROOT, unitOnly = false, e2eOnly = false, use3pio = false } = {}) {
  const log = { steps: [], results: { unit: null, integration: null, e2e: null, coverage: null }, errors: [], startTime: Date.now() };

  try {
    // Unit tests
    if (!e2eOnly) {
      const unitCmd = use3pio
        ? '3pio npx vitest run --reporter=verbose 2>&1'
        : 'npx vitest run --reporter=verbose 2>&1';

      try {
        const result = execSync(unitCmd, { cwd, timeout: 300000, stdio: 'pipe' });
        const output = result.stdout.toString();
        log.results.unit = parseTestOutput(output);
        log.steps.push('unit-tests:ok');
      } catch (e) {
        const output = (e.stdout || '').toString() + (e.stderr || '').toString();
        log.results.unit = parseTestOutput(output);
        log.steps.push('unit-tests:failed');
        log.errors.push({ step: 'unit-tests', error: log.results.unit.summary });
      }
    }

    // Integration tests (separate from unit)
    if (!e2eOnly && !unitOnly) {
      const intPattern = '**/*.integration.test.*';
      try {
        const result = execSync(`npx vitest run ${intPattern} --reporter=verbose 2>&1`, { cwd, timeout: 300000, stdio: 'pipe' });
        log.results.integration = parseTestOutput(result.stdout.toString());
        log.steps.push('integration-tests:ok');
      } catch (e) {
        const output = (e.stdout || '').toString() + (e.stderr || '').toString();
        log.results.integration = parseTestOutput(output);
        log.steps.push('integration-tests:failed');
      }
    }

    // E2E tests
    if (!unitOnly) {
      try {
        // Playwright
        const pwConfig = fs.existsSync(path.join(cwd, 'playwright.config.ts')) || fs.existsSync(path.join(cwd, 'playwright.config.js'));
        if (pwConfig) {
          execSync('npx playwright test 2>&1', { cwd, timeout: 600000, stdio: 'pipe' });
          log.results.e2e = { passed: true, runner: 'playwright' };
          log.steps.push('e2e-tests:ok');
        } else {
          log.steps.push('e2e-tests:no-config');
        }
      } catch (e) {
        log.results.e2e = { passed: false, runner: 'playwright', error: (e.stderr || '').toString().substring(0, 500) };
        log.steps.push('e2e-tests:failed');
      }
    }

    // Coverage
    try {
      const covResult = execSync('npx vitest run --coverage 2>&1', { cwd, timeout: 300000, stdio: 'pipe' });
      log.results.coverage = parseCoverageOutput(covResult.stdout.toString());
      log.steps.push('coverage:ok');
    } catch (e) {
      const output = (e.stdout || '').toString() + (e.stderr || '').toString();
      log.results.coverage = parseCoverageOutput(output);
      log.steps.push('coverage:failed');
    }
  } catch (e) {
    log.errors.push({ step: 'test-execution', error: e.message });
  }

  log.results.duration = Date.now() - log.startTime;
  return log;
}

// ─── Report Generation ───

function generateReport({ dbLog, testLog, taskName, cwd = ROOT } = {}) {
  const timestamp = new Date().toISOString();
  const id = `reg-${new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19)}`;

  // Build markdown report
  const lines = [
    `# 回归测试报告 — ${taskName || id}`,
    '',
    `> **执行时间**: ${timestamp}`,
    `> **总耗时**: ${testLog?.results?.duration ? (testLog.results.duration / 1000).toFixed(1) + 's' : 'N/A'}`,
    '',
    '---',
    '',
    '## 1. 数据库重置',
    '',
  ];

  // DB section
  if (dbLog) {
    lines.push(`| 步骤 | 状态 |`);
    lines.push(`|------|------|`);
    for (const step of dbLog.steps) {
      lines.push(`| ${step} | ✅ |`);
    }
    for (const err of dbLog.errors) {
      lines.push(`| ${err.step} | ❌ ${err.error.substring(0, 100)} |`);
    }
    lines.push('');
  }

  // Test results
  lines.push('## 2. 测试结果');
  lines.push('');

  const unit = testLog?.results?.unit;
  if (unit) {
    lines.push('### 单元测试');
    lines.push(`- 通过: ${unit.passed || 0} / ${unit.total || 0}`);
    lines.push(`- 失败: ${unit.failed || 0}`);
    if (unit.failed > 0) {
      lines.push('- **状态**: ❌ 未通过');
    } else {
      lines.push('- **状态**: ✅ 全部通过');
    }
    lines.push('');
  }

  const int = testLog?.results?.integration;
  if (int) {
    lines.push('### 集成测试');
    lines.push(`- 通过: ${int.passed || 0} / ${int.total || 0}`);
    lines.push(`- 失败: ${int.failed || 0}`);
    lines.push('');
  }

  const e2e = testLog?.results?.e2e;
  if (e2e) {
    lines.push('### E2E 测试');
    lines.push(`- 状态: ${e2e.passed ? '✅ 通过' : '❌ 失败'}`);
    if (e2e.runner) lines.push(`- 运行器: ${e2e.runner}`);
    lines.push('');
  }

  // Coverage
  const cov = testLog?.results?.coverage;
  lines.push('## 3. 覆盖率');
  lines.push('');
  lines.push('| 指标 | 覆盖率 | 阈值 | 状态 |');
  lines.push('|------|--------|------|------|');

  const thresholds = { branches: 70, lines: 80, functions: 65 };
  for (const [key, threshold] of Object.entries(thresholds)) {
    const actual = cov?.[key];
    const icon = actual != null ? (actual >= threshold ? '✅' : actual >= threshold * 0.7 ? '⚠️' : '❌') : '⬜';
    lines.push(`| ${key} | ${actual != null ? actual + '%' : 'N/A'} | ${threshold}% | ${icon} |`);
  }
  lines.push('');

  // Errors section
  const allErrors = [...(dbLog?.errors || []), ...(testLog?.errors || [])];
  if (allErrors.length > 0) {
    lines.push('## 4. 错误详情');
    lines.push('');
    for (const err of allErrors) {
      lines.push(`- **[${err.step}]** ${err.error}`);
    }
    lines.push('');
  }

  // Overall verdict
  const unitFailed = unit?.failed > 0;
  const branchFailed = cov?.branches != null && cov.branches < 50;
  const overallPass = !unitFailed && !branchFailed && allErrors.filter(e => e.step.includes('db-reset')).length === 0;

  lines.push('## 5. 结论');
  lines.push('');
  lines.push(`**整体状态**: ${overallPass ? '✅ 通过' : '❌ 未通过'}`);

  return { id, report: lines.join('\n'), pass: overallPass, timestamp };
}

// ─── Archive ───

function archiveResults({ id, dbLog, testLog, report }) {
  const archiveDir = path.join(ARTIFACTS_DIR, `regression-${id}`);
  if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
  }

  fs.writeFileSync(path.join(archiveDir, 'db-reset.json'), JSON.stringify(dbLog, null, 2));
  fs.writeFileSync(path.join(archiveDir, 'test-results.json'), JSON.stringify(testLog, null, 2));
  fs.writeFileSync(path.join(archiveDir, 'regression-report.md'), report);

  // Copy coverage report if exists
  const coverageDir = path.join(ROOT, 'coverage');
  if (fs.existsSync(coverageDir)) {
    const destDir = path.join(archiveDir, 'coverage');
    copyDir(coverageDir, destDir);
  }

  // Update index
  updateIndex({ id, pass: report.includes('✅ 通过'), timestamp: new Date().toISOString(), archiveDir });

  return archiveDir;
}

// ─── Full Pipeline ───

function full({ cwd = ROOT, taskName } = {}) {
  console.log('[hammer-regression] 开始完整回归...\n');

  // Phase 1: DB Reset
  console.log('[1/4] 重置数据库...');
  const dbLog = { steps: [], errors: [] };

  try {
    execSync('npm run db:reset 2>&1', { cwd, timeout: 120000, stdio: 'pipe' });
    dbLog.steps.push('db:reset');
  } catch {
    // Fallback: try individual steps
    const resetLog = resetDatabase(cwd);
    dbLog.steps.push(...resetLog.steps);
    dbLog.errors.push(...resetLog.errors);
  }
  console.log(`  步骤: ${dbLog.steps.join(', ') || '无'}`);

  // Phase 2: Seed
  console.log('[2/4] 种子数据...');
  const seedLog = seedDatabase(cwd);
  dbLog.steps.push(...seedLog.steps);
  dbLog.errors.push(...seedLog.errors);

  // Phase 3: Tests
  console.log('[3/4] 运行测试套件...');
  const testLog = runTests({ cwd });

  // Phase 4: Report
  console.log('[4/4] 生成报告...');
  const { id, report, pass } = generateReport({ dbLog, testLog, taskName, cwd });
  const archiveDir = archiveResults({ id, dbLog, testLog, report });

  console.log(`\n[hammer-regression] ${pass ? '✅ 回归通过' : '❌ 回归未通过'}`);
  console.log(`  报告: ${path.join(archiveDir, 'regression-report.md')}`);
  console.log(`  归档: ${archiveDir}`);

  return { pass, report, archiveDir, id };
}

function quick({ cwd = ROOT, taskName } = {}) {
  console.log('[hammer-regression] 快速回归（跳过种子数据）...');
  const dbLog = resetDatabase(cwd);
  const testLog = runTests({ cwd });
  const { id, report, pass } = generateReport({ dbLog, testLog, taskName });
  const archiveDir = archiveResults({ id, dbLog, testLog, report });
  console.log(`\n[hammer-regression] ${pass ? '✅' : '❌'} 报告: ${path.join(archiveDir, 'regression-report.md')}`);
  return { pass, report, archiveDir, id };
}

// ─── Helpers ───

function parseTestOutput(output) {
  const result = { passed: 0, failed: 0, total: 0, summary: '' };

  // Vitest format: "Tests  N passed | N failed"
  const totalMatch = output.match(/Tests\s+(\d+)\s+passed.*?(\d+)\s+failed/);
  if (totalMatch) {
    result.passed = parseInt(totalMatch[1]) || 0;
    result.failed = parseInt(totalMatch[2]) || 0;
    result.total = result.passed + result.failed;
    result.summary = `${result.passed} passed, ${result.failed} failed`;
    return result;
  }

  // Alternative: "N passed" "N failed"
  const passMatch = output.match(/(\d+)\s+passed/);
  const failMatch = output.match(/(\d+)\s+failed/);
  if (passMatch || failMatch) {
    result.passed = passMatch ? parseInt(passMatch[1]) : 0;
    result.failed = failMatch ? parseInt(failMatch[1]) : 0;
    result.total = result.passed + result.failed;
    result.summary = `${result.passed} passed, ${result.failed} failed`;
    return result;
  }

  // Jest format
  const jestMatch = output.match(/Tests:\s+(\d+)\s+passed,\s+(\d+)\s+failed,\s+(\d+)\s+total/);
  if (jestMatch) {
    result.passed = parseInt(jestMatch[1]);
    result.failed = parseInt(jestMatch[2]);
    result.total = parseInt(jestMatch[3]);
    result.summary = `${result.passed} passed, ${result.failed} failed, ${result.total} total`;
    return result;
  }

  return result;
}

function parseCoverageOutput(output) {
  const metrics = {};
  const allFilesMatch = output.match(/All files\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)/);
  if (allFilesMatch) {
    metrics.statements = parseFloat(allFilesMatch[1]);
    metrics.branches = parseFloat(allFilesMatch[2]);
    metrics.functions = parseFloat(allFilesMatch[3]);
    metrics.lines = parseFloat(allFilesMatch[4]);
    return metrics;
  }

  const patterns = {
    branches: /Branches\s*:\s*([\d.]+)%/i,
    lines: /Lines\s*:\s*([\d.]+)%/i,
    functions: /Functions\s*:\s*([\d.]+)%/i,
    statements: /Statements\s*:\s*([\d.]+)%/i,
  };
  for (const [key, pat] of Object.entries(patterns)) {
    const m = output.match(pat);
    if (m) metrics[key] = parseFloat(m[1]);
  }
  return Object.keys(metrics).length > 0 ? metrics : null;
}

function copyDir(src, dest) {
  try {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        copyDir(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  } catch (_) {}
}

function updateIndex(entry) {
  let index = [];
  try {
    if (fs.existsSync(REGRESSION_INDEX)) {
      index = JSON.parse(fs.readFileSync(REGRESSION_INDEX, 'utf-8'));
    }
  } catch (_) {}

  index.unshift(entry);
  if (index.length > 50) index = index.slice(0, 50);

  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }
  fs.writeFileSync(REGRESSION_INDEX, JSON.stringify(index, null, 2));
}

function list() {
  try {
    return JSON.parse(fs.readFileSync(REGRESSION_INDEX, 'utf-8'));
  } catch (_) {
    return [];
  }
}

function compare({ id1, id2 } = {}) {
  const index = list();
  const entry1 = id1 ? index.find(e => e.id === id1) : index[0];
  const entry2 = id2 ? index.find(e => e.id === id2) : index[1];

  if (!entry1 || !entry2) {
    return { error: '需要两次有效的回归记录才能比较' };
  }

  return {
    baseline: entry1,
    current: entry2,
    delta: entry1.pass !== entry2.pass ? '状态变化' : '状态相同',
    older: entry1.timestamp,
    newer: entry2.timestamp,
  };
}

// ─── Main ───

function main() {
  const args = process.argv.slice(2);
  const opts = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--quick': opts.mode = 'quick'; break;
      case '--unit-only': opts.unitOnly = true; break;
      case '--e2e-only': opts.e2eOnly = true; break;
      case '--report-only': opts.reportOnly = true; break;
      case '--list': opts.cmd = 'list'; break;
      case '--compare': opts.cmd = 'compare'; opts.ids = [args[++i], args[++i]]; break;
      case '--json': opts.json = true; break;
      case '--task': opts.taskName = args[++i]; break;
      case '--help': opts.cmd = 'help'; break;
    }
  }

  const cwd = ROOT;

  switch (opts.cmd) {
    case 'list': {
      const items = list();
      if (opts.json) {
        console.log(JSON.stringify(items, null, 2));
      } else {
        console.log('回归记录:');
        for (const item of items.slice(0, 10)) {
          console.log(`  ${item.id} — ${item.pass ? '✅' : '❌'} — ${item.timestamp}`);
        }
        if (items.length > 10) console.log(`  ... 共 ${items.length} 条记录`);
      }
      break;
    }
    case 'compare': {
      const result = compare({ id1: opts.ids?.[0], id2: opts.ids?.[1] });
      console.log(opts.json ? JSON.stringify(result, null, 2) : JSON.stringify(result, null, 2));
      break;
    }
    case 'help': {
      console.log('hammer-regression — 一键回归命令');
      console.log('  默认: 完整回归 (DB reset → seed → test → coverage → report)');
      console.log('  --quick      快速回归 (跳过 seed)');
      console.log('  --unit-only  仅单元测试');
      console.log('  --e2e-only   仅 E2E 测试');
      console.log('  --list       列出历史回归记录');
      console.log('  --compare <id1> <id2>  比较两次回归');
      console.log('  --json       JSON 格式输出');
      console.log('  --task <名>  任务名称（用于报告标题）');
      break;
    }
    default: {
      const mode = opts.mode || 'full';
      let result;

      if (mode === 'quick') {
        result = quick({ cwd, taskName: opts.taskName });
      } else {
        result = full({ cwd, taskName: opts.taskName });
      }

      if (opts.json) {
        console.log(JSON.stringify({ pass: result.pass, archiveDir: result.archiveDir, id: result.id }, null, 2));
      } else {
        console.log(`\n${result.report}`);
      }
      process.exit(result.pass ? 0 : 1);
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = { full, quick, list, compare, detectProjectType, resetDatabase, seedDatabase, runTests, generateReport };
