import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { NodeRepository } from './data/repository';
import { checkTextEntry, checkFillBlanks } from './lib/answer-checker';

/**
 * Create a new MCP server instance for the trivia trainer.
 * MUST create a new instance per request (MCP SDK requirement).
 */
export function createTriviaServer(db: D1Database): McpServer {
	const server = new McpServer({
		name: 'trivia-trainer',
		version: '0.0.1',
	});

	const repo = new NodeRepository(db);

	server.tool('list_nodes', 'List root category nodes, or children of a given node', {
		parentId: z.string().optional().describe('Parent node ID. If omitted, returns root nodes.'),
	}, async ({ parentId }) => {
		if (parentId) {
			const result = await repo.getNode(parentId);
			if (!result) {
				return { content: [{ type: 'text' as const, text: `Node "${parentId}" not found` }], isError: true };
			}
			return { content: [{ type: 'text' as const, text: JSON.stringify(result.children, null, 2) }] };
		}
		const nodes = await repo.getRootNodes();
		return { content: [{ type: 'text' as const, text: JSON.stringify(nodes, null, 2) }] };
	});

	server.tool('get_node', 'Get node detail with children and exercises', {
		nodeId: z.string().describe('Node ID (e.g., "science", "science/chemistry")'),
	}, async ({ nodeId }) => {
		const result = await repo.getNode(nodeId);
		if (!result) {
			return { content: [{ type: 'text' as const, text: `Node "${nodeId}" not found` }], isError: true };
		}
		return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
	});

	server.tool('get_exercise', 'Get exercise with all items including answers (for agent use)', {
		exerciseId: z.string().describe('Exercise ID (e.g., "science/chemistry/element-symbols")'),
	}, async ({ exerciseId }) => {
		const result = await repo.getExercise(exerciseId);
		if (!result) {
			return { content: [{ type: 'text' as const, text: `Exercise "${exerciseId}" not found` }], isError: true };
		}
		return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
	});

	server.tool('check_answer', 'Check an answer for an exercise. For text-entry, provide itemId. For fill-blanks, omit itemId.', {
		exerciseId: z.string().describe('Exercise ID'),
		answer: z.string().describe('The answer to check'),
		itemId: z.string().optional().describe('Item ID (required for text-entry, omit for fill-blanks)'),
	}, async ({ exerciseId, answer, itemId }) => {
		if (itemId) {
			const item = await repo.getItem(exerciseId, itemId);
			if (!item) {
				return { content: [{ type: 'text' as const, text: `Item "${itemId}" not found in exercise "${exerciseId}"` }], isError: true };
			}
			const result = checkTextEntry(item, answer);
			return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
		}
		const items = await repo.getExerciseItems(exerciseId);
		if (items.length === 0) {
			return { content: [{ type: 'text' as const, text: `Exercise "${exerciseId}" not found or has no items` }], isError: true };
		}
		const result = checkFillBlanks(items, answer);
		return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
	});

	return server;
}
