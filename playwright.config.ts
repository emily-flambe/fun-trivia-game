import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: './e2e',
	timeout: 30000,
	use: {
		baseURL: 'http://localhost:5173',
		headless: true,
	},
	webServer: [
		{
			command: 'npx wrangler dev --port 8787',
			port: 8787,
			reuseExistingServer: true,
			timeout: 15000,
		},
		{
			command: 'npx vite --config vite.config.app.ts --port 5173',
			port: 5173,
			reuseExistingServer: true,
			timeout: 15000,
		},
	],
});
