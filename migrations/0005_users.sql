-- User accounts and quiz result history

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT DEFAULT '',
  preferences TEXT DEFAULT '{}',
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE TABLE quiz_results (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL,
  exercise_name TEXT NOT NULL,
  format TEXT NOT NULL,
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  duration_seconds INTEGER,
  items_detail TEXT DEFAULT '[]',
  completed_at TEXT NOT NULL
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_quiz_results_user ON quiz_results(user_id);
CREATE INDEX idx_quiz_results_completed ON quiz_results(completed_at);
