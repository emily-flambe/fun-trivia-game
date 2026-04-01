import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:8787';
const TEST_EMAIL = 'test@trivia.emilycogsdill.com';
const ADMIN_HEADERS = {
	'Content-Type': 'application/json',
	Cookie: `CF_Test_Auth=${TEST_EMAIL}`,
};

const EXERCISE_PATH = 'test-seq/timelines/ordering-test';

async function adminPost(path: string, body: Record<string, unknown>) {
	const res = await fetch(`${BASE}${path}`, {
		method: 'POST',
		headers: ADMIN_HEADERS,
		body: JSON.stringify(body),
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`POST ${path} failed (${res.status}): ${text}`);
	}
	return res.json();
}

async function adminDelete(path: string) {
	const res = await fetch(`${BASE}${path}`, {
		method: 'DELETE',
		headers: ADMIN_HEADERS,
	});
	// Ignore 404 — resource may not exist yet
	if (!res.ok && res.status !== 404) {
		const text = await res.text();
		throw new Error(`DELETE ${path} failed (${res.status}): ${text}`);
	}
}

test.describe('Sequence ordering quiz', () => {
	test.beforeAll(async () => {
		// Clean up any leftover data from a previous run
		await adminDelete(`/api/admin/exercises/${EXERCISE_PATH}`);

		// Create parent nodes
		await adminPost('/api/admin/nodes', { id: 'test-seq', name: 'Test Sequence', parentId: null });
		await adminPost('/api/admin/nodes', { id: 'test-seq/timelines', name: 'Timelines', parentId: 'test-seq' });

		// Create exercise with items
		await adminPost('/api/admin/exercises', {
			id: EXERCISE_PATH,
			nodeId: 'test-seq/timelines',
			name: 'Test Ordering',
			format: 'sequence-ordering',
			config: { prompt: 'Arrange from earliest to latest' },
			sortOrder: 0,
			items: [
				{ id: 'item-a', answer: 'First', explanation: 'This is first', data: { label: 'Event A (1900)' }, sortOrder: 0 },
				{ id: 'item-b', answer: 'Second', explanation: 'This is second', data: { label: 'Event B (1950)' }, sortOrder: 1 },
				{ id: 'item-c', answer: 'Third', explanation: 'This is third', data: { label: 'Event C (2000)' }, sortOrder: 2 },
			],
		});
	});

	test.afterAll(async () => {
		await adminDelete(`/api/admin/exercises/${EXERCISE_PATH}`);
	});

	test('quiz loads with prompt and draggable items', async ({ page }) => {
		await page.goto(`/#/exercise/${EXERCISE_PATH}?mode=quiz`);

		// Prompt text is visible
		await expect(page.getByText('Arrange from earliest to latest')).toBeVisible({ timeout: 10000 });

		// All 3 items are rendered with their labels
		await expect(page.getByText('Event A (1900)')).toBeVisible();
		await expect(page.getByText('Event B (1950)')).toBeVisible();
		await expect(page.getByText('Event C (2000)')).toBeVisible();

		// 3 item rows exist
		const rows = page.locator('div.rounded-xl.border.border-border-subtle.bg-surface-bright');
		await expect(rows).toHaveCount(3);

		// Check Order button is visible
		await expect(page.getByRole('button', { name: 'Check Order' })).toBeVisible();
	});

	test('Up/Down buttons reorder items', async ({ page }) => {
		await page.goto(`/#/exercise/${EXERCISE_PATH}?mode=quiz`);
		await expect(page.getByText('Arrange from earliest to latest')).toBeVisible({ timeout: 10000 });

		const rows = page.locator('div.rounded-xl.border.border-border-subtle.bg-surface-bright');
		await expect(rows).toHaveCount(3);

		// Record the initial label of the second row
		const secondRowTextBefore = await rows.nth(1).innerText();

		// Click the Up button on the second row — it should move to first position
		await rows.nth(1).getByRole('button', { name: 'Up' }).click();

		// The first row should now contain the text that was in the second row
		const firstRowTextAfter = await rows.nth(0).innerText();
		expect(firstRowTextAfter).toContain(secondRowTextBefore.replace(/#\d/, '').trim().split('\n')[0]);

		// Click the Down button on the first row — it should swap back
		await rows.nth(0).getByRole('button', { name: 'Down' }).click();
		const secondRowTextAfter = await rows.nth(1).innerText();
		// The label should be back in second position
		expect(secondRowTextAfter).toBe(firstRowTextAfter.replace('#1', '#2'));
	});

	test('keyboard arrow keys reorder items', async ({ page }) => {
		await page.goto(`/#/exercise/${EXERCISE_PATH}?mode=quiz`);
		await expect(page.getByText('Arrange from earliest to latest')).toBeVisible({ timeout: 10000 });

		const rows = page.locator('div.rounded-xl.border.border-border-subtle.bg-surface-bright');
		await expect(rows).toHaveCount(3);

		const firstRowTextBefore = await rows.nth(0).innerText();

		// Focus the first row's focusable element and press ArrowDown
		await rows.nth(0).locator('[tabindex="0"]').focus();
		await page.keyboard.press('ArrowDown');

		// The first row should now have different content
		const firstRowTextAfter = await rows.nth(0).innerText();
		expect(firstRowTextAfter).not.toBe(firstRowTextBefore);
	});

	test('correct ordering shows perfect score', async ({ page }) => {
		await page.goto(`/#/exercise/${EXERCISE_PATH}?mode=quiz`);
		await expect(page.getByText('Arrange from earliest to latest')).toBeVisible({ timeout: 10000 });

		const rows = page.locator('div.rounded-xl.border.border-border-subtle.bg-surface-bright');
		await expect(rows).toHaveCount(3);

		// We need to arrange items as item-a, item-b, item-c (sortOrder 0, 1, 2).
		// The quiz shuffles them, so we need to sort them into the correct order.
		// Strategy: read labels, then use Up buttons to bubble each item to its correct position.

		// Get the current order of labels
		async function getCurrentLabels() {
			const labels: string[] = [];
			for (let i = 0; i < 3; i++) {
				const text = await rows.nth(i).locator('.font-medium.truncate').innerText();
				labels.push(text);
			}
			return labels;
		}

		const correctOrder = ['Event A (1900)', 'Event B (1950)', 'Event C (2000)'];

		// Simple bubble sort using Up buttons: for each position, move the correct item up
		for (let targetIdx = 0; targetIdx < 3; targetIdx++) {
			let labels = await getCurrentLabels();
			const currentIdx = labels.indexOf(correctOrder[targetIdx]);
			// Click Up on the item until it reaches targetIdx
			for (let j = currentIdx; j > targetIdx; j--) {
				await rows.nth(j).getByRole('button', { name: 'Up' }).click();
				await page.waitForTimeout(100);
			}
		}

		// Verify order is correct
		const finalLabels = await getCurrentLabels();
		expect(finalLabels).toEqual(correctOrder);

		// Submit
		await page.getByRole('button', { name: 'Check Order' }).click();

		// Should show "Perfect order!"
		await expect(page.getByText('Perfect order!')).toBeVisible({ timeout: 5000 });
	});

	test('incorrect ordering shows partial score with placement details', async ({ page }) => {
		await page.goto(`/#/exercise/${EXERCISE_PATH}?mode=quiz`);
		await expect(page.getByText('Arrange from earliest to latest')).toBeVisible({ timeout: 10000 });

		const rows = page.locator('div.rounded-xl.border.border-border-subtle.bg-surface-bright');
		await expect(rows).toHaveCount(3);

		// Put items in reverse order: C, B, A
		const reverseOrder = ['Event C (2000)', 'Event B (1950)', 'Event A (1900)'];

		async function getCurrentLabels() {
			const labels: string[] = [];
			for (let i = 0; i < 3; i++) {
				const text = await rows.nth(i).locator('.font-medium.truncate').innerText();
				labels.push(text);
			}
			return labels;
		}

		for (let targetIdx = 0; targetIdx < 3; targetIdx++) {
			let labels = await getCurrentLabels();
			const currentIdx = labels.indexOf(reverseOrder[targetIdx]);
			for (let j = currentIdx; j > targetIdx; j--) {
				await rows.nth(j).getByRole('button', { name: 'Up' }).click();
				await page.waitForTimeout(100);
			}
		}

		const finalLabels = await getCurrentLabels();
		expect(finalLabels).toEqual(reverseOrder);

		// Submit
		await page.getByRole('button', { name: 'Check Order' }).click();

		// Should show a score like "Score: X / 3" (not perfect)
		await expect(page.getByText(/Score:\s*\d+\s*\/\s*3/)).toBeVisible({ timeout: 5000 });

		// Should show placement details for incorrect items (multiple may exist, check first)
		await expect(page.getByText(/you placed #\d+, correct is #\d+/).first()).toBeVisible();
	});

	test('retake button resets the quiz', async ({ page }) => {
		await page.goto(`/#/exercise/${EXERCISE_PATH}?mode=quiz`);
		await expect(page.getByText('Arrange from earliest to latest')).toBeVisible({ timeout: 10000 });

		// Submit immediately (whatever order the shuffle gave us)
		await page.getByRole('button', { name: 'Check Order' }).click();

		// Wait for results to appear
		await expect(page.getByText(/Score:|Perfect order!/)).toBeVisible({ timeout: 5000 });

		// Click Retake
		await page.getByRole('button', { name: 'Retake' }).click();

		// Quiz should reset: Check Order button visible again, no results
		await expect(page.getByRole('button', { name: 'Check Order' })).toBeVisible({ timeout: 5000 });
		await expect(page.getByText(/Score:|Perfect order!/)).not.toBeVisible();
	});
});

test.describe('Sequence ordering learn mode', () => {
	test.beforeAll(async () => {
		// Clean up any leftover data from a previous run
		await adminDelete(`/api/admin/exercises/${EXERCISE_PATH}`);

		// Create parent nodes (idempotent upsert)
		await adminPost('/api/admin/nodes', { id: 'test-seq', name: 'Test Sequence', parentId: null });
		await adminPost('/api/admin/nodes', { id: 'test-seq/timelines', name: 'Timelines', parentId: 'test-seq' });

		// Create exercise with items
		await adminPost('/api/admin/exercises', {
			id: EXERCISE_PATH,
			nodeId: 'test-seq/timelines',
			name: 'Test Ordering',
			format: 'sequence-ordering',
			config: { prompt: 'Arrange from earliest to latest' },
			sortOrder: 0,
			items: [
				{ id: 'item-a', answer: 'First', explanation: 'This is first', data: { label: 'Event A (1900)' }, sortOrder: 0 },
				{ id: 'item-b', answer: 'Second', explanation: 'This is second', data: { label: 'Event B (1950)' }, sortOrder: 1 },
				{ id: 'item-c', answer: 'Third', explanation: 'This is third', data: { label: 'Event C (2000)' }, sortOrder: 2 },
			],
		});
	});

	test.afterAll(async () => {
		await adminDelete(`/api/admin/exercises/${EXERCISE_PATH}`);
	});

	test('learn mode shows items in correct order sorted by sortOrder', async ({ page }) => {
		await page.goto(`/#/exercise/${EXERCISE_PATH}?mode=learn`);

		// Exercise name is visible
		await expect(page.getByText('Test Ordering')).toBeVisible({ timeout: 10000 });

		// Items should appear in sortOrder: A, B, C
		const items = page.locator('button.w-full.text-left.rounded-xl');
		await expect(items).toHaveCount(3);

		// Verify correct order by checking labels
		await expect(items.nth(0).locator('.font-medium')).toHaveText('Event A (1900)');
		await expect(items.nth(1).locator('.font-medium')).toHaveText('Event B (1950)');
		await expect(items.nth(2).locator('.font-medium')).toHaveText('Event C (2000)');
	});

	test('learn mode shows numbered positions', async ({ page }) => {
		await page.goto(`/#/exercise/${EXERCISE_PATH}?mode=learn`);
		await expect(page.getByText('Test Ordering')).toBeVisible({ timeout: 10000 });

		const items = page.locator('button.w-full.text-left.rounded-xl');
		await expect(items).toHaveCount(3);

		// Each item should show a 1-based position number
		await expect(items.nth(0).locator('.text-accent')).toHaveText('1');
		await expect(items.nth(1).locator('.text-accent')).toHaveText('2');
		await expect(items.nth(2).locator('.text-accent')).toHaveText('3');
	});

	test('items are expandable to show explanation', async ({ page }) => {
		await page.goto(`/#/exercise/${EXERCISE_PATH}?mode=learn`);
		await expect(page.getByText('Test Ordering')).toBeVisible({ timeout: 10000 });

		const items = page.locator('button.w-full.text-left.rounded-xl');
		await expect(items).toHaveCount(3);

		// Explanation should not be visible initially
		await expect(page.getByText('This is first')).not.toBeVisible();

		// Click first item to expand
		await items.nth(0).click();
		await expect(page.getByText('This is first')).toBeVisible();

		// Click again to collapse
		await items.nth(0).click();
		await expect(page.getByText('This is first')).not.toBeVisible();

		// Click second item — only its explanation should show
		await items.nth(1).click();
		await expect(page.getByText('This is second')).toBeVisible();
		await expect(page.getByText('This is first')).not.toBeVisible();
	});

	test('Quiz Me button navigates to quiz mode', async ({ page }) => {
		await page.goto(`/#/exercise/${EXERCISE_PATH}?mode=learn`);
		await expect(page.getByText('Test Ordering')).toBeVisible({ timeout: 10000 });

		// Click "Quiz Me"
		await page.getByRole('link', { name: 'Quiz Me' }).click();

		// Should navigate to quiz mode — Check Order button should appear
		await expect(page.getByRole('button', { name: 'Check Order' })).toBeVisible({ timeout: 10000 });
	});

	test('back arrow navigates to parent node', async ({ page }) => {
		await page.goto(`/#/exercise/${EXERCISE_PATH}?mode=learn`);
		await expect(page.getByText('Test Ordering')).toBeVisible({ timeout: 10000 });

		// The back arrow links to the parent node
		const backLink = page.locator('a').filter({ hasText: '\u2190' });
		await expect(backLink).toBeVisible();

		// Verify the href points to the parent node
		const href = await backLink.getAttribute('href');
		expect(href).toBe('#/node/test-seq/timelines');

		// Click it and verify navigation
		await backLink.click();
		await expect(page.getByText('Timelines')).toBeVisible({ timeout: 10000 });
	});
});
