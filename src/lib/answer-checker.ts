import type {
	Item,
	CheckAnswerResult,
	FillBlanksCheckResult,
	SequenceOrderingCheckResult,
	SequenceOrderingValidationError,
	ClassificationSortCheckResult,
	ClassificationSortValidationError,
} from '../data/types';
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

export function checkSequenceOrdering(
	items: Item[],
	userOrder: string[]
): SequenceOrderingCheckResult | SequenceOrderingValidationError {
	const expectedOrder = [...items]
		.sort((a, b) => a.sortOrder - b.sortOrder)
		.map((item) => item.id);

	const expectedSet = new Set(expectedOrder);
	const seen = new Set<string>();
	const duplicateItemIds: string[] = [];
	for (const itemId of userOrder) {
		if (seen.has(itemId) && !duplicateItemIds.includes(itemId)) {
			duplicateItemIds.push(itemId);
		}
		seen.add(itemId);
	}

	const missingItemIds = expectedOrder.filter((itemId) => !seen.has(itemId));
	const extraItemIds = userOrder.filter((itemId) => !expectedSet.has(itemId));

	if (duplicateItemIds.length > 0 || missingItemIds.length > 0 || extraItemIds.length > 0 || userOrder.length !== expectedOrder.length) {
		return {
			valid: false,
			error: 'Submitted order must contain each item exactly once',
			missingItemIds,
			extraItemIds,
			duplicateItemIds,
		};
	}

	const userPositionById = new Map(userOrder.map((itemId, idx) => [itemId, idx]));
	const placements = expectedOrder.map((itemId, expectedIdx) => {
		const userIdx = userPositionById.get(itemId) ?? -1;
		return {
			itemId,
			expectedPosition: expectedIdx + 1,
			userPosition: userIdx + 1,
			correct: userIdx === expectedIdx,
		};
	});

	const correctCount = placements.filter((p) => p.correct).length;
	return {
		valid: true,
		correct: correctCount === placements.length,
		correctCount,
		total: placements.length,
		placements,
	};
}

export function checkClassificationSort(
	items: Item[],
	userAssignments: Record<string, string>
): ClassificationSortCheckResult | ClassificationSortValidationError {
	const expectedItemIds = items.map((item) => item.id);
	const expectedSet = new Set(expectedItemIds);
	const assignmentIds = Object.keys(userAssignments);
	const seen = new Set<string>();
	const duplicateItemIds: string[] = [];

	for (const itemId of assignmentIds) {
		if (seen.has(itemId) && !duplicateItemIds.includes(itemId)) {
			duplicateItemIds.push(itemId);
		}
		seen.add(itemId);
	}

	const missingItemIds = expectedItemIds.filter((itemId) => !seen.has(itemId));
	const extraItemIds = assignmentIds.filter((itemId) => !expectedSet.has(itemId));

	const expectedCategoriesByItem = new Map<string, string[]>();
	const invalidCategoryItemIds: string[] = [];
	for (const item of items) {
		const data = (item.data ?? {}) as Record<string, unknown>;
		const singular = typeof data.category === 'string' && data.category ? [data.category] : [];
		const plural = Array.isArray(data.categories)
			? data.categories.filter((value): value is string => typeof value === 'string' && value.length > 0)
			: [];
		const expectedCategories = plural.length > 0 ? plural : singular;
		if (expectedCategories.length === 0) {
			invalidCategoryItemIds.push(item.id);
		} else {
			expectedCategoriesByItem.set(item.id, expectedCategories);
		}
	}

	if (
		duplicateItemIds.length > 0 ||
		missingItemIds.length > 0 ||
		extraItemIds.length > 0 ||
		assignmentIds.length !== expectedItemIds.length ||
		invalidCategoryItemIds.length > 0
	) {
		return {
			valid: false,
			error: 'Submitted classification must contain each item exactly once and each item must have a category',
			missingItemIds,
			extraItemIds,
			duplicateItemIds,
			invalidCategoryItemIds,
		};
	}

	const placements = items
		.map((item) => {
			const expectedCategories = expectedCategoriesByItem.get(item.id) ?? [];
			const userCategory = userAssignments[item.id] ?? '';
			return {
				itemId: item.id,
				expectedCategories,
				userCategory,
				correct: expectedCategories.includes(userCategory),
			};
		})
		.sort((a, b) => a.itemId.localeCompare(b.itemId));

	const correctCount = placements.filter((p) => p.correct).length;
	return {
		valid: true,
		correct: correctCount === placements.length,
		correctCount,
		total: placements.length,
		placements,
	};
}
