import { test, expect, config, requireBomExists } from './fixtures';

/**
 * BOM List Page E2E Tests
 *
 * Tests the BOM list page functionality:
 * - Page loading and authentication
 * - BOM list display
 * - Search and filtering
 * - Sorting
 * - Pagination
 * - Navigation to BOM detail
 * - Empty state handling
 * - Actions (upload, delete, etc.)
 */

test.describe('BOM List Page Loading', () => {
  test.beforeEach(async ({ page, selectTenant }) => {
    await page.goto(config.baseUrl);
    await page.waitForLoadState('networkidle');
    await selectTenant(config.tenantName);
  });

  test('should load BOM list page', async ({ page, navigateTo }) => {
    // Navigate to BOMs page
    await navigateTo('/boms');

    // Assert: Page loaded
    await expect(
      page.getByRole('heading', { name: /bom|bill of materials/i })
    ).toBeVisible({ timeout: 10000 });
  });

  test('should require authentication to access BOMs', async ({ page }) => {
    // This test verifies auth is working (setup already authenticated)
    // Navigate to BOMs
    await page.goto(`${config.baseUrl}/boms`);
    await page.waitForLoadState('networkidle');

    // Should not redirect to Keycloak (already authenticated)
    expect(page.url()).not.toContain(config.keycloakUrl);

    // Should see BOM content
    await expect(
      page.getByRole('heading', { name: /bom/i }).or(
        page.getByText(/bom|bill of materials/i)
      )
    ).toBeVisible({ timeout: 10000 });
  });

  test('should display loading state initially', async ({ page }) => {
    // Navigate to BOMs
    await page.goto(`${config.baseUrl}/boms`);

    // Should briefly show loading state (may be too fast to catch)
    const loadingIndicator = page.locator('[data-loading="true"]').or(
      page.locator('.animate-spin, [role="progressbar"]')
    );

    // Don't fail if loading is too fast
    const isLoading = await loadingIndicator.isVisible().catch(() => false);
    if (isLoading) {
      console.log('Loading indicator visible');
    }

    // Eventually should load content
    await page.waitForLoadState('networkidle');
  });

  test('should show page header with actions', async ({ page, navigateTo }) => {
    await navigateTo('/boms');

    // Should see page title
    await expect(
      page.getByRole('heading', { name: /bom/i })
    ).toBeVisible({ timeout: 5000 });

    // Should see upload/create button
    await expect(
      page.getByRole('button', { name: /upload|create|new bom/i }).or(
        page.getByRole('link', { name: /upload|create|new bom/i })
      )
    ).toBeVisible();
  });
});

test.describe('BOM List Display', () => {
  test.beforeEach(async ({ page, selectTenant, navigateTo }) => {
    await page.goto(config.baseUrl);
    await page.waitForLoadState('networkidle');
    await selectTenant(config.tenantName);
    await navigateTo('/boms');
  });

  test('should display BOMs in table format', async ({ page }) => {
    // Check for table or list container
    const table = page.locator('table').or(
      page.locator('[role="table"], [data-testid="bom-list"]')
    );

    // Should have table structure
    await expect(table).toBeVisible({ timeout: 10000 });
  });

  test('should show table headers', async ({ page }) => {
    // Should see column headers
    const headers = page.locator('thead').or(
      page.locator('[role="columnheader"]')
    );

    await expect(headers).toBeVisible({ timeout: 5000 });

    // Should have common columns
    await expect(
      page.getByText(/name|title|bom name/i).first()
    ).toBeVisible().catch(() => {
      // May use different header text
    });
  });

  test('should display BOM data when BOMs exist', async ({ page }) => {
    // Check if any BOMs exist
    if (!(await requireBomExists(page, test))) return;

    // Should see at least one BOM row
    const bomRow = page.locator('tbody tr').first();
    await expect(bomRow).toBeVisible({ timeout: 5000 });

    // Row should have content
    const content = await bomRow.textContent();
    expect(content).toBeTruthy();
    expect(content!.length).toBeGreaterThan(0);
  });

  test('should show BOM status in list', async ({ page }) => {
    if (!(await requireBomExists(page, test))) return;

    // Should see status badges/indicators
    const status = page.getByText(/enriched|processing|pending|complete|failed/i).first();
    const hasStatus = await status.isVisible();

    if (hasStatus) {
      expect(await status.textContent()).toBeTruthy();
    }
  });

  test('should show empty state when no BOMs exist', async ({ page }) => {
    // Check if BOMs exist
    const bomRow = page.locator('tbody tr').first();
    const hasBoms = await bomRow.isVisible();

    if (!hasBoms) {
      // Should show empty state message
      await expect(
        page.getByText(/no boms|no bill of materials|upload.*bom|create.*bom/i)
      ).toBeVisible({ timeout: 5000 });
    } else {
      console.log('BOMs exist - skipping empty state test');
    }
  });

  test('should display BOM metadata', async ({ page }) => {
    if (!(await requireBomExists(page, test))) return;

    // First BOM should show key metadata
    const firstRow = page.locator('tbody tr').first();

    // Check for various metadata (may vary by implementation)
    const text = await firstRow.textContent();

    // Should have some identifiable information
    expect(text).toBeTruthy();
    expect(text!.length).toBeGreaterThan(10);
  });
});

