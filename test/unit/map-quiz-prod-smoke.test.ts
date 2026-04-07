import { describe, expect, it } from 'vitest';
import {
	DEFAULT_BOUNDS,
	isCentroidInBounds,
	mapToQuizHash,
	parseArgs,
	slugifyExerciseId,
} from '../../scripts/verify-map-quiz-prod.mjs';

describe('map quiz prod smoke helpers', () => {
	it('parses --key value args', () => {
		const parsed = parseArgs(['--base-url', 'https://example.com', '--mode', 'fresh']);
		expect(parsed).toEqual({
			'base-url': 'https://example.com',
			mode: 'fresh',
		});
	});

	it('supports boolean flags in arg parser', () => {
		const parsed = parseArgs(['--verbose']);
		expect(parsed).toEqual({ verbose: 'true' });
	});

	it('builds quiz hash from exercise id', () => {
		expect(mapToQuizHash('geography/maps/asia')).toBe('#/exercise/geography/maps/asia?mode=quiz');
	});

	it('slugifies exercise ids for screenshot names', () => {
		expect(slugifyExerciseId('geography/maps/north-america')).toBe('geography_maps_north-america');
	});

	it('accepts centroids within configured bounds', () => {
		expect(isCentroidInBounds({ normX: 0.5, normY: 0.5 }, DEFAULT_BOUNDS)).toBe(true);
	});

	it('rejects centroids outside configured bounds', () => {
		expect(isCentroidInBounds({ normX: 0.92, normY: 0.2 }, DEFAULT_BOUNDS)).toBe(false);
	});

	it('rejects null centroids', () => {
		expect(isCentroidInBounds(null, DEFAULT_BOUNDS)).toBe(false);
	});
});
