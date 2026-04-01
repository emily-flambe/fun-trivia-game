import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { NodeRepository } from './data/repository';
import { AdminRepository, NotFoundError } from './data/admin-repository';
import { checkTextEntry, checkFillBlanks, checkSequenceOrdering, checkClassificationSort } from './lib/answer-checker';
import type { CreateExerciseInput, UpdateExerciseInput, UpdateItemInput, CreateNodeInput, CreateItemInput } from './data/types';

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

	// === Read-only tools ===

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

	server.tool('check_answer', 'Check an answer for an exercise. For text-entry/letter-by-letter, provide itemId + answer. For fill-blanks, provide answer. For sequence-ordering, provide order (array of item IDs). For classification-sort, provide assignments (itemId -> category).', {
		exerciseId: z.string().describe('Exercise ID'),
		answer: z.string().optional().describe('The answer to check'),
		order: z.array(z.string()).optional().describe('Ordered item IDs for sequence-ordering format'),
		assignments: z.record(z.string(), z.string()).optional().describe('Classification assignments (itemId -> category)'),
		itemId: z.string().optional().describe('Item ID (required for text-entry/letter-by-letter, omit for fill-blanks)'),
	}, async ({ exerciseId, answer, order, assignments, itemId }) => {
		const exerciseResult = await repo.getExercise(exerciseId);
		if (!exerciseResult) {
			return { content: [{ type: 'text' as const, text: `Exercise "${exerciseId}" not found` }], isError: true };
		}

		if (exerciseResult.exercise.format === 'text-entry' || exerciseResult.exercise.format === 'letter-by-letter') {
			if (!itemId) {
				return { content: [{ type: 'text' as const, text: 'itemId is required for item-based formats' }], isError: true };
			}
			if (answer == null) {
				return { content: [{ type: 'text' as const, text: 'answer is required for item-based formats' }], isError: true };
			}
			const item = await repo.getItem(exerciseId, itemId);
			if (!item) {
				return { content: [{ type: 'text' as const, text: `Item "${itemId}" not found in exercise "${exerciseId}"` }], isError: true };
			}
			const result = checkTextEntry(item, answer);
			return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
		}

		if (exerciseResult.exercise.format === 'fill-blanks') {
			if (answer == null) {
				return { content: [{ type: 'text' as const, text: 'answer is required for fill-blanks format' }], isError: true };
			}
			const result = checkFillBlanks(exerciseResult.items, answer);
			return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
		}

		if (exerciseResult.exercise.format === 'sequence-ordering') {
			if (!Array.isArray(order)) {
				return { content: [{ type: 'text' as const, text: 'order is required for sequence-ordering format' }], isError: true };
			}
			const result = checkSequenceOrdering(exerciseResult.items, order);
			return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
		}

		if (exerciseResult.exercise.format === 'classification-sort') {
			if (!assignments || typeof assignments !== 'object') {
				return { content: [{ type: 'text' as const, text: 'assignments is required for classification-sort format' }], isError: true };
			}
			const result = checkClassificationSort(exerciseResult.items, assignments);
			return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
		}

		return { content: [{ type: 'text' as const, text: `Unsupported format: ${exerciseResult.exercise.format}` }], isError: true };
	});

	// === Write tools ===

	const itemSchema = z.object({
		id: z.string().describe('Item slug ID'),
		answer: z.string().describe('Canonical answer'),
		alternates: z.array(z.string()).optional().describe('Alternate accepted spellings'),
		explanation: z.string().optional().describe('Memorable explanation'),
		data: z.record(z.string(), z.unknown()).optional().describe('Format-specific data (prompt, links, cardFront, etc.)'),
		sortOrder: z.number().optional().describe('Display order'),
	});

	server.tool('create_exercise', 'Create a new exercise with optional items', {
		id: z.string().describe('Exercise ID (e.g., "science/chemistry/element-symbols")'),
		nodeId: z.string().describe('Parent node ID (e.g., "science/chemistry")'),
		name: z.string().describe('Display name'),
		format: z.enum(['text-entry', 'fill-blanks', 'letter-by-letter', 'sequence-ordering', 'classification-sort']).describe('Exercise format'),
		description: z.string().optional().describe('Short description'),
		displayType: z.string().optional().describe('Learn mode renderer (cards, periodic-table, map, timeline)'),
		config: z.record(z.string(), z.unknown()).optional().describe('Format-specific config (e.g., { ordered: false, prompt: "..." })'),
		sortOrder: z.number().optional().describe('Display order'),
		items: z.array(itemSchema).optional().describe('Initial items to create with the exercise'),
	}, async (params) => {
		try {
			const result = await AdminRepository.createExercise(db, params as unknown as CreateExerciseInput);
			return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
		} catch (err) {
			if (err instanceof NotFoundError) {
				return { content: [{ type: 'text' as const, text: err.message }], isError: true };
			}
			throw err;
		}
	});

	server.tool('update_exercise', 'Update exercise metadata (name, description, format, etc.)', {
		exerciseId: z.string().describe('Exercise ID to update'),
		name: z.string().optional().describe('New display name'),
		description: z.string().optional().describe('New description'),
		format: z.enum(['text-entry', 'fill-blanks', 'letter-by-letter', 'sequence-ordering', 'classification-sort']).optional().describe('New format'),
		displayType: z.string().optional().describe('New display type'),
		config: z.record(z.string(), z.unknown()).optional().describe('New format-specific config'),
		sortOrder: z.number().optional().describe('New display order'),
	}, async ({ exerciseId, ...updates }) => {
		try {
			const result = await AdminRepository.updateExercise(db, exerciseId, updates as UpdateExerciseInput);
			return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
		} catch (err) {
			if (err instanceof NotFoundError) {
				return { content: [{ type: 'text' as const, text: err.message }], isError: true };
			}
			throw err;
		}
	});

	server.tool('delete_exercise', 'Delete an exercise and all its items', {
		exerciseId: z.string().describe('Exercise ID to delete'),
	}, async ({ exerciseId }) => {
		try {
			await AdminRepository.deleteExercise(db, exerciseId);
			return { content: [{ type: 'text' as const, text: JSON.stringify({ deleted: exerciseId }, null, 2) }] };
		} catch (err) {
			if (err instanceof NotFoundError) {
				return { content: [{ type: 'text' as const, text: err.message }], isError: true };
			}
			throw err;
		}
	});

	server.tool('upsert_items', 'Bulk create or update items in an exercise', {
		exerciseId: z.string().describe('Exercise ID to add items to'),
		items: z.array(itemSchema).describe('Items to create or update'),
	}, async ({ exerciseId, items }) => {
		try {
			const result = await AdminRepository.bulkUpsertItems(db, exerciseId, items as unknown as CreateItemInput[]);
			return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
		} catch (err) {
			if (err instanceof NotFoundError) {
				return { content: [{ type: 'text' as const, text: err.message }], isError: true };
			}
			throw err;
		}
	});

	server.tool('update_item', 'Update a single item (fix typo, add links, edit explanation)', {
		exerciseId: z.string().describe('Exercise ID containing the item'),
		itemId: z.string().describe('Item ID to update'),
		answer: z.string().optional().describe('New canonical answer'),
		alternates: z.array(z.string()).optional().describe('New alternate spellings'),
		explanation: z.string().optional().describe('New explanation'),
		data: z.record(z.string(), z.unknown()).optional().describe('New format-specific data'),
		sortOrder: z.number().optional().describe('New display order'),
	}, async ({ exerciseId, itemId, ...updates }) => {
		try {
			const result = await AdminRepository.updateItem(db, exerciseId, itemId, updates as UpdateItemInput);
			return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
		} catch (err) {
			if (err instanceof NotFoundError) {
				return { content: [{ type: 'text' as const, text: err.message }], isError: true };
			}
			throw err;
		}
	});

	server.tool('delete_item', 'Delete a single item from an exercise', {
		exerciseId: z.string().describe('Exercise ID containing the item'),
		itemId: z.string().describe('Item ID to delete'),
	}, async ({ exerciseId, itemId }) => {
		try {
			await AdminRepository.deleteItem(db, exerciseId, itemId);
			return { content: [{ type: 'text' as const, text: JSON.stringify({ deleted: itemId, exerciseId }, null, 2) }] };
		} catch (err) {
			if (err instanceof NotFoundError) {
				return { content: [{ type: 'text' as const, text: err.message }], isError: true };
			}
			throw err;
		}
	});

	server.tool('upsert_node', 'Create or update a navigation node', {
		id: z.string().describe('Node ID (e.g., "science/chemistry")'),
		name: z.string().describe('Display name'),
		parentId: z.string().optional().describe('Parent node ID (omit for root nodes)'),
		description: z.string().optional().describe('Short description'),
		sortOrder: z.number().optional().describe('Display order'),
	}, async (params) => {
		try {
			const result = await AdminRepository.upsertNode(db, params as CreateNodeInput);
			return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to upsert node';
			return { content: [{ type: 'text' as const, text: message }], isError: true };
		}
	});

	server.tool('export_exercise', 'Export exercise + items in seed-file JSON format', {
		exerciseId: z.string().describe('Exercise ID to export'),
	}, async ({ exerciseId }) => {
		try {
			const result = await AdminRepository.exportExercise(db, exerciseId);
			return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
		} catch (err) {
			if (err instanceof NotFoundError) {
				return { content: [{ type: 'text' as const, text: err.message }], isError: true };
			}
			throw err;
		}
	});

	server.tool('export_all', 'Export entire content database as seed-format JSON', {}, async () => {
		const result = await AdminRepository.exportAll(db);
		return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
	});

	server.tool('content_health', 'Get content health report (missing links, empty explanations, orphan exercises)', {}, async () => {
		const result = await AdminRepository.getContentHealth(db);
		return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
	});

	return server;
}
