import { describe, it, expect } from 'vitest';
import { countRevealableChars, maskAnswer, nextRevealCount } from '../../src/app/lib/letter-by-letter';

describe('letter-by-letter helpers', () => {
	it('counts revealable letters and numbers', () => {
		expect(countRevealableChars('Sodium')).toBe(6);
		expect(countRevealableChars('H2O')).toBe(3);
		expect(countRevealableChars('C++')).toBe(1);
	});

	it('masks unrevealed characters but preserves punctuation/spacing', () => {
		expect(maskAnswer('T.S. Eliot', 0)).toBe('•.•. •••••');
		expect(maskAnswer('T.S. Eliot', 3)).toBe('T.S. E••••');
		expect(maskAnswer('T.S. Eliot', 7)).toBe('T.S. Eliot');
	});

	it('reveals one step at a time and caps at total', () => {
		expect(nextRevealCount('Gold', 0)).toBe(1);
		expect(nextRevealCount('Gold', 3)).toBe(4);
		expect(nextRevealCount('Gold', 4)).toBe(4);
	});
});
