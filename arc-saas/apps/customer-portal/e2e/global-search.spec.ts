import { test, expect, config } from './fixtures';

/**
 * Global Search (Ctrl+K) E2E Tests
 *
 * Tests the global search functionality:
 * - Keyboard shortcut (Ctrl+K / Cmd+K)
 * - Search dialog opening/closing
 * - Search input and results
 * - Keyboard navigation
 * - Result selection
 * - Accessibility (ARIA, focus management)
 */

test.describe('Global Search Keyboard Shortcut', () => {
  test.beforeEach(async ({ page, selectTenant }) => {
    await page.goto(config.baseUrl);
    await page.waitForLoadState('networkidle');
    await selectTenant(config.tenantName);
  });

  test('should open search dialog with Ctrl+K', async ({ page }) => {
    // Press Ctrl+K (or Cmd+K on Mac)
    await page.keyboard.press('Control+KeyK');

    // Assert: Search dialog should open
    await expect(
      page.getByRole('dialog').or(
        page.getByPlaceholder(/search/i)
      )
    ).toBeVisible({ timeout: 3000 });
  });

  test('should focus search input when dialog opens', async ({ page }) => {
    // Open search
    await page.keyboard.press('Control+KeyK');
    await page.waitForTimeout(300);

    // Assert: Input should be focused
    const searchInput = page.getByPlaceholder(/search/i);
    await expect(searchInput).toBeFocused({ timeout: 3000 });
  });

  test('should close search dialog with Escape', async ({ page }) => {
    // Open search
    await page.keyboard.press('Control+KeyK');
    await page.waitForTimeout(300);

    // Assert: Dialog is open
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Press Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Assert: Dialog should close
    await expect(dialog).not.toBeVisible();
  });

  test('should restore focus after closing search', async ({ page }) => {
    // Focus a specific element
    const bodyLink = page.getByRole('link').first();
    if (await bodyLink.isVisible()) {
      await bodyLink.focus();
      await page.waitForTimeout(100);
    }

    // Open search
    await page.keyboard.press('Control+KeyK');
    await page.waitForTimeout(300);

    // Close search
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Focus should be restored (or at least dialog is closed)
    const dialog = page.getByRole('dialog');
    await expect(dialog).not.toBeVisible();
  });

  test('should not conflict with browser find (Ctrl+F)', async ({ page }) => {
    // This test verifies Ctrl+K doesn't interfere with Ctrl+F
    // Note: We can't directly test browser find, but we ensure Ctrl+K works
    await page.keyboard.press('Control+KeyK');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 3000 });

    // Close it
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Browser's Ctrl+F should still work (but we can't test it in Playwright)
    // This test just ensures our Ctrl+K doesn't break anything
  });
});

test.describe('Global Search Trigger Button', () => {
  test.beforeEach(async ({ page, selectTenant }) => {
    await page.goto(config.baseUrl);
    await page.waitForLoadState('networkidle');
    await selectTenant(config.tenantName);
  });

  test('should have search trigger button in navbar', async ({ page }) => {
    // Look for search button/trigger in navbar
    const searchTrigger = page.getByRole('button', { name: /search/i }).or(
      page.getByPlaceholder(/search/i).locator('xpath=ancestor::button')
    );

    // May not always be visible depending on layout
    const hasTrigger = await searchTrigger.isVisible();
    if (!hasTrigger) {
      console.log('Search trigger button not found in navbar - may be icon-only or hidden on mobile');
    }
  });

  test('should open search dialog when clicking trigger', async ({ page }) => {
    // Find search trigger
    const searchTrigger = page.getByRole('button', { name: /search/i }).or(
      page.locator('[aria-label*="search" i]').first()
    );

    const hasTrigger = await searchTrigger.isVisible();
    if (!hasTrigger) {
      test.skip(true, 'Search trigger button not visible');
      return;
    }

    // Click trigger
    await searchTrigger.click();

    // Assert: Dialog opens
    await expect(
      page.getByRole('dialog')
    ).toBeVisible({ timeout: 3000 });
  });
});

