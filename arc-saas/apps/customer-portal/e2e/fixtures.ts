import { test as base, expect, Page } from '@playwright/test';

/**
 * E2E Test Fixtures and Utilities
 *
 * Provides reusable helpers for:
 * - Tenant selection
 * - BOM operations
 * - Navigation
 * - Waiting for async operations
 * - Data prerequisites verification
 */

// Environment configuration
export const config = {
  baseUrl: process.env.E2E_BASE_URL || 'http://localhost:27100',
  keycloakUrl: process.env.E2E_KEYCLOAK_URL || 'http://localhost:8180',
  cnsApiUrl: process.env.E2E_CNS_API_URL || 'http://localhost:27200',
  tenantName: process.env.E2E_TENANT_NAME || 'Test Tenant',
};

/**
 * Skip reason type for explicit test skipping
 */
export type SkipReason =
  | 'NO_BOMS_EXIST'
  | 'NO_ENRICHED_BOMS'
  | 'NO_PROCESSING_BOMS'
  | 'FEATURE_NOT_ENABLED'
  | 'DATA_PREREQUISITE_MISSING';

/**
 * Extended test fixture with helper methods
 */
export const test = base.extend<{
  selectTenant: (tenantName?: string) => Promise<void>;
  navigateTo: (path: string) => Promise<void>;
  waitForPageLoad: () => Promise<void>;
}>({
  selectTenant: async ({ page }, use) => {
    const selectTenant = async (tenantName: string = config.tenantName) => {
      // Click tenant selector
      const selector = page.getByTestId('tenant-selector').or(
        page.getByRole('combobox', { name: /tenant|organization/i })
      );

      await selector.click();

      // Wait for dropdown
      await page.waitForSelector('[role="listbox"], [role="option"]');

      // Select tenant by name
      await page.getByRole('option', { name: new RegExp(tenantName, 'i') }).click();

      // Wait for tenant context to update
      await page.waitForTimeout(500);
    };

    await use(selectTenant);
  },

  navigateTo: async ({ page }, use) => {
    const navigateTo = async (path: string) => {
      const url = `${config.baseUrl}${path}`;
      await page.goto(url);
      await page.waitForLoadState('networkidle');
    };

    await use(navigateTo);
  },

  waitForPageLoad: async ({ page }, use) => {
    const waitForPageLoad = async () => {
      await page.waitForLoadState('domcontentloaded');
      await page.waitForLoadState('networkidle');
      // Wait for any loading spinners to disappear
      await page.waitForSelector('[data-loading="true"]', { state: 'hidden', timeout: 5000 }).catch(() => {});
    };

    await use(waitForPageLoad);
  },
});

export { expect };

/**
 * Helper: Wait for toast/notification
 */
export async function waitForToast(page: Page, text: string | RegExp, type?: 'success' | 'error') {
  const toastSelector = type
    ? `[data-type="${type}"], [class*="${type}"]`
    : '[role="alert"], [class*="toast"], [class*="notification"]';

  const toast = page.locator(toastSelector).filter({ hasText: text });
  await expect(toast).toBeVisible({ timeout: 10000 });
  return toast;
}

/**
 * Helper: Upload a file
 */
export async function uploadFile(page: Page, inputSelector: string, filePath: string) {
  const fileInput = page.locator(inputSelector);
  await fileInput.setInputFiles(filePath);
}

/**
 * Helper: Wait for enrichment to complete
 */
export async function waitForEnrichment(page: Page, timeout = 60000) {
  // Wait for enrichment status to show completed
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const status = await page.locator('[data-testid="enrichment-status"]').textContent();

    if (status?.toLowerCase().includes('completed') || status?.toLowerCase().includes('complete')) {
      return true;
    }

    if (status?.toLowerCase().includes('failed') || status?.toLowerCase().includes('error')) {
      throw new Error(`Enrichment failed: ${status}`);
    }

    await page.waitForTimeout(2000);
  }

  throw new Error('Enrichment timed out');
}

/**
 * Helper: Create a test BOM file content
 */
