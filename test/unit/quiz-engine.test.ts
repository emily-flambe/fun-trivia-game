import { describe, it, expect } from 'vitest';
import { createSession, recordAnswer, getCurrentQuestion, getSessionSummary } from '../../src/lib/quiz-engine';
import type { Question, ModuleProgress } from '../../src/data/types';

// Test fixtures — unified Question type (no discriminated union)
const questions: Question[] = [
	{
		id: 'q1',
		moduleId: 'test-mod',
		question: 'Capital of France?',
		answer: 'Paris',
		alternateAnswers: [],
		explanation: 'Paris is the capital.',
		sortOrder: 0,
	},
	{
		id: 'q2',
		moduleId: 'test-mod',
		question: 'Capital of Germany?',
		answer: 'Berlin',
		alternateAnswers: [],
		explanation: 'Berlin is the capital.',
		sortOrder: 1,
	},
	{
		id: 'q3',
		moduleId: 'test-mod',
		question: 'Capital of Japan?',
		answer: 'Tokyo',
		alternateAnswers: [],
		explanation: 'Tokyo is the capital.',
		sortOrder: 2,
	},
];

const mcQuestion: Question = {
	id: 'mc1',
	moduleId: 'test-mod',
	question: 'Largest planet?',
	answer: 'Jupiter',
	alternateAnswers: [],
	explanation: 'Jupiter is the largest.',
	sortOrder: 0,
	options: ['Mars', 'Jupiter', 'Saturn', 'Venus'],
	correctIndex: 1,
};

describe('createSession', () => {
	it('creates a learn session with questions in original order', () => {
		const session = createSession('test-mod', questions, 'learn', 'text-entry');
		expect(session.mode).toBe('learn');
		expect(session.format).toBe('text-entry');
		expect(session.questions).toHaveLength(3);
		expect(session.questions[0].id).toBe('q1');
		expect(session.questions[1].id).toBe('q2');
		expect(session.questions[2].id).toBe('q3');
		expect(session.currentIndex).toBe(0);
		expect(session.answers).toHaveLength(0);
		expect(session.status).toBe('in-progress');
	});

	it('creates a quiz session with shuffled questions', () => {
		const ids = new Set<string>();
		for (let i = 0; i < 20; i++) {
			const session = createSession('test-mod', questions, 'quiz', 'text-entry');
			ids.add(session.questions.map((q) => q.id).join(','));
		}
		expect(ids.size).toBeGreaterThan(1);
	});

	it('creates a quiz session with all questions', () => {
		const session = createSession('test-mod', questions, 'quiz', 'text-entry');
		expect(session.questions).toHaveLength(3);
	});

	it('creates a random-10 session capped at 10', () => {
		const manyQuestions = Array.from({ length: 20 }, (_, i) => ({
			...questions[0],
			id: `q${i}`,
		}));
		const session = createSession('test-mod', manyQuestions, 'random-10', 'text-entry');
		expect(session.questions).toHaveLength(10);
	});

	it('creates a random-10 session with all questions if fewer than 10', () => {
		const session = createSession('test-mod', questions, 'random-10', 'text-entry');
		expect(session.questions).toHaveLength(3);
	});

	it('creates a review-mistakes session with only missed questions', () => {
		const progress: ModuleProgress = {
			questions: {
				q1: { seen: 3, correct: 1, incorrect: 2, lastSeen: '2026-03-25T10:00:00Z' },
				q2: { seen: 2, correct: 2, incorrect: 0, lastSeen: '2026-03-25T09:00:00Z' },
				q3: { seen: 1, correct: 0, incorrect: 1, lastSeen: '2026-03-26T10:00:00Z' },
			},
		};
		const session = createSession('test-mod', questions, 'review-mistakes', 'text-entry', progress);
		expect(session.questions).toHaveLength(2);
		expect(session.questions[0].id).toBe('q3');
		expect(session.questions[1].id).toBe('q1');
	});

	it('creates empty review-mistakes session when no progress', () => {
		const session = createSession('test-mod', questions, 'review-mistakes', 'text-entry');
		expect(session.questions).toHaveLength(0);
		expect(session.status).toBe('complete');
	});

	it('creates empty review-mistakes session when no mistakes', () => {
		const progress: ModuleProgress = {
			questions: {
				q1: { seen: 3, correct: 3, incorrect: 0, lastSeen: '2026-03-25T10:00:00Z' },
			},
		};
		const session = createSession('test-mod', questions, 'review-mistakes', 'text-entry', progress);
		expect(session.questions).toHaveLength(0);
		expect(session.status).toBe('complete');
	});

	it('sets status to complete when no questions', () => {
		const session = createSession('test-mod', [], 'quiz', 'text-entry');
		expect(session.status).toBe('complete');
	});

	it('stores the format on the session', () => {
		const session = createSession('test-mod', questions, 'quiz', 'multiple-choice');
		expect(session.format).toBe('multiple-choice');
	});
});

