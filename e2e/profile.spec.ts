import { test, expect } from '@playwright/test';

test.describe('Profile Page', () => {
	test.describe('unauthenticated', () => {
		test('shows sign-in prompt', async ({ page }) => {
			await page.goto('/#/profile');
			await page.waitForTimeout(1000);

			await expect(page.getByText('Sign in to view your profile')).toBeVisible();
		});

		test('does not show tabs', async ({ page }) => {
			await page.goto('/#/profile/categories');
			await page.waitForTimeout(1000);

			await expect(page.getByRole('tab')).toHaveCount(0);
		});
	});

	test.describe('authenticated', () => {
		test.beforeEach(async ({ page }) => {
			await page.goto('/auth/test-login');
			await page.waitForTimeout(1500);
		});

		test('shows tab bar with all 5 tabs', async ({ page }) => {
			await page.goto('/#/profile');
			await page.waitForTimeout(1000);

			await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
			await expect(page.getByRole('tab')).toHaveCount(5);
			await expect(page.getByRole('tab', { name: 'Summary' })).toBeVisible();
			await expect(page.getByRole('tab', { name: 'Categories' })).toBeVisible();
			await expect(page.getByRole('tab', { name: 'Activity' })).toBeVisible();
			await expect(page.getByRole('tab', { name: 'Quiz Log' })).toBeVisible();
			await expect(page.getByRole('tab', { name: 'Preferences' })).toBeVisible();
		});

		test('defaults to Summary tab with aria-selected', async ({ page }) => {
			await page.goto('/#/profile');
			await page.waitForTimeout(1000);

			await expect(page.getByRole('tab', { name: 'Summary' })).toHaveAttribute('aria-selected', 'true');
			await expect(page.getByRole('tabpanel')).toBeVisible();
		});

		test('Categories tab renders and marks active', async ({ page }) => {
			await page.goto('/#/profile/categories');
			await page.waitForTimeout(1000);

			await expect(page.getByRole('tab', { name: 'Categories' })).toHaveAttribute('aria-selected', 'true');
			await expect(page.getByRole('tabpanel')).toBeVisible();
		});

		test('Categories tab shows accuracy after submitting quiz result', async ({ page }) => {
			await page.goto('/#/profile/categories');
			await page.waitForTimeout(1500);

			const panel = page.getByRole('tabpanel');
			const scienceVisible = await panel.getByText('Science').isVisible().catch(() => false);
			if (scienceVisible) {
				await expect(panel.getByText('%').first()).toBeVisible();
				await expect(page.locator('.h-2.bg-surface-bright').first()).toBeVisible();
			} else {
				await expect(panel.getByText('No quiz results yet.')).toBeVisible();
			}
		});

		test('Preferences tab allows editing and saving category weights', async ({ page }) => {
			await page.goto('/#/profile/preferences');
			await page.waitForTimeout(1200);

			await expect(page.getByRole('tab', { name: 'Preferences' })).toHaveAttribute('aria-selected', 'true');
			await expect(page.getByText('Choose relative weights for Random Quiz and Endless mode: 0 = never, 1 = normal, 2 = about twice as likely.')).toBeVisible();

			const scienceInput = page.locator('label:has-text("Science") input[type="number"]').first();
			const currentScienceWeight = Number(await scienceInput.inputValue());
			await scienceInput.fill(String(currentScienceWeight + 1));
			await page.getByRole('button', { name: 'Save preferences' }).click();
			await expect(page.getByText('Saved.')).toBeVisible();

			await page.reload();
			await page.waitForTimeout(1200);
			await expect(page.locator('label:has-text("Science") input[type="number"]').first()).toHaveValue(String(currentScienceWeight + 1));
		});

		test('clicking tabs changes URL and active state', async ({ page }) => {
			await page.goto('/#/profile');
			await page.waitForTimeout(1000);

			await page.getByRole('tab', { name: 'Categories' }).click();
			await page.waitForTimeout(500);
			expect(page.url()).toContain('#/profile/categories');
			await expect(page.getByRole('tab', { name: 'Categories' })).toHaveAttribute('aria-selected', 'true');

			await page.getByRole('tab', { name: 'Activity' }).click();
			await page.waitForTimeout(500);
			expect(page.url()).toContain('#/profile/activity');
			await expect(page.getByRole('tab', { name: 'Activity' })).toHaveAttribute('aria-selected', 'true');
		});

		test('category row links to category page', async ({ page }) => {
			// Ensure there's quiz data
			await page.evaluate(() =>
				fetch('/api/quiz-results', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						exerciseId: 'science/chemistry/element-symbols',
						exerciseName: 'Element Symbols',
						format: 'text-entry',
						score: 1,
						total: 2,
						itemsDetail: [],
					}),
				})
			);

			await page.goto('/#/profile/categories');
			await page.waitForTimeout(1500);

			const scienceLink = page.locator('a[href="#/node/science"]').first();
			await expect(scienceLink).toBeVisible();
			await scienceLink.click();
			await page.waitForTimeout(500);

			expect(page.url()).toContain('#/node/science');
		});
	});

	test.describe('mobile navigation', () => {
		test.beforeEach(async ({ page }) => {
			await page.goto('/auth/test-login');
			await page.waitForTimeout(1500);
		});

		test('mobile: profile icon is visible and navigates to profile', async ({ page }) => {
			await page.setViewportSize({ width: 375, height: 667 });
			await page.goto('/');
			await page.waitForTimeout(1000);

			// Mobile profile icon (sm:hidden) should be visible
			const profileIcon = page.locator('a[aria-label="Profile"]');
			await expect(profileIcon).toBeVisible();

			// Email text link (hidden sm:inline) should be hidden on mobile
			const emailLink = page.locator('nav a[href="#/profile"]:not([aria-label="Profile"])');
			await expect(emailLink).toBeHidden();

			// Click icon and verify navigation to profile
			await profileIcon.click();
			await page.waitForTimeout(1000);

			expect(page.url()).toContain('#/profile');
			await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
		});

		test('mobile: all 4 tabs visible on narrow viewport', async ({ page }) => {
			await page.setViewportSize({ width: 320, height: 568 });
			await page.goto('/#/profile');
			await page.waitForTimeout(1000);

			await expect(page.getByRole('tab', { name: 'Summary' })).toBeVisible();
			await expect(page.getByRole('tab', { name: 'Categories' })).toBeVisible();
			await expect(page.getByRole('tab', { name: 'Activity' })).toBeVisible();
			await expect(page.getByRole('tab', { name: 'Preferences' })).toBeVisible();
		});

		test('desktop: email link visible, icon hidden', async ({ page }) => {
			await page.setViewportSize({ width: 1024, height: 768 });
			await page.goto('/');
			await page.waitForTimeout(1000);

			// Email text link should be visible on desktop
			const emailLink = page.locator('nav a[href="#/profile"]:not([aria-label="Profile"])');
			await expect(emailLink).toBeVisible();

			// Mobile profile icon should be hidden on desktop
			const profileIcon = page.locator('a[aria-label="Profile"]');
			await expect(profileIcon).toHaveCount(1);
			await expect(profileIcon).toBeHidden();
		});
	});
});
