-- Trivia Trainer — Current D1 Schema
-- Auto-generated reference. Source of truth: migrations/*.sql
-- Last updated: 2026-03-30

--------------------------------------------------------------------------------
-- CONTENT TABLES (migration 0004_redesign.sql)
--------------------------------------------------------------------------------

CREATE TABLE nodes (
  id TEXT PRIMARY KEY,                       -- slash-separated path, e.g. "science/chemistry"
  parent_id TEXT REFERENCES nodes(id),       -- NULL for root categories
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE exercises (
  id TEXT PRIMARY KEY,                       -- e.g. "science/chemistry/element-symbols"
  node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  format TEXT NOT NULL,                      -- 'text-entry' | 'fill-blanks'
  display_type TEXT,                         -- 'cards' (default) | 'periodic-table' | 'map' | 'timeline'
  config TEXT,                               -- JSON: { ordered?: boolean, prompt?: string }
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE items (
  id TEXT NOT NULL,                          -- slug, e.g. "hydrogen"
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  answer TEXT NOT NULL,                      -- canonical answer
  alternates TEXT DEFAULT '[]',              -- JSON array of alternate accepted spellings
  explanation TEXT DEFAULT '',               -- shown after answering
  data TEXT DEFAULT '{}',                    -- JSON: see "items.data shape" below
  sort_order INTEGER DEFAULT 0,
  PRIMARY KEY (id, exercise_id)
);

-- IMPORTANT: items.data JSON column shape
--
-- The prompt, cardFront, cardBack, and links fields are NOT top-level columns.
-- They live inside the `data` JSON column.
--
-- text-entry items:
--   { "prompt": "Question?", "cardFront": "...", "cardBack": "...",
--     "links": [{"text": "...", "url": "..."}] }
--
-- fill-blanks items:
--   { "label": "Category label" }
--
-- To query:  SELECT json_extract(data, '$.prompt') FROM items
-- To update: UPDATE items SET data = json_set(data, '$.prompt', 'New?') WHERE ...

--------------------------------------------------------------------------------
-- USER TABLES (migration 0005_users.sql + 0006_retry_tracking.sql)
--------------------------------------------------------------------------------

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT DEFAULT '',
  preferences TEXT DEFAULT '{}',             -- JSON user preferences
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE TABLE quiz_results (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL,
  exercise_name TEXT NOT NULL,
  format TEXT NOT NULL,                      -- 'text-entry' | 'fill-blanks'
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  duration_seconds INTEGER,
  items_detail TEXT DEFAULT '[]',            -- JSON array of per-item results
  completed_at TEXT NOT NULL,
  is_retry INTEGER NOT NULL DEFAULT 0,       -- 0006: retry tracking
  parent_result_id TEXT                      -- 0006: references quiz_results(id) for retries
);

--------------------------------------------------------------------------------
-- INDEXES
--------------------------------------------------------------------------------

CREATE INDEX idx_nodes_parent ON nodes(parent_id);
CREATE INDEX idx_exercises_node ON exercises(node_id);
CREATE INDEX idx_items_exercise ON items(exercise_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_quiz_results_user ON quiz_results(user_id);
CREATE INDEX idx_quiz_results_completed ON quiz_results(completed_at);
