export type Category = 'geography' | 'history' | 'science' | 'literature' | 'entertainment' | 'sports';
export type Tier = 'foundation' | 'core' | 'advanced';
export type QuizMode = 'learn' | 'quiz' | 'review-mistakes' | 'random-10';

/**
 * QuestionFormat defines how a question is *presented* and *answered*.
 * This is separate from the question content itself — the same question
 * can be rendered in multiple formats.
 *
 * Currently implemented: 'text-entry'
 * Planned: 'multiple-choice', 'true-false', 'matching', 'select-many', 'ordered-list'
 */
export type QuestionFormat = 'text-entry' | 'multiple-choice' | 'true-false' | 'matching' | 'select-many' | 'ordered-list';

/**
 * A Question stores *content* — the fact being tested.
 * Format-specific rendering data (MC options, matching pairs) is optional
 * and supplementary. The canonical answer is always `answer` (text).
 *
 * This lets the same question be presented in multiple formats:
 * - text-entry: user types `answer`
 * - multiple-choice: pick from `options` (auto-generated if not provided)
 * - true-false: "Is [statement] true?" using `answer` to validate
 * - matching: pair items from `matchPairs`
 */
export interface Question {
	id: string;
	moduleId: string;
	question: string;
	answer: string;
	alternateAnswers: string[];
	explanation: string;
	cardFront?: string;
	cardBack?: string;
	sortOrder: number;

	// Format-specific supplementary data (optional)
	// Multiple-choice options — if absent, can be auto-generated from other answers in the module
	options?: string[];
	correctIndex?: number;
	// Matching pairs — for matching format
	matchPairs?: { left: string; right: string }[];
}

export interface QuizModule {
	id: string;
	category: Category;
	name: string;
	tier: Tier;
	description: string;
	defaultFormat: QuestionFormat;
	questionCount: number;
}

export interface QuizModuleWithQuestions extends QuizModule {
	questions: Question[];
}

export interface CategoryInfo {
	id: Category;
	name: string;
	color: string;
	moduleCount: number;
	tiers: {
		foundation: number;
		core: number;
		advanced: number;
	};
}

export interface QuestionProgress {
	seen: number;
	correct: number;
	incorrect: number;
	lastSeen: string;
}

export interface ModuleProgress {
	questions: Record<string, QuestionProgress>;
}

export interface StreakData {
	currentStreak: number;
	lastActiveDate: string;
}

export interface QuizSession {
	moduleId: string;
	mode: QuizMode;
	format: QuestionFormat;
	questions: Question[];
	currentIndex: number;
	answers: SessionAnswer[];
	startedAt: string;
	status: 'in-progress' | 'complete';
}

export interface SessionAnswer {
	questionId: string;
	correct: boolean;
	userAnswer: string;
	timeSpentMs: number;
}

export interface CheckAnswerResult {
	correct: boolean;
	correctAnswer: string;
	explanation: string;
	userAnswer: string;
	fuzzyMatch: boolean;
}

// Category display metadata (static, not in DB)
export const CATEGORY_META: Record<Category, { name: string; color: string }> = {
	geography: { name: 'Geography', color: '#34d399' },
	history: { name: 'History', color: '#fbbf24' },
	science: { name: 'Science', color: '#38bdf8' },
	literature: { name: 'Literature', color: '#a78bfa' },
	entertainment: { name: 'Entertainment', color: '#f472b6' },
	sports: { name: 'Sports & Games', color: '#fb923c' },
};
