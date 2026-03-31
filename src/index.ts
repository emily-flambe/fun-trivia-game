import { NodeRepository } from './data/repository';
import { AdminRepository, NotFoundError } from './data/admin-repository';
import { UserRepository } from './data/user-repository';
import { checkTextEntry, checkFillBlanks } from './lib/answer-checker';
import type { User, ExerciseFormat, QuizItemResult } from './data/types';

interface Env {
	DB: D1Database;
	CF_ACCESS_TEAM_DOMAIN: string;
	CF_ACCESS_AUD: string;
	CF_ACCESS_TEST_EMAIL?: string; // Set in .dev.vars only — enables local auth bypass
	CF_ADMIN_EMAILS?: string; // Comma-separated list of admin emails
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;

		// MCP endpoint — lazy import to avoid bundling ajv/agents into test env
		if (path === '/mcp' || path.startsWith('/mcp/')) {
			const { createMcpHandler } = await import('agents/mcp');
			const { createTriviaServer } = await import('./mcp');
			const server = createTriviaServer(env.DB);
			return createMcpHandler(server, { route: '/mcp' })(request, env, ctx);
		}

		// Local dev test login — sets a test cookie and redirects to app root
		if (path === '/auth/test-login' && env.CF_ACCESS_TEST_EMAIL) {
			const email = url.searchParams.get('email') || env.CF_ACCESS_TEST_EMAIL;
			return new Response(null, {
				status: 302,
				headers: {
					'Location': url.origin + '/#/',
					'Set-Cookie': `CF_Test_Auth=${email}; Path=/; SameSite=Lax`,
				},
			});
		}

		// Auth login redirect — after Cloudflare Access authenticates, redirect to app root
		if (path === '/auth/login') {
			return Response.redirect(url.origin + '/#/', 302);
		}

		// REST API
		if (path.startsWith('/api/')) {
			return handleApi(path, url, request, env);
		}

		return new Response(html(), {
			headers: { 'Content-Type': 'text/html; charset=utf-8' },
		});
	},
} satisfies ExportedHandler<Env>;

async function getAuthEmail(request: Request, env: Env): Promise<string | null> {
	if (env.CF_ACCESS_TEST_EMAIL) {
		const testCookie = getCookie(request, 'CF_Test_Auth');
		if (testCookie === env.CF_ACCESS_TEST_EMAIL) return env.CF_ACCESS_TEST_EMAIL;
		return null;
	}
	if (!env.CF_ACCESS_TEAM_DOMAIN || !env.CF_ACCESS_AUD) return null;
	const { getAuthUser } = await import('./lib/auth');
	const user = await getAuthUser(request, env.CF_ACCESS_TEAM_DOMAIN, env.CF_ACCESS_AUD);
	return user?.email ?? null;
}

async function getRequestUser(request: Request, env: Env): Promise<User | null> {
	const email = await getAuthEmail(request, env);
	if (!email) return null;
	const userRepo = new UserRepository(env.DB);
	return userRepo.getByEmail(email);
}

async function isAdmin(request: Request, env: Env): Promise<string | null> {
	// Test bypass (local dev only)
	if (env.CF_ACCESS_TEST_EMAIL) {
		const testCookie = getCookie(request, 'CF_Test_Auth');
		if (testCookie === env.CF_ACCESS_TEST_EMAIL) return env.CF_ACCESS_TEST_EMAIL;
		return null;
	}

	if (!env.CF_ACCESS_TEAM_DOMAIN || !env.CF_ACCESS_AUD) return null;
	const { getAuthUser } = await import('./lib/auth');
	const user = await getAuthUser(request, env.CF_ACCESS_TEAM_DOMAIN, env.CF_ACCESS_AUD);
	if (!user) return null;

	// Service tokens that pass CF Access policy validation are trusted as admin
	if (user.isServiceToken) return user.email;

	const adminEmails = (env.CF_ADMIN_EMAILS || 'emily@emilycogsdill.com').split(',').map(e => e.trim().toLowerCase());
	if (!adminEmails.includes(user.email.toLowerCase())) return null;
	return user.email;
}

