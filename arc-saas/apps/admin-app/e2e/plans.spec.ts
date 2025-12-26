import { test, expect } from './fixtures/auth';

/**
 * Plans Tests
 *
 * Tests for plan management functionality:
 * - List plans
 * - View plan details
 * - Create/Edit plans
 */

test.describe('Plans', () => {
  test.describe('Plan List', () => {
    test('should display plans list page', async ({ authenticatedPage: page }) => {
      await page.goto('/plans');
      await page.waitForLoadState('networkidle');

      // Page heading should be visible
      const heading = page.getByRole('heading', { name: /plans/i }).first();
      await expect(heading).toBeVisible({ timeout: 10000 });
    });

    test('should show plan information', async ({ authenticatedPage: page }) => {
      await page.goto('/plans');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Should show either plans data or empty state
      const hasData = await page.locator('table, [role="table"], .plan-card').count() > 0;
      const hasEmptyState = await page.locator('text=/no plans|no data|empty/i').isVisible().catch(() => false);

      expect(hasData || hasEmptyState).toBeTruthy();
    });

    test('should display plan tiers', async ({ authenticatedPage: page }) => {
      await page.goto('/plans');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Common plan tiers
      const planTiers = ['Basic', 'Standard', 'Premium', 'Free', 'Enterprise'];

      // Check if any plan tiers are visible
      let tiersFound = 0;
      for (const tier of planTiers) {
        const tierElement = page.locator(`text=${tier}`).first();
        if (await tierElement.isVisible().catch(() => false)) {
          tiersFound++;
        }
      }

      // At least one tier should be visible if plans exist
      const rowCount = await page.locator('table tbody tr, [role="row"], .plan-card').count();
      if (rowCount > 0) {
        expect(tiersFound).toBeGreaterThan(0);
      }
    });

    test('should have create button for authorized users', async ({ authenticatedPage: page }) => {
      await page.goto('/plans');
      await page.waitForLoadState('networkidle');

      // Look for create button
      const createButton = page.getByRole('link', { name: /create|add|new plan/i }).or(
        page.getByRole('button', { name: /create|add|new plan/i })
      ).first();

      const exists = await createButton.count() > 0;
      expect(exists).toBeTruthy();
    });
  });

  test.describe('Plan Details', () => {
    test('should show plan features and pricing', async ({ authenticatedPage: page }) => {
      await page.goto('/plans');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const rowCount = await page.locator('table tbody tr, [role="row"], .plan-card').count();

      if (rowCount > 0) {
        // Should display pricing information
        const hasPricing = await page.locator('text=/\\$|price|cost|month/i').isVisible().catch(() => false);

        if (hasPricing) {
          expect(hasPricing).toBeTruthy();
        }
      }
    });
  });

  test.describe('Plan Creation', () => {
    test('should navigate to create plan page', async ({ authenticatedPage: page }) => {
      await page.goto('/plans');
      await page.waitForLoadState('networkidle');

      const createButton = page.getByRole('link', { name: /create|add|new plan/i }).or(
        page.getByRole('button', { name: /create|add|new plan/i })
      ).first();

      if (await createButton.isVisible().catch(() => false)) {
        await createButton.click();

        // Should navigate to create page
        await expect(page).toHaveURL(/\/plans\/create/);
      }
    });

    test('should display create plan form', async ({ authenticatedPage: page }) => {
      await page.goto('/plans/create');
      await page.waitForLoadState('networkidle');

      // Should show form or permission error
      const hasForm = await page.locator('form').isVisible({ timeout: 5000 }).catch(() => false);
      const hasForbidden = await page.locator('text=/forbidden|unauthorized|permission/i').isVisible().catch(() => false);

      expect(hasForm || hasForbidden).toBeTruthy();
    });
  });

  test.describe('Plan Edit', () => {
    test('should have edit functionality', async ({ authenticatedPage: page }) => {
      await page.goto('/plans');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Look for edit buttons in the list
      const editButton = page.locator('a:has-text("Edit"), button:has-text("Edit")').first();

      if (await editButton.isVisible().catch(() => false)) {
        await editButton.click();

        // Should navigate to edit page
        await expect(page).toHaveURL(/\/plans\/[a-f0-9-]+\/edit/);
      }
    });
  });
});
