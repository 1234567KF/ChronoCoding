#!/usr/bin/env node
/**
 * run-all-tests.js — 监测者全量测试运行器
 *
 * 运行: node test/run-all-tests.js
 * 依次执行: pricing.test.js → integration.test.js
 */
const path = require('path');
const { spawnSync } = require('child_process');

const testDir = __dirname;
const suites = [
  { name: 'Pricing Unit Tests', file: 'pricing.test.js' },
  { name: 'Integration Tests', file: 'integration.test.js' },
];

let totalPassed = 0, totalFailed = 0;

console.log('╔══════════════════════════════════════╗');
console.log('║   监测者 Monitor — Full Test Suite   ║');
console.log('╚══════════════════════════════════════╝\n');

for (const suite of suites) {
  console.log(`\n━━━ ${suite.name} ━━━`);
  const result = spawnSync('node', [path.join(testDir, suite.file)], {
    cwd: path.join(testDir, '..'),
    encoding: 'utf-8',
    timeout: 60_000,
  });

  process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.status === 0) {
    const match = result.stdout.match(/(\d+)\/(\d+) passed/);
    if (match) {
      totalPassed += parseInt(match[1]);
    }
  } else {
    totalFailed++;
    console.log(`  SUITE FAILED (exit ${result.status})`);
  }
}

console.log(`\n═══════════════════════════════════════`);
console.log(`  Total: ${totalPassed} tests passed`);
if (totalFailed > 0) {
  console.log(`  ${totalFailed} suites failed`);
  process.exit(1);
} else {
  console.log(`  All test suites passed!`);
}
console.log(`═══════════════════════════════════════\n`);
