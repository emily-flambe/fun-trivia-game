-- Trivia Trainer D1 Schema

CREATE TABLE IF NOT EXISTS modules (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK(category IN ('geography','history','science','literature','entertainment','sports')),
  name TEXT NOT NULL,
  tier TEXT NOT NULL CHECK(tier IN ('foundation','core','advanced')),
  description TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK(question_type IN ('type-in','multiple-choice','matching'))
);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT NOT NULL,
  module_id TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('type-in','multiple-choice','matching')),
  question TEXT NOT NULL,
  answer TEXT,
  alternate_answers TEXT DEFAULT '[]',
  options TEXT,
  correct_index INTEGER,
  pairs TEXT,
  explanation TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  PRIMARY KEY (id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_questions_module ON questions(module_id);
CREATE INDEX IF NOT EXISTS idx_modules_category ON modules(category);
CREATE INDEX IF NOT EXISTS idx_modules_tier ON modules(tier);
