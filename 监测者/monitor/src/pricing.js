// DeepSeek V4 官方定价（元/百万Token，默认值，会被 fetchOfficialPrices 覆盖）
let MODEL_PRICES = {
  'deepseek-v4-flash': { input: 1, output: 2, cache_read: 0.02 },
  'deepseek-v4-pro':   { input: 3, output: 6, cache_read: 0.025 },
};

// 各模型最大上下文窗口（用于计算上下文窗口占比）
const MODEL_MAX_CONTEXT = {
  'deepseek-v4-flash': 1_000_000,
  'deepseek-v4-pro': 1_000_000,
  'minimax-2.7': 200_000,
};

const MODEL_ALIASES = {
  'pro':   'deepseek-v4-pro',
  'flash': 'deepseek-v4-flash',
  'deepseek-v4-pro': 'deepseek-v4-pro',
  'deepseek-v4-flash': 'deepseek-v4-flash',
  // Third-party models with unknown pricing — map to Flash as conservative default
  'MiniMax-M2.7': 'deepseek-v4-flash',
};

let _lastFetchTime = null;
let _lastFetchError = null;
let _fetchInProgress = false;

const RETRY_OK_MS = 24 * 60 * 60 * 1000;   // re-fetch every 24h on success
const RETRY_FAIL_MS = 60 * 60 * 1000;       // retry every 1h on failure

/**
 * 从 DeepSeek 官方定价页面获取最新价格
 * https://api-docs.deepseek.com/zh-cn/quick_start/pricing
 *
 * 页面含表格，匹配 "DeepSeek-V4-Flash" / "DeepSeek-V4-Pro" 行中的价格数字
 */
async function fetchOfficialPrices() {
  if (_fetchInProgress) return;

  const now = Date.now();
  if (_lastFetchTime) {
    const lastMs = new Date(_lastFetchTime).getTime();
    const interval = _lastFetchError ? RETRY_FAIL_MS : RETRY_OK_MS;
    if (now - lastMs < interval) return;
  }

  _fetchInProgress = true;

  try {
    const http = require('https');
    const url = 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing';

    const html = await new Promise((resolve, reject) => {
      http.get(url, { timeout: 8000 }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      }).on('error', reject).on('timeout', function() { this.destroy(); reject(new Error('timeout')); });
    });

    // Parse prices from HTML tables
    const flashMatch = html.match(/deepseek[-\s]*v4[-\s]*flash[^<]*?([\d.]+)\s*元[^<]*?([\d.]+)\s*元[^<]*?([\d.]+)\s*元/i);
    const proMatch = html.match(/deepseek[-\s]*v4[-\s]*pro[^<]*?([\d.]+)\s*元[^<]*?([\d.]+)\s*元[^<]*?([\d.]+)\s*元/i);

    let updated = false;

    if (flashMatch) {
      MODEL_PRICES['deepseek-v4-flash'] = {
        cache_read: parseFloat(flashMatch[1]),
        input: parseFloat(flashMatch[2]),
        output: parseFloat(flashMatch[3]),
      };
      updated = true;
    }

    if (proMatch) {
      MODEL_PRICES['deepseek-v4-pro'] = {
        cache_read: parseFloat(proMatch[1]),
        input: parseFloat(proMatch[2]),
        output: parseFloat(proMatch[3]),
      };
      updated = true;
    }

    if (updated) {
      _lastFetchTime = new Date().toISOString();
      _lastFetchError = null;
      console.log(`[pricing] Fetched official prices from deepseek.com`);
      console.log(`[pricing]   flash: input=${MODEL_PRICES['deepseek-v4-flash'].input}  cache=${MODEL_PRICES['deepseek-v4-flash'].cache_read}  output=${MODEL_PRICES['deepseek-v4-flash'].output}`);
      console.log(`[pricing]   pro:   input=${MODEL_PRICES['deepseek-v4-pro'].input}  cache=${MODEL_PRICES['deepseek-v4-pro'].cache_read}  output=${MODEL_PRICES['deepseek-v4-pro'].output}`);
    } else {
      _lastFetchError = 'Could not parse prices from official page';
      _lastFetchTime = new Date().toISOString();
      console.log(`[pricing] ${_lastFetchError}, using defaults`);
    }
  } catch (err) {
    _lastFetchError = err.message;
    _lastFetchTime = new Date().toISOString();
    console.log(`[pricing] Fetch failed (${err.message}), using default prices`);
  } finally {
    _fetchInProgress = false;
  }
}