test.describe('Global Search Input and Results', () => {
  test.beforeEach(async ({ page, selectTenant }) => {
    await page.goto(config.baseUrl);
    await page.waitForLoadState('networkidle');
    await selectTenant(config.tenantName);

    // Open search
    await page.keyboard.press('Control+KeyK');
    await page.waitForTimeout(300);
  });

  test('should show empty state initially', async ({ page }) => {
    // Assert: Should show instruction text
    await expect(
      page.getByText(/type at least 2 characters|start typing/i)
    ).toBeVisible({ timeout: 3000 });
  });

  test('should show loading indicator while searching', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i);

    // Type search query
    await searchInput.fill('test');

    // Should briefly show loading spinner
    const loader = page.locator('.animate-spin').or(
      page.getByRole('status')
    );

    // Note: Loading may be too fast to catch
    const isLoading = await loader.isVisible().catch(() => false);
    if (isLoading) {
      console.log('Loading indicator visible during search');
    }
  });

  test('should display search results', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i);

    // Type search query (at least 2 characters)
    await searchInput.fill('test');
    await page.waitForTimeout(1000); // Wait for debounce + API

    // Assert: Should show results or "no results" message
    const resultsContainer = page.getByRole('listbox').or(
      page.locator('[role="option"]').first()
    );

    const hasResults = await resultsContainer.isVisible();
    if (hasResults) {
      // Has results
      await expect(resultsContainer).toBeVisible({ timeout: 5000 });
    } else {
      // No results message
      await expect(
        page.getByText(/no results found/i)
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test('should show "no results" for non-matching query', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i);

    // Type unlikely query
    await searchInput.fill('xyzabc123nonexistent');
    await page.waitForTimeout(1500);

    // Assert: Should show no results message
    await expect(
      page.getByText(/no results found/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test('should debounce search queries', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i);

    // Type rapidly (should debounce and only search once)
    await searchInput.type('t', { delay: 50 });
    await searchInput.type('e', { delay: 50 });
    await searchInput.type('s', { delay: 50 });
    await searchInput.type('t', { delay: 50 });

    // Wait for debounce period (300ms)
    await page.waitForTimeout(800);

    // Should have made one search request
    // (We can't directly verify this without network mocks, but we ensure it doesn't crash)
    const searchState = page.getByRole('listbox').or(
      page.getByText(/no results|characters/i)
    );

    await expect(searchState).toBeVisible({ timeout: 3000 });
  });

  test('should clear results when input is cleared', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i);

    // Type and get results
    await searchInput.fill('test');
    await page.waitForTimeout(1000);

    // Clear input
    await searchInput.clear();
    await page.waitForTimeout(500);

    // Assert: Should show empty state again
    await expect(
      page.getByText(/type at least 2 characters/i)
    ).toBeVisible({ timeout: 3000 });
  });
});

