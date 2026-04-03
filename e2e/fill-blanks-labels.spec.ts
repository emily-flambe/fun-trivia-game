import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:8787';
const TEST_EMAIL = 'test@trivia.emilycogsdill.com';
const ADMIN_HEADERS = {
	'Content-Type': 'application/json',
	Cookie: `CF_Test_Auth=${TEST_EMAIL}`,
};

const EXERCISE_PATH = 'test-fill/labels/nato-style-labels';

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
	if (!res.ok && res.status !== 404) {
		const text = await res.text();
		throw new Error(`DELETE ${path} failed (${res.status}): ${text}`);
	}
}

test.describe('Fill-blanks labeled slots', () => {
	test.beforeAll(async () => {
		await adminDelete(`/api/admin/exercises/${EXERCISE_PATH}`);
		await adminPost('/api/admin/nodes', { id: 'test-fill', name: 'Test Fill', parentId: null });
		await adminPost('/api/admin/nodes', { id: 'test-fill/labels', name: 'Labels', parentId: 'test-fill' });
		await adminPost('/api/admin/exercises', {
			id: EXERCISE_PATH,
			nodeId: 'test-fill/labels',
			name: 'NATO-style labels',
			format: 'fill-blanks',
			config: { ordered: true, prompt: 'Match each letter to its NATO word' },
			sortOrder: 0,
			items: [
				{ id: 'a', answer: 'Alfa', explanation: 'A in NATO alphabet.', data: { label: 'A' }, sortOrder: 0 },
				{ id: 'b', answer: 'Bravo', explanation: 'B in NATO alphabet.', data: { label: 'B' }, sortOrder: 1 },
				{ id: 'c', answer: 'Charlie', explanation: 'C in NATO alphabet.', data: { label: 'C' }, sortOrder: 2 },
				{ id: 'd', answer: 'Delta', explanation: 'D in NATO alphabet.', data: { label: 'D' }, sortOrder: 3 },
			],
		});
	});

	test.afterAll(async () => {
		await adminDelete(`/api/admin/exercises/${EXERCISE_PATH}`);
	});

	test('shows per-slot labels instead of only numeric placeholders', async ({ page }) => {
		await page.goto(`/#/exercise/${EXERCISE_PATH}?mode=quiz`);
		await expect(page.getByText('Match each letter to its NATO word')).toBeVisible({ timeout: 10000 });

		const slots = page.locator('div.rounded-xl.p-3.min-h-\\[60px\\]');
		await expect(slots).toHaveCount(4);

		await expect(slots.nth(0)).toContainText('A');
		await expect(slots.nth(1)).toContainText('B');
		await expect(slots.nth(2)).toContainText('C');
		await expect(slots.nth(3)).toContainText('D');
	});
});
