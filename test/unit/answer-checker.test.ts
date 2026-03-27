import { describe, it, expect } from 'vitest';
import { checkTextEntry, checkFillBlanks } from '../../src/lib/answer-checker';
import type { Item, CheckAnswerResult, FillBlanksCheckResult } from '../../src/data/types';

// ─── Test fixtures ───────────────────────────────────────────────────

const parisItem: Item = {
	id: 'paris',
	exerciseId: 'capitals',
	answer: 'Paris',
	alternates: [],
	explanation: 'Paris is the capital of France.',
	data: { prompt: 'What is the capital of France?' },
	sortOrder: 0,
};

const kyivItem: Item = {
	id: 'kyiv',
	exerciseId: 'capitals',
	answer: 'Kyiv',
	alternates: ['Kiev'],
	explanation: 'Kyiv is the capital of Ukraine.',
	data: { prompt: 'What is the capital of Ukraine?' },
	sortOrder: 1,
};

const washingtonItem: Item = {
	id: 'washington',
	exerciseId: 'capitals',
	answer: 'Washington',
	alternates: [],
	explanation: 'Washington is a long answer.',
	data: { prompt: 'What is the capital of the USA?' },
	sortOrder: 2,
};

const obrienItem: Item = {
	id: 'obrien',
	exerciseId: 'authors',
	answer: "O'Brien",
	alternates: [],
	explanation: "It's O'Brien.",
	data: { prompt: 'Who wrote the book?' },
	sortOrder: 0,
};

const goldItem: Item = {
	id: 'gold',
	exerciseId: 'elements',
	answer: 'Au',
	alternates: ['Gold'],
	explanation: 'Au is gold.',
	data: { prompt: 'Chemical symbol for gold?' },
	sortOrder: 0,
};

const gatsbyItem: Item = {
	id: 'gatsby',
	exerciseId: 'novels',
	answer: 'The Great Gatsby',
	alternates: [],
	explanation: 'Written by F. Scott Fitzgerald.',
	data: { prompt: 'Name the novel about Jay Gatsby.' },
	sortOrder: 0,
};

const resumeItem: Item = {
	id: 'resume',
	exerciseId: 'words',
	answer: 'resume',
	alternates: [],
	explanation: 'A document summarizing experience.',
	data: { prompt: 'What document lists your work experience?' },
	sortOrder: 0,
};

// Noble gases for fill-blanks tests
const nobleGasItems: Item[] = [
	{ id: 'helium', exerciseId: 'noble-gases', answer: 'Helium', alternates: ['He'], explanation: 'Lightest noble gas.', data: {}, sortOrder: 0 },
	{ id: 'neon', exerciseId: 'noble-gases', answer: 'Neon', alternates: ['Ne'], explanation: 'Used in signs.', data: {}, sortOrder: 1 },
	{ id: 'argon', exerciseId: 'noble-gases', answer: 'Argon', alternates: ['Ar'], explanation: 'Third most abundant gas.', data: {}, sortOrder: 2 },
	{ id: 'krypton', exerciseId: 'noble-gases', answer: 'Krypton', alternates: ['Kr'], explanation: 'Superman home planet name.', data: {}, sortOrder: 3 },
	{ id: 'xenon', exerciseId: 'noble-gases', answer: 'Xenon', alternates: ['Xe'], explanation: 'Used in headlights.', data: {}, sortOrder: 4 },
	{ id: 'radon', exerciseId: 'noble-gases', answer: 'Radon', alternates: ['Rn'], explanation: 'Radioactive noble gas.', data: {}, sortOrder: 5 },
];

// ─── checkTextEntry ──────────────────────────────────────────────────

