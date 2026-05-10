const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../data/monitor.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let db;

function initDB() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  db.exec(schema);

  // Migration: rename total_cost_output → total_cost
  try {
    const cols = db.pragma('table_info(conversations)');
    if (cols.some(c => c.name === 'total_cost_output')) {
      db.exec('ALTER TABLE conversations RENAME COLUMN total_cost_output TO total_cost');
    }
  } catch {}

  // Migration: add baseline_cost columns
  try {
    const msgCols = db.pragma('table_info(messages)');
    if (!msgCols.some(c => c.name === 'baseline_cost')) {
      db.exec('ALTER TABLE messages ADD COLUMN baseline_cost REAL');
    }
  } catch {}
  try {
    const convCols = db.pragma('table_info(conversations)');
    if (!convCols.some(c => c.name === 'total_baseline_cost')) {
      db.exec('ALTER TABLE conversations ADD COLUMN total_baseline_cost REAL DEFAULT 0');
    }
  } catch {}
  try {
    const statsCols = db.pragma('table_info(token_daily_stats)');
    if (!statsCols.some(c => c.name === 'total_baseline_cost')) {
      db.exec('ALTER TABLE token_daily_stats ADD COLUMN total_baseline_cost REAL DEFAULT 0');
    }
  } catch {}

  // Migration: add cache_cost to messages (cache cost was being dropped)
  try {
    const msgCols3 = db.pragma('table_info(messages)');
    if (!msgCols3.some(c => c.name === 'cache_cost')) {
      db.exec('ALTER TABLE messages ADD COLUMN cache_cost REAL DEFAULT 0');
    }
  } catch {}

  // Migration: add model to messages (per-message model tracking)
  try {
    const msgCols2 = db.pragma('table_info(messages)');
    if (!msgCols2.some(c => c.name === 'model')) {
      db.exec('ALTER TABLE messages ADD COLUMN model TEXT');
    }
  } catch {}

  // Migration: add agent_name + agent_team to skill_calls
  try {
    const scCols = db.pragma('table_info(skill_calls)');
    if (!scCols.some(c => c.name === 'agent_name')) {
      db.exec('ALTER TABLE skill_calls ADD COLUMN agent_name TEXT');
    }
    if (!scCols.some(c => c.name === 'agent_team')) {
      db.exec('ALTER TABLE skill_calls ADD COLUMN agent_team TEXT');
    }
  } catch {}
  try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_skill_calls_agent ON skill_calls(agent_name)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_skill_calls_agent_team ON skill_calls(agent_team)');
  } catch {}

  // Migration: add restored_from to conversations (session lineage)
  try {
    const convCols2 = db.pragma('table_info(conversations)');
    if (!convCols2.some(c => c.name === 'restored_from')) {
      db.exec('ALTER TABLE conversations ADD COLUMN restored_from TEXT');
    }
  } catch {}

  // Migration: add review_reruns table (re-review trigger tracking)
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='review_reruns'").all();
    if (tables.length === 0) {
      db.exec(`CREATE TABLE review_reruns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        review_path TEXT NOT NULL,
        skill_name TEXT,
        agent_team TEXT,
        round INTEGER DEFAULT 1,
        triggered INTEGER DEFAULT 0,
        p0_count INTEGER DEFAULT 0,
        p1_count INTEGER DEFAULT 0,
        p1_density REAL DEFAULT 0,
        total_issues INTEGER DEFAULT 0,
        total_lines INTEGER DEFAULT 0,
        decision TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`);
      db.exec('CREATE INDEX IF NOT EXISTS idx_review_reruns_skill ON review_reruns(skill_name)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_review_reruns_created ON review_reruns(created_at DESC)');
    }
  } catch {}

  return db;
}

function getDB() {
  if (!db) initDB();
  return db;
}

module.exports = { initDB, getDB };
