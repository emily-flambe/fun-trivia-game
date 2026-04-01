import { test, expect } from '@playwright/test';

test.describe('Sequence ordering quiz', () => {
	test('supports keyboard and button reordering, then shows partial scoring summary', async ({ page }) => {
		const exercisePath = 'world-history/timelines/major-20th-century-events';

		await page.route(`**/api/exercises/${exercisePath}`, async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					exercise: {
						id: exercisePath,
						nodeId: 'world-history/timelines',
						name: 'Major 20th Century Events',
						description: 'Order key events',
						format: 'sequence-ordering',
						config: {
							prompt: 'Arrange these events from earliest to latest',
							timed: false,
						},
						sortOrder: 0,
					},
					items: [
						{ id: 'ww1', exerciseId: exercisePath, explanation: '1914', data: { label: 'World War I begins' }, sortOrder: 0 },
						{ id: 'ww2', exerciseId: exercisePath, explanation: '1939', data: { label: 'World War II begins' }, sortOrder: 1 },
						{ id: 'moon', exerciseId: exercisePath, explanation: '1969', data: { label: 'Moon landing' }, sortOrder: 2 },
					],
				}),
			});
		});

		await page.route(`**/api/exercises/${exercisePath}/check`, async (route) => {
			const body = route.request().postDataJSON() as { order?: string[] };
			const order = body.order ?? [];
			const expected = ['ww1', 'ww2', 'moon'];
			const placements = expected.map((itemId, idx) => ({
				itemId,
				expectedPosition: idx + 1,
				userPosition: order.indexOf(itemId) + 1,
				correct: order[idx] === itemId,
			}));
			const correctCount = placements.filter((p) => p.correct).length;
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					valid: true,
					correct: correctCount === expected.length,
					correctCount,
					total: expected.length,
					placements,
				}),
			});
		});

		await page.route('**/api/quiz-results', async (route) => {
			await route.fulfill({
				status: 201,
				contentType: 'application/json',
				body: JSON.stringify({
					id: 'mock-result-id',
					exerciseId: exercisePath,
					exerciseName: 'Major 20th Century Events',
					format: 'sequence-ordering',
					score: 1,
					total: 3,
					durationSeconds: 12,
					completedAt: new Date().toISOString(),
					isRetry: false,
					parentResultId: null,
				}),
			});
		});

		await page.goto(`/#/exercise/${exercisePath}?mode=quiz`);
		await expect(page.getByText('Arrange these events from earliest to latest')).toBeVisible();

		const rows = page.locator('div.rounded-xl.border.border-border-subtle.bg-surface-bright');
		await expect(rows).toHaveCount(3);
		const firstRowBefore = await rows.nth(0).innerText();

		await rows.nth(0).locator('[tabindex="0"]').focus();
		await page.keyboard.press('ArrowDown');
		const firstRowAfterKeyboard = await rows.nth(0).innerText();
		expect(firstRowAfterKeyboard).not.toBe(firstRowBefore);

		await rows.nth(1).getByRole('button', { name: 'Up' }).click();
		const firstRowAfterButton = await rows.nth(0).innerText();
		expect(firstRowAfterButton).not.toBe(firstRowAfterKeyboard);

		await page.getByRole('button', { name: 'Check Order' }).click();
		await expect(page.getByText(/Score:\s*[0-3]\s*\/\s*3/)).toBeVisible();
	});
});
