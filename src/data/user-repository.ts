import type { User, QuizResult, QuizItemResult, QuizExerciseSummary, ExerciseFormat } from './types';

// === DB row interfaces ===

interface UserRow {
	id: string;
	email: string;
	display_name: string;
	preferences: string;
	created_at: string;
	last_seen_at: string;
}

interface QuizResultRow {
	id: string;
	user_id: string;
	exercise_id: string;
	exercise_name: string;
	format: string;
	score: number;
	total: number;
	duration_seconds: number | null;
	items_detail: string;
	completed_at: string;
	is_retry: number;
	parent_result_id: string | null;
}

// === Row-to-type mappers ===

function mapUser(row: UserRow): User {
	return {
		id: row.id,
		email: row.email,
		displayName: row.display_name,
		preferences: JSON.parse(row.preferences || '{}'),
		createdAt: row.created_at,
		lastSeenAt: row.last_seen_at,
	};
}

function mapQuizResult(row: QuizResultRow): QuizResult {
	return {
		id: row.id,
		userId: row.user_id,
		exerciseId: row.exercise_id,
		exerciseName: row.exercise_name,
		format: row.format as ExerciseFormat,
		score: row.score,
		total: row.total,
		durationSeconds: row.duration_seconds,
		itemsDetail: JSON.parse(row.items_detail || '[]') as QuizItemResult[],
		completedAt: row.completed_at,
		isRetry: row.is_retry === 1,
		parentResultId: row.parent_result_id,
	};
}

// === Repository ===

export class UserRepository {
	constructor(private db: D1Database) {}

	async upsertByEmail(email: string): Promise<User> {
		const now = new Date().toISOString();
		const id = crypto.randomUUID();

		await this.db
			.prepare(
				`INSERT INTO users (id, email, created_at, last_seen_at)
				 VALUES (?, ?, ?, ?)
				 ON CONFLICT(email) DO UPDATE SET last_seen_at = ?`
			)
			.bind(id, email, now, now, now)
			.run();

		const row = await this.db
			.prepare(`SELECT * FROM users WHERE email = ?`)
			.bind(email)
			.first<UserRow>();

		return mapUser(row!);
	}

	async getByEmail(email: string): Promise<User | null> {
		const row = await this.db
			.prepare(`SELECT * FROM users WHERE email = ?`)
			.bind(email)
			.first<UserRow>();

		return row ? mapUser(row) : null;
	}

