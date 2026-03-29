import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

describe('Seed file Wikipedia links', () => {
	const seedDir = join(__dirname, '../../seeds');
	const seedFiles = readdirSync(seedDir)
		.filter(f => f.endsWith('.json') && f !== '_categories.json');

	it('should have seed files to validate', () => {
		expect(seedFiles.length).toBeGreaterThan(0);
	});

	for (const file of seedFiles) {
		describe(file, () => {
			const content = JSON.parse(readFileSync(join(seedDir, file), 'utf-8'));
			const exercises = content.exercises || [];

			for (const exercise of exercises) {
				const items = exercise.items || [];
				for (const item of items) {
					it(`${exercise.id} > ${item.id} has at least one link`, () => {
						expect(
							item.links,
							`Item "${item.id}" in exercise "${exercise.id}" is missing links array`
						).toBeDefined();
						expect(
							item.links.length,
							`Item "${item.id}" in exercise "${exercise.id}" has empty links array`
						).toBeGreaterThan(0);
					});

					it(`${exercise.id} > ${item.id} links have valid structure`, () => {
						if (!item.links) return;
						for (const link of item.links) {
							expect(link.text, `Link in "${item.id}" missing text`).toBeTruthy();
							expect(link.url, `Link in "${item.id}" missing url`).toBeTruthy();
							expect(
								link.url.startsWith('https://en.wikipedia.org/wiki/'),
								`Link URL in "${item.id}" must be a Wikipedia URL: ${link.url}`
							).toBe(true);
						}
					});
				}
			}
		});
	}
});
