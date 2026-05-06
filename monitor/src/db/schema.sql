CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  title TEXT,
  total_input_tokens INTEGER DEFAULT 0,
  total_output_tokens INTEGER DEFAULT 0,
  total_cost_output REAL DEFAULT 0,
  started_at TEXT NOT NULL,
  ended_at TEXT
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  role TEXT NOT NULL CHECK(role IN ('user','assistant')),
  content TEXT,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cache_hit INTEGER,
  input_cost REAL,
  output_cost REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS skill_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL REFERENCES messages(id),
  skill_name TEXT NOT NULL,
  skill_type TEXT DEFAULT 'local',
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  duration_ms INTEGER,
  status TEXT DEFAULT 'success'
);

CREATE TABLE IF NOT EXISTS token_daily_stats (
  date TEXT PRIMARY KEY,
  total_input INTEGER DEFAULT 0,
  total_output INTEGER DEFAULT 0,
  cache_hit_input INTEGER DEFAULT 0,
  total_cost REAL DEFAULT 0,
  skill_breakdown TEXT DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_skill_calls_message ON skill_calls(message_id);
CREATE INDEX IF NOT EXISTS idx_conversations_started ON conversations(started_at DESC);
