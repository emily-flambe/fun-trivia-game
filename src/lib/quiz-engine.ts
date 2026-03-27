import type { Question, QuestionFormat, QuizMode, QuizSession, SessionAnswer, ModuleProgress } from '../data/types';

/**
 * Create a new quiz session.
 *
 * Modes control question selection:
 * - learn: all questions in original order
 * - quiz: all questions shuffled
 * - review-mistakes: only questions with incorrect > 0, ordered by most recent miss
 * - random-10: 10 random questions (or all if < 10)
 *
 * Format is stored on the session and used by the answer checker.
 */
export function createSession(
	moduleId: string,
	questions: Question[],
	mode: QuizMode,
	format: QuestionFormat,
	progress?: ModuleProgress
): QuizSession {
	let sessionQuestions: Question[];

	switch (mode) {
		case 'learn':
			sessionQuestions = [...questions];
			break;
		case 'quiz':
			sessionQuestions = shuffle([...questions]);
			break;
		case 'review-mistakes':
			sessionQuestions = getReviewQuestions(questions, progress);
			break;
		case 'random-10':
			sessionQuestions = shuffle([...questions]).slice(0, 10);
			break;
		default:
			sessionQuestions = [...questions];
	}

	return {
		moduleId,
		mode,
		format,
		questions: sessionQuestions,
		currentIndex: 0,
		answers: [],
		startedAt: new Date().toISOString(),
		status: sessionQuestions.length > 0 ? 'in-progress' : 'complete',
	};
}

/**
 * Record an answer and advance to the next question.
 * Returns a new session object (immutable).
 */
export function recordAnswer(session: QuizSession, answer: SessionAnswer): QuizSession {
	if (session.status === 'complete') {
		return session;
	}

	const newAnswers = [...session.answers, answer];
	const nextIndex = session.currentIndex + 1;
	const isComplete = nextIndex >= session.questions.length;

	return {
		...session,
		currentIndex: nextIndex,
		answers: newAnswers,
		status: isComplete ? 'complete' : 'in-progress',
	};
}

/**
 * Get the current question in the session.
 */
export function getCurrentQuestion(session: QuizSession): Question | null {
	if (session.status === 'complete') return null;
	return session.questions[session.currentIndex] ?? null;
}

/**
 * Get session summary stats.
 */
export function getSessionSummary(session: QuizSession) {
	const totalQuestions = session.questions.length;
	const answered = session.answers.length;
	const correctCount = session.answers.filter((a) => a.correct).length;
	const incorrectCount = answered - correctCount;
	const accuracy = answered > 0 ? correctCount / answered : 0;
	const totalTimeMs = session.answers.reduce((sum, a) => sum + a.timeSpentMs, 0);

	const wrongAnswers = session.answers
		.filter((a) => !a.correct)
		.map((a) => {
			const q = session.questions.find((q) => q.id === a.questionId);
			return {
				questionId: a.questionId,
				question: q?.question ?? '',
				userAnswer: a.userAnswer,
				correctAnswer: q?.answer ?? '',
				explanation: q?.explanation ?? '',
			};
		});

	return {
		totalQuestions,
		answered,
		correctCount,
		incorrectCount,
		accuracy,
		totalTimeMs,
		wrongAnswers,
	};
}

function shuffle<T>(arr: T[]): T[] {
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}

function getReviewQuestions(questions: Question[], progress?: ModuleProgress): Question[] {
	if (!progress) return [];

	const missed = questions.filter((q) => {
		const p = progress.questions[q.id];
		return p && p.incorrect > 0;
	});

	return missed.sort((a, b) => {
		const pa = progress.questions[a.id];
		const pb = progress.questions[b.id];
		if (!pa || !pb) return 0;
		return pb.lastSeen.localeCompare(pa.lastSeen);
	});
}