function getModelPrice(model) {
  const resolved = MODEL_ALIASES[model] || model;
  return MODEL_PRICES[resolved] || null;
}

/**
 * 计算 Token 成本
 *
 * DeepSeek 格式中：
 *   tokensIn  = 本次新增的未缓存 token（全价）
 *   cacheHit  = 命中缓存的 token（缓存价）
 *   总输入 token = tokensIn + cacheHit
 */
function calcCost(model, tokensIn, tokensOut, cacheHit) {
  const p = getModelPrice(model);
  if (!p) {
    console.warn(`[pricing] unknown model: "${model}"`);
    return null;
  }
  const uncachedIn = Math.max(0, tokensIn || 0);
  const cachedIn = Math.max(0, cacheHit || 0);
  const inputCost  = (uncachedIn / 1_000_000) * p.input;
  const cacheCost  = (cachedIn / 1_000_000) * p.cache_read;
  const outputCost = (Math.max(0, tokensOut || 0) / 1_000_000) * p.output;
  return {
    input_cost:  inputCost,
    cache_cost:  cacheCost,
    output_cost: outputCost,
    total_cost:  inputCost + cacheCost + outputCost,
    total_input_tokens: uncachedIn + cachedIn,
    uncached_tokens: uncachedIn,
    cached_tokens: cachedIn,
  };
}

/**
 * 计算基线成本 — 全部按 Pro 全价（非折扣价）计算
 */
