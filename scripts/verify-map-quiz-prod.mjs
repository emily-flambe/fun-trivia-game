import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const DEFAULT_BASE_URL = 'https://trivia.emilycogsdill.com';
const DEFAULT_OUTPUT_DIR = 'tmp-screenshots';
const DEFAULT_BOUNDS = { minX: 0.2, maxX: 0.8, minY: 0.2, maxY: 0.85 };

function parseArgs(argv) {
	const args = {};
	for (let i = 0; i < argv.length; i++) {
		const token = argv[i];
		if (!token.startsWith('--')) continue;
		const key = token.slice(2);
		const next = argv[i + 1];
		if (!next || next.startsWith('--')) {
			args[key] = 'true';
			continue;
		}
		args[key] = next;
		i++;
	}
	return args;
}

function mapToQuizHash(exerciseId) {
	return `#/exercise/${exerciseId}?mode=quiz`;
}

function slugifyExerciseId(exerciseId) {
	return exerciseId.replaceAll('/', '_');
}

function isCentroidInBounds(centroid, bounds = DEFAULT_BOUNDS) {
	if (!centroid || typeof centroid.normX !== 'number' || typeof centroid.normY !== 'number') return false;
	return (
		centroid.normX >= bounds.minX &&
		centroid.normX <= bounds.maxX &&
		centroid.normY >= bounds.minY &&
		centroid.normY <= bounds.maxY
	);
}

async function fetchJson(url) {
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Request failed: ${url} -> ${res.status}`);
	}
	return res.json();
}

async function listMapExercises(baseUrl) {
	const root = await fetchJson(`${baseUrl}/api/nodes`);
	const queue = (root.nodes || []).map((n) => n.id);
	const visited = new Set();
	const maps = [];

	while (queue.length) {
		const nodeId = queue.shift();
		if (visited.has(nodeId)) continue;
		visited.add(nodeId);
		const node = await fetchJson(`${baseUrl}/api/nodes/${nodeId}`);
		for (const ex of node.exercises || []) {
			if (ex.displayType === 'map') maps.push(ex.id);
		}
		for (const child of node.children || []) {
			queue.push(child.id);
		}
	}

	return maps.sort((a, b) => a.localeCompare(b));
}

async function readMapCentroid(page) {
	return page.evaluate(() => {
		const svg = document.querySelector('svg.rsm-svg');
		if (!svg) return null;
		const svgRect = svg.getBoundingClientRect();
		const exerciseFills = new Set([
			'rgb(232, 221, 208)',
			'rgb(192, 120, 48)',
			'rgb(74, 124, 111)',
		]);
		const points = [];

		for (const p of Array.from(svg.querySelectorAll('path'))) {
			const fill = getComputedStyle(p).fill;
			if (!exerciseFills.has(fill)) continue;
			const r = p.getBoundingClientRect();
			if (!r.width || !r.height) continue;
			points.push({
				x: (r.left + r.right) / 2 - svgRect.left,
				y: (r.top + r.bottom) / 2 - svgRect.top,
			});
		}

		if (!points.length) return null;
		const avgX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
		const avgY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
		return {
			count: points.length,
			normX: avgX / svgRect.width,
			normY: avgY / svgRect.height,
		};
	});
}

async function verifyExercisePage(page, { baseUrl, exerciseId, outputDir, prefix, bounds }) {
	const hash = mapToQuizHash(exerciseId);
	const url = `${baseUrl}/${hash}`;
	await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
	await page.waitForSelector('svg.rsm-svg', { timeout: 30000 });
	await page.waitForSelector('text=Name the highlighted country.', { timeout: 30000 });
	await page.waitForTimeout(1000);

	const centroid = await readMapCentroid(page);
	const ok = isCentroidInBounds(centroid, bounds);
	const screenshotPath = path.join(outputDir, `${prefix}-${slugifyExerciseId(exerciseId)}.png`);
	await page.screenshot({ path: screenshotPath, fullPage: true });

	return {
		exerciseId,
		url,
		ok,
		centroid,
		screenshotPath,
	};
}

async function run() {
	const args = parseArgs(process.argv.slice(2));
	const baseUrl = (args['base-url'] || process.env.MAP_QUIZ_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
	const mode = args.mode || 'both';
	const outputDir = args['output-dir'] || DEFAULT_OUTPUT_DIR;
	const bounds = {
		minX: args['min-x'] ? Number(args['min-x']) : DEFAULT_BOUNDS.minX,
		maxX: args['max-x'] ? Number(args['max-x']) : DEFAULT_BOUNDS.maxX,
		minY: args['min-y'] ? Number(args['min-y']) : DEFAULT_BOUNDS.minY,
		maxY: args['max-y'] ? Number(args['max-y']) : DEFAULT_BOUNDS.maxY,
	};
	const runSequential = mode === 'both' || mode === 'sequential';
	const runFresh = mode === 'both' || mode === 'fresh';

	if (!runSequential && !runFresh) {
		throw new Error(`Invalid --mode "${mode}". Use "both", "sequential", or "fresh".`);
	}

	await fs.mkdir(outputDir, { recursive: true });
	const exerciseIds = await listMapExercises(baseUrl);
	if (!exerciseIds.length) {
		throw new Error(`No map exercises found at ${baseUrl}`);
	}

	console.log(`Found ${exerciseIds.length} map quizzes at ${baseUrl}`);
	const browser = await chromium.launch({ headless: true });
	const failures = [];

	try {
		if (runSequential) {
			const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
			try {
				for (const exerciseId of exerciseIds) {
					const result = await verifyExercisePage(page, {
						baseUrl,
						exerciseId,
						outputDir,
						prefix: 'map-quiz-seq-smoke',
						bounds,
					});
					console.log(
						`[sequential] ${exerciseId} centroid=(${result.centroid?.normX?.toFixed(3)}, ${result.centroid?.normY?.toFixed(3)}) screenshot=${result.screenshotPath}`
					);
					if (!result.ok) failures.push(result);
				}
			} finally {
				await page.close();
			}
		}

		if (runFresh) {
			for (const exerciseId of exerciseIds) {
				const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
				try {
					const result = await verifyExercisePage(page, {
						baseUrl,
						exerciseId,
						outputDir,
						prefix: 'map-quiz-fresh-smoke',
						bounds,
					});
					console.log(
						`[fresh] ${exerciseId} centroid=(${result.centroid?.normX?.toFixed(3)}, ${result.centroid?.normY?.toFixed(3)}) screenshot=${result.screenshotPath}`
					);
					if (!result.ok) failures.push(result);
				} finally {
					await page.close();
				}
			}
		}
	} finally {
		await browser.close();
	}

	if (failures.length) {
		console.error(`Map quiz smoke failed for ${failures.length} route(s):`);
		for (const f of failures) {
			console.error(
				`- ${f.exerciseId} centroid=(${f.centroid?.normX}, ${f.centroid?.normY}) url=${f.url} screenshot=${f.screenshotPath}`
			);
		}
		process.exit(1);
	}

	console.log('Map quiz smoke passed.');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	run().catch((err) => {
		console.error(err instanceof Error ? err.message : err);
		process.exit(1);
	});
}

export {
	DEFAULT_BOUNDS,
	isCentroidInBounds,
	mapToQuizHash,
	parseArgs,
	slugifyExerciseId,
};
