#!/usr/bin/env node
/**
 * Seed script for D1 database (redesigned schema).
 * Reads JSON files from seeds/ and generates SQL to insert nodes, exercises, and items.
 *
 * Usage:
 *   node scripts/seed.mjs                    # Print SQL to stdout
 *   node scripts/seed.mjs --local            # Seed local D1 (dev)
 *   node scripts/seed.mjs --remote           # Seed remote D1 (production)
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const SEEDS_DIR = join(import.meta.dirname, '..', 'seeds');

function escapeSQL(s) {
	if (s == null) return '';
	return String(s).replace(/'/g, "''");
}

async function loadSeedFiles() {
	const files = await readdir(SEEDS_DIR);
	const jsonFiles = files.filter((f) => f.endsWith('.json')).sort();
	const seedData = [];

	for (const file of jsonFiles) {
		const content = await readFile(join(SEEDS_DIR, file), 'utf-8');
		seedData.push(JSON.parse(content));
	}

	return seedData;
}

function buildItemData(exercise, item) {
	const data = {};
	// cardFront/cardBack are format-agnostic (any exercise can have Learn mode cards)
	if (item.cardFront) data.cardFront = item.cardFront;
	if (item.cardBack) data.cardBack = item.cardBack;
	if (exercise.format === 'text-entry') {
		if (item.prompt) data.prompt = item.prompt;
	} else if (exercise.format === 'fill-blanks') {
		if (item.label) data.label = item.label;
	}
	return data;
}

function generateSQL(seedFiles) {
	const statements = [];
	let nodeCount = 0;
	let exerciseCount = 0;
	let itemCount = 0;

	for (const seed of seedFiles) {
		const nodes = seed.nodes || [];
		const exercises = seed.exercises || [];

		for (let i = 0; i < nodes.length; i++) {
			const node = nodes[i];
			const parentId = node.parentId ? `'${escapeSQL(node.parentId)}'` : 'NULL';
			const sortOrder = node.sortOrder !== undefined ? node.sortOrder : i;
			statements.push(
				`INSERT OR REPLACE INTO nodes (id, parent_id, name, description, sort_order) VALUES ('${escapeSQL(node.id)}', ${parentId}, '${escapeSQL(node.name)}', '${escapeSQL(node.description || '')}', ${sortOrder});`
			);
			nodeCount++;
		}

		for (let i = 0; i < exercises.length; i++) {
			const ex = exercises[i];
			const displayType = ex.displayType ? `'${escapeSQL(ex.displayType)}'` : 'NULL';
			const config = ex.config ? `'${escapeSQL(JSON.stringify(ex.config))}'` : 'NULL';
			const sortOrder = ex.sortOrder !== undefined ? ex.sortOrder : i;
			statements.push(
				`INSERT OR REPLACE INTO exercises (id, node_id, name, description, format, display_type, config, sort_order) VALUES ('${escapeSQL(ex.id)}', '${escapeSQL(ex.nodeId)}', '${escapeSQL(ex.name)}', '${escapeSQL(ex.description || '')}', '${escapeSQL(ex.format)}', ${displayType}, ${config}, ${sortOrder});`
			);
			exerciseCount++;

			const items = ex.items || [];
			for (let j = 0; j < items.length; j++) {
				const item = items[j];
				const alternates = JSON.stringify(item.alternates || []);
				const data = buildItemData(ex, item);
				const sortOrderItem = item.sortOrder !== undefined ? item.sortOrder : j;
				statements.push(
					`INSERT OR REPLACE INTO items (id, exercise_id, answer, alternates, explanation, data, sort_order) VALUES ('${escapeSQL(item.id)}', '${escapeSQL(ex.id)}', '${escapeSQL(item.answer)}', '${escapeSQL(alternates)}', '${escapeSQL(item.explanation || '')}', '${escapeSQL(JSON.stringify(data))}', ${sortOrderItem});`
				);
				itemCount++;
			}
		}
	}

	return { sql: statements.join('\n'), nodeCount, exerciseCount, itemCount };
}

async function main() {
	const args = process.argv.slice(2);
	const seedFiles = await loadSeedFiles();

	if (seedFiles.length === 0) {
		console.error('No seed files found in seeds/');
		process.exit(1);
	}

	const { sql, nodeCount, exerciseCount, itemCount } = generateSQL(seedFiles);
	console.log(`-- Seeding ${nodeCount} nodes, ${exerciseCount} exercises, ${itemCount} items`);

	if (args.includes('--local')) {
		const tmpFile = join(import.meta.dirname, '..', '.seed-tmp.sql');
		const { writeFile, unlink } = await import('node:fs/promises');
		await writeFile(tmpFile, sql);
		try {
			execSync(`npx wrangler d1 execute trivia-trainer --local --file=${tmpFile}`, { stdio: 'inherit' });
		} finally {
			await unlink(tmpFile).catch(() => {});
		}
	} else if (args.includes('--remote')) {
		const tmpFile = join(import.meta.dirname, '..', '.seed-tmp.sql');
		const { writeFile, unlink } = await import('node:fs/promises');
		await writeFile(tmpFile, sql);
		try {
			execSync(`npx wrangler d1 execute trivia-trainer --remote --file=${tmpFile}`, { stdio: 'inherit' });
		} finally {
			await unlink(tmpFile).catch(() => {});
		}
	} else {
		// Just print SQL to stdout
		console.log(sql);
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