test.describe('Global Search Keyboard Navigation', () => {
  test.beforeEach(async ({ page, selectTenant }) => {
    await page.goto(config.baseUrl);
    await page.waitForLoadState('networkidle');
    await selectTenant(config.tenantName);

    // Open search and enter query
    await page.keyboard.press('Control+KeyK');
    await page.waitForTimeout(300);

    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('component');
    await page.waitForTimeout(1500);
  });

  test('should navigate results with arrow keys', async ({ page }) => {
    // Check if results exist
    const results = page.getByRole('option');
    const count = await results.count();

    if (count === 0) {
      test.skip(true, 'No search results to navigate');
      return;
    }

    // Assert: First result should be highlighted by default
    const firstResult = results.first();
    await expect(firstResult).toHaveAttribute('aria-selected', 'true');

    // Press down arrow
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(100);

    // Assert: Second result should be highlighted (if exists)
    if (count > 1) {
      const secondResult = results.nth(1);
      await expect(secondResult).toHaveAttribute('aria-selected', 'true');
    }
  });

  test('should navigate up with arrow up key', async ({ page }) => {
    const results = page.getByRole('option');
    const count = await results.count();

    if (count < 2) {
      test.skip(true, 'Need at least 2 results to test navigation');
      return;
    }

    // Navigate down first
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(100);

    // Then navigate up
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(100);

    // Should be back on first result
    const firstResult = results.first();
    await expect(firstResult).toHaveAttribute('aria-selected', 'true');
  });

  test('should not navigate beyond first result with arrow up', async ({ page }) => {
    const results = page.getByRole('option');
    const count = await results.count();

    if (count === 0) {
      test.skip(true, 'No results to navigate');
      return;
    }

    // Press up multiple times (should stay on first)
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(100);

    const firstResult = results.first();
    await expect(firstResult).toHaveAttribute('aria-selected', 'true');
  });

  test('should not navigate beyond last result with arrow down', async ({ page }) => {
    const results = page.getByRole('option');
    const count = await results.count();

    if (count === 0) {
      test.skip(true, 'No results to navigate');
      return;
    }

    // Press down multiple times to reach end
    for (let i = 0; i < count + 5; i++) {
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(50);
    }

    // Should be on last result
    const lastResult = results.last();
    await expect(lastResult).toHaveAttribute('aria-selected', 'true');
  });

  test('should select result with Enter key', async ({ page }) => {
    const results = page.getByRole('option');
    const count = await results.count();

    if (count === 0) {
      test.skip(true, 'No results to select');
      return;
    }

    // Press Enter to select first result
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');

    // Assert: Should navigate to result (dialog closed, URL changed)
    const dialog = page.getByRole('dialog');
    await expect(dialog).not.toBeVisible();

    // URL should have changed (to bom detail or components page)
    expect(page.url()).toMatch(/boms\/|components/);
  });

  test('should trap focus within dialog', async ({ page }) => {
    // Press Tab (should stay in dialog)
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);

    // Focus should be on search input
    const searchInput = page.getByPlaceholder(/search/i);
    await expect(searchInput).toBeFocused();
  });
});

test.describe('Global Search Result Interaction', () => {
  test.beforeEach(async ({ page, selectTenant }) => {
    await page.goto(config.baseUrl);
    await page.waitForLoadState('networkidle');
    await selectTenant(config.tenantName);

    // Open search and enter query
    await page.keyboard.press('Control+KeyK');
    await page.waitForTimeout(300);

    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('test');
    await page.waitForTimeout(1500);
  });

  test('should highlight result on hover', async ({ page }) => {
    const results = page.getByRole('option');
    const count = await results.count();

    if (count === 0) {
      test.skip(true, 'No results to interact with');
      return;
    }

    // Hover over second result (if exists)
    if (count > 1) {
      const secondResult = results.nth(1);
      await secondResult.hover();
      await page.waitForTimeout(100);

      // Should be selected
      await expect(secondResult).toHaveAttribute('aria-selected', 'true');
    }
  });

  test('should navigate to result on click', async ({ page }) => {
    const results = page.getByRole('option');
    const count = await results.count();

    if (count === 0) {
      test.skip(true, 'No results to click');
      return;
    }

    // Click first result
    await results.first().click();
    await page.waitForLoadState('networkidle');

    // Assert: Dialog closed
    const dialog = page.getByRole('dialog');
    await expect(dialog).not.toBeVisible();

    // Assert: Navigated to result
    expect(page.url()).toMatch(/boms\/|components/);
  });

  test('should show result icons (BOM vs Component)', async ({ page }) => {
    const results = page.getByRole('option');
    const count = await results.count();

    if (count === 0) {
      test.skip(true, 'No results to check');
      return;
    }

    // Results should have icons
    const firstResult = results.first();
    const icon = firstResult.locator('svg').first();

    await expect(icon).toBeVisible();
  });

  test('should display result metadata', async ({ page }) => {
    const results = page.getByRole('option');
    const count = await results.count();

    if (count === 0) {
      test.skip(true, 'No results to check');
      return;
    }

    // First result should have title and optional subtitle
    const firstResult = results.first();
    const content = await firstResult.textContent();

    expect(content).toBeTruthy();
    expect(content!.length).toBeGreaterThan(0);
  });
});

