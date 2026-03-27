import type { Category, CategoryInfo, Tier, QuestionFormat, QuizModule, QuizModuleWithQuestions, Question } from './types';
import { CATEGORY_META } from './types';

interface QuestionRow {
	id: string;
	module_id: string;
	question: string;
	answer: string;
	alternate_answers: string | null;
	options: string | null;
	correct_index: number | null;
	match_pairs: string | null;
	explanation: string;
	sort_order: number;
}

interface ModuleRow {
	id: string;
	category: string;
	name: string;
	tier: string;
	description: string;
	default_format: string;
}

export class QuizRepository {
	constructor(private db: D1Database) {}

	async getCategories(): Promise<CategoryInfo[]> {
		const rows = await this.db
			.prepare(`SELECT category, tier, COUNT(*) as count FROM modules GROUP BY category, tier`)
			.all<{ category: Category; tier: Tier; count: number }>();

		const categoryMap = new Map<Category, CategoryInfo>();

		for (const row of rows.results) {
			if (!categoryMap.has(row.category)) {
				const meta = CATEGORY_META[row.category];
				categoryMap.set(row.category, {
					id: row.category,
					name: meta.name,
					color: meta.color,
					moduleCount: 0,
					tiers: { foundation: 0, core: 0, advanced: 0 },
				});
			}
			const cat = categoryMap.get(row.category)!;
			cat.tiers[row.tier] = row.count;
			cat.moduleCount += row.count;
		}

		return Array.from(categoryMap.values());
	}

	async getModules(filters?: { category?: Category; tier?: Tier }): Promise<QuizModule[]> {
		let sql = `SELECT m.id, m.category, m.name, m.tier, m.description, m.default_format,
		           (SELECT COUNT(*) FROM questions q WHERE q.module_id = m.id) as question_count
		           FROM modules m WHERE 1=1`;
		const bindings: string[] = [];

		if (filters?.category) {
			sql += ` AND m.category = ?`;
			bindings.push(filters.category);
		}
		if (filters?.tier) {
			sql += ` AND m.tier = ?`;
			bindings.push(filters.tier);
		}

		sql += ` ORDER BY m.category, CASE m.tier WHEN 'foundation' THEN 0 WHEN 'core' THEN 1 WHEN 'advanced' THEN 2 END, m.name`;

		const stmt = this.db.prepare(sql);
		const rows = await (bindings.length > 0 ? stmt.bind(...bindings) : stmt).all<ModuleRow & { question_count: number }>();

		return rows.results.map((r) => ({
			id: r.id,
			category: r.category as Category,
			name: r.name,
			tier: r.tier as Tier,
			description: r.description,
			defaultFormat: r.default_format as QuestionFormat,
			questionCount: r.question_count,
		}));
	}

	async getModule(moduleId: string): Promise<QuizModuleWithQuestions | null> {
		const moduleRow = await this.db
			.prepare(`SELECT id, category, name, tier, description, default_format FROM modules WHERE id = ?`)
			.bind(moduleId)
			.first<ModuleRow>();

		if (!moduleRow) return null;

		const questionRows = await this.db
			.prepare(
				`SELECT id, module_id, question, answer, alternate_answers, options, correct_index, match_pairs, explanation, sort_order
				 FROM questions WHERE module_id = ? ORDER BY sort_order, id`
			)
			.bind(moduleId)
			.all<QuestionRow>();

		const questions = questionRows.results.map((r) => mapQuestion(r));

		return {
			id: moduleRow.id,
			category: moduleRow.category as Category,
			name: moduleRow.name,
			tier: moduleRow.tier as Tier,
			description: moduleRow.description,
			defaultFormat: moduleRow.default_format as QuestionFormat,
			questionCount: questions.length,
			questions,
		};
	}

	async getQuestion(moduleId: string, questionId: string): Promise<Question | null> {
		const row = await this.db
			.prepare(
				`SELECT id, module_id, question, answer, alternate_answers, options, correct_index, match_pairs, explanation, sort_order
				 FROM questions WHERE module_id = ? AND id = ?`
			)
			.bind(moduleId, questionId)
			.first<QuestionRow>();

		if (!row) return null;
		return mapQuestion(row);
	}

	async getRandomQuestion(filters?: { category?: Category; tier?: Tier }): Promise<(Question & { moduleName: string }) | null> {
		let sql = `SELECT q.id, q.module_id, q.question, q.answer, q.alternate_answers,
		           q.options, q.correct_index, q.match_pairs, q.explanation, q.sort_order,
		           m.name as module_name
		           FROM questions q JOIN modules m ON q.module_id = m.id WHERE 1=1`;
		const bindings: string[] = [];

		if (filters?.category) {
			sql += ` AND m.category = ?`;
			bindings.push(filters.category);
		}
		if (filters?.tier) {
			sql += ` AND m.tier = ?`;
			bindings.push(filters.tier);
		}

		sql += ` ORDER BY RANDOM() LIMIT 1`;

		const stmt = this.db.prepare(sql);
		const row = await (bindings.length > 0 ? stmt.bind(...bindings) : stmt).first<QuestionRow & { module_name: string }>();

		if (!row) return null;
		return { ...mapQuestion(row), moduleName: row.module_name };
	}
}

function mapQuestion(row: QuestionRow): Question {
	const q: Question = {
		id: row.id,
		moduleId: row.module_id,
		question: row.question,
		answer: row.answer,
		alternateAnswers: JSON.parse(row.alternate_answers || '[]'),
		explanation: row.explanation,
		sortOrder: row.sort_order,
	};

	// Attach optional format-specific data if present
	if (row.options) {
		q.options = JSON.parse(row.options);
		if (row.correct_index !== null) {
			q.correctIndex = row.correct_index;
		}
	}
	if (row.match_pairs) {
		q.matchPairs = JSON.parse(row.match_pairs);
	}

	return q;
}
