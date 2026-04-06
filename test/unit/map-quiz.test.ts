import { describe, expect, it } from 'vitest';

// Test the geo matching logic extracted from MapQuiz
// These are the same functions used in the component

const NAME_ALIASES: Record<string, string[]> = {
	'Czech Republic': ['Czechia'],
	'Czechia': ['Czech Republic'],
	'Bosnia and Herzegovina': ['Bosnia and Herz.'],
	'North Macedonia': ['Macedonia'],
	'Dominican Republic': ['Dominican Rep.'],
	'Central African Republic': ['Central African Rep.'],
	'South Sudan': ['S. Sudan'],
	'Democratic Republic of the Congo': ['Dem. Rep. Congo', 'DR Congo'],
	'Republic of the Congo': ['Congo'],
	'Ivory Coast': ["Côte d'Ivoire", "Cote d'Ivoire"],
	'East Timor': ['Timor-Leste'],
	'Eswatini': ['eSwatini', 'Swaziland'],
	'United States': ['United States of America'],
};

interface MockItem {
	id: string;
	data?: { cardBack?: string };
}

function geoMatchesItem(geoName: string, item: MockItem): boolean {
	const cardBack = (item.data?.cardBack || '').toLowerCase();
	const geoLower = geoName.toLowerCase();
	if (geoLower === cardBack) return true;
	const aliases = NAME_ALIASES[item.data?.cardBack || ''];
	if (aliases) {
		return aliases.some(a => a.toLowerCase() === geoLower);
	}
	for (const [canonical, aliasList] of Object.entries(NAME_ALIASES)) {
		if (aliasList.some(a => a.toLowerCase() === geoLower) && canonical.toLowerCase() === cardBack) {
			return true;
		}
	}
	return false;
}

describe('geoMatchesItem', () => {
	it('matches exact names', () => {
		const item = { id: 'nigeria', data: { cardBack: 'Nigeria' } };
		expect(geoMatchesItem('Nigeria', item)).toBe(true);
	});

	it('matches case-insensitively', () => {
		const item = { id: 'nigeria', data: { cardBack: 'Nigeria' } };
		expect(geoMatchesItem('nigeria', item)).toBe(true);
	});

	it('does not match different countries', () => {
		const item = { id: 'nigeria', data: { cardBack: 'Nigeria' } };
		expect(geoMatchesItem('Ghana', item)).toBe(false);
	});

	it('matches via forward alias (item name -> geo name)', () => {
		const item = { id: 'south-sudan', data: { cardBack: 'South Sudan' } };
		expect(geoMatchesItem('S. Sudan', item)).toBe(true);
	});

	it('matches via reverse alias (geo name -> item name)', () => {
		const item = { id: 'ivory-coast', data: { cardBack: 'Ivory Coast' } };
		expect(geoMatchesItem("Côte d'Ivoire", item)).toBe(true);
	});

	it('matches DRC variants', () => {
		const item = { id: 'drc', data: { cardBack: 'Democratic Republic of the Congo' } };
		expect(geoMatchesItem('Dem. Rep. Congo', item)).toBe(true);
	});

	it('returns false for items with no cardBack', () => {
		const item = { id: 'test', data: {} };
		expect(geoMatchesItem('Nigeria', item)).toBe(false);
	});
});
