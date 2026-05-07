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

  return db;
}

function getDB() {
  if (!db) initDB();
  return db;
}

module.exports = { initDB, getDB };
