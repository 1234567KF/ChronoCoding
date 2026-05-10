const express = require('express');
const fs = require('fs');
const path = require('path');
const layouts = require('express-ejs-layouts');
const { initDB } = require('./db');
const { saveRecord } = require('./collector');
const conversationsRouter = require('./api/conversations');
const userMessagesRouter = require('./api/userMessages');
const statsRouter = require('./api/stats');
const symphonyRouter = require('./api/symphony');
const { startWatcher } = require('./watcher');
const { fetchOfficialPrices } = require('./pricing');

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

// Fetch latest pricing from DeepSeek official website
fetchOfficialPrices().then(() => {
  console.log('[monitor] Pricing initialized');
});

// Clean up truly empty conversations (no messages AND no token data)
try {
  db.prepare(
    "DELETE FROM conversations WHERE id NOT IN (SELECT DISTINCT conversation_id FROM messages) AND total_input_tokens = 0 AND total_output_tokens = 0"
  ).run();
} catch (e) {
  console.error('[monitor] Cleanup warning:', e.message);
}
startWatcher(15000);

// Sync pending sessions
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
          db.prepare(`INSERT INTO conversations (id, session_id, title, model, started_at, total_input_tokens, total_output_tokens, total_cost, total_baseline_cost, ended_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
            data.sessionId,
            data.sessionId,
            data.title || `会话 ${(data.sessionId || '').slice(0, 16)}`,
            data.model || 'unknown',
            data.startedAt || new Date().toISOString(),
            data.total_input_tokens || 0,
            data.total_output_tokens || 0,
            data.total_cost || 0,
            data.total_baseline_cost || 0,
            data.ended_at || null
          );
          console.log('[monitor] Imported pending session:', data.sessionId);
        } else if (data.phase === 'end') {
          const current = db.prepare('SELECT total_input_tokens, total_output_tokens, total_cost, total_baseline_cost FROM conversations WHERE id = ?').get(data.sessionId);
          db.prepare(`UPDATE conversations SET total_input_tokens=?, total_output_tokens=?, total_cost=?, total_baseline_cost=?, ended_at=? WHERE id=?`).run(
            Math.max(current?.total_input_tokens || 0, data.total_input_tokens || 0),
            Math.max(current?.total_output_tokens || 0, data.total_output_tokens || 0),
            Math.max(current?.total_cost || 0, data.total_cost || 0),
            Math.max(current?.total_baseline_cost || 0, data.total_baseline_cost || 0),
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Data ingestion
app.post('/api/records', (req, res) => {
  try {
    const { sessionId, title, model, messages, skillCalls, restoredFrom } = req.body;
    const convId = saveRecord({ sessionId, title, model, messages, skillCalls, restoredFrom });
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

// Clear all historical data (DB + source files + watcher cursor)
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const TRACE_FILE = path.join(PROJECT_ROOT, '.claude-flow', 'data', 'skill-traces.jsonl');
const CURSOR_FILE = path.join(PROJECT_ROOT, '.claude-flow', 'data', 'watcher-cursor.json');
const PENDING_DIR = path.join(PROJECT_ROOT, '.claude-flow', 'data', 'pending-sessions');
const CLEARED_FLAG_PATH = path.join(PROJECT_ROOT, '.claude-flow', 'data', 'cleared-flag.json');

app.post('/api/clear', (req, res) => {
  try {
    // Require confirmation to prevent accidental clearing
    if (req.body?.confirm !== true) {
      return res.status(400).json({ error: 'Missing confirm: true', hint: 'Send { "confirm": true } to acknowledge data loss' });
    }

    // 1. Clear DB tables
    db.prepare('DELETE FROM skill_calls').run();
    db.prepare('DELETE FROM messages').run();
    db.prepare('DELETE FROM token_daily_stats').run();
    db.prepare('DELETE FROM conversations').run();

    // 2. Clear trace source file — truncateSync, retry once if locked
    try { fs.truncateSync(TRACE_FILE, 0); } catch { try { fs.truncateSync(TRACE_FILE, 0); } catch {} }

    // Read trace file line count AFTER truncate attempt (for cursor safety on lock failure)
    let traceLineCount = 0;
    try {
      const raw = fs.readFileSync(TRACE_FILE, 'utf-8').trim();
      traceLineCount = raw ? raw.split('\n').filter(Boolean).length : 0;
    } catch {}

    // 3. Clear pending sessions
    if (fs.existsSync(PENDING_DIR)) {
      const files = fs.readdirSync(PENDING_DIR).filter(f => f.endsWith('.json'));
      for (const f of files) fs.unlinkSync(path.join(PENDING_DIR, f));
    }

    // 4. Delete all transcript .jsonl files (prevent re-import)
    const os = require('os');
    const HOME_DIR = process.env.USERPROFILE || process.env.HOME || '';
    const PROJECT_NAME = path.basename(PROJECT_ROOT);
    const transcriptDir = HOME_DIR ? path.join(HOME_DIR, '.claude', 'projects', `D--${PROJECT_NAME}`) : null;
    let deletedTranscriptFiles = 0;
    if (transcriptDir && fs.existsSync(transcriptDir)) {
      const files = fs.readdirSync(transcriptDir).filter(f => f.endsWith('.jsonl'));
      for (const f of files) {
        try { fs.unlinkSync(path.join(transcriptDir, f)); deletedTranscriptFiles++; } catch {}
      }
    }

    // 5. Clean up transcriptOffsets from cursor file
    let cursorData = {};
    try { cursorData = JSON.parse(fs.readFileSync(CURSOR_FILE, 'utf-8')); } catch {}
    delete cursorData.transcriptOffsets;
    cursorData.offset = traceLineCount;
    cursorData.updatedAt = new Date().toISOString();
    fs.writeFileSync(CURSOR_FILE, JSON.stringify(cursorData), 'utf-8');

    // 6. Remove cleared-flag (no longer needed — transcript files are gone)
    try { if (fs.existsSync(CLEARED_FLAG_PATH)) fs.unlinkSync(CLEARED_FLAG_PATH); } catch {}

    console.log(`[monitor] All data cleared, ${deletedTranscriptFiles} transcript file(s) deleted`);
    res.json({ ok: true, deletedTranscriptFiles });
  } catch (err) {
    console.error('[monitor] Clear error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pricing — return current pricing info
app.get('/api/pricing', (req, res) => {
  const { getPricingInfo } = require('./pricing');
  res.json(getPricingInfo());
});

app.use('/api', conversationsRouter);
app.use('/api', userMessagesRouter);
app.use('/api', statsRouter);
app.use('/api', symphonyRouter);

// --- Page Routes ---

app.get('/', (req, res) => {
  res.render('index', { activePage: 'list' });
});

app.get('/conversations/:id', (req, res) => {
  res.render('conversation', { convId: req.params.id, activePage: 'list' });
});

app.get('/user-messages/:id', (req, res) => {
  res.render('userMessage', { msgId: req.params.id, activePage: 'list' });
});

app.get('/stats', (req, res) => {
  res.render('stats', { activePage: 'stats' });
});

app.listen(PORT, () => {
  console.log(`Monitor dashboard: http://localhost:${PORT}`);
});
