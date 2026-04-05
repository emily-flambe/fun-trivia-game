#!/usr/bin/env node
/**
 * Generate docs/CONTENT_MAP.md from the D1 database.
 *
 * Usage:
 *   node scripts/content-map.mjs            # Query remote D1, write docs/CONTENT_MAP.md
 *   node scripts/content-map.mjs --local    # Query local D1 instead
 *   node scripts/content-map.mjs --stdout   # Print to stdout instead of writing file
 */

import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const flag = process.argv.includes('--local') ? '--local' : '--remote';
const toStdout = process.argv.includes('--stdout');

function query(sql) {
	// Collapse to single line — wrangler on Windows chokes on multiline --command
	const oneLine = sql.replace(/\s+/g, ' ').trim();
	const raw = execSync(
		`npx wrangler d1 execute trivia-trainer ${flag} --json --command "${oneLine.replace(/"/g, '\\"')}"`,
		{ cwd: ROOT, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
	);
	return JSON.parse(raw)[0].results;
}

// --- Fetch data ---

const nodes = query(
	'SELECT n.id, n.parent_id, n.name, n.sort_order FROM nodes n ORDER BY n.sort_order, n.name',
);

const exercises = query(
	'SELECT e.id, e.node_id, e.name, e.format, e.display_type, e.sort_order, (SELECT COUNT(*) FROM items i WHERE i.exercise_id = e.id) as item_count FROM exercises e ORDER BY e.node_id, e.sort_order, e.name',
);

// --- Organize ---

const roots = nodes.filter((n) => !n.parent_id);
const childrenOf = (parentId) =>
	nodes.filter((n) => n.parent_id === parentId).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
const exercisesOf = (nodeId) => exercises.filter((e) => e.node_id === nodeId);

// --- Render ---

const lines = [];
const push = (s = '') => lines.push(s);

const today = new Date().toISOString().slice(0, 10);
const totalExercises = exercises.length;
const totalItems = exercises.reduce((sum, e) => sum + e.item_count, 0);

push('# Content Map');
push();
push('Structural inventory of all trivia content. Generated from D1 — do not edit by hand.');
push();
push('```bash');
push('# Regenerate this file:');
push('node scripts/content-map.mjs');
push('```');
push();
push(`**Generated:** ${today}  `);
push(`**Totals:** ${roots.length} categories, ${nodes.length} nodes, ${totalExercises} exercises, ${totalItems} items`);
push();
push('---');

for (const root of roots) {
	const children = childrenOf(root.id);
	// Collect all exercises under this category (direct + via children)
	const catExercises = [
		...exercisesOf(root.id),
		...children.flatMap((c) => exercisesOf(c.id)),
	];
	const catItems = catExercises.reduce((sum, e) => sum + e.item_count, 0);

	push();
	const exWord = catExercises.length === 1 ? 'exercise' : 'exercises';
	push(`## ${root.name} (${catExercises.length} ${exWord}, ${catItems} items)`);
	push();

	if (catExercises.length > 0) {
		push('| Subcategory | Exercise | Format | Items |');
		push('|-------------|----------|--------|------:|');

		for (const child of children) {
			const exs = exercisesOf(child.id);
			for (const ex of exs) {
				const fmt = ex.display_type ? `${ex.format} (${ex.display_type})` : ex.format;
				push(`| ${child.name} | ${ex.name} | ${fmt} | ${ex.item_count} |`);
			}
		}

		// Exercises directly on the root node (unlikely but possible)
		for (const ex of exercisesOf(root.id)) {
			const fmt = ex.display_type ? `${ex.format} (${ex.display_type})` : ex.format;
			push(`| *(root)* | ${ex.name} | ${fmt} | ${ex.item_count} |`);
		}
	}

	// Empty subcategories
	const empty = children.filter((c) => exercisesOf(c.id).length === 0);
	if (empty.length > 0) {
		push();
		push(`**Empty subcategories (${empty.length}):** ${empty.map((c) => c.name).join(', ')}`);
	}

	push();
	push('---');
}

// --- Coverage summary ---

push();
push('## Coverage Summary');
push();
push('| Category | Subcategories | With exercises | Empty | Exercises | Items |');
push('|----------|:------------:|:--------------:|:-----:|:---------:|------:|');

for (const root of roots) {
	const children = childrenOf(root.id);
	const withEx = children.filter((c) => exercisesOf(c.id).length > 0).length;
	const emptyCount = children.length - withEx;
	const catExercises = [
		...exercisesOf(root.id),
		...children.flatMap((c) => exercisesOf(c.id)),
	];
	const catItems = catExercises.reduce((sum, e) => sum + e.item_count, 0);
	push(`| ${root.name} | ${children.length} | ${withEx} | ${emptyCount} | ${catExercises.length} | ${catItems} |`);
}

push(`| **Total** | **${nodes.length - roots.length}** | | | **${totalExercises}** | **${totalItems}** |`);

// --- Empty item warnings ---

const emptyExercises = exercises.filter((e) => e.item_count === 0);
if (emptyExercises.length > 0) {
	push();
	push('## Exercises with 0 Items');
	push();
	for (const ex of emptyExercises) {
		push(`- \`${ex.id}\` — ${ex.name} (${ex.format})`);
	}
}

push('');

const output = lines.join('\n');

if (toStdout) {
	process.stdout.write(output);
} else {
	const outPath = join(ROOT, 'docs', 'CONTENT_MAP.md');
	writeFileSync(outPath, output, 'utf-8');
	console.log(`Wrote ${outPath}`);
}
