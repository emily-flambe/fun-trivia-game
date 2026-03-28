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

test.describe('Quiz completion actions', () => {
	/** Skip through all items in a random-10 quiz to reach the summary screen. */
	async function completeQuizBySkipping(page: import('@playwright/test').Page) {
		await page.goto('/#/exercise/science/chemistry/element-symbols?mode=random-10');
		await page.waitForSelector('input', { timeout: 5000 });

		for (let i = 0; i < 10; i++) {
			const skipBtn = page.getByRole('button', { name: /skip/i });
			if (!await skipBtn.isVisible({ timeout: 1000 }).catch(() => false)) break;
			await skipBtn.click();
			const nextBtn = page.getByRole('button', { name: /next|see results/i });
			await nextBtn.waitFor({ timeout: 3000 });
			await nextBtn.click();
			await page.waitForTimeout(150);
		}

		// Wait for score summary (e.g. "0 / 10")
		await page.locator('text=/\\d+ \\/ \\d+/').first().waitFor({ timeout: 5000 });
	}

	test('shows Retake, Retake Failed Only, Next, and Home buttons', async ({ page }) => {
		await completeQuizBySkipping(page);

		await expect(page.getByRole('button', { name: 'Retake' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Retake Failed Only' })).toBeVisible();
		await expect(page.getByRole('main').getByRole('link', { name: 'Next' })).toBeVisible();
		await expect(page.getByRole('main').getByRole('link', { name: 'Home' })).toBeVisible();
	});

	test('Retake restarts the quiz', async ({ page }) => {
		await completeQuizBySkipping(page);
		await page.getByRole('button', { name: 'Retake' }).click();

		// Should be back in quiz mode with input visible
		await expect(page.locator('input')).toBeVisible({ timeout: 3000 });
		// Progress should show "1 / 10"
		await expect(page.locator('text=/1 \\/ 10/')).toBeVisible();
	});

	test('Retake Failed Only starts quiz with only missed items', async ({ page }) => {
		await completeQuizBySkipping(page);
		await page.getByRole('button', { name: 'Retake Failed Only' }).click();

		// Should be back in quiz mode
		await expect(page.locator('input')).toBeVisible({ timeout: 3000 });
		// All 10 were skipped, so retry should also have 10 items
		await expect(page.locator('text=/1 \\/ 10/')).toBeVisible();
	});

	test('Next navigates to the next exercise in the node', async ({ page }) => {
		await completeQuizBySkipping(page);
		await page.getByRole('main').getByRole('link', { name: 'Next' }).click();
		await page.waitForTimeout(500);

		// Should navigate away from element-symbols to another exercise or node
		expect(page.url()).not.toContain('element-symbols');
	});

	test('Home navigates to dashboard', async ({ page }) => {
		await completeQuizBySkipping(page);
		await page.getByRole('main').getByRole('link', { name: 'Home' }).click();
		await page.waitForTimeout(500);

		await expect(page.getByText('Categories')).toBeVisible();
	});
});
