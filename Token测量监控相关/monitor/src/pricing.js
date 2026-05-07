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
  'deepseek-v4-pro': 'deepseek-v4-pro',
  'deepseek-v4-flash': 'deepseek-v4-flash',
};

/**
 * 计算 Token 成本
 *
 * Anthropic/DeepSeek 格式中：
 *   tokensIn  = 本次新增的未缓存 token（全价）
 *   cacheHit  = 命中缓存的 token（缓存价）
 *   总输入 token = tokensIn + cacheHit
 *
 * 两者是相加关系，不是包含关系。
 */
function calcCost(model, tokensIn, tokensOut, cacheHit) {
  const resolved = MODEL_ALIASES[model] || model;
  const p = MODEL_PRICES[resolved];
  if (!p) {
    console.warn(`[pricing] unknown model: "${model}" (resolved: "${resolved}")`);
    return null;
  }
  const uncachedIn = tokensIn || 0;
  const cachedIn = cacheHit || 0;
  const totalInput = uncachedIn + cachedIn;
  const inputCost  = (uncachedIn / 1_000_000) * p.input;
  const cacheCost  = (cachedIn / 1_000_000) * p.cache_read;
  const outputCost = (tokensOut / 1_000_000) * p.output;
  return {
    input_cost:  inputCost,
    cache_cost:  cacheCost,
    output_cost: outputCost,
    total_cost:  inputCost + cacheCost + outputCost,
    total_input_tokens: totalInput,  // 总输入 token（未缓存+缓存）
    uncached_tokens: uncachedIn,
    cached_tokens: cachedIn,
  };
}

module.exports = { MODEL_PRICES, MODEL_ALIASES, calcCost };
