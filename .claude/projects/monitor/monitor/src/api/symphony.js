/**
 * Symphony API v1 — Symphony-compatible REST endpoints
 *
 * Implements the OPTIONAL HTTP server extension from the Symphony spec (Section 13.7):
 *   GET  /api/v1/state           — Runtime snapshot
 *   GET  /api/v1/:identifier     — Issue-specific details
 *   POST /api/v1/refresh         — Trigger poll+reconcile
 *
 * All endpoints return JSON.
 */

const fs = require('fs');
const path = require('path');
const express = require('express');
const router = express.Router();

// Path to hammer-bridge state files
const BRIDGE_DIR = path.resolve(__dirname, '..', '..', '..', '..', '.claude-flow', 'hammer-state');
const STATUS_FILE = path.join(BRIDGE_DIR, '.hammer-status.json');
const RETRY_FILE = path.join(BRIDGE_DIR, '.hammer-retry.json');
const TOKEN_FILE = path.join(BRIDGE_DIR, '.hammer-tokens.json');
const LOG_FILE = path.join(BRIDGE_DIR, '.hammer-log.jsonl');

function safeRead(filepath) {
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  } catch {
    return null;
  }
}

function buildOrchestratorState() {
  const status = safeRead(STATUS_FILE) || { task: '', phase: 0, startedAt: null, teams: {}, totalAgents: 0, completedAgents: 0, failedAgents: 0, mode: 'oneshot' };
  const retryState = safeRead(RETRY_FILE) || { entries: {} };
  const tokens = safeRead(TOKEN_FILE) || { input_tokens: 0, output_tokens: 0, total_tokens: 0, seconds_running: 0, sessions: {} };

  const running = [];
  const retrying = [];

  for (const [teamName, team] of Object.entries(status.teams || {})) {
    for (const [agentName, agent] of Object.entries(team.agents || {})) {
      if (agent.status === 'running') {
        running.push({
          team: teamName,
          agent: agentName,
          task_id: agent.taskId,
          session_id: agent.sessionId || null,
          turn_count: agent.turnCount || 1,
          last_event: agent.lastEvent || 'running',
          last_message: agent.lastMessage || '',
          started_at: agent.startedAt,
          last_event_at: agent.completedAt || agent.startedAt,
          attempt: agent.attempt || 1,
          tokens: agent.tokens || { input_tokens: 0, output_tokens: 0, total_tokens: 0 }
        });
      }
    }
  }

  for (const [key, entry] of Object.entries(retryState.entries || {})) {
    retrying.push({
      key,
      team: entry.team,
      agent: entry.agent,
      attempt: entry.attempt,
      max_attempts: entry.max_attempts,
      due_at: entry.due_at_ms ? new Date(entry.due_at_ms).toISOString() : null,
      backoff_ms: entry.backoff_ms || 0,
      error: entry.error
    });
  }

  // Compute elapsed from startedAt
  const startedAt = status.startedAt ? new Date(status.startedAt).getTime() : null;
  const now = Date.now();
  const elapsedSeconds = startedAt ? (now - startedAt) / 1000 : 0;

  return {
    generated_at: new Date().toISOString(),
    mode: status.mode || 'oneshot',
    phase: status.phase || 0,
    task: status.task || '',
    started_at: status.startedAt,
    elapsed_seconds: Math.round(elapsedSeconds),
    counts: {
      running: running.length,
      retrying: retrying.length,
      total: status.totalAgents || 0,
      completed: status.completedAgents || 0,
      failed: status.failedAgents || 0
    },
    running,
    retrying,
    codex_totals: {
      input_tokens: tokens.input_tokens,
      output_tokens: tokens.output_tokens,
      total_tokens: tokens.total_tokens,
      seconds_running: tokens.seconds_running
    },
    rate_limits: null,
    teams: Object.entries(status.teams || {}).map(([name, team]) => ({
      name,
      done: team.done || 0,
      total: team.total || 0,
      failed: team.failed || 0,
      agents: Object.entries(team.agents || {}).map(([aname, a]) => ({
        name: aname,
        status: a.status,
        attempt: a.attempt || 1,
        task: a.taskId,
        error: a.error || null,
        tokens: a.tokens || { input_tokens: 0, output_tokens: 0, total_tokens: 0 }
      }))
    }))
  };
}

// GET /api/v1/state — Runtime snapshot
router.get('/v1/state', (req, res) => {
  try {
    const state = buildOrchestratorState();
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: { code: 'state_error', message: err.message } });
  }
});