async function handleAuthMe(request: Request, url: URL, env: Env): Promise<Response> {
	// Local dev bypass: if CF_ACCESS_TEST_EMAIL is set and request has the test cookie, trust it
	if (env.CF_ACCESS_TEST_EMAIL) {
		const testCookie = getCookie(request, 'CF_Test_Auth');
		if (testCookie === env.CF_ACCESS_TEST_EMAIL) {
			const userRepo = new UserRepository(env.DB);
			const dbUser = await userRepo.upsertByEmail(env.CF_ACCESS_TEST_EMAIL);
			return json({
				authenticated: true,
				email: env.CF_ACCESS_TEST_EMAIL,
				userId: dbUser.id,
				logoutUrl: '/',
			});
		}
		return json({
			authenticated: false,
			loginUrl: `/auth/test-login?email=${encodeURIComponent(env.CF_ACCESS_TEST_EMAIL)}`,
		});
	}

	if (!env.CF_ACCESS_TEAM_DOMAIN || !env.CF_ACCESS_AUD) {
		return json({ authenticated: false });
	}

	const { getAuthUser } = await import('./lib/auth');
	const user = await getAuthUser(request, env.CF_ACCESS_TEAM_DOMAIN, env.CF_ACCESS_AUD);

	if (user) {
		const userRepo = new UserRepository(env.DB);
		const dbUser = await userRepo.upsertByEmail(user.email);
		return json({
			authenticated: true,
			email: user.email,
			userId: dbUser.id,
			logoutUrl: `/cdn-cgi/access/logout?returnTo=${encodeURIComponent(url.origin + '/')}`,
		});
	}

	return json({
		authenticated: false,
		loginUrl: '/auth/login',
	});
}

