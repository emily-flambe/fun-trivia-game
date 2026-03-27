import { test, expect } from '@playwright/test';

test.describe('Quiz mode', () => {
	test.beforeEach(async ({ page }) => {
		// Navigate to a quiz with known questions
		await page.goto('/#/quiz/geo-us-state-capitals?mode=quiz');
		// Wait for quiz to load
		await page.waitForSelector('form');
	});

	test('shows a "Give up" button alongside the answer input', async ({ page }) => {
		const giveUpButton = page.getByRole('button', { name: /give up/i });
		await expect(giveUpButton).toBeVisible();
	});

	test('clicking "Give up" reveals the correct answer without submitting', async ({ page }) => {
		// Get the question text before giving up
		const questionText = await page.locator('.text-lg, .text-xl').first().textContent();
		expect(questionText).toBeTruthy();

		// Click give up
		await page.getByRole('button', { name: /give up/i }).click();

		// Should show the correct answer (not "Incorrect — the answer is" with empty text)
		const resultBox = page.locator('[class*="correct-bg"], [class*="incorrect-bg"]');
		await expect(resultBox).toBeVisible();

		// The correct answer text should be non-empty
		const correctAnswer = resultBox.locator('[class*="text-correct"], [class*="text-text-primary"]').first();
		const answerText = await correctAnswer.textContent();
		expect(answerText).toBeTruthy();
		expect(answerText!.trim().length).toBeGreaterThan(0);

		// Should show a Next button to proceed
		await expect(page.getByRole('button', { name: /next|see results/i })).toBeVisible();
	});

	test('submitting a wrong answer shows the correct answer text', async ({ page }) => {
		// Type a deliberately wrong answer
		await page.getByPlaceholder(/type your answer/i).fill('xyznonexistent');
		await page.getByRole('button', { name: /submit/i }).click();

		// Wait for result to appear
		const resultBox = page.locator('[class*="incorrect-bg"]');
		await expect(resultBox).toBeVisible({ timeout: 5000 });

		// Get the full text of the result
		const resultText = await resultBox.textContent();

		// Should contain "Incorrect" and a non-empty correct answer
		expect(resultText).toContain('Incorrect');

		// The correct answer should be visible and non-empty
		// Look for text after "the answer is" — it should not end there
		expect(resultText).toMatch(/the answer is\s+\S/);
	});

	test('wrong answer result shows the actual correct answer string', async ({ page }) => {
		// Type wrong answer
		await page.getByPlaceholder(/type your answer/i).fill('xyznonexistent');
		await page.getByRole('button', { name: /submit/i }).click();

		// Wait for result
		await page.locator('[class*="incorrect-bg"]').waitFor({ timeout: 5000 });

		// The correct answer span should have visible text content
		const correctAnswerSpan = page.locator('[class*="incorrect-bg"] span[class*="text-text-primary"]');
		await expect(correctAnswerSpan).toBeVisible();
		const text = await correctAnswerSpan.textContent();
		expect(text).toBeTruthy();
		expect(text!.trim().length).toBeGreaterThan(0);
	});
});
