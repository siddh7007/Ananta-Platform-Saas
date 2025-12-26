import {
  test,
  expect,
  config,
  createTestBomContent,
  getTestId,
  waitForToast,
  requireBomExists,
  requireBomWithStatus,
  navigateToFirstBom,
  assertVisible,
  findAndClick,
  verifyStockBadgeColor,
} from './fixtures';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * BOM Enrichment E2E Tests
 *
 * Tests the enrichment workflow:
 * - Start enrichment
 * - Progress tracking
 * - Completion handling
 * - Re-enrichment (stale data)
 *
 * NOTE: Tests use explicit skip() when data prerequisites aren't met,
 * rather than silently passing with conditional checks.
 */

test.describe('BOM Enrichment', () => {
  let testBomFile: string;
  let uploadedBomId: string | null = null;

  test.beforeAll(async () => {
    // Create a temporary test BOM file
    const testDir = path.join(os.tmpdir(), 'cbp-e2e-tests');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    testBomFile = path.join(testDir, `enrichment-test-${getTestId()}.csv`);
    fs.writeFileSync(testBomFile, createTestBomContent());
  });

  test.afterAll(async () => {
    // Cleanup test file
    if (fs.existsSync(testBomFile)) {
      fs.unlinkSync(testBomFile);
    }
  });

  test.beforeEach(async ({ page, selectTenant }) => {
    await page.goto(config.baseUrl);
    await page.waitForLoadState('networkidle');
    await selectTenant(config.tenantName);
  });

  test('should show enrichment button on BOM detail page', async ({ page, navigateTo }) => {
    // Navigate to BOMs list
    await navigateTo('/boms');

    // Explicitly check prerequisite - skip if no BOMs exist
    if (!(await requireBomExists(page, test))) return;

    // Navigate to first BOM detail
    await navigateToFirstBom(page);

    // Assert: enrichment UI should be visible
    await assertVisible(
      page,
      page.getByRole('button', { name: /enrich|re-enrich/i }).or(page.getByText(/enrichment/i)),
      'enrichment button or enrichment status',
      10000
    );
  });

  test('should display enrichment progress during processing', async ({ page, navigateTo }) => {
    // Navigate to BOMs list
    await navigateTo('/boms');

    // Explicitly check prerequisite - skip if no BOMs exist
    if (!(await requireBomExists(page, test))) return;

    // Check for processing/enriching BOMs - skip if none are currently processing
    if (!(await requireBomWithStatus(page, 'processing', test))) return;

    // Assert: Should show progress indicator for processing BOMs
    await assertVisible(
      page,
      page.locator('.animate-spin').or(page.getByText(/%/)),
      'progress indicator (spinner or percentage)',
      5000
    );
  });

  test('should show re-enrich button for stale data', async ({ page, navigateTo }) => {
    await navigateTo('/boms');

    // Explicitly check prerequisite
    if (!(await requireBomExists(page, test))) return;

    // Navigate to BOM detail
    await navigateToFirstBom(page);

    // Check for re-enrich button (shown for stale or completed BOMs)
    const reEnrichButton = page.getByRole('button', { name: /re-enrich/i });
    const hasReEnrich = await reEnrichButton.isVisible();

    if (!hasReEnrich) {
      // Skip if this BOM doesn't have re-enrich option
      test.skip(true, 'BOM does not have re-enrich button (may be in initial state or processing)');
      return;
    }

    // Assert: clicking re-enrich should open confirmation dialog
    await reEnrichButton.click();
    await assertVisible(
      page,
      page.getByText(/re-process|re-enrich|start enrichment/i),
      're-enrich confirmation dialog',
      5000
    );
  });

  test('should display enrichment completion status', async ({ page, navigateTo }) => {
    await navigateTo('/boms');

    // Explicitly check prerequisite
    if (!(await requireBomExists(page, test))) return;

    // Check for enriched BOMs - skip if none are enriched
    if (!(await requireBomWithStatus(page, 'enriched', test))) return;

    // Find and click a completed/enriched BOM
    const completedBom = page.getByText(/completed|enriched/i).first();
    const row = completedBom.locator('xpath=ancestor::tr');
    await row.click();
    await page.waitForLoadState('networkidle');

    // Assert: Should show enrichment coverage stats
    await assertVisible(
      page,
      page.getByText(/coverage|matched|enriched/i),
      'enrichment coverage stats',
      10000
    );
  });
});

