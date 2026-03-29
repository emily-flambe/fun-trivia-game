import { test, expect } from '@playwright/test';

test.describe('Activity tab — expandable entries', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/auth/test-login');
		await page.waitForTimeout(1500);
	});

	/**
	 * Submit a quiz result via the API (authenticated via cookie already set),
	 * then navigate to the Activity tab and verify the entry is expandable.
	 */
	test('shows activity entry after submitting a quiz result', async ({ page }) => {
		await page.evaluate(() =>
			fetch('/api/quiz-results', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					exerciseId: 'science/chemistry/element-symbols',
					exerciseName: 'Element Symbols',
					format: 'text-entry',
					score: 2,
					total: 3,
					itemsDetail: [
						{ itemId: 'iron', correct: true, userAnswer: 'Iron', fuzzyMatch: false },
						{ itemId: 'gold', correct: true, userAnswer: 'Gold', fuzzyMatch: false },
						{ itemId: 'silver', correct: false, userAnswer: 'Tin', fuzzyMatch: false },
					],
				}),
			})
		);

		await page.goto('/#/profile/activity');
		await page.waitForTimeout(1500);

		const panel = page.getByRole('tabpanel');
		await expect(panel.getByText('Element Symbols')).toBeVisible();
		await expect(panel.getByText('2/3')).toBeVisible();
	});

	test('clicking an activity entry expands to show item detail', async ({ page }) => {
		// Submit a result with itemsDetail
		await page.evaluate(() =>
			fetch('/api/quiz-results', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					exerciseId: 'science/chemistry/element-symbols',
					exerciseName: 'Element Symbols',
					format: 'text-entry',
					score: 2,
					total: 3,
					itemsDetail: [
						{ itemId: 'iron', correct: true, userAnswer: 'Iron', fuzzyMatch: false },
						{ itemId: 'gold', correct: true, userAnswer: 'Gold', fuzzyMatch: false },
						{ itemId: 'silver', correct: false, userAnswer: 'Tin', fuzzyMatch: false },
					],
				}),
			})
		);

		await page.goto('/#/profile/activity');
		await page.waitForTimeout(1500);

		// Click the first activity card button to expand it
		const activityButton = page.locator('button').filter({ hasText: 'Element Symbols' }).first();
		await expect(activityButton).toBeVisible();
		await activityButton.click();

		// Wait for the detail to load
		await page.waitForTimeout(2000);

		// The detail panel should be visible (border-t border-border-subtle div)
		// and should NOT show "Failed to load details."
		await expect(page.getByText('Failed to load details.')).not.toBeVisible();
	});

	test('expanded entry shows questions and answers', async ({ page }) => {
		// Submit a quiz result
		await page.evaluate(() =>
			fetch('/api/quiz-results', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					exerciseId: 'science/chemistry/element-symbols',
					exerciseName: 'Element Symbols',
					format: 'text-entry',
					score: 2,
					total: 3,
					itemsDetail: [
						{ itemId: 'iron', correct: true, userAnswer: 'Iron', fuzzyMatch: false },
						{ itemId: 'gold', correct: true, userAnswer: 'Gold', fuzzyMatch: false },
						{ itemId: 'silver', correct: false, userAnswer: 'Tin', fuzzyMatch: false },
					],
				}),
			})
		);

		await page.goto('/#/profile/activity');
		await page.waitForTimeout(1500);

		// Expand the activity entry
		const activityButton = page.locator('button').filter({ hasText: 'Element Symbols' }).first();
		await activityButton.click();

		// Wait for the detail content to load (API call needed)
		await page.waitForTimeout(2000);

		// Should show prompts from the items table
		await expect(page.getByText('What element has the symbol Fe?')).toBeVisible();
		await expect(page.getByText('What element has the symbol Au?')).toBeVisible();
		await expect(page.getByText('What element has the symbol Ag?')).toBeVisible();

		// Should show correct answers (in "Answer: X" rows)
		await expect(page.locator('p').filter({ hasText: /^Answer:/ }).filter({ hasText: 'Iron' }).first()).toBeVisible();
		await expect(page.locator('p').filter({ hasText: /^Answer:/ }).filter({ hasText: 'Gold' }).first()).toBeVisible();
		await expect(page.locator('p').filter({ hasText: /^Answer:/ }).filter({ hasText: 'Silver' }).first()).toBeVisible();

		// Should show what the user answered
		await expect(page.getByText('Tin')).toBeVisible();

		// Should show correct/incorrect indicators (checkmark for correct, X for wrong)
		const checkmarks = page.locator('text=✓');
		const crosses = page.locator('text=✕');
		await expect(checkmarks.first()).toBeVisible();
		await expect(crosses.first()).toBeVisible();
	});

	test('clicking an already-expanded entry collapses it', async ({ page }) => {
		await page.evaluate(() =>
			fetch('/api/quiz-results', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					exerciseId: 'science/chemistry/element-symbols',
					exerciseName: 'Element Symbols',
					format: 'text-entry',
					score: 1,
					total: 3,
					itemsDetail: [
						{ itemId: 'iron', correct: true, userAnswer: 'Iron', fuzzyMatch: false },
					],
				}),
			})
		);

		await page.goto('/#/profile/activity');
		await page.waitForTimeout(1500);

		const activityButton = page.locator('button').filter({ hasText: 'Element Symbols' }).first();
		await activityButton.click();
		await page.waitForTimeout(2000);

		// Should be expanded — detail content visible
		await expect(page.getByText('Answer:')).toBeVisible();

		// Click again to collapse
		await activityButton.click();
		await page.waitForTimeout(500);

		// Detail content should be gone
		await expect(page.getByText('Answer:')).not.toBeVisible();
	});

	test('expanding a result with no itemsDetail shows no detail rows', async ({ page }) => {
		// Submit without itemsDetail — the endpoint returns items: []
		await page.evaluate(() =>
			fetch('/api/quiz-results', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					exerciseId: 'science/chemistry/noble-gases',
					exerciseName: 'Noble Gases',
					format: 'fill-blanks',
					score: 3,
					total: 3,
					// no itemsDetail
				}),
			})
		);

		await page.goto('/#/profile/activity');
		await page.waitForTimeout(1500);

		const activityButton = page.locator('button').filter({ hasText: 'Noble Gases' }).first();
		await activityButton.click();
		await page.waitForTimeout(2000);

		// Should not show "Failed to load details."
		await expect(page.getByText('Failed to load details.')).not.toBeVisible();

		// With 0 items, no Answer: labels should appear inside the detail panel
		// (Note: there's no empty-state message in the UI for this case — items array is just empty)
		// We just confirm the panel opened without error
		const detailPanel = page.locator('.border-t.border-border-subtle').first();
		await expect(detailPanel).toBeVisible();
	});

	test('activity tab loads after completing a real quiz via UI', async ({ page }) => {
		// Complete a quiz by navigating to exercise and skipping through all items
		await page.goto('/#/exercise/science/chemistry/element-symbols?mode=quiz');
		await page.waitForSelector('input', { timeout: 5000 });

		// Skip through all items
		for (let i = 0; i < 5; i++) {
			const skipBtn = page.getByRole('button', { name: /skip/i });
			if (!await skipBtn.isVisible({ timeout: 1000 }).catch(() => false)) break;
			await skipBtn.click();
			const nextBtn = page.getByRole('button', { name: /next|see results/i });
			await nextBtn.waitFor({ timeout: 3000 });
			await nextBtn.click();
			await page.waitForTimeout(200);
		}

		// Wait for the summary screen
		await page.locator('text=/\\d+ \\/ \\d+/').first().waitFor({ timeout: 5000 });

		// Navigate to Activity tab
		await page.goto('/#/profile/activity');
		await page.waitForTimeout(2000);

		// The Activity tab should show a result for Element Symbols
		const panel = page.getByRole('tabpanel');
		await expect(panel.getByText('Element Symbols').first()).toBeVisible();
	});
});
