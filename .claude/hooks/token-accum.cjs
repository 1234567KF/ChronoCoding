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
  'deepseek-v4-pro': 'deepseek-v4-pro',
  'deepseek-v4-flash': 'deepseek-v4-flash',
};

/**
 * 计算 Token 成本 — Anthropic/DeepSeek 格式:
 *   tokensIn  = 本次新增的未缓存 token（全价）
 *   cacheHit  = 命中缓存的 token（缓存价）
 *   两者是相加关系，不是包含关系。
 */
// 基线 = DeepSeek V4 Pro 价格（人手动会选 Pro，自动路由切 Flash 才是节省）
const BASELINE_PRICES = { input: 3, output: 6, cache_read: 0.025 };

function calcCost(model, tokensIn, tokensOut, cacheHit) {
  const resolved = MODEL_ALIASES[model] || model;
  const p = MODEL_PRICES[resolved];
  if (!p) return null;
  const uncachedIn = tokensIn || 0;
  const cachedIn = cacheHit || 0;
  const inputCost  = (uncachedIn / 1_000_000) * p.input;
  const cacheCost  = (cachedIn / 1_000_000) * p.cache_read;
  const outputCost = (tokensOut / 1_000_000) * p.output;
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

function calcBaselineCost(tokensIn, tokensOut, cacheHit) {
  const uncachedIn = tokensIn || 0;
  const cachedIn = cacheHit || 0;
  const inputCost  = (uncachedIn / 1_000_000) * BASELINE_PRICES.input;
  const cacheCost  = (cachedIn / 1_000_000) * BASELINE_PRICES.cache_read;
  const outputCost = (tokensOut / 1_000_000) * BASELINE_PRICES.output;
  return inputCost + cacheCost + outputCost;
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
    let totalCost = 0, totalBaselineCost = 0;
    let model = 'deepseek-v4-flash';
    const seen = new Set(); // Dedup: transcript has 2-8x duplicates per API call
    for (const line of content.split('\n').filter(Boolean)) {
      try {
        const entry = JSON.parse(line);
        const u = entry.message?.usage;
        if (u) {
          const m = entry.message?.model || model;
          if (m) model = m;
          // Dedup by (model, input, output, cache) signature
          const sig = m + ':' + (u.input_tokens || 0) + ':' + (u.output_tokens || 0) + ':' + (u.cache_read_input_tokens || 0);
          if (seen.has(sig)) continue;
          seen.add(sig);
          totalIn += u.input_tokens || 0;
          totalOut += u.output_tokens || 0;
          totalCache += u.cache_read_input_tokens || 0;
          const c = calcCost(m, u.input_tokens || 0, u.output_tokens || 0, u.cache_read_input_tokens || 0);
          if (c) totalCost += c.total_cost;
          totalBaselineCost += calcBaselineCost(u.input_tokens || 0, u.output_tokens || 0, u.cache_read_input_tokens || 0);
          count++;
        }
      } catch {}
    }
    return { totalIn, totalOut, totalCache, count, model, cost: { total_cost: totalCost }, baselineCost: totalBaselineCost };
  } catch { return null; }
}

// ── Push token totals + activity message to monitor ──
async function pushToMonitor(sessionId, totals, isNewMessage, prevTokens) {
  try {
    const health = await fetch(`${MONITOR_URL}/api/health`);
    if (!health.ok) return;
  } catch { return; }

  const now = new Date().toISOString();
  const cost = totals.cost;

  // 总输入 = 未缓存 token + 缓存命中 token（两者是相加关系，不是包含关系）
  const totalInputAll = totals.totalIn + totals.totalCache;

  // 不再 POST 汇总消息（曾导致重复计数）。
  // 明细消息由 pushNewMessages 从 transcript 逐条推送，更准确。
  // 本函数仅负责 PATCH 累计汇总值（绝对覆盖）。

  // 2. PATCH cumulative totals (SET absolute values)
  try {
    await fetch(`${MONITOR_URL}/api/conversations/${encodeURIComponent(sessionId)}/tokens`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        total_input_tokens: totalInputAll,
        total_output_tokens: totals.totalOut,
        total_cost: cost ? cost.total_cost : 0,
        total_baseline_cost: totals.baselineCost || 0,
        ended_at: now,
      }),
    });
  } catch {}
}

