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
// TRANSCRIPT_CACHE 已移除 — SQLite 唯一数据源
const PENDING_DIR = require('path').join(PROJECT_ROOT, '.claude-flow', 'data', 'pending-sessions');
const fs = require('fs');
const path = require('path');

// DeepSeek V4 官方定价（元/百万Token）
const MODEL_PRICES = {
  'deepseek-v4-flash': { input: 1, output: 2, cache_read: 0.02 },
  'deepseek-v4-pro':   { input: 3, output: 6, cache_read: 0.025 },
};
// 基线 = DeepSeek V4 Pro 价格（人手动会选 Pro，自动路由切 Flash 才是节省）
const BASELINE_PRICES = { input: 3, output: 6, cache_read: 0.025 };
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

function calcBaselineCost(tokensIn, tokensOut, cacheHit) {
  const cachedIn = Math.min(cacheHit || 0, tokensIn);
  const uncachedIn = Math.max(0, tokensIn - cachedIn);
  const inputCost  = (uncachedIn / 1_000_000) * BASELINE_PRICES.input;
  const cacheCost  = (cachedIn / 1_000_000) * BASELINE_PRICES.cache_read;
  const outputCost = (tokensOut / 1_000_000) * BASELINE_PRICES.output;
  return inputCost + cacheCost + outputCost;
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

/**
 * Resolve model name with multi-layer fallback:
 *   1. explicit param (from stdin)
 *   2. env vars (CLAUDE_MODEL, MODEL)
 *   3. .claude/settings.json → model
 *   4. ~/.claude.json → project lastModelUsage
 *   5. 'unknown'
 */
function resolveModel(explicit) {
  if (explicit) return explicit;
  if (process.env.CLAUDE_MODEL) return process.env.CLAUDE_MODEL;
  if (process.env.MODEL) return process.env.MODEL;
  try {
    const settingsPath = path.join(PROJECT_ROOT, '.claude', 'settings.json');
    if (fs.existsSync(settingsPath)) {
      const s = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      if (s.model) return s.model;
    }
  } catch {}
  try {
    const claudeCfg = path.join(require('os').homedir(), '.claude.json');
    if (fs.existsSync(claudeCfg)) {
      const cfg = JSON.parse(fs.readFileSync(claudeCfg, 'utf-8'));
      const projects = cfg.projects || {};
      for (const [key, val] of Object.entries(projects)) {
        if (PROJECT_ROOT.endsWith(key) || key.includes(PROJECT_ROOT.replace(/[:/\\]/g, '').slice(-20))) {
          const usage = val.lastModelUsage;
          if (usage) {
            const ids = Object.keys(usage);
            if (ids.length > 0) {
              let latest = 0, latestId = ids[0];
              for (const id of ids) {
                const ts = usage[id]?.lastUsedAt ? new Date(usage[id].lastUsedAt).getTime() : 0;
                if (ts > latest) { latest = ts; latestId = id; }
              }
              if (latest > 0) return latestId;
            }
          }
          break;
        }
      }
    }
  } catch {}
  return 'unknown';
}

async function cmdStart() {
  const raw = await readStdin();
  let input = {};
  try { if (raw.trim()) input = JSON.parse(raw); } catch {}

  // priority: stdin > env var > settings.json > unknown
  const sessionId = input.session_id || process.env.CLAUDE_SESSION_ID || process.env.CLAUDE_FLOW_SESSION_ID || `session_${Date.now()}`;
  const model = resolveModel(input.model);
  const now = new Date().toISOString();

  // Track session lineage: if state file exists, this is a compact/restore
  let restoredFrom = null;
  let parentLineage = null;
  try {
    if (fs.existsSync(STATE_PATH)) {
      const prev = JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
      restoredFrom = prev.sessionId || null;
      parentLineage = prev.restoredFrom || null;
    }
  } catch {}

  // Save state for end hook (carry full lineage chain for monitor merging)
  const dir = path.dirname(STATE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify({
    sessionId,
    model,
    startedAt: now,
    restoredFrom,
    lineage: restoredFrom ? (parentLineage ? [parentLineage, restoredFrom, sessionId] : [restoredFrom, sessionId]) : [sessionId],
  }, null, 2), 'utf-8');

  // Clear previous session's transcript cache (no-op, transcript removed)
  // try { if (fs.existsSync(TRANSCRIPT_CACHE)) fs.unlinkSync(TRANSCRIPT_CACHE); } catch {}

  // Write JSONL trace for watcher (兜底，不依赖 POST)
  writeTrace({ sessionId, model, phase: 'start', note: '会话开始' });

  // Push to monitor (fire & forget), save pending on failure
  let pushed = false;
  try {
    const health = await fetch(`${MONITOR_URL}/api/health`);
    if (health.ok) {
      const payload = {
        sessionId,
        title: `会话 ${sessionId.slice(0, 16)}`,
        model,
        restoredFrom,
        messages: [{
          role: 'assistant',
          content: '会话开始',
          input_tokens: 0,
          output_tokens: 0,
          cache_hit: 0,
          created_at: now,
        }],
        skillCalls: [],
      };
      await fetch(`${MONITOR_URL}/api/records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      pushed = true;
    }
  } catch {}

  // Fallback: save to pending-sessions/ so monitor can import on startup
  if (!pushed) {
    try {
      if (!fs.existsSync(PENDING_DIR)) fs.mkdirSync(PENDING_DIR, { recursive: true });
      fs.writeFileSync(path.join(PENDING_DIR, `${sessionId}.json`), JSON.stringify({
        sessionId,
        title: `会话 ${sessionId.slice(0, 16)}`,
        model,
        startedAt: now,
        restoredFrom,
        phase: 'start',
      }, null, 2), 'utf-8');
    } catch {}
  }
}

async function cmdEnd() {
  // Try stdin first (hook protocol)
  const raw = await readStdin();
  let input = {};
  try { if (raw.trim()) input = JSON.parse(raw); } catch {}

  let sessionId = input.session_id || process.env.CLAUDE_SESSION_ID || process.env.CLAUDE_FLOW_SESSION_ID || `session_${Date.now()}`;
  // model: stdin > env > settings.json > session-state fallback
  let model = resolveModel(input.model);
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

  // ── Token totals from transcript 已移除 — SQLite 唯一数据源 ──
  const tokensIn = 0, tokensOut = 0, cacheRead = 0;
  // Clean up transcript cache (no-op, transcript removed)
  // try { if (fs.existsSync(TRANSCRIPT_CACHE)) fs.unlinkSync(TRANSCRIPT_CACHE); } catch {}

  const now = new Date().toISOString();

  // No cost computation from transcript — skill traces push directly to SQLite
  const cost = calcCost(model, tokensIn, tokensOut, cacheRead);
  const baselineCost = calcBaselineCost(tokensIn, tokensOut, cacheRead);

  // Write JSONL trace for watcher (兜底，不依赖 POST)
  writeTrace({ sessionId, model, phase: 'end', note: '会话结束', tokensIn, tokensOut, cacheRead });

  // PATCH disabled — watcher's importTranscriptMessages() is the single source of truth
  // for conversation cumulative totals (computed from SUM of per-message costs).
  // Sending absolute cumulative totals here would overwrite correct SUM-based values.

  // Save end marker to pending-sessions/ (metadata only — NO cumulative token totals,
  // as they would overwrite the watcher's correct SUM-based values)
  try {
    if (!fs.existsSync(PENDING_DIR)) fs.mkdirSync(PENDING_DIR, { recursive: true });
    const pendingPath = path.join(PENDING_DIR, `${sessionId}.json`);
    let pending = {};
    if (fs.existsSync(pendingPath)) {
      try { pending = JSON.parse(fs.readFileSync(pendingPath, 'utf-8')); } catch {}
    }
    Object.assign(pending, {
      sessionId,
      model: model || pending.model,
      startedAt: startedAt || pending.startedAt,
      ended_at: now,
      phase: 'end',
    });
    fs.writeFileSync(pendingPath, JSON.stringify(pending, null, 2), 'utf-8');
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
