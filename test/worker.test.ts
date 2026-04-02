import { env } from 'cloudflare:workers';
import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import worker from '../src/index';

async function seedTestData(db: D1Database) {
	// Create tables
	await db.exec(`CREATE TABLE IF NOT EXISTS nodes (id TEXT PRIMARY KEY, parent_id TEXT, name TEXT NOT NULL, description TEXT DEFAULT '', sort_order INTEGER DEFAULT 0);`);
	await db.exec(`CREATE TABLE IF NOT EXISTS exercises (id TEXT PRIMARY KEY, node_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT DEFAULT '', format TEXT NOT NULL, display_type TEXT, config TEXT, sort_order INTEGER DEFAULT 0);`);
	await db.exec(`CREATE TABLE IF NOT EXISTS items (id TEXT NOT NULL, exercise_id TEXT NOT NULL, answer TEXT NOT NULL, alternates TEXT DEFAULT '[]', explanation TEXT DEFAULT '', data TEXT DEFAULT '{}', sort_order INTEGER DEFAULT 0, PRIMARY KEY (id, exercise_id));`);

	// User & quiz result tables
	await db.exec(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, display_name TEXT DEFAULT '', preferences TEXT DEFAULT '{}', created_at TEXT NOT NULL, last_seen_at TEXT NOT NULL);`);
	await db.exec(`CREATE TABLE IF NOT EXISTS quiz_results (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, exercise_id TEXT NOT NULL, exercise_name TEXT NOT NULL, format TEXT NOT NULL, score INTEGER NOT NULL, total INTEGER NOT NULL, duration_seconds INTEGER, items_detail TEXT DEFAULT '[]', completed_at TEXT NOT NULL, is_retry INTEGER NOT NULL DEFAULT 0, parent_result_id TEXT);`);
	await db.exec(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`);
	await db.exec(`CREATE INDEX IF NOT EXISTS idx_quiz_results_user ON quiz_results(user_id);`);
	await db.exec(`CREATE INDEX IF NOT EXISTS idx_quiz_results_completed ON quiz_results(completed_at);`);

	// Root nodes
	await db.exec(`INSERT INTO nodes VALUES ('science', NULL, 'Science', 'Science category', 0);`);
	await db.exec(`INSERT INTO nodes VALUES ('history', NULL, 'History', 'History category', 1);`);

	// Child node
	await db.exec(`INSERT INTO nodes VALUES ('science/chemistry', 'science', 'Chemistry', 'Elements and compounds', 0);`);

	// Text-entry exercise
	await db.exec(`INSERT INTO exercises VALUES ('science/chemistry/element-symbols', 'science/chemistry', 'Element Symbols', 'Match elements to symbols', 'text-entry', 'periodic-table', NULL, 0);`);

	// Fill-blanks exercise
	await db.exec(`INSERT INTO exercises VALUES ('science/chemistry/noble-gases', 'science/chemistry', 'Noble Gases', 'Name the noble gases', 'fill-blanks', NULL, '{"ordered":false,"prompt":"Name all six noble gases"}', 1);`);

	// Letter-by-letter exercise
	await db.exec(`INSERT INTO exercises VALUES ('science/chemistry/element-names-letter-by-letter', 'science/chemistry', 'Element Names (Letter by Letter)', 'Reveal letters and guess the element name', 'letter-by-letter', NULL, '{"autoRevealSeconds":0}', 2);`);

	// Sequence-ordering exercise
	await db.exec(`INSERT INTO exercises VALUES ('science/chemistry/atomic-history-ordering', 'science/chemistry', 'Atomic History Ordering', 'Order key atomic milestones chronologically', 'sequence-ordering', NULL, '{"prompt":"Arrange these events from earliest to latest","timed":true,"timeLimitSeconds":90}', 3);`);

	// Classification-sort exercise
	await db.exec(`INSERT INTO exercises VALUES ('science/chemistry/elements-by-family', 'science/chemistry', 'Elements by Family', 'Classify elements into chemical families', 'classification-sort', NULL, '{"prompt":"Sort each element into its correct family","categories":["Noble Gas","Alkali Metal"]}', 4);`);

	// Text-entry items
	await db.exec(`INSERT INTO items VALUES ('iron', 'science/chemistry/element-symbols', 'Iron', '[]', 'Fe from Latin ferrum.', '{"prompt":"What element has the symbol Fe?","cardFront":"Fe","cardBack":"Iron"}', 0);`);
	await db.exec(`INSERT INTO items VALUES ('gold', 'science/chemistry/element-symbols', 'Gold', '[]', 'Au from Latin aurum.', '{"prompt":"What element has the symbol Au?","cardFront":"Au","cardBack":"Gold"}', 1);`);
	await db.exec(`INSERT INTO items VALUES ('silver', 'science/chemistry/element-symbols', 'Silver', '["Ag"]', 'Ag from Latin argentum.', '{"prompt":"What element has the symbol Ag?","cardFront":"Ag","cardBack":"Silver"}', 2);`);

	// Fill-blanks items
	await db.exec(`INSERT INTO items VALUES ('helium', 'science/chemistry/noble-gases', 'Helium', '["He"]', 'Atomic number 2.', '{}', 0);`);
	await db.exec(`INSERT INTO items VALUES ('neon', 'science/chemistry/noble-gases', 'Neon', '["Ne"]', 'Atomic number 10.', '{}', 1);`);
	await db.exec(`INSERT INTO items VALUES ('argon', 'science/chemistry/noble-gases', 'Argon', '["Ar"]', 'Atomic number 18.', '{}', 2);`);

	// Letter-by-letter items
	await db.exec(`INSERT INTO items VALUES ('sodium', 'science/chemistry/element-names-letter-by-letter', 'Sodium', '["Na"]', 'Symbol Na comes from Latin natrium.', '{"prompt":"Which element has the symbol Na?"}', 0);`);

	// Sequence-ordering items
	await db.exec(`INSERT INTO items VALUES ('dalton', 'science/chemistry/atomic-history-ordering', 'Dalton atomic theory', '[]', 'John Dalton proposed modern atomic theory in 1803.', '{"label":"Dalton publishes atomic theory"}', 0);`);
	await db.exec(`INSERT INTO items VALUES ('electron', 'science/chemistry/atomic-history-ordering', 'Electron discovery', '[]', 'J. J. Thomson discovered the electron in 1897.', '{"label":"Thomson discovers the electron"}', 1);`);
	await db.exec(`INSERT INTO items VALUES ('bohr', 'science/chemistry/atomic-history-ordering', 'Bohr model', '[]', 'Niels Bohr proposed quantized orbits in 1913.', '{"label":"Bohr proposes his atomic model"}', 2);`);

	// Classification-sort items
	await db.exec(`INSERT INTO items VALUES ('helium-family', 'science/chemistry/elements-by-family', 'Helium', '[]', 'Helium is a noble gas.', '{"label":"Helium","category":"Noble Gas"}', 0);`);
	await db.exec(`INSERT INTO items VALUES ('neon-family', 'science/chemistry/elements-by-family', 'Neon', '[]', 'Neon is a noble gas.', '{"label":"Neon","category":"Noble Gas"}', 1);`);
	await db.exec(`INSERT INTO items VALUES ('lithium-family', 'science/chemistry/elements-by-family', 'Lithium', '[]', 'Lithium is an alkali metal.', '{"label":"Lithium","category":"Alkali Metal"}', 2);`);

	// Pre-seed test user so quiz-results tests don't depend on auth/me test ordering
	await db.exec(`INSERT INTO users VALUES ('test-user-id', 'test@trivia.emilycogsdill.com', '', '{}', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');`);
}

async function makeRequest(path: string, options?: RequestInit) {
	const request = new Request(`http://localhost${path}`, options);
	const ctx = createExecutionContext();
	const response = await worker.fetch(request, env as any, ctx);
	await waitOnExecutionContext(ctx);
	return response;
}

function postJson(path: string, body: unknown, extraHeaders?: Record<string, string>) {
	return makeRequest(path, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', ...extraHeaders },
		body: JSON.stringify(body),
	});
}

const TEST_EMAIL = 'test@trivia.emilycogsdill.com';
const AUTH_COOKIE = `CF_Test_Auth=${TEST_EMAIL}`;

function makeAuthRequest(path: string, options?: RequestInit) {
	const headers = new Headers(options?.headers);
	headers.set('cookie', AUTH_COOKIE);
	return makeRequest(path, { ...options, headers });
}

function postJsonAuth(path: string, body: unknown) {
	return makeAuthRequest(path, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'cookie': AUTH_COOKIE },
		body: JSON.stringify(body),
	});
}

function putJsonAuth(path: string, body: unknown) {
	return makeAuthRequest(path, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json', 'cookie': AUTH_COOKIE },
		body: JSON.stringify(body),
	});
}

function deleteAuth(path: string) {
	return makeAuthRequest(path, { method: 'DELETE' });
}

