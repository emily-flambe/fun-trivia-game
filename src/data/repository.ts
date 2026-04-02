import type { Node, Exercise, ExerciseFormat, DisplayType, ExerciseConfig, Item } from './types';

// === DB row interfaces ===

export interface NodeRow {
	id: string;
	parent_id: string | null;
	name: string;
	description: string;
	sort_order: number;
	child_count?: number;
	exercise_count?: number;
}

export interface ExerciseRow {
	id: string;
	node_id: string;
	name: string;
	description: string;
	format: string;
	display_type: string | null;
	config: string | null;
	sort_order: number;
	item_count?: number;
}

export interface ItemRow {
	id: string;
	exercise_id: string;
	answer: string;
	alternates: string;
	explanation: string;
	data: string;
	sort_order: number;
}

// === Row-to-type mappers ===

export function mapNode(row: NodeRow): Node {
	const node: Node = {
		id: row.id,
		parentId: row.parent_id,
		name: row.name,
		description: row.description,
		sortOrder: row.sort_order,
	};
	if (row.child_count !== undefined) {
		node.childCount = row.child_count;
	}
	if (row.exercise_count !== undefined) {
		node.exerciseCount = row.exercise_count;
	}
	return node;
}

export function mapExercise(row: ExerciseRow): Exercise {
	const exercise: Exercise = {
		id: row.id,
		nodeId: row.node_id,
		name: row.name,
		description: row.description,
		format: row.format as ExerciseFormat,
		sortOrder: row.sort_order,
	};
	if (row.display_type) {
		exercise.displayType = row.display_type as DisplayType;
	}
	if (row.config) {
		exercise.config = JSON.parse(row.config) as ExerciseConfig;
	}
	if (row.item_count !== undefined) {
		exercise.itemCount = row.item_count;
	}
	return exercise;
}

export function mapItem(row: ItemRow): Item {
	return {
		id: row.id,
		exerciseId: row.exercise_id,
		answer: row.answer,
		alternates: JSON.parse(row.alternates || '[]'),
		explanation: row.explanation,
		data: JSON.parse(row.data || '{}'),
		sortOrder: row.sort_order,
	};
}

function getCategoryFromNodeId(nodeId: string): string {
	return nodeId.split('/')[0] ?? '';
}

function normalizeCategoryWeights(
	categoryIds: string[],
	categoryWeights?: Record<string, number>,
): Record<string, number> {
	const normalized: Record<string, number> = {};
	for (const categoryId of categoryIds) {
		const rawWeight = categoryWeights?.[categoryId];
		if (typeof rawWeight === 'number' && Number.isFinite(rawWeight) && rawWeight >= 0) {
			normalized[categoryId] = rawWeight;
		} else {
			normalized[categoryId] = 1;
		}
	}
	return normalized;
}

function pickWeightedCategory(
	availableCategories: string[],
	weights: Record<string, number>,
): string | null {
	if (availableCategories.length === 0) return null;
	const positive = availableCategories
		.map((categoryId) => ({ categoryId, weight: weights[categoryId] ?? 1 }))
		.filter((entry) => entry.weight > 0);

	const pool = positive.length > 0
		? positive
		: availableCategories.map((categoryId) => ({ categoryId, weight: 1 }));

	const totalWeight = pool.reduce((sum, entry) => sum + entry.weight, 0);
	if (totalWeight <= 0) return pool[0]?.categoryId ?? null;

	let target = Math.random() * totalWeight;
	for (const entry of pool) {
		target -= entry.weight;
		if (target <= 0) return entry.categoryId;
	}
	return pool[pool.length - 1]?.categoryId ?? null;
}

// === Repository ===

export class NodeRepository {
	constructor(private db: D1Database) {}

	async getRootNodes(): Promise<Node[]> {
		const rows = await this.db
			.prepare(
				`SELECT n.*,
				        (SELECT COUNT(*) FROM nodes c WHERE c.parent_id = n.id) as child_count,
				        (SELECT COUNT(*) FROM exercises e WHERE e.node_id = n.id) as exercise_count
				 FROM nodes n
				 WHERE parent_id IS NULL
				 ORDER BY sort_order`
			)
			.all<NodeRow>();

		return rows.results.map(mapNode);
	}

	async getNode(id: string): Promise<{ node: Node; children: Node[]; exercises: Exercise[] } | null> {
		const nodeRow = await this.db
			.prepare(
				`SELECT n.*,
				        (SELECT COUNT(*) FROM nodes c WHERE c.parent_id = n.id) as child_count,
				        (SELECT COUNT(*) FROM exercises e WHERE e.node_id = n.id) as exercise_count
				 FROM nodes n
				 WHERE n.id = ?`
			)
			.bind(id)
			.first<NodeRow>();

		if (!nodeRow) return null;

		const [childRows, exerciseRows] = await Promise.all([
			this.db
				.prepare(
					`SELECT n.*,
					        (SELECT COUNT(*) FROM nodes c WHERE c.parent_id = n.id) as child_count,
					        (SELECT COUNT(*) FROM exercises e WHERE e.node_id = n.id) as exercise_count
					 FROM nodes n
					 WHERE n.parent_id = ?
					 ORDER BY n.sort_order`
				)
				.bind(id)
				.all<NodeRow>(),
			this.db
				.prepare(
					`SELECT e.*,
					        (SELECT COUNT(*) FROM items i WHERE i.exercise_id = e.id) as item_count
					 FROM exercises e
					 WHERE e.node_id = ?
					 ORDER BY e.sort_order`
				)
				.bind(id)
				.all<ExerciseRow>(),
		]);

		return {
			node: mapNode(nodeRow),
			children: childRows.results.map(mapNode),
			exercises: exerciseRows.results.map(mapExercise),
		};
	}