function calcBaselineCost(tokensIn, tokensOut, cacheHit) {
  // 基线 = DeepSeek V4 Pro 价格（人手动会选 Pro，自动路由切 Flash 才是节省）
  const p = { input: 3, output: 6, cache_read: 0.025 };
  const uncachedIn = Math.max(0, tokensIn || 0);
  const cachedIn = Math.max(0, cacheHit || 0);
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

/**
 * Token 节省技能配置
 *
 * 每个节流技能登记其节省类型和保守估算因子：
 *   affects: 'input' | 'output' | 'fixed_input' | 'fixed_output'
 *   factor: 实际Token / 反事实Token（越小越能省）
 *   tokens_per_event: 固定节省技能的每事件Token数
 *
 * 因子取保守值（下限），避免高估节省。
 * 来源: 省token原理汇总表.md
 */
const SKILL_SAVING_CONFIG = {
  'lean-ctx':               { affects: 'input',  factor: 0.10, desc: 'CLI/文件输出压缩 (90%节省)' },
  'kf-code-review-graph':   { affects: 'input',  factor: 0.50, desc: '依赖图谱替代全量扫描 (50%节省)' },
  'lambda-lang':            { affects: 'output', factor: 0.50, desc: '原子协议替代自然语言 (50%输出节省)' },
  'claude-code-pro':        { affects: 'fixed_output', tokens_per_event: 15000, desc: '跳过不必要的Agent spawn (15K tok/spawn)' },
  'kf-langextract':         { affects: 'output', factor: 0.80, desc: '结构化提取 (20%输出节省)' },
  'kf-doc-consistency':     { affects: 'input',  factor: 0.85, desc: '文档同步减少排查 (15%输入节省)' },
  'claude-mem':             { affects: 'fixed_input',  tokens_per_event: 200, desc: '跨会话记忆复用 (200 tok/次)' },
};

classifySavingSkills.$config = SKILL_SAVING_CONFIG;

/**
 * 过滤并分类活跃的节流技能
 * @param {string[]} skillNames
 * @returns {{ inputSkills: string[], outputSkills: string[], fixedInputTokens: number, fixedOutputTokens: number, activeNames: string[] }}
 */
function classifySavingSkills(skillNames) {
  const inputSkills = [];
  const outputSkills = [];
  let fixedInputTokens = 0;
  let fixedOutputTokens = 0;
  const activeNames = [];

  for (const name of (skillNames || [])) {
    const cfg = SKILL_SAVING_CONFIG[name];
    if (!cfg) continue;
    activeNames.push(name);
    switch (cfg.affects) {
      case 'input':
        inputSkills.push(name);
        break;
      case 'output':
        outputSkills.push(name);
        break;
      case 'fixed_input':
        fixedInputTokens += cfg.tokens_per_event || 0;
        break;
      case 'fixed_output':
        fixedOutputTokens += cfg.tokens_per_event || 0;
        break;
    }
  }
  return { inputSkills, outputSkills, fixedInputTokens, fixedOutputTokens, activeNames };
}

/**
 * 计算技能基线（反事实成本）
 *
 * 回答：如果没有节流技能，这段对话在相同模型下会花多少钱？
 *
 * 算法：
 *   反事实输入 = 实际未缓存输入 / minInputFactor + fixedInputTokens
 *   反事实输出 = 实际输出 / minOutputFactor + fixedOutputTokens
 *   （取最小 factor 避免重叠技能双计）
 *   然后用 calcCost 以实际模型定价计算反事实成本
 *
 * @param {string} model - 实际使用的模型
 * @param {number} tokensIn - 实际未缓存输入 Token
 * @param {number} tokensOut - 实际输出 Token
 * @param {number} cacheHit - 实际缓存命中 Token
 * @param {string[]} activeSkillNames - 活跃的节流技能名列表
 * @returns {{ input_cost, output_cost, cache_cost, total_cost, input_tokens, output_tokens, skills_active: string }}
 */
function calcSkillBaseline(model, tokensIn, tokensOut, cacheHit, activeSkillNames) {
  const classified = classifySavingSkills(activeSkillNames);
  const uncachedIn = Math.max(0, tokensIn || 0);
  const outTokens = Math.max(0, tokensOut || 0);
  const cachedIn = Math.max(0, cacheHit || 0);

  // 计算反事实输入 Token
  let cfInput = uncachedIn;
  if (classified.inputSkills.length > 0) {
    const minFactor = Math.min(...classified.inputSkills.map(s => SKILL_SAVING_CONFIG[s].factor));
    cfInput = uncachedIn / minFactor;
  }
  cfInput += classified.fixedInputTokens;

  // 计算反事实输出 Token
  let cfOutput = outTokens;
  if (classified.outputSkills.length > 0) {
    const minFactor = Math.min(...classified.outputSkills.map(s => SKILL_SAVING_CONFIG[s].factor));
    cfOutput = outTokens / minFactor;
  }
  cfOutput += classified.fixedOutputTokens;

  // 用实际模型定价计算反事实成本
  const p = getModelPrice(model);
  if (!p) {
    console.warn(`[pricing] unknown model for skill baseline: "${model}"`);
    return null;
  }

  const inputCost = (cfInput / 1_000_000) * p.input;
  const cacheCost = (cachedIn / 1_000_000) * p.cache_read;
  const outputCost = (cfOutput / 1_000_000) * p.output;

  return {
    input_cost: inputCost,
    cache_cost: cacheCost,
    output_cost: outputCost,
    total_cost: inputCost + cacheCost + outputCost,
    input_tokens: Math.round(cfInput),
    output_tokens: Math.round(cfOutput),
    skills_active: classified.activeNames.join(',') || null,
  };
}

function getPricingInfo() {
  return {
    prices: MODEL_PRICES,
    lastFetch: _lastFetchTime,
    lastFetchError: _lastFetchError || null,
    usingDefaults: !_lastFetchTime || !!_lastFetchError,
    note: _lastFetchError
      ? `Using default prices (fetch failed: ${_lastFetchError})`
      : 'Prices fetched from api-docs.deepseek.com',
  };
}

/**
 * 计算上下文窗口占比（%）
 * @param {string} model - 模型 ID
 * @param {number} inputTokens - 未缓存输入 token 数
 * @param {number} cacheHit - 缓存命中 token 数
 * @returns {number|null} 百分比值（0-100），未知模型返回 null
 */
function calcContextWindowPct(model, inputTokens, cacheHit) {
  const maxCtx = MODEL_MAX_CONTEXT[model] || MODEL_MAX_CONTEXT[MODEL_ALIASES[model]];
  if (!maxCtx || maxCtx <= 0) return null;
  const total = (inputTokens || 0) + (cacheHit || 0);
  return parseFloat(((total / maxCtx) * 100).toFixed(2));
}

module.exports = {
  MODEL_PRICES, MODEL_ALIASES, MODEL_MAX_CONTEXT,
  calcCost, calcBaselineCost, calcSkillBaseline,
  classifySavingSkills, SKILL_SAVING_CONFIG,
  fetchOfficialPrices, getModelPrice, getPricingInfo,
  calcContextWindowPct,
};
