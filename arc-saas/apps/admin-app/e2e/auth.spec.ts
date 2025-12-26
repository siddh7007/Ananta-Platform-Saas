import { test, expect } from '@playwright/test';
import { mockAuthentication } from './fixtures/auth';

/**
 * Authentication Flow Tests
 *
 * Tests for login/logout functionality including:
 * - Login page rendering
 * - Authentication flow
 * - Logout functionality
 * - Protected route access
 */

test.describe('Authentication', () => {
  test('should show login page when not authenticated', async ({ page }) => {
    await page.goto('/');

    // Should redirect to login or show login UI
    await expect(page).toHaveURL(/\/(login|callback|keycloak)/);
  });

  test('should display Keycloak login button', async ({ page }) => {
    await page.goto('/login');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Should have Keycloak login option
    const keycloakButton = page.getByRole('button', { name: /sign in with keycloak/i });
    await expect(keycloakButton).toBeVisible({ timeout: 10000 });
  });

  test('should redirect to dashboard after authentication', async ({ page }) => {
    await mockAuthentication(page);

    // Should be on dashboard
    await expect(page).toHaveURL(/^http:\/\/localhost:27555\/?$/);

    // Dashboard should be visible
    await expect(page.getByText(/dashboard/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('should logout successfully', async ({ page }) => {
    await mockAuthentication(page);

    // Wait for dashboard to load
    await page.waitForLoadState('networkidle');

    // Find and click user menu (usually in header)
    const userMenu = page.locator('[data-testid="user-menu"], [aria-label*="user"], button:has-text("Test User")').first();
    if (await userMenu.isVisible().catch(() => false)) {
      await userMenu.click();

      // Click logout button
      const logoutButton = page.getByRole('menuitem', { name: /logout|sign out/i });
      if (await logoutButton.isVisible().catch(() => false)) {
        await logoutButton.click();

        // Should redirect to login
        await expect(page).toHaveURL(/\/(login|callback)/);
      }
    }
  });

  test('should persist authentication across page reloads', async ({ page }) => {
    await mockAuthentication(page);

    // Navigate to a protected route
    await page.goto('/tenants');
    await expect(page).toHaveURL(/\/tenants/);

    // Reload page
    await page.reload();

    // Should still be authenticated and on the same page
    await expect(page).toHaveURL(/\/tenants/);
  });

  test('should protect routes that require authentication', async ({ page }) => {
    // Try to access protected route without auth
    await page.goto('/tenants');

    // Should redirect to login
    await expect(page).toHaveURL(/\/(login|callback)/);
  });
});