describe('checkTextEntry', () => {
	describe('exact matching', () => {
		it('accepts exact match', () => {
			const result = checkTextEntry(parisItem, 'Paris');
			expect(result.correct).toBe(true);
			expect(result.fuzzyMatch).toBe(false);
			expect(result.correctAnswer).toBe('Paris');
		});

		it('accepts case-insensitive match', () => {
			const result = checkTextEntry(parisItem, 'paris');
			expect(result.correct).toBe(true);
			expect(result.fuzzyMatch).toBe(false);
		});

		it('accepts ALLCAPS', () => {
			const result = checkTextEntry(parisItem, 'PARIS');
			expect(result.correct).toBe(true);
		});

		it('accepts alternate answer', () => {
			const result = checkTextEntry(kyivItem, 'Kiev');
			expect(result.correct).toBe(true);
		});

		it('rejects wrong answer', () => {
			const result = checkTextEntry(parisItem, 'London');
			expect(result.correct).toBe(false);
			expect(result.correctAnswer).toBe('Paris');
		});
	});

	describe('result fields', () => {
		it('includes explanation on correct answer', () => {
			const result = checkTextEntry(parisItem, 'Paris');
			expect(result.explanation).toBe('Paris is the capital of France.');
		});

		it('includes explanation on wrong answer', () => {
			const result = checkTextEntry(parisItem, 'London');
			expect(result.explanation).toBe('Paris is the capital of France.');
		});

		it('echoes userAnswer back in result', () => {
			const result = checkTextEntry(parisItem, 'my weird input');
			expect(result.userAnswer).toBe('my weird input');
		});

		it('returns correctAnswer as canonical answer, not user input', () => {
			const result = checkTextEntry(kyivItem, 'Kiev');
			expect(result.correctAnswer).toBe('Kyiv');
		});
	});

	describe('fuzzy matching', () => {
		it('fuzzy-matches long answers within Levenshtein 2', () => {
			const result = checkTextEntry(washingtonItem, 'Washingtan');
			expect(result.correct).toBe(true);
			expect(result.fuzzyMatch).toBe(true);
		});

		it('fuzzy-matches with two character errors', () => {
			const result = checkTextEntry(washingtonItem, 'Washingten');
			expect(result.correct).toBe(true);
			expect(result.fuzzyMatch).toBe(true);
		});

		it('rejects fuzzy match beyond Levenshtein 2', () => {
			const result = checkTextEntry(washingtonItem, 'Washingtxyz');
			expect(result.correct).toBe(false);
		});

		it('does NOT fuzzy-match short answers (length < 5)', () => {
			// "Au" is 2 chars; "Ax" has Levenshtein 1 but should NOT fuzzy-match
			const result = checkTextEntry(goldItem, 'Ax');
			expect(result.correct).toBe(false);
		});

		it('does NOT fuzzy-match "Fe" for "Au" even though distance is small', () => {
			const result = checkTextEntry(goldItem, 'Fe');
			expect(result.correct).toBe(false);
		});

		it('fuzzy threshold is on NORMALIZED user input length, not raw', () => {
			// "  Au  " trims to "au" (2 chars) -- no fuzzy
			const result = checkTextEntry(goldItem, '  Ax  ');
			expect(result.correct).toBe(false);
		});
	});

	describe('normalization', () => {
		it('strips diacritics: resume matches resume', () => {
			const diacriticItem: Item = {
				...resumeItem,
				answer: 'r\u00e9sum\u00e9',
			};
			const result = checkTextEntry(diacriticItem, 'resume');
			expect(result.correct).toBe(true);
		});

		it('strips diacritics from user input too', () => {
			const result = checkTextEntry(resumeItem, 'r\u00e9sum\u00e9');
			expect(result.correct).toBe(true);
		});

		it('strips apostrophes: "obrien" matches "O\'Brien"', () => {
			const result = checkTextEntry(obrienItem, 'obrien');
			expect(result.correct).toBe(true);
		});

		it('strips leading "the" article', () => {
			const result = checkTextEntry(gatsbyItem, 'Great Gatsby');
			expect(result.correct).toBe(true);
		});

		it('user includes "the" when answer does not have it', () => {
			const noTheItem: Item = {
				...gatsbyItem,
				answer: 'Great Gatsby',
			};
			const result = checkTextEntry(noTheItem, 'The Great Gatsby');
			expect(result.correct).toBe(true);
		});

		it('strips leading "a" article', () => {
			const item: Item = {
				...parisItem,
				answer: 'A Midsummer Night\'s Dream',
			};
			const result = checkTextEntry(item, 'Midsummer Nights Dream');
			expect(result.correct).toBe(true);
		});

		it('strips leading "an" article', () => {
			const item: Item = {
				...parisItem,
				answer: 'An Inspector Calls',
			};
			const result = checkTextEntry(item, 'Inspector Calls');
			expect(result.correct).toBe(true);
		});

		it('collapses extra whitespace', () => {
			const result = checkTextEntry(parisItem, '  Paris  ');
			expect(result.correct).toBe(true);
		});

		it('handles hyphens by converting to spaces', () => {
			const item: Item = {
				...parisItem,
				answer: 'Timor-Leste',
			};
			const result = checkTextEntry(item, 'Timor Leste');
			expect(result.correct).toBe(true);
		});

		it('handles periods in answers', () => {
			const item: Item = {
				...parisItem,
				answer: 'Washington D.C.',
			};
			const result = checkTextEntry(item, 'Washington DC');
			expect(result.correct).toBe(true);
		});
	});

	describe('edge cases and adversarial inputs', () => {
		it('empty string input returns correct: false', () => {
			const result = checkTextEntry(parisItem, '');
			expect(result.correct).toBe(false);
		});

		it('whitespace-only input returns correct: false', () => {
			const result = checkTextEntry(parisItem, '   ');
			expect(result.correct).toBe(false);
		});

		it('very long input does not crash', () => {
			const longInput = 'a'.repeat(500);
			const result = checkTextEntry(parisItem, longInput);
			expect(result.correct).toBe(false);
		});

		it('extremely long input does not crash (10000 chars)', () => {
			const longInput = 'x'.repeat(10000);
			const result = checkTextEntry(parisItem, longInput);
			expect(result.correct).toBe(false);
		});

		it('input with only special characters', () => {
			const result = checkTextEntry(parisItem, '!!!@@@###');
			expect(result.correct).toBe(false);
		});

		it('null-ish characters in input do not crash', () => {
			const result = checkTextEntry(parisItem, '\x00\x01\x02');
			expect(result.correct).toBe(false);
		});

		it('newlines in input do not cause match', () => {
			const result = checkTextEntry(parisItem, 'Paris\nLondon');
			expect(result.correct).toBe(false);
		});

		it('tab characters are treated as whitespace', () => {
			const result = checkTextEntry(parisItem, '\tParis\t');
			expect(result.correct).toBe(true);
		});

		it('item with empty alternates array works', () => {
			const result = checkTextEntry(parisItem, 'Paris');
			expect(result.correct).toBe(true);
			expect(parisItem.alternates).toEqual([]);
		});

		it('item whose answer is substring of input does not match', () => {
			// "Paris" should not match "Parisian"
			const result = checkTextEntry(parisItem, 'Parisian');
			expect(result.correct).toBe(false);
		});

		it('input that is substring of answer does not match', () => {
			// "Wash" should not match "Washington"
			const result = checkTextEntry(washingtonItem, 'Wash');
			expect(result.correct).toBe(false);
		});

		it('unicode emoji in input does not crash', () => {
			const result = checkTextEntry(parisItem, 'Paris \ud83c\uddf5');
			expect(result.correct).toBe(false);
		});

		it('multiple alternates: matches any of them', () => {
			const item: Item = {
				...parisItem,
				answer: 'United States',
				alternates: ['USA', 'US', 'United States of America', 'U.S.A.'],
			};
			expect(checkTextEntry(item, 'USA').correct).toBe(true);
			expect(checkTextEntry(item, 'US').correct).toBe(true);
			expect(checkTextEntry(item, 'United States of America').correct).toBe(true);
			expect(checkTextEntry(item, 'U.S.A.').correct).toBe(true);
		});

		it('fuzzy match against alternates not just primary answer', () => {
			// "United States of Amercia" (typo) should fuzzy-match "United States of America"
			const item: Item = {
				...parisItem,
				answer: 'United States',
				alternates: ['United States of America'],
			};
			const result = checkTextEntry(item, 'United States of Amercia');
			expect(result.correct).toBe(true);
			expect(result.fuzzyMatch).toBe(true);
		});
	});

	describe('potential bug: article stripping interactions', () => {
		it('answer "Anthem" does not lose its "An" prefix', () => {
			// "Anthem" starts with "An" but it is NOT an article followed by a space.
			// normalizeForMatching should NOT strip "an" from "anthem" because the
			// regex is /^(the|a|an)\s+/ which requires a space after.
			const item: Item = {
				...parisItem,
				answer: 'Anthem',
			};
			const result = checkTextEntry(item, 'Anthem');
			expect(result.correct).toBe(true);
		});

		it('"Anthem" does not match "them" (no false article stripping)', () => {
			const item: Item = {
				...parisItem,
				answer: 'Anthem',
			};
			const result = checkTextEntry(item, 'them');
			expect(result.correct).toBe(false);
		});

		it('"The" alone does not match item with article-stripped answer', () => {
			// If answer is "The Great Gatsby", typing just "The" should not match
			const result = checkTextEntry(gatsbyItem, 'The');
			expect(result.correct).toBe(false);
		});

		it('"A" alone does not match item whose answer starts with article', () => {
			const item: Item = {
				...parisItem,
				answer: 'A Clockwork Orange',
			};
			const result = checkTextEntry(item, 'A');
			expect(result.correct).toBe(false);
		});
	});

	describe('potential bug: fuzzy match on near-boundary lengths', () => {
		it('4-char answer does NOT fuzzy-match with 1 edit', () => {
			// "Neon" is 4 chars; "Neox" has distance 1; should NOT fuzzy-match
			const item: Item = {
				...parisItem,
				answer: 'Neon',
			};
			const result = checkTextEntry(item, 'Neox');
			expect(result.correct).toBe(false);
		});

		it('5-char answer DOES fuzzy-match with 1 edit', () => {
			// "Xenon" is 5 chars; "Xenox" has distance 1; SHOULD fuzzy-match
			const item: Item = {
				...parisItem,
				answer: 'Xenon',
			};
			const result = checkTextEntry(item, 'Xenox');
			expect(result.correct).toBe(true);
			expect(result.fuzzyMatch).toBe(true);
		});

		it('5-char answer with 2 edits still fuzzy-matches', () => {
			const item: Item = {
				...parisItem,
				answer: 'Xenon',
			};
			const result = checkTextEntry(item, 'Xenxx');
			expect(result.correct).toBe(true);
			expect(result.fuzzyMatch).toBe(true);
		});

		it('5-char answer with 3 edits does NOT fuzzy-match', () => {
			const item: Item = {
				...parisItem,
				answer: 'Xenon',
			};
			const result = checkTextEntry(item, 'Xxxxx');
			expect(result.correct).toBe(false);
		});

		it('boundary: user input is 5 chars after normalization but raw is shorter', () => {
			// If normalization changes length (e.g., stripping article "A " prefix),
			// the fuzzy threshold should be based on the post-normalization length.
			// User types "a xenox" -> normalized strips "a " -> "xenox" (5 chars) -> fuzzy should work
			const item: Item = {
				...parisItem,
				answer: 'Xenon',
			};
			const result = checkTextEntry(item, 'a xenox');
			expect(result.correct).toBe(true);
			expect(result.fuzzyMatch).toBe(true);
		});
	});

	describe('potential bug: punctuation normalization edge cases', () => {
		it('BUG: curly/smart apostrophe in answer breaks matching with straight apostrophe input', () => {
			// normalizeForMatching only strips straight apostrophe (') via /[.,']/
			// Curly RIGHT SINGLE QUOTATION MARK (U+2019) is NOT stripped.
			// This means if seed data has curly quotes, users cannot match it.
			const curlyItem: Item = {
				...parisItem,
				answer: "O\u2019Brien", // RIGHT SINGLE QUOTATION MARK
			};
			const result = checkTextEntry(curlyItem, "O'Brien");
			// Normalized answer: "o\u2019brien" (curly stays), user: "obrien" (straight stripped)
			// These differ. Fuzzy matching may or may not save it depending on string length.
			// "o\u2019brien" is 8 chars, "obrien" is 6 chars -- Levenshtein >= 2
			// This documents the behavior: curly quotes are a hazard in seed data.
			// The test asserts current behavior -- if this starts failing, the bug was fixed.
			expect(result.fuzzyMatch).toBe(true); // saved by fuzzy, but fragile
		});

		it('comma in answer is stripped', () => {
			const item: Item = {
				...parisItem,
				answer: 'Washington, D.C.',
			};
			const result = checkTextEntry(item, 'Washington DC');
			expect(result.correct).toBe(true);
		});

		it('BUG: semicolons are NOT stripped by normalization', () => {
			// normalizeForMatching strips [.,,'] but NOT semicolons, colons, etc.
			const item: Item = {
				...parisItem,
				answer: 'Dr. No',
			};
			// Period is stripped: "dr no" vs "dr no" -- matches
			expect(checkTextEntry(item, 'Dr No').correct).toBe(true);

			// But a semicolon in the answer would NOT be stripped
			const semiItem: Item = {
				...parisItem,
				answer: 'Lock; Stock and Two Smoking Barrels',
			};
			// "lock; stock and two smoking barrels" vs "lock stock and two smoking barrels"
			// The semicolon stays in the answer side. Distance = 1 from the semicolon.
			// Long enough for fuzzy. This should still match via fuzzy but documents the gap.
			const result = checkTextEntry(semiItem, 'Lock Stock and Two Smoking Barrels');
			expect(result.correct).toBe(true);
			// It only matches because fuzzy matching covers the semicolon difference
			expect(result.fuzzyMatch).toBe(true);
		});

		it('BUG: exclamation marks are NOT stripped by normalization', () => {
			const item: Item = {
				...parisItem,
				answer: 'Oklahoma!',
			};
			// "oklahoma!" normalizes to "oklahoma!" (exclamation NOT stripped)
			// "oklahoma" normalizes to "oklahoma"
			// Distance = 1, length >= 5, so fuzzy saves it
			const result = checkTextEntry(item, 'Oklahoma');
			expect(result.correct).toBe(true);
			expect(result.fuzzyMatch).toBe(true); // not exact match due to !
		});

		it('BUG: parentheses are NOT stripped by normalization', () => {
			const item: Item = {
				...parisItem,
				answer: 'Methane (CH4)',
			};
			// User might type just "Methane" or "Methane CH4"
			// "methane (ch4)" vs "methane ch4" -- parens stay, distance = 2
			const result = checkTextEntry(item, 'Methane CH4');
			expect(result.correct).toBe(true);
			expect(result.fuzzyMatch).toBe(true); // parens not stripped, fuzzy saves
		});

		it('BUG: question marks in answer are NOT stripped', () => {
			const item: Item = {
				...parisItem,
				answer: 'Who\'s Afraid of Virginia Woolf?',
			};
			const result = checkTextEntry(item, 'Whos Afraid of Virginia Woolf');
			expect(result.correct).toBe(true);
			expect(result.fuzzyMatch).toBe(true); // question mark not stripped
		});

		it('BUG: multiple un-stripped punctuation marks push distance beyond fuzzy threshold', () => {
			// If answer has 3+ characters that normalization doesn't strip,
			// user who types the clean version gets rejected even though they're "right"
			const item: Item = {
				...parisItem,
				answer: 'Jeopardy! (TV Show)',
			};
			// Normalized answer: "jeopardy! (tv show)" -- !, (, ) all stay
			// User types: "Jeopardy TV Show" -> "jeopardy tv show"
			// Distance: "jeopardy! (tv show)" vs "jeopardy tv show"
			// The !, space, (, and ) add up to distance > 2
			const result = checkTextEntry(item, 'Jeopardy TV Show');
			// This FAILS -- distance too high for fuzzy, user gets rejected
			// despite typing a perfectly reasonable answer
			expect(result.correct).toBe(false); // documents the bug
		});

		it('BUG: colons in answer are not stripped', () => {
			const item: Item = {
				...parisItem,
				answer: 'Star Wars: A New Hope',
			};
			const result = checkTextEntry(item, 'Star Wars A New Hope');
			expect(result.correct).toBe(true);
			expect(result.fuzzyMatch).toBe(true); // colon not stripped, fuzzy saves it
		});

		it('answer that normalizes to empty string after article strip', () => {
			// "The" -> normalize -> "the" -> strip article "the " -> requires \s+ after,
			// but "the" has no trailing space, so article is NOT stripped
			// "the" stays "the", user "The" normalizes to "the" -> exact match
			const item: Item = {
				...parisItem,
				answer: 'The',
			};
			const result = checkTextEntry(item, 'The');
			expect(result.correct).toBe(true);
		});

		it('answer "A" (single article) still matches "A"', () => {
			const item: Item = {
				...parisItem,
				answer: 'A',
			};
			const result = checkTextEntry(item, 'A');
			expect(result.correct).toBe(true);
		});

		it('BUG HUNT: answer with leading article + short remainder may change fuzzy eligibility', () => {
			// Answer "The Cat" -> normalized "cat" (3 chars, "the " stripped)
			// User types "The Cxt" -> normalized "cxt" (3 chars)
			// Distance = 1 but length < 5, so NO fuzzy
			const item: Item = {
				...parisItem,
				answer: 'The Cat',
			};
			const result = checkTextEntry(item, 'The Cxt');
			expect(result.correct).toBe(false); // no fuzzy for 3-char post-normalization
		});

		it('answer with leading article + long remainder allows fuzzy', () => {
			// Answer "The Cathedral" -> normalized "cathedral" (9 chars)
			// User types "The Cathadral" -> normalized "cathadral" (9 chars)
			// Distance = 2, length >= 5, fuzzy should match
			const item: Item = {
				...parisItem,
				answer: 'The Cathedral',
			};
			const result = checkTextEntry(item, 'The Cathadral');
			expect(result.correct).toBe(true);
			expect(result.fuzzyMatch).toBe(true);
		});
	});
});

