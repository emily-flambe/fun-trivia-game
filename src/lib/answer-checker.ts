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
 * Two passes: exact matches first, then fuzzy. This prevents
 * "Xenon" from fuzzy-matching "Neon" (distance 1) when an exact
 * Xenon item exists later in the list.
 */
export function checkFillBlanks(items: Item[], userAnswer: string): FillBlanksCheckResult {
	// Pass 1: exact matches only
	for (const item of items) {
		const result = fuzzyCheck(userAnswer, item.answer, item.alternates);
		if (result.exactMatch) {
			return {
				matched: true,
				matchedItemId: item.id,
				position: item.sortOrder,
				userAnswer,
				fuzzyMatch: false,
			};
		}
	}

	// Pass 2: fuzzy matches (only if no exact match found)
	for (const item of items) {
		const result = fuzzyCheck(userAnswer, item.answer, item.alternates);
		if (result.match) {
			return {
				matched: true,
				matchedItemId: item.id,
				position: item.sortOrder,
				userAnswer,
				fuzzyMatch: true,
			};
		}
	}

	return {
		matched: false,
		userAnswer,
		fuzzyMatch: false,
	};
}