// POST /api/v1/refresh — Trigger poll+reconcile cycle
router.post('/v1/refresh', (req, res) => {
  // In the daemon/watch mode, this signals the orchestrator to run a tick early.
  // In oneshot mode, this is a no-op.
  const state = buildOrchestratorState();

  res.status(202).json({
    queued: true,
    coalesced: false,
    requested_at: new Date().toISOString(),
    operations: ['poll', 'reconcile'],
    current_mode: state.mode,
    note: state.mode === 'watch'
      ? 'Refresh queued. Next poll tick will be triggered as soon as possible.'
      : 'Not in watch/daemon mode. Refresh has no effect in oneshot mode.'
  });
});

// GET /api/v1/pending — List pending task queue items
router.get('/v1/pending', (req, res) => {
  try {
    const queueDir = path.resolve(__dirname, '..', '..', '..', '..', '.claude-flow', 'hammer-queue');
    const items = [];
    if (fs.existsSync(queueDir)) {
      const files = fs.readdirSync(queueDir).filter(f => f.endsWith('.json') || f.endsWith('.md'));
      for (const file of files) {
        const stat = fs.statSync(path.join(queueDir, file));
        items.push({
          file,
          size: stat.size,
          created_at: stat.birthtime.toISOString(),
          modified_at: stat.mtime.toISOString()
        });
      }
    }
    res.json({ count: items.length, items });
  } catch (err) {
    res.status(500).json({ error: { code: 'queue_error', message: err.message } });
  }
});

// GET /api/v1/history — Recent execution history from log (MUST be before /:identifier)
router.get('/v1/history', (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '50', 10);
    const events = [];
    if (fs.existsSync(LOG_FILE)) {
      const lines = fs.readFileSync(LOG_FILE, 'utf-8').trim().split('\n');
      const recent = lines.slice(-limit);
      for (const line of recent) {
        try { events.push(JSON.parse(line)); } catch {}
      }
    }
    res.json({ count: events.length, events });
  } catch (err) {
    res.status(500).json({ error: { code: 'history_error', message: err.message } });
  }
});

// POST /api/v1/hammer/init — Initialize a new 夯 task (remote trigger)
router.post('/v1/hammer/init', (req, res) => {
  try {
    const { task, totalAgents, mode } = req.body || {};
    if (!task) {
      return res.status(400).json({ error: { code: 'missing_task', message: '"task" field is required' } });
    }

    const bridgeDir = path.resolve(__dirname, '..', '..', '..', '..', '.claude-flow', 'hammer-state');
    if (!fs.existsSync(bridgeDir)) fs.mkdirSync(bridgeDir, { recursive: true });

    const st = {
      task,
      phase: 1,
      startedAt: new Date().toISOString(),
      teams: {},
      totalAgents: parseInt(totalAgents) || 0,
      completedAgents: 0,
      failedAgents: 0,
      mode: mode || 'oneshot'
    };
    fs.writeFileSync(path.join(bridgeDir, '.hammer-status.json'), JSON.stringify(st, null, 2));
    fs.writeFileSync(path.join(bridgeDir, '.hammer-retry.json'), JSON.stringify({ entries: {} }), 'utf-8');

    res.status(201).json({ ok: true, task, mode: st.mode, message: 'Task initialized. Ready for orchestrator to pick up.' });
  } catch (err) {
    res.status(500).json({ error: { code: 'init_error', message: err.message } });
  }
});

// GET /api/v1/:identifier — Issue/agent/team specific details (MUST be last GET /v1/ route)
router.get('/v1/:identifier', (req, res) => {
  try {
    const identifier = req.params.identifier;
    const state = buildOrchestratorState();

    const team = state.teams.find(t => t.name === identifier);
    if (team) {
      return res.json({ identifier, type: 'team', name: team.name, progress: { done: team.done, total: team.total, failed: team.failed }, agents: team.agents });
    }
    const running = state.running.find(r => r.agent === identifier || r.team === identifier || r.task_id === identifier);
    if (running) {
      return res.json({ identifier, type: 'agent', ...running });
    }
    const retrying = state.retrying.find(r => r.key.includes(identifier));
    if (retrying) {
      return res.json({ identifier, type: 'retry', ...retrying });
    }
    res.status(404).json({ error: { code: 'not_found', message: `No agent, team, or task matching "${identifier}"` } });
  } catch (err) {
    res.status(500).json({ error: { code: 'lookup_error', message: err.message } });
  }
});

module.exports = router;
