#!/usr/bin/env node
/**
 * monitor-hooks — 技能调用数据推送到 Monitor Dashboard
 *
 * Usage (CLI hook):
 *   node monitor-hooks.cjs push              # 推最新一条 skill-trace 到 monitor
 *   node monitor-hooks.cjs push --all         # 推所有未推送的 trace
 *   node monitor-hooks.cjs status             # 检查 monitor 连接
 *   node monitor-hooks.cjs replay <file>      # 从 JSONL 文件重放
 */

const MONITOR_URL = process.env.MONITOR_URL || 'http://localhost:3456';
const PROJECT_ROOT = require('path').resolve(__dirname, '..', '..');
const TRACE_PATH = require('path').join(PROJECT_ROOT, '.claude-flow', 'data', 'skill-traces.jsonl');
const CURSOR_PATH = require('path').join(PROJECT_ROOT, '.claude-flow', 'data', 'monitor-cursor.json');

const fs = require('fs');
const path = require('path');

// ── Read trace entries ──────────────────────────────────────────────
function readTraces(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf-8').trim().split('\n')
    .filter(Boolean)
    .map(line => { try { return JSON.parse(line); } catch { return null; } })
    .filter(Boolean);
}

// ── Cursor (last pushed position) ────────────────────────────────────
function readCursor() {
  if (!fs.existsSync(CURSOR_PATH)) return 0;
  try { return JSON.parse(fs.readFileSync(CURSOR_PATH, 'utf-8')).offset || 0; } catch { return 0; }
}

function writeCursor(offset) {
  const dir = path.dirname(CURSOR_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CURSOR_PATH, JSON.stringify({ offset, updatedAt: new Date().toISOString() }), 'utf-8');
}

// ── Push to monitor ──────────────────────────────────────────────────
async function pushTrace(entry) {
  const record = {
    sessionId: entry.trace_id || `trace_${Date.now()}`,
    title: entry.skill || 'unknown',
    model: entry.model_used || 'unknown',
    messages: [{
      role: 'assistant',
      content: entry.note || '',
      input_tokens: entry.tokens_in || 0,
      output_tokens: entry.tokens_out || 0,
      cache_hit: entry.cache_hit || 0,
      created_at: entry.timestamp || new Date().toISOString(),
    }],
    skillCalls: [{
      name: entry.skill,
      type: entry.skill_type,
      input_tokens: entry.tokens_in || 0,
      output_tokens: entry.tokens_out || 0,
      duration_ms: entry.duration_ms || null,
      status: entry.result === 'success' ? 'success' : entry.result === 'failure' ? 'error' : 'running',
    }],
  };

  try {
    const health = await fetch(`${MONITOR_URL}/api/health`);
    if (!health.ok) throw new Error('Monitor not healthy');
  } catch (e) {
    if (e.message === 'Monitor not healthy') throw e;
    return; // monitor not running, skip silently
  }

  const res = await fetch(`${MONITOR_URL}/api/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Monitor push failed: ${res.status} ${text.slice(0, 200)}`);
  }
}

// ── CLI commands ─────────────────────────────────────────────────────

async function cmdPush(pushAll) {
  const traces = readTraces(TRACE_PATH);
  if (traces.length === 0) {
    console.log('[monitor-hooks] No traces to push');
    process.exit(0);
  }

  const cursor = pushAll ? 0 : readCursor();
  const pending = traces.slice(cursor);
  if (pending.length === 0) {
    console.log('[monitor-hooks] No new traces to push');
    process.exit(0);
  }

  let pushed = 0, errors = 0;
  for (const entry of pending) {
    try {
      await pushTrace(entry);
      pushed++;
    } catch (e) {
      if (e.message === 'Monitor not healthy') {
        console.log('[monitor-hooks] Monitor not available, skipping');
        process.exit(0);
      }
      errors++;
    }
  }

  writeCursor(traces.length);
  console.log(`[monitor-hooks] Pushed ${pushed}/${pending.length} traces${errors ? ` (${errors} errors)` : ''}`);
  process.exit(0);
}

async function cmdStatus() {
  try {
    const res = await fetch(`${MONITOR_URL}/api/health`);
    const data = await res.json();
    console.log(`[monitor-hooks] Monitor: ${MONITOR_URL} — OK (uptime: ${Math.round(data.uptime)}s)`);
  } catch {
    console.log(`[monitor-hooks] Monitor: ${MONITOR_URL} — NOT REACHABLE`);
    process.exit(0);
  }

  const traces = readTraces(TRACE_PATH);
  const cursor = readCursor();
  console.log(`[monitor-hooks] Traces: ${traces.length} total, ${traces.length - cursor} pending`);
  process.exit(0);
}

async function cmdReplay(filePath) {
  const entries = readTraces(filePath);
  console.log(`[monitor-hooks] Replaying ${entries.length} traces from ${filePath}...`);
  let pushed = 0;
  for (const entry of entries) {
    try {
      await pushTrace(entry);
      pushed++;
    } catch (e) {
      if (e.message === 'Monitor not healthy') {
        console.log('[monitor-hooks] Monitor not available, aborting replay');
        process.exit(1);
      }
      console.error(`[monitor-hooks] Push error: ${e.message}`);
    }
  }
  console.log(`[monitor-hooks] Replay done: ${pushed}/${entries.length}`);
  process.exit(0);
}

// ── Main ─────────────────────────────────────────────────────────────
const cmd = process.argv[2];
const args = process.argv.slice(3);

process.exitCode = 0;
(async () => {
  switch (cmd) {
    case 'push':
      await cmdPush(args.includes('--all'));
      break;
    case 'status':
      await cmdStatus();
      break;
    case 'replay':
      await cmdReplay(args[0] || TRACE_PATH);
      break;
    default:
      console.log('Usage: node monitor-hooks.cjs <push|status|replay>');
      console.log('  push         Push latest pending traces to monitor');
    console.log('  push --all   Push ALL traces (reset cursor)');
      console.log('  status       Check monitor connection and trace count');
      console.log('  replay <file> Replay traces from a JSONL file');
      process.exit(0);
  }
})().catch(e => {
  console.error(`[monitor-hooks] Error: ${e.message}`);
  process.exit(0);
});
