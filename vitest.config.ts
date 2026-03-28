import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
	test: {
		include: ['test/worker.test.ts'],
		poolOptions: {
			workers: {
				wrangler: { configPath: './wrangler.toml' },
				miniflare: {
					bindings: {
						CF_ACCESS_TEST_EMAIL: 'test@trivia.emilycogsdill.com',
					},
				},
			},
		},
	},
});
