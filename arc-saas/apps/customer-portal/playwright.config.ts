import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 *
 * Tests critical user flows:
 * - Login via Keycloak
 * - Tenant selection
 * - BOM upload wizard
 * - Enrichment completion
 */

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:27100',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  projects: [
    // Setup project to authenticate once
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],

  // Environment variables for E2E tests
  // These should be set in CI or .env.e2e
  // E2E_BASE_URL - Customer portal URL (default: http://localhost:27100)
  // E2E_KEYCLOAK_URL - Keycloak URL (default: http://localhost:8180)
  // E2E_KEYCLOAK_REALM - Keycloak realm (default: master)
  // E2E_USERNAME - Test user email
  // E2E_PASSWORD - Test user password
  // E2E_TENANT_NAME - Test tenant name for selection

  // Run local dev server before tests
  webServer: process.env.CI
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:27100',
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
      },
});
