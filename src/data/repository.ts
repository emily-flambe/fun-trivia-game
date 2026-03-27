import type { Node, Exercise, ExerciseFormat, DisplayType, FillBlanksConfig, Item } from './types';

// === DB row interfaces ===

interface NodeRow {
	id: string;
	parent_id: string | null;
	name: string;
	description: string;
	sort_order: number;
	child_count?: number;
	exercise_count?: number;
}

interface ExerciseRow {
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

interface ItemRow {
	id: string;
	exercise_id: string;
	answer: string;
	alternates: string;
	explanation: string;
	data: string;
	sort_order: number;
}

// === Row-to-type mappers ===

function mapNode(row: NodeRow): Node {
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

function mapExercise(row: ExerciseRow): Exercise {
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
		exercise.config = JSON.parse(row.config) as FillBlanksConfig;
	}
	if (row.item_count !== undefined) {
		exercise.itemCount = row.item_count;
	}
	return exercise;
}

function mapItem(row: ItemRow): Item {
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

	async getRandomExerciseId(): Promise<string | null> {
		const row = await this.db
			.prepare(`SELECT id FROM exercises ORDER BY RANDOM() LIMIT 1`)
			.first<{ id: string }>();
		return row?.id ?? null;
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
}
