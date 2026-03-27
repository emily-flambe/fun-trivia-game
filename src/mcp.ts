import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { QuizRepository } from './data/repository';
import { checkAnswerByFormat } from './lib/answer-checker';

/**
 * Create a new MCP server instance for the trivia trainer.
 * MUST create a new instance per request (MCP SDK requirement).
 */
export function createTriviaServer(db: D1Database): McpServer {
	const server = new McpServer({
		name: 'trivia-trainer',
		version: '0.0.1',
	});

	const repo = new QuizRepository(db);

	server.tool('list_categories', 'List all trivia categories with module counts and tier breakdowns', {}, async () => {
		const categories = await repo.getCategories();
		return { content: [{ type: 'text' as const, text: JSON.stringify(categories, null, 2) }] };
	});

	server.tool(
		'list_modules',
		'List quiz modules, optionally filtered by category and/or tier',
		{
			category: z
				.enum(['geography', 'history', 'science', 'literature', 'entertainment', 'sports'])
				.optional()
				.describe('Filter by category'),
			tier: z.enum(['foundation', 'core', 'advanced']).optional().describe('Filter by difficulty tier'),
		},
		async ({ category, tier }) => {
			const modules = await repo.getModules({ category, tier });
			return { content: [{ type: 'text' as const, text: JSON.stringify(modules, null, 2) }] };
		}
	);

	server.tool(
		'get_module',
		'Get a quiz module with all its questions, answers, and explanations',
		{
			moduleId: z.string().describe('Module ID (e.g., "hist-us-presidents", "geo-us-state-capitals")'),
		},
		async ({ moduleId }) => {
			const mod = await repo.getModule(moduleId);
			if (!mod) {
				return { content: [{ type: 'text' as const, text: `Module "${moduleId}" not found` }], isError: true };
			}
			return { content: [{ type: 'text' as const, text: JSON.stringify(mod, null, 2) }] };
		}
	);

	server.tool(
		'check_answer',
		'Check if an answer is correct for a specific question. Uses fuzzy matching for text-entry format.',
		{
			moduleId: z.string().describe('Module ID'),
			questionId: z.string().describe('Question ID within the module'),
			answer: z.string().describe('The answer to check'),
		},
		async ({ moduleId, questionId, answer }) => {
			const question = await repo.getQuestion(moduleId, questionId);
			if (!question) {
				return {
					content: [{ type: 'text' as const, text: `Question "${questionId}" not found in module "${moduleId}"` }],
					isError: true,
				};
			}
			const result = checkAnswerByFormat(question, { answer }, 'text-entry');
			return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
		}
	);

	server.tool(
		'get_random_question',
		'Get a random trivia question, optionally filtered by category or tier',
		{
			category: z
				.enum(['geography', 'history', 'science', 'literature', 'entertainment', 'sports'])
				.optional()
				.describe('Filter by category'),
			tier: z.enum(['foundation', 'core', 'advanced']).optional().describe('Filter by tier'),
		},
		async ({ category, tier }) => {
			const q = await repo.getRandomQuestion({ category, tier });
			if (!q) {
				return { content: [{ type: 'text' as const, text: 'No questions found matching filters' }], isError: true };
			}
			const { moduleName, ...question } = q;
			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify(
							{
								moduleId: question.moduleId,
								moduleName,
								questionId: question.id,
								question: question.question,
								// Don't include answer — let the agent use check_answer
							},
							null,
							2
						),
					},
				],
			};
		}
	);

	return server;
}
