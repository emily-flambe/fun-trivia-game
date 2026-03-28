import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
	test('shows Sign In button when not authenticated', async ({ page }) => {
		await page.goto('/');
		await page.waitForTimeout(1000);
		const signIn = page.locator('a:has-text("Sign In")');
		await expect(signIn).toBeVisible();
	});

	test('sign in via test bypass sets cookie and shows email', async ({ page }) => {
		// Navigate to test login endpoint — sets CF_Test_Auth cookie and redirects to app
		await page.goto('/auth/test-login');
		await page.waitForTimeout(1500);

		// Email should be visible in nav
		const email = page.locator('nav').getByText('test@trivia.emilycogsdill.com');
		await expect(email).toBeVisible();

		// Sign Out should be visible
		const signOut = page.locator('a:has-text("Sign Out")');
		await expect(signOut).toBeVisible();

		// Sign In should NOT be visible
		const signIn = page.locator('a:has-text("Sign In")');
		await expect(signIn).not.toBeVisible();
	});

	test('authenticated user can access profile page', async ({ page }) => {
		await page.goto('/auth/test-login');
		await page.waitForTimeout(1500);

		// Click email link to navigate to profile
		await page.locator('nav a[href="#/profile"]').click();
		await page.waitForTimeout(500);

		expect(page.url()).toContain('#/profile');
	});

	test('sign out clears auth state', async ({ page }) => {
		// First sign in
		await page.goto('/auth/test-login');
		await page.waitForTimeout(1500);

		// Clear the cookie to simulate logout (we can't follow /cdn-cgi/access/logout locally)
		await page.context().clearCookies();
		await page.goto('/');
		await page.waitForTimeout(1000);

		// Sign In should be visible again
		const signIn = page.locator('a:has-text("Sign In")');
		await expect(signIn).toBeVisible();
	});

	test('/api/auth/me returns authenticated state after login', async ({ page }) => {
		await page.goto('/auth/test-login');
		await page.waitForTimeout(500);

		const response = await page.evaluate(() =>
			fetch('/api/auth/me').then(r => r.json())
		);
		expect(response.authenticated).toBe(true);
		expect(response.email).toBe('test@trivia.emilycogsdill.com');
	});

	test('/api/auth/me returns unauthenticated without cookie', async ({ page }) => {
		await page.goto('/');
		const response = await page.evaluate(() =>
			fetch('/api/auth/me').then(r => r.json())
		);
		expect(response.authenticated).toBe(false);
		expect(response.loginUrl).toBeTruthy();
	});
});
