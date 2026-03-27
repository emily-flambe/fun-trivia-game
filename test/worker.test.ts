import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import worker from '../src/index';

async function seedTestData(db: D1Database) {
	// Create tables
	await db.exec(`CREATE TABLE IF NOT EXISTS nodes (id TEXT PRIMARY KEY, parent_id TEXT, name TEXT NOT NULL, description TEXT DEFAULT '', sort_order INTEGER DEFAULT 0);`);
	await db.exec(`CREATE TABLE IF NOT EXISTS exercises (id TEXT PRIMARY KEY, node_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT DEFAULT '', format TEXT NOT NULL, display_type TEXT, config TEXT, sort_order INTEGER DEFAULT 0);`);
	await db.exec(`CREATE TABLE IF NOT EXISTS items (id TEXT NOT NULL, exercise_id TEXT NOT NULL, answer TEXT NOT NULL, alternates TEXT DEFAULT '[]', explanation TEXT DEFAULT '', data TEXT DEFAULT '{}', sort_order INTEGER DEFAULT 0, PRIMARY KEY (id, exercise_id));`);

	// Root nodes
	await db.exec(`INSERT INTO nodes VALUES ('science', NULL, 'Science', 'Science category', 0);`);
	await db.exec(`INSERT INTO nodes VALUES ('history', NULL, 'History', 'History category', 1);`);

	// Child node
	await db.exec(`INSERT INTO nodes VALUES ('science/chemistry', 'science', 'Chemistry', 'Elements and compounds', 0);`);

	// Text-entry exercise
	await db.exec(`INSERT INTO exercises VALUES ('science/chemistry/element-symbols', 'science/chemistry', 'Element Symbols', 'Match elements to symbols', 'text-entry', 'periodic-table', NULL, 0);`);

	// Fill-blanks exercise
	await db.exec(`INSERT INTO exercises VALUES ('science/chemistry/noble-gases', 'science/chemistry', 'Noble Gases', 'Name the noble gases', 'fill-blanks', NULL, '{"ordered":false,"prompt":"Name all six noble gases"}', 1);`);

	// Text-entry items
	await db.exec(`INSERT INTO items VALUES ('iron', 'science/chemistry/element-symbols', 'Iron', '[]', 'Fe from Latin ferrum.', '{"prompt":"What element has the symbol Fe?","cardFront":"Fe","cardBack":"Iron"}', 0);`);
	await db.exec(`INSERT INTO items VALUES ('gold', 'science/chemistry/element-symbols', 'Gold', '[]', 'Au from Latin aurum.', '{"prompt":"What element has the symbol Au?","cardFront":"Au","cardBack":"Gold"}', 1);`);
	await db.exec(`INSERT INTO items VALUES ('silver', 'science/chemistry/element-symbols', 'Silver', '["Ag"]', 'Ag from Latin argentum.', '{"prompt":"What element has the symbol Ag?","cardFront":"Ag","cardBack":"Silver"}', 2);`);

	// Fill-blanks items
	await db.exec(`INSERT INTO items VALUES ('helium', 'science/chemistry/noble-gases', 'Helium', '["He"]', 'Atomic number 2.', '{}', 0);`);
	await db.exec(`INSERT INTO items VALUES ('neon', 'science/chemistry/noble-gases', 'Neon', '["Ne"]', 'Atomic number 10.', '{}', 1);`);
	await db.exec(`INSERT INTO items VALUES ('argon', 'science/chemistry/noble-gases', 'Argon', '["Ar"]', 'Atomic number 18.', '{}', 2);`);
}

async function makeRequest(path: string, options?: RequestInit) {
	const request = new Request(`http://localhost${path}`, options);
	const ctx = createExecutionContext();
	const response = await worker.fetch(request, env, ctx);
	await waitOnExecutionContext(ctx);
	return response;
}

function postJson(path: string, body: unknown) {
	return makeRequest(path, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
}

describe('Trivia API', () => {
	beforeAll(async () => {
		await seedTestData(env.DB);
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
			expect(data.exercises).toHaveLength(2);

			const symbols = data.exercises.find((e: any) => e.id === 'science/chemistry/element-symbols');
			expect(symbols).toBeDefined();
			expect(symbols.itemCount).toBe(3);

			const gases = data.exercises.find((e: any) => e.id === 'science/chemistry/noble-gases');
			expect(gases).toBeDefined();
			expect(gases.itemCount).toBe(3);
		});

		it('returns exercises in sort_order', async () => {
			const res = await makeRequest('/api/nodes/science/chemistry');
			const data = await res.json<any>();
			expect(data.exercises[0].id).toBe('science/chemistry/element-symbols');
			expect(data.exercises[1].id).toBe('science/chemistry/noble-gases');
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

		it('strips answer, alternates, and explanation from items', async () => {
			const res = await makeRequest('/api/exercises/science/chemistry/element-symbols');
			const data = await res.json<any>();
			for (const item of data.items) {
				expect(item).not.toHaveProperty('answer');
				expect(item).not.toHaveProperty('alternates');
				expect(item).not.toHaveProperty('explanation');
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
});
