import type { Item, CheckAnswerResult, FillBlanksCheckResult } from '../data/types';
import { checkAnswer as fuzzyCheck } from './fuzzy-match';

/**
 * Check a text-entry answer against a single item.
 * Uses fuzzy matching against the canonical answer + alternates.
 */
export function checkTextEntry(item: Item, userAnswer: string): CheckAnswerResult {
	const result = fuzzyCheck(userAnswer, item.answer, item.alternates);
	return {
		correct: result.match,
		correctAnswer: item.answer,
		explanation: item.explanation,
		userAnswer,
		fuzzyMatch: result.fuzzyMatch,
	};
}

/**
 * Check a fill-blanks guess against all items in the exercise.
 * Returns the first matching item, or a no-match result.
 */
export function checkFillBlanks(items: Item[], userAnswer: string): FillBlanksCheckResult {
	for (const item of items) {
		const result = fuzzyCheck(userAnswer, item.answer, item.alternates);
		if (result.match) {
			return {
				matched: true,
				matchedItemId: item.id,
				position: item.sortOrder,
				userAnswer,
				fuzzyMatch: result.fuzzyMatch,
			};
		}
	}
	return {
		matched: false,
		userAnswer,
		fuzzyMatch: false,
	};
}
