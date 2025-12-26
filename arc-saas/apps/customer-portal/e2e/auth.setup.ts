import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '.auth/user.json');

/**
 * Authentication Setup
 *
 * Logs in via Keycloak and saves the session for reuse across tests.
 * This runs once before all tests in the 'chromium' project.
 */
setup('authenticate via Keycloak', async ({ page }) => {
  const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:27100';
  const keycloakUrl = process.env.E2E_KEYCLOAK_URL || 'http://localhost:8180';
  const username = process.env.E2E_USERNAME || 'test@example.com';
  const password = process.env.E2E_PASSWORD || 'password';

  // Navigate to the app - should redirect to Keycloak
  await page.goto(baseUrl);

  // Wait for Keycloak login page
  await expect(page).toHaveURL(new RegExp(keycloakUrl));

  // Fill in credentials
  await page.getByLabel(/username|email/i).fill(username);
  await page.getByLabel(/password/i).fill(password);

  // Submit login form
  await page.getByRole('button', { name: /sign in|log in|submit/i }).click();

  // Wait for redirect back to app
  await page.waitForURL(new RegExp(baseUrl));

  // Verify we're logged in by checking for authenticated UI elements
  // This could be a user menu, dashboard, or tenant selector
  await expect(
    page.getByRole('button', { name: /account|profile|user/i }).or(
      page.getByTestId('tenant-selector').or(
        page.getByText(/dashboard|welcome/i)
      )
    )
  ).toBeVisible({ timeout: 10000 });

  // Save the authentication state
  await page.context().storageState({ path: authFile });
});
