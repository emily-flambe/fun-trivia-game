import { test, expect } from '@playwright/test';

test.describe('Quiz image support', () => {
	test('Learn mode shows flag images on cards', async ({ page }) => {
		await page.goto('/#/exercise/geography/flags/notable-features?mode=learn');

		// Wait for card images to load (not nav buttons)
		const images = page.locator('img[src*="flagcdn.com"]');
		await expect(images.first()).toBeVisible({ timeout: 10000 });

		const count = await images.count();
		expect(count).toBeGreaterThan(0);
	});

	test('Learn mode detail panel shows image when card selected', async ({ page }) => {
		await page.goto('/#/exercise/geography/flags/notable-features?mode=learn');

		// Wait for a card with a flag image, then click it
		const firstCard = page.locator('button').filter({ has: page.locator('img[src*="flagcdn.com"]') }).first();
		await expect(firstCard).toBeVisible({ timeout: 10000 });
		await firstCard.click();

		// Detail panel should show the image
		const detailImage = page.locator('.mt-4 img[src*="flagcdn.com"]');
		await expect(detailImage).toBeVisible({ timeout: 3000 });
	});

	test('Quiz mode shows flag image above prompt', async ({ page }) => {
		await page.goto('/#/exercise/geography/flags/notable-features?mode=quiz');
		await page.waitForSelector('input', { timeout: 10000 });

		const quizImage = page.locator('.bg-surface-raised img[src*="flagcdn.com"]');
		await expect(quizImage).toBeVisible({ timeout: 5000 });

		// Prompt text should also be visible (use specific class to avoid matching heading)
		const prompt = page.locator('.text-lg.mb-6');
		await expect(prompt).toBeVisible();
	});

	test('non-image exercises render without images', async ({ page }) => {
		await page.goto('/#/exercise/science/chemistry/element-symbols?mode=quiz');
		await page.waitForSelector('input', { timeout: 10000 });

		const images = page.locator('.bg-surface-raised img[src*="flagcdn.com"]');
		await expect(images).toHaveCount(0);
	});
});