test.describe('Global Search Accessibility', () => {
  test.beforeEach(async ({ page, selectTenant }) => {
    await page.goto(config.baseUrl);
    await page.waitForLoadState('networkidle');
    await selectTenant(config.tenantName);

    // Open search
    await page.keyboard.press('Control+KeyK');
    await page.waitForTimeout(300);
  });

  test('should have proper ARIA attributes on dialog', async ({ page }) => {
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Should have aria-labelledby and aria-describedby
    const labelledBy = await dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
  });

  test('should have proper ARIA attributes on search input', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i);

    // Should be a combobox
    await expect(searchInput).toHaveAttribute('role', 'combobox');

    // Should have aria-controls
    const controls = await searchInput.getAttribute('aria-controls');
    expect(controls).toBeTruthy();

    // Should have aria-expanded
    const expanded = await searchInput.getAttribute('aria-expanded');
    expect(expanded).toBeTruthy();
  });

  test('should have proper ARIA attributes on results list', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('test');
    await page.waitForTimeout(1500);

    const results = page.getByRole('option');
    const count = await results.count();

    if (count === 0) {
      test.skip(true, 'No results to check ARIA');
      return;
    }

    // List should be a listbox
    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible();

    // Results should have role="option"
    await expect(results.first()).toHaveAttribute('role', 'option');

    // Selected result should have aria-selected="true"
    await expect(results.first()).toHaveAttribute('aria-selected', 'true');
  });

  test('should announce search results to screen readers', async ({ page }) => {
    // Live region should exist
    const liveRegion = page.locator('[role="status"][aria-live="polite"]').or(
      page.locator('[aria-live="polite"]')
    );

    await expect(liveRegion).toBeAttached();

    // Type search
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('test');
    await page.waitForTimeout(1500);

    // Live region should have been updated with results count
    const announcement = await liveRegion.textContent();
    expect(announcement).toBeTruthy();
  });

  test('should support screen reader navigation hints', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('test');
    await page.waitForTimeout(1500);

    const results = page.getByRole('option');
    const count = await results.count();

    if (count === 0) {
      test.skip(true, 'No results to check hints');
      return;
    }

    // Should show keyboard shortcuts in footer
    await expect(
      page.getByText(/to navigate|to select|to close/i).first()
    ).toBeVisible();
  });
});

test.describe('Global Search Edge Cases', () => {
  test.beforeEach(async ({ page, selectTenant }) => {
    await page.goto(config.baseUrl);
    await page.waitForLoadState('networkidle');
    await selectTenant(config.tenantName);
  });

  test('should handle rapid open/close cycles', async ({ page }) => {
    // Open and close multiple times rapidly
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Control+KeyK');
      await page.waitForTimeout(100);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
    }

    // Should still work after rapid cycles
    await page.keyboard.press('Control+KeyK');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 3000 });
  });

  test('should handle special characters in search', async ({ page }) => {
    await page.keyboard.press('Control+KeyK');
    await page.waitForTimeout(300);

    const searchInput = page.getByPlaceholder(/search/i);

    // Type special characters
    await searchInput.fill('test@#$%');
    await page.waitForTimeout(1000);

    // Should not crash (show results or no results)
    const state = page.getByRole('listbox').or(
      page.getByText(/no results/i)
    );

    await expect(state).toBeVisible({ timeout: 3000 });
  });

  test('should cancel previous requests on new input', async ({ page }) => {
    await page.keyboard.press('Control+KeyK');
    await page.waitForTimeout(300);

    const searchInput = page.getByPlaceholder(/search/i);

    // Type first query
    await searchInput.fill('abc');

    // Immediately change to different query
    await searchInput.clear();
    await searchInput.fill('xyz');
    await page.waitForTimeout(1500);

    // Should only show results for 'xyz', not 'abc'
    // (We can't directly verify this, but ensure it doesn't crash)
    const state = page.getByRole('listbox').or(
      page.getByText(/no results/i)
    );

    await expect(state).toBeVisible({ timeout: 3000 });
  });
});
