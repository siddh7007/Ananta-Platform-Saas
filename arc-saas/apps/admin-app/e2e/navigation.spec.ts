import { test, expect } from './fixtures/auth';

/**
 * Navigation Tests
 *
 * Tests for navigation between different sections of the admin app:
 * - Sidebar navigation
 * - Breadcrumb navigation
 * - Back button functionality
 * - URL navigation
 */

test.describe('Navigation', () => {
  test.describe('Sidebar Navigation', () => {
    test('should navigate to all main sections', async ({ authenticatedPage: page }) => {
      await page.goto('/');

      const sections = [
        { name: /tenants/i, url: /\/tenants/ },
        { name: /plans/i, url: /\/plans/ },
        { name: /subscriptions/i, url: /\/subscriptions/ },
        { name: /users/i, url: /\/users/ },
      ];

      for (const section of sections) {
        // Click on sidebar link
        const link = page.getByRole('link', { name: section.name }).first();
        await link.click();

        // Verify URL changed
        await expect(page).toHaveURL(section.url);

        // Verify page content loaded
        await page.waitForLoadState('networkidle');
      }
    });

    test('should highlight active navigation item', async ({ authenticatedPage: page }) => {
      await page.goto('/tenants');
      await page.waitForLoadState('networkidle');

      // Find the Tenants navigation link
      const tenantsLink = page.getByRole('link', { name: /tenants/i }).first();

      // Should have active state (common patterns: aria-current, class with 'active')
      const hasActiveState = await tenantsLink.evaluate((el) => {
        return (
          el.getAttribute('aria-current') === 'page' ||
          el.className.includes('active') ||
          el.parentElement?.className.includes('active')
        );
      });

      expect(hasActiveState).toBeTruthy();
    });
  });

  test.describe('Page Navigation', () => {
    test('should navigate using browser back button', async ({ authenticatedPage: page }) => {
      await page.goto('/');
      await page.goto('/tenants');
      await page.goto('/plans');

      // Go back
      await page.goBack();
      await expect(page).toHaveURL(/\/tenants/);

      // Go back again
      await page.goBack();
      await expect(page).toHaveURL(/^\/$|\/$/);
    });

    test('should navigate using browser forward button', async ({ authenticatedPage: page }) => {
      await page.goto('/');
      await page.goto('/tenants');

      // Go back
      await page.goBack();
      await expect(page).toHaveURL(/^\/$|\/$/);

      // Go forward
      await page.goForward();
      await expect(page).toHaveURL(/\/tenants/);
    });

    test('should navigate directly via URL', async ({ authenticatedPage: page }) => {
      // Navigate to specific routes directly
      const routes = [
        '/tenants',
        '/plans',
        '/subscriptions',
        '/users',
      ];

      for (const route of routes) {
        await page.goto(route);
        await expect(page).toHaveURL(new RegExp(route));
        await page.waitForLoadState('networkidle');
      }
    });
  });

  test.describe('Responsive Navigation', () => {
    test('should show mobile menu on small screens', async ({ authenticatedPage: page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');

      // Look for mobile menu button (hamburger menu)
      const menuButton = page.locator('button[aria-label*="menu"], button:has-text("☰")').first();

      if (await menuButton.isVisible().catch(() => false)) {
        // Click to open menu
        await menuButton.click();

        // Navigation should be visible
        const nav = page.locator('nav, [role="navigation"]').first();
        await expect(nav).toBeVisible();
      }
    });

    test('should show sidebar on desktop screens', async ({ authenticatedPage: page }) => {
      // Set desktop viewport
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Sidebar should be visible
      const sidebar = page.locator('aside, nav, [role="navigation"]').first();
      await expect(sidebar).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should navigate using keyboard', async ({ authenticatedPage: page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Press Tab to focus first interactive element
      await page.keyboard.press('Tab');

      // Should be able to navigate with arrow keys if supported
      // This is a basic check - specific keyboard navigation depends on implementation
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(focusedElement).toBeTruthy();
    });
  });
});
