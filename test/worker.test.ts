import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import worker from '../src/index';

async function seedTestData(db: D1Database) {
	await db.exec(`CREATE TABLE IF NOT EXISTS modules (id TEXT PRIMARY KEY, category TEXT NOT NULL, name TEXT NOT NULL, tier TEXT NOT NULL, description TEXT NOT NULL, default_format TEXT NOT NULL DEFAULT 'text-entry');`);
	await db.exec(`CREATE TABLE IF NOT EXISTS questions (id TEXT NOT NULL, module_id TEXT NOT NULL, question TEXT NOT NULL, answer TEXT NOT NULL, alternate_answers TEXT DEFAULT '[]', options TEXT, correct_index INTEGER, match_pairs TEXT, explanation TEXT NOT NULL, card_front TEXT, card_back TEXT, sort_order INTEGER DEFAULT 0, PRIMARY KEY (id, module_id));`);

	await db.exec(`INSERT INTO modules VALUES ('geo-test', 'geography', 'Test Capitals', 'foundation', 'Test module', 'text-entry');`);
	await db.exec(`INSERT INTO modules VALUES ('sci-test', 'science', 'Test Planets', 'foundation', 'Test science module', 'multiple-choice');`);

	await db.exec(`INSERT INTO questions VALUES ('q1', 'geo-test', 'Capital of France?', 'Paris', '[]', NULL, NULL, NULL, 'Paris is the capital of France.', NULL, NULL, 0);`);
	await db.exec(`INSERT INTO questions VALUES ('q2', 'geo-test', 'Capital of Germany?', 'Berlin', '[]', NULL, NULL, NULL, 'Berlin is the capital of Germany.', NULL, NULL, 1);`);
	await db.exec(`INSERT INTO questions VALUES ('q3', 'geo-test', 'Capital of Japan?', 'Tokyo', '["Tōkyō"]', NULL, NULL, NULL, 'Tokyo is the capital of Japan.', NULL, NULL, 2);`);

	await db.exec(`INSERT INTO questions VALUES ('q1', 'sci-test', 'Largest planet?', 'Jupiter', '[]', '["Mars","Jupiter","Saturn","Venus"]', 1, NULL, 'Jupiter is the largest planet.', NULL, NULL, 0);`);
	await db.exec(`INSERT INTO questions VALUES ('q2', 'sci-test', 'Closest star?', 'Proxima Centauri', '[]', '["Proxima Centauri","Sirius","Alpha Centauri","Betelgeuse"]', 0, NULL, 'Proxima Centauri is the closest star to our Sun.', NULL, NULL, 1);`);
}

async function makeRequest(path: string, options?: RequestInit) {
	const request = new Request(`http://localhost${path}`, options);
	const ctx = createExecutionContext();
	const response = await worker.fetch(request, env, ctx);
	await waitOnExecutionContext(ctx);
	return response;
}

