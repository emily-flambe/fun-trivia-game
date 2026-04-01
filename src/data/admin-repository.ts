import { mapNode, mapExercise, mapItem } from './repository';
import type { NodeRow, ExerciseRow, ItemRow } from './repository';
import type {
	Node, Exercise, Item,
	CreateExerciseInput, UpdateExerciseInput,
	CreateItemInput, UpdateItemInput,
	CreateNodeInput, SeedExport,
	ContentHealthReport, ContentHealthIssue,
} from './types';

export class AdminRepository {
	// === Exercise CRUD ===

	static async createExercise(db: D1Database, input: CreateExerciseInput): Promise<Exercise> {
		await db
			.prepare(
				`INSERT INTO exercises (id, node_id, name, description, format, display_type, config, sort_order)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(
				input.id,
				input.nodeId,
				input.name,
				input.description ?? '',
				input.format,
				input.displayType ?? null,
				input.config ? JSON.stringify(input.config) : null,
				input.sortOrder ?? 0,
			)
			.run();

		// If items provided, insert them too
		if (input.items && input.items.length > 0) {
			await AdminRepository.bulkUpsertItems(db, input.id, input.items);
		}

		const row = await db
			.prepare(
				`SELECT e.*, (SELECT COUNT(*) FROM items i WHERE i.exercise_id = e.id) as item_count
				 FROM exercises e WHERE e.id = ?`
			)
			.bind(input.id)
			.first<ExerciseRow>();

		return mapExercise(row!);
	}

	static async updateExercise(db: D1Database, exerciseId: string, updates: UpdateExerciseInput): Promise<Exercise> {
		const sets: string[] = [];
		const values: unknown[] = [];

		if (updates.name !== undefined) {
			sets.push('name = ?');
			values.push(updates.name);
		}
		if (updates.description !== undefined) {
			sets.push('description = ?');
			values.push(updates.description);
		}
		if (updates.format !== undefined) {
			sets.push('format = ?');
			values.push(updates.format);
		}
		if (updates.displayType !== undefined) {
			sets.push('display_type = ?');
			values.push(updates.displayType);
		}
		if (updates.config !== undefined) {
			sets.push('config = ?');
			values.push(updates.config ? JSON.stringify(updates.config) : null);
		}
		if (updates.sortOrder !== undefined) {
			sets.push('sort_order = ?');
			values.push(updates.sortOrder);
		}

		if (sets.length === 0) {
			// Nothing to update, just return current
			const row = await db
				.prepare(
					`SELECT e.*, (SELECT COUNT(*) FROM items i WHERE i.exercise_id = e.id) as item_count
					 FROM exercises e WHERE e.id = ?`
				)
				.bind(exerciseId)
				.first<ExerciseRow>();
			if (!row) throw new NotFoundError(`Exercise not found: ${exerciseId}`);
			return mapExercise(row);
		}

		values.push(exerciseId);
		await db
			.prepare(`UPDATE exercises SET ${sets.join(', ')} WHERE id = ?`)
			.bind(...values)
			.run();

		const row = await db
			.prepare(
				`SELECT e.*, (SELECT COUNT(*) FROM items i WHERE i.exercise_id = e.id) as item_count
				 FROM exercises e WHERE e.id = ?`
			)
			.bind(exerciseId)
			.first<ExerciseRow>();

		if (!row) throw new NotFoundError(`Exercise not found: ${exerciseId}`);
		return mapExercise(row);
	}

	static async deleteExercise(db: D1Database, exerciseId: string): Promise<void> {
		// Items cascade via ON DELETE CASCADE
		const result = await db
			.prepare(`DELETE FROM exercises WHERE id = ?`)
			.bind(exerciseId)
			.run();

		if (!result.meta.changes || result.meta.changes === 0) {
			throw new NotFoundError(`Exercise not found: ${exerciseId}`);
		}
	}

	// === Item CRUD ===

	static async bulkUpsertItems(db: D1Database, exerciseId: string, items: CreateItemInput[]): Promise<Item[]> {
		// Verify exercise exists
		const exercise = await db
			.prepare(`SELECT id FROM exercises WHERE id = ?`)
			.bind(exerciseId)
			.first();
		if (!exercise) throw new NotFoundError(`Exercise not found: ${exerciseId}`);

		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			await db
				.prepare(
					`INSERT OR REPLACE INTO items (id, exercise_id, answer, alternates, explanation, data, sort_order)
					 VALUES (?, ?, ?, ?, ?, ?, ?)`
				)
				.bind(
					item.id,
					exerciseId,
					item.answer,
					JSON.stringify(item.alternates ?? []),
					item.explanation ?? '',
					JSON.stringify(item.data ?? {}),
					item.sortOrder ?? i,
				)
				.run();
		}

		// Read back all items for this exercise
		const rows = await db
			.prepare(`SELECT * FROM items WHERE exercise_id = ? ORDER BY sort_order`)
			.bind(exerciseId)
			.all<ItemRow>();

		return rows.results.map(mapItem);
	}

	static async updateItem(db: D1Database, exerciseId: string, itemId: string, updates: UpdateItemInput): Promise<Item> {
		const sets: string[] = [];
		const values: unknown[] = [];

		if (updates.answer !== undefined) {
			sets.push('answer = ?');
			values.push(updates.answer);
		}
		if (updates.alternates !== undefined) {
			sets.push('alternates = ?');
			values.push(JSON.stringify(updates.alternates));
		}
		if (updates.explanation !== undefined) {
			sets.push('explanation = ?');
			values.push(updates.explanation);
		}
		if (updates.data !== undefined) {
			sets.push('data = ?');
			values.push(JSON.stringify(updates.data));
		}
		if (updates.sortOrder !== undefined) {
			sets.push('sort_order = ?');
			values.push(updates.sortOrder);
		}

		if (sets.length === 0) {
			const row = await db
				.prepare(`SELECT * FROM items WHERE id = ? AND exercise_id = ?`)
				.bind(itemId, exerciseId)
				.first<ItemRow>();
			if (!row) throw new NotFoundError(`Item not found: ${itemId} in exercise ${exerciseId}`);
			return mapItem(row);
		}

		values.push(itemId, exerciseId);
		await db
			.prepare(`UPDATE items SET ${sets.join(', ')} WHERE id = ? AND exercise_id = ?`)
			.bind(...values)
			.run();

		const row = await db
			.prepare(`SELECT * FROM items WHERE id = ? AND exercise_id = ?`)
			.bind(itemId, exerciseId)
			.first<ItemRow>();

		if (!row) throw new NotFoundError(`Item not found: ${itemId} in exercise ${exerciseId}`);
		return mapItem(row);
	}

	static async deleteItem(db: D1Database, exerciseId: string, itemId: string): Promise<void> {
		const result = await db
			.prepare(`DELETE FROM items WHERE id = ? AND exercise_id = ?`)
			.bind(itemId, exerciseId)
			.run();

		if (!result.meta.changes || result.meta.changes === 0) {
			throw new NotFoundError(`Item not found: ${itemId} in exercise ${exerciseId}`);
		}
	}

	// === Node CRUD ===

	static async upsertNode(db: D1Database, input: CreateNodeInput): Promise<Node> {
		await db
			.prepare(
				`INSERT OR REPLACE INTO nodes (id, parent_id, name, description, sort_order)
				 VALUES (?, ?, ?, ?, ?)`
			)
			.bind(
				input.id,
				input.parentId ?? null,
				input.name,
				input.description ?? '',
				input.sortOrder ?? 0,
			)
			.run();

		const row = await db
			.prepare(
				`SELECT n.*,
				        (SELECT COUNT(*) FROM nodes c WHERE c.parent_id = n.id) as child_count,
				        (SELECT COUNT(*) FROM exercises e WHERE e.node_id = n.id) as exercise_count
				 FROM nodes n WHERE n.id = ?`
			)
			.bind(input.id)
			.first<NodeRow>();

		return mapNode(row!);
	}

	// === Export ===

	static async exportExercise(db: D1Database, exerciseId: string): Promise<SeedExport> {
		const exerciseRow = await db
			.prepare(`SELECT * FROM exercises WHERE id = ?`)
			.bind(exerciseId)
			.first<ExerciseRow>();

		if (!exerciseRow) throw new NotFoundError(`Exercise not found: ${exerciseId}`);

		const itemRows = await db
			.prepare(`SELECT * FROM items WHERE exercise_id = ? ORDER BY sort_order`)
			.bind(exerciseId)
			.all<ItemRow>();

		// Collect all ancestor node IDs
		const nodeIds = new Set<string>();
		const parts = exerciseRow.node_id.split('/');
		for (let i = 1; i <= parts.length; i++) {
			nodeIds.add(parts.slice(0, i).join('/'));
		}

		const nodePlaceholders = Array.from(nodeIds).map(() => '?').join(', ');
		const nodeRows = await db
			.prepare(`SELECT * FROM nodes WHERE id IN (${nodePlaceholders}) ORDER BY length(id)`)
			.bind(...Array.from(nodeIds))
			.all<NodeRow>();

		return formatSeedExport(nodeRows.results, [exerciseRow], [itemRows.results]);
	}

	static async exportAll(db: D1Database): Promise<SeedExport> {
		const nodeRows = await db
			.prepare(`SELECT * FROM nodes ORDER BY sort_order`)
			.all<NodeRow>();

		const exerciseRows = await db
			.prepare(`SELECT * FROM exercises ORDER BY sort_order`)
			.all<ExerciseRow>();

		// Fetch items grouped by exercise
		const itemGroups: ItemRow[][] = [];
		for (const exercise of exerciseRows.results) {
			const items = await db
				.prepare(`SELECT * FROM items WHERE exercise_id = ? ORDER BY sort_order`)
				.bind(exercise.id)
				.all<ItemRow>();
			itemGroups.push(items.results);
		}

		return formatSeedExport(nodeRows.results, exerciseRows.results, itemGroups);
	}

	// === Content Health ===

	static async getContentHealth(db: D1Database): Promise<ContentHealthReport> {
		const [nodeCount, exerciseCount, itemCount] = await Promise.all([
			db.prepare(`SELECT COUNT(*) as count FROM nodes`).first<{ count: number }>(),
			db.prepare(`SELECT COUNT(*) as count FROM exercises`).first<{ count: number }>(),
			db.prepare(`SELECT COUNT(*) as count FROM items`).first<{ count: number }>(),
		]);

		const issues: ContentHealthIssue[] = [];

		// Empty exercises (no items)
		const emptyExercises = await db
			.prepare(
				`SELECT e.id FROM exercises e
				 LEFT JOIN items i ON i.exercise_id = e.id
				 GROUP BY e.id
				 HAVING COUNT(i.id) = 0`
			)
			.all<{ id: string }>();

		for (const row of emptyExercises.results) {
			issues.push({
				type: 'empty-exercise',
				exerciseId: row.id,
				message: `Exercise "${row.id}" has no items`,
			});
		}

		// Orphan exercises (node doesn't exist)
		const orphans = await db
			.prepare(
				`SELECT e.id, e.node_id FROM exercises e
				 LEFT JOIN nodes n ON n.id = e.node_id
				 WHERE n.id IS NULL`
			)
			.all<{ id: string; node_id: string }>();

		for (const row of orphans.results) {
			issues.push({
				type: 'orphan-exercise',
				exerciseId: row.id,
				message: `Exercise "${row.id}" references non-existent node "${row.node_id}"`,
			});
		}

		// Items with missing links, empty explanation, or missing prompt
		// We need to check data JSON per item, so fetch all items with their exercise format
		const allItems = await db
			.prepare(
				`SELECT i.id, i.exercise_id, i.explanation, i.data, e.format
				 FROM items i
				 JOIN exercises e ON e.id = i.exercise_id`
			)
			.all<{ id: string; exercise_id: string; explanation: string; data: string; format: string }>();

		for (const row of allItems.results) {
			let data: Record<string, unknown> = {};
			try {
				data = JSON.parse(row.data || '{}');
			} catch {
				// skip unparseable data
			}

			const links = data.links as Array<{ text: string; url: string }> | undefined;
			if (!links || links.length === 0) {
				issues.push({
					type: 'missing-links',
					exerciseId: row.exercise_id,
					itemId: row.id,
					message: `Item "${row.id}" in "${row.exercise_id}" has no links`,
				});
			}

			if (!row.explanation || row.explanation.trim() === '') {
				issues.push({
					type: 'empty-explanation',
					exerciseId: row.exercise_id,
					itemId: row.id,
					message: `Item "${row.id}" in "${row.exercise_id}" has no explanation`,
				});
			}

			if ((row.format === 'text-entry' || row.format === 'letter-by-letter') && !data.prompt) {
				issues.push({
					type: 'missing-prompt',
					exerciseId: row.exercise_id,
					itemId: row.id,
					message: `Item "${row.id}" in "${row.exercise_id}" is item-based but has no prompt`,
				});
			}
		}

		return {
			totalNodes: nodeCount?.count ?? 0,
			totalExercises: exerciseCount?.count ?? 0,
			totalItems: itemCount?.count ?? 0,
			issues,
		};
	}
}

// === Helpers ===

function formatSeedExport(
	nodeRows: NodeRow[],
	exerciseRows: ExerciseRow[],
	itemGroups: ItemRow[][],
): SeedExport {
	const nodes = nodeRows.map((row) => ({
		id: row.id,
		parentId: row.parent_id,
		name: row.name,
		description: row.description,
	}));

	const exercises = exerciseRows.map((row, idx) => {
		const items = (itemGroups[idx] ?? []).map((itemRow) => {
			let data: Record<string, unknown> = {};
			try {
				data = JSON.parse(itemRow.data || '{}');
			} catch {
				// skip
			}

			const exported: Record<string, unknown> = {
				id: itemRow.id,
				answer: itemRow.answer,
			};

			const alternates: string[] = JSON.parse(itemRow.alternates || '[]');
			if (alternates.length > 0) exported.alternates = alternates;
			if (itemRow.explanation) exported.explanation = itemRow.explanation;

			// Flatten data fields back to top-level
			if (data.prompt) exported.prompt = data.prompt;
			if (data.cardFront) exported.cardFront = data.cardFront;
			if (data.cardBack) exported.cardBack = data.cardBack;
			if (data.label) exported.label = data.label;
			if (data.links && (data.links as unknown[]).length > 0) exported.links = data.links;

			return exported;
		});

		const exercise: Record<string, unknown> = {
			id: row.id,
			nodeId: row.node_id,
			name: row.name,
			description: row.description,
			format: row.format,
			items,
		};

		if (row.display_type) exercise.displayType = row.display_type;
		if (row.config) {
			try {
				exercise.config = JSON.parse(row.config);
			} catch {
				// skip
			}
		}

		return exercise;
	});

	return { nodes, exercises } as SeedExport;
}

// === Custom error types ===

export class NotFoundError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'NotFoundError';
	}
}
