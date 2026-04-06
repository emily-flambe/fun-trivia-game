import { describe, expect, it } from 'vitest';
import { shouldRenderMapDisplay } from '../../src/app/lib/display-mode';

describe('shouldRenderMapDisplay', () => {
	it('returns true for map exercises in learn mode', () => {
		expect(shouldRenderMapDisplay('map', 'learn')).toBe(true);
	});

	it('returns true for map exercises in quiz mode', () => {
		expect(shouldRenderMapDisplay('map', 'quiz')).toBe(true);
	});

	it('returns false for map exercises in grid mode', () => {
		expect(shouldRenderMapDisplay('map', 'grid')).toBe(false);
	});

	it('returns false for non-map exercises', () => {
		expect(shouldRenderMapDisplay('cards', 'quiz')).toBe(false);
	});
});
