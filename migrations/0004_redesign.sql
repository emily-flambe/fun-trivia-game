-- Phase 1 redesign: replace modules/questions with nodes/exercises/items

DROP TABLE IF EXISTS questions;
DROP TABLE IF EXISTS modules;

CREATE TABLE nodes (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES nodes(id),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE exercises (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  format TEXT NOT NULL,
  display_type TEXT,
  config TEXT,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE items (
  id TEXT NOT NULL,
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  answer TEXT NOT NULL,
  alternates TEXT DEFAULT '[]',
  explanation TEXT DEFAULT '',
  data TEXT DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,
  PRIMARY KEY (id, exercise_id)
);

CREATE INDEX idx_nodes_parent ON nodes(parent_id);
CREATE INDEX idx_exercises_node ON exercises(node_id);
CREATE INDEX idx_items_exercise ON items(exercise_id);
