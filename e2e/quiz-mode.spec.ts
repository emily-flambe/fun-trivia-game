import { test, expect } from '@playwright/test';

test.describe('Quiz mode', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/#/quiz/geo-us-state-capitals?mode=quiz');
		await page.waitForSelector('form');
	});

	test('shows a skip/reveal button alongside the answer input', async ({ page }) => {
		const skipButton = page.getByRole('button', { name: /skip.*reveal/i });
		await expect(skipButton).toBeVisible();
	});

	test('clicking skip reveals the correct answer without submitting', async ({ page }) => {
		await page.getByRole('button', { name: /skip.*reveal/i }).click();

		const resultBox = page.locator('[class*="correct-bg"], [class*="incorrect-bg"]');
		await expect(resultBox).toBeVisible({ timeout: 5000 });

		const correctAnswer = resultBox.locator('[class*="text-correct"], [class*="text-text-primary"]').first();
		const answerText = await correctAnswer.textContent();
		expect(answerText).toBeTruthy();
		expect(answerText!.trim().length).toBeGreaterThan(0);

		await expect(page.getByRole('button', { name: /next|see results/i })).toBeVisible();
	});

	test('submitting a wrong answer shows the correct answer text', async ({ page }) => {
		await page.getByPlaceholder(/type your answer/i).fill('xyznonexistent');
		await page.getByRole('button', { name: /submit/i }).click();

		const resultBox = page.locator('div[class*="incorrect-bg"][class*="border"]');
		await expect(resultBox).toBeVisible({ timeout: 5000 });

		const resultText = await resultBox.textContent();
		expect(resultText).toContain('Incorrect');
		expect(resultText).toMatch(/the answer is\s+\S/);
	});

	test('wrong answer result shows the actual correct answer string', async ({ page }) => {
		await page.getByPlaceholder(/type your answer/i).fill('xyznonexistent');
		await page.getByRole('button', { name: /submit/i }).click();

		await page.locator('[class*="incorrect-bg"]').waitFor({ timeout: 5000 });

		const correctAnswerSpan = page.locator('[class*="incorrect-bg"] span[class*="text-text-primary"]');
		await expect(correctAnswerSpan).toBeVisible();
		const text = await correctAnswerSpan.textContent();
		expect(text).toBeTruthy();
		expect(text!.trim().length).toBeGreaterThan(0);
	});
});
