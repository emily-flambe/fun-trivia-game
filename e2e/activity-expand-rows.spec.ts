import { test, expect } from '@playwright/test';

/**
 * Tests for expandable question rows within ActivityDetail.
 * These rows are INSIDE an already-expanded activity card.
 */
test.describe('Activity detail — expandable question rows', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/auth/test-login');
		await page.waitForTimeout(1500);

		// Submit a quiz result for constitutional amendments (exercise has long prompts)
		await page.evaluate(() =>
			fetch('/api/quiz-results', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					exerciseId: 'american-history/amendments/constitutional-amendments',
					exerciseName: 'Constitutional Amendments',
					format: 'text-entry',
					score: 1,
					total: 2,
					itemsDetail: [
						{ itemId: 'amendment-1', correct: true, userAnswer: 'First', fuzzyMatch: false },
						{ itemId: 'amendment-3', correct: false, userAnswer: 'Second', fuzzyMatch: false },
					],
				}),
			})
		);

		await page.goto('/#/profile/activity');
		await page.waitForTimeout(1500);

		// Expand the activity card to reveal item rows
		const activityButton = page
			.locator('button')
			.filter({ hasText: 'Constitutional Amendments' })
			.first();
		await expect(activityButton).toBeVisible();
		await activityButton.click();
		await page.waitForTimeout(2000);
	});

	test('item rows are truncated by default', async ({ page }) => {
		// The first item row prompt should have the `truncate` class when collapsed
		const firstPrompt = page
			.locator('p.truncate')
			.filter({ hasText: /Which amendment protects freedom/ })
			.first();
		await expect(firstPrompt).toBeVisible();
	});

	test('clicking a row expands it to show full text', async ({ page }) => {
		// Locate the row div containing the first prompt
		const row = page
			.locator('div.cursor-pointer')
			.filter({ hasText: /Which amendment protects freedom/ })
			.first();
		await expect(row).toBeVisible();

		// Before clicking: prompt is truncated
		const promptBefore = row.locator('p').first();
		await expect(promptBefore).toHaveClass(/truncate/);

		// Click the row to expand
		await row.click();
		await page.waitForTimeout(300);

		// After clicking: truncate class should be gone
		await expect(promptBefore).not.toHaveClass(/truncate/);

		// Full prompt text should be rendered (not clipped by CSS)
		await expect(row.getByText('Which amendment protects freedom of religion, speech, press, assembly, and petition?')).toBeVisible();
	});

	test('clicking an expanded row collapses it', async ({ page }) => {
		const row = page
			.locator('div.cursor-pointer')
			.filter({ hasText: /Which amendment protects freedom/ })
			.first();

		// Expand
		await row.click();
		await page.waitForTimeout(300);
		const prompt = row.locator('p').first();
		await expect(prompt).not.toHaveClass(/truncate/);

		// Collapse
		await row.click();
		await page.waitForTimeout(300);
		await expect(prompt).toHaveClass(/truncate/);
	});

	test('multiple rows can be expanded independently', async ({ page }) => {
		const rows = page.locator('div.cursor-pointer').filter({ hasText: /Which amendment/ });
		const row1 = rows.nth(0);
		const row2 = rows.nth(1);

		// Expand first row only
		await row1.click();
		await page.waitForTimeout(300);

		// First row is expanded, second is still collapsed
		await expect(row1.locator('p').first()).not.toHaveClass(/truncate/);
		await expect(row2.locator('p').first()).toHaveClass(/truncate/);

		// Expand second row too
		await row2.click();
		await page.waitForTimeout(300);

		// Both are now expanded
		await expect(row1.locator('p').first()).not.toHaveClass(/truncate/);
		await expect(row2.locator('p').first()).not.toHaveClass(/truncate/);
	});

	test('chevron indicator changes direction when row is expanded', async ({ page }) => {
		const row = page
			.locator('div.cursor-pointer')
			.filter({ hasText: /Which amendment protects freedom/ })
			.first();

		// Collapsed state shows right-pointing chevron
		await expect(row.getByText('▶')).toBeVisible();
		await expect(row.getByText('▼')).not.toBeVisible();

		// After expanding: down-pointing chevron
		await row.click();
		await page.waitForTimeout(300);
		await expect(row.getByText('▼')).toBeVisible();
		await expect(row.getByText('▶')).not.toBeVisible();
	});
});
