/**
 * pricing.test.js — 定价计算全量测试
 *
 * 运行: node test/pricing.test.js
 */
const path = require('path');
const { calcCost, calcBaselineCost, MODEL_PRICES } = require('../src/pricing');

let passed = 0, failed = 0, tests = 0;

function test(name, fn) {
  tests++;
  try {
    fn();
    passed++;
  } catch (e) {
    failed++;
    console.log(`  FAIL #${tests} ${name}: ${e.message}`);
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function assertNear(actual, expected, tolerance, msg) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${msg || 'value mismatch'}: expected ${expected}, got ${actual}`);
  }
}

console.log('\n=== Pricing Tests ===\n');

// ── calcCost: Flash model ──
test('Flash: zero tokens → zero cost', () => {
  const c = calcCost('deepseek-v4-flash', 0, 0, 0);
  assert(c.total_cost === 0, 'total should be 0');
  assert(c.input_cost === 0, 'input should be 0');
  assert(c.output_cost === 0, 'output should be 0');
  assert(c.cache_cost === 0, 'cache should be 0');
});

test('Flash: 1M input tokens = ¥1.00', () => {
  const c = calcCost('deepseek-v4-flash', 1_000_000, 0, 0);
  assertNear(c.input_cost, 1.0, 0.001, '1M input should cost ¥1');
  assertNear(c.total_cost, 1.0, 0.001);
});

test('Flash: 1M output tokens = ¥2.00', () => {
  const c = calcCost('deepseek-v4-flash', 0, 1_000_000, 0);
  assertNear(c.output_cost, 2.0, 0.001, '1M output should cost ¥2');
});

test('Flash: 1M cache tokens = ¥0.02', () => {
  const c = calcCost('deepseek-v4-flash', 0, 0, 1_000_000);
  assertNear(c.cache_cost, 0.02, 0.001, '1M cache should cost ¥0.02');
});

test('Flash: mixed tokens — total = sum of parts', () => {
  const c = calcCost('deepseek-v4-flash', 500_000, 200_000, 1_000_000);
  const expectedTotal = c.input_cost + c.cache_cost + c.output_cost;
  assertNear(c.total_cost, expectedTotal, 0.0001, 'total should equal sum of input+cache+output');
  assertNear(c.input_cost, 0.50, 0.01);
  assertNear(c.cache_cost, 0.02, 0.001);
  assertNear(c.output_cost, 0.40, 0.01);
});

// ── calcCost: Pro model ──
test('Pro: 1M input tokens = ¥3.00', () => {
  const c = calcCost('deepseek-v4-pro', 1_000_000, 0, 0);
  assertNear(c.input_cost, 3.0, 0.001);
});

test('Pro: 1M output tokens = ¥6.00', () => {
  const c = calcCost('deepseek-v4-pro', 0, 1_000_000, 0);
  assertNear(c.output_cost, 6.0, 0.001);
});

test('Pro: 1M cache tokens = ¥0.025', () => {
  const c = calcCost('deepseek-v4-pro', 0, 0, 1_000_000);
  assertNear(c.cache_cost, 0.025, 0.001);
});

test('Pro with alias "pro": works', () => {
  const c = calcCost('pro', 1_000_000, 0, 0);
  assertNear(c.input_cost, 3.0, 0.001);
});

// ── calcBaselineCost ──
test('Baseline: always uses Pro pricing', () => {
  const b = calcBaselineCost(1_000_000, 1_000_000, 1_000_000);
  assertNear(b.input_cost, 3.0, 0.001, 'baseline input');
  assertNear(b.output_cost, 6.0, 0.001, 'baseline output');
  assertNear(b.cache_cost, 0.025, 0.001, 'baseline cache');
  assertNear(b.total_cost, 9.025, 0.001, 'baseline total');
});

test('Baseline: zero tokens → zero cost', () => {
  const b = calcBaselineCost(0, 0, 0);
  assert(b.total_cost === 0);
});

// ── Edge cases ──
test('null/undefined model returns null', () => {
  const c = calcCost(null, 1000, 1000, 0);
  assert(c === null, 'null model should return null cost');
});

test('negative tokens treated as 0', () => {
  const c = calcCost('deepseek-v4-flash', -500, -500, -500);
  assert(c.total_cost >= 0, 'cost should not be negative');
});

test('very large token counts do not overflow', () => {
  const c = calcCost('deepseek-v4-pro', 1_000_000_000, 1_000_000_000, 1_000_000_000);
  assert(Number.isFinite(c.total_cost), 'cost should be finite');
  assert(c.total_cost > 0, 'cost should be positive');
});

// ── Cost component consistency ──
test('cache_cost NEVER included in input_cost', () => {
  // Verify cache is a separate component
  const c = calcCost('deepseek-v4-pro', 0, 0, 1_000_000);
  assert(c.input_cost === 0, 'input_cost should be 0 when tokensIn=0');
  assert(c.cache_cost > 0, 'cache_cost should be > 0 when cacheHit>0');
});

test('total_cost = input_cost + output_cost + cache_cost (always)', () => {
  const combos = [
    [0, 0, 0], [1000, 0, 0], [0, 1000, 0], [0, 0, 1000],
    [12345, 6789, 5432], [1000000, 500000, 2000000],
  ];
  for (const [tIn, tOut, cache] of combos) {
    const c = calcCost('deepseek-v4-pro', tIn, tOut, cache);
    const sum = c.input_cost + c.output_cost + c.cache_cost;
    assertNear(c.total_cost, sum, 0.000001,
      `total should = input+output+cache for (${tIn},${tOut},${cache}): ${c.total_cost} vs ${sum}`);
  }
});

console.log(`\n${passed}/${tests} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
