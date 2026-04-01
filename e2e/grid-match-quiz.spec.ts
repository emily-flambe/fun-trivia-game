import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:8787';
const TEST_EMAIL = 'test@trivia.emilycogsdill.com';

async function adminPost(path: string, body: unknown) {
	return fetch(`${BASE}/api/admin${path}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Cookie': `CF_Test_Auth=${TEST_EMAIL}`,
		},
		body: JSON.stringify(body),
	});
}

test.describe('Grid Match quiz format', () => {
	const exerciseUrl = '/#/exercise/american-history/presidents/intersection-grid?mode=quiz';

	test.beforeAll(async () => {
		// Seed parent nodes (upsert — safe to re-run)
		await adminPost('/nodes', { id: 'american-history', name: 'American History' });
		await adminPost('/nodes', { id: 'american-history/presidents', parentId: 'american-history', name: 'U.S. Presidents' });

		// Seed grid-match exercise with items
		const res = await adminPost('/exercises', {
			id: 'american-history/presidents/intersection-grid',
			nodeId: 'american-history/presidents',
			name: 'Presidents Grid Match',
			description: 'Match presidents to attributes',
			format: 'grid-match',
			config: {
				rows: ['Washington', 'Lincoln'],
				columns: ['Party', 'Home State'],
				prompt: 'Fill in each cell',
			},
			sortOrder: 0,
			items: [
				{ id: 'wash-party', answer: 'Unaffiliated', alternates: ['Independent'], explanation: 'First president.', data: { row: 'Washington', column: 'Party' }, sortOrder: 0 },
				{ id: 'wash-state', answer: 'Virginia', alternates: ['VA'], explanation: 'Mount Vernon.', data: { row: 'Washington', column: 'Home State' }, sortOrder: 1 },
				{ id: 'linc-party', answer: 'Republican', alternates: ['GOP'], explanation: '16th president.', data: { row: 'Lincoln', column: 'Party' }, sortOrder: 2 },
				{ id: 'linc-state', answer: 'Illinois', alternates: ['IL'], explanation: 'Land of Lincoln.', data: { row: 'Lincoln', column: 'Home State' }, sortOrder: 3 },
			],
		});
		if (!res.ok) {
			const text = await res.text();
			// Exercise may already exist from a prior run — that's ok
			if (!text.includes('UNIQUE constraint')) {
				throw new Error(`Failed to seed exercise: ${res.status} ${text}`);
			}
		}
	});

	test('renders grid with row and column headers', async ({ page }) => {
		await page.goto(exerciseUrl);
		await page.waitForSelector('table', { timeout: 10000 });

		// Column headers
		await expect(page.locator('th:has-text("Party")')).toBeVisible();
		await expect(page.locator('th:has-text("Home State")')).toBeVisible();

		// Row headers
		await expect(page.locator('td:has-text("Washington")')).toBeVisible();
		await expect(page.locator('td:has-text("Lincoln")')).toBeVisible();
	});

	test('shows input cells for each grid position', async ({ page }) => {
		await page.goto(exerciseUrl);
		await page.waitForSelector('table', { timeout: 10000 });

		// 2 rows x 2 columns = 4 input cells
		const inputs = page.locator('table input');
		await expect(inputs).toHaveCount(4);
	});

	test('correct answer turns cell green', async ({ page }) => {
		await page.goto(exerciseUrl);
		await page.waitForSelector('table', { timeout: 10000 });

		const firstInput = page.locator('table input').first();
		await firstInput.fill('Unaffiliated');
		await firstInput.press('Enter');

		// Cell should show correct answer text
		const correctCell = page.locator('td:has-text("Unaffiliated")');
		await expect(correctCell).toBeVisible({ timeout: 5000 });
	});

	test('wrong answer shows correct answer in cell', async ({ page }) => {
		await page.goto(exerciseUrl);
		await page.waitForSelector('table', { timeout: 10000 });

		const firstInput = page.locator('table input').first();
		await firstInput.fill('Democrat');
		await firstInput.press('Enter');

		// Should reveal the correct answer
		const correctAnswer = page.locator('td:has-text("Unaffiliated")');
		await expect(correctAnswer).toBeVisible({ timeout: 5000 });
	});

	test('give up reveals all answers and shows completion', async ({ page }) => {
		await page.goto(exerciseUrl);
		await page.waitForSelector('table', { timeout: 10000 });

		const giveUpBtn = page.getByRole('button', { name: /give up/i });
		await expect(giveUpBtn).toBeVisible();
		await giveUpBtn.click();

		// Should show score summary after completion
		await page.locator('text=/\\d+ \\/ \\d+/').first().waitFor({ timeout: 15000 });
	});

	test('progress counter updates as cells are answered', async ({ page }) => {
		await page.goto(exerciseUrl);
		await page.waitForSelector('table', { timeout: 10000 });

		// Initial state: 0 / 4
		await expect(page.locator('text=/0 \\/ 4/')).toBeVisible();

		// Answer one cell
		const firstInput = page.locator('table input').first();
		await firstInput.fill('Unaffiliated');
		await firstInput.press('Enter');
		await page.waitForTimeout(500);

		// Progress should update to 1 / 4
		await expect(page.locator('text=/1 \\/ 4/')).toBeVisible({ timeout: 5000 });
	});

	test('exercise is accessible from navigation', async ({ page }) => {
		await page.goto('/#/node/american-history/presidents');
		await page.waitForTimeout(2000);

		// Exercise name shown as heading
		await expect(page.getByRole('heading', { name: 'Presidents Grid Match' })).toBeVisible({ timeout: 5000 });

		// Click the Quiz link for this exercise (in the main content area)
		const quizLink = page.getByRole('main').getByRole('link', { name: 'Quiz' });
		await expect(quizLink).toBeVisible();
		await quizLink.click();
		await page.waitForTimeout(1000);

		expect(page.url()).toContain('intersection-grid');
		// Should load the grid
		await page.waitForSelector('table', { timeout: 10000 });
	});
});
