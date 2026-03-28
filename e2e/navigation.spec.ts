import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
	test('dashboard loads with categories', async ({ page }) => {
		await page.goto('/');
		await page.waitForTimeout(1000);

		// Should show "Categories" heading
		await expect(page.getByText('Categories')).toBeVisible();

		// Should have category cards
		const cards = page.locator('a[href*="#/node/"]');
		const count = await cards.count();
		expect(count).toBeGreaterThan(0);
	});

	test('clicking a category navigates to node view', async ({ page }) => {
		await page.goto('/');
		await page.waitForTimeout(1000);

		// Click the first category
		await page.locator('a[href*="#/node/"]').first().click();
		await page.waitForTimeout(1000);

		// URL should contain #/node/
		expect(page.url()).toContain('#/node/');
	});

	test('random button navigates to an exercise', async ({ page }) => {
		await page.goto('/');
		await page.waitForTimeout(1000);

		await page.getByRole('button', { name: /random/i }).click();
		await page.waitForTimeout(1500);

		expect(page.url()).toContain('#/exercise/');
	});

	test('Trivia Trainer logo navigates to dashboard', async ({ page }) => {
		// Start on an exercise
		await page.goto('/#/exercise/science/chemistry/element-symbols?mode=learn');
		await page.waitForTimeout(1000);

		// Click logo
		await page.locator('a[href="#/"]').first().click();
		await page.waitForTimeout(500);

		await expect(page.getByText('Categories')).toBeVisible();
	});
});
