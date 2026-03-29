-- Add retry tracking columns to quiz_results
ALTER TABLE quiz_results ADD COLUMN is_retry INTEGER NOT NULL DEFAULT 0;
ALTER TABLE quiz_results ADD COLUMN parent_result_id TEXT;
