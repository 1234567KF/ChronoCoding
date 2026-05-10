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
const SESSION_STATE_PATH = require('path').join(PROJECT_ROOT, '.claude-flow', 'data', 'session-state.json');
const TRANSCRIPT_CACHE = require('path').join(PROJECT_ROOT, '.claude-flow', 'data', 'transcript-path.json');
const AGENT_SNAPSHOT_DIR = require('path').join(PROJECT_ROOT, '.claude-flow', 'data', 'agent-snapshots');

const fs = require('fs');
const path = require('path');

// ── Read agent standard input ────────────────────────────────
function parseStdin() {
  try {
    const buf = require('fs').readFileSync(0, 'utf-8').trim();
    if (buf) return JSON.parse(buf);
  } catch {}
  return {};
}

// ── Resolve current session ID ───────────────────────────────
function getSessionId() {
  // Priority: env > session-state.json > fallback
  const envId = process.env.CLAUDE_SESSION_ID || process.env.CLAUDE_FLOW_SESSION_ID;
  if (envId) return envId;
  try {
    if (fs.existsSync(SESSION_STATE_PATH)) {
      const state = JSON.parse(fs.readFileSync(SESSION_STATE_PATH, 'utf-8'));
      if (state.sessionId) return state.sessionId;
    }
  } catch {}
  return `session_${Date.now()}`;
}

// ── Read transcript for current token totals ─────────────────
function readTranscriptTokens() {
  try {
    // 1. 从 transcript-path.json 缓存读取路径
    if (!fs.existsSync(TRANSCRIPT_CACHE)) return null;
    const cached = JSON.parse(fs.readFileSync(TRANSCRIPT_CACHE, 'utf-8'));
    const transcriptPath = cached.transcript_path;
    if (!transcriptPath || !fs.existsSync(transcriptPath)) return null;

    // 2. Infer session ID from project name
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
    return { totalIn, totalOut, totalCache, count, model };
  } catch { return null; }
}