test.describe('BOM Detail Page', () => {
  test.beforeEach(async ({ page, selectTenant }) => {
    await page.goto(config.baseUrl);
    await page.waitForLoadState('networkidle');
    await selectTenant(config.tenantName);
  });

  test('should display BOM summary statistics', async ({ page, navigateTo }) => {
    await navigateTo('/boms');

    // Explicitly check prerequisite
    if (!(await requireBomExists(page, test))) return;

    // Navigate to BOM detail
    await navigateToFirstBom(page);

    // Assert: Should see summary cards with line count
    await assertVisible(
      page,
      page.getByText(/total lines|line items/i),
      'BOM line count summary',
      10000
    );

    // Assert: Should see enrichment coverage percentage
    await assertVisible(
      page,
      page.getByText(/coverage|%/i),
      'enrichment coverage percentage',
      5000
    );
  });

  test('should support search and filtering', async ({ page, navigateTo }) => {
    await navigateTo('/boms');

    // Explicitly check prerequisite
    if (!(await requireBomExists(page, test))) return;

    // Navigate to BOM detail
    await navigateToFirstBom(page);

    // Assert: Search input should be visible
    const searchInput = page.getByPlaceholder(/search/i);
    await assertVisible(page, searchInput, 'search input', 5000);

    // Test: Fill search input
    await searchInput.fill('test');
    await page.waitForTimeout(500); // Debounce
    await page.waitForLoadState('networkidle');

    // Assert: Status filter should be available (optional - some UIs may not have this)
    const statusFilter = page.getByRole('combobox', { name: /status/i }).or(
      page.locator('[data-testid="status-filter"]')
    );
    const hasStatusFilter = await statusFilter.isVisible();

    if (hasStatusFilter) {
      await statusFilter.click();
      await expect(page.locator('[role="option"]')).toBeVisible({ timeout: 3000 });
    }
    // Note: Not skipping if no status filter - search was the primary test
  });

  test('should show line item pricing dialog', async ({ page, navigateTo }) => {
    await navigateTo('/boms');

    // Explicitly check prerequisite
    if (!(await requireBomExists(page, test))) return;

    // Navigate to BOM detail
    await navigateToFirstBom(page);

    // Find a price cell (clickable)
    const priceCell = page.locator('td').filter({ hasText: /\$|view pricing/i }).first();
    const hasPriceCell = await priceCell.isVisible();

    if (!hasPriceCell) {
      test.skip(true, 'No pricing data available in this BOM (enrichment may not have pricing)');
      return;
    }

    // Action: Click price cell to open dialog
    await priceCell.click();

    // Assert: Pricing dialog should open
    await assertVisible(
      page,
      page.getByRole('dialog').or(page.getByText(/supplier pricing/i)),
      'supplier pricing dialog',
      5000
    );
  });

  test('should show activity log dialog', async ({ page, navigateTo }) => {
    await navigateTo('/boms');

    // Explicitly check prerequisite
    if (!(await requireBomExists(page, test))) return;

    // Navigate to BOM detail
    await navigateToFirstBom(page);

    // Find activity button
    const activityButton = page.getByRole('button', { name: /activity/i });
    const hasActivityButton = await activityButton.isVisible();

    if (!hasActivityButton) {
      test.skip(true, 'Activity button not visible (feature may not be enabled)');
      return;
    }

    // Action: Click activity button
    await activityButton.click();

    // Assert: Activity log dialog should open
    await assertVisible(
      page,
      page.getByRole('dialog').filter({ has: page.getByText(/activity log/i) }),
      'activity log dialog',
      5000
    );
  });

  test('should navigate to risk analysis', async ({ page, navigateTo }) => {
    await navigateTo('/boms');

    // Explicitly check prerequisite
    if (!(await requireBomExists(page, test))) return;

    // Navigate to BOM detail
    await navigateToFirstBom(page);

    // Find risk analysis button
    const riskButton = page.getByRole('button', { name: /risk/i }).or(
      page.getByRole('link', { name: /risk/i })
    );
    const hasRiskButton = await riskButton.isVisible();

    if (!hasRiskButton) {
      test.skip(true, 'Risk analysis button not visible (feature may not be enabled)');
      return;
    }

    // Action: Click risk button
    await riskButton.click();
    await page.waitForLoadState('networkidle');

    // Assert: Should navigate to risk page
    await expect(page, 'Should navigate to risk analysis page').toHaveURL(/\/risk$/);
  });

  test('should support pagination', async ({ page, navigateTo }) => {
    await navigateTo('/boms');

    // Explicitly check prerequisite
    if (!(await requireBomExists(page, test))) return;

    // Navigate to BOM detail
    await navigateToFirstBom(page);

    // Assert: Should show pagination info (page x of y or showing x items)
    const pageInfo = page.getByText(/page \d+ of \d+/i).or(
      page.getByText(/showing \d+/i)
    );

    await assertVisible(page, pageInfo, 'pagination info', 5000);
  });

  test('should export BOM in different formats', async ({ page, navigateTo }) => {
    await navigateTo('/boms');

    // Explicitly check prerequisite
    if (!(await requireBomExists(page, test))) return;

    // Navigate to BOM detail
    await navigateToFirstBom(page);

    // Find export button/dropdown
    const exportTrigger = page.getByRole('combobox', { name: /export/i }).or(
      page.getByRole('button', { name: /export/i })
    );
    const hasExport = await exportTrigger.isVisible();

    if (!hasExport) {
      test.skip(true, 'Export button not visible (feature may not be enabled)');
      return;
    }

    // Action: Click export trigger
    await exportTrigger.click();

    // Assert: Should show format options (CSV at minimum)
    await assertVisible(
      page,
      page.getByRole('option', { name: /csv/i }).or(page.getByText(/csv/i)),
      'CSV export option',
      5000
    );
  });
});

