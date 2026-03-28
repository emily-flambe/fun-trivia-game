import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		cloudflareTest({
			wrangler: { configPath: './wrangler.toml' },
			miniflare: {
				bindings: {
					CF_ACCESS_TEST_EMAIL: 'test@trivia.emilycogsdill.com',
				},
			},
		}),
	],
	test: {
		include: ['test/worker.test.ts'],
	},
});
