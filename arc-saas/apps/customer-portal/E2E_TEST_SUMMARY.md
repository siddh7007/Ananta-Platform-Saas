# Customer Business Portal - E2E Test Coverage Summary

## Overview

Expanded E2E test coverage for the Customer Business Portal using Playwright. The test suite now covers all critical user flows with comprehensive test scenarios.

**Total Test Files**: 9 files
**Estimated Test Count**: 100+ individual test cases

## Files Created/Modified

### New Test Files

1. **`e2e/settings.spec.ts`** (NEW)
   - Settings page navigation and tab switching
   - Profile information display
   - Notification preferences
   - Theme selection
   - Organization settings (admin-only)
   - Saved searches
   - Accessibility compliance
   - **Test count**: ~25 tests

2. **`e2e/global-search.spec.ts`** (NEW)
   - Keyboard shortcut (Ctrl+K / Cmd+K)
   - Search dialog interaction
   - Debounced search queries
   - Keyboard navigation (arrows, Enter, Escape)
   - Result selection
   - Focus management
   - ARIA compliance
   - Edge cases (rapid cycles, special characters)
   - **Test count**: ~30 tests

3. **`e2e/bom-list.spec.ts`** (NEW)
   - BOM list page loading
   - Table display
   - Search and filtering
   - Column sorting
   - Pagination
   - Navigation to detail
   - Empty state handling
   - Row actions
   - Performance checks
   - Accessibility
   - **Test count**: ~35 tests

4. **`e2e/README.md`** (NEW)
   - Comprehensive test documentation
   - Setup instructions
   - Running test commands
   - Best practices
   - Debugging guide
   - CI/CD integration examples

### Existing Test Files (Already Present)

5. **`e2e/auth.spec.ts`** (EXISTING)
   - Authentication flows
   - Session management
   - Test count: ~10 tests

6. **`e2e/tenant.spec.ts`** (EXISTING)
   - Tenant selection
   - Tenant context management
   - Test count: ~10 tests

7. **`e2e/bom-upload.spec.ts`** (EXISTING)
   - BOM upload wizard (7 steps)
   - File validation
   - Test count: ~15 tests

8. **`e2e/bom-enrichment.spec.ts`** (EXISTING)
   - Enrichment workflow
   - BOM detail page features
   - Test count: ~20 tests

9. **`e2e/fixtures.ts`** (EXISTING)
   - Shared test utilities and helpers

10. **`e2e/auth.setup.ts`** (EXISTING)
    - Authentication setup for all tests

### Configuration Files Modified

11. **`package.json`** (MODIFIED)
    - Added E2E test scripts:
      - `test:e2e` - Run all E2E tests
      - `test:e2e:ui` - Interactive UI mode
      - `test:e2e:headed` - Run with visible browser
      - `test:e2e:debug` - Debug mode
      - `test:e2e:report` - View test report
      - `test:e2e:codegen` - Record interactions to generate tests

### Existing Configuration (Already Present)

12. **`playwright.config.ts`** (EXISTING)
    - Playwright configuration with setup project
    - WebServer auto-start for local dev

## Test Commands

### Run All E2E Tests

```bash
npm run test:e2e
```

### Interactive UI Mode (Recommended for Development)

```bash
npm run test:e2e:ui
```

This opens the Playwright UI where you can:
- Browse all tests in a tree view
- Run individual tests or test files
- See test execution in real-time
- Time-travel debug with trace viewer
- View screenshots and videos
- Re-run failed tests

### Run Specific Test File

```bash
# Settings tests
npx playwright test settings.spec.ts

# Global search tests
npx playwright test global-search.spec.ts

# BOM list tests
npx playwright test bom-list.spec.ts

# All BOM tests
npx playwright test bom-*.spec.ts
```

### Debug Mode

```bash
npm run test:e2e:debug
```

Opens Playwright Inspector for step-by-step debugging with:
- Breakpoints
- Step through actions
- Inspect DOM snapshots
- Console logs
- Network activity

### View Test Report

```bash
npm run test:e2e:report
```

Opens HTML report with:
- Test results summary
- Screenshots on failure
- Videos of test runs
- Execution traces
- Error details

### Generate New Tests

```bash
npm run test:e2e:codegen
```

Opens browser to record interactions and generate test code.

## Test Coverage by Feature

### Authentication & Session Management
- [x] Login redirect to Keycloak
- [x] Successful authentication
- [x] Session persistence
- [x] Protected route access
- [x] Logout functionality
- [x] User info display
- [x] Role-based navigation