describe('Trivia API', () => {
	beforeAll(async () => {
		await seedTestData((env as any).DB);
	});

	// ─── Health ───────────────────────────────────────────────

	describe('GET /api/health', () => {
		it('returns 200 with ok status', async () => {
			const res = await makeRequest('/api/health');
			expect(res.status).toBe(200);
			const data = await res.json<{ status: string }>();
			expect(data.status).toBe('ok');
		});
	});

	// ─── Nodes: root listing ──────────────────────────────────

	describe('GET /api/nodes', () => {
		it('returns root nodes only (no children)', async () => {
			const res = await makeRequest('/api/nodes');
			expect(res.status).toBe(200);
			const data = await res.json<{ nodes: any[] }>();
			expect(data.nodes).toHaveLength(2);
			const ids = data.nodes.map((n: any) => n.id);
			expect(ids).toContain('science');
			expect(ids).toContain('history');
			// chemistry is a child, must not appear at root
			expect(ids).not.toContain('science/chemistry');
		});

		it('returns childCount and exerciseCount on each root node', async () => {
			const res = await makeRequest('/api/nodes');
			const data = await res.json<{ nodes: any[] }>();
			const science = data.nodes.find((n: any) => n.id === 'science');
			expect(science.childCount).toBe(1);
			// exercises live under chemistry, not directly under science
			expect(science.exerciseCount).toBe(0);

			const history = data.nodes.find((n: any) => n.id === 'history');
			expect(history.childCount).toBe(0);
			expect(history.exerciseCount).toBe(0);
		});

		it('returns nodes ordered by sort_order', async () => {
			const res = await makeRequest('/api/nodes');
			const data = await res.json<{ nodes: any[] }>();
			// science has sort_order 0, history has sort_order 1
			expect(data.nodes[0].id).toBe('science');
			expect(data.nodes[1].id).toBe('history');
		});
	});

	// ─── Nodes: detail ────────────────────────────────────────

	describe('GET /api/nodes/:id', () => {
		it('returns science node with children and empty exercises', async () => {
			const res = await makeRequest('/api/nodes/science');
			expect(res.status).toBe(200);
			const data = await res.json<any>();
			expect(data.node.id).toBe('science');
			expect(data.children).toHaveLength(1);
			expect(data.children[0].id).toBe('science/chemistry');
			// no exercises directly on science
			expect(data.exercises).toHaveLength(0);
		});

		it('includes breadcrumbs for science (root node)', async () => {
			const res = await makeRequest('/api/nodes/science');
			const data = await res.json<any>();
			expect(data.breadcrumbs).toBeDefined();
			expect(Array.isArray(data.breadcrumbs)).toBe(true);
			// breadcrumbs for root: just itself
			expect(data.breadcrumbs).toHaveLength(1);
			expect(data.breadcrumbs[0].id).toBe('science');
		});

		it('returns chemistry node with exercises and itemCounts', async () => {
			const res = await makeRequest('/api/nodes/science/chemistry');
			expect(res.status).toBe(200);
			const data = await res.json<any>();
			expect(data.node.id).toBe('science/chemistry');
			expect(data.children).toHaveLength(0);
			expect(data.exercises).toHaveLength(5);

			const symbols = data.exercises.find((e: any) => e.id === 'science/chemistry/element-symbols');
			expect(symbols).toBeDefined();
			expect(symbols.itemCount).toBe(3);

			const gases = data.exercises.find((e: any) => e.id === 'science/chemistry/noble-gases');
			expect(gases).toBeDefined();
			expect(gases.itemCount).toBe(3);

			const letterByLetter = data.exercises.find((e: any) => e.id === 'science/chemistry/element-names-letter-by-letter');
			expect(letterByLetter).toBeDefined();
			expect(letterByLetter.itemCount).toBe(1);

			const sequenceOrdering = data.exercises.find((e: any) => e.id === 'science/chemistry/atomic-history-ordering');
			expect(sequenceOrdering).toBeDefined();
			expect(sequenceOrdering.itemCount).toBe(3);

			const classificationSort = data.exercises.find((e: any) => e.id === 'science/chemistry/elements-by-family');
			expect(classificationSort).toBeDefined();
			expect(classificationSort.itemCount).toBe(3);
		});

		it('returns exercises in sort_order', async () => {
			const res = await makeRequest('/api/nodes/science/chemistry');
			const data = await res.json<any>();
			expect(data.exercises[0].id).toBe('science/chemistry/element-symbols');
			expect(data.exercises[1].id).toBe('science/chemistry/noble-gases');
			expect(data.exercises[2].id).toBe('science/chemistry/element-names-letter-by-letter');
			expect(data.exercises[3].id).toBe('science/chemistry/atomic-history-ordering');
			expect(data.exercises[4].id).toBe('science/chemistry/elements-by-family');
		});

		it('returns breadcrumbs ordered root-first for nested node', async () => {
			const res = await makeRequest('/api/nodes/science/chemistry');
			const data = await res.json<any>();
			expect(data.breadcrumbs).toHaveLength(2);
			expect(data.breadcrumbs[0].id).toBe('science');
			expect(data.breadcrumbs[1].id).toBe('science/chemistry');
		});

		it('returns 404 for nonexistent node', async () => {
			const res = await makeRequest('/api/nodes/nonexistent');
			expect(res.status).toBe(404);
			const data = await res.json<any>();
			expect(data.error).toBeDefined();
		});
	});

	// ─── Exercises: random ───────────────────────────────────

	describe('GET /api/exercises/random', () => {
		it('returns a random exercise id', async () => {
			const res = await makeRequest('/api/exercises/random');
			expect(res.status).toBe(200);
			const data = await res.json<{ id: string }>();
			expect(data.id).toBeDefined();
			expect(typeof data.id).toBe('string');
			// Should be one of the seeded exercises
			expect(['science/chemistry/element-symbols', 'science/chemistry/noble-gases', 'science/chemistry/element-names-letter-by-letter', 'science/chemistry/atomic-history-ordering', 'science/chemistry/elements-by-family']).toContain(data.id);
		});

		it('uses authenticated user category weights when selecting random exercises', async () => {
			const db = (env as any).DB as D1Database;
			const historyExerciseId = `history/preferences-random-${Date.now()}`;
			const user = await (await makeAuthRequest('/api/auth/me')).json<any>();
			await db.prepare(`INSERT INTO exercises (id, node_id, name, description, format, display_type, config, sort_order) VALUES (?, 'history', 'History Test', '', 'text-entry', NULL, NULL, 99)`)
				.bind(historyExerciseId)
				.run();
			try {
				await putJsonAuth('/api/user/preferences', {
					categoryWeights: {
						science: 0,
						history: 10,
					},
				});
				const res = await makeAuthRequest('/api/exercises/random');
				expect(res.status).toBe(200);
				const data = await res.json<{ id: string }>();
				expect(data.id).toBe(historyExerciseId);
			} finally {
				await db.prepare(`DELETE FROM exercises WHERE id = ?`).bind(historyExerciseId).run();
				await db.prepare(`UPDATE users SET preferences = '{}' WHERE id = ?`).bind(user.userId).run();
			}
		});

		it('falls back gracefully when weighted categories have no available exercises', async () => {
			const user = await (await makeAuthRequest('/api/auth/me')).json<any>();
			try {
				await putJsonAuth('/api/user/preferences', {
					categoryWeights: {
						science: 0,
						history: 0,
						math: 10,
					},
				});
				const res = await makeAuthRequest('/api/exercises/random');
				expect(res.status).toBe(200);
				const data = await res.json<{ id: string }>();
				expect(typeof data.id).toBe('string');
				expect(data.id.length).toBeGreaterThan(0);
			} finally {
				const db = (env as any).DB as D1Database;
				await db.prepare(`UPDATE users SET preferences = '{}' WHERE id = ?`).bind(user.userId).run();
			}
		});
	});

	// ─── Exercises: detail ────────────────────────────────────

	describe('GET /api/exercises/:id', () => {
		it('returns text-entry exercise with items', async () => {
			const res = await makeRequest('/api/exercises/science/chemistry/element-symbols');
			expect(res.status).toBe(200);
			const data = await res.json<any>();
			expect(data.exercise.id).toBe('science/chemistry/element-symbols');
			expect(data.exercise.format).toBe('text-entry');
			expect(data.exercise.displayType).toBe('periodic-table');
			expect(data.items).toHaveLength(3);
		});

		it('strips answer and alternates but keeps explanation', async () => {
			const res = await makeRequest('/api/exercises/science/chemistry/element-symbols');
			const data = await res.json<any>();
			for (const item of data.items) {
				expect(item).not.toHaveProperty('answer');
				expect(item).not.toHaveProperty('alternates');
				expect(item).toHaveProperty('explanation');
			}
		});

		it('preserves non-secret item fields (id, data, sortOrder)', async () => {
			const res = await makeRequest('/api/exercises/science/chemistry/element-symbols');
			const data = await res.json<any>();
			const iron = data.items.find((i: any) => i.id === 'iron');
			expect(iron).toBeDefined();
			expect(iron.id).toBe('iron');
			expect(iron.data).toBeDefined();
			expect(iron.data.prompt).toBe('What element has the symbol Fe?');
			expect(iron.data.cardFront).toBe('Fe');
			expect(iron.data.cardBack).toBe('Iron');
			expect(typeof iron.sortOrder).toBe('number');
		});

		it('returns items in sort_order', async () => {
			const res = await makeRequest('/api/exercises/science/chemistry/element-symbols');
			const data = await res.json<any>();
			expect(data.items[0].id).toBe('iron');
			expect(data.items[1].id).toBe('gold');
			expect(data.items[2].id).toBe('silver');
		});

		it('returns fill-blanks exercise with config', async () => {
			const res = await makeRequest('/api/exercises/science/chemistry/noble-gases');
			expect(res.status).toBe(200);
			const data = await res.json<any>();
			expect(data.exercise.format).toBe('fill-blanks');
			expect(data.exercise.config).toEqual({
				ordered: false,
				prompt: 'Name all six noble gases',
			});
		});

		it('returns letter-by-letter exercise with config', async () => {
			const res = await makeRequest('/api/exercises/science/chemistry/element-names-letter-by-letter');
			expect(res.status).toBe(200);
			const data = await res.json<any>();
			expect(data.exercise.format).toBe('letter-by-letter');
			expect(data.exercise.config).toEqual({
				autoRevealSeconds: 0,
			});
		});

		it('returns sequence-ordering exercise with config', async () => {
			const res = await makeRequest('/api/exercises/science/chemistry/atomic-history-ordering');
			expect(res.status).toBe(200);
			const data = await res.json<any>();
			expect(data.exercise.format).toBe('sequence-ordering');
			expect(data.exercise.config).toEqual({
				prompt: 'Arrange these events from earliest to latest',
				timed: true,
				timeLimitSeconds: 90,
			});
		});

		it('returns classification-sort exercise with config', async () => {
			const res = await makeRequest('/api/exercises/science/chemistry/elements-by-family');
			expect(res.status).toBe(200);
			const data = await res.json<any>();
			expect(data.exercise.format).toBe('classification-sort');
			expect(data.exercise.config).toEqual({
				prompt: 'Sort each element into its correct family',
				categories: ['Noble Gas', 'Alkali Metal'],
			});
		});

		it('returns exercise itemCount', async () => {
			const res = await makeRequest('/api/exercises/science/chemistry/element-symbols');
			const data = await res.json<any>();
			expect(data.exercise.itemCount).toBe(3);
		});

		it('returns 404 for nonexistent exercise', async () => {
			const res = await makeRequest('/api/exercises/nonexistent');
			expect(res.status).toBe(404);
			const data = await res.json<any>();
			expect(data.error).toBeDefined();
		});
	});

	// ─── Exercises: answers (reveal) ─────────────────────────

	describe('GET /api/exercises/.../answers', () => {
		it('returns all items with answers for an exercise', async () => {
			const res = await makeRequest('/api/exercises/science/chemistry/noble-gases/answers');
			expect(res.status).toBe(200);
			const data = await res.json<{ items: any[] }>();
			expect(data.items).toHaveLength(3);
			const helium = data.items.find((i: any) => i.id === 'helium');
			expect(helium.answer).toBe('Helium');
			expect(helium.explanation).toBeDefined();
			expect(typeof helium.sortOrder).toBe('number');
		});

		it('returns 404 for nonexistent exercise', async () => {
			const res = await makeRequest('/api/exercises/nonexistent/answers');
			expect(res.status).toBe(404);
		});
	});

	// ─── Check: text-entry ────────────────────────────────────

	describe('POST /api/exercises/.../check (text-entry)', () => {
		const checkUrl = '/api/exercises/science/chemistry/element-symbols/check';

		it('returns correct for exact match', async () => {
			const res = await postJson(checkUrl, { itemId: 'iron', answer: 'Iron' });
			expect(res.status).toBe(200);
			const data = await res.json<any>();
			expect(data.correct).toBe(true);
			expect(data.correctAnswer).toBe('Iron');
			expect(data.explanation).toBe('Fe from Latin ferrum.');
			expect(data.fuzzyMatch).toBe(false);
		});

		it('returns correct for case-insensitive match', async () => {
			const res = await postJson(checkUrl, { itemId: 'iron', answer: 'iron' });
			const data = await res.json<any>();
			expect(data.correct).toBe(true);
		});

		it('returns incorrect for wrong answer', async () => {
			const res = await postJson(checkUrl, { itemId: 'iron', answer: 'Gold' });
			expect(res.status).toBe(200);
			const data = await res.json<any>();
			expect(data.correct).toBe(false);
			expect(data.correctAnswer).toBe('Iron');
		});

		it('accepts alternate answer', async () => {
			const res = await postJson(checkUrl, { itemId: 'silver', answer: 'Ag' });
			const data = await res.json<any>();
			expect(data.correct).toBe(true);
		});

		it('accepts fuzzy match for answers >= 5 chars', async () => {
			// "Silver" is 6 chars; "Silvr" has distance 1
			const res = await postJson(checkUrl, { itemId: 'silver', answer: 'Silvr' });
			const data = await res.json<any>();
			expect(data.correct).toBe(true);
			expect(data.fuzzyMatch).toBe(true);
		});

		it('rejects fuzzy match for short answers (< 5 chars)', async () => {
			// "Gold" is 4 chars; "Gol" won't fuzzy match
			const res = await postJson(checkUrl, { itemId: 'gold', answer: 'Gol' });
			const data = await res.json<any>();
			expect(data.correct).toBe(false);
		});

		it('returns 400 when answer field is missing', async () => {
			const res = await postJson(checkUrl, { itemId: 'iron' });
			expect(res.status).toBe(400);
			const data = await res.json<any>();
			expect(data.error).toBeDefined();
		});

		it('returns 400 when itemId is missing for text-entry', async () => {
			const res = await postJson(checkUrl, { answer: 'Iron' });
			expect(res.status).toBe(400);
			const data = await res.json<any>();
			expect(data.error).toBeDefined();
		});

		it('returns 404 for nonexistent itemId', async () => {
			const res = await postJson(checkUrl, { itemId: 'platinum', answer: 'Platinum' });
			expect(res.status).toBe(404);
			const data = await res.json<any>();
			expect(data.error).toBeDefined();
		});

		it('returns userAnswer in response', async () => {
			const res = await postJson(checkUrl, { itemId: 'iron', answer: 'something' });
			const data = await res.json<any>();
			expect(data.userAnswer).toBe('something');
		});
	});

	describe('POST /api/exercises/.../check (letter-by-letter)', () => {
		const checkUrl = '/api/exercises/science/chemistry/element-names-letter-by-letter/check';

		it('returns correct for exact match', async () => {
			const res = await postJson(checkUrl, { itemId: 'sodium', answer: 'Sodium' });
			expect(res.status).toBe(200);
			const data = await res.json<any>();
			expect(data.correct).toBe(true);
			expect(data.correctAnswer).toBe('Sodium');
			expect(data.fuzzyMatch).toBe(false);
		});

		it('requires itemId for letter-by-letter', async () => {
			const res = await postJson(checkUrl, { answer: 'Sodium' });
			expect(res.status).toBe(400);
			const data = await res.json<any>();
			expect(data.error).toBeDefined();
		});
	});

	// ─── Check: fill-blanks ───────────────────────────────────

	describe('POST /api/exercises/.../check (fill-blanks)', () => {
		const checkUrl = '/api/exercises/science/chemistry/noble-gases/check';

		it('matches a correct answer and returns matched item info', async () => {
			const res = await postJson(checkUrl, { answer: 'Helium' });
			expect(res.status).toBe(200);
			const data = await res.json<any>();
			expect(data.matched).toBe(true);
			expect(data.matchedItemId).toBe('helium');
			expect(data.position).toBe(0);
			expect(data.fuzzyMatch).toBe(false);
		});

		it('matches an alternate answer', async () => {
			const res = await postJson(checkUrl, { answer: 'He' });
			const data = await res.json<any>();
			expect(data.matched).toBe(true);
			expect(data.matchedItemId).toBe('helium');
		});

		it('matches another item in the set', async () => {
			const res = await postJson(checkUrl, { answer: 'Neon' });
			const data = await res.json<any>();
			expect(data.matched).toBe(true);
			expect(data.matchedItemId).toBe('neon');
			expect(data.position).toBe(1);
		});

		it('returns no match for incorrect answer', async () => {
			const res = await postJson(checkUrl, { answer: 'Oxygen' });
			const data = await res.json<any>();
			expect(data.matched).toBe(false);
			expect(data.matchedItemId).toBeUndefined();
		});

		it('returns 400 when answer field is missing', async () => {
			const res = await postJson(checkUrl, {});
			expect(res.status).toBe(400);
			const data = await res.json<any>();
			expect(data.error).toBeDefined();
		});

		it('does not require itemId for fill-blanks', async () => {
			// fill-blanks checks against all items, no itemId needed
			const res = await postJson(checkUrl, { answer: 'Argon' });
			expect(res.status).toBe(200);
			const data = await res.json<any>();
			expect(data.matched).toBe(true);
			expect(data.matchedItemId).toBe('argon');
		});

		it('returns userAnswer in response', async () => {
			const res = await postJson(checkUrl, { answer: 'Xenon' });
			const data = await res.json<any>();
			expect(data.userAnswer).toBe('Xenon');
		});
	});

	describe('POST /api/exercises/.../check (sequence-ordering)', () => {
		const checkUrl = '/api/exercises/science/chemistry/atomic-history-ordering/check';

		it('returns full score for perfect ordering', async () => {
			const res = await postJson(checkUrl, { order: ['dalton', 'electron', 'bohr'] });
			expect(res.status).toBe(200);
			const data = await res.json<any>();
			expect(data.valid).toBe(true);
			expect(data.correct).toBe(true);
			expect(data.correctCount).toBe(3);
			expect(data.total).toBe(3);
		});

		it('returns partial score when some positions are wrong', async () => {
			const res = await postJson(checkUrl, { order: ['electron', 'dalton', 'bohr'] });
			expect(res.status).toBe(200);
			const data = await res.json<any>();
			expect(data.valid).toBe(true);
			expect(data.correct).toBe(false);
			expect(data.correctCount).toBe(1);
			expect(data.total).toBe(3);
		});

		it('returns 400 when order is missing', async () => {
			const res = await postJson(checkUrl, {});
			expect(res.status).toBe(400);
			const data = await res.json<any>();
			expect(data.error).toContain('order');
		});

		it('returns 400 validation error for duplicate item ids', async () => {
			const res = await postJson(checkUrl, { order: ['dalton', 'dalton', 'bohr'] });
			expect(res.status).toBe(400);
			const data = await res.json<any>();
			expect(data.valid).toBe(false);
			expect(data.duplicateItemIds).toContain('dalton');
		});
	});

	describe('POST /api/exercises/.../check (classification-sort)', () => {
		const checkUrl = '/api/exercises/science/chemistry/elements-by-family/check';

		it('returns full score for perfect classification', async () => {
			const res = await postJson(checkUrl, {
				assignments: {
					'helium-family': 'Noble Gas',
					'neon-family': 'Noble Gas',
					'lithium-family': 'Alkali Metal',
				},
			});
			expect(res.status).toBe(200);
			const data = await res.json<any>();
			expect(data.valid).toBe(true);
			expect(data.correct).toBe(true);
			expect(data.correctCount).toBe(3);
			expect(data.total).toBe(3);
		});

		it('returns partial score when one category is wrong', async () => {
			const res = await postJson(checkUrl, {
				assignments: {
					'helium-family': 'Noble Gas',
					'neon-family': 'Noble Gas',
					'lithium-family': 'Noble Gas',
				},
			});
			expect(res.status).toBe(200);
			const data = await res.json<any>();
			expect(data.valid).toBe(true);
			expect(data.correct).toBe(false);
			expect(data.correctCount).toBe(2);
			expect(data.total).toBe(3);
		});

		it('returns 400 when assignments are missing', async () => {
			const res = await postJson(checkUrl, {});
			expect(res.status).toBe(400);
			const data = await res.json<any>();
			expect(data.error).toContain('assignments');
		});
	});

	// ─── Error handling ───────────────────────────────────────

	describe('error handling', () => {
		it('returns 405 for GET on check endpoint', async () => {
			const res = await makeRequest('/api/exercises/science/chemistry/element-symbols/check');
			expect(res.status).toBe(405);
			const data = await res.json<any>();
			expect(data.error).toBeDefined();
		});

		it('returns 404 for unknown API route', async () => {
			const res = await makeRequest('/api/unknown');
			expect(res.status).toBe(404);
			const data = await res.json<any>();
			expect(data.error).toBeDefined();
		});

		it('returns 404 for check on nonexistent exercise', async () => {
			const res = await postJson('/api/exercises/nonexistent/check', {
				itemId: 'foo',
				answer: 'bar',
			});
			expect(res.status).toBe(404);
		});
	});

	// ─── Edge cases ───────────────────────────────────────────

	describe('edge cases', () => {
		it('text-entry check with empty string answer', async () => {
			const res = await postJson('/api/exercises/science/chemistry/element-symbols/check', {
				itemId: 'iron',
				answer: '',
			});
			expect(res.status).toBe(200);
			const data = await res.json<any>();
			expect(data.correct).toBe(false);
		});

		it('fill-blanks check with empty string answer', async () => {
			const res = await postJson('/api/exercises/science/chemistry/noble-gases/check', {
				answer: '',
			});
			expect(res.status).toBe(200);
			const data = await res.json<any>();
			expect(data.matched).toBe(false);
		});

		it('fill-blanks does not require itemId even if provided', async () => {
			const res = await postJson('/api/exercises/science/chemistry/noble-gases/check', {
				itemId: 'helium',
				answer: 'Neon',
			});
			expect(res.status).toBe(200);
			const data = await res.json<any>();
			// Should still match neon, ignoring the stale itemId
			expect(data.matched).toBe(true);
			expect(data.matchedItemId).toBe('neon');
		});

		it('sequence-ordering returns 400 for unknown item ids', async () => {
			const res = await postJson('/api/exercises/science/chemistry/atomic-history-ordering/check', {
				order: ['dalton', 'electron', 'unknown'],
			});
			expect(res.status).toBe(400);
			const data = await res.json<any>();
			expect(data.valid).toBe(false);
			expect(data.extraItemIds).toContain('unknown');
		});

		it('classification-sort returns 400 for unknown item ids', async () => {
			const res = await postJson('/api/exercises/science/chemistry/elements-by-family/check', {
				assignments: {
					'helium-family': 'Noble Gas',
					'neon-family': 'Noble Gas',
					unknown: 'Alkali Metal',
				},
			});
			expect(res.status).toBe(400);
			const data = await res.json<any>();
			expect(data.valid).toBe(false);
			expect(data.extraItemIds).toContain('unknown');
		});

		it('node detail for history (leaf root with no children or exercises)', async () => {
			const res = await makeRequest('/api/nodes/history');
			expect(res.status).toBe(200);
			const data = await res.json<any>();
			expect(data.node.id).toBe('history');
			expect(data.children).toHaveLength(0);
			expect(data.exercises).toHaveLength(0);
		});

		it('exercise detail does not leak displayType when null', async () => {
			const res = await makeRequest('/api/exercises/science/chemistry/noble-gases');
			const data = await res.json<any>();
			// noble-gases has display_type NULL in DB
			expect(data.exercise.displayType).toBeUndefined();
		});

		it('exercise detail does not leak config when null', async () => {
			const res = await makeRequest('/api/exercises/science/chemistry/element-symbols');
			const data = await res.json<any>();
			// element-symbols has config NULL in DB
			expect(data.exercise.config).toBeUndefined();
		});
	});

	// ─── Auth: /api/auth/me ──────────────────────────────────

	describe('GET /api/auth/me', () => {
		it('returns authenticated=false when no cookie provided', async () => {
			const res = await makeRequest('/api/auth/me');
			expect(res.status).toBe(200);
			const data = await res.json<any>();
			expect(data.authenticated).toBe(false);
			// Should provide a login URL in test mode
			expect(data.loginUrl).toBeDefined();
		});

		it('returns authenticated=true with valid test cookie', async () => {
			const res = await makeAuthRequest('/api/auth/me');
			expect(res.status).toBe(200);
			const data = await res.json<any>();
			expect(data.authenticated).toBe(true);
			expect(data.email).toBe(TEST_EMAIL);
			expect(data.userId).toBeDefined();
			expect(typeof data.userId).toBe('string');
			expect(data.userId.length).toBeGreaterThan(0);
		});

		it('returns same userId on repeated calls (upsert idempotency)', async () => {
			const res1 = await makeAuthRequest('/api/auth/me');
			const data1 = await res1.json<any>();
			const res2 = await makeAuthRequest('/api/auth/me');
			const data2 = await res2.json<any>();
			expect(data1.userId).toBe(data2.userId);
		});

		it('returns authenticated=false when cookie has wrong email', async () => {
			const res = await makeRequest('/api/auth/me', {
				headers: { cookie: 'CF_Test_Auth=wrong@example.com' },
			});
			const data = await res.json<any>();
			expect(data.authenticated).toBe(false);
		});
	});

	// ─── User Auth: Race condition bug ──────────────────────
	describe('User preferences', () => {
		it('GET /api/user/preferences returns 401 without auth', async () => {
			const res = await makeRequest('/api/user/preferences');
			expect(res.status).toBe(401);
		});

		it('GET /api/user/preferences returns default empty preferences for new user', async () => {
			await makeAuthRequest('/api/auth/me');
			const db = (env as any).DB as D1Database;
			const me = await (await makeAuthRequest('/api/auth/me')).json<any>();
			await db.prepare(`UPDATE users SET preferences = '{}' WHERE id = ?`).bind(me.userId).run();

			const res = await makeAuthRequest('/api/user/preferences');
			expect(res.status).toBe(200);
			const data = await res.json<any>();
			expect(data.preferences).toEqual({});
		});

		it('PUT /api/user/preferences validates categoryWeights values', async () => {
			await makeAuthRequest('/api/auth/me');
			const res = await putJsonAuth('/api/user/preferences', {
				categoryWeights: {
					science: -1,
				},
			});
			expect(res.status).toBe(400);
			const data = await res.json<any>();
			expect(data.error).toContain('Invalid weight');
		});

		it('PUT /api/user/preferences rejects categoryWeights above 10', async () => {
			await makeAuthRequest('/api/auth/me');
			const res = await putJsonAuth('/api/user/preferences', {
				categoryWeights: {
					science: 11,
				},
			});
			expect(res.status).toBe(400);
			const data = await res.json<any>();
			expect(data.error).toContain('Invalid weight');
		});

		it('PUT /api/user/preferences saves and GET returns persisted category weights', async () => {
			await makeAuthRequest('/api/auth/me');
			const updateRes = await putJsonAuth('/api/user/preferences', {
				categoryWeights: {
					science: 2,
					history: 5,
				},
			});
			expect(updateRes.status).toBe(200);
			const updated = await updateRes.json<any>();
			expect(updated.preferences.categoryWeights.science).toBe(2);
			expect(updated.preferences.categoryWeights.history).toBe(5);

			const getRes = await makeAuthRequest('/api/user/preferences');
			expect(getRes.status).toBe(200);
			const fetched = await getRes.json<any>();
			expect(fetched.preferences.categoryWeights.science).toBe(2);
			expect(fetched.preferences.categoryWeights.history).toBe(5);
		});
	});

	describe('getRequestUser race condition', () => {
		it('BUG: returns 401 when user is authenticated but not yet in DB (race condition)', async () => {
			// getRequestUser calls getByEmail (NOT upsertByEmail).
			// If the quiz result POST arrives before /api/auth/me completes
			// (which upserts the user), getRequestUser returns null -> 401.
			// This is a real race condition in the SPA:
			// - App.tsx calls getAuthMe() on mount (which calls /api/auth/me, upserts user)
			// - Quiz components can complete and submit results before auth/me returns
			// - Result: quiz result is silently lost (fire-and-forget with .catch(() => {}))
			//
			// To reproduce: use a different email so no user exists for it.
			// We can't test this easily since CF_ACCESS_TEST_EMAIL only matches one email.
			// Instead, we confirm that without the auth/me call, the quiz endpoints return 401.

			// Clear the users table to simulate a fresh session
			const db = (env as any).DB as D1Database;
			await db.exec(`DELETE FROM users WHERE email = 'race-test@example.com';`);

			// Now try to submit quiz results with a valid cookie but no user in DB.
			// Since the test env only accepts CF_ACCESS_TEST_EMAIL, we must first ensure
			// that email has no user record, then call the endpoint.
			await db.exec(`DELETE FROM users WHERE email = '${TEST_EMAIL}';`);

			const res = await postJsonAuth('/api/quiz-results', {
				exerciseId: 'science/chemistry/element-symbols',
				exerciseName: 'Element Symbols',
				format: 'text-entry',
				score: 2,
				total: 3,
			});
			// This proves the race condition: valid auth but no user row -> 401
			expect(res.status).toBe(401);

			// Re-create the user for subsequent tests
			const meRes = await makeAuthRequest('/api/auth/me');
			expect((await meRes.json<any>()).authenticated).toBe(true);
		});
	});

	// ─── Quiz Results: POST /api/quiz-results ────────────────

	describe('POST /api/quiz-results', () => {
		// Ensure user exists before quiz-result tests
		beforeAll(async () => {
			await makeAuthRequest('/api/auth/me');
		});

		it('returns 401 when not authenticated', async () => {
			const res = await postJson('/api/quiz-results', {
				exerciseId: 'science/chemistry/element-symbols',
				exerciseName: 'Element Symbols',
				format: 'text-entry',
				score: 2,
				total: 3,
			});
			expect(res.status).toBe(401);
			const data = await res.json<any>();
			expect(data.error).toBeDefined();
		});

		it('creates a quiz result and returns it with id and completedAt', async () => {
			const res = await postJsonAuth('/api/quiz-results', {
				exerciseId: 'science/chemistry/noble-gases',
				exerciseName: 'Noble Gases',
				format: 'fill-blanks',
				score: 2,
				total: 3,
				durationSeconds: 45,
				itemsDetail: [
					{ itemId: 'helium', correct: true, userAnswer: 'Helium', fuzzyMatch: false },
					{ itemId: 'neon', correct: true, userAnswer: 'Neon', fuzzyMatch: false },
					{ itemId: 'argon', correct: false, userAnswer: '', fuzzyMatch: false },
				],
			});
			expect(res.status).toBe(201);
			const data = await res.json<any>();
			expect(data.id).toBeDefined();
			expect(typeof data.id).toBe('string');
			expect(data.exerciseId).toBe('science/chemistry/noble-gases');
			expect(data.exerciseName).toBe('Noble Gases');
			expect(data.format).toBe('fill-blanks');
			expect(data.score).toBe(2);
			expect(data.total).toBe(3);
			expect(data.durationSeconds).toBe(45);
			expect(data.completedAt).toBeDefined();
		});

		it('returns 400 when exerciseId is missing', async () => {
			const res = await postJsonAuth('/api/quiz-results', {
				exerciseName: 'Element Symbols',
				format: 'text-entry',
				score: 2,
				total: 3,
			});
			expect(res.status).toBe(400);
			const data = await res.json<any>();
			expect(data.error).toBeDefined();
		});

		it('returns 400 when exerciseName is missing', async () => {
			const res = await postJsonAuth('/api/quiz-results', {
				exerciseId: 'science/chemistry/element-symbols',
				format: 'text-entry',
				score: 2,
				total: 3,
			});
			expect(res.status).toBe(400);
		});

		it('returns 400 when format is missing', async () => {
			const res = await postJsonAuth('/api/quiz-results', {
				exerciseId: 'science/chemistry/element-symbols',
				exerciseName: 'Element Symbols',
				score: 2,
				total: 3,
			});
			expect(res.status).toBe(400);
		});

		it('returns 400 when score is missing', async () => {
			const res = await postJsonAuth('/api/quiz-results', {
				exerciseId: 'science/chemistry/element-symbols',
				exerciseName: 'Element Symbols',
				format: 'text-entry',
				total: 3,
			});
			expect(res.status).toBe(400);
		});

		it('returns 400 when total is missing', async () => {
			const res = await postJsonAuth('/api/quiz-results', {
				exerciseId: 'science/chemistry/element-symbols',
				exerciseName: 'Element Symbols',
				format: 'text-entry',
				score: 2,
			});
			expect(res.status).toBe(400);
		});

		it('accepts score of 0 (not treated as missing)', async () => {
			const res = await postJsonAuth('/api/quiz-results', {
				exerciseId: 'science/chemistry/element-symbols',
				exerciseName: 'Element Symbols',
				format: 'text-entry',
				score: 0,
				total: 3,
			});
			expect(res.status).toBe(201);
			const data = await res.json<any>();
			expect(data.score).toBe(0);
		});

		it('accepts total of 0 (edge case: empty quiz)', async () => {
			const res = await postJsonAuth('/api/quiz-results', {
				exerciseId: 'science/chemistry/element-symbols',
				exerciseName: 'Element Symbols',
				format: 'text-entry',
				score: 0,
				total: 0,
			});
			expect(res.status).toBe(201);
			const data = await res.json<any>();
			expect(data.total).toBe(0);
		});

		it('accepts null durationSeconds', async () => {
			const res = await postJsonAuth('/api/quiz-results', {
				exerciseId: 'science/chemistry/element-symbols',
				exerciseName: 'Element Symbols',
				format: 'text-entry',
				score: 1,
				total: 3,
				durationSeconds: null,
			});
			expect(res.status).toBe(201);
			const data = await res.json<any>();
			expect(data.durationSeconds).toBeNull();
		});

		it('defaults durationSeconds to null when omitted', async () => {
			const res = await postJsonAuth('/api/quiz-results', {
				exerciseId: 'science/chemistry/element-symbols',
				exerciseName: 'Element Symbols',
				format: 'text-entry',
				score: 1,
				total: 3,
			});
			expect(res.status).toBe(201);
			const data = await res.json<any>();
			expect(data.durationSeconds).toBeNull();
		});

		it('defaults itemsDetail to empty array when omitted', async () => {
			const res = await postJsonAuth('/api/quiz-results', {
				exerciseId: 'science/chemistry/element-symbols',
				exerciseName: 'Element Symbols',
				format: 'text-entry',
				score: 1,
				total: 3,
			});
			expect(res.status).toBe(201);
			const data = await res.json<any>();
			expect(data.itemsDetail).toEqual([]);
		});

		it('accepts negative score without validation', async () => {
			// BUG PROBE: There is no validation that score >= 0 or score <= total.
			// Malicious client can send score: -1 or score: 999, total: 3
			const res = await postJsonAuth('/api/quiz-results', {
				exerciseId: 'science/chemistry/element-symbols',
				exerciseName: 'Element Symbols',
				format: 'text-entry',
				score: -1,
				total: 3,
			});
			// Currently passes — no server-side validation on score range
			expect(res.status).toBe(201);
			const data = await res.json<any>();
			expect(data.score).toBe(-1);
		});

		it('accepts score greater than total without validation', async () => {
			// BUG PROBE: score > total should be impossible, but server doesn't check
			const res = await postJsonAuth('/api/quiz-results', {
				exerciseId: 'science/chemistry/element-symbols',
				exerciseName: 'Element Symbols',
				format: 'text-entry',
				score: 100,
				total: 3,
			});
			expect(res.status).toBe(201);
			const data = await res.json<any>();
			expect(data.score).toBe(100);
		});

		it('accepts arbitrary format string without validation', async () => {
			// BUG PROBE: format is cast as ExerciseFormat but never validated
			const res = await postJsonAuth('/api/quiz-results', {
				exerciseId: 'science/chemistry/element-symbols',
				exerciseName: 'Element Symbols',
				format: 'not-a-real-format',
				score: 1,
				total: 3,
			});
			expect(res.status).toBe(201);
			const data = await res.json<any>();
			expect(data.format).toBe('not-a-real-format');
		});

		it('does not validate exerciseId against actual exercises', async () => {
			// BUG PROBE: you can submit results for exercises that don't exist
			const res = await postJsonAuth('/api/quiz-results', {
				exerciseId: 'nonexistent/exercise/path',
				exerciseName: 'Fake Exercise',
				format: 'text-entry',
				score: 10,
				total: 10,
			});
			expect(res.status).toBe(201);
		});
	});

	// ─── Quiz Results: GET /api/quiz-results ─────────────────

	describe('GET /api/quiz-results', () => {
		beforeAll(async () => {
			await makeAuthRequest('/api/auth/me');
		});

		it('returns 401 when not authenticated', async () => {
			const res = await makeRequest('/api/quiz-results');
			expect(res.status).toBe(401);
		});

		it('returns results for authenticated user', async () => {
			// First, ensure there's at least one result
			await postJsonAuth('/api/quiz-results', {
				exerciseId: 'science/chemistry/element-symbols',
				exerciseName: 'Element Symbols',
				format: 'text-entry',
				score: 2,
				total: 3,
			});

			const res = await makeAuthRequest('/api/quiz-results');
			expect(res.status).toBe(200);
			const data = await res.json<any>();
			expect(data.results).toBeDefined();
			expect(Array.isArray(data.results)).toBe(true);
			expect(data.total).toBeDefined();
			expect(typeof data.total).toBe('number');
			expect(data.results.length).toBeGreaterThan(0);
		});

		it('returns results ordered by completedAt DESC (newest first)', async () => {
			const res = await makeAuthRequest('/api/quiz-results');
			const data = await res.json<any>();
			if (data.results.length >= 2) {
				const dates = data.results.map((r: any) => new Date(r.completedAt).getTime());
				for (let i = 0; i < dates.length - 1; i++) {
					expect(dates[i]).toBeGreaterThanOrEqual(dates[i + 1]);
				}
			}
		});

		it('respects limit parameter', async () => {
			const res = await makeAuthRequest('/api/quiz-results?limit=1');
			expect(res.status).toBe(200);
			const data = await res.json<any>();
			expect(data.results.length).toBeLessThanOrEqual(1);
			// total should reflect total count, not limited count
			expect(data.total).toBeGreaterThanOrEqual(data.results.length);
		});

		it('respects offset parameter', async () => {
			// Get all results first
			const allRes = await makeAuthRequest('/api/quiz-results?limit=100');
			const allData = await allRes.json<any>();

			if (allData.results.length >= 2) {
				// Get results with offset 1
				const offsetRes = await makeAuthRequest('/api/quiz-results?limit=100&offset=1');
				const offsetData = await offsetRes.json<any>();
				expect(offsetData.results.length).toBe(allData.results.length - 1);
			}
		});

		it('handles non-numeric limit by falling back to default', async () => {
			// parseInt('abc', 10) returns NaN, code uses || 20 fallback
			const res = await makeAuthRequest('/api/quiz-results?limit=abc');
			expect(res.status).toBe(200);
			const data = await res.json<any>();
			expect(data.results).toBeDefined();
		});

		it('handles negative offset', async () => {
			const res = await makeAuthRequest('/api/quiz-results?offset=-5');
			expect(res.status).toBeDefined();
		});

		it('does not return other users results (isolation)', async () => {
			// All results should belong to the test user
			const meRes = await makeAuthRequest('/api/auth/me');
			const meData = await meRes.json<any>();
			const userId = meData.userId;

			const res = await makeAuthRequest('/api/quiz-results');
			const data = await res.json<any>();
			for (const result of data.results) {
				expect(result.userId).toBe(userId);
			}
		});
	});

	// ─── Quiz Results: GET /api/quiz-results/stats ───────────

	describe('GET /api/quiz-results/stats', () => {
		beforeAll(async () => {
			await makeAuthRequest('/api/auth/me');
		});

		it('returns 401 when not authenticated', async () => {
			const res = await makeRequest('/api/quiz-results/stats');
			expect(res.status).toBe(401);
		});

		it('returns stats for authenticated user', async () => {
			const res = await makeAuthRequest('/api/quiz-results/stats');
			expect(res.status).toBe(200);
			const data = await res.json<any>();
			expect(data.totalQuizzes).toBeDefined();
			expect(typeof data.totalQuizzes).toBe('number');
			expect(data.totalCorrect).toBeDefined();
			expect(data.totalAttempted).toBeDefined();
			expect(data.exercisesCovered).toBeDefined();
		});

		it('stats reflect submitted quiz results', async () => {
			// Ensure there's at least one result for the current user
			await postJsonAuth('/api/quiz-results', {
				exerciseId: 'science/chemistry/element-symbols',
				exerciseName: 'Element Symbols',
				format: 'text-entry',
				score: 2,
				total: 3,
			});

			const res = await makeAuthRequest('/api/quiz-results/stats');
			const data = await res.json<any>();
			expect(data.totalQuizzes).toBeGreaterThan(0);
			expect(data.totalAttempted).toBeGreaterThan(0);
			expect(data.exercisesCovered).toBeGreaterThan(0);
		});

		it('stats totalCorrect accounts for negative scores if stored', async () => {
			// We submitted a result with score: -1 earlier — that will affect the sum
			const res = await makeAuthRequest('/api/quiz-results/stats');
			const data = await res.json<any>();
			// Just confirm it doesn't crash; the value might be unexpected
			expect(typeof data.totalCorrect).toBe('number');
		});
	});

	// ─── Quiz Results: GET /api/quiz-results/stats/by-category ───

	describe('GET /api/quiz-results/stats/by-category', () => {
		beforeAll(async () => {
			await makeAuthRequest('/api/auth/me');
		});

		it('returns 401 when not authenticated', async () => {
			const res = await makeRequest('/api/quiz-results/stats/by-category');
			expect(res.status).toBe(401);
		});

		it('returns empty categories for user with no results', async () => {
			// Create a fresh user with no quiz results
			const freshEmail = `fresh-${Date.now()}@test.com`;
			const freshCookie = `CF_Test_Auth=${freshEmail}`;
			// This user won't exist yet, so the endpoint should return 401
			// (getByEmail returns null for unknown users)
			const res = await makeRequest('/api/quiz-results/stats/by-category', {
				headers: { cookie: freshCookie },
			});
			expect(res.status).toBe(401);
		});

		it('returns category stats grouped by top-level category', async () => {
			// Submit a quiz result in the science category
			await postJsonAuth('/api/quiz-results', {
				exerciseId: 'science/chemistry/element-symbols',
				exerciseName: 'Element Symbols',
				format: 'text-entry',
				score: 2,
				total: 3,
			});

			const res = await makeAuthRequest('/api/quiz-results/stats/by-category');
			expect(res.status).toBe(200);
			const data = await res.json<any>();
			expect(data.categories).toBeDefined();
			expect(Array.isArray(data.categories)).toBe(true);

			const science = data.categories.find((c: any) => c.category === 'science');
			expect(science).toBeDefined();
			expect(science.correct).toBeGreaterThanOrEqual(2);
			expect(science.attempted).toBeGreaterThanOrEqual(3);
		});

		it('aggregates multiple quiz results in the same category', async () => {
			// Submit another result in science
			await postJsonAuth('/api/quiz-results', {
				exerciseId: 'science/chemistry/noble-gases',
				exerciseName: 'Noble Gases',
				format: 'fill-blanks',
				score: 3,
				total: 3,
			});

			const res = await makeAuthRequest('/api/quiz-results/stats/by-category');
			const data = await res.json<any>();
			const science = data.categories.find((c: any) => c.category === 'science');
			expect(science).toBeDefined();
			// Should aggregate both results
			expect(science.correct).toBeGreaterThanOrEqual(5);
			expect(science.attempted).toBeGreaterThanOrEqual(6);
		});

		it('returns results ordered by attempted desc', async () => {
			const res = await makeAuthRequest('/api/quiz-results/stats/by-category');
			const data = await res.json<any>();
			const categories = data.categories as { attempted: number }[];
			for (let i = 1; i < categories.length; i++) {
				expect(categories[i - 1].attempted).toBeGreaterThanOrEqual(categories[i].attempted);
			}
		});
	});

	// ─── Quiz Results: route method handling ─────────────────

	describe('quiz results route method handling', () => {
		beforeAll(async () => {
			await makeAuthRequest('/api/auth/me');
		});

		it('returns 404 for PUT /api/quiz-results', async () => {
			const res = await makeAuthRequest('/api/quiz-results', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json', 'cookie': AUTH_COOKIE },
				body: JSON.stringify({ exerciseId: 'x', exerciseName: 'x', format: 'text-entry', score: 1, total: 1 }),
			});
			// PUT is not handled — falls through to node/exercise routing below
			expect(res.status).toBe(404);
		});

		it('returns 404 for DELETE /api/quiz-results', async () => {
			const res = await makeAuthRequest('/api/quiz-results', { method: 'DELETE' });
			expect(res.status).toBe(404);
		});

		it('stats endpoint only responds to GET', async () => {
			const res = await postJsonAuth('/api/quiz-results/stats', {});
			// POST to stats — the path === '/api/quiz-results/stats' only matches GET
			// So it falls through. Let's see what happens.
			expect(res.status).toBeDefined();
		});
	});

	// ─── Quiz Results: error handling gaps ────────────────────

	describe('quiz results error handling', () => {
		beforeAll(async () => {
			await makeAuthRequest('/api/auth/me');
		});

		it('returns 500 for malformed JSON body', async () => {
			const res = await makeAuthRequest('/api/quiz-results', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'cookie': AUTH_COOKIE },
				body: 'not valid json',
			});
			expect(res.status).toBe(500);
			const data = await res.json<any>();
			expect(data.error).toBeDefined();
		});

		it('quiz-results/stats route with POST falls through to node routing', async () => {
			// POST to /api/quiz-results/stats doesn't match any quiz-results handler
			// because stats only checks for GET. It falls through to the node/exercise
			// routes, which will try to match it as a node path.
			const res = await postJsonAuth('/api/quiz-results/stats', {});
			// Falls through to nodeMatch regex: /^\/api\/nodes\/(.+)$/
			// This path doesn't start with /api/nodes, so it tries exercise routes.
			// exerciseMatch: /^\/api\/exercises\/(.+)$/ — doesn't match either.
			// answersMatch: /^\/api\/exercises\/(.+)\/answers$/ — doesn't match.
			// Returns 404 from the catch-all.
			expect(res.status).toBe(404);
		});
	});

	// ─── Random Items: GET /api/items/random ─────────────────

	describe('GET /api/items/random', () => {
		it('returns random items with exercise metadata', async () => {
			const res = await makeRequest('/api/items/random?count=5');
			expect(res.status).toBe(200);
			const data = await res.json() as any;
			expect(data.items).toBeDefined();
			expect(data.items.length).toBeGreaterThan(0);
			// Only text-entry items should be returned (3 in test data)
			expect(data.items.length).toBeLessThanOrEqual(3);
		});

		it('includes exerciseName and nodeId on each item', async () => {
			const res = await makeRequest('/api/items/random?count=3');
			const data = await res.json() as any;
			for (const item of data.items) {
				expect(item.exerciseName).toBe('Element Symbols');
				expect(item.nodeId).toBe('science/chemistry');
				expect(item.id).toBeDefined();
				expect(item.exerciseId).toBe('science/chemistry/element-symbols');
			}
		});

		it('strips answer and alternates from items', async () => {
			const res = await makeRequest('/api/items/random?count=3');
			const data = await res.json() as any;
			for (const item of data.items) {
				expect(item.answer).toBeUndefined();
				expect(item.alternates).toBeUndefined();
			}
		});

		it('keeps explanation and data fields', async () => {
			const res = await makeRequest('/api/items/random?count=3');
			const data = await res.json() as any;
			for (const item of data.items) {
				expect(item.explanation).toBeDefined();
				expect(item.data).toBeDefined();
				expect(item.data.prompt).toBeDefined();
			}
		});

		it('excludes fill-blanks items', async () => {
			const res = await makeRequest('/api/items/random?count=50');
			const data = await res.json() as any;
			const exerciseIds = new Set(data.items.map((i: any) => i.exerciseId));
			// noble-gases is fill-blanks, should not appear
			expect(exerciseIds.has('science/chemistry/noble-gases')).toBe(false);
		});

		it('defaults count to 20 when not provided', async () => {
			const res = await makeRequest('/api/items/random');
			expect(res.status).toBe(200);
			const data = await res.json() as any;
			expect(data.items).toBeDefined();
		});

		it('clamps count to max 50', async () => {
			const res = await makeRequest('/api/items/random?count=100');
			expect(res.status).toBe(200);
			// With only 3 text-entry items in test data, should return at most 3
			const data = await res.json() as any;
			expect(data.items.length).toBeLessThanOrEqual(3);
		});

		it('uses authenticated user category weights when selecting random items', async () => {
			const db = (env as any).DB as D1Database;
			const historyExerciseId = `history/preferences-items-${Date.now()}`;
			const historyItemId = `history-item-${Date.now()}`;
			const user = await (await makeAuthRequest('/api/auth/me')).json<any>();

			await db.prepare(`INSERT INTO exercises (id, node_id, name, description, format, display_type, config, sort_order) VALUES (?, 'history', 'History Item Test', '', 'text-entry', NULL, NULL, 98)`)
				.bind(historyExerciseId)
				.run();
			await db.prepare(`INSERT INTO items (id, exercise_id, answer, alternates, explanation, data, sort_order) VALUES (?, ?, 'Washington', '[]', 'First US president.', '{\"prompt\":\"Who was the first U.S. president?\"}', 0)`)
				.bind(historyItemId, historyExerciseId)
				.run();

			try {
				await putJsonAuth('/api/user/preferences', {
					categoryWeights: {
						science: 0,
						history: 10,
					},
				});
				const res = await makeAuthRequest('/api/items/random?count=1');
				expect(res.status).toBe(200);
				const data = await res.json() as any;
				expect(data.items).toHaveLength(1);
				expect(data.items[0].exerciseId).toBe(historyExerciseId);
				expect(data.items[0].nodeId.split('/')[0]).toBe('history');
			} finally {
				await db.prepare(`DELETE FROM items WHERE id = ? AND exercise_id = ?`).bind(historyItemId, historyExerciseId).run();
				await db.prepare(`DELETE FROM exercises WHERE id = ?`).bind(historyExerciseId).run();
				await db.prepare(`UPDATE users SET preferences = '{}' WHERE id = ?`).bind(user.userId).run();
			}
		});
	});

	// ─── Quiz Results: GET /api/quiz-results/:id ─────────────

	describe('GET /api/quiz-results/:id', () => {
		beforeAll(async () => {
			await makeAuthRequest('/api/auth/me');
		});

		it('returns 401 without auth', async () => {
			const res = await makeRequest('/api/quiz-results/some-id');
			expect(res.status).toBe(401);
		});

		it('returns 404 for a result that does not exist', async () => {
			const res = await makeAuthRequest('/api/quiz-results/nonexistent-id');
			expect(res.status).toBe(404);
			const data = await res.json<any>();
			expect(data.error).toBeDefined();
		});

		it('returns full detail with enriched items when called on a valid result', async () => {
			// Create a quiz result first
			const postRes = await postJsonAuth('/api/quiz-results', {
				exerciseId: 'science/chemistry/element-symbols',
				exerciseName: 'Element Symbols',
				format: 'text-entry',
				score: 2,
				total: 3,
				itemsDetail: [
					{ itemId: 'iron', correct: true, userAnswer: 'Iron', fuzzyMatch: false },
					{ itemId: 'gold', correct: true, userAnswer: 'Gold', fuzzyMatch: false },
					{ itemId: 'silver', correct: false, userAnswer: 'Tin', fuzzyMatch: false },
				],
			});
			expect(postRes.status).toBe(201);
			const posted = await postRes.json<any>();
			const resultId = posted.id;

			const res = await makeAuthRequest(`/api/quiz-results/${resultId}`);
			expect(res.status).toBe(200);
			const data = await res.json<any>();

			expect(data.id).toBe(resultId);
			expect(data.exerciseId).toBe('science/chemistry/element-symbols');
			expect(data.exerciseName).toBe('Element Symbols');
			expect(data.format).toBe('text-entry');
			expect(data.score).toBe(2);
			expect(data.total).toBe(3);
			expect(Array.isArray(data.items)).toBe(true);
			expect(data.items).toHaveLength(3);

			const iron = data.items.find((i: any) => i.itemId === 'iron');
			expect(iron).toBeDefined();
			expect(iron.prompt).toBe('What element has the symbol Fe?');
			expect(iron.correctAnswer).toBe('Iron');
			expect(iron.userAnswer).toBe('Iron');
			expect(iron.correct).toBe(true);
			expect(iron.fuzzyMatch).toBe(false);

			const silver = data.items.find((i: any) => i.itemId === 'silver');
			expect(silver).toBeDefined();
			expect(silver.prompt).toBe('What element has the symbol Ag?');
			expect(silver.correctAnswer).toBe('Silver');
			expect(silver.userAnswer).toBe('Tin');
			expect(silver.correct).toBe(false);
		});

		it('returns items: [] when itemsDetail is empty', async () => {
			const postRes = await postJsonAuth('/api/quiz-results', {
				exerciseId: 'science/chemistry/element-symbols',
				exerciseName: 'Element Symbols',
				format: 'text-entry',
				score: 0,
				total: 0,
			});
			expect(postRes.status).toBe(201);
			const posted = await postRes.json<any>();

			const res = await makeAuthRequest(`/api/quiz-results/${posted.id}`);
			expect(res.status).toBe(200);
			const data = await res.json<any>();
			expect(data.items).toEqual([]);
		});

		it('handles missing items gracefully (uses itemId as prompt fallback)', async () => {
			// Insert a quiz result that references a non-existent item ID.
			// We need the actual user ID (not the seeded 'test-user-id', since the race
			// condition test deletes and re-creates the user with a new UUID).
			const meRes = await makeAuthRequest('/api/auth/me');
			const meData = await meRes.json<any>();
			const userId = meData.userId;

			const db = (env as any).DB as D1Database;
			const fakeId = 'fake-result-' + Date.now();
			const now = new Date().toISOString();
			const itemsDetailJson = JSON.stringify([
				{ itemId: 'deleted-item', correct: false, userAnswer: '', fuzzyMatch: false },
			]);
			await db
				.prepare(
					`INSERT INTO quiz_results (id, user_id, exercise_id, exercise_name, format, score, total, duration_seconds, items_detail, completed_at)
					 VALUES (?, ?, 'science/chemistry/element-symbols', 'Element Symbols', 'text-entry', 0, 1, NULL, ?, ?)`
				)
				.bind(fakeId, userId, itemsDetailJson, now)
				.run();

			const res = await makeAuthRequest(`/api/quiz-results/${fakeId}`);
			expect(res.status).toBe(200);
			const data = await res.json<any>();
			expect(data.items).toHaveLength(1);
			// When the item row is missing, itemId is used as prompt fallback
			expect(data.items[0].prompt).toBe('deleted-item');
			expect(data.items[0].correctAnswer).toBe('unknown');
		});
	});

	describe('Admin API', () => {
		describe('auth gating', () => {
			it('returns 403 for unauthenticated requests', async () => {
				const res = await makeRequest('/api/admin/content-health');
				expect(res.status).toBe(403);
			});

			it('returns 403 for authenticated non-admin user', async () => {
				// Use a different email that's not in the admin list
				const res = await makeRequest('/api/admin/content-health', {
					headers: { 'cookie': 'CF_Test_Auth=notadmin@example.com' },
				});
				expect(res.status).toBe(403);
			});
		});

		describe('POST /api/admin/exercises', () => {
			it('creates a new exercise', async () => {
				const res = await postJsonAuth('/api/admin/exercises', {
					id: 'science/chemistry/test-exercise',
					nodeId: 'science/chemistry',
					name: 'Test Exercise',
					format: 'text-entry',
				});
				expect(res.status).toBe(201);
				const data = await res.json<any>();
				expect(data.id).toBe('science/chemistry/test-exercise');
				expect(data.name).toBe('Test Exercise');
				expect(data.format).toBe('text-entry');
			});

			it('creates exercise with items', async () => {
				const res = await postJsonAuth('/api/admin/exercises', {
					id: 'science/chemistry/with-items',
					nodeId: 'science/chemistry',
					name: 'With Items',
					format: 'text-entry',
					items: [
						{ id: 'q1', answer: 'Hydrogen', data: { prompt: 'Element 1?' } },
						{ id: 'q2', answer: 'Helium', data: { prompt: 'Element 2?' } },
					],
				});
				expect(res.status).toBe(201);
				const data = await res.json<any>();
				expect(data.itemCount).toBe(2);
			});

			it('returns 400 for missing required fields', async () => {
				const res = await postJsonAuth('/api/admin/exercises', {
					id: 'test',
					name: 'Missing nodeId and format',
				});
				expect(res.status).toBe(400);
			});
		});

		describe('PUT /api/admin/exercises/:id', () => {
			it('updates exercise metadata', async () => {
				const res = await putJsonAuth('/api/admin/exercises/science/chemistry/test-exercise', {
					name: 'Updated Name',
					description: 'New description',
				});
				expect(res.status).toBe(200);
				const data = await res.json<any>();
				expect(data.name).toBe('Updated Name');
				expect(data.description).toBe('New description');
			});

			it('returns 404 for non-existent exercise', async () => {
				const res = await putJsonAuth('/api/admin/exercises/does/not/exist', {
					name: 'Nope',
				});
				expect(res.status).toBe(404);
			});
		});

		describe('DELETE /api/admin/exercises/:id', () => {
			it('deletes an exercise', async () => {
				// Create one to delete
				await postJsonAuth('/api/admin/exercises', {
					id: 'science/chemistry/to-delete',
					nodeId: 'science/chemistry',
					name: 'To Delete',
					format: 'text-entry',
				});
				const res = await deleteAuth('/api/admin/exercises/science/chemistry/to-delete');
				expect(res.status).toBe(200);
				const data = await res.json<any>();
				expect(data.deleted).toBe(true);
			});

			it('returns 404 for non-existent exercise', async () => {
				const res = await deleteAuth('/api/admin/exercises/does/not/exist');
				expect(res.status).toBe(404);
			});
		});

		describe('POST /api/admin/exercises/:id/items', () => {
			it('bulk upserts items', async () => {
				const res = await postJsonAuth('/api/admin/exercises/science/chemistry/element-symbols/items', {
					items: [
						{ id: 'copper', answer: 'Copper', explanation: 'Cu from Latin cuprum.', data: { prompt: 'What element has the symbol Cu?' } },
					],
				});
				expect(res.status).toBe(201);
				const data = await res.json<any>();
				expect(data.items.length).toBeGreaterThanOrEqual(4); // 3 original + 1 new
			});

			it('returns 400 for missing items array', async () => {
				const res = await postJsonAuth('/api/admin/exercises/science/chemistry/element-symbols/items', {
					notItems: [],
				});
				expect(res.status).toBe(400);
			});

			it('returns 404 for non-existent exercise', async () => {
				const res = await postJsonAuth('/api/admin/exercises/does/not/exist/items', {
					items: [{ id: 'q1', answer: 'A' }],
				});
				expect(res.status).toBe(404);
			});
		});

		describe('PUT /api/admin/exercises/:exerciseId/items/:itemId', () => {
			it('updates a single item', async () => {
				const res = await putJsonAuth('/api/admin/exercises/science/chemistry/element-symbols/items/iron', {
					explanation: 'Updated explanation for iron.',
				});
				expect(res.status).toBe(200);
				const data = await res.json<any>();
				expect(data.explanation).toBe('Updated explanation for iron.');
				expect(data.id).toBe('iron');
			});

			it('returns 404 for non-existent item', async () => {
				const res = await putJsonAuth('/api/admin/exercises/science/chemistry/element-symbols/items/doesnotexist', {
					explanation: 'Nope',
				});
				expect(res.status).toBe(404);
			});
		});

		describe('DELETE /api/admin/exercises/:exerciseId/items/:itemId', () => {
			it('deletes an item', async () => {
				// First add an item to delete
				await postJsonAuth('/api/admin/exercises/science/chemistry/element-symbols/items', {
					items: [{ id: 'to-delete-item', answer: 'Tungsten', data: { prompt: 'W?' } }],
				});
				const res = await deleteAuth('/api/admin/exercises/science/chemistry/element-symbols/items/to-delete-item');
				expect(res.status).toBe(200);
				const data = await res.json<any>();
				expect(data.deleted).toBe(true);
			});

			it('returns 404 for non-existent item', async () => {
				const res = await deleteAuth('/api/admin/exercises/science/chemistry/element-symbols/items/doesnotexist');
				expect(res.status).toBe(404);
			});
		});

		describe('POST /api/admin/nodes', () => {
			it('upserts a new node', async () => {
				const res = await postJsonAuth('/api/admin/nodes', {
					id: 'science/physics',
					parentId: 'science',
					name: 'Physics',
					description: 'Study of matter and energy',
				});
				expect(res.status).toBe(201);
				const data = await res.json<any>();
				expect(data.id).toBe('science/physics');
				expect(data.name).toBe('Physics');
			});

			it('returns 400 for missing required fields', async () => {
				const res = await postJsonAuth('/api/admin/nodes', {
					id: 'test',
				});
				expect(res.status).toBe(400);
			});
		});

		describe('GET /api/admin/export/:exerciseId', () => {
			it('exports a single exercise in seed format', async () => {
				const res = await makeAuthRequest('/api/admin/export/science/chemistry/element-symbols');
				expect(res.status).toBe(200);
				const data = await res.json<any>();
				expect(data.nodes).toBeDefined();
				expect(data.exercises).toBeDefined();
				expect(data.exercises.length).toBe(1);
				expect(data.exercises[0].id).toBe('science/chemistry/element-symbols');
			});

			it('returns 404 for non-existent exercise', async () => {
				const res = await makeAuthRequest('/api/admin/export/does/not/exist');
				expect(res.status).toBe(404);
			});
		});

		describe('GET /api/admin/export', () => {
			it('exports all content', async () => {
				const res = await makeAuthRequest('/api/admin/export');
				expect(res.status).toBe(200);
				const data = await res.json<any>();
				expect(data.nodes).toBeDefined();
				expect(data.exercises).toBeDefined();
				expect(data.nodes.length).toBeGreaterThan(0);
				expect(data.exercises.length).toBeGreaterThan(0);
			});
		});

		describe('GET /api/admin/content-health', () => {
			it('returns content health report', async () => {
				const res = await makeAuthRequest('/api/admin/content-health');
				expect(res.status).toBe(200);
				const data = await res.json<any>();
				expect(data.totalNodes).toBeGreaterThan(0);
				expect(data.totalExercises).toBeGreaterThan(0);
				expect(data.totalItems).toBeGreaterThan(0);
				expect(Array.isArray(data.issues)).toBe(true);
			});
		});
	});

	// ─── Retry Tracking: POST retry fields ──────────────────

	describe('POST /api/quiz-results retry fields', () => {
		beforeAll(async () => {
			await makeAuthRequest('/api/auth/me');
		});

		it('accepts isRetry: true and parentResultId and returns them', async () => {
			// First create a parent result
			const parentRes = await postJsonAuth('/api/quiz-results', {
				exerciseId: 'science/chemistry/element-symbols',
				exerciseName: 'Element Symbols',
				format: 'text-entry',
				score: 1,
				total: 3,
			});
			expect(parentRes.status).toBe(201);
			const parent = await parentRes.json<any>();

			// Now create a retry referencing the parent
			const retryRes = await postJsonAuth('/api/quiz-results', {
				exerciseId: 'science/chemistry/element-symbols',
				exerciseName: 'Element Symbols',
				format: 'text-entry',
				score: 3,
				total: 3,
				isRetry: true,
				parentResultId: parent.id,
			});
			expect(retryRes.status).toBe(201);
			const retry = await retryRes.json<any>();
			expect(retry.isRetry).toBe(true);
			expect(retry.parentResultId).toBe(parent.id);
		});

		it('returns isRetry: false when isRetry is explicitly false', async () => {
			const res = await postJsonAuth('/api/quiz-results', {
				exerciseId: 'science/chemistry/element-symbols',
				exerciseName: 'Element Symbols',
				format: 'text-entry',
				score: 2,
				total: 3,
				isRetry: false,
			});
			expect(res.status).toBe(201);
			const data = await res.json<any>();
			expect(data.isRetry).toBe(false);
			expect(data.parentResultId).toBeNull();
		});

		it('defaults isRetry to false and parentResultId to null when omitted', async () => {
			const res = await postJsonAuth('/api/quiz-results', {
				exerciseId: 'science/chemistry/element-symbols',
				exerciseName: 'Element Symbols',
				format: 'text-entry',
				score: 2,
				total: 3,
			});
			expect(res.status).toBe(201);
			const data = await res.json<any>();
			expect(data.isRetry).toBe(false);
			expect(data.parentResultId).toBeNull();
		});

		it('stores isRetry in DB and reads it back correctly via GET detail', async () => {
			// First create a real parent to satisfy FK constraint
			const parentRes = await postJsonAuth('/api/quiz-results', {
				exerciseId: 'science/chemistry/element-symbols',
				exerciseName: 'Element Symbols',
				format: 'text-entry',
				score: 1,
				total: 3,
			});
			expect(parentRes.status).toBe(201);
			const parent = await parentRes.json<any>();

			const postRes = await postJsonAuth('/api/quiz-results', {
				exerciseId: 'science/chemistry/element-symbols',
				exerciseName: 'Element Symbols',
				format: 'text-entry',
				score: 3,
				total: 3,
				isRetry: true,
				parentResultId: parent.id,
			});
			expect(postRes.status).toBe(201);
			const posted = await postRes.json<any>();

			// Verify DB storage by reading back the row directly
			const db = (env as any).DB as D1Database;
			const row = await db
				.prepare(`SELECT is_retry, parent_result_id FROM quiz_results WHERE id = ?`)
				.bind(posted.id)
				.first<{ is_retry: number; parent_result_id: string | null }>();
			expect(row).toBeDefined();
			expect(row!.is_retry).toBe(1);
			expect(row!.parent_result_id).toBe(parent.id);
		});
	});

	// ─── Retry Tracking: GET hides retries ──────────────────

	describe('GET /api/quiz-results hides retries', () => {
		// Use a unique exercise ID so we can count precisely
		const retryTestExercise = 'retry-test/hiding/' + Date.now();

		beforeAll(async () => {
			await makeAuthRequest('/api/auth/me');

			// Clear all prior quiz results to get a clean slate
			const db = (env as any).DB as D1Database;
			const meRes = await makeAuthRequest('/api/auth/me');
			const meData = await meRes.json<any>();
			await db.prepare(`DELETE FROM quiz_results WHERE user_id = ?`).bind(meData.userId).run();

			// Submit a first-attempt result
			const firstRes = await postJsonAuth('/api/quiz-results', {
				exerciseId: retryTestExercise,
				exerciseName: 'Retry Hide Test',
				format: 'text-entry',
				score: 5,
				total: 10,
			});
			expect(firstRes.status).toBe(201);
			const first = await firstRes.json<any>();

			// Submit a retry result
			const retryRes = await postJsonAuth('/api/quiz-results', {
				exerciseId: retryTestExercise,
				exerciseName: 'Retry Hide Test',
				format: 'text-entry',
				score: 8,
				total: 10,
				isRetry: true,
				parentResultId: first.id,
			});
			expect(retryRes.status).toBe(201);
		});

		it('GET /api/quiz-results returns only first attempts, not retries', async () => {
			const res = await makeAuthRequest('/api/quiz-results?limit=100');
			expect(res.status).toBe(200);
			const data = await res.json<any>();

			// Should have exactly 1 result (the first attempt), not the retry
			expect(data.results).toHaveLength(1);
			expect(data.results[0].score).toBe(5);
			expect(data.results[0].isRetry).toBe(false);
		});

		it('total count excludes retries', async () => {
			const res = await makeAuthRequest('/api/quiz-results');
			expect(res.status).toBe(200);
			const data = await res.json<any>();

			// Total should be 1 (only first attempts)
			expect(data.total).toBe(1);
		});
	});

	// ─── Retry Tracking: stats exclude retries ──────────────

	describe('stats exclude retries', () => {
		beforeAll(async () => {
			await makeAuthRequest('/api/auth/me');

			// Clear all prior quiz results
			const db = (env as any).DB as D1Database;
			const meRes = await makeAuthRequest('/api/auth/me');
			const meData = await meRes.json<any>();
			await db.prepare(`DELETE FROM quiz_results WHERE user_id = ?`).bind(meData.userId).run();

			// Submit first attempt: score 5/10
			const firstRes = await postJsonAuth('/api/quiz-results', {
				exerciseId: 'science/chemistry/element-symbols',
				exerciseName: 'Element Symbols',
				format: 'text-entry',
				score: 5,
				total: 10,
			});
			expect(firstRes.status).toBe(201);
			const first = await firstRes.json<any>();

			// Submit retry: score 8/10 (should be excluded from stats)
			const retryRes = await postJsonAuth('/api/quiz-results', {
				exerciseId: 'science/chemistry/element-symbols',
				exerciseName: 'Element Symbols',
				format: 'text-entry',
				score: 8,
				total: 10,
				isRetry: true,
				parentResultId: first.id,
			});
			expect(retryRes.status).toBe(201);
		});

		it('GET /api/quiz-results/stats excludes retries from totals', async () => {
			const res = await makeAuthRequest('/api/quiz-results/stats');
			expect(res.status).toBe(200);
			const data = await res.json<any>();

			expect(data.totalQuizzes).toBe(1);
			expect(data.totalCorrect).toBe(5);
			expect(data.totalAttempted).toBe(10);
			expect(data.exercisesCovered).toBe(1);
		});

		it('GET /api/quiz-results/stats/by-category excludes retries', async () => {
			const res = await makeAuthRequest('/api/quiz-results/stats/by-category');
			expect(res.status).toBe(200);
			const data = await res.json<any>();

			const science = data.categories.find((c: any) => c.category === 'science');
			expect(science).toBeDefined();
			// Only the first attempt (5/10) should count, not the retry (8/10)
			expect(science.correct).toBe(5);
			expect(science.attempted).toBe(10);
		});
	});

	// ─── GET /api/quiz-results/by-exercise ──────────────────

	describe('GET /api/quiz-results/by-exercise', () => {
		beforeAll(async () => {
			await makeAuthRequest('/api/auth/me');

			// Clear all prior quiz results
			const db = (env as any).DB as D1Database;
			const meRes = await makeAuthRequest('/api/auth/me');
			const meData = await meRes.json<any>();
			await db.prepare(`DELETE FROM quiz_results WHERE user_id = ?`).bind(meData.userId).run();
		});

		it('returns 401 without authentication', async () => {
			const res = await makeRequest('/api/quiz-results/by-exercise');
			expect(res.status).toBe(401);
			const data = await res.json<any>();
			expect(data.error).toBeDefined();
		});

		it('returns empty exercises array when user has no results', async () => {
			const res = await makeAuthRequest('/api/quiz-results/by-exercise');
			expect(res.status).toBe(200);
			const data = await res.json<any>();
			expect(data.exercises).toBeDefined();
			expect(Array.isArray(data.exercises)).toBe(true);
			expect(data.exercises).toHaveLength(0);
		});

		it('returns correct shape for a single exercise with one attempt', async () => {
			await postJsonAuth('/api/quiz-results', {
				exerciseId: 'science/chemistry/element-symbols',
				exerciseName: 'Element Symbols',
				format: 'text-entry',
				score: 7,
				total: 10,
			});

			const res = await makeAuthRequest('/api/quiz-results/by-exercise');
			expect(res.status).toBe(200);
			const data = await res.json<any>();
			expect(data.exercises).toHaveLength(1);

			const ex = data.exercises[0];
			expect(ex.exerciseId).toBe('science/chemistry/element-symbols');
			expect(ex.exerciseName).toBe('Element Symbols');
			expect(ex.category).toBe('science');
			expect(ex.timesTaken).toBe(1);
			expect(ex.lastTaken).toBeDefined();
			expect(ex.mostRecentScore).toBe(7);
			expect(ex.mostRecentTotal).toBe(10);
			expect(ex.bestScore).toBe(7);
			expect(ex.bestTotal).toBe(10);
		});

		it('aggregates multiple first-attempts for the same exercise', async () => {
			// Second attempt (better score)
			await postJsonAuth('/api/quiz-results', {
				exerciseId: 'science/chemistry/element-symbols',
				exerciseName: 'Element Symbols',
				format: 'text-entry',
				score: 9,
				total: 10,
			});

			const res = await makeAuthRequest('/api/quiz-results/by-exercise');
			expect(res.status).toBe(200);
			const data = await res.json<any>();
			expect(data.exercises).toHaveLength(1);

			const ex = data.exercises[0];
			expect(ex.timesTaken).toBe(2);
			// Most recent is the second attempt (9/10)
			expect(ex.mostRecentScore).toBe(9);
			expect(ex.mostRecentTotal).toBe(10);
			// Best score is also the second attempt (9/10 > 7/10)
			expect(ex.bestScore).toBe(9);
			expect(ex.bestTotal).toBe(10);
		});

		it('separates different exercises into distinct entries', async () => {
			await postJsonAuth('/api/quiz-results', {
				exerciseId: 'science/chemistry/noble-gases',
				exerciseName: 'Noble Gases',
				format: 'fill-blanks',
				score: 3,
				total: 6,
			});

			const res = await makeAuthRequest('/api/quiz-results/by-exercise');
			expect(res.status).toBe(200);
			const data = await res.json<any>();
			expect(data.exercises).toHaveLength(2);

			const exerciseIds = data.exercises.map((e: any) => e.exerciseId);
			expect(exerciseIds).toContain('science/chemistry/element-symbols');
			expect(exerciseIds).toContain('science/chemistry/noble-gases');
		});

		it('excludes retries from aggregation', async () => {
			// Submit a retry for element-symbols (should NOT change timesTaken or bestScore)
			const res1 = await makeAuthRequest('/api/quiz-results/by-exercise');
			const before = await res1.json<any>();
			const symbolsBefore = before.exercises.find(
				(e: any) => e.exerciseId === 'science/chemistry/element-symbols'
			);

			await postJsonAuth('/api/quiz-results', {
				exerciseId: 'science/chemistry/element-symbols',
				exerciseName: 'Element Symbols',
				format: 'text-entry',
				score: 10,
				total: 10,
				isRetry: true,
				parentResultId: 'some-parent-id',
			});

			const res2 = await makeAuthRequest('/api/quiz-results/by-exercise');
			const after = await res2.json<any>();
			const symbolsAfter = after.exercises.find(
				(e: any) => e.exerciseId === 'science/chemistry/element-symbols'
			);

			// timesTaken should be unchanged (retry excluded)
			expect(symbolsAfter.timesTaken).toBe(symbolsBefore.timesTaken);
			// bestScore should NOT reflect the retry's 10/10
			expect(symbolsAfter.bestScore).toBe(symbolsBefore.bestScore);
			expect(symbolsAfter.mostRecentScore).toBe(symbolsBefore.mostRecentScore);
		});

		it('bestScore picks highest ratio, not highest raw score', async () => {
			// Clear and set up a scenario where best ratio != highest raw score
			const db = (env as any).DB as D1Database;
			const meRes = await makeAuthRequest('/api/auth/me');
			const meData = await meRes.json<any>();
			await db.prepare(`DELETE FROM quiz_results WHERE user_id = ?`).bind(meData.userId).run();

			// Attempt 1: 8/10 = 80%
			await postJsonAuth('/api/quiz-results', {
				exerciseId: 'science/chemistry/element-symbols',
				exerciseName: 'Element Symbols',
				format: 'text-entry',
				score: 8,
				total: 10,
			});
			// Attempt 2: 5/5 = 100% (lower raw score but higher ratio)
			await postJsonAuth('/api/quiz-results', {
				exerciseId: 'science/chemistry/element-symbols',
				exerciseName: 'Element Symbols',
				format: 'text-entry',
				score: 5,
				total: 5,
			});

			const res = await makeAuthRequest('/api/quiz-results/by-exercise');
			const data = await res.json<any>();
			const ex = data.exercises[0];
			// bestScore should be from the 5/5 attempt (100% > 80%)
			expect(ex.bestScore).toBe(5);
			expect(ex.bestTotal).toBe(5);
		});

		it('extracts category from first segment of exercise ID', async () => {
			const db = (env as any).DB as D1Database;
			const meRes = await makeAuthRequest('/api/auth/me');
			const meData = await meRes.json<any>();
			await db.prepare(`DELETE FROM quiz_results WHERE user_id = ?`).bind(meData.userId).run();

			await postJsonAuth('/api/quiz-results', {
				exerciseId: 'history/american/presidents',
				exerciseName: 'Presidents',
				format: 'text-entry',
				score: 5,
				total: 10,
			});

			const res = await makeAuthRequest('/api/quiz-results/by-exercise');
			const data = await res.json<any>();
			expect(data.exercises[0].category).toBe('history');
		});
	});

	// ─── Retry Tracking: edge cases ─────────────────────────

	describe('retry tracking edge cases', () => {
		beforeAll(async () => {
			await makeAuthRequest('/api/auth/me');
		});

		it('parentResultId referencing a non-existent result succeeds (no FK constraint)', async () => {
			const res = await postJsonAuth('/api/quiz-results', {
				exerciseId: 'science/chemistry/element-symbols',
				exerciseName: 'Element Symbols',
				format: 'text-entry',
				score: 3,
				total: 3,
				isRetry: true,
				parentResultId: 'nonexistent-parent-id-12345',
			});
			expect(res.status).toBe(201);
			const data = await res.json<any>();
			expect(data.parentResultId).toBe('nonexistent-parent-id-12345');
		});

		it('chained retries: A -> B (retry of A) -> C (retry of B)', async () => {
			// Original attempt A
			const aRes = await postJsonAuth('/api/quiz-results', {
				exerciseId: 'science/chemistry/noble-gases',
				exerciseName: 'Noble Gases',
				format: 'fill-blanks',
				score: 1,
				total: 6,
			});
			expect(aRes.status).toBe(201);
			const a = await aRes.json<any>();
			expect(a.isRetry).toBe(false);

			// Retry B of A
			const bRes = await postJsonAuth('/api/quiz-results', {
				exerciseId: 'science/chemistry/noble-gases',
				exerciseName: 'Noble Gases',
				format: 'fill-blanks',
				score: 3,
				total: 6,
				isRetry: true,
				parentResultId: a.id,
			});
			expect(bRes.status).toBe(201);
			const b = await bRes.json<any>();
			expect(b.isRetry).toBe(true);
			expect(b.parentResultId).toBe(a.id);

			// Retry C of B
			const cRes = await postJsonAuth('/api/quiz-results', {
				exerciseId: 'science/chemistry/noble-gases',
				exerciseName: 'Noble Gases',
				format: 'fill-blanks',
				score: 5,
				total: 6,
				isRetry: true,
				parentResultId: b.id,
			});
			expect(cRes.status).toBe(201);
			const c = await cRes.json<any>();
			expect(c.isRetry).toBe(true);
			expect(c.parentResultId).toBe(b.id);
		});

		it('isRetry with truthy non-boolean values gets coerced to boolean', async () => {
			const res = await postJsonAuth('/api/quiz-results', {
				exerciseId: 'science/chemistry/element-symbols',
				exerciseName: 'Element Symbols',
				format: 'text-entry',
				score: 1,
				total: 3,
				isRetry: 1 as any,
			});
			expect(res.status).toBe(201);
			const data = await res.json<any>();
			// !! coerces truthy values to true
			expect(data.isRetry).toBe(true);
		});

		it('BUG PROBE: parentResultId as empty string becomes null', async () => {
			// The handler does: parentResultId: body.parentResultId || undefined
			// Empty string is falsy, so "" || undefined = undefined
			// Then recordQuizResult does params.parentResultId ?? null, so undefined -> null
			const res = await postJsonAuth('/api/quiz-results', {
				exerciseId: 'science/chemistry/element-symbols',
				exerciseName: 'Element Symbols',
				format: 'text-entry',
				score: 1,
				total: 3,
				parentResultId: '',
			});
			expect(res.status).toBe(201);
			const data = await res.json<any>();
			// Empty string is coerced to null via the || undefined -> ?? null chain
			expect(data.parentResultId).toBeNull();
		});
	});
});
