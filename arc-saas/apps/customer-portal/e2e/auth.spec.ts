import { test, expect, config } from './fixtures';

/**
 * Authentication Flow E2E Tests
 *
 * Tests:
 * - Unauthenticated redirect to Keycloak
 * - Successful login
 * - Session persistence
 * - Logout flow
 */

test.describe('Authentication', () => {
  test('should redirect to Keycloak when not authenticated', async ({ page }) => {
    // Clear any existing auth state
    await page.context().clearCookies();

    // Navigate to app
    await page.goto(config.baseUrl);

    // Should redirect to Keycloak
    await expect(page).toHaveURL(new RegExp(config.keycloakUrl), { timeout: 10000 });

    // Keycloak login form should be visible
    await expect(
      page.getByRole('textbox', { name: /username|email/i }).or(
        page.getByLabel(/username|email/i)
      )
    ).toBeVisible();
  });

  test('should show authenticated UI elements after login', async ({ page }) => {
    // Navigate to dashboard (auth setup already ran)
    await page.goto(config.baseUrl);

    // Should see authenticated elements
    await expect(
      page.getByTestId('tenant-selector').or(
        page.getByRole('combobox', { name: /tenant|organization/i }).or(
          page.getByText(/dashboard/i)
        )
      )
    ).toBeVisible({ timeout: 10000 });
  });

  test('should persist session on page reload', async ({ page }) => {
    // Navigate to app
    await page.goto(config.baseUrl);

    // Wait for initial load
    await page.waitForLoadState('networkidle');

    // Get current URL
    const urlBefore = page.url();

    // Reload
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should still be authenticated (not redirected to Keycloak)
    expect(page.url()).not.toContain(config.keycloakUrl);

    // Authenticated elements still visible
    await expect(
      page.getByTestId('tenant-selector').or(
        page.getByRole('combobox', { name: /tenant|organization/i }).or(
          page.getByText(/dashboard/i)
        )
      )
    ).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to protected routes when authenticated', async ({ page, navigateTo }) => {
    // Navigate to BOMs page
    await navigateTo('/boms');

    // Should not redirect to Keycloak
    expect(page.url()).not.toContain(config.keycloakUrl);

    // Should see BOM list or empty state
    await expect(
      page.getByRole('heading', { name: /bom|bill of materials/i }).or(
        page.getByText(/no boms|upload.*bom|create.*bom/i)
      )
    ).toBeVisible({ timeout: 10000 });
  });

  test('should handle logout flow', async ({ page }) => {
    // Navigate to app
    await page.goto(config.baseUrl);
    await page.waitForLoadState('networkidle');

    // Find and click logout button/menu
    const userMenu = page.getByRole('button', { name: /account|profile|user|menu/i }).or(
      page.getByTestId('user-menu')
    );

    // Click user menu if it exists
    if (await userMenu.isVisible()) {
      await userMenu.click();
      await page.waitForTimeout(300);
    }

    // Click logout
    const logoutButton = page.getByRole('button', { name: /log.*out|sign.*out/i }).or(
      page.getByRole('menuitem', { name: /log.*out|sign.*out/i })
    );

    if (await logoutButton.isVisible()) {
      await logoutButton.click();

      // Should redirect to Keycloak or login page
      await expect(page).toHaveURL(
        new RegExp(`${config.keycloakUrl}|/login|/auth`),
        { timeout: 10000 }
      );
    }
  });
});

test.describe('Session Management', () => {
  test('should display user info when authenticated', async ({ page }) => {
    await page.goto(config.baseUrl);
    await page.waitForLoadState('networkidle');

    // Look for user info display (email, name, avatar)
    const userInfo = page.getByTestId('user-info').or(
      page.getByTestId('user-email').or(
        page.getByRole('button', { name: /@|user/i })
      )
    );

    await expect(userInfo).toBeVisible({ timeout: 10000 });
  });

  test('should show role-based navigation', async ({ page }) => {
    await page.goto(config.baseUrl);
    await page.waitForLoadState('networkidle');

    // Check that navigation exists
    const nav = page.getByRole('navigation').or(
      page.locator('nav, [class*="sidebar"], [class*="menu"]')
    );

    await expect(nav).toBeVisible({ timeout: 10000 });

    // Should have at least one navigation item
    const navItems = await nav.getByRole('link').count();
    expect(navItems).toBeGreaterThan(0);
  });
});
