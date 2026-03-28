import { defineConfig } from '@playwright/test';

const testEmail = process.env.CF_ACCESS_TEST_EMAIL;
const varFlag = testEmail ? ` --var CF_ACCESS_TEST_EMAIL:${testEmail}` : '';

export default defineConfig({
	testDir: './e2e',
	timeout: 30000,
	retries: 1,
	use: {
		baseURL: 'http://localhost:8787',
		headless: true,
		viewport: { width: 1280, height: 720 },
	},
	webServer: {
		command: `npx wrangler dev --port 8787${varFlag}`,
		port: 8787,
		reuseExistingServer: true,
		timeout: 15000,
	},
});
