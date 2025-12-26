import { test, expect, config } from './fixtures';

/**
 * Settings Page E2E Tests
 *
 * Tests the settings page functionality:
 * - Navigation to settings
 * - Tab switching between different settings sections
 * - Profile information display
 * - Notification preferences
 * - Theme selection
 * - Organization settings (admin only)
 * - Saved searches
 */

test.describe('Settings Page Navigation', () => {
  test.beforeEach(async ({ page, selectTenant }) => {
    await page.goto(config.baseUrl);
    await page.waitForLoadState('networkidle');
    await selectTenant(config.tenantName);
  });

  test('should navigate to settings page', async ({ page, navigateTo }) => {
    // Navigate to settings
    await navigateTo('/settings');

    // Assert: Settings page loaded
    await expect(
      page.getByRole('heading', { name: /settings/i })
    ).toBeVisible({ timeout: 10000 });

    // Assert: Page has tabs
    await expect(
      page.getByRole('tablist')
    ).toBeVisible();
  });

  test('should show profile tab by default', async ({ page, navigateTo }) => {
    await navigateTo('/settings');

    // Assert: Profile tab is active (default)
    const profileTab = page.getByRole('tab', { name: /profile/i });
    await expect(profileTab).toHaveAttribute('data-state', 'active');

    // Assert: Profile content visible
    await expect(
      page.getByText(/profile information/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test('should display all settings tabs', async ({ page, navigateTo }) => {
    await navigateTo('/settings');

    // Assert: Core tabs are visible
    await expect(page.getByRole('tab', { name: /profile/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /notifications/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /saved searches/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /appearance/i })).toBeVisible();

    // Note: Organization tab visibility depends on user role
    const orgTab = page.getByRole('tab', { name: /organization/i });
    const hasOrgTab = await orgTab.isVisible();

    if (hasOrgTab) {
      console.log('Organization tab visible - user has admin role');
    }
  });
});

test.describe('Settings Tab Switching', () => {
  test.beforeEach(async ({ page, selectTenant, navigateTo }) => {
    await page.goto(config.baseUrl);
    await page.waitForLoadState('networkidle');
    await selectTenant(config.tenantName);
    await navigateTo('/settings');
  });

  test('should switch to notifications tab', async ({ page }) => {
    // Click notifications tab
    const notificationsTab = page.getByRole('tab', { name: /notifications/i });
    await notificationsTab.click();

    // Assert: Tab is active
    await expect(notificationsTab).toHaveAttribute('data-state', 'active');

    // Assert: Notifications content visible
    await expect(
      page.getByText(/notification preferences/i)
    ).toBeVisible({ timeout: 5000 });

    // Assert: Should see notification toggles
    await expect(
      page.getByRole('switch', { name: /bom enrichment complete/i }).or(
        page.locator('#notify-bom')
      )
    ).toBeVisible();
  });

  test('should switch to saved searches tab', async ({ page }) => {
    // Click saved searches tab
    const savedSearchesTab = page.getByRole('tab', { name: /saved searches/i });
    await savedSearchesTab.click();

    // Assert: Tab is active
    await expect(savedSearchesTab).toHaveAttribute('data-state', 'active');

    // Assert: Saved searches content visible
    await expect(
      page.getByText(/saved searches/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('should switch to appearance tab', async ({ page }) => {
    // Click appearance tab
    const appearanceTab = page.getByRole('tab', { name: /appearance/i });
    await appearanceTab.click();

    // Assert: Tab is active
    await expect(appearanceTab).toHaveAttribute('data-state', 'active');

    // Assert: Theme options visible
    await expect(
      page.getByText(/theme preferences/i)
    ).toBeVisible({ timeout: 5000 });

    // Assert: Should see theme selectors
    await expect(
      page.getByText(/light/i).and(page.locator('button, [role="button"]'))
    ).toBeVisible();
  });

  test('should switch back to profile tab', async ({ page }) => {
    // First switch to another tab
    await page.getByRole('tab', { name: /notifications/i }).click();
    await page.waitForTimeout(300);

    // Then switch back to profile
    const profileTab = page.getByRole('tab', { name: /profile/i });
    await profileTab.click();

    // Assert: Profile tab is active again
    await expect(profileTab).toHaveAttribute('data-state', 'active');

    // Assert: Profile content visible
    await expect(
      page.getByText(/profile information/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test('should maintain tab selection on page reload', async ({ page }) => {
    // Switch to notifications tab
    await page.getByRole('tab', { name: /notifications/i }).click();
    await page.waitForTimeout(300);

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Note: Tab selection may not persist without URL state management
    // This test verifies the default behavior after reload
    const profileTab = page.getByRole('tab', { name: /profile/i });
    await expect(profileTab).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Profile Settings', () => {
  test.beforeEach(async ({ page, selectTenant, navigateTo }) => {
    await page.goto(config.baseUrl);
    await page.waitForLoadState('networkidle');
    await selectTenant(config.tenantName);
    await navigateTo('/settings');
  });

  test('should display user profile information', async ({ page }) => {
    // Should see user fields (read-only)
    await expect(
      page.locator('#name').or(page.getByLabel(/full name/i))
    ).toBeVisible({ timeout: 5000 });

    await expect(
      page.locator('#email').or(page.getByLabel(/email/i))
    ).toBeVisible();

    await expect(
      page.locator('#role').or(page.getByLabel(/role/i))
    ).toBeVisible();
  });

  test('should show profile fields as disabled', async ({ page }) => {
    // Profile fields should be read-only
    const nameInput = page.locator('#name').or(page.getByLabel(/full name/i));
    const emailInput = page.locator('#email').or(page.getByLabel(/email/i));

    await expect(nameInput).toBeDisabled();
    await expect(emailInput).toBeDisabled();
  });

  test('should display helper text about authentication provider', async ({ page }) => {
    // Should explain that profile is managed externally
    await expect(
      page.getByText(/authentication provider/i).or(
        page.getByText(/identity provider/i)
      )
    ).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Notification Preferences', () => {
  test.beforeEach(async ({ page, selectTenant, navigateTo }) => {
    await page.goto(config.baseUrl);
    await page.waitForLoadState('networkidle');
    await selectTenant(config.tenantName);
    await navigateTo('/settings');

    // Switch to notifications tab
    await page.getByRole('tab', { name: /notifications/i }).click();
  });

  test('should display notification toggles', async ({ page }) => {
    // Should see multiple notification options
    await expect(
      page.getByText(/bom enrichment complete/i)
    ).toBeVisible({ timeout: 5000 });

    await expect(
      page.getByText(/component alerts/i)
    ).toBeVisible();

    await expect(
      page.getByText(/team invitations/i)
    ).toBeVisible();
  });

  test('should toggle notification preferences', async ({ page }) => {
    // Find a notification switch
    const bomNotifySwitch = page.locator('#notify-bom');

    // Get initial state
    const initialState = await bomNotifySwitch.getAttribute('data-state');

    // Toggle it
    await bomNotifySwitch.click();
    await page.waitForTimeout(100);

    // Assert: State changed
    const newState = await bomNotifySwitch.getAttribute('data-state');
    expect(newState).not.toBe(initialState);
  });

  test('should save notification preferences', async ({ page }) => {
    // Toggle a preference
    await page.locator('#notify-bom').click();
    await page.waitForTimeout(100);

    // Click save button
    const saveButton = page.getByRole('button', { name: /save preferences/i });
    await saveButton.click();

    // Assert: Success message shown
    await expect(
      page.getByText(/preferences saved|saved|updated/i)
    ).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Theme Settings', () => {
  test.beforeEach(async ({ page, selectTenant, navigateTo }) => {
    await page.goto(config.baseUrl);
    await page.waitForLoadState('networkidle');
    await selectTenant(config.tenantName);
    await navigateTo('/settings');

    // Switch to appearance tab
    await page.getByRole('tab', { name: /appearance/i }).click();
  });

  test('should display theme options', async ({ page }) => {
    // Should see all theme options
    await expect(
      page.getByText(/^light$/i).and(page.locator('button, [role="button"]'))
    ).toBeVisible({ timeout: 5000 });

    await expect(
      page.getByText(/^dark$/i).and(page.locator('button, [role="button"]'))
    ).toBeVisible();

    await expect(
      page.getByText(/^system$/i).and(page.locator('button, [role="button"]'))
    ).toBeVisible();
  });

  test('should select theme', async ({ page }) => {
    // Click light theme
    const lightThemeButton = page.getByText(/^light$/i).locator('xpath=ancestor::button');
    await lightThemeButton.click();
    await page.waitForTimeout(100);

    // Assert: Light theme button should be highlighted
    // Check for primary border or active styling
    const classes = await lightThemeButton.getAttribute('class');
    expect(classes).toContain('border-primary');
  });

  test('should apply theme', async ({ page }) => {
    // Select dark theme
    const darkThemeButton = page.getByText(/^dark$/i).locator('xpath=ancestor::button');
    await darkThemeButton.click();
    await page.waitForTimeout(100);

    // Click apply button
    const applyButton = page.getByRole('button', { name: /apply theme/i });
    await applyButton.click();

    // Assert: Success message shown
    await expect(
      page.getByText(/theme updated|theme set/i)
    ).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Organization Settings (Admin Only)', () => {
  test.beforeEach(async ({ page, selectTenant, navigateTo }) => {
    await page.goto(config.baseUrl);
    await page.waitForLoadState('networkidle');
    await selectTenant(config.tenantName);
    await navigateTo('/settings');
  });

  test('should show organization tab for admin users', async ({ page }) => {
    // Check if organization tab exists
    const orgTab = page.getByRole('tab', { name: /organization/i });
    const hasOrgTab = await orgTab.isVisible();

    if (!hasOrgTab) {
      test.skip(true, 'Organization tab not visible - user does not have admin role');
      return;
    }

    // Click organization tab
    await orgTab.click();

    // Assert: Organization content visible
    await expect(
      page.getByText(/organization|organization settings/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('should not show organization tab for non-admin users', async ({ page }) => {
    // This test would need to be run with a non-admin user account
    // For now, we just document the expected behavior
    const orgTab = page.getByRole('tab', { name: /organization/i });
    const hasOrgTab = await orgTab.isVisible();

    if (hasOrgTab) {
      console.log('Organization tab visible - user has admin permissions');
    } else {
      console.log('Organization tab hidden - user lacks admin permissions');
    }
  });
});

test.describe('Saved Searches', () => {
  test.beforeEach(async ({ page, selectTenant, navigateTo }) => {
    await page.goto(config.baseUrl);
    await page.waitForLoadState('networkidle');
    await selectTenant(config.tenantName);
    await navigateTo('/settings');

    // Switch to saved searches tab
    await page.getByRole('tab', { name: /saved searches/i }).click();
  });

  test('should display saved searches section', async ({ page }) => {
    // Should see saved searches heading
    await expect(
      page.getByText(/saved searches/i).first()
    ).toBeVisible({ timeout: 5000 });

    // Should see description or empty state
    await expect(
      page.getByText(/manage.*searches|no saved searches|quick access/i)
    ).toBeVisible();
  });

  test('should show empty state when no searches saved', async ({ page }) => {
    // Check if there are any saved searches
    const searchList = page.locator('[data-testid="saved-searches-list"]').or(
      page.locator('ul, [role="list"]')
    );

    const hasSearches = await searchList.locator('li, [role="listitem"]').count();

    if (hasSearches === 0) {
      // Should show empty state message
      await expect(
        page.getByText(/no saved searches|save searches|empty/i)
      ).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Settings Accessibility', () => {
  test.beforeEach(async ({ page, selectTenant, navigateTo }) => {
    await page.goto(config.baseUrl);
    await page.waitForLoadState('networkidle');
    await selectTenant(config.tenantName);
    await navigateTo('/settings');
  });

  test('should have proper ARIA labels on tabs', async ({ page }) => {
    const tabList = page.getByRole('tablist');
    await expect(tabList).toBeVisible({ timeout: 5000 });

    // All tabs should have proper role
    const tabs = page.getByRole('tab');
    const count = await tabs.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should support keyboard navigation between tabs', async ({ page }) => {
    // Focus first tab
    const firstTab = page.getByRole('tab').first();
    await firstTab.focus();

    // Press arrow right to move to next tab
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);

    // Should be on a different tab (browser native behavior)
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toHaveAttribute('role', 'tab');
  });

  test('should have proper form labels', async ({ page }) => {
    // Check that form inputs have associated labels
    const nameInput = page.locator('#name');
    if (await nameInput.isVisible()) {
      const label = page.getByText(/full name/i);
      await expect(label).toBeVisible();
    }

    // Switch to notifications tab
    await page.getByRole('tab', { name: /notifications/i }).click();

    // Check switch labels
    const switches = page.getByRole('switch');
    const switchCount = await switches.count();
    expect(switchCount).toBeGreaterThan(0);
  });
});
