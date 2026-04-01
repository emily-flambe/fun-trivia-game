import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:8787';
const TEST_EMAIL = 'test@trivia.emilycogsdill.com';
const ADMIN_HEADERS = {
	'Content-Type': 'application/json',
	Cookie: `CF_Test_Auth=${TEST_EMAIL}`,
};

const EXERCISE_PATH = 'test-lbl/quiz/letter-test';

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

test.describe('Letter-by-letter quiz', () => {
	test.beforeAll(async () => {
		await adminDelete(`/api/admin/exercises/${EXERCISE_PATH}`);

		await adminPost('/api/admin/nodes', { id: 'test-lbl', name: 'Test LBL', parentId: null });
		await adminPost('/api/admin/nodes', { id: 'test-lbl/quiz', name: 'Quiz', parentId: 'test-lbl' });

		await adminPost('/api/admin/exercises', {
			id: EXERCISE_PATH,
			nodeId: 'test-lbl/quiz',
			name: 'Letter Test',
			format: 'letter-by-letter',
			config: { autoRevealSeconds: 0 },
			sortOrder: 0,
			items: [
				{ id: 'gold', answer: 'Gold', alternates: ['Au'], explanation: 'Symbol Au, atomic number 79.', data: { prompt: 'What element has the symbol Au?' }, sortOrder: 0 },
				{ id: 'iron', answer: 'Iron', alternates: ['Fe'], explanation: 'Symbol Fe, atomic number 26.', data: { prompt: 'What element has the symbol Fe?' }, sortOrder: 1 },
			],
		});
	});

	test.afterAll(async () => {
		await adminDelete(`/api/admin/exercises/${EXERCISE_PATH}`);
	});

	test('quiz loads with prompt, answer pattern, and controls', async ({ page }) => {
		await page.goto(`/#/exercise/${EXERCISE_PATH}?mode=quiz`);

		await expect(page.getByRole('heading', { name: 'Letter Test' })).toBeVisible({ timeout: 10000 });
		await expect(page.getByText('Answer Pattern')).toBeVisible();
		await expect(page.locator('.font-mono')).toBeVisible();
		await expect(page.getByText('Reveal next letter')).toBeVisible();
		await expect(page.getByText('Skip & reveal answer')).toBeVisible();
		await expect(page.locator('input[type="text"]')).toBeVisible();
		await expect(page.getByRole('button', { name: /submit/i })).toBeVisible();
		await expect(page.getByText('1 / 2')).toBeVisible();
	});

	test('reveal next letter updates the answer pattern', async ({ page }) => {
		await page.goto(`/#/exercise/${EXERCISE_PATH}?mode=quiz`);
		await expect(page.getByText('Answer Pattern')).toBeVisible({ timeout: 10000 });

		const patternBefore = await page.locator('.font-mono').innerText();
		await page.getByText('Reveal next letter').click();
		await page.waitForTimeout(200);
		const patternAfter = await page.locator('.font-mono').innerText();

		expect(patternAfter).not.toBe(patternBefore);
		const dotsBefore = (patternBefore.match(/•/g) || []).length;
		const dotsAfter = (patternAfter.match(/•/g) || []).length;
		expect(dotsAfter).toBeLessThan(dotsBefore);
	});

	test('correct answer shows success feedback', async ({ page }) => {
		await page.goto(`/#/exercise/${EXERCISE_PATH}?mode=quiz`);
		await expect(page.getByText('Answer Pattern')).toBeVisible({ timeout: 10000 });

		const promptText = await page.locator('.text-lg.mb-3').innerText();
		const answer = promptText.includes('Au') ? 'Gold' : 'Iron';

		await page.locator('input[type="text"]').fill(answer);
		await page.getByRole('button', { name: /submit/i }).click();

		await expect(page.getByText('Correct!')).toBeVisible({ timeout: 5000 });
		await expect(page.getByRole('button', { name: /next|see results/i })).toBeVisible();
	});

	test('wrong answer shows incorrect feedback with correct answer', async ({ page }) => {
		await page.goto(`/#/exercise/${EXERCISE_PATH}?mode=quiz`);
		await expect(page.getByText('Answer Pattern')).toBeVisible({ timeout: 10000 });

		await page.locator('input[type="text"]').fill('xyzwrong');
		await page.getByRole('button', { name: /submit/i }).click();

		await expect(page.getByText('Incorrect')).toBeVisible({ timeout: 5000 });
		// The correct answer is shown inside the incorrect feedback span
		const feedbackText = await page.locator('.text-incorrect').first().innerText();
		const hasCorrectAnswer = feedbackText.includes('Gold') || feedbackText.includes('Iron');
		expect(hasCorrectAnswer).toBe(true);
	});

	test('skip reveals the answer and marks incorrect', async ({ page }) => {
		await page.goto(`/#/exercise/${EXERCISE_PATH}?mode=quiz`);
		await expect(page.getByText('Answer Pattern')).toBeVisible({ timeout: 10000 });

		await page.getByText('Skip & reveal answer').click();

		await expect(page.getByText('Incorrect')).toBeVisible({ timeout: 5000 });
		await expect(page.getByRole('button', { name: /next|see results/i })).toBeVisible();
	});

	test('completing all items shows quiz summary with score', async ({ page }) => {
		await page.goto(`/#/exercise/${EXERCISE_PATH}?mode=quiz`);
		await expect(page.getByText('Answer Pattern')).toBeVisible({ timeout: 10000 });

		for (let i = 0; i < 2; i++) {
			await page.getByText('Skip & reveal answer').click();
			await expect(page.getByText('Incorrect')).toBeVisible({ timeout: 5000 });
			const btn = page.getByRole('button', { name: /next|see results/i });
			await btn.click();
			await page.waitForTimeout(300);
		}

		await expect(page.getByText('0 / 2')).toBeVisible({ timeout: 5000 });
		await expect(page.getByRole('button', { name: 'Retake', exact: true })).toBeVisible();
	});

	test('hints used count is tracked in result feedback', async ({ page }) => {
		await page.goto(`/#/exercise/${EXERCISE_PATH}?mode=quiz`);
		await expect(page.getByText('Answer Pattern')).toBeVisible({ timeout: 10000 });

		await page.getByText('Reveal next letter').click();
		await page.waitForTimeout(150);
		await page.getByText('Reveal next letter').click();
		await page.waitForTimeout(150);

		await page.locator('input[type="text"]').fill('xyzwrong');
		await page.getByRole('button', { name: /submit/i }).click();

		await expect(page.getByText('Hints used on this item: 2')).toBeVisible({ timeout: 5000 });
	});
});
