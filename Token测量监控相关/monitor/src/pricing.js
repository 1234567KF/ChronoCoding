// DeepSeek V4 官方定价（元/百万Token，2026年5月）
// V4-Pro 叠加 2.5 折限时特惠（至 2026/05/31）
const MODEL_PRICES = {
  'deepseek-v4-flash': { input: 1, output: 2, cache_read: 0.02 },
  'deepseek-v4-pro':   { input: 3, output: 6, cache_read: 0.025 },
};

// 兼容短名 ↔ 全名映射（旧 trace 可能存的是 "pro"/"flash"）
const MODEL_ALIASES = {
  'pro':   'deepseek-v4-pro',
  'flash': 'deepseek-v4-flash',
};

function calcCost(model, tokensIn, tokensOut, cacheHit) {
  const resolved = MODEL_ALIASES[model] || model;
  const p = MODEL_PRICES[resolved];
  if (!p) return null;
  const cachedIn = Math.min(cacheHit || 0, tokensIn);
  const uncachedIn = Math.max(0, tokensIn - cachedIn);
  const inputCost  = (uncachedIn / 1_000_000) * p.input;
  const cacheCost  = (cachedIn / 1_000_000) * p.cache_read;
  const outputCost = (tokensOut / 1_000_000) * p.output;
  return {
    input_cost:  inputCost,
    cache_cost:  cacheCost,
    output_cost: outputCost,
    total_cost:  inputCost + cacheCost + outputCost,
  };
}

module.exports = { MODEL_PRICES, MODEL_ALIASES, calcCost };