async function handleApi(path: string, url: URL, request: Request, env: Env): Promise<Response> {
	if (path === '/api/auth/me') {
		return handleAuthMe(request, url, env);
	}

	// Admin API routes (require admin auth)
	if (path.startsWith('/api/admin/')) {
		const adminEmail = await isAdmin(request, env);
		if (!adminEmail) return json({ error: 'Admin access required' }, 403);

		return handleAdminApi(path, request, env);
	}

	const repo = new NodeRepository(env.DB);

	try {
		// Quiz results routes (require auth)
		if (path === '/api/quiz-results/stats/by-category' && request.method === 'GET') {
			const user = await getRequestUser(request, env);
			if (!user) return json({ error: 'Authentication required' }, 401);
			const userRepo = new UserRepository(env.DB);
			const categories = await userRepo.getCategoryStats(user.id);
			return json({ categories });
		}

		if (path === '/api/quiz-results/stats' && request.method === 'GET') {
			const user = await getRequestUser(request, env);
			if (!user) return json({ error: 'Authentication required' }, 401);
			const userRepo = new UserRepository(env.DB);
			const stats = await userRepo.getUserStats(user.id);
			return json(stats);
		}

		if (path === '/api/quiz-results' && request.method === 'POST') {
			const user = await getRequestUser(request, env);
			if (!user) return json({ error: 'Authentication required' }, 401);
			const body = await request.json<{
				exerciseId: string;
				exerciseName: string;
				format: string;
				score: number;
				total: number;
				durationSeconds?: number;
				itemsDetail?: QuizItemResult[];
				isRetry?: boolean;
				parentResultId?: string;
			}>();
			if (!body.exerciseId || !body.exerciseName || !body.format || body.score == null || body.total == null) {
				return json({ error: 'Missing required fields' }, 400);
			}
			if (typeof body.score !== 'number' || typeof body.total !== 'number') {
				return json({ error: 'score and total must be numbers' }, 400);
			}
			const userRepo = new UserRepository(env.DB);
			const result = await userRepo.recordQuizResult({
				userId: user.id,
				exerciseId: body.exerciseId,
				exerciseName: body.exerciseName,
				format: body.format as ExerciseFormat,
				score: body.score,
				total: body.total,
				durationSeconds: body.durationSeconds ?? null,
				itemsDetail: body.itemsDetail ?? [],
				isRetry: !!body.isRetry,
				parentResultId: body.parentResultId || undefined,
			});
			return json(result, 201);
		}

		if (path === '/api/quiz-results' && request.method === 'GET') {
			const user = await getRequestUser(request, env);
			if (!user) return json({ error: 'Authentication required' }, 401);
			const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10) || 20));
			const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10) || 0);
			const userRepo = new UserRepository(env.DB);
			const data = await userRepo.getQuizResults(user.id, limit, offset);
			return json(data);
		}

		if (path === '/api/quiz-results/by-exercise' && request.method === 'GET') {
			const user = await getRequestUser(request, env);
			if (!user) return json({ error: 'Authentication required' }, 401);
			const userRepo = new UserRepository(env.DB);
			const summaries = await userRepo.getQuizResultsByExercise(user.id);
			return json({ exercises: summaries });
		}

		const quizResultDetailMatch = path.match(/^\/api\/quiz-results\/([^/]+)$/);
		if (quizResultDetailMatch && request.method === 'GET') {
			const user = await getRequestUser(request, env);
			if (!user) return json({ error: 'Authentication required' }, 401);
			const resultId = quizResultDetailMatch[1];
			const row = await env.DB
				.prepare(`SELECT * FROM quiz_results WHERE id = ? AND user_id = ?`)
				.bind(resultId, user.id)
				.first<{
					id: string;
					user_id: string;
					exercise_id: string;
					exercise_name: string;
					format: string;
					score: number;
					total: number;
					items_detail: string;
					completed_at: string;
				}>();
			if (!row) return json({ error: 'Not found' }, 404);

			const itemsDetail: QuizItemResult[] = JSON.parse(row.items_detail || '[]');

			// Enrich each item with prompt and answer from the items table
			const enriched = await Promise.all(
				itemsDetail.map(async (detail) => {
					const itemRow = await env.DB
						.prepare(
							`SELECT answer, data FROM items WHERE id = ? LIMIT 1`
						)
						.bind(detail.itemId)
						.first<{ answer: string; data: string }>();

					let prompt = detail.itemId;
					let correctAnswer = 'unknown';
					if (itemRow) {
						correctAnswer = itemRow.answer;
						try {
							const data = JSON.parse(itemRow.data || '{}');
							prompt = data.prompt ?? detail.itemId;
						} catch {
							prompt = detail.itemId;
						}
					}

					return {
						itemId: detail.itemId,
						prompt,
						correctAnswer,
						userAnswer: detail.userAnswer,
						correct: detail.correct,
						fuzzyMatch: detail.fuzzyMatch,
					};
				})
			);

			return json({
				id: row.id,
				exerciseId: row.exercise_id,
				exerciseName: row.exercise_name,
				score: row.score,
				total: row.total,
				format: row.format,
				completedAt: row.completed_at,
				items: enriched,
			});
		}

		if (path === '/api/health') {
			return json({ status: 'ok', version: '0.0.1' });
		}

		if (path === '/api/nodes') {
			const nodes = await repo.getRootNodes();
			return json({ nodes });
		}

		const nodeMatch = path.match(/^\/api\/nodes\/(.+)$/);
		if (nodeMatch) {
			const result = await repo.getNode(nodeMatch[1]);
			if (!result) return json({ error: 'Node not found' }, 404);
			const breadcrumbs = await repo.getNodeBreadcrumbs(nodeMatch[1]);
			return json({ ...result, breadcrumbs });
		}

		if (path === '/api/exercises/random') {
			const id = await repo.getRandomExerciseId();
			if (!id) return json({ error: 'No exercises found' }, 404);
			return json({ id });
		}

		if (path === '/api/items/random') {
			const count = Math.min(50, Math.max(1, parseInt(url.searchParams.get('count') || '20', 10) || 20));
			const items = await repo.getRandomItems(count);
			return json({
				items: items.map(({ answer, alternates, ...safe }) => safe),
			});
		}

		// GET /api/exercises/:path+/answers — reveal all answers (for give-up)
		const answersMatch = path.match(/^\/api\/exercises\/(.+)\/answers$/);
		if (answersMatch) {
			const result = await repo.getExercise(answersMatch[1]);
			if (!result) return json({ error: 'Exercise not found' }, 404);
			return json({
				items: result.items.map((item) => ({
					id: item.id,
					answer: item.answer,
					explanation: item.explanation,
					sortOrder: item.sortOrder,
				})),
			});
		}

		// POST /api/exercises/:path+/check — MUST be before exercise detail route
		const checkMatch = path.match(/^\/api\/exercises\/(.+)\/check$/);
		if (checkMatch && request.method === 'POST') {
			return handleCheckAnswer(checkMatch[1], request, repo);
		}
		if (checkMatch) {
			return json({ error: 'Method not allowed' }, 405);
		}

		// GET /api/exercises/:path+
		const exerciseMatch = path.match(/^\/api\/exercises\/(.+)$/);
		if (exerciseMatch) {
			const result = await repo.getExercise(exerciseMatch[1]);
			if (!result) return json({ error: 'Exercise not found' }, 404);
			return json({
				exercise: result.exercise,
				items: result.items.map(stripItemAnswers),
			});
		}

		return json({ error: 'Not found' }, 404);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Internal server error';
		return json({ error: message }, 500);
	}
}