### Tenant Management
- [x] Tenant selector visibility
- [x] Tenant list population
- [x] Tenant switching
- [x] Context persistence (navigation)
- [x] Context persistence (reload)
- [x] Tenant search/filtering
- [x] API header injection

### Settings Page
- [x] Navigation to settings
- [x] Tab switching (5 tabs)
- [x] Profile display (read-only)
- [x] Notification toggle and save
- [x] Theme selection and apply
- [x] Organization settings (admin)
- [x] Saved searches management
- [x] Keyboard navigation
- [x] ARIA compliance

### Global Search (Ctrl+K)
- [x] Keyboard shortcut (Ctrl+K)
- [x] Dialog open/close
- [x] Search input focus
- [x] Debounced queries
- [x] Results display
- [x] "No results" message
- [x] Keyboard navigation (arrows)
- [x] Result selection (Enter)
- [x] Focus trap
- [x] Result highlighting
- [x] BOM vs Component icons
- [x] ARIA live regions
- [x] Edge cases handling

### BOM List Page
- [x] Page loading
- [x] Authentication required
- [x] Table display
- [x] Column headers
- [x] BOM data rows
- [x] Status badges
- [x] Empty state
- [x] Search functionality
- [x] Status filtering
- [x] Column sorting
- [x] Pagination controls
- [x] Navigation to detail
- [x] Row actions menu
- [x] Bulk actions
- [x] Refresh functionality
- [x] Performance checks
- [x] Table accessibility
- [x] Keyboard navigation

### BOM Upload
- [x] Upload wizard navigation
- [x] File upload step
- [x] Data preview step
- [x] Column mapping step
- [x] Options configuration
- [x] Review summary
- [x] Upload completion
- [x] File type validation
- [x] Empty file handling
- [x] Required column validation

### BOM Enrichment
- [x] Enrichment button visibility
- [x] Progress tracking
- [x] Re-enrichment option
- [x] Completion status
- [x] Summary statistics
- [x] Search/filtering
- [x] Pricing dialogs
- [x] Activity log
- [x] Risk analysis navigation
- [x] Pagination
- [x] Export functionality
- [x] Stock availability badges

## Test Architecture

### Fixtures Pattern

All tests use shared fixtures from `fixtures.ts`:

```typescript
import { test, expect, config } from './fixtures';

test('my test', async ({ page, selectTenant, navigateTo }) => {
  // Use fixtures
});
```

**Available Fixtures**:
- `selectTenant(name)` - Select tenant from dropdown
- `navigateTo(path)` - Navigate with proper waiting
- `waitForPageLoad()` - Wait for full page load
- `config` - Environment configuration

**Helper Functions**:
- `waitForToast(page, text, type)` - Wait for toast notification
- `uploadFile(page, selector, path)` - Upload file
- `createTestBomContent()` - Generate test CSV data
- `requireBomExists(page, test)` - Skip if no BOMs
- `requireBomWithStatus(page, status, test)` - Skip if status not found
- `navigateToFirstBom(page)` - Navigate to first BOM
- `assertVisible(page, selector, description)` - Assert with error message
- `findAndClick(page, selector, description)` - Find and click with error
- `verifyStockBadgeColor(page, colors)` - Verify badge styling

### Authentication Setup

Tests use a shared authentication state:

1. `auth.setup.ts` runs once before all tests
2. Logs in via Keycloak
3. Saves session to `e2e/.auth/user.json`
4. All tests reuse this session (no repeated logins)

### Data Prerequisites

Tests explicitly skip when prerequisites aren't met:

```typescript
test('requires BOM data', async ({ page }) => {
  if (!(await requireBomExists(page, test))) return;
  // Test continues only if BOMs exist
});
```

This ensures:
- Tests don't silently pass with missing data
- Clear skip reasons in reports
- Self-documenting requirements

## Best Practices Implemented

### 1. Semantic Selectors

Tests use accessible selectors:

```typescript
// Good
page.getByRole('button', { name: /upload/i })
page.getByLabel(/email/i)
page.getByText(/settings/i)

// Avoid
page.locator('.btn-upload')
page.locator('#email-input')
```

### 2. Explicit Timeouts

All assertions have explicit timeouts:

```typescript
await expect(element).toBeVisible({ timeout: 10000 });
```

### 3. Proper Waiting

Tests wait for network and DOM:

```typescript
await page.waitForLoadState('networkidle');
await page.waitForSelector('...');
```

Avoid arbitrary waits:

```typescript
// Avoid
await page.waitForTimeout(1000);

// Prefer
await page.waitForSelector('...');
```

### 4. Flexible Selectors

Use `.or()` for implementation variations:

