import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const DEFAULT_BASE_URL = 'https://trivia.emilycogsdill.com';

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

function parseAssetBundleName(html) {
	const match = html.match(/index-[^"]*\.js/);
	return match ? match[0] : null;
}

function resolveCommand(command) {
	if (command === 'npm' && process.platform === 'win32') return 'npm.cmd';
	return command;
}

function runCommand(command, args) {
	const result = spawnSync(resolveCommand(command), args, { stdio: 'inherit' });
	if (result.status !== 0) {
		throw new Error(`Command failed: ${command} ${args.join(' ')}`);
	}
}

async function verifyProductionHash(baseUrl) {
	const prodHtml = await fetch(baseUrl).then((res) => {
		if (!res.ok) throw new Error(`Failed to fetch ${baseUrl}: ${res.status}`);
		return res.text();
	});
	const localHtml = await fs.readFile('dist/index.html', 'utf8');

	const prodAsset = parseAssetBundleName(prodHtml);
	const localAsset = parseAssetBundleName(localHtml);

	if (!prodAsset || !localAsset) {
		throw new Error(`Could not read asset names. prod=${prodAsset} local=${localAsset}`);
	}

	if (prodAsset !== localAsset) {
		throw new Error(`Asset mismatch. prod=${prodAsset} local=${localAsset}`);
	}

	console.log(`Hash check passed: ${prodAsset}`);
}

async function run() {
	const args = parseArgs(process.argv.slice(2));
	const baseUrl = (args['base-url'] || process.env.MAP_QUIZ_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
	const mode = args.mode || 'both';
	const outputDir = args['output-dir'];
	const skipDeploy = args['skip-deploy'] === 'true';
	const skipSmoke = args['skip-smoke'] === 'true';

	if (!skipDeploy) {
		runCommand('npm', ['run', 'deploy']);
	}

	await verifyProductionHash(baseUrl);

	if (!skipSmoke) {
		const smokeArgs = ['scripts/verify-map-quiz-prod.mjs', '--base-url', baseUrl, '--mode', mode];
		if (outputDir) smokeArgs.push('--output-dir', outputDir);
		runCommand('node', smokeArgs);
	}

	console.log('Post-deploy checklist passed.');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	run().catch((err) => {
		console.error(err instanceof Error ? err.message : err);
		process.exit(1);
	});
}

export { parseArgs, parseAssetBundleName };