export function createTestBomContent(): string {
  return `MPN,Manufacturer,Quantity,Description
RC0402FR-071KL,Yageo,100,Resistor 1k 1%
CC0402JRNPO9BN101,Yageo,50,Capacitor 100pF
STM32F401CCU6,STMicroelectronics,10,MCU ARM Cortex-M4
LM358DR,Texas Instruments,25,Op-Amp Dual
CRCW04021K00FKED,Vishay,200,Resistor 1k 1%`;
}

/**
 * Helper: Get unique test identifier
 */
export function getTestId(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// =============================================================================
// Data Prerequisite Helpers
// =============================================================================

/**
 * Helper: Require at least one BOM to exist, or explicitly skip the test
 *
 * Use this instead of conditional checks to ensure tests are explicit about
 * their prerequisites and don't silently pass when data is missing.
 *
 * NOTE: Playwright's test.skip() signature is: skip(condition: boolean, description?: string)
 */
export async function requireBomExists(
  page: Page,
  testContext: { skip: (condition: boolean, description?: string) => void }
): Promise<boolean> {
  const bomRow = page.locator('table tbody tr').first();
  const exists = await bomRow.isVisible();

  if (!exists) {
    testContext.skip(true, 'NO_BOMS_EXIST: Test requires at least one BOM in the system');
    return false;
  }
  return true;
}

/**
 * Helper: Require a BOM with specific status, or explicitly skip
 */
export async function requireBomWithStatus(
  page: Page,
  status: 'enriched' | 'processing' | 'pending' | 'failed',
  testContext: { skip: (condition: boolean, description?: string) => void }
): Promise<boolean> {
  const statusText = page.getByText(new RegExp(status, 'i'));
  const exists = await statusText.isVisible();

  if (!exists) {
    testContext.skip(true, `NO_${status.toUpperCase()}_BOMS: Test requires a BOM with '${status}' status`);
    return false;
  }
  return true;
}

/**
 * Helper: Click first BOM row and navigate to detail page
 * Returns true if successful, false if no BOMs exist
 */
export async function navigateToFirstBom(page: Page): Promise<boolean> {
  const bomRow = page.locator('table tbody tr').first();
  if (!(await bomRow.isVisible())) {
    return false;
  }

  await bomRow.click();
  await page.waitForLoadState('networkidle');
  return true;
}

/**
 * Helper: Assert element is visible with descriptive error
 * Use instead of conditional checks for better test failures
 */
export async function assertVisible(
  page: Page,
  selector: string | ReturnType<Page['locator']>,
  description: string,
  timeout = 10000
): Promise<void> {
  const locator = typeof selector === 'string' ? page.locator(selector) : selector;
  await expect(locator, `Expected ${description} to be visible`).toBeVisible({ timeout });
}

/**
 * Helper: Find and click element, throwing descriptive error if not found
 */
export async function findAndClick(
  page: Page,
  selector: string | ReturnType<Page['locator']>,
  description: string,
  timeout = 5000
): Promise<void> {
  const locator = typeof selector === 'string' ? page.locator(selector) : selector;
  await expect(locator, `Could not find ${description}`).toBeVisible({ timeout });
  await locator.click();
}

/**
 * Helper: Verify stock badge has proper color styling
 * Returns the badge classes for verification
 */
export async function verifyStockBadgeColor(
  page: Page,
  expectedColors: ('green' | 'amber' | 'red' | 'gray')[]
): Promise<{ found: boolean; classes: string | null }> {
  // Look for stock badges in the line items table
  const stockBadges = page.locator('[class*="badge"]').filter({
    has: page.locator(':text-matches("In Stock|Low Stock|Out of Stock|\\\\d+K?|\\\\d+\\\\.\\\\d+[KM]", "i")'),
  });

  const firstBadge = stockBadges.first();
  if (!(await firstBadge.isVisible())) {
    return { found: false, classes: null };
  }

  const classes = await firstBadge.getAttribute('class');

  // Check if any expected color is present
  const hasExpectedColor = expectedColors.some((color) => classes?.includes(color));
  if (!hasExpectedColor && classes) {
    console.warn(`Stock badge found with classes: ${classes}, expected one of: ${expectedColors.join(', ')}`);
  }

  return { found: true, classes };
}