describe('recordAnswer', () => {
	it('advances to next question', () => {
		const session = createSession('test-mod', questions, 'learn', 'text-entry');
		const updated = recordAnswer(session, {
			questionId: 'q1',
			correct: true,
			userAnswer: 'Paris',
			timeSpentMs: 1500,
		});
		expect(updated.currentIndex).toBe(1);
		expect(updated.answers).toHaveLength(1);
		expect(updated.status).toBe('in-progress');
	});

	it('marks session complete on last answer', () => {
		let session = createSession('test-mod', [questions[0]], 'learn', 'text-entry');
		session = recordAnswer(session, {
			questionId: 'q1',
			correct: true,
			userAnswer: 'Paris',
			timeSpentMs: 1000,
		});
		expect(session.status).toBe('complete');
	});

	it('does not modify a completed session', () => {
		let session = createSession('test-mod', [questions[0]], 'learn', 'text-entry');
		session = recordAnswer(session, {
			questionId: 'q1',
			correct: true,
			userAnswer: 'Paris',
			timeSpentMs: 1000,
		});
		const again = recordAnswer(session, {
			questionId: 'q1',
			correct: false,
			userAnswer: 'London',
			timeSpentMs: 500,
		});
		expect(again.answers).toHaveLength(1);
		expect(again).toBe(session);
	});

	it('is immutable — does not modify original session', () => {
		const session = createSession('test-mod', questions, 'learn', 'text-entry');
		const updated = recordAnswer(session, {
			questionId: 'q1',
			correct: true,
			userAnswer: 'Paris',
			timeSpentMs: 1000,
		});
		expect(session.currentIndex).toBe(0);
		expect(session.answers).toHaveLength(0);
		expect(updated.currentIndex).toBe(1);
		expect(updated.answers).toHaveLength(1);
	});
});

describe('getCurrentQuestion', () => {
	it('returns the current question', () => {
		const session = createSession('test-mod', questions, 'learn', 'text-entry');
		const q = getCurrentQuestion(session);
		expect(q?.id).toBe('q1');
	});

	it('returns null when session is complete', () => {
		let session = createSession('test-mod', [questions[0]], 'learn', 'text-entry');
		session = recordAnswer(session, {
			questionId: 'q1',
			correct: true,
			userAnswer: 'Paris',
			timeSpentMs: 1000,
		});
		expect(getCurrentQuestion(session)).toBeNull();
	});

	it('returns null for empty session', () => {
		const session = createSession('test-mod', [], 'quiz', 'text-entry');
		expect(getCurrentQuestion(session)).toBeNull();
	});
});

describe('getSessionSummary', () => {
	it('computes correct summary', () => {
		let session = createSession('test-mod', questions, 'learn', 'text-entry');
		session = recordAnswer(session, { questionId: 'q1', correct: true, userAnswer: 'Paris', timeSpentMs: 1000 });
		session = recordAnswer(session, { questionId: 'q2', correct: false, userAnswer: 'Munich', timeSpentMs: 2000 });
		session = recordAnswer(session, { questionId: 'q3', correct: true, userAnswer: 'Tokyo', timeSpentMs: 1500 });

		const summary = getSessionSummary(session);
		expect(summary.totalQuestions).toBe(3);
		expect(summary.answered).toBe(3);
		expect(summary.correctCount).toBe(2);
		expect(summary.incorrectCount).toBe(1);
		expect(summary.accuracy).toBeCloseTo(2 / 3);
		expect(summary.totalTimeMs).toBe(4500);
		expect(summary.wrongAnswers).toHaveLength(1);
		expect(summary.wrongAnswers[0].questionId).toBe('q2');
		expect(summary.wrongAnswers[0].userAnswer).toBe('Munich');
		expect(summary.wrongAnswers[0].correctAnswer).toBe('Berlin');
	});

	it('handles empty session', () => {
		const session = createSession('test-mod', [], 'quiz', 'text-entry');
		const summary = getSessionSummary(session);
		expect(summary.totalQuestions).toBe(0);
		expect(summary.answered).toBe(0);
		expect(summary.accuracy).toBe(0);
		expect(summary.wrongAnswers).toHaveLength(0);
	});

	it('handles all correct', () => {
		let session = createSession('test-mod', [questions[0]], 'learn', 'text-entry');
		session = recordAnswer(session, { questionId: 'q1', correct: true, userAnswer: 'Paris', timeSpentMs: 1000 });
		const summary = getSessionSummary(session);
		expect(summary.accuracy).toBe(1);
		expect(summary.wrongAnswers).toHaveLength(0);
	});
});