async function handleAdminApi(path: string, request: Request, env: Env): Promise<Response> {
	const db = env.DB;

	try {
		// Single item operations: /api/admin/exercises/:exerciseId/items/:itemId
		const singleItemMatch = path.match(/^\/api\/admin\/exercises\/(.+)\/items\/([^/]+)$/);
		if (singleItemMatch) {
			const exerciseId = decodeURIComponent(singleItemMatch[1]);
			const itemId = decodeURIComponent(singleItemMatch[2]);

			if (request.method === 'PUT') {
				const body = await request.json<any>();
				const item = await AdminRepository.updateItem(db, exerciseId, itemId, body);
				return json(item);
			}
			if (request.method === 'DELETE') {
				await AdminRepository.deleteItem(db, exerciseId, itemId);
				return json({ deleted: true });
			}
			return json({ error: 'Method not allowed' }, 405);
		}

		// Bulk item operations: /api/admin/exercises/:exerciseId/items
		const bulkItemsMatch = path.match(/^\/api\/admin\/exercises\/(.+)\/items$/);
		if (bulkItemsMatch) {
			const exerciseId = decodeURIComponent(bulkItemsMatch[1]);
			if (request.method === 'POST') {
				const body = await request.json<any>();
				if (!Array.isArray(body.items)) {
					return json({ error: 'Missing required field: items (array)' }, 400);
				}
				const items = await AdminRepository.bulkUpsertItems(db, exerciseId, body.items);
				return json({ items }, 201);
			}
			return json({ error: 'Method not allowed' }, 405);
		}

		// Exercise CRUD: /api/admin/exercises or /api/admin/exercises/:id
		if (path === '/api/admin/exercises' && request.method === 'POST') {
			const body = await request.json<any>();
			if (!body.id || !body.nodeId || !body.name || !body.format) {
				return json({ error: 'Missing required fields: id, nodeId, name, format' }, 400);
			}
			const exercise = await AdminRepository.createExercise(db, body);
			return json(exercise, 201);
		}

		const exerciseMatch = path.match(/^\/api\/admin\/exercises\/(.+)$/);
		if (exerciseMatch) {
			const exerciseId = decodeURIComponent(exerciseMatch[1]);
			if (request.method === 'PUT') {
				const body = await request.json<any>();
				const exercise = await AdminRepository.updateExercise(db, exerciseId, body);
				return json(exercise);
			}
			if (request.method === 'DELETE') {
				await AdminRepository.deleteExercise(db, exerciseId);
				return json({ deleted: true });
			}
			return json({ error: 'Method not allowed' }, 405);
		}

		// Node upsert
		if (path === '/api/admin/nodes' && request.method === 'POST') {
			const body = await request.json<any>();
			if (!body.id || !body.name) {
				return json({ error: 'Missing required fields: id, name' }, 400);
			}
			const node = await AdminRepository.upsertNode(db, body);
			return json(node, 201);
		}

		// Export single exercise
		const exportExerciseMatch = path.match(/^\/api\/admin\/export\/(.+)$/);
		if (exportExerciseMatch && request.method === 'GET') {
			const data = await AdminRepository.exportExercise(db, decodeURIComponent(exportExerciseMatch[1]));
			return json(data);
		}

		// Export all
		if (path === '/api/admin/export' && request.method === 'GET') {
			const data = await AdminRepository.exportAll(db);
			return json(data);
		}

		// Content health
		if (path === '/api/admin/content-health' && request.method === 'GET') {
			const report = await AdminRepository.getContentHealth(db);
			return json(report);
		}

		return json({ error: 'Not found' }, 404);
	} catch (err) {
		if (err instanceof NotFoundError) {
			return json({ error: err.message }, 404);
		}
		const message = err instanceof Error ? err.message : 'Internal server error';
		return json({ error: message }, 500);
	}
}