describe('Trivia API', () => {
	beforeAll(async () => {
		await seedTestData(env.DB);
	});

	describe('GET /api/health', () => {
		it('returns ok status', async () => {
			const res = await makeRequest('/api/health');
			expect(res.status).toBe(200);
			const data = await res.json<{ status: string }>();
			expect(data.status).toBe('ok');
		});
	});

	describe('GET /api/categories', () => {
		it('returns categories with module counts', async () => {
			const res = await makeRequest('/api/categories');
			expect(res.status).toBe(200);
			const data = await res.json<{ categories: any[] }>();
			expect(data.categories.length).toBeGreaterThan(0);

			const geo = data.categories.find((c: any) => c.id === 'geography');
			expect(geo).toBeDefined();
			expect(geo.moduleCount).toBe(1);
			expect(geo.tiers.foundation).toBe(1);
		});
	});

	describe('GET /api/modules', () => {
		it('returns all modules', async () => {
			const res = await makeRequest('/api/modules');
			expect(res.status).toBe(200);
			const data = await res.json<{ modules: any[] }>();
			expect(data.modules).toHaveLength(2);
		});

		it('filters by category', async () => {
			const res = await makeRequest('/api/modules?category=geography');
			const data = await res.json<{ modules: any[] }>();
			expect(data.modules).toHaveLength(1);
			expect(data.modules[0].id).toBe('geo-test');
		});

		it('filters by tier', async () => {
			const res = await makeRequest('/api/modules?tier=foundation');
			const data = await res.json<{ modules: any[] }>();
			expect(data.modules).toHaveLength(2);
		});

		it('returns empty for non-existent category', async () => {
			const res = await makeRequest('/api/modules?category=nonexistent');
			const data = await res.json<{ modules: any[] }>();
			expect(data.modules).toHaveLength(0);
		});

		it('includes question count and default format', async () => {
			const res = await makeRequest('/api/modules');
			const data = await res.json<{ modules: any[] }>();
			const geo = data.modules.find((m: any) => m.id === 'geo-test');
			expect(geo.questionCount).toBe(3);
			expect(geo.defaultFormat).toBe('text-entry');
		});
	});

	describe('GET /api/modules/:moduleId', () => {
		it('returns module with questions', async () => {
			const res = await makeRequest('/api/modules/geo-test');
			expect(res.status).toBe(200);
			const data = await res.json<any>();
			expect(data.id).toBe('geo-test');
			expect(data.defaultFormat).toBe('text-entry');
			expect(data.questions).toHaveLength(3);
			expect(data.questions[0].answer).toBe('Paris');
			expect(data.questions[0].explanation).toBeTruthy();
		});

		it('returns questions in sort order', async () => {
			const res = await makeRequest('/api/modules/geo-test');
			const data = await res.json<any>();
			expect(data.questions[0].id).toBe('q1');
			expect(data.questions[1].id).toBe('q2');
			expect(data.questions[2].id).toBe('q3');
		});

		it('returns 404 for non-existent module', async () => {
			const res = await makeRequest('/api/modules/nonexistent');
			expect(res.status).toBe(404);
			const data = await res.json<any>();
			expect(data.error).toBeDefined();
		});

		it('includes MC options when present', async () => {
			const res = await makeRequest('/api/modules/sci-test');
			const data = await res.json<any>();
			const q = data.questions[0];
			expect(q.options).toHaveLength(4);
			expect(q.correctIndex).toBe(1);
			expect(q.answer).toBe('Jupiter');
		});

		it('parses alternate answers from JSON', async () => {
			const res = await makeRequest('/api/modules/geo-test');
			const data = await res.json<any>();
			const tokyo = data.questions.find((q: any) => q.answer === 'Tokyo');
			expect(tokyo.alternateAnswers).toContain('Tōkyō');
		});
	});

	describe('POST /api/modules/:moduleId/check', () => {
		it('checks correct text-entry answer', async () => {
			const res = await makeRequest('/api/modules/geo-test/check', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ questionId: 'q1', answer: 'Paris' }),
			});
			expect(res.status).toBe(200);
			const data = await res.json<any>();
			expect(data.correct).toBe(true);
			expect(data.explanation).toBeTruthy();
		});

		it('checks incorrect text-entry answer', async () => {
			const res = await makeRequest('/api/modules/geo-test/check', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ questionId: 'q1', answer: 'London' }),
			});
			const data = await res.json<any>();
			expect(data.correct).toBe(false);
			expect(data.correctAnswer).toBe('Paris');
		});

		it('accepts fuzzy match for text-entry', async () => {
			const res = await makeRequest('/api/modules/geo-test/check', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ questionId: 'q2', answer: 'Berln' }),
			});
			const data = await res.json<any>();
			expect(data.correct).toBe(true);
			expect(data.fuzzyMatch).toBe(true);
		});

		it('checks correct multiple-choice answer via answerIndex', async () => {
			const res = await makeRequest('/api/modules/sci-test/check', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ questionId: 'q1', answerIndex: 1 }),
			});
			const data = await res.json<any>();
			expect(data.correct).toBe(true);
		});

		it('checks incorrect multiple-choice answer', async () => {
			const res = await makeRequest('/api/modules/sci-test/check', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ questionId: 'q1', answerIndex: 0 }),
			});
			const data = await res.json<any>();
			expect(data.correct).toBe(false);
			expect(data.correctAnswer).toBe('Jupiter');
		});

		it('allows explicit format override', async () => {
			// Use text-entry format on a question that has MC data
			const res = await makeRequest('/api/modules/sci-test/check', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ questionId: 'q1', answer: 'Jupiter', format: 'text-entry' }),
			});
			const data = await res.json<any>();
			expect(data.correct).toBe(true);
		});

		it('returns 404 for non-existent question', async () => {
			const res = await makeRequest('/api/modules/geo-test/check', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ questionId: 'q999', answer: 'test' }),
			});
			expect(res.status).toBe(404);
		});

		it('returns 404 for non-existent module', async () => {
			const res = await makeRequest('/api/modules/nonexistent/check', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ questionId: 'q1', answer: 'test' }),
			});
			expect(res.status).toBe(404);
		});

		it('returns 400 when missing questionId', async () => {
			const res = await makeRequest('/api/modules/geo-test/check', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ answer: 'Paris' }),
			});
			expect(res.status).toBe(400);
		});
	});

	describe('GET /api/quiz/random', () => {
		it('returns a random question', async () => {
			const res = await makeRequest('/api/quiz/random');
			expect(res.status).toBe(200);
			const data = await res.json<any>();
			expect(data.moduleId).toBeTruthy();
			expect(data.moduleName).toBeTruthy();
			expect(data.question).toBeDefined();
			expect(data.question.id).toBeTruthy();
		});

		it('filters by category', async () => {
			const res = await makeRequest('/api/quiz/random?category=science');
			const data = await res.json<any>();
			expect(data.moduleId).toBe('sci-test');
		});
	});

	describe('error handling', () => {
		it('returns 405 for wrong method on check endpoint', async () => {
			const res = await makeRequest('/api/modules/geo-test/check');
			expect(res.status).toBe(405);
		});

		it('returns 404 for unknown API route', async () => {
			const res = await makeRequest('/api/unknown');
			expect(res.status).toBe(404);
		});
	});
});