// ── Agent token snapshot management ──────────────────────────
function getAgentSnapshotPath(agentName) {
  const dir = AGENT_SNAPSHOT_DIR;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${sanitizeName(agentName)}.json`);
}

function sanitizeName(name) {
  return (name || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function saveAgentSnapshot(agentName, snapshot) {
  const snapPath = getAgentSnapshotPath(agentName);
  fs.writeFileSync(snapPath, JSON.stringify(snapshot, null, 2), 'utf-8');
}

function loadAgentSnapshot(agentName) {
  const snapPath = getAgentSnapshotPath(agentName);
  if (!fs.existsSync(snapPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(snapPath, 'utf-8'));
  } catch { return null; }
}

function removeAgentSnapshot(agentName) {
  const snapPath = getAgentSnapshotPath(agentName);
  try { if (fs.existsSync(snapPath)) fs.unlinkSync(snapPath); } catch {}
}

// ── Read cumulative token totals from token-accum cache ──────
function readSkillTokenTotals() {
  const cachePath = path.join(PROJECT_ROOT, '.claude-flow', 'data', 'transcript-path.json');
  try {
    if (fs.existsSync(cachePath)) {
      const cached = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      if (cached.last_tokens) {
        return {
          tokensIn: cached.last_tokens.in || 0,
          tokensOut: cached.last_tokens.out || 0,
          cacheHit: cached.last_tokens.cache || 0,
        };
      }
    }
  } catch {}
  return { tokensIn: 0, tokensOut: 0, cacheHit: 0 };
}

// ── Write skill invocation trace (with real token totals from transcript) ─
function writeSkillTrace({ skill, agent, team, tokensIn, tokensOut, cacheHit }) {
  try {
    const sessionId = getSessionId();
    const ts = Date.now();
    const dir = require('path').dirname(TRACE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const entry = {
      trace_id: sessionId,
      span_id: `skill_${skill}_${ts}`,
      timestamp: new Date().toISOString(),
      agent: agent || process.env.CLAUDE_AGENT_NAME || 'main',
      team: team || process.env.CLAUDE_TEAM_NAME || 'unknown',
      skill: skill,
      skill_type: skill.startsWith('kf-') ? 'kf-custom' : 'builtin',
      trigger: 'hook',
      call_level: 0,
      phase: 'invoke',
      result: 'success',
      duration_ms: 0,
      model_used: getCurrentModel() || 'unknown',
      tokens_in: tokensIn || 0,
      tokens_out: tokensOut || 0,
      cache_hit: cacheHit || 0,
      note: `skill ${skill} invoked`,
      _session_id: sessionId,
    };
    fs.appendFileSync(TRACE_PATH, JSON.stringify(entry) + '\n');
  } catch {}
}

// ── Write trace to skill-traces.jsonl ────────────────────────
function writeTrace({ phase, agent, team, model, note, tokensIn, tokensOut, cacheHit }) {
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
      skill: agentName,
      skill_type: 'subagent',
      trigger: 'hook',
      call_level: 0,
      phase,
      result: phase === 'end' ? 'success' : 'running',
      duration_ms: 0,
      model_used: model || getCurrentModel() || 'unknown',
      tokens_in: tokensIn || 0,
      tokens_out: tokensOut || 0,
      cache_hit: cacheHit || 0,
      note: note || `${phase} subagent: ${agentName}`,
      // Attach real session ID so pushTrace can use it
      _session_id: getSessionId(),
    };
    fs.appendFileSync(TRACE_PATH, JSON.stringify(entry) + '\n');
  } catch {}
}

// ── Read trace entries ──────────────────────────────────────
function readTraces(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf-8').trim().split('\n')
    .filter(Boolean)
    .map(line => { try { return JSON.parse(line); } catch { return null; } })
    .filter(Boolean);
}

// ── Cursor (last pushed position) ───────────────────────────
function readCursor() {
  if (!fs.existsSync(CURSOR_PATH)) return 0;
  try { return JSON.parse(fs.readFileSync(CURSOR_PATH, 'utf-8')).offset || 0; } catch { return 0; }
}

function writeCursor(offset) {
  const dir = path.dirname(CURSOR_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CURSOR_PATH, JSON.stringify({ offset, updatedAt: new Date().toISOString() }), 'utf-8');
}

// ── Push to monitor ─────────────────────────────────────────
async function pushTrace(entry) {
  // Use real session ID so subagent events go under the right conversation
  const sessionId = entry._session_id || getSessionId();
  const agentLabel = entry.agent || entry.skill || 'unknown';
  const record = {
    sessionId,
    title: '',
    model: entry.model_used || 'unknown',
    messages: [{
      role: 'assistant',
      content: entry.note || '',
      input_tokens: entry.tokens_in || 0,
      output_tokens: entry.tokens_out || 0,
      cache_hit: entry.cache_hit || 0,
      created_at: entry.timestamp || new Date().toISOString(),
      // Pass agent info via skillCalls
      skillCalls: [{
        name: entry.skill,
        type: entry.skill_type,
        input_tokens: entry.tokens_in || 0,
        output_tokens: entry.tokens_out || 0,
        duration_ms: entry.duration_ms || null,
        status: entry.result === 'success' ? 'success' : entry.result === 'failure' ? 'error' : 'running',
        agent_name: entry.agent,
        agent_team: entry.team,
      }],
    }],
    skillCalls: [],
  };

  try {
    const health = await fetch(`${MONITOR_URL}/api/health`);
    if (!health.ok) throw new Error('Monitor not healthy');
  } catch (e) {
    if (e.message === 'Monitor not healthy') throw e;
    return;
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

// ── CLI commands ─────────────────────────────────────────────

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

// ── Subagent lifecycle traces ────────────────────────────────

function getCurrentModel() {
  try {
    const home = require('os').homedir();
    const claudeConfigPath = path.join(home, '.claude.json');
    if (fs.existsSync(claudeConfigPath)) {
      const cfg = JSON.parse(fs.readFileSync(claudeConfigPath, 'utf-8'));
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
  try {
    const settingsPath = path.join(PROJECT_ROOT, '.claude', 'settings.json');
    if (fs.existsSync(settingsPath)) {
      const s = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      return s.model || null;
    }
  } catch {}
  return process.env.CLAUDE_MODEL || null;
}

function cmdStart() {
  const input = parseStdin();
  const agentName = input.agent || input.name || process.env.CLAUDE_AGENT_NAME || 'subagent';

  // Read transcript to capture token snapshot at agent start
  const transcript = readTranscriptTokens();

  // Save start snapshot for delta computation at end
  saveAgentSnapshot(agentName, {
    totalIn: transcript?.totalIn || 0,
    totalOut: transcript?.totalOut || 0,
    totalCache: transcript?.totalCache || 0,
    timestamp: Date.now(),
  });

  writeTrace({
    phase: 'start',
    agent: agentName,
    team: input.team,
    model: input.model,
    note: input.note || input.title || `agent ${agentName} 开始`,
    // Store current transcript totals as reference (not yet attributed)
    tokensIn: transcript?.totalIn || 0,
    tokensOut: transcript?.totalOut || 0,
    cacheHit: transcript?.totalCache || 0,
  });
  process.exit(0);
}

function cmdEnd() {
  const input = parseStdin();
  const agentName = input.agent || input.name || process.env.CLAUDE_AGENT_NAME || 'subagent';

  // Read transcript for end snapshot
  const transcriptEnd = readTranscriptTokens();

  // Load start snapshot and compute delta
  const startSnap = loadAgentSnapshot(agentName);
  let deltaIn = 0, deltaOut = 0, deltaCache = 0;
  if (startSnap && transcriptEnd) {
    deltaIn = Math.max(0, transcriptEnd.totalIn - startSnap.totalIn);
    deltaOut = Math.max(0, transcriptEnd.totalOut - startSnap.totalOut);
    deltaCache = Math.max(0, transcriptEnd.totalCache - startSnap.totalCache);
  }

  // Clean up snapshot
  removeAgentSnapshot(agentName);

  writeTrace({
    phase: 'end',
    agent: agentName,
    team: input.team,
    model: input.model,
    note: input.note || input.title || `agent ${agentName} 结束`,
    // Store ACTUAL delta tokens attributed to this agent
    tokensIn: deltaIn,
    tokensOut: deltaOut,
    cacheHit: deltaCache,
  });
  process.exit(0);
}

// ── Skill invocation trace (PostToolUse hook) ─────────────────
function cmdSkill() {
  const input = parseStdin();
  // Handle both hook formats: {tool_name, tool_input: {skill}} and {name, args: {skill}}
  const toolInput = input.tool_input || input.args || input;
  const skillName = toolInput.skill || toolInput.skill_name || toolInput.name || input.skill || 'unknown';
  // Read cumulative token totals from transcript at time of skill invocation
  const { tokensIn, tokensOut, cacheHit } = readSkillTokenTotals();
  writeSkillTrace({
    skill: skillName,
    agent: process.env.CLAUDE_AGENT_NAME || null,
    team: process.env.CLAUDE_TEAM_NAME || null,
    tokensIn,
    tokensOut,
    cacheHit,
  });
  process.exit(0);
}

// ── Main ─────────────────────────────────────────────────────
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
    case 'skill':
      cmdSkill();
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
      console.log('Usage: node monitor-hooks.cjs <start|end|skill|push|status|replay>');
      console.log('  start        Record subagent start trace (with transcript token snapshot)');
      console.log('  end          Record subagent end trace (with per-agent token delta)');
      console.log('  skill        Record skill invocation trace (PostToolUse hook)');
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
