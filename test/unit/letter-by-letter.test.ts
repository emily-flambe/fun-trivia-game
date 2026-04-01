import { describe, it, expect } from 'vitest';
import { countRevealableChars, maskAnswer, nextRevealCount } from '../../src/app/lib/letter-by-letter';

describe('letter-by-letter helpers', () => {
	// ===== countRevealableChars =====

	describe('countRevealableChars', () => {
		it('counts revealable letters and numbers', () => {
			expect(countRevealableChars('Sodium')).toBe(6);
			expect(countRevealableChars('H2O')).toBe(3);
			expect(countRevealableChars('C++')).toBe(1);
		});

		it('returns 0 for empty string', () => {
			expect(countRevealableChars('')).toBe(0);
		});

		it('returns 0 for string with only punctuation and spaces', () => {
			expect(countRevealableChars('...')).toBe(0);
			expect(countRevealableChars('   ')).toBe(0);
			expect(countRevealableChars('!@#$%^&*()')).toBe(0);
			expect(countRevealableChars(' - / ')).toBe(0);
		});

		it('counts single character', () => {
			expect(countRevealableChars('A')).toBe(1);
			expect(countRevealableChars('5')).toBe(1);
			expect(countRevealableChars('!')).toBe(0);
			expect(countRevealableChars(' ')).toBe(0);
		});

		it('counts accented/diacritical Unicode letters', () => {
			expect(countRevealableChars('café')).toBe(4);
			expect(countRevealableChars('naïve')).toBe(5);
			expect(countRevealableChars('über')).toBe(4);
			expect(countRevealableChars('résumé')).toBe(6);
		});

		it('counts CJK characters as revealable', () => {
			expect(countRevealableChars('東京')).toBe(2);
			expect(countRevealableChars('你好世界')).toBe(4);
		});

		it('counts Cyrillic characters as revealable', () => {
			expect(countRevealableChars('Москва')).toBe(6);
		});

		it('handles numbers mixed with letters', () => {
			expect(countRevealableChars('Area 51')).toBe(6);
			expect(countRevealableChars('7UP')).toBe(3);
			expect(countRevealableChars('24/7')).toBe(3);
			expect(countRevealableChars('3.14')).toBe(3);
		});

		it('handles hyphens and apostrophes as non-revealable', () => {
			expect(countRevealableChars("it's")).toBe(3);
			expect(countRevealableChars('mother-in-law')).toBe(11);
			expect(countRevealableChars("O'Brien")).toBe(6);
		});

		it('handles parentheses and brackets', () => {
			expect(countRevealableChars('ATP (tennis)')).toBe(9);
			expect(countRevealableChars('[redacted]')).toBe(8);
		});

		it('does not count emoji as revealable letters', () => {
			// Emoji are not \p{L} or \p{N}, so should NOT be counted
			expect(countRevealableChars('hello 🌍')).toBe(5);
			expect(countRevealableChars('🎉🎊')).toBe(0);
		});

		it('handles very long strings', () => {
			const long = 'a'.repeat(10000);
			expect(countRevealableChars(long)).toBe(10000);
		});

		it('handles mixed scripts', () => {
			expect(countRevealableChars('Hello世界123')).toBe(10);
		});
	});

	// ===== maskAnswer =====

	describe('maskAnswer', () => {
		it('masks unrevealed characters but preserves punctuation/spacing', () => {
			expect(maskAnswer('T.S. Eliot', 0)).toBe('•.•. •••••');
			expect(maskAnswer('T.S. Eliot', 3)).toBe('T.S. E••••');
			expect(maskAnswer('T.S. Eliot', 7)).toBe('T.S. Eliot');
		});

		it('returns empty string for empty input', () => {
			expect(maskAnswer('', 0)).toBe('');
			expect(maskAnswer('', 5)).toBe('');
		});

		it('fully masks with revealedCount 0', () => {
			expect(maskAnswer('Hello', 0)).toBe('•••••');
			expect(maskAnswer('A B C', 0)).toBe('• • •');
		});

		it('fully reveals when revealedCount equals total revealable chars', () => {
			expect(maskAnswer('Hello', 5)).toBe('Hello');
			expect(maskAnswer('A-B', 2)).toBe('A-B');
		});

		it('handles revealedCount greater than total revealable chars (no crash)', () => {
			expect(maskAnswer('Hi', 100)).toBe('Hi');
			expect(maskAnswer('A', 999)).toBe('A');
		});

		it('handles negative revealedCount by treating as 0', () => {
			expect(maskAnswer('Hello', -1)).toBe('•••••');
			expect(maskAnswer('Hello', -100)).toBe('•••••');
			expect(maskAnswer('A.B', -5)).toBe('•.•');
		});

		it('masks single character answer', () => {
			expect(maskAnswer('X', 0)).toBe('•');
			expect(maskAnswer('X', 1)).toBe('X');
		});

		it('handles answer with only non-revealable chars', () => {
			expect(maskAnswer('...', 0)).toBe('...');
			expect(maskAnswer('---', 0)).toBe('---');
			expect(maskAnswer(' ', 0)).toBe(' ');
			// Nothing to mask, so should look the same regardless of revealedCount
			expect(maskAnswer('...', 5)).toBe('...');
		});

		it('reveals letters left-to-right across word boundaries', () => {
			// "Area 51" has 6 revealable chars: A, r, e, a, 5, 1
			expect(maskAnswer('Area 51', 0)).toBe('•••• ••');
			expect(maskAnswer('Area 51', 1)).toBe('A••• ••');
			expect(maskAnswer('Area 51', 4)).toBe('Area ••');
			expect(maskAnswer('Area 51', 5)).toBe('Area 5•');
			expect(maskAnswer('Area 51', 6)).toBe('Area 51');
		});

		it('preserves accented characters when revealed', () => {
			expect(maskAnswer('café', 0)).toBe('••••');
			expect(maskAnswer('café', 2)).toBe('ca••');
			expect(maskAnswer('café', 4)).toBe('café');
		});

		it('preserves CJK characters when revealed', () => {
			expect(maskAnswer('東京', 0)).toBe('••');
			expect(maskAnswer('東京', 1)).toBe('東•');
			expect(maskAnswer('東京', 2)).toBe('東京');
		});

		it('handles emoji in answer (treated as non-revealable or masked)', () => {
			// Emoji are not \p{L}\p{N}, so they should pass through like punctuation
			const result = maskAnswer('hi 🌍', 0);
			expect(result).toBe('•• 🌍');
		});

		it('handles apostrophes and hyphens correctly', () => {
			expect(maskAnswer("it's", 0)).toBe("••'•");
			expect(maskAnswer("it's", 2)).toBe("it'•");
			expect(maskAnswer("it's", 3)).toBe("it's");

			expect(maskAnswer('x-ray', 0)).toBe('•-•••');
			expect(maskAnswer('x-ray', 1)).toBe('x-•••');
			expect(maskAnswer('x-ray', 4)).toBe('x-ray');
		});

		it('handles multiple consecutive spaces', () => {
			expect(maskAnswer('a  b', 0)).toBe('•  •');
			expect(maskAnswer('a  b', 1)).toBe('a  •');
			expect(maskAnswer('a  b', 2)).toBe('a  b');
		});

		it('handles answer starting/ending with punctuation', () => {
			expect(maskAnswer('(hello)', 0)).toBe('(•••••)');
			expect(maskAnswer('(hello)', 3)).toBe('(hel••)');
			expect(maskAnswer('(hello)', 5)).toBe('(hello)');
		});

		it('handles very long answer', () => {
			const answer = 'abcdefghij '.repeat(100); // 1100 chars
			const masked = maskAnswer(answer, 0);
			// All letters should be masked, spaces preserved
			expect(masked).not.toContain('a');
			expect(masked).toContain(' ');
			expect(masked.length).toBe(answer.length);
		});
	});

	// ===== nextRevealCount =====

	describe('nextRevealCount', () => {
		it('reveals one step at a time and caps at total', () => {
			expect(nextRevealCount('Gold', 0)).toBe(1);
			expect(nextRevealCount('Gold', 3)).toBe(4);
			expect(nextRevealCount('Gold', 4)).toBe(4);
		});

		it('returns 1 for empty reveal count on single char', () => {
			expect(nextRevealCount('A', 0)).toBe(1);
		});

		it('caps at 1 for single char answer', () => {
			expect(nextRevealCount('A', 0)).toBe(1);
			expect(nextRevealCount('A', 1)).toBe(1);
			expect(nextRevealCount('A', 5)).toBe(1);
		});

		it('returns 0 for empty string (no revealable chars)', () => {
			// total = 0, Math.min(0, max(0,0)+1) = Math.min(0, 1) = 0
			expect(nextRevealCount('', 0)).toBe(0);
		});

		it('returns 0 for punctuation-only string', () => {
			expect(nextRevealCount('...', 0)).toBe(0);
			expect(nextRevealCount('---', 5)).toBe(0);
		});

		it('handles negative currentRevealCount by treating as 0 then adding 1', () => {
			// Math.min(total, Math.max(0, -1) + 1) = Math.min(4, 0+1) = 1
			expect(nextRevealCount('Gold', -1)).toBe(1);
			expect(nextRevealCount('Gold', -100)).toBe(1);
		});

		it('handles currentRevealCount greater than total (already past end)', () => {
			// Math.min(4, max(0, 100)+1) = Math.min(4, 101) = 4
			expect(nextRevealCount('Gold', 100)).toBe(4);
		});

		it('increments correctly through entire answer', () => {
			const answer = 'Hi!';
			// revealable: H, i = 2
			expect(nextRevealCount(answer, 0)).toBe(1);
			expect(nextRevealCount(answer, 1)).toBe(2);
			expect(nextRevealCount(answer, 2)).toBe(2); // capped
		});

		it('increments through multi-word answer', () => {
			const answer = 'A B';
			// revealable: A, B = 2
			expect(nextRevealCount(answer, 0)).toBe(1);
			expect(nextRevealCount(answer, 1)).toBe(2);
			expect(nextRevealCount(answer, 2)).toBe(2); // capped
		});

		it('handles accented characters', () => {
			const answer = 'café';
			// revealable: c, a, f, é = 4
			expect(nextRevealCount(answer, 0)).toBe(1);
			expect(nextRevealCount(answer, 3)).toBe(4);
			expect(nextRevealCount(answer, 4)).toBe(4); // capped
		});
	});

	// ===== Integration-style tests (functions used together) =====

	describe('functions used together', () => {
		it('progressive reveal shows answer one letter at a time', () => {
			const answer = 'Gold';
			let revealed = 0;
			const steps: string[] = [];

			steps.push(maskAnswer(answer, revealed));
			while (revealed < countRevealableChars(answer)) {
				revealed = nextRevealCount(answer, revealed);
				steps.push(maskAnswer(answer, revealed));
			}

			expect(steps).toEqual([
				'••••',
				'G•••',
				'Go••',
				'Gol•',
				'Gold',
			]);
		});

		it('progressive reveal preserves structure of complex answer', () => {
			const answer = 'T.S. Eliot';
			let revealed = 0;
			const steps: string[] = [];

			steps.push(maskAnswer(answer, revealed));
			while (revealed < countRevealableChars(answer)) {
				revealed = nextRevealCount(answer, revealed);
				steps.push(maskAnswer(answer, revealed));
			}

			expect(steps).toEqual([
				'•.•. •••••',
				'T.•. •••••',
				'T.S. •••••',
				'T.S. E••••',
				'T.S. El•••',
				'T.S. Eli••',
				'T.S. Elio•',
				'T.S. Eliot',
			]);
		});

		it('progressive reveal works with numbers in answer', () => {
			const answer = '7UP';
			let revealed = 0;
			const steps: string[] = [];

			steps.push(maskAnswer(answer, revealed));
			while (revealed < countRevealableChars(answer)) {
				revealed = nextRevealCount(answer, revealed);
				steps.push(maskAnswer(answer, revealed));
			}

			expect(steps).toEqual([
				'•••',
				'7••',
				'7U•',
				'7UP',
			]);
		});

		it('progressive reveal of empty string terminates immediately', () => {
			const answer = '';
			const total = countRevealableChars(answer);
			expect(total).toBe(0);
			expect(maskAnswer(answer, 0)).toBe('');
			// nextRevealCount should not advance past 0
			expect(nextRevealCount(answer, 0)).toBe(0);
		});

		it('progressive reveal of punctuation-only string terminates immediately', () => {
			const answer = '...';
			const total = countRevealableChars(answer);
			expect(total).toBe(0);
			expect(maskAnswer(answer, 0)).toBe('...');
			expect(nextRevealCount(answer, 0)).toBe(0);
		});

		it('nextRevealCount never exceeds countRevealableChars', () => {
			const answers = ['', 'A', 'Hello World', '!!!', 'café', '東京タワー', 'Area 51'];
			for (const answer of answers) {
				const total = countRevealableChars(answer);
				for (let i = -5; i <= total + 5; i++) {
					const next = nextRevealCount(answer, i);
					expect(next).toBeLessThanOrEqual(total);
					expect(next).toBeGreaterThanOrEqual(0);
				}
			}
		});

		it('maskAnswer output length always equals input length (BMP characters)', () => {
			const answers = ['', 'A', 'Hello', 'T.S. Eliot', 'café', '東京', '(test)', 'a  b'];
			for (const answer of answers) {
				const total = countRevealableChars(answer);
				for (let i = 0; i <= total; i++) {
					const masked = maskAnswer(answer, i);
					expect(masked.length).toBe(answer.length);
				}
			}
		});

		// BUG: Surrogate pair letters (e.g. mathematical bold letters U+1D400+)
		// are matched by \p{L} but replaced with '•' (1 UTF-16 unit), while
		// the original character is 2 UTF-16 units. This causes .length mismatch.
		it('BUG: maskAnswer changes .length for surrogate pair letters', () => {
			// Mathematical bold A = U+1D400, encoded as surrogate pair \uD835\uDC00
			const boldA = '\uD835\uDC00';
			expect(boldA.length).toBe(2); // 2 UTF-16 code units
			expect(countRevealableChars(boldA)).toBe(1); // it IS a letter

			const masked = maskAnswer(boldA, 0);
			// The mask char '•' is 1 UTF-16 unit, so masked.length will be 1, not 2
			// This is a bug: masked.length !== boldA.length
			expect(masked).toBe('•');
			expect(masked.length).toBe(1); // BUG: should be 2 to preserve alignment
			expect(masked.length).not.toBe(boldA.length); // confirms the mismatch
		});

		it('BUG: maskAnswer length mismatch with mixed BMP and surrogate pair letters', () => {
			// "A" (BMP) + Mathematical Bold B (U+1D401, surrogate pair) + "c" (BMP)
			const mixed = 'A\uD835\uDC01c';
			expect(mixed.length).toBe(4); // 1 + 2 + 1 UTF-16 units
			expect(countRevealableChars(mixed)).toBe(3);

			// Fully masked: each letter becomes '•' (1 UTF-16 unit)
			const masked = maskAnswer(mixed, 0);
			expect(masked).toBe('•••'); // 3 bullets, length 3
			expect(masked.length).toBe(3); // BUG: should be 4 to match input length
			expect(masked.length).not.toBe(mixed.length);
		});

		it('nextRevealCount returns NaN when given NaN (no input validation)', () => {
			// This documents a defensive programming gap. If upstream code passes
			// NaN (e.g. from a failed parseInt), nextRevealCount propagates it.
			// Math.min(4, Math.max(0, NaN) + 1) = Math.min(4, NaN) = NaN
			const result = nextRevealCount('Gold', NaN);
			expect(result).toBeNaN();
		});
	});
});
