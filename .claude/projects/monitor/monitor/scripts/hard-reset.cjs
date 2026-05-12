#!/usr/bin/env node
/**
 * hard-reset — 硬删除所有数据，游标置为当前 EOF，历史数据不再进口
 */
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const os = require('os');

const DB_PATH = path.join(__dirname, '..', 'data', 'monitor.db');
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const TRACE_FILE = path.join(PROJECT_ROOT, '.claude-flow', 'data', 'skill-traces.jsonl');
const PENDING_DIR = path.join(PROJECT_ROOT, '.claude-flow', 'data', 'pending-sessions');
const CURSOR_FILE = path.join(PROJECT_ROOT, '.claude-flow', 'data', 'watcher-cursor.json');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// 1. Wipe all tables
db.prepare('DELETE FROM skill_calls').run();
db.prepare('DELETE FROM messages').run();
db.prepare('DELETE FROM token_daily_stats').run();
db.prepare('DELETE FROM conversations').run();
console.log('DB: all tables wiped');

// 2. Clear trace file
try { fs.writeFileSync(TRACE_FILE, '', 'utf-8'); console.log('Trace: cleared'); } catch(e) { console.log('Trace:', e.message); }

// 3. Clear pending sessions
if (fs.existsSync(PENDING_DIR)) {
  const files = fs.readdirSync(PENDING_DIR).filter(f => f.endsWith('.json'));
  for (const f of files) fs.unlinkSync(path.join(PENDING_DIR, f));
  console.log(`Pending: ${files.length} files deleted`);
}

// 4. Set all transcript cursors to current EOF (so history is NOT re-imported)
const HOME = process.env.USERPROFILE || process.env.HOME || '';
const PROJECT_NAME = path.basename(PROJECT_ROOT);
const transcriptDir = HOME ? path.join(HOME, '.claude', 'projects', `D--${PROJECT_NAME}`) : null;
let cursorData = {};
try { cursorData = JSON.parse(fs.readFileSync(CURSOR_FILE, 'utf-8')); } catch {}
if (!cursorData.transcriptOffsets) cursorData.transcriptOffsets = {};

if (transcriptDir && fs.existsSync(transcriptDir)) {
  const tfiles = fs.readdirSync(transcriptDir).filter(f => f.endsWith('.jsonl'));
  for (const f of tfiles) {
    const sid = f.replace('.jsonl', '');
    const tp = path.join(transcriptDir, f);
    try {
      const lines = fs.readFileSync(tp, 'utf-8').split('\n').filter(Boolean).length;
      const mtimeMs = fs.statSync(tp).mtimeMs;
      cursorData.transcriptOffsets[sid] = { offset: lines, mtimeMs };
    } catch (e) {
      console.log(`  skip ${sid.slice(0, 16)}: ${e.message}`);
    }
  }
  console.log(`Cursors: ${tfiles.length} set to EOF`);
}
cursorData.offset = 0;
cursorData.updatedAt = new Date().toISOString();
fs.writeFileSync(CURSOR_FILE, JSON.stringify(cursorData), 'utf-8');

db.close();
console.log('Hard reset complete — only new transcript lines will be imported from now on');
