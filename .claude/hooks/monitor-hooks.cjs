#!/usr/bin/env node
/**
 * monitor-hooks — 技能调用数据推送到 Monitor Dashboard
 *
 * Usage (CLI hook):
 *   node monitor-hooks.cjs start              # 记录 subagent 开始 trace
 *   node monitor-hooks.cjs end                # 记录 subagent 结束 trace
 *   node monitor-hooks.cjs push               # 推最新一条 skill-trace 到 monitor
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
  const agentLabel = entry.phase ? `${entry.agent || entry.skill} (${entry.phase})` : (entry.skill || 'unknown');
  const record = {
    sessionId: entry.trace_id || `trace_${Date.now()}`,
    title: agentLabel,
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

// ── Subagent lifecycle traces ──────────────────────────────────────────

/**
 * parseHookStdin — 从 hook stdin 解析 subagent 信息
 */
function parseStdin() {
  try {
    const buf = require('fs').readFileSync(0, 'utf-8').trim();
    if (buf) return JSON.parse(buf);
  } catch {}
  return {};
}

/**
 * getCurrentModel — 获取当前实际使用的模型名
 * 优先级：1) ~/.claude.json lastModelUsage（最准确，/model 切换后生效）
 *         2) settings.json model（备选，可能过期）
 *         3) 环境变量 CLAUDE_MODEL
 */
function getCurrentModel() {
  // 1. 从 ~/.claude.json 读取实际模型使用记录
  try {
    const home = require('os').homedir();
    const claudeConfigPath = path.join(home, '.claude.json');
    if (fs.existsSync(claudeConfigPath)) {
      const cfg = JSON.parse(fs.readFileSync(claudeConfigPath, 'utf-8'));
      const projects = cfg.projects || {};
      // 匹配当前项目
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

  // 2. 从 settings.json 读取（备选）
  try {
    const settingsPath = path.join(PROJECT_ROOT, '.claude', 'settings.json');
    if (fs.existsSync(settingsPath)) {
      const s = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      return s.model || null;
    }
  } catch {}

  // 3. 环境变量
  return process.env.CLAUDE_MODEL || null;
}

function writeTrace({ phase, agent, team, model, note }) {
  try {
    const agentName = agent || process.env.CLAUDE_AGENT_NAME || 'subagent';
    const ts = Date.now();
    const dir = require('path').dirname(TRACE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const entry = {
      trace_id: `sa_${agentName}_${ts}`,
      span_id: `sa_${phase}_${ts}`,
      timestamp: new Date().toISOString(),
      agent: agentName,
      team: team || process.env.CLAUDE_TEAM_NAME || 'unknown',
      skill: agentName,             // 使用 agent 真实名称（如 red-team），而非硬编码 subagent-start
      skill_type: 'subagent',       // 标记为生命周期事件，区别于真实技能调用
      trigger: 'hook',
      call_level: 0,
      phase,                        // 'start' 或 'end'
      result: phase === 'end' ? 'success' : 'running',
      duration_ms: 0,
      model_used: model || getCurrentModel() || 'unknown',  // 从 ~/.claude.json 读实际模型
      tokens_in: 0,
      tokens_out: 0,
      cache_hit: 0,
      note: note || `${phase} subagent: ${agentName}`,
    };
    fs.appendFileSync(TRACE_PATH, JSON.stringify(entry) + '\n');
  } catch {}
}

function cmdStart() {
  const input = parseStdin();
  writeTrace({
    phase: 'start',
    agent: input.agent || input.name,
    team: input.team,
    model: input.model,
    note: input.note || input.title || `subagent ${(input.agent || input.name || '').slice(0, 20)} 开始`,
  });
  process.exit(0);
}

function cmdEnd() {
  const input = parseStdin();
  writeTrace({
    phase: 'end',
    agent: input.agent || input.name,
    team: input.team,
    model: input.model,
    note: input.note || input.title || `subagent ${(input.agent || input.name || '').slice(0, 20)} 结束`,
  });
  process.exit(0);
}

// ── Main ─────────────────────────────────────────────────────────────
const cmd = process.argv[2];
const args = process.argv.slice(3);

process.exitCode = 0;
(async () => {
  switch (cmd) {
    case 'start':
      cmdStart();
      break;
    case 'end':
      cmdEnd();
      break;
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
      console.log('Usage: node monitor-hooks.cjs <start|end|push|status|replay>');
      console.log('  start        Record subagent start trace');
      console.log('  end          Record subagent end trace');
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
