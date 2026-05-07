const express = require('express');
const path = require('path');
const layouts = require('express-ejs-layouts');
const { initDB } = require('./db');
const { saveRecord } = require('./collector');
const conversationsRouter = require('./api/conversations');
const statsRouter = require('./api/stats');
const { startWatcher } = require('./watcher');

const app = express();
const PORT = 3456;

// Middleware
app.use(express.json({ limit: '1mb' }));

// EJS templates + layouts
app.set('views', path.join(__dirname, '../client'));
app.set('view engine', 'ejs');
app.use(layouts);
app.set('layout', 'layout');
app.use('/static', express.static(path.join(__dirname, '../client')));

// Init DB
const db = initDB();

// Cleanup stale data: remove old subagent lifecycle entries and unknown-model records
try {
  db.prepare("DELETE FROM skill_calls WHERE skill_type = 'subagent'").run();
  db.prepare("DELETE FROM skill_calls WHERE skill_name LIKE 'subagent-%'").run();
  // Clean up truly empty conversations (no messages AND no token data)
  db.prepare(
    "DELETE FROM conversations WHERE id NOT IN (SELECT DISTINCT conversation_id FROM messages) AND total_input_tokens = 0 AND total_output_tokens = 0"
  ).run();
  console.log('[monitor] Cleaned up old subagent lifecycle data');
} catch (e) {
  console.error('[monitor] Cleanup warning:', e.message);
}

// Start file watcher (兜底：轮询 skill-traces.jsonl / session-state.json)
startWatcher(15000);

// Sync pending sessions (saved by hooks when monitor was unreachable)
syncPendingSessions();

function syncPendingSessions() {
  const fs = require('fs');
  const path = require('path');
  const pendingDir = path.join(__dirname, '..', '..', '.claude-flow', 'data', 'pending-sessions');
  if (!fs.existsSync(pendingDir)) return;
  try {
    const files = fs.readdirSync(pendingDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(pendingDir, file), 'utf-8'));
        const existing = db.prepare('SELECT id FROM conversations WHERE id = ?').get(data.sessionId);
        if (!existing) {
          // Create conversation record
          db.prepare(`INSERT INTO conversations (id, title, model, started_at, total_input_tokens, total_output_tokens, total_cost, ended_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
            data.sessionId,
            data.title || `会话 ${(data.sessionId || '').slice(0, 16)}`,
            data.model || 'unknown',
            data.startedAt || new Date().toISOString(),
            data.total_input_tokens || 0,
            data.total_output_tokens || 0,
            data.total_cost || 0,
            data.ended_at || null
          );
          console.log('[monitor] Imported pending session:', data.sessionId);
        } else if (data.phase === 'end') {
          // Update with final totals
          db.prepare(`UPDATE conversations SET total_input_tokens=?, total_output_tokens=?, total_cost=?, ended_at=? WHERE id=?`).run(
            data.total_input_tokens || 0,
            data.total_output_tokens || 0,
            data.total_cost || 0,
            data.ended_at || null,
            data.sessionId
          );
          console.log('[monitor] Updated pending session end:', data.sessionId);
        }
        fs.unlinkSync(path.join(pendingDir, file));
      } catch (e) {
        console.error('[monitor] Pending sync error for', file, ':', e.message);
      }
    }
  } catch (e) {
    console.error('[monitor] Pending sync error:', e.message);
  }
}

// --- API Routes ---

// Health check — used by hooks to detect if monitor is running
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Data ingestion — called by hooks
app.post('/api/records', (req, res) => {
  try {
    const { sessionId, title, model, messages, skillCalls } = req.body;
    const convId = saveRecord({ sessionId, title, model, messages, skillCalls });
    res.json({ ok: true, conversationId: convId });
  } catch (err) {
    console.error('Save record error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Manual trigger for syncing pending sessions
app.post('/api/sync-pending', (req, res) => {
  syncPendingSessions();
  res.json({ ok: true });
});

app.use('/api', conversationsRouter);
app.use('/api', statsRouter);

// --- Page Routes ---

app.get('/', (req, res) => {
  res.render('index', { activePage: 'list' });
});

app.get('/conversations/:id', (req, res) => {
  res.render('conversation', { convId: req.params.id, activePage: 'list' });
});

app.get('/stats', (req, res) => {
  res.render('stats', { activePage: 'stats' });
});

app.get('/logs', (req, res) => {
  res.render('logs', { activePage: 'logs' });
});

app.listen(PORT, () => {
  console.log(`🔍 Monitor dashboard: http://localhost:${PORT}`);
});