	async recordQuizResult(params: {
		userId: string;
		exerciseId: string;
		exerciseName: string;
		format: ExerciseFormat;
		score: number;
		total: number;
		durationSeconds: number | null;
		itemsDetail: QuizItemResult[];
		isRetry?: boolean;
		parentResultId?: string;
	}): Promise<QuizResult> {
		const id = crypto.randomUUID();
		const now = new Date().toISOString();

		await this.db
			.prepare(
				`INSERT INTO quiz_results (id, user_id, exercise_id, exercise_name, format, score, total, duration_seconds, items_detail, completed_at, is_retry, parent_result_id)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(
				id,
				params.userId,
				params.exerciseId,
				params.exerciseName,
				params.format,
				params.score,
				params.total,
				params.durationSeconds,
				JSON.stringify(params.itemsDetail),
				now,
				params.isRetry ? 1 : 0,
				params.parentResultId ?? null,
			)
			.run();

		return {
			id,
			userId: params.userId,
			exerciseId: params.exerciseId,
			exerciseName: params.exerciseName,
			format: params.format,
			score: params.score,
			total: params.total,
			durationSeconds: params.durationSeconds,
			itemsDetail: params.itemsDetail,
			completedAt: now,
			isRetry: !!params.isRetry,
			parentResultId: params.parentResultId ?? null,
		};
	}

	async getQuizResults(userId: string, limit = 20, offset = 0): Promise<{ results: QuizResult[]; total: number }> {
		const [rows, countRow] = await Promise.all([
			this.db
				.prepare(
					`SELECT * FROM quiz_results
					 WHERE user_id = ? AND is_retry = 0
					 ORDER BY completed_at DESC
					 LIMIT ? OFFSET ?`
				)
				.bind(userId, limit, offset)
				.all<QuizResultRow>(),
			this.db
				.prepare(`SELECT COUNT(*) as count FROM quiz_results WHERE user_id = ? AND is_retry = 0`)
				.bind(userId)
				.first<{ count: number }>(),
		]);

		return {
			results: rows.results.map(mapQuizResult),
			total: countRow?.count ?? 0,
		};
	}

	async getCategoryStats(userId: string): Promise<
		{ category: string; correct: number; attempted: number }[]
	> {
		const rows = await this.db
			.prepare(
				`SELECT
					CASE WHEN instr(exercise_id, '/') > 0
						THEN substr(exercise_id, 1, instr(exercise_id, '/') - 1)
						ELSE exercise_id
					END as category,
					COALESCE(SUM(score), 0) as correct,
					COALESCE(SUM(total), 0) as attempted
				 FROM quiz_results
				 WHERE user_id = ? AND is_retry = 0
				 GROUP BY category
				 HAVING category != ''
				 ORDER BY attempted DESC`
			)
			.bind(userId)
			.all<{ category: string; correct: number; attempted: number }>();

		return rows.results;
	}

	async getUserStats(userId: string): Promise<{
		totalQuizzes: number;
		totalCorrect: number;
		totalAttempted: number;
		exercisesCovered: number;
	}> {
		const row = await this.db
			.prepare(
				`SELECT
					COUNT(*) as total_quizzes,
					COALESCE(SUM(score), 0) as total_correct,
					COALESCE(SUM(total), 0) as total_attempted,
					COUNT(DISTINCT exercise_id) as exercises_covered
				 FROM quiz_results
				 WHERE user_id = ? AND is_retry = 0`
			)
			.bind(userId)
			.first<{
				total_quizzes: number;
				total_correct: number;
				total_attempted: number;
				exercises_covered: number;
			}>();

		return {
			totalQuizzes: row?.total_quizzes ?? 0,
			totalCorrect: row?.total_correct ?? 0,
			totalAttempted: row?.total_attempted ?? 0,
			exercisesCovered: row?.exercises_covered ?? 0,
		};
	}

	async getQuizResultsByExercise(userId: string): Promise<QuizExerciseSummary[]> {
		const { results } = await this.db.prepare(`
			SELECT exercise_id, exercise_name, score, total, completed_at
			FROM quiz_results
			WHERE user_id = ? AND is_retry = 0
			ORDER BY completed_at DESC
		`).bind(userId).all<{
			exercise_id: string;
			exercise_name: string;
			score: number;
			total: number;
			completed_at: string;
		}>();

		const exerciseMap = new Map<string, {
			exerciseId: string;
			exerciseName: string;
			scores: { score: number; total: number; completedAt: string }[];
		}>();

		for (const row of results) {
			const key = row.exercise_id;
			if (!exerciseMap.has(key)) {
				exerciseMap.set(key, {
					exerciseId: key,
					exerciseName: row.exercise_name,
					scores: [],
				});
			}
			exerciseMap.get(key)!.scores.push({
				score: row.score,
				total: row.total,
				completedAt: row.completed_at,
			});
		}

		return Array.from(exerciseMap.values()).map(entry => {
			const latest = entry.scores[0]; // already sorted DESC by completed_at
			const bestRatio = Math.max(
				...entry.scores.map(s => s.total === 0 ? 0 : s.score / s.total)
			);
			const bestEntry = entry.scores.find(
				s => s.total > 0 && s.score / s.total === bestRatio
			) || latest;

			return {
				exerciseId: entry.exerciseId,
				exerciseName: entry.exerciseName,
				category: entry.exerciseId.split('/')[0],
				timesTaken: entry.scores.length,
				lastTaken: latest.completedAt,
				mostRecentScore: latest.score,
				mostRecentTotal: latest.total,
				bestScore: bestEntry.score,
				bestTotal: bestEntry.total,
			};
		});
	}
}
