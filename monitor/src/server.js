const express = require('express');
const path = require('path');
const layouts = require('express-ejs-layouts');
const { initDB } = require('./db');
const { saveRecord } = require('./collector');
const conversationsRouter = require('./api/conversations');
const statsRouter = require('./api/stats');

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
initDB();

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
