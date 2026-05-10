#!/usr/bin/env node
/**
 * hammer-watch.cjs — /夯 后台守护进程
 *
 * 自动启动 (SessionStart hook), 常驻运行。
 *
 * 职责:
 *   1. 监控 .gspowers/queue/ 目录，新任务文件 → 自动初始化桥接状态
 *   2. 定期检查重试队列到期项，标记 ready
 *   3. 定期失活检测，stalled agent → 自动终止+重试
 *   4. 将所有状态写入 bridge 文件，供 Monitor Symphony API 读取
 *   5. 不实际 spawn agent（由对话中的 /夯 Skill 负责），仅做状态管理和任务就绪标记
 *
 * 用法:
 *   node .claude/hooks/hammer-watch.cjs start     # 启动守护
 *   node .claude/hooks/hammer-watch.cjs stop      # 停止守护
 *   node .claude/hooks/hammer-watch.cjs status    # 查看状态
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const QUEUE_DIR = path.join(PROJECT_ROOT, '.claude-flow', 'hammer-queue');
const ARTIFACTS_DIR = path.join(PROJECT_ROOT, '.claude-flow', 'hammer-artifacts');
const WORKSPACE_DIR = path.join(PROJECT_ROOT, '.claude-flow', 'hammer-workspaces');
const BRIDGE_DIR = path.join(PROJECT_ROOT, '.claude-flow', 'hammer-state');
const PID_FILE = path.join(BRIDGE_DIR, '.hammer-watch.pid');
const READY_FILE = path.join(BRIDGE_DIR, '.hammer-ready.json');

const DEFAULT_POLL_INTERVAL = 30000;
const DEFAULT_STALL_TIMEOUT = 300000;
const DEFAULT_RETRY_MAX = 3;
const DEFAULT_RETRY_BACKOFF = 300000;

const cmd = process.argv[2] || 'start';

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function safeRead(filepath) {
  try { return JSON.parse(fs.readFileSync(filepath, 'utf-8')); } catch { return null; }
}

function calcBackoff(attempt, maxBackoff) {
  return Math.min(10000 * Math.pow(2, attempt - 1), maxBackoff);
}

function tick() {
  ensureDir(BRIDGE_DIR);
  ensureDir(QUEUE_DIR);
  ensureDir(ARTIFACTS_DIR);
  ensureDir(WORKSPACE_DIR);

  const status = safeRead(path.join(BRIDGE_DIR, '.hammer-status.json'));
  const retryState = safeRead(path.join(BRIDGE_DIR, '.hammer-retry.json')) || { entries: {} };
  const ready = safeRead(READY_FILE) || { tasks: [], last_tick: null, stalled: [] };
  const now = Date.now();

  // 1. Scan queue for new tasks
  if (fs.existsSync(QUEUE_DIR)) {
    const files = fs.readdirSync(QUEUE_DIR).filter(f => f.endsWith('.json') || f.endsWith('.md'));
    for (const file of files) {
      const existing = ready.tasks.find(t => t.file === file);
      if (!existing) {
        let taskData = { file };
        try {
          const content = fs.readFileSync(path.join(QUEUE_DIR, file), 'utf-8');
          if (file.endsWith('.json')) {
            taskData = { ...taskData, ...JSON.parse(content) };
          } else {
            taskData.description = content.slice(0, 200);
          }
        } catch (e) {
          taskData.error = e.message;
        }
        ready.tasks.push({
          ...taskData,
          discovered_at: new Date().toISOString(),
          status: 'pending'
        });
      }
    }
  }

  // 2. Check retry queue for due entries
  if (retryState.entries) {
    for (const [key, entry] of Object.entries(retryState.entries)) {
      if (entry.due_at_ms && entry.due_at_ms <= now) {
        entry._ready = true;
        entry._checked_at = new Date().toISOString();
      }
    }
    fs.writeFileSync(path.join(BRIDGE_DIR, '.hammer-retry.json'), JSON.stringify(retryState, null, 2));
  }

  // 3. Stall detection
  if (status && status.teams) {
    const stalled = [];
    for (const [teamName, team] of Object.entries(status.teams)) {
      if (!team.agents) continue;
      for (const [agentName, agent] of Object.entries(team.agents)) {
        if (agent.status !== 'running') continue;
        const lastEventAt = agent.completedAt || agent.startedAt;
        if (!lastEventAt) continue;
        const elapsed = now - new Date(lastEventAt).getTime();
        if (elapsed > DEFAULT_STALL_TIMEOUT) {
          stalled.push({ team: teamName, agent: agentName, elapsed_ms: elapsed, taskId: agent.taskId });

          // Auto-fail the stalled agent
          agent.status = 'failed';
          agent.error = `stall timeout (${Math.round(elapsed / 1000)}s)`;

          // Enqueue retry
          const retry = safeRead(path.join(BRIDGE_DIR, '.hammer-retry.json')) || { entries: {} };
          const retryKey = `${teamName}/${agentName}`;
          const currentAttempt = agent.attempt || 1;
          if (currentAttempt < DEFAULT_RETRY_MAX) {
            const nextAttempt = currentAttempt + 1;
            retry.entries[retryKey] = {
              team: teamName,
              agent: agentName,
              attempt: nextAttempt,
              error: `stall timeout (${Math.round(elapsed / 1000)}s)`,
              due_at_ms: now + calcBackoff(nextAttempt, DEFAULT_RETRY_BACKOFF),
              backoff_ms: calcBackoff(nextAttempt, DEFAULT_RETRY_BACKOFF),
              max_attempts: DEFAULT_RETRY_MAX
            };
          } else {
            agent.status = 'exhausted';
          }
          fs.writeFileSync(path.join(BRIDGE_DIR, '.hammer-retry.json'), JSON.stringify(retry, null, 2));
        }
      }
    }
    if (Object.keys(status).length > 0) {
      fs.writeFileSync(path.join(BRIDGE_DIR, '.hammer-status.json'), JSON.stringify(status, null, 2));
    }
    ready.stalled = stalled;
  }

  // 4. Write ready file
  ready.last_tick = new Date().toISOString();
  ready.tick_count = (ready.tick_count || 0) + 1;
  fs.writeFileSync(READY_FILE, JSON.stringify(ready, null, 2));
}

function start() {
  // Check if already running
  if (fs.existsSync(PID_FILE)) {
    const oldPid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim(), 10);
    try {
      process.kill(oldPid, 0);
      console.log('[hammer-watch] Already running (PID', oldPid + ')');
      return;
    } catch (e) {
      // Not running, clean up
      fs.unlinkSync(PID_FILE);
    }
  }

  ensureDir(BRIDGE_DIR);
  fs.writeFileSync(PID_FILE, String(process.pid));

  console.log('[hammer-watch] Daemon started — PID', process.pid);
  console.log('[hammer-watch] Queue dir:', QUEUE_DIR);
  console.log('[hammer-watch] Poll interval:', DEFAULT_POLL_INTERVAL / 1000 + 's');

  // Initialize ready file
  const ready = { tasks: [], last_tick: null, stalled: [], tick_count: 0, started_at: new Date().toISOString() };
  fs.writeFileSync(READY_FILE, JSON.stringify(ready, null, 2));

  // First tick immediately
  tick();

  // Then every poll interval
  const timer = setInterval(tick, DEFAULT_POLL_INTERVAL);
  timer.unref();

  // Cleanup on exit
  process.on('SIGTERM', () => { clearInterval(timer); fs.unlinkSync(PID_FILE); process.exit(0); });
  process.on('SIGINT', () => { clearInterval(timer); fs.unlinkSync(PID_FILE); process.exit(0); });

  // Keep alive
  process.stdin.resume();
}

function stop() {
  if (!fs.existsSync(PID_FILE)) {
    console.log('[hammer-watch] Not running');
    return;
  }
  const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim(), 10);
  try {
    process.kill(pid, 'SIGTERM');
    console.log('[hammer-watch] Stopped (PID', pid + ')');
  } catch (e) {
    console.log('[hammer-watch] Process not found, cleaning up');
  }
  try { fs.unlinkSync(PID_FILE); } catch {}
}

function status() {
  if (fs.existsSync(PID_FILE)) {
    const pid = fs.readFileSync(PID_FILE, 'utf-8').trim();
    let alive = false;
    try { process.kill(parseInt(pid), 0); alive = true; } catch {}
    console.log('[hammer-watch]', alive ? 'Running (PID ' + pid + ')' : 'Dead (stale PID ' + pid + ')');
  } else {
    console.log('[hammer-watch] Not running');
  }

  const ready = safeRead(READY_FILE);
  if (ready) {
    console.log('  Last tick:', ready.last_tick || 'never');
    console.log('  Ticks:', ready.tick_count || 0);
    console.log('  Queued tasks:', ready.tasks ? ready.tasks.length : 0);
    console.log('  Stalled agents:', ready.stalled ? ready.stalled.length : 0);
    if (ready.tasks && ready.tasks.length > 0) {
      ready.tasks.forEach(t => console.log('    -', t.file, '(' + t.status + ')'));
    }
  }

  const retryState = safeRead(path.join(BRIDGE_DIR, '.hammer-retry.json'));
  const retryCount = retryState && retryState.entries ? Object.keys(retryState.entries).length : 0;
  console.log('  Retry queue:', retryCount, 'entries');
}

switch (cmd) {
  case 'start':
    start();
    break;
  case 'stop':
    stop();
    break;
  case 'status':
    status();
    break;
  default:
    console.log('Usage: node hammer-watch.cjs start|stop|status');
}