async function handleCheckAnswer(exercisePath: string, request: Request, repo: NodeRepository): Promise<Response> {
	const body = await request.json<{ itemId?: string; answer?: string }>();

	if (body.answer == null) {
		return json({ error: 'Missing required field: answer' }, 400);
	}

	// Get the exercise to know its format
	const exerciseResult = await repo.getExercise(exercisePath);
	if (!exerciseResult) {
		return json({ error: 'Exercise not found' }, 404);
	}

	const { exercise, items } = exerciseResult;

	if (exercise.format === 'text-entry') {
		// Text-entry requires itemId
		if (!body.itemId) {
			return json({ error: 'Missing required field: itemId for text-entry format' }, 400);
		}
		const item = items.find((i) => i.id === body.itemId);
		if (!item) {
			return json({ error: 'Item not found', itemId: body.itemId }, 404);
		}
		const result = checkTextEntry(item, body.answer ?? '');
		return json(result);
	}

	if (exercise.format === 'fill-blanks') {
		// Fill-blanks checks against all items
		const result = checkFillBlanks(items, body.answer ?? '');
		return json(result);
	}

	return json({ error: `Unsupported format: ${exercise.format}` }, 400);
}

function stripItemAnswers(item: any): any {
	const { answer, alternates, ...safe } = item;
	return safe;
}

function getCookie(request: Request, name: string): string | null {
	const header = request.headers.get('cookie');
	if (!header) return null;
	const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
	return match ? match[1] : null;
}

function json(data: any, status = 200): Response {
	return Response.json(data, { status });
}

function html(): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Trivia Trainer</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
  .card { background: #1e293b; border-radius: 16px; padding: 2rem; max-width: 480px; width: 90%; box-shadow: 0 8px 32px rgba(0,0,0,0.3); text-align: center; }
  h1 { margin-bottom: 1rem; color: #38bdf8; }
  p { color: #94a3b8; line-height: 1.6; }
</style>
</head>
<body>
<div class="card">
  <h1>Trivia Trainer</h1>
  <p>API is live. React SPA coming soon.</p>
  <p style="margin-top: 1rem; font-size: 0.875rem; color: #64748b;">Try: <code>/api/health</code>, <code>/api/nodes</code></p>
</div>
</body>
</html>`;
}