// ── Resolve session/transcript from stdin OR disk cache (Windows stdin fallback) ──
function resolveFromCache() {
  if (!fs.existsSync(PATH_CACHE)) return null;
  try {
    const cached = JSON.parse(fs.readFileSync(PATH_CACHE, 'utf-8'));
    const tp = cached.transcript_path;
    if (tp && fs.existsSync(tp)) {
      return {
        transcriptPath: tp,
        sessionId: cached.session_id || '',
        prevTokens: cached.last_tokens || null,
      };
    }
  } catch {}
  return null;
}

function resolveSessionId() {
  // Try session-state.json (written by monitor-session.cjs start)
  const statePath = path.join(PROJECT_ROOT, '.claude-flow', 'data', 'session-state.json');
  if (fs.existsSync(statePath)) {
    try {
      const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
      if (state.sessionId) return state.sessionId;
    } catch {}
  }
  // Fallback: try env vars
  return process.env.CLAUDE_SESSION_ID || process.env.CLAUDE_FLOW_SESSION_ID || '';
}

function resolveTranscriptPath(sessionId) {
  // Infer from known Claude Code transcript location
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const projectName = path.basename(PROJECT_ROOT);
  const inferred = path.join(home, '.claude', 'projects', `D--${projectName}`, `${sessionId}.jsonl`);
  if (fs.existsSync(inferred)) return inferred;
  return null;
}

// ── Push new transcript messages (user+assistant) to monitor ──
// System messages to skip (carry cumulative session totals, not per-message usage)
const SYSTEM_MSGS = new Set(['会话开始', '会话结束', '会话继续', '会话重启', '会话恢复']);

/**
 * DeepSeek transcript format note:
 * User messages DON'T have usage data — only assistant messages carry usage.input_tokens,
 * which represents the FULL prompt cost (system + history + user input).
 * We attribute input_tokens from assistant to the preceding user message
 * for an accurate per-role cost breakdown.
 */
function extractMsgText(entry) {
  const c = entry.message?.content;
  if (typeof c === 'string') return c.trim();
  if (Array.isArray(c)) return c.filter(x => x.type === 'text').map(x => x.text || '').join('\n').trim();
  return '';
}

function buildMsgList(lines) {
  const messages = [];
  let pendingUser = null; // user message waiting for the next assistant's usage data

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      const role = entry.message?.role;
      if (role !== 'user' && role !== 'assistant') continue;

      const text = extractMsgText(entry);
      if (!text) continue;
      if (SYSTEM_MSGS.has(text)) continue;

      const ts = entry.timestamp || entry.message?.timestamp || new Date().toISOString();
      const m = entry.message?.model || null;
      const model = MODEL_ALIASES[m] || m;

      if (role === 'user') {
        // Buffer user message — will get usage from the next assistant
        pendingUser = {
          role, content: text.length > 10000 ? text.slice(0, 10000) + '...' : text,
          input_tokens: 0, output_tokens: 0, cache_hit: 0,
          model: model || undefined, created_at: ts,
        };
      } else if (role === 'assistant') {
        const usage = entry.message?.usage || {};
        const hasUsage = usage.input_tokens !== undefined;

        if (hasUsage && pendingUser) {
          // DeepSeek: attribute the assistant's input_tokens to the preceding user message
          pendingUser.input_tokens = usage.input_tokens || 0;
          pendingUser.cache_hit = usage.cache_read_input_tokens || 0;
          // Use the assistant's model for the user message so costing uses the correct rate
          pendingUser.model = model || undefined;
          messages.push(pendingUser);
          pendingUser = null;
          // Assistant message only carries output tokens (input already attributed)
          messages.push({
            role, content: text.length > 10000 ? text.slice(0, 10000) + '...' : text,
            input_tokens: 0, output_tokens: usage.output_tokens || 0, cache_hit: 0,
            model: model || undefined, created_at: ts,
          });
        } else {
          // Flush any pending user (no usage data available)
          if (pendingUser) { messages.push(pendingUser); pendingUser = null; }
          messages.push({
            role, content: text.length > 10000 ? text.slice(0, 10000) + '...' : text,
            input_tokens: hasUsage ? (usage.input_tokens || 0) : 0,
            output_tokens: hasUsage ? (usage.output_tokens || 0) : 0,
            cache_hit: hasUsage ? (usage.cache_read_input_tokens || 0) : 0,
            model: model || undefined, created_at: ts,
          });
        }
      }
    } catch {}
  }
  // Flush remaining pending user (no following assistant in this batch)
  if (pendingUser) messages.push(pendingUser);
  return messages;
}

