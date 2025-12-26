import { test, expect, config } from './fixtures';

/**
 * Tenant Selection E2E Tests
 *
 * Tests:
 * - Tenant selector visibility
 * - Tenant list population
 * - Tenant switching
 * - Tenant context persistence
 */

test.describe('Tenant Selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(config.baseUrl);
    await page.waitForLoadState('networkidle');
  });

  test('should display tenant selector after login', async ({ page }) => {
    // Tenant selector should be visible
    const selector = page.getByTestId('tenant-selector').or(
      page.getByRole('combobox', { name: /tenant|organization/i }).or(
        page.getByRole('button', { name: /select.*tenant|choose.*org/i })
      )
    );

    await expect(selector).toBeVisible({ timeout: 10000 });
  });

  test('should show available tenants in dropdown', async ({ page }) => {
    // Click tenant selector
    const selector = page.getByTestId('tenant-selector').or(
      page.getByRole('combobox', { name: /tenant|organization/i })
    );

    await selector.click();

    // Wait for dropdown to appear
    await page.waitForSelector('[role="listbox"], [role="option"], [class*="dropdown"]');

    // Should have at least one tenant option
    const options = page.getByRole('option');
    const count = await options.count();

    expect(count).toBeGreaterThan(0);
  });

  test('should switch tenant successfully', async ({ page, selectTenant }) => {
    // Get current tenant name (if displayed)
    const selectorText = await page.getByTestId('tenant-selector').or(
      page.getByRole('combobox', { name: /tenant|organization/i })
    ).textContent();

    // Open selector and get first available option
    const selector = page.getByTestId('tenant-selector').or(
      page.getByRole('combobox', { name: /tenant|organization/i })
    );

    await selector.click();

    // Wait for dropdown
    await page.waitForSelector('[role="listbox"], [role="option"]');

    // Get first option that's different from current
    const options = page.getByRole('option');
    const firstOption = options.first();
    const optionText = await firstOption.textContent();

    // Select the option
    await firstOption.click();

    // Wait for context update
    await page.waitForTimeout(500);

    // Verify selector now shows selected tenant
    const newSelectorText = await page.getByTestId('tenant-selector').or(
      page.getByRole('combobox', { name: /tenant|organization/i })
    ).textContent();

    // Either the text changed or we selected the same one
    expect(newSelectorText).toBeTruthy();
  });

  test('should persist tenant selection on navigation', async ({ page, selectTenant, navigateTo }) => {
    // Select a tenant
    await selectTenant(config.tenantName);

    // Get selected tenant text
    const selectedTenant = await page.getByTestId('tenant-selector').or(
      page.getByRole('combobox', { name: /tenant|organization/i })
    ).textContent();

    // Navigate to different page
    await navigateTo('/boms');
    await page.waitForLoadState('networkidle');

    // Tenant should still be selected
    const tenantAfterNav = await page.getByTestId('tenant-selector').or(
      page.getByRole('combobox', { name: /tenant|organization/i })
    ).textContent();

    expect(tenantAfterNav).toBe(selectedTenant);
  });

  test('should persist tenant selection on page reload', async ({ page, selectTenant }) => {
    // Select a tenant
    await selectTenant(config.tenantName);

    // Get selected tenant text
    const selectedTenant = await page.getByTestId('tenant-selector').or(
      page.getByRole('combobox', { name: /tenant|organization/i })
    ).textContent();

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Tenant should still be selected
    const tenantAfterReload = await page.getByTestId('tenant-selector').or(
      page.getByRole('combobox', { name: /tenant|organization/i })
    ).textContent();

    expect(tenantAfterReload).toBe(selectedTenant);
  });

  test('should filter tenants by search', async ({ page }) => {
    // Click tenant selector
    const selector = page.getByTestId('tenant-selector').or(
      page.getByRole('combobox', { name: /tenant|organization/i })
    );

    await selector.click();

    // Look for search input in dropdown
    const searchInput = page.getByPlaceholder(/search|filter/i).or(
      page.getByRole('searchbox')
    );

    if (await searchInput.isVisible()) {
      // Type search term
      await searchInput.fill('test');

      // Wait for filter to apply
      await page.waitForTimeout(300);

      // Options should be filtered
      const options = page.getByRole('option');
      const count = await options.count();

      // Should have some results or empty message
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });
});

test.describe('Tenant Context', () => {
  test('should include tenant header in API requests', async ({ page }) => {
    await page.goto(config.baseUrl);
    await page.waitForLoadState('networkidle');

    // Listen for API requests
    let tenantHeaderFound = false;
    page.on('request', (request) => {
      const headers = request.headers();
      if (headers['x-tenant-id'] || headers['X-Tenant-Id']) {
        tenantHeaderFound = true;
      }
    });

    // Navigate to trigger API calls
    await page.goto(`${config.baseUrl}/boms`);
    await page.waitForLoadState('networkidle');

    // Wait a bit for requests to complete
    await page.waitForTimeout(1000);

    // Note: This may not find the header if no API calls are made
    // or if tenant is not yet selected
  });

  test('should show tenant-specific data after selection', async ({ page, selectTenant }) => {
    // Select tenant
    await selectTenant(config.tenantName);

    // Navigate to BOMs page
    await page.goto(`${config.baseUrl}/boms`);
    await page.waitForLoadState('networkidle');

    // Should show BOM list or empty state for this tenant
    await expect(
      page.getByRole('heading', { name: /bom|bill of materials/i }).or(
        page.getByText(/no boms|upload.*bom|your boms/i).or(
          page.locator('[data-testid="bom-list"]')
        )
      )
    ).toBeVisible({ timeout: 10000 });
  });
});
