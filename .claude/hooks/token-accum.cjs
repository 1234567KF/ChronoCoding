#!/usr/bin/env node
/**
 * token-accum — 从 transcript 文件读取 token 用量
 *
 * PostToolUse hook: 保存 transcript 路径
 * SessionEnd: 读取 transcript 统计 token 总量
 *
 * Usage:
 *   node token-accum.cjs record   # PostToolUse: 从 stdin 保存 transcript_path
 *   node token-accum.cjs sum      # 读取 transcript 并输出 token 总量 JSON
 *   node token-accum.cjs clear    # 清空路径缓存
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const PATH_CACHE = path.join(PROJECT_ROOT, '.claude-flow', 'data', 'transcript-path.json');
const MONITOR_URL = process.env.MONITOR_URL || 'http://localhost:3456';

// DeepSeek V4 官方定价（元/百万Token）
const MODEL_PRICES = {
  'deepseek-v4-flash': { input: 1, output: 2, cache_read: 0.02 },
  'deepseek-v4-pro':   { input: 3, output: 6, cache_read: 0.025 },
};
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

// ── Stdin read (with timeout) ──
function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve('');
    let data = '';
    const timer = setTimeout(() => {
      process.stdin.removeAllListeners();
      process.stdin.pause();
      resolve(data);
    }, 500);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => { clearTimeout(timer); resolve(data); });
    process.stdin.on('error', () => { clearTimeout(timer); resolve(data); });
    process.stdin.resume();
  });
}

// ── Read cumulative token totals from transcript ──
function readTokenTotals(transcriptPath) {
  if (!fs.existsSync(transcriptPath)) return null;
  try {
    const content = fs.readFileSync(transcriptPath, 'utf-8');
    let totalIn = 0, totalOut = 0, totalCache = 0, count = 0;
    let model = null;
    for (const line of content.split('\n').filter(Boolean)) {
      try {
        const entry = JSON.parse(line);
        const u = entry.message?.usage;
        if (u) {
          totalIn += u.input_tokens || 0;
          totalOut += u.output_tokens || 0;
          totalCache += u.cache_read_input_tokens || 0;
          count++;
          if (!model && entry.message?.model) model = entry.message.model;
        }
      } catch {}
    }
    const cost = model ? calcCost(model, totalIn, totalOut, totalCache) : null;
    return { totalIn, totalOut, totalCache, count, model, cost };
  } catch { return null; }
}

// ── Push token totals + activity message to monitor ──
async function pushToMonitor(sessionId, totals, isNewMessage) {
  try {
    const health = await fetch(`${MONITOR_URL}/api/health`);
    if (!health.ok) return;
  } catch { return; }

  const now = new Date().toISOString();
  const cost = totals.cost;

  // 1. Add an activity message (0-token, for the detail log timeline)
  if (isNewMessage) {
    try {
      await fetch(`${MONITOR_URL}/api/records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          title: '',
          model: totals.model || 'unknown',
          messages: [{
            role: 'assistant',
            content: `${(totals.totalIn / 1000).toFixed(0)}K in / ${(totals.totalOut / 1000).toFixed(0)}K out | 缓存${(totals.totalCache / 1000).toFixed(0)}K`,
            input_tokens: 0,
            output_tokens: 0,
            cache_hit: 0,
            created_at: now,
          }],
          skillCalls: [],
        }),
      });
    } catch {}
  }

  // 2. PATCH cumulative totals (SET absolute values, overrides POST's ADD)
  try {
    await fetch(`${MONITOR_URL}/api/conversations/${encodeURIComponent(sessionId)}/tokens`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        total_input_tokens: totals.totalIn,
        total_output_tokens: totals.totalOut,
        total_cost: cost ? cost.total_cost : 0,
        ended_at: now,
      }),
    });
  } catch {}
}

// ── record: PostToolUse — 保存 transcript_path + 推送 token ──
async function cmdRecord() {
  const raw = await readStdin();
  if (!raw.trim()) process.exit(0);
  let input;
  try { input = JSON.parse(raw); } catch { process.exit(0); }

  const transcriptPath = input.transcript_path;
  if (!transcriptPath || !fs.existsSync(transcriptPath)) process.exit(0);

  const dir = path.dirname(PATH_CACHE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // Read previous cache to detect changes
  let prevTokens = null;
  if (fs.existsSync(PATH_CACHE)) {
    try {
      const prev = JSON.parse(fs.readFileSync(PATH_CACHE, 'utf-8'));
      prevTokens = prev.last_tokens;
    } catch {}
  }

  // Read cumulative tokens from transcript
  const totals = readTokenTotals(transcriptPath);
  const sessionId = input.session_id || '';

  if (totals && sessionId && totals.count > 0) {
    // Only add a message when tokens changed by >500
    const deltaIn = prevTokens ? Math.abs(totals.totalIn - prevTokens.in) : Infinity;
    const isNewMessage = deltaIn > 500;

    await pushToMonitor(sessionId, totals, isNewMessage);
  }

  fs.writeFileSync(PATH_CACHE, JSON.stringify({
    transcript_path: transcriptPath,
    session_id: sessionId,
    updated_at: new Date().toISOString(),
    last_tokens: totals ? { in: totals.totalIn, out: totals.totalOut, cache: totals.totalCache, cost: totals.cost?.total_cost || 0 } : null,
  }));

  process.exit(0);
}

// ── sum: 读取 transcript，统计 token ──
function cmdSum() {
  // 读取缓存的 transcript 路径
  let transcriptPath = '';
  let sessionId = '';
  if (fs.existsSync(PATH_CACHE)) {
    try {
      const cached = JSON.parse(fs.readFileSync(PATH_CACHE, 'utf-8'));
      transcriptPath = cached.transcript_path || '';
      sessionId = cached.session_id || '';
    } catch {}
  }

  if (!transcriptPath || !fs.existsSync(transcriptPath)) {
    console.log(JSON.stringify({
      tokens_in: 0, tokens_out: 0, cache_read: 0,
      messages_found: 0, session_id: sessionId,
    }));
    process.exit(0);
  }

  try {
    const content = fs.readFileSync(transcriptPath, 'utf-8');
    const lines = content.split('\n').filter(Boolean);

    let totalIn = 0, totalOut = 0, totalCacheRead = 0, count = 0;
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        const u = entry.message?.usage;
        if (u) {
          totalIn += u.input_tokens || 0;
          totalOut += u.output_tokens || 0;
          totalCacheRead += u.cache_read_input_tokens || 0;
          count++;
        }
      } catch {}
    }

    console.log(JSON.stringify({
      tokens_in: totalIn,
      tokens_out: totalOut,
      cache_read: totalCacheRead,
      messages_found: count,
      session_id: sessionId,
    }));
  } catch (e) {
    console.log(JSON.stringify({
      tokens_in: 0, tokens_out: 0, cache_read: 0,
      error: e.message, messages_found: 0, session_id: sessionId,
    }));
  }
  process.exit(0);
}

// ── clear: 清空路径缓存 ──
function cmdClear() {
  try { if (fs.existsSync(PATH_CACHE)) fs.unlinkSync(PATH_CACHE); } catch {}
  process.exit(0);
}

// ── Main ──
const cmd = process.argv[2];
process.exitCode = 0;

(async () => {
  switch (cmd) {
    case 'record': await cmdRecord(); break;
    case 'sum': cmdSum(); break;
    case 'clear': cmdClear(); break;
  }
})().catch(() => {}).finally(() => process.exit(0));
