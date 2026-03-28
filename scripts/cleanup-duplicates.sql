-- Cleanup SQL: Delete duplicate/moved records before re-seeding
-- Run this BEFORE seeding to avoid stale data

-- ============================================================
-- 1. State Capitals: moved from american-history to geography
-- ============================================================
DELETE FROM items WHERE exercise_id = 'american-history/states/state-capitals';
DELETE FROM exercises WHERE id = 'american-history/states/state-capitals';
DELETE FROM nodes WHERE id = 'american-history/states';

-- ============================================================
-- 2. Literary Characters: merge two exercises into one
-- ============================================================
DELETE FROM items WHERE exercise_id = 'literature/literary-characters/character-to-novel';
DELETE FROM items WHERE exercise_id = 'literature/characters/character-novel';
DELETE FROM exercises WHERE id = 'literature/literary-characters/character-to-novel';
DELETE FROM exercises WHERE id = 'literature/characters/character-novel';
DELETE FROM nodes WHERE id = 'literature/characters';

-- ============================================================
-- 3. Literature Nobel: consolidate under one node
-- ============================================================
DELETE FROM items WHERE exercise_id = 'literature/prizes/nobel-literature';
DELETE FROM exercises WHERE id = 'literature/prizes/nobel-literature';
DELETE FROM nodes WHERE id = 'literature/prizes';

-- ============================================================
-- 4. World History Empires: merge 4 exercises into one
-- ============================================================
DELETE FROM items WHERE exercise_id = 'world-history/historical-empires/major-empires';
DELETE FROM items WHERE exercise_id = 'world-history/historical-empires/historical-empires';
DELETE FROM items WHERE exercise_id = 'world-history/historical-empires/empires';
DELETE FROM items WHERE exercise_id = 'world-history/empires/historical-empires';
DELETE FROM exercises WHERE id = 'world-history/historical-empires/major-empires';
DELETE FROM exercises WHERE id = 'world-history/historical-empires/historical-empires';
DELETE FROM exercises WHERE id = 'world-history/historical-empires/empires';
DELETE FROM exercises WHERE id = 'world-history/empires/historical-empires';
DELETE FROM nodes WHERE id = 'world-history/historical-empires';

-- ============================================================
-- 5. World History Wars: merge 4 exercises into one
-- ============================================================
DELETE FROM items WHERE exercise_id = 'world-history/wars-and-conflicts/major-wars';
DELETE FROM items WHERE exercise_id = 'world-history/major-wars/major-wars-conflicts';
DELETE FROM items WHERE exercise_id = 'world-history/major-wars/major-wars';
DELETE FROM items WHERE exercise_id = 'world-history/wars-conflicts/major-wars';
DELETE FROM exercises WHERE id = 'world-history/wars-and-conflicts/major-wars';
DELETE FROM exercises WHERE id = 'world-history/major-wars/major-wars-conflicts';
DELETE FROM exercises WHERE id = 'world-history/major-wars/major-wars';
DELETE FROM exercises WHERE id = 'world-history/wars-conflicts/major-wars';
DELETE FROM nodes WHERE id = 'world-history/major-wars';
DELETE FROM nodes WHERE id = 'world-history/wars-conflicts';

-- ============================================================
-- 6. World History 20th Century: merge 4 exercises into one
-- ============================================================
DELETE FROM items WHERE exercise_id = 'world-history/20th-century/landmark-events';
DELETE FROM items WHERE exercise_id = 'world-history/20th-century/20th-century-events';
DELETE FROM items WHERE exercise_id = 'world-history/20th-century/world-events';
DELETE FROM items WHERE exercise_id = 'world-history/modern-events/twentieth-century';
DELETE FROM exercises WHERE id = 'world-history/20th-century/landmark-events';
DELETE FROM exercises WHERE id = 'world-history/20th-century/20th-century-events';
DELETE FROM exercises WHERE id = 'world-history/20th-century/world-events';
DELETE FROM exercises WHERE id = 'world-history/modern-events/twentieth-century';
DELETE FROM nodes WHERE id = 'world-history/modern-events';
