import { test, expect } from './fixtures/auth';

/**
 * Dashboard Tests
 *
 * Tests for the main dashboard page:
 * - Page loads correctly
 * - Key metrics are displayed
 * - Navigation works
 */

test.describe('Dashboard', () => {
  test('should load dashboard page after authentication', async ({ authenticatedPage: page }) => {
    await page.goto('/');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Should be on dashboard (root path)
    await expect(page).toHaveURL(/^http:\/\/localhost:27555\/?$/);

    // Dashboard heading should be visible
    const heading = page.getByRole('heading', { name: /dashboard/i }).first();
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test('should display navigation menu', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for common navigation items
    const navItems = [
      /dashboard/i,
      /tenants/i,
      /plans/i,
      /subscriptions/i,
    ];

    for (const item of navItems) {
      const navLink = page.getByRole('link', { name: item }).first();
      await expect(navLink).toBeVisible();
    }
  });

  test('should navigate to tenants page from sidebar', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click on Tenants link in sidebar
    const tenantsLink = page.getByRole('link', { name: /tenants/i }).first();
    await tenantsLink.click();

    // Should navigate to tenants page
    await expect(page).toHaveURL(/\/tenants/);
  });

  test('should navigate to plans page from sidebar', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click on Plans link in sidebar
    const plansLink = page.getByRole('link', { name: /plans/i }).first();
    await plansLink.click();

    // Should navigate to plans page
    await expect(page).toHaveURL(/\/plans/);
  });

  test('should navigate to subscriptions page from sidebar', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click on Subscriptions link in sidebar
    const subscriptionsLink = page.getByRole('link', { name: /subscriptions/i }).first();
    await subscriptionsLink.click();

    // Should navigate to subscriptions page
    await expect(page).toHaveURL(/\/subscriptions/);
  });

  test('should display user information in header', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for user name or email in header
    const userInfo = page.locator('text=/Test User|test@example.com/i').first();
    await expect(userInfo).toBeVisible({ timeout: 10000 });
  });

  test('should render without console errors', async ({ authenticatedPage: page }) => {
    const errors: string[] = [];

    // Capture console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Filter out known/acceptable errors (like network errors in test env)
    const criticalErrors = errors.filter(
      (error) => !error.includes('Failed to fetch') && !error.includes('Network')
    );

    // Should not have critical console errors
    expect(criticalErrors.length).toBe(0);
  });
});
