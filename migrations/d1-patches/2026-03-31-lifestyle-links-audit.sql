-- EMI-436: Audit and fix Wikipedia links in Lifestyle category
-- Executed against remote D1 on 2026-03-31
-- 16 items fixed across 3 exercises (86 total items in category)

-- ============================================================
-- 1. Major Philosophers: Remove 13 bogus second links
--    Pattern: description strings formatted as Wikipedia URLs
--    (e.g. "Socratic_method,_never_wrote_anything,_death_by_hemlock")
-- ============================================================

UPDATE items SET data = json_set(data, '$.links', json('[{"text":"Socrates","url":"https://en.wikipedia.org/wiki/Socrates"}]'))
WHERE id = 'socrates' AND exercise_id = 'lifestyle/philosophy/major-philosophers';

UPDATE items SET data = json_set(data, '$.links', json('[{"text":"Plato","url":"https://en.wikipedia.org/wiki/Plato"}]'))
WHERE id = 'plato' AND exercise_id = 'lifestyle/philosophy/major-philosophers';

UPDATE items SET data = json_set(data, '$.links', json('[{"text":"Aristotle","url":"https://en.wikipedia.org/wiki/Aristotle"}]'))
WHERE id = 'aristotle' AND exercise_id = 'lifestyle/philosophy/major-philosophers';

UPDATE items SET data = json_set(data, '$.links', json('[{"text":"René Descartes","url":"https://en.wikipedia.org/wiki/Ren%C3%A9_Descartes"}]'))
WHERE id = 'descartes' AND exercise_id = 'lifestyle/philosophy/major-philosophers';

UPDATE items SET data = json_set(data, '$.links', json('[{"text":"Immanuel Kant","url":"https://en.wikipedia.org/wiki/Immanuel_Kant"}]'))
WHERE id = 'kant' AND exercise_id = 'lifestyle/philosophy/major-philosophers';

UPDATE items SET data = json_set(data, '$.links', json('[{"text":"Friedrich Nietzsche","url":"https://en.wikipedia.org/wiki/Friedrich_Nietzsche"}]'))
WHERE id = 'nietzsche' AND exercise_id = 'lifestyle/philosophy/major-philosophers';

UPDATE items SET data = json_set(data, '$.links', json('[{"text":"Karl Marx","url":"https://en.wikipedia.org/wiki/Karl_Marx"}]'))
WHERE id = 'marx' AND exercise_id = 'lifestyle/philosophy/major-philosophers';

UPDATE items SET data = json_set(data, '$.links', json('[{"text":"David Hume","url":"https://en.wikipedia.org/wiki/David_Hume"}]'))
WHERE id = 'hume' AND exercise_id = 'lifestyle/philosophy/major-philosophers';

UPDATE items SET data = json_set(data, '$.links', json('[{"text":"John Locke","url":"https://en.wikipedia.org/wiki/John_Locke"}]'))
WHERE id = 'locke' AND exercise_id = 'lifestyle/philosophy/major-philosophers';

UPDATE items SET data = json_set(data, '$.links', json('[{"text":"Thomas Hobbes","url":"https://en.wikipedia.org/wiki/Thomas_Hobbes"}]'))
WHERE id = 'hobbes' AND exercise_id = 'lifestyle/philosophy/major-philosophers';

UPDATE items SET data = json_set(data, '$.links', json('[{"text":"Jean-Paul Sartre","url":"https://en.wikipedia.org/wiki/Jean-Paul_Sartre"}]'))
WHERE id = 'sartre' AND exercise_id = 'lifestyle/philosophy/major-philosophers';

UPDATE items SET data = json_set(data, '$.links', json('[{"text":"Simone de Beauvoir","url":"https://en.wikipedia.org/wiki/Simone_de_Beauvoir"}]'))
WHERE id = 'beauvoir' AND exercise_id = 'lifestyle/philosophy/major-philosophers';

UPDATE items SET data = json_set(data, '$.links', json('[{"text":"Confucius","url":"https://en.wikipedia.org/wiki/Confucius"}]'))
WHERE id = 'confucius' AND exercise_id = 'lifestyle/philosophy/major-philosophers';

-- ============================================================
-- 2. Board/Card Games: Fix Risk link (concept article → game article)
-- ============================================================

UPDATE items SET data = json_set(data, '$.links', json('[{"text":"Risk (game)","url":"https://en.wikipedia.org/wiki/Risk_(game)"}]'))
WHERE id = 'risk' AND exercise_id = 'lifestyle/games/board-card-games';

-- ============================================================
-- 3. Birthstones: Fix links pointing to month articles instead of gemstones
-- ============================================================

UPDATE items SET data = json_set(data, '$.links', json('[{"text":"Garnet","url":"https://en.wikipedia.org/wiki/Garnet"}]'))
WHERE id = 'january' AND exercise_id = 'lifestyle/birthstones-anniversaries/birthstones-and-gifts';

UPDATE items SET data = json_set(data, '$.links', json('[{"text":"Ruby","url":"https://en.wikipedia.org/wiki/Ruby"}]'))
WHERE id = 'july' AND exercise_id = 'lifestyle/birthstones-anniversaries/birthstones-and-gifts';
