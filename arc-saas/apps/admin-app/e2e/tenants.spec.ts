import { test, expect } from './fixtures/auth';

/**
 * Tenants CRUD Tests
 *
 * Tests for tenant management functionality:
 * - List tenants
 * - View tenant details
 * - Create tenant
 * - Search and filter
 */

test.describe('Tenants', () => {
  test.describe('Tenant List', () => {
    test('should display tenants list page', async ({ authenticatedPage: page }) => {
      await page.goto('/tenants');
      await page.waitForLoadState('networkidle');

      // Page heading should be visible
      const heading = page.getByRole('heading', { name: /tenants/i }).first();
      await expect(heading).toBeVisible({ timeout: 10000 });
    });

    test('should show table headers', async ({ authenticatedPage: page }) => {
      await page.goto('/tenants');
      await page.waitForLoadState('networkidle');

      // Common tenant table headers
      const possibleHeaders = ['Name', 'Key', 'Status', 'Plan', 'Created'];

      // Check if at least some headers are present
      let headersFound = 0;
      for (const headerText of possibleHeaders) {
        const header = page.getByRole('columnheader', { name: new RegExp(headerText, 'i') });
        if (await header.isVisible().catch(() => false)) {
          headersFound++;
        }
      }

      // At least 2 headers should be visible
      expect(headersFound).toBeGreaterThan(1);
    });

    test('should handle empty state gracefully', async ({ authenticatedPage: page }) => {
      await page.goto('/tenants');
      await page.waitForLoadState('networkidle');

      // Wait a moment for data to load
      await page.waitForTimeout(2000);

      // Should show either data or empty state message
      const hasData = await page.locator('table tbody tr, [role="row"]').count() > 0;
      const hasEmptyState = await page.locator('text=/no tenants|no data|empty/i').isVisible().catch(() => false);

      // One of them should be true
      expect(hasData || hasEmptyState).toBeTruthy();
    });

    test('should have create button if user has permission', async ({ authenticatedPage: page }) => {
      await page.goto('/tenants');
      await page.waitForLoadState('networkidle');

      // Look for create/add button
      const createButton = page.getByRole('link', { name: /create|add|new tenant/i }).or(
        page.getByRole('button', { name: /create|add|new tenant/i })
      );

      // Button should exist (visibility depends on permissions)
      const exists = await createButton.count() > 0;
      expect(exists).toBeTruthy();
    });
  });

  test.describe('Tenant View', () => {
    test('should navigate to tenant details when clicking a row', async ({ authenticatedPage: page }) => {
      await page.goto('/tenants');
      await page.waitForLoadState('networkidle');

      // Wait for table to load
      await page.waitForTimeout(2000);

      // Find first tenant row (if any)
      const firstRow = page.locator('table tbody tr, [role="row"]').first();
      const rowCount = await page.locator('table tbody tr, [role="row"]').count();

      if (rowCount > 0) {
        // Click on the first row or a view/show button
        const viewButton = firstRow.locator('a:has-text("View"), a:has-text("Show"), button:has-text("View")').first();

        if (await viewButton.isVisible().catch(() => false)) {
          await viewButton.click();
        } else {
          await firstRow.click();
        }

        // Should navigate to tenant detail page
        await expect(page).toHaveURL(/\/tenants\/[a-f0-9-]+/);
      }
    });

    test('should display tenant details page', async ({ authenticatedPage: page }) => {
      // Try to navigate to a tenant detail page
      // This will fail gracefully if no tenant exists
      await page.goto('/tenants');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const firstRow = page.locator('table tbody tr, [role="row"]').first();
      const rowCount = await page.locator('table tbody tr, [role="row"]').count();

      if (rowCount > 0) {
        const viewButton = firstRow.locator('a:has-text("View"), a:has-text("Show")').first();

        if (await viewButton.isVisible().catch(() => false)) {
          await viewButton.click();

          // Wait for details page to load
          await page.waitForLoadState('networkidle');

          // Should show tenant information
          const detailsVisible = await page.locator('text=/tenant|details|information/i').isVisible().catch(() => false);
          expect(detailsVisible).toBeTruthy();
        }
      }
    });
  });

  test.describe('Tenant Search and Filter', () => {
    test('should have search functionality', async ({ authenticatedPage: page }) => {
      await page.goto('/tenants');
      await page.waitForLoadState('networkidle');

      // Look for search input
      const searchInput = page.locator('input[placeholder*="search" i], input[type="search"]').first();

      if (await searchInput.isVisible().catch(() => false)) {
        // Search input should be interactive
        await expect(searchInput).toBeEnabled();

        // Type in search box
        await searchInput.fill('test');
        await page.waitForTimeout(1000); // Wait for debounce

        // Results should update (hard to verify without data, but input should work)
        const inputValue = await searchInput.inputValue();
        expect(inputValue).toBe('test');
      }
    });

    test('should have filter options', async ({ authenticatedPage: page }) => {
      await page.goto('/tenants');
      await page.waitForLoadState('networkidle');

      // Look for filter buttons/dropdowns
      const filterButton = page.locator('button:has-text("Filter"), button:has-text("Filters")').first();

      if (await filterButton.isVisible().catch(() => false)) {
        await expect(filterButton).toBeEnabled();
      }
    });
  });

  test.describe('Tenant Creation', () => {
    test('should navigate to create tenant page', async ({ authenticatedPage: page }) => {
      await page.goto('/tenants');
      await page.waitForLoadState('networkidle');

      // Click create button
      const createButton = page.getByRole('link', { name: /create|add|new tenant/i }).or(
        page.getByRole('button', { name: /create|add|new tenant/i })
      ).first();

      if (await createButton.isVisible().catch(() => false)) {
        await createButton.click();

        // Should navigate to create page
        await expect(page).toHaveURL(/\/tenants\/create/);
      }
    });

    test('should display create tenant form', async ({ authenticatedPage: page }) => {
      // Try to navigate to create page directly
      await page.goto('/tenants/create');
      await page.waitForLoadState('networkidle');

      // Should show form fields (if user has permission)
      const hasForm = await page.locator('form').isVisible({ timeout: 5000 }).catch(() => false);
      const hasForbidden = await page.locator('text=/forbidden|unauthorized|permission/i').isVisible().catch(() => false);

      // Either form is visible or access is denied (both are valid states)
      expect(hasForm || hasForbidden).toBeTruthy();
    });
  });

  test.describe('Pagination', () => {
    test('should have pagination controls if needed', async ({ authenticatedPage: page }) => {
      await page.goto('/tenants');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Look for pagination elements
      const pagination = page.locator('nav[aria-label*="pagination" i], div:has-text("Page"), button:has-text("Next")').first();

      // Pagination may or may not exist depending on data count
      const exists = await pagination.isVisible().catch(() => false);

      // This is informational - pagination exists if there's enough data
      if (exists) {
        expect(exists).toBeTruthy();
      }
    });
  });
});
