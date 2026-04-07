import { describe, expect, it } from 'vitest';
import { parseArgs, parseAssetBundleName } from '../../scripts/post-deploy-checklist.mjs';

describe('post-deploy checklist helpers', () => {
	it('parses key/value args', () => {
		expect(parseArgs(['--base-url', 'https://example.com', '--mode', 'sequential'])).toEqual({
			'base-url': 'https://example.com',
			mode: 'sequential',
		});
	});

	it('parses boolean flags', () => {
		expect(parseArgs(['--skip-deploy', '--skip-smoke'])).toEqual({
			'skip-deploy': 'true',
			'skip-smoke': 'true',
		});
	});

	it('extracts hashed bundle name from html', () => {
		const html = '<script type="module" src="/assets/index-Abc123.js"></script>';
		expect(parseAssetBundleName(html)).toBe('index-Abc123.js');
	});

	it('returns null when bundle name is missing', () => {
		expect(parseAssetBundleName('<html><body>no bundle</body></html>')).toBeNull();
	});
});
