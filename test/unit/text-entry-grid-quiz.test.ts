import { describe, it, expect } from 'vitest';

// Extracted logic from TextEntryGridQuiz for testability

function shuffleArray<T>(arr: T[]): T[] {
	const copy = [...arr];
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy;
}

interface ItemState {
	status: 'unanswered' | 'correct' | 'incorrect';
	userAnswer?: string;
}

interface QuizItem { id: string; }

function findNextUnansweredIndex(
	quizItems: QuizItem[],
	afterItemId: string,
	itemStates: Map<string, ItemState>
): number | null {
	const idx = quizItems.findIndex((i) => i.id === afterItemId);
	for (let offset = 1; offset < quizItems.length; offset++) {
		const nextIdx = (idx + offset) % quizItems.length;
		const nextItem = quizItems[nextIdx];
		if (itemStates.get(nextItem.id)?.status === 'unanswered') {
			return nextIdx;
		}
	}
	return null;
}

describe('TextEntryGridQuiz logic', () => {
	describe('shuffleArray', () => {
		it('returns a new array without mutating original', () => {
			const original = [1, 2, 3, 4, 5];
			const snapshot = [...original];
			const result = shuffleArray(original);
			expect(result).not.toBe(original);
			expect(original).toEqual(snapshot);
			expect(result.sort()).toEqual(snapshot.sort());
		});

		it('handles empty and single-element arrays', () => {
			expect(shuffleArray([])).toEqual([]);
			expect(shuffleArray([42])).toEqual([42]);
		});

		it('preserves all elements', () => {
			const original = [10, 20, 30, 40, 50];
			const result = shuffleArray(original);
			expect(result).toHaveLength(original.length);
			expect([...result].sort((a, b) => a - b)).toEqual([...original].sort((a, b) => a - b));
		});
	});

	describe('findNextUnansweredIndex', () => {
		const items: QuizItem[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];

		it('finds the next unanswered after current', () => {
			const states = new Map<string, ItemState>([
				['a', { status: 'correct' }],
				['b', { status: 'unanswered' }],
				['c', { status: 'unanswered' }],
				['d', { status: 'unanswered' }],
			]);
			expect(findNextUnansweredIndex(items, 'a', states)).toBe(1);
		});

		it('skips answered items', () => {
			const states = new Map<string, ItemState>([
				['a', { status: 'correct' }],
				['b', { status: 'incorrect' }],
				['c', { status: 'unanswered' }],
				['d', { status: 'unanswered' }],
			]);
			expect(findNextUnansweredIndex(items, 'a', states)).toBe(2);
		});

		it('wraps around to beginning', () => {
			const states = new Map<string, ItemState>([
				['a', { status: 'unanswered' }],
				['b', { status: 'correct' }],
				['c', { status: 'correct' }],
				['d', { status: 'correct' }],
			]);
			expect(findNextUnansweredIndex(items, 'd', states)).toBe(0);
		});

		it('returns null when all answered', () => {
			const states = new Map<string, ItemState>([
				['a', { status: 'correct' }],
				['b', { status: 'incorrect' }],
				['c', { status: 'correct' }],
				['d', { status: 'incorrect' }],
			]);
			expect(findNextUnansweredIndex(items, 'a', states)).toBeNull();
		});

		it('returns null for single-item list', () => {
			const single = [{ id: 'only' }];
			const states = new Map<string, ItemState>([['only', { status: 'unanswered' }]]);
			expect(findNextUnansweredIndex(single, 'only', states)).toBeNull();
		});
	});

	describe('progress calculation', () => {
		function computeProgress(itemStates: Map<string, ItemState>, totalItems: number) {
			const answeredCount = Array.from(itemStates.values()).filter((s) => s.status !== 'unanswered').length;
			const correctCount = Array.from(itemStates.values()).filter((s) => s.status === 'correct').length;
			const progressPct = totalItems > 0 ? (answeredCount / totalItems) * 100 : 0;
			return { answeredCount, correctCount, progressPct };
		}

		it('returns zeros for empty state', () => {
			expect(computeProgress(new Map(), 0)).toEqual({ answeredCount: 0, correctCount: 0, progressPct: 0 });
		});

		it('computes correct percentages', () => {
			const states = new Map<string, ItemState>([
				['a', { status: 'correct' }],
				['b', { status: 'incorrect' }],
				['c', { status: 'unanswered' }],
			]);
			const result = computeProgress(states, 3);
			expect(result.answeredCount).toBe(2);
			expect(result.correctCount).toBe(1);
			expect(result.progressPct).toBeCloseTo(66.67, 1);
		});
	});

	describe('retry-failed filtering', () => {
		interface PublicItem { id: string; exerciseId: string; explanation: string; data: Record<string, any>; sortOrder: number; }

		function getFailedItems(quizItems: PublicItem[], allItems: PublicItem[], itemStates: Map<string, ItemState>): PublicItem[] {
			const failedIds = new Set(quizItems.filter((i) => itemStates.get(i.id)?.status === 'incorrect').map((i) => i.id));
			return allItems.filter((i) => failedIds.has(i.id));
		}

		const allItems: PublicItem[] = [
			{ id: 'a', exerciseId: 'ex', explanation: '', data: { prompt: 'Q1' }, sortOrder: 0 },
			{ id: 'b', exerciseId: 'ex', explanation: '', data: { prompt: 'Q2' }, sortOrder: 1 },
			{ id: 'c', exerciseId: 'ex', explanation: '', data: { prompt: 'Q3' }, sortOrder: 2 },
		];

		it('returns only incorrect items', () => {
			const states = new Map<string, ItemState>([
				['a', { status: 'correct' }],
				['b', { status: 'incorrect' }],
				['c', { status: 'incorrect' }],
			]);
			expect(getFailedItems(allItems, allItems, states).map((i) => i.id)).toEqual(['b', 'c']);
		});

		it('excludes unanswered items', () => {
			const states = new Map<string, ItemState>([
				['a', { status: 'correct' }],
				['b', { status: 'unanswered' }],
				['c', { status: 'incorrect' }],
			]);
			expect(getFailedItems(allItems, allItems, states).map((i) => i.id)).toEqual(['c']);
		});
	});
});