async function pushNewMessages(sessionId, transcriptPath, cache) {
  const prevLineCount = cache.last_imported_lines || 0;
  let content;
  try { content = fs.readFileSync(transcriptPath, 'utf-8'); } catch { return prevLineCount; }

  const lines = content.split('\n').filter(Boolean);
  // Cursor safety: if file shrank, reset cursor
  if (lines.length < prevLineCount) return lines.length;
  if (lines.length <= prevLineCount) return prevLineCount;

  const newLines = lines.slice(prevLineCount);
  const messages = buildMsgList(newLines);

  if (messages.length > 0) {
    try {
      const health = await fetch(`${MONITOR_URL}/api/health`);
      if (health.ok) {
        await fetch(`${MONITOR_URL}/api/records`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, title: '', model: '', messages, skillCalls: [] }),
        });
      }
    } catch {}
  }

  return lines.length;
}

// ── record: PostToolUse — 保存 transcript_path + 推送 token + 导入用户消息 ──
async function cmdRecord() {
  // 1. Try stdin (works on macOS/Linux, unreliable on Windows)
  const raw = await readStdin();
  let input = {};
  try { if (raw.trim()) input = JSON.parse(raw); } catch {}

  let transcriptPath = input.transcript_path || '';
  let sessionId = input.session_id || '';

  // 2. Fallback: read from disk cache (Windows stdin workaround)
  if (!transcriptPath || !fs.existsSync(transcriptPath)) {
    const cached = resolveFromCache();
    if (cached) {
      transcriptPath = cached.transcriptPath;
      // sessionId must come from current session, not stale cache
    }
  }

  // 3. Fallback: resolve session ID from disk/env
  if (!sessionId) sessionId = resolveSessionId();

  // 4. Fallback: infer transcript path from session ID + known location
  if ((!transcriptPath || !fs.existsSync(transcriptPath)) && sessionId) {
    const inferred = resolveTranscriptPath(sessionId);
    if (inferred) transcriptPath = inferred;
  }

  if (!transcriptPath || !fs.existsSync(transcriptPath)) process.exit(0);
  if (!sessionId) process.exit(0);

  const dir = path.dirname(PATH_CACHE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // Read previous cache to detect changes
  let prevTokens = null, prevLineCount = 0;
  if (fs.existsSync(PATH_CACHE)) {
    try {
      const prev = JSON.parse(fs.readFileSync(PATH_CACHE, 'utf-8'));
      prevTokens = prev.last_tokens;
      prevLineCount = prev.last_imported_lines || 0;
    } catch {}
  }

  // Read cumulative tokens from transcript
  const totals = readTokenTotals(transcriptPath);

  if (totals && sessionId && totals.count > 0) {
    const deltaIn = prevTokens ? Math.abs(totals.totalIn - prevTokens.in) : Infinity;
    const isNewMessage = deltaIn > 500;
    await pushToMonitor(sessionId, totals, isNewMessage, prevTokens);
  }

  // Import new user/assistant messages from transcript (live, not just at session end)
  const newLineCount = await pushNewMessages(sessionId, transcriptPath, { last_imported_lines: prevLineCount });

  fs.writeFileSync(PATH_CACHE, JSON.stringify({
    transcript_path: transcriptPath,
    session_id: sessionId,
    updated_at: new Date().toISOString(),
    last_tokens: totals ? { in: totals.totalIn, out: totals.totalOut, cache: totals.totalCache, cost: totals.cost?.total_cost || 0, baselineCost: totals.baselineCost || 0 } : null,
    last_imported_lines: newLineCount,
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
