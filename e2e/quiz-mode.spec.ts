import { test, expect } from '@playwright/test';

test.describe('Quiz mode (text-entry)', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/#/exercise/science/chemistry/element-symbols?mode=quiz');
		await page.waitForSelector('input', { timeout: 5000 });
	});

	test('shows quiz interface with input and submit button', async ({ page }) => {
		const input = page.locator('input');
		await expect(input).toBeVisible();

		const submit = page.getByRole('button', { name: /submit|check/i });
		await expect(submit).toBeVisible();
	});

	test('submitting wrong answer shows incorrect feedback', async ({ page }) => {
		await page.locator('input').fill('xyznonexistent');
		await page.getByRole('button', { name: /submit|check/i }).click();

		const feedback = page.locator('[class*="incorrect"]').first();
		await expect(feedback).toBeVisible({ timeout: 5000 });
	});

	test('skip/reveal shows the correct answer', async ({ page }) => {
		const skipButton = page.getByRole('button', { name: /skip|reveal/i });
		if (await skipButton.isVisible()) {
			await skipButton.click();
			await page.waitForTimeout(500);

			// Next button should appear
			const nextButton = page.getByRole('button', { name: /next|see results/i });
			await expect(nextButton).toBeVisible({ timeout: 5000 });
		}
	});
});
