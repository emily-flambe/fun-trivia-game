import { describe, expect, it } from 'vitest';
import { getMapConfig, getMapProjectionKey } from '../../src/app/lib/map-config';

describe('getMapConfig', () => {
	it('returns europe map settings', () => {
		expect(getMapConfig('geography/maps/europe')).toEqual({ center: [15, 54], scale: 700 });
	});

	it('returns south america map settings', () => {
		expect(getMapConfig('geography/maps/south-america')).toEqual({ center: [-58, -18], scale: 450 });
	});

	it('returns africa map settings', () => {
		expect(getMapConfig('geography/maps/africa')).toEqual({ center: [20, 2], scale: 350 });
	});

	it('returns asia map settings', () => {
		expect(getMapConfig('geography/maps/asia')).toEqual({ center: [85, 35], scale: 300 });
	});

	it('returns north america map settings', () => {
		expect(getMapConfig('geography/maps/north-america')).toEqual({ center: [-95, 45], scale: 350 });
	});

	it('falls back to world settings', () => {
		expect(getMapConfig('geography/maps/world')).toEqual({ center: [0, 20], scale: 147 });
	});
});

describe('getMapProjectionKey', () => {
	it('changes when exercise changes so the map remounts', () => {
		const africaKey = getMapProjectionKey('geography/maps/africa');
		const asiaKey = getMapProjectionKey('geography/maps/asia');
		expect(africaKey).not.toBe(asiaKey);
	});

	it('is stable for the same exercise id', () => {
		const first = getMapProjectionKey('geography/maps/europe');
		const second = getMapProjectionKey('geography/maps/europe');
		expect(first).toBe(second);
	});
});
