import { QuizRepository } from './data/repository';
import { checkAnswerByFormat } from './lib/answer-checker';
import type { Category, Tier, QuestionFormat } from './data/types';

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
	const repo = new QuizRepository(env.DB);

	try {
		if (path === '/api/health') {
			return json({ status: 'ok', version: '0.0.1' });
		}

		if (path === '/api/categories') {
			const categories = await repo.getCategories();
			return json({ categories });
		}

		if (path === '/api/quiz/random') {
			const category = url.searchParams.get('category') as Category | null;
			const tier = url.searchParams.get('tier') as Tier | null;
			const result = await repo.getRandomQuestion({
				category: category || undefined,
				tier: tier || undefined,
			});
			if (!result) {
				return json({ error: 'No questions found' }, 404);
			}
			const { moduleName, ...question } = result;
			return json({
				moduleId: question.moduleId,
				moduleName,
				question: stripAnswer(question),
			});
		}

		// POST /api/modules/:moduleId/check
		const checkMatch = path.match(/^\/api\/modules\/([^/]+)\/check$/);
		if (checkMatch) {
			if (request.method !== 'POST') {
				return json({ error: 'Method not allowed' }, 405);
			}
			return handleCheckAnswer(checkMatch[1], request, repo);
		}

		// GET /api/modules/:moduleId
		const moduleMatch = path.match(/^\/api\/modules\/([^/]+)$/);
		if (moduleMatch) {
			const mod = await repo.getModule(moduleMatch[1]);
			if (!mod) {
				return json({ error: 'Module not found', moduleId: moduleMatch[1] }, 404);
			}
			return json(mod);
		}

		if (path === '/api/modules') {
			const category = url.searchParams.get('category') as Category | null;
			const tier = url.searchParams.get('tier') as Tier | null;
			const modules = await repo.getModules({
				category: category || undefined,
				tier: tier || undefined,
			});
			return json({ modules });
		}

		return json({ error: 'Not found' }, 404);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Internal server error';
		return json({ error: message }, 500);
	}
}

async function handleCheckAnswer(moduleId: string, request: Request, repo: QuizRepository): Promise<Response> {
	const body = await request.json<{
		questionId?: string;
		answer?: string;
		answerIndex?: number;
		format?: QuestionFormat;
	}>();

	if (!body.questionId) {
		return json({ error: 'Missing required field: questionId' }, 400);
	}

	const question = await repo.getQuestion(moduleId, body.questionId);
	if (!question) {
		return json({ error: 'Question not found', questionId: body.questionId }, 404);
	}

	// Use requested format, or infer from the input
	const format: QuestionFormat = body.format ?? (body.answerIndex !== undefined ? 'multiple-choice' : 'text-entry');

	const result = checkAnswerByFormat(question, { answer: body.answer, answerIndex: body.answerIndex }, format);
	return json(result);
}

function stripAnswer(question: any): any {
	const { answer, alternateAnswers, correctIndex, matchPairs, ...safe } = question;
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
  <p style="margin-top: 1rem; font-size: 0.875rem; color: #64748b;">Try: <code>/api/health</code>, <code>/api/categories</code>, <code>/api/modules</code></p>
</div>
</body>
</html>`;
}
