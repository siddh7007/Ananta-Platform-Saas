import { test, expect } from './fixtures';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Compliance - WCAG 2.1 AA', () => {
  test('Dashboard has no accessibility violations', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    
    expect(results.violations).toEqual([]);
    console.log(`Dashboard: ${results.passes.length} checks passed`);
  });

  test('BOM List has no accessibility violations', async ({ page }) => {
    await page.goto('/boms');
    await page.waitForLoadState('networkidle');
    
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    
    expect(results.violations).toEqual([]);
  });

  test('Team Management has no accessibility violations', async ({ page }) => {
    await page.goto('/team');
    await page.waitForLoadState('networkidle');
    
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    
    expect(results.violations).toEqual([]);
  });
});

test.describe('Keyboard Navigation', () => {
  test('Can navigate Dashboard with keyboard', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    await page.keyboard.press('Tab');
    const firstFocusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(firstFocusedElement).toBeTruthy();
  });
});

test.describe('Screen Reader Compatibility', () => {
  test('All images have alt text', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    const results = await new AxeBuilder({ page })
      .withRules(['image-alt'])
      .analyze();
    
    expect(results.violations).toEqual([]);
  });

  test('All form inputs have labels', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    
    const results = await new AxeBuilder({ page })
      .withRules(['label'])
      .analyze();
    
    expect(results.violations).toEqual([]);
  });
});
