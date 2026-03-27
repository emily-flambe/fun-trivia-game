import { NodeRepository } from './data/repository';
import { checkTextEntry, checkFillBlanks } from './lib/answer-checker';

interface Env {
	DB: D1Database;
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

		// REST API
		if (path.startsWith('/api/')) {
			return handleApi(path, url, request, env);
		}

		return new Response(html(), {
			headers: { 'Content-Type': 'text/html; charset=utf-8' },
		});
	},
} satisfies ExportedHandler<Env>;

async function handleApi(path: string, url: URL, request: Request, env: Env): Promise<Response> {
	const repo = new NodeRepository(env.DB);

	try {
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
