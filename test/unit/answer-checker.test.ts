import { describe, it, expect } from 'vitest';
import { checkAnswerByFormat } from '../../src/lib/answer-checker';
import type { Question } from '../../src/data/types';

const textQuestion: Question = {
	id: 'q1',
	moduleId: 'test',
	question: 'Capital of France?',
	answer: 'Paris',
	alternateAnswers: [],
	explanation: 'Paris is the capital.',
	sortOrder: 0,
};

const textQuestionWithAlternates: Question = {
	id: 'q2',
	moduleId: 'test',
	question: 'Capital of Ukraine?',
	answer: 'Kyiv',
	alternateAnswers: ['Kiev'],
	explanation: 'Kyiv is the capital.',
	sortOrder: 1,
};

const mcQuestion: Question = {
	id: 'mc1',
	moduleId: 'test',
	question: 'Largest planet?',
	answer: 'Jupiter',
	alternateAnswers: [],
	explanation: 'Jupiter is the largest.',
	sortOrder: 0,
	options: ['Mars', 'Jupiter', 'Saturn', 'Venus'],
	correctIndex: 1,
};

describe('checkAnswerByFormat', () => {
	describe('text-entry format', () => {
		it('accepts exact match', () => {
			const result = checkAnswerByFormat(textQuestion, { answer: 'Paris' }, 'text-entry');
			expect(result.correct).toBe(true);
			expect(result.fuzzyMatch).toBe(false);
			expect(result.correctAnswer).toBe('Paris');
		});

		it('accepts case-insensitive match', () => {
			const result = checkAnswerByFormat(textQuestion, { answer: 'paris' }, 'text-entry');
			expect(result.correct).toBe(true);
		});

		it('accepts alternate answer', () => {
			const result = checkAnswerByFormat(textQuestionWithAlternates, { answer: 'Kiev' }, 'text-entry');
			expect(result.correct).toBe(true);
		});

		it('accepts fuzzy match for longer answers', () => {
			const q: Question = {
				...textQuestion,
				answer: 'Washington',
			};
			const result = checkAnswerByFormat(q, { answer: 'Washingtan' }, 'text-entry');
			expect(result.correct).toBe(true);
			expect(result.fuzzyMatch).toBe(true);
		});

		it('rejects wrong answer', () => {
			const result = checkAnswerByFormat(textQuestion, { answer: 'London' }, 'text-entry');
			expect(result.correct).toBe(false);
			expect(result.correctAnswer).toBe('Paris');
		});

		it('includes explanation', () => {
			const result = checkAnswerByFormat(textQuestion, { answer: 'London' }, 'text-entry');
			expect(result.explanation).toBe('Paris is the capital.');
		});

		it('handles empty input', () => {
			const result = checkAnswerByFormat(textQuestion, {}, 'text-entry');
			expect(result.correct).toBe(false);
			expect(result.userAnswer).toBe('');
		});
	});

	describe('multiple-choice format', () => {
		it('accepts correct index', () => {
			const result = checkAnswerByFormat(mcQuestion, { answerIndex: 1 }, 'multiple-choice');
			expect(result.correct).toBe(true);
			expect(result.correctAnswer).toBe('Jupiter');
		});

		it('rejects wrong index', () => {
			const result = checkAnswerByFormat(mcQuestion, { answerIndex: 0 }, 'multiple-choice');
			expect(result.correct).toBe(false);
			expect(result.correctAnswer).toBe('Jupiter');
			expect(result.userAnswer).toBe('Mars');
		});

		it('handles question without MC data gracefully', () => {
			const result = checkAnswerByFormat(textQuestion, { answerIndex: 0 }, 'multiple-choice');
			expect(result.correct).toBe(false);
		});

		it('handles out-of-range index', () => {
			const result = checkAnswerByFormat(mcQuestion, { answerIndex: 99 }, 'multiple-choice');
			expect(result.correct).toBe(false);
		});
	});

	describe('unsupported formats', () => {
		it('returns not-correct for true-false (not yet implemented)', () => {
			const result = checkAnswerByFormat(textQuestion, { answer: 'true' }, 'true-false');
			expect(result.correct).toBe(false);
			expect(result.correctAnswer).toBe('Paris');
		});

		it('returns not-correct for matching (not yet implemented)', () => {
			const result = checkAnswerByFormat(textQuestion, {}, 'matching');
			expect(result.correct).toBe(false);
		});
	});
});
