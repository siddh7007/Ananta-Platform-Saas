import { test as base, Page } from '@playwright/test';

/**
 * Authentication State Storage
 * Used to persist auth state between tests to avoid repeated logins
 */
export const AUTH_STATE_PATH = 'e2e/.auth/user.json';

/**
 * Test user credentials
 * These should be configured via environment variables in CI/CD
 */
export const TEST_USER = {
  username: process.env.TEST_USER_USERNAME || 'admin',
  password: process.env.TEST_USER_PASSWORD || 'admin',
  email: process.env.TEST_USER_EMAIL || 'admin@ananta.com',
};

/**
 * Authentication helper to handle Keycloak login flow
 *
 * This function navigates through the Keycloak authentication flow:
 * 1. Navigate to login page
 * 2. Detect redirect to Keycloak
 * 3. Enter credentials
 * 4. Wait for redirect back to app
 * 5. Verify authentication succeeded
 */
export async function authenticateWithKeycloak(page: Page) {
  // Navigate to the admin app
  await page.goto('/');

  // Check if already authenticated
  const currentUrl = page.url();
  if (currentUrl.includes('/login') || currentUrl.includes('keycloak')) {
    // Click Keycloak login button if on login page
    const keycloakButton = page.getByRole('button', { name: /sign in with keycloak/i });
    if (await keycloakButton.isVisible().catch(() => false)) {
      await keycloakButton.click();
    }

    // Wait for Keycloak login form
    await page.waitForURL(/keycloak/, { timeout: 10000 }).catch(() => {
      // May already be on Keycloak page
    });

    // Fill in credentials
    const usernameInput = page.locator('input[name="username"], input#username');
    const passwordInput = page.locator('input[name="password"], input#password');

    if (await usernameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await usernameInput.fill(TEST_USER.username);
      await passwordInput.fill(TEST_USER.password);

      // Submit the form
      const submitButton = page.locator('input[type="submit"], button[type="submit"]');
      await submitButton.click();

      // Wait for redirect back to app
      await page.waitForURL(/localhost:27555/, { timeout: 15000 });
    }
  }

  // Wait for dashboard to load (indicates successful auth)
  await page.waitForURL(/^http:\/\/localhost:27555\/?(?!login)/, { timeout: 10000 });
}

/**
 * Mock authentication helper for tests that don't need real Keycloak
 *
 * This sets up localStorage with a mocked auth token and user data,
 * allowing tests to bypass the Keycloak flow entirely.
 */
export async function mockAuthentication(page: Page) {
  // Navigate to app
  await page.goto('/');

  // Set mock authentication data in localStorage
  await page.evaluate(() => {
    // Mock JWT token (not a real token, just for testing)
    const mockToken = btoa(JSON.stringify({
      sub: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      preferred_username: 'testuser',
      exp: Math.floor(Date.now() / 1000) + 3600, // Expires in 1 hour
      realm_access: {
        roles: ['super_admin']
      }
    }));

    localStorage.setItem('arc_admin_token', `header.${mockToken}.signature`);
    localStorage.setItem('arc_admin_user', JSON.stringify({
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      role: 'super_admin',
      permissions: []
    }));
  });

  // Reload to apply auth state
  await page.reload();
}

/**
 * Extended test fixture with authentication helpers
 */
export const test = base.extend<{
  authenticatedPage: Page;
}>({
  authenticatedPage: async ({ page }, use) => {
    // Use mock auth for faster tests (can be switched to real auth if needed)
    await mockAuthentication(page);
    await use(page);
  },
});

export { expect } from '@playwright/test';