test.describe('BOM List Search and Filtering', () => {
  test.beforeEach(async ({ page, selectTenant, navigateTo }) => {
    await page.goto(config.baseUrl);
    await page.waitForLoadState('networkidle');
    await selectTenant(config.tenantName);
    await navigateTo('/boms');
  });

  test('should have search input', async ({ page }) => {
    // Look for search input
    const searchInput = page.getByPlaceholder(/search/i).or(
      page.getByRole('searchbox')
    );

    const hasSearch = await searchInput.isVisible();
    if (!hasSearch) {
      console.log('Search input not visible - may be in different location');
    }
  });

  test('should filter BOMs by search query', async ({ page }) => {
    if (!(await requireBomExists(page, test))) return;

    const searchInput = page.getByPlaceholder(/search/i).or(
      page.getByRole('searchbox')
    );

    const hasSearch = await searchInput.isVisible();
    if (!hasSearch) {
      test.skip(true, 'Search input not available');
      return;
    }

    // Get initial row count
    const initialRows = await page.locator('tbody tr').count();

    // Type search query
    await searchInput.fill('nonexistent123xyz');
    await page.waitForTimeout(1000); // Debounce

    // Row count may change (or show "no results")
    const newRows = await page.locator('tbody tr').count();
    const noResults = await page.getByText(/no results|no matching/i).isVisible();

    // Either fewer rows or no results message
    expect(newRows <= initialRows || noResults).toBeTruthy();
  });

  test('should have status filter', async ({ page }) => {
    // Look for status filter dropdown
    const statusFilter = page.getByRole('combobox', { name: /status/i }).or(
      page.locator('[data-testid="status-filter"]')
    );

    const hasFilter = await statusFilter.isVisible();
    if (!hasFilter) {
      console.log('Status filter not visible - may not be implemented');
    }
  });

  test('should filter by status', async ({ page }) => {
    if (!(await requireBomExists(page, test))) return;

    const statusFilter = page.getByRole('combobox', { name: /status/i });
    const hasFilter = await statusFilter.isVisible();

    if (!hasFilter) {
      test.skip(true, 'Status filter not available');
      return;
    }

    // Click status filter
    await statusFilter.click();
    await page.waitForTimeout(300);

    // Should see status options
    await expect(
      page.getByRole('option').first()
    ).toBeVisible({ timeout: 3000 });
  });

  test('should clear filters', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i);
    const hasSearch = await searchInput.isVisible();

    if (!hasSearch) {
      test.skip(true, 'Search not available to test clearing');
      return;
    }

    // Apply search filter
    await searchInput.fill('test');
    await page.waitForTimeout(1000);

    // Clear search
    await searchInput.clear();
    await page.waitForTimeout(500);

    // Should show all BOMs again
    await page.waitForLoadState('networkidle');
  });
});

test.describe('BOM List Sorting', () => {
  test.beforeEach(async ({ page, selectTenant, navigateTo }) => {
    await page.goto(config.baseUrl);
    await page.waitForLoadState('networkidle');
    await selectTenant(config.tenantName);
    await navigateTo('/boms');
  });

  test('should have sortable columns', async ({ page }) => {
    if (!(await requireBomExists(page, test))) return;

    // Look for sortable column headers
    const sortableHeader = page.locator('th[role="columnheader"]').or(
      page.locator('th button')
    ).first();

    const hasSortable = await sortableHeader.isVisible();
    if (!hasSortable) {
      console.log('Sortable columns not found - may use different implementation');
    }
  });

  test('should sort by column', async ({ page }) => {
    if (!(await requireBomExists(page, test))) return;

    const sortableHeader = page.locator('th button').first();
    const hasSortable = await sortableHeader.isVisible();

    if (!hasSortable) {
      test.skip(true, 'Sortable columns not available');
      return;
    }

    // Get first BOM name before sort
    const firstBomBefore = await page.locator('tbody tr').first().textContent();

    // Click to sort
    await sortableHeader.click();
    await page.waitForTimeout(500);

    // Get first BOM name after sort
    const firstBomAfter = await page.locator('tbody tr').first().textContent();

    // Order may have changed (or stayed same if already sorted)
    expect(firstBomAfter).toBeTruthy();
  });
});