// ─── checkFillBlanks ─────────────────────────────────────────────────

describe('checkFillBlanks', () => {
	describe('basic matching', () => {
		it('finds exact match and returns correct item id', () => {
			const result = checkFillBlanks(nobleGasItems, 'Helium');
			expect(result.matched).toBe(true);
			expect(result.matchedItemId).toBe('helium');
			expect(result.fuzzyMatch).toBe(false);
		});

		it('returns correct position from sortOrder', () => {
			const result = checkFillBlanks(nobleGasItems, 'Helium');
			expect(result.position).toBe(0);
		});

		it('returns no match for wrong answer', () => {
			const result = checkFillBlanks(nobleGasItems, 'Oxygen');
			expect(result.matched).toBe(false);
			expect(result.matchedItemId).toBeUndefined();
			expect(result.position).toBeUndefined();
		});

		it('case-insensitive matching', () => {
			const result = checkFillBlanks(nobleGasItems, 'helium');
			expect(result.matched).toBe(true);
			expect(result.matchedItemId).toBe('helium');
		});

		it('matches alternate answer', () => {
			const result = checkFillBlanks(nobleGasItems, 'He');
			expect(result.matched).toBe(true);
			expect(result.matchedItemId).toBe('helium');
		});

		it('echoes userAnswer in result', () => {
			const result = checkFillBlanks(nobleGasItems, 'Helium');
			expect(result.userAnswer).toBe('Helium');
		});
	});

	describe('position / sortOrder', () => {
		it('returns sortOrder 0 for first item', () => {
			const result = checkFillBlanks(nobleGasItems, 'Helium');
			expect(result.position).toBe(0);
		});

		it('returns sortOrder 2 for argon (third item)', () => {
			const result = checkFillBlanks(nobleGasItems, 'Argon');
			expect(result.position).toBe(2);
		});

		it('returns sortOrder 5 for radon (last item)', () => {
			const result = checkFillBlanks(nobleGasItems, 'Radon');
			expect(result.position).toBe(5);
		});

		it('returns sortOrder from item, not array index', () => {
			// Shuffle the array but keep sortOrder on each item
			const shuffled = [...nobleGasItems].reverse();
			const result = checkFillBlanks(shuffled, 'Helium');
			expect(result.matched).toBe(true);
			expect(result.position).toBe(0); // sortOrder is 0 regardless of array position
		});
	});

	describe('fuzzy matching in fill-blanks', () => {
		it('fuzzy-matches long enough answers', () => {
			const result = checkFillBlanks(nobleGasItems, 'Heliun');
			expect(result.matched).toBe(true);
			expect(result.matchedItemId).toBe('helium');
			expect(result.fuzzyMatch).toBe(true);
		});

		it('fuzzy-matches krypton with typo', () => {
			const result = checkFillBlanks(nobleGasItems, 'Krypotn');
			expect(result.matched).toBe(true);
			expect(result.matchedItemId).toBe('krypton');
			expect(result.fuzzyMatch).toBe(true);
		});

		it('does NOT fuzzy-match short answers', () => {
			// "He" is 2 chars; "Ha" has distance 1 but should not fuzzy-match
			const result = checkFillBlanks(nobleGasItems, 'Ha');
			expect(result.matched).toBe(false);
		});

		it('does NOT fuzzy-match 4-char answers', () => {
			// "Neon" is 4 chars; "Neox" has distance 1 but should not fuzzy-match
			const result = checkFillBlanks(nobleGasItems, 'Neox');
			expect(result.matched).toBe(false);
		});
	});

	describe('edge cases', () => {
		it('empty items array returns no match', () => {
			const result = checkFillBlanks([], 'anything');
			expect(result.matched).toBe(false);
			expect(result.fuzzyMatch).toBe(false);
		});

		it('empty input returns no match', () => {
			const result = checkFillBlanks(nobleGasItems, '');
			expect(result.matched).toBe(false);
		});

		it('whitespace-only input returns no match', () => {
			const result = checkFillBlanks(nobleGasItems, '   ');
			expect(result.matched).toBe(false);
		});

		it('single item list works correctly', () => {
			const result = checkFillBlanks([nobleGasItems[0]], 'Helium');
			expect(result.matched).toBe(true);
			expect(result.matchedItemId).toBe('helium');
		});

		it('very long input does not crash', () => {
			const result = checkFillBlanks(nobleGasItems, 'a'.repeat(500));
			expect(result.matched).toBe(false);
		});
	});

	describe('first-match semantics', () => {
		it('returns first matching item when multiple items could match', () => {
			// Two items with the same answer text -- should return the first one found
			const duplicateItems: Item[] = [
				{ id: 'first', exerciseId: 'test', answer: 'Mercury', alternates: [], explanation: '', data: {}, sortOrder: 0 },
				{ id: 'second', exerciseId: 'test', answer: 'Mercury', alternates: [], explanation: '', data: {}, sortOrder: 1 },
			];
			const result = checkFillBlanks(duplicateItems, 'Mercury');
			expect(result.matched).toBe(true);
			expect(result.matchedItemId).toBe('first');
		});

		it('matches primary answer before checking alternates of later items', () => {
			// Item A: answer "Helium", alternates ["He"]
			// Item B: answer "He", alternates []
			// If user types "He", should match Item A first (via alternate), because
			// the loop checks each item's answer AND alternates before moving to next
			const items: Item[] = [
				{ id: 'itemA', exerciseId: 'test', answer: 'Helium', alternates: ['He'], explanation: '', data: {}, sortOrder: 0 },
				{ id: 'itemB', exerciseId: 'test', answer: 'He', alternates: [], explanation: '', data: {}, sortOrder: 1 },
			];
			const result = checkFillBlanks(items, 'He');
			expect(result.matched).toBe(true);
			// fuzzyCheck checks answer AND alternates for one item before moving on
			// so "He" matches itemA's alternate
			expect(result.matchedItemId).toBe('itemA');
		});
	});

	describe('substring non-matching', () => {
		it('input that is substring of an answer does not match', () => {
			// "Neo" should NOT match "Neon"
			const result = checkFillBlanks(nobleGasItems, 'Neo');
			expect(result.matched).toBe(false);
		});

		it('answer that is substring of input does not match', () => {
			// "Neonatal" should NOT match "Neon" (exact match requires same normalized string)
			const result = checkFillBlanks(nobleGasItems, 'Neonatal');
			expect(result.matched).toBe(false);
		});

		it('answer that is prefix of input does not match', () => {
			// "Argonauts" should NOT match "Argon"
			const result = checkFillBlanks(nobleGasItems, 'Argonauts');
			expect(result.correct).toBeUndefined(); // FillBlanksCheckResult has no 'correct' field
			expect(result.matched).toBe(false);
		});
	});

	describe('type safety', () => {
		it('no-match result does not have matchedItemId', () => {
			const result = checkFillBlanks(nobleGasItems, 'Oxygen');
			expect(result).not.toHaveProperty('matchedItemId');
		});

		it('no-match result does not have position', () => {
			const result = checkFillBlanks(nobleGasItems, 'Oxygen');
			expect(result).not.toHaveProperty('position');
		});

		it('match result has all expected fields', () => {
			const result = checkFillBlanks(nobleGasItems, 'Helium');
			expect(result).toHaveProperty('matched', true);
			expect(result).toHaveProperty('matchedItemId', 'helium');
			expect(result).toHaveProperty('position', 0);
			expect(result).toHaveProperty('userAnswer', 'Helium');
			expect(result).toHaveProperty('fuzzyMatch', false);
		});
	});
});
