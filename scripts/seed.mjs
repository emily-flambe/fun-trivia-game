#!/usr/bin/env node
/**
 * Seed script for D1 database.
 * Reads JSON files from seeds/ and generates SQL to insert into D1.
 *
 * Usage:
 *   node scripts/seed.mjs                    # Print SQL to stdout
 *   node scripts/seed.mjs | wrangler d1 execute trivia-trainer --file=-
 *   node scripts/seed.mjs --local            # Seed local D1 (dev)
 *   node scripts/seed.mjs --remote           # Seed remote D1 (production)
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const SEEDS_DIR = join(import.meta.dirname, '..', 'seeds');

function escapeSQL(s) {
	return s.replace(/'/g, "''");
}

async function loadSeedFiles() {
	const files = await readdir(SEEDS_DIR);
	const jsonFiles = files.filter((f) => f.endsWith('.json'));
	const modules = [];

	for (const file of jsonFiles) {
		const content = await readFile(join(SEEDS_DIR, file), 'utf-8');
		const mod = JSON.parse(content);
		modules.push(mod);
	}

	return modules;
}

function generateSQL(modules) {
	const statements = [];

	for (const mod of modules) {
		const defaultFormat = mod.defaultFormat || 'text-entry';
		statements.push(
			`INSERT OR REPLACE INTO modules (id, category, name, tier, description, default_format) VALUES ('${escapeSQL(mod.id)}', '${escapeSQL(mod.category)}', '${escapeSQL(mod.name)}', '${escapeSQL(mod.tier)}', '${escapeSQL(mod.description)}', '${escapeSQL(defaultFormat)}');`
		);

		for (let i = 0; i < mod.questions.length; i++) {
			const q = mod.questions[i];
			const id = q.id || `q${i + 1}`;
			const question = escapeSQL(q.question);
			const answer = `'${escapeSQL(q.answer)}'`;
			const alternateAnswers = JSON.stringify(q.alternateAnswers || []);
			const options = q.options ? `'${escapeSQL(JSON.stringify(q.options))}'` : 'NULL';
			const correctIndex = q.correctIndex !== undefined ? q.correctIndex : 'NULL';
			const matchPairs = q.matchPairs ? `'${escapeSQL(JSON.stringify(q.matchPairs))}'` : 'NULL';
			const explanation = escapeSQL(q.explanation);

			statements.push(
				`INSERT OR REPLACE INTO questions (id, module_id, question, answer, alternate_answers, options, correct_index, match_pairs, explanation, sort_order) VALUES ('${escapeSQL(id)}', '${escapeSQL(mod.id)}', '${question}', ${answer}, '${escapeSQL(alternateAnswers)}', ${options}, ${correctIndex}, ${matchPairs}, '${explanation}', ${i});`
			);
		}
	}

	return statements.join('\n');
}

async function main() {
	const args = process.argv.slice(2);
	const modules = await loadSeedFiles();

	if (modules.length === 0) {
		console.error('No seed files found in seeds/');
		process.exit(1);
	}

	const sql = generateSQL(modules);
	console.log(`-- Seeding ${modules.length} modules with ${modules.reduce((sum, m) => sum + m.questions.length, 0)} total questions`);

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