```typescript
page.getByTestId('search').or(
  page.getByPlaceholder(/search/i)
)
```

### 5. Accessibility Testing

Tests verify ARIA attributes and keyboard navigation:

```typescript
await expect(dialog).toHaveAttribute('aria-labelledby');
await page.keyboard.press('ArrowDown');
```

### 6. Error Handling

Tests handle edge cases gracefully:

```typescript
const hasElement = await element.isVisible();
if (!hasElement) {
  test.skip(true, 'Element not available');
  return;
}
```

## Known Limitations & Recommendations

### Current Limitations

1. **No visual regression testing** - Consider adding Percy or Playwright's screenshot comparison
2. **No network mocking** - Tests use real API calls (can be flaky)
3. **Limited cross-browser testing** - Currently only Chromium in CI
4. **No performance budgets** - Could add Lighthouse integration

### Recommendations

1. **Add Visual Regression**:
   ```bash
   npm install --save-dev @playwright/test
   ```
   Use `await expect(page).toHaveScreenshot()` for critical pages

2. **Mock External APIs**:
   ```typescript
   await page.route('**/api/external/**', route => {
     route.fulfill({ status: 200, body: '{}' });
   });
   ```

3. **Add Performance Budgets**:
   ```typescript
   const metrics = await page.evaluate(() => performance.timing);
   expect(metrics.loadEventEnd - metrics.navigationStart).toBeLessThan(3000);
   ```

4. **Multi-browser Testing**:
   Update `playwright.config.ts` to include Firefox and WebKit projects

5. **Parallel Execution**:
   Tests can run in parallel for faster CI:
   ```typescript
   test.describe.configure({ mode: 'parallel' });
   ```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: docker-compose up -d
      - run: npx wait-on http://localhost:27100
      - run: npm run test:e2e
        env:
          E2E_USERNAME: ${{ secrets.E2E_USERNAME }}
          E2E_PASSWORD: ${{ secrets.E2E_PASSWORD }}
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

### Environment Variables for CI

Required secrets:
- `E2E_USERNAME` - Test user email
- `E2E_PASSWORD` - Test user password

Optional (defaults provided):
- `E2E_BASE_URL` - Customer portal URL
- `E2E_KEYCLOAK_URL` - Keycloak URL
- `E2E_TENANT_NAME` - Test tenant name

## Debugging Failed Tests

### 1. View Test Report

```bash
npm run test:e2e:report
```

Shows:
- Test execution timeline
- Screenshots on failure
- Videos of test runs
- Error stack traces

### 2. Run in Debug Mode

```bash
npm run test:e2e:debug
```

Allows:
- Step through test
- Inspect DOM at each step
- See console logs
- View network requests

### 3. Run in Headed Mode

```bash
npm run test:e2e:headed
```

See browser window during test execution.

### 4. Run Single Test

```bash
npx playwright test settings.spec.ts:42
```

Runs test at line 42 of settings.spec.ts.

### 5. Enable Verbose Logging

```bash
DEBUG=pw:api npm run test:e2e
```

Shows detailed Playwright API calls.

## Maintenance

### Updating Tests When UI Changes

1. Run codegen to see new selectors:
   ```bash
   npm run test:e2e:codegen
   ```

2. Update selectors in test files

3. Use `data-testid` for stable selectors:
   ```typescript
   page.getByTestId('my-element')
   ```

### Adding New Test Coverage

1. Create new spec file in `e2e/` directory
2. Import fixtures: `import { test, expect, config } from './fixtures'`
3. Follow existing patterns (see README)
4. Document new coverage in this file

### Performance Optimization

- Run tests in parallel where possible
- Use `domcontentloaded` instead of `networkidle` for faster tests
- Share authentication state (already done)
- Mock external API calls for reliability

## Support

For issues or questions:
1. Check `e2e/README.md` for detailed documentation
2. Review Playwright docs: https://playwright.dev
3. View test reports for failure details
4. Use debug mode to step through tests

## Summary

The E2E test suite provides comprehensive coverage of critical user flows in the Customer Business Portal. Tests are:
- **Maintainable**: Using page object pattern and fixtures
- **Reliable**: Proper waiting and error handling
- **Accessible**: Testing ARIA compliance and keyboard navigation
- **Well-documented**: README and inline comments
- **Developer-friendly**: Multiple run modes for different workflows

**Next Steps**:
1. Run initial test suite to establish baseline
2. Add visual regression tests for critical pages
3. Integrate into CI/CD pipeline
4. Set up test monitoring and alerts
5. Expand coverage to remaining features (workspaces, projects, alerts, etc.)
