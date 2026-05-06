#!/usr/bin/env node
/**
 * monitor-session — 会话级记录到 Monitor Dashboard
 *
 * 让每个 Claude Code 会话（对话）都在 Monitor 中有一条记录，
 * 无论是否触发技能。记录包含会话ID、模型、起止时间。
 *
 * 双重写入策略：
 *   1. POST /api/records → 直接推送到 monitor（快速路径）
 *   2. skill-traces.jsonl → watcher 轮询兜底（慢速路径，保证不漏）
 *
 * Usage:
 *   node monitor-session.cjs start   # 会话开始
 *   node monitor-session.cjs end     # 会话结束
 */

const MONITOR_URL = process.env.MONITOR_URL || 'http://localhost:3456';
const PROJECT_ROOT = require('path').resolve(__dirname, '..', '..');
const STATE_PATH = require('path').join(PROJECT_ROOT, '.claude-flow', 'data', 'session-state.json');
const TRACE_PATH = require('path').join(PROJECT_ROOT, '.claude-flow', 'data', 'skill-traces.jsonl');
const TRANSCRIPT_CACHE = require('path').join(PROJECT_ROOT, '.claude-flow', 'data', 'transcript-path.json');
const fs = require('fs');
const path = require('path');

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

function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve('');
    let data = '';
    const timer = setTimeout(() => {
      process.stdin.removeAllListeners();
      process.stdin.pause();
      resolve(data);
    }, 1000);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => { clearTimeout(timer); resolve(data); });
    process.stdin.on('error', () => { clearTimeout(timer); resolve(data); });
    process.stdin.resume();
  });
}

async function cmdStart() {
  const raw = await readStdin();
  let input = {};
  try { if (raw.trim()) input = JSON.parse(raw); } catch {}

  // priority: stdin > env var > fallback
  const sessionId = input.session_id || process.env.CLAUDE_SESSION_ID || process.env.CLAUDE_FLOW_SESSION_ID || `session_${Date.now()}`;
  const model = input.model || process.env.CLAUDE_MODEL || process.env.MODEL || 'unknown';
  const now = new Date().toISOString();

  // Save state for end hook
  const dir = path.dirname(STATE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify({
    sessionId,
    model,
    startedAt: now,
  }, null, 2), 'utf-8');

  // Clear previous session's transcript cache
  try { if (fs.existsSync(TRANSCRIPT_CACHE)) fs.unlinkSync(TRANSCRIPT_CACHE); } catch {}

  // Write JSONL trace for watcher (兜底，不依赖 POST)
  writeTrace({ sessionId, model, phase: 'start', note: '会话开始' });

  // Push to monitor (fire & forget)
  try {
    const health = await fetch(`${MONITOR_URL}/api/health`);
    if (!health.ok) return;
  } catch { return; }

  try {
    await fetch(`${MONITOR_URL}/api/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        title: `会话 ${sessionId.slice(0, 16)}`,
        model,
        messages: [{
          role: 'assistant',
          content: '会话开始',
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

async function cmdEnd() {
  // Try stdin first (hook protocol)
  const raw = await readStdin();
  let input = {};
  try { if (raw.trim()) input = JSON.parse(raw); } catch {}

  let sessionId = input.session_id || process.env.CLAUDE_SESSION_ID || process.env.CLAUDE_FLOW_SESSION_ID || `session_${Date.now()}`;
  // model: current stdin > current env > session-state fallback
  let model = input.model || process.env.CLAUDE_MODEL || process.env.ANTHROPIC_MODEL || 'unknown';
  let startedAt = null;

  // Override from saved state (more reliable)
  if (fs.existsSync(STATE_PATH)) {
    try {
      const state = JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
      if (state.sessionId) sessionId = state.sessionId;
      // Only use saved model if no current model info available
      if (!model || model === 'unknown') model = state.model || model;
      if (state.startedAt) startedAt = state.startedAt;
    } catch {}
    try { fs.unlinkSync(STATE_PATH); } catch {}
  }

  // ── Read token totals from the conversation transcript ──
  let tokensIn = 0, tokensOut = 0, cacheRead = 0, messagesFound = 0;
  if (fs.existsSync(TRANSCRIPT_CACHE)) {
    try {
      const cached = JSON.parse(fs.readFileSync(TRANSCRIPT_CACHE, 'utf-8'));
      const transcriptPath = cached.transcript_path;
      if (transcriptPath && fs.existsSync(transcriptPath)) {
        const content = fs.readFileSync(transcriptPath, 'utf-8');
        for (const line of content.split('\n').filter(Boolean)) {
          const entry = JSON.parse(line);
          const u = entry.message?.usage;
          if (u) {
            tokensIn += u.input_tokens || 0;
            tokensOut += u.output_tokens || 0;
            cacheRead += u.cache_read_input_tokens || 0;
            messagesFound++;
          }
        }
      }
    } catch {}
    try { fs.unlinkSync(TRANSCRIPT_CACHE); } catch {}
  }

  const now = new Date().toISOString();

  // Compute cost from final totals
  const cost = calcCost(model, tokensIn, tokensOut, cacheRead);

  // Write JSONL trace for watcher (兜底，不依赖 POST)
  writeTrace({ sessionId, model, phase: 'end', note: '会话结束', tokensIn, tokensOut, cacheRead });

  // Push final totals + cost via PATCH (不重复追加消息)
  try {
    const health = await fetch(`${MONITOR_URL}/api/health`);
    if (!health.ok) return;
  } catch { return; }

  try {
    await fetch(`${MONITOR_URL}/api/conversations/${encodeURIComponent(sessionId)}/tokens`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        total_input_tokens: tokensIn,
        total_output_tokens: tokensOut,
        total_cost: cost ? cost.total_cost : 0,
        ended_at: now,
      }),
    });
  } catch {}
}

/**
 * writeTrace — 写入 JSONL 兜底文件，供 watcher 轮询导入
 * 确保即使 POST /api/records 失败，数据也不会丢失。
 */
function writeTrace({ sessionId, model, phase, note, tokensIn, tokensOut, cacheRead }) {
  try {
    const dir = path.dirname(TRACE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const entry = {
      trace_id: sessionId,
      span_id: `session_${phase}_${Date.now()}`,
      timestamp: new Date().toISOString(),
      agent: 'session',
      team: 'session',
      skill: `session-${phase}`,
      skill_type: 'session',
      trigger: 'hook',
      call_level: 0,
      phase,
      result: 'success',
      duration_ms: 0,
      model_used: model,
      tokens_in: tokensIn || 0,
      tokens_out: tokensOut || 0,
      cache_hit: cacheRead || 0,
      note: note || `${phase} session ${sessionId.slice(0, 16)}`,
    };
    fs.appendFileSync(TRACE_PATH, JSON.stringify(entry) + '\n');
  } catch {}
}

// ── Main ─────────────────────────────────────────────
const cmd = process.argv[2];

(async () => {
  switch (cmd) {
    case 'start':
      await cmdStart();
      break;
    case 'end':
      await cmdEnd();
      break;
    default:
      // silent
      break;
  }
})().catch(() => {}).finally(() => process.exit(0));