	async getNodeBreadcrumbs(id: string): Promise<Node[]> {
		const parts = id.split('/');
		const ancestorIds: string[] = [];
		for (let i = 1; i <= parts.length; i++) {
			ancestorIds.push(parts.slice(0, i).join('/'));
		}

		const placeholders = ancestorIds.map(() => '?').join(', ');
		const rows = await this.db
			.prepare(`SELECT * FROM nodes WHERE id IN (${placeholders}) ORDER BY length(id)`)
			.bind(...ancestorIds)
			.all<NodeRow>();

		return rows.results.map(mapNode);
	}

	async getRandomExerciseId(categoryWeights?: Record<string, number>): Promise<string | null> {
		const rows = await this.db
			.prepare(`SELECT id, node_id FROM exercises`)
			.all<{ id: string; node_id: string }>();

		if (rows.results.length === 0) return null;
		if (!categoryWeights) {
			const randomIndex = Math.floor(Math.random() * rows.results.length);
			return rows.results[randomIndex]?.id ?? null;
		}

		const byCategory = new Map<string, string[]>();
		for (const row of rows.results) {
			const categoryId = getCategoryFromNodeId(row.node_id);
			const current = byCategory.get(categoryId) ?? [];
			current.push(row.id);
			byCategory.set(categoryId, current);
		}

		const categories = Array.from(byCategory.keys());
		const normalized = normalizeCategoryWeights(categories, categoryWeights);
		const pickedCategory = pickWeightedCategory(categories, normalized);
		if (!pickedCategory) return null;

		const exerciseIds = byCategory.get(pickedCategory) ?? [];
		if (exerciseIds.length === 0) return null;
		const randomIndex = Math.floor(Math.random() * exerciseIds.length);
		return exerciseIds[randomIndex] ?? null;
	}

	async getExercise(id: string): Promise<{ exercise: Exercise; items: Item[] } | null> {
		const exerciseRow = await this.db
			.prepare(
				`SELECT e.*,
				        (SELECT COUNT(*) FROM items i WHERE i.exercise_id = e.id) as item_count
				 FROM exercises e
				 WHERE e.id = ?`
			)
			.bind(id)
			.first<ExerciseRow>();

		if (!exerciseRow) return null;

		const itemRows = await this.db
			.prepare(`SELECT * FROM items WHERE exercise_id = ? ORDER BY sort_order`)
			.bind(id)
			.all<ItemRow>();

		return {
			exercise: mapExercise(exerciseRow),
			items: itemRows.results.map(mapItem),
		};
	}

	async getItem(exerciseId: string, itemId: string): Promise<Item | null> {
		const row = await this.db
			.prepare(`SELECT * FROM items WHERE exercise_id = ? AND id = ?`)
			.bind(exerciseId, itemId)
			.first<ItemRow>();

		if (!row) return null;
		return mapItem(row);
	}

	async getExerciseItems(exerciseId: string): Promise<Item[]> {
		const rows = await this.db
			.prepare(`SELECT * FROM items WHERE exercise_id = ? ORDER BY sort_order`)
			.bind(exerciseId)
			.all<ItemRow>();

		return rows.results.map(mapItem);
	}

	async getRandomItems(
		count: number,
		categoryWeights?: Record<string, number>,
	): Promise<Array<Item & { exerciseName: string; nodeId: string }>> {
		const rows = categoryWeights
			? await this.db
				.prepare(
					`SELECT i.*, e.name as exercise_name, e.node_id as ex_node_id
					 FROM items i
					 JOIN exercises e ON i.exercise_id = e.id
					 WHERE e.format = 'text-entry'`
				)
				.all<ItemRow & { exercise_name: string; ex_node_id: string }>()
			: await this.db
				.prepare(
					`SELECT i.*, e.name as exercise_name, e.node_id as ex_node_id
					 FROM items i
					 JOIN exercises e ON i.exercise_id = e.id
					 WHERE e.format = 'text-entry'
					 ORDER BY RANDOM()
					 LIMIT ?`
				)
				.bind(count)
				.all<ItemRow & { exercise_name: string; ex_node_id: string }>();

		const mapped = rows.results.map((row) => ({
			...mapItem(row),
			exerciseName: row.exercise_name,
			nodeId: row.ex_node_id,
		}));

		if (!categoryWeights || mapped.length <= 1) {
			return mapped;
		}

		const byCategory = new Map<string, Array<Item & { exerciseName: string; nodeId: string }>>();
		for (const item of mapped) {
			const categoryId = getCategoryFromNodeId(item.nodeId);
			const current = byCategory.get(categoryId) ?? [];
			current.push(item);
			byCategory.set(categoryId, current);
		}

		const categories = Array.from(byCategory.keys());
		const normalized = normalizeCategoryWeights(categories, categoryWeights);
		const remaining = new Map<string, Array<Item & { exerciseName: string; nodeId: string }>>(byCategory);
		const picked: Array<Item & { exerciseName: string; nodeId: string }> = [];
		const maxItems = Math.min(count, mapped.length);

		while (picked.length < maxItems) {
			const availableCategories = Array.from(remaining.entries())
				.filter(([, items]) => items.length > 0)
				.map(([categoryId]) => categoryId);
			if (availableCategories.length === 0) break;

			const categoryId = pickWeightedCategory(availableCategories, normalized);
			if (!categoryId) break;
			const items = remaining.get(categoryId) ?? [];
			if (items.length === 0) {
				remaining.delete(categoryId);
				continue;
			}
			const randomIndex = Math.floor(Math.random() * items.length);
			const [item] = items.splice(randomIndex, 1);
			if (!item) break;
			picked.push(item);
		}

		return picked;
	}
}
