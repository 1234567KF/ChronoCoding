CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  title TEXT,
  model TEXT,
  total_input_tokens INTEGER DEFAULT 0,
  total_output_tokens INTEGER DEFAULT 0,
  total_cost REAL DEFAULT 0,
  total_baseline_cost REAL DEFAULT 0,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  restored_from TEXT
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
  cache_cost REAL DEFAULT 0,
  baseline_cost REAL,
  model TEXT,
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
  status TEXT DEFAULT 'success',
  agent_name TEXT,
  agent_team TEXT
);

CREATE TABLE IF NOT EXISTS token_daily_stats (
  date TEXT PRIMARY KEY,
  total_input INTEGER DEFAULT 0,
  total_output INTEGER DEFAULT 0,
  cache_hit_input INTEGER DEFAULT 0,
  total_cost REAL DEFAULT 0,
  total_baseline_cost REAL DEFAULT 0,
  skill_breakdown TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS review_reruns (
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
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_skill_calls_message ON skill_calls(message_id);
CREATE INDEX IF NOT EXISTS idx_conversations_started ON conversations(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_reruns_skill ON review_reruns(skill_name);
CREATE INDEX IF NOT EXISTS idx_review_reruns_created ON review_reruns(created_at DESC);
