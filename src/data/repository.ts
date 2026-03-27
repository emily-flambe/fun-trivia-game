import type {
  Category,
  CategoryInfo,
  Tier,
  QuizModule,
  QuizModuleWithQuestions,
  Question,
  TypeInQuestion,
  MultipleChoiceQuestion,
  MatchingQuestion,
} from './types';
import { CATEGORY_META as CategoryMeta } from './types';

export class QuizRepository {
  constructor(private db: D1Database) {}

  async getCategories(): Promise<CategoryInfo[]> {
    const rows = await this.db
      .prepare(
        `SELECT category, tier, COUNT(*) as count
         FROM modules
         GROUP BY category, tier`
      )
      .all<{ category: Category; tier: Tier; count: number }>();

    const categoryMap = new Map<Category, CategoryInfo>();

    for (const row of rows.results) {
      if (!categoryMap.has(row.category)) {
        const meta = CategoryMeta[row.category];
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
    let sql = `SELECT m.id, m.category, m.name, m.tier, m.description, m.question_type,
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
    const rows = await (bindings.length > 0 ? stmt.bind(...bindings) : stmt)
      .all<{
        id: string;
        category: Category;
        name: string;
        tier: Tier;
        description: string;
        question_type: string;
        question_count: number;
      }>();

    return rows.results.map((r) => ({
      id: r.id,
      category: r.category,
      name: r.name,
      tier: r.tier as Tier,
      description: r.description,
      questionType: r.question_type as any,
      questionCount: r.question_count,
    }));
  }

  async getModule(moduleId: string): Promise<QuizModuleWithQuestions | null> {
    const moduleRow = await this.db
      .prepare(`SELECT id, category, name, tier, description, question_type FROM modules WHERE id = ?`)
      .bind(moduleId)
      .first<{
        id: string;
        category: Category;
        name: string;
        tier: Tier;
        description: string;
        question_type: string;
      }>();

    if (!moduleRow) return null;

    const questionRows = await this.db
      .prepare(
        `SELECT id, module_id, type, question, answer, alternate_answers, options, correct_index, pairs, explanation
         FROM questions WHERE module_id = ? ORDER BY sort_order, id`
      )
      .bind(moduleId)
      .all<{
        id: string;
        module_id: string;
        type: string;
        question: string;
        answer: string | null;
        alternate_answers: string | null;
        options: string | null;
        correct_index: number | null;
        pairs: string | null;
        explanation: string;
      }>();

    const questions: Question[] = questionRows.results.map((r) => this.mapQuestion(r));

    return {
      id: moduleRow.id,
      category: moduleRow.category,
      name: moduleRow.name,
      tier: moduleRow.tier,
      description: moduleRow.description,
      questionType: moduleRow.question_type as any,
      questionCount: questions.length,
      questions,
    };
  }

  async getQuestion(moduleId: string, questionId: string): Promise<Question | null> {
    const row = await this.db
      .prepare(
        `SELECT id, module_id, type, question, answer, alternate_answers, options, correct_index, pairs, explanation
         FROM questions WHERE module_id = ? AND id = ?`
      )
      .bind(moduleId, questionId)
      .first<{
        id: string;
        module_id: string;
        type: string;
        question: string;
        answer: string | null;
        alternate_answers: string | null;
        options: string | null;
        correct_index: number | null;
        pairs: string | null;
        explanation: string;
      }>();

    if (!row) return null;
    return this.mapQuestion(row);
  }

  async getRandomQuestion(filters?: { category?: Category; tier?: Tier }): Promise<(Question & { moduleName: string }) | null> {
    let sql = `SELECT q.id, q.module_id, q.type, q.question, q.answer, q.alternate_answers,
               q.options, q.correct_index, q.pairs, q.explanation, m.name as module_name
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
    const row = await (bindings.length > 0 ? stmt.bind(...bindings) : stmt)
      .first<{
        id: string;
        module_id: string;
        type: string;
        question: string;
        answer: string | null;
        alternate_answers: string | null;
        options: string | null;
        correct_index: number | null;
        pairs: string | null;
        explanation: string;
        module_name: string;
      }>();

    if (!row) return null;
    return { ...this.mapQuestion(row), moduleName: row.module_name };
  }

  private mapQuestion(row: {
    id: string;
    module_id: string;
    type: string;
    question: string;
    answer: string | null;
    alternate_answers: string | null;
    options: string | null;
    correct_index: number | null;
    pairs: string | null;
    explanation: string;
  }): Question {
    const base = {
      id: row.id,
      moduleId: row.module_id,
      question: row.question,
      explanation: row.explanation,
    };

    switch (row.type) {
      case 'type-in':
        return {
          ...base,
          type: 'type-in',
          answer: row.answer!,
          alternateAnswers: JSON.parse(row.alternate_answers || '[]'),
        } as TypeInQuestion;

      case 'multiple-choice':
        return {
          ...base,
          type: 'multiple-choice',
          options: JSON.parse(row.options || '[]'),
          correctIndex: row.correct_index!,
        } as MultipleChoiceQuestion;

      case 'matching':
        return {
          ...base,
          type: 'matching',
          pairs: JSON.parse(row.pairs || '[]'),
        } as MatchingQuestion;

      default:
        throw new Error(`Unknown question type: ${row.type}`);
    }
  }
}