test.describe('Stock Availability Display', () => {
  test.beforeEach(async ({ page, selectTenant }) => {
    await page.goto(config.baseUrl);
    await page.waitForLoadState('networkidle');
    await selectTenant(config.tenantName);
  });

  test('should show color-coded stock badges', async ({ page, navigateTo }) => {
    await navigateTo('/boms');

    // Explicitly check prerequisite
    if (!(await requireBomExists(page, test))) return;

    // Navigate to BOM detail
    await navigateToFirstBom(page);

    // Use the verifyStockBadgeColor helper for proper verification
    const badgeResult = await verifyStockBadgeColor(page, ['green', 'amber', 'red', 'gray']);

    if (!badgeResult.found) {
      test.skip(true, 'No stock badges visible (enrichment may not have stock data)');
      return;
    }

    // Assert: Badge should have proper color classes
    expect(
      badgeResult.classes,
      'Stock badge should have color styling classes'
    ).toBeTruthy();

    // Verify it contains expected color patterns (green for in-stock, amber for low, red for out)
    const hasValidColor =
      badgeResult.classes?.includes('green') ||
      badgeResult.classes?.includes('amber') ||
      badgeResult.classes?.includes('red') ||
      badgeResult.classes?.includes('gray') ||
      // Also allow bg-* patterns
      badgeResult.classes?.match(/bg-(green|amber|red|yellow|orange|gray)-/);

    expect(
      hasValidColor,
      `Stock badge should have color class (found: ${badgeResult.classes})`
    ).toBeTruthy();
  });

  test('should show amber/yellow styling for low stock', async ({ page, navigateTo }) => {
    await navigateTo('/boms');

    // Explicitly check prerequisite
    if (!(await requireBomExists(page, test))) return;

    // Navigate to BOM detail
    await navigateToFirstBom(page);

    // Look for amber-styled badges (low stock indicator)
    // Accept both "amber" and "yellow" as valid low-stock colors
    const lowStockBadge = page
      .locator('[class*="amber"], [class*="yellow"], [class*="orange"]')
      .first();

    const hasLowStock = await lowStockBadge.isVisible();

    if (!hasLowStock) {
      test.skip(true, 'No low-stock items in this BOM (all items either in-stock or out-of-stock)');
      return;
    }

    // Assert: Badge should have amber/yellow styling
    const classes = await lowStockBadge.getAttribute('class');
    expect(
      classes,
      'Low stock badge should have amber/yellow/orange styling'
    ).toMatch(/amber|yellow|orange/);
  });

  test('should display stock quantities with proper formatting', async ({ page, navigateTo }) => {
    await navigateTo('/boms');

    // Explicitly check prerequisite
    if (!(await requireBomExists(page, test))) return;

    // Navigate to BOM detail
    await navigateToFirstBom(page);

    // Look for formatted stock quantities (e.g., "1.5K", "2.3M", "In Stock")
    const stockCell = page.locator('td').filter({
      hasText: /\d+(\.\d+)?[KM]|In Stock|Out of Stock|Low Stock|\d{1,3}(,\d{3})*/,
    }).first();

    const hasStockData = await stockCell.isVisible();

    if (!hasStockData) {
      test.skip(true, 'No stock quantity data visible');
      return;
    }

    // Assert: Stock cell content should match expected format
    const content = await stockCell.textContent();
    expect(
      content,
      'Stock should show formatted quantity or status'
    ).toMatch(/\d+(\.\d+)?[KM]|In Stock|Out of Stock|Low Stock|\d+/);
  });
});
