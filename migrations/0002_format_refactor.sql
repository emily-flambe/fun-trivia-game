-- Rename question_type to default_format on modules
-- Add answer column as NOT NULL (all questions must have a text answer)
-- Rename pairs to match_pairs for clarity
-- Drop the old type column from questions (format is session-level, not per-question)

-- Since D1/SQLite doesn't support ALTER COLUMN or RENAME COLUMN in all cases,
-- we recreate the tables with the new schema.

-- Step 1: Recreate modules with default_format
CREATE TABLE IF NOT EXISTS modules_new (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK(category IN ('geography','history','science','literature','entertainment','sports')),
  name TEXT NOT NULL,
  tier TEXT NOT NULL CHECK(tier IN ('foundation','core','advanced')),
  description TEXT NOT NULL,
  default_format TEXT NOT NULL DEFAULT 'text-entry' CHECK(default_format IN ('text-entry','multiple-choice','true-false','matching','select-many','ordered-list'))
);

INSERT INTO modules_new (id, category, name, tier, description, default_format)
SELECT id, category, name, tier, description,
  CASE question_type
    WHEN 'type-in' THEN 'text-entry'
    WHEN 'multiple-choice' THEN 'multiple-choice'
    WHEN 'matching' THEN 'matching'
    ELSE 'text-entry'
  END
FROM modules;

DROP TABLE modules;
ALTER TABLE modules_new RENAME TO modules;

-- Step 2: Recreate questions with unified schema
CREATE TABLE IF NOT EXISTS questions_new (
  id TEXT NOT NULL,
  module_id TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  alternate_answers TEXT DEFAULT '[]',
  options TEXT,
  correct_index INTEGER,
  match_pairs TEXT,
  explanation TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  PRIMARY KEY (id, module_id)
);

INSERT INTO questions_new (id, module_id, question, answer, alternate_answers, options, correct_index, match_pairs, explanation, sort_order)
SELECT id, module_id, question, COALESCE(answer, ''), alternate_answers, options, correct_index, pairs, explanation, sort_order
FROM questions;

DROP TABLE questions;
ALTER TABLE questions_new RENAME TO questions;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_questions_module ON questions(module_id);
CREATE INDEX IF NOT EXISTS idx_modules_category ON modules(category);
CREATE INDEX IF NOT EXISTS idx_modules_tier ON modules(tier);