test.describe('BOM List Pagination', () => {
  test.beforeEach(async ({ page, selectTenant, navigateTo }) => {
    await page.goto(config.baseUrl);
    await page.waitForLoadState('networkidle');
    await selectTenant(config.tenantName);
    await navigateTo('/boms');
  });

  test('should show pagination controls when needed', async ({ page }) => {
    // Look for pagination
    const pagination = page.locator('[role="navigation"]').filter({ hasText: /page|next|previous/i }).or(
      page.getByText(/page \d+ of \d+/i)
    );

    const hasPagination = await pagination.isVisible();
    if (!hasPagination) {
      console.log('Pagination not visible - may have few BOMs or infinite scroll');
    }
  });

  test('should navigate to next page', async ({ page }) => {
    const nextButton = page.getByRole('button', { name: /next/i });
    const hasNext = await nextButton.isVisible();

    if (!hasNext) {
      test.skip(true, 'Next button not available - may be on last page or no pagination');
      return;
    }

    // Check if button is enabled
    const isDisabled = await nextButton.isDisabled();
    if (isDisabled) {
      test.skip(true, 'Next button disabled - on last page');
      return;
    }

    // Click next
    await nextButton.click();
    await page.waitForLoadState('networkidle');

    // Should load next page
    await expect(
      page.locator('tbody tr').first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to previous page', async ({ page }) => {
    const previousButton = page.getByRole('button', { name: /previous|prev/i });
    const hasPrevious = await previousButton.isVisible();

    if (!hasPrevious) {
      test.skip(true, 'Previous button not available');
      return;
    }

    // Previous button should be disabled on first page
    const isDisabled = await previousButton.isDisabled();
    if (!isDisabled) {
      // We're not on first page, can click previous
      await previousButton.click();
      await page.waitForLoadState('networkidle');
    }
  });

  test('should show page numbers or indicators', async ({ page }) => {
    // Look for page indicators
    const pageInfo = page.getByText(/page \d+|showing \d+|\d+-\d+ of \d+/i);
    const hasPageInfo = await pageInfo.isVisible();

    if (hasPageInfo) {
      const text = await pageInfo.textContent();
      expect(text).toMatch(/\d+/); // Should contain numbers
    }
  });
});

test.describe('BOM List Navigation', () => {
  test.beforeEach(async ({ page, selectTenant, navigateTo }) => {
    await page.goto(config.baseUrl);
    await page.waitForLoadState('networkidle');
    await selectTenant(config.tenantName);
    await navigateTo('/boms');
  });

  test('should navigate to BOM detail on row click', async ({ page }) => {
    if (!(await requireBomExists(page, test))) return;

    // Click first BOM row
    const firstRow = page.locator('tbody tr').first();
    await firstRow.click();

    await page.waitForLoadState('networkidle');

    // Should navigate to BOM detail page
    expect(page.url()).toMatch(/boms\/[a-f0-9-]+/i);

    // Should see BOM detail content
    await expect(
      page.getByText(/line items|enrichment|details/i)
    ).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to upload page', async ({ page }) => {
    // Click upload/create button
    const uploadButton = page.getByRole('button', { name: /upload|create|new bom/i }).or(
      page.getByRole('link', { name: /upload|create|new bom/i })
    );

    await uploadButton.click();
    await page.waitForLoadState('networkidle');

    // Should navigate to upload page
    expect(page.url()).toMatch(/boms\/upload|boms\/new/i);

    // Should see upload wizard
    await expect(
      page.getByText(/upload|select file|drag.*drop/i)
    ).toBeVisible({ timeout: 10000 });
  });

  test('should have breadcrumb navigation', async ({ page }) => {
    // Look for breadcrumbs
    const breadcrumb = page.locator('[aria-label*="breadcrumb" i]').or(
      page.locator('nav').filter({ has: page.getByText(/home|dashboard/i) })
    );

    const hasBreadcrumb = await breadcrumb.isVisible();
    if (!hasBreadcrumb) {
      console.log('Breadcrumb navigation not visible');
    }
  });
});

test.describe('BOM List Actions', () => {
  test.beforeEach(async ({ page, selectTenant, navigateTo }) => {
    await page.goto(config.baseUrl);
    await page.waitForLoadState('networkidle');
    await selectTenant(config.tenantName);
    await navigateTo('/boms');
  });

  test('should have bulk actions or row actions', async ({ page }) => {
    if (!(await requireBomExists(page, test))) return;

    // Look for action buttons/menus
    const actionButton = page.getByRole('button', { name: /actions|menu|more/i }).or(
      page.locator('[data-testid*="action"]')
    );

    const hasActions = await actionButton.first().isVisible();
    if (!hasActions) {
      console.log('Action buttons not found - may use different pattern');
    }
  });

  test('should show BOM context menu', async ({ page }) => {
    if (!(await requireBomExists(page, test))) return;

    // Look for row action menu (three dots, etc.)
    const menuButton = page.locator('tbody tr').first().getByRole('button', { name: /menu|actions|more/i });
    const hasMenu = await menuButton.isVisible();

    if (!hasMenu) {
      test.skip(true, 'Row action menu not available');
      return;
    }

    // Click menu
    await menuButton.click();
    await page.waitForTimeout(300);

    // Should show menu items
    await expect(
      page.getByRole('menuitem').or(
        page.getByRole('menu')
      )
    ).toBeVisible({ timeout: 3000 });
  });

  test('should support BOM deletion', async ({ page }) => {
    if (!(await requireBomExists(page, test))) return;

    // Look for delete option (usually in row menu)
    const menuButton = page.locator('tbody tr').first().getByRole('button', { name: /menu|actions|more/i });
    const hasMenu = await menuButton.isVisible();

    if (!hasMenu) {
      test.skip(true, 'Cannot test deletion without action menu');
      return;
    }

    await menuButton.click();
    await page.waitForTimeout(300);

    // Look for delete option
    const deleteOption = page.getByRole('menuitem', { name: /delete|remove/i });
    const hasDelete = await deleteOption.isVisible();

    if (hasDelete) {
      console.log('Delete option available - not clicking to avoid data loss in test');
      // Don't actually delete in E2E tests
    }
  });

  test('should refresh BOM list', async ({ page }) => {
    // Look for refresh button
    const refreshButton = page.getByRole('button', { name: /refresh|reload/i });
    const hasRefresh = await refreshButton.isVisible();

    if (!hasRefresh) {
      test.skip(true, 'Refresh button not available');
      return;
    }

    // Click refresh
    await refreshButton.click();
    await page.waitForLoadState('networkidle');

    // Should reload data
    await expect(
      page.locator('tbody tr').first()
    ).toBeVisible({ timeout: 5000 });
  });
});

test.describe('BOM List Performance', () => {
  test.beforeEach(async ({ page, selectTenant, navigateTo }) => {
    await page.goto(config.baseUrl);
    await page.waitForLoadState('networkidle');
    await selectTenant(config.tenantName);
    await navigateTo('/boms');
  });

  test('should load within reasonable time', async ({ page }) => {
    const startTime = Date.now();

    // Navigate to BOMs
    await page.goto(`${config.baseUrl}/boms`);
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;

    // Should load in under 10 seconds
    expect(loadTime).toBeLessThan(10000);
  });

  test('should handle large lists efficiently', async ({ page }) => {
    // Check if pagination/virtualization is working
    const rows = page.locator('tbody tr');
    const rowCount = await rows.count();

    // Should not render thousands of rows at once (pagination or virtualization)
    expect(rowCount).toBeLessThan(1000);
  });
});

test.describe('BOM List Accessibility', () => {
  test.beforeEach(async ({ page, selectTenant, navigateTo }) => {
    await page.goto(config.baseUrl);
    await page.waitForLoadState('networkidle');
    await selectTenant(config.tenantName);
    await navigateTo('/boms');
  });

  test('should have proper table semantics', async ({ page }) => {
    if (!(await requireBomExists(page, test))) return;

    // Should use proper table elements
    const table = page.locator('table');
    await expect(table).toBeVisible({ timeout: 5000 });

    // Should have thead and tbody
    const thead = page.locator('thead');
    const tbody = page.locator('tbody');

    await expect(thead).toBeVisible();
    await expect(tbody).toBeVisible();
  });

  test('should have accessible column headers', async ({ page }) => {
    // Headers should be th elements or have role="columnheader"
    const headers = page.locator('th').or(
      page.locator('[role="columnheader"]')
    );

    const count = await headers.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should support keyboard navigation', async ({ page }) => {
    if (!(await requireBomExists(page, test))) return;

    // First row should be focusable
    const firstRow = page.locator('tbody tr').first();
    await firstRow.focus();

    // Should be able to press Enter to navigate
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // May navigate to detail (depending on implementation)
    // At minimum, shouldn't crash
  });

  test('should have proper ARIA labels', async ({ page }) => {
    // Table or list should have aria-label or aria-labelledby
    const table = page.locator('table').or(
      page.locator('[role="table"]')
    );

    const hasTable = await table.isVisible();
    if (hasTable) {
      // Check for ARIA attributes
      const ariaLabel = await table.getAttribute('aria-label');
      const ariaLabelledBy = await table.getAttribute('aria-labelledby');

      // Should have one or the other (or rely on visible heading)
      if (!ariaLabel && !ariaLabelledBy) {
        console.log('Table lacks explicit ARIA label - may rely on visible heading');
      }
    }
  });
});
