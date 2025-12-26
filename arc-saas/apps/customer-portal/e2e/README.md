# Customer Business Portal - E2E Tests

End-to-end tests for the Customer Business Portal using Playwright.

## Test Coverage

### Authentication (`auth.spec.ts`)
- Unauthenticated redirect to Keycloak
- Successful login flow
- Session persistence
- Protected route access
- Logout functionality
- User info display
- Role-based navigation

### Tenant Management (`tenant.spec.ts`)
- Tenant selector visibility
- Tenant list population
- Tenant switching
- Tenant context persistence across navigation
- Tenant context persistence on page reload
- Tenant search/filtering
- Tenant-specific data display
- X-Tenant-Id header inclusion in API requests

### BOM Upload (`bom-upload.spec.ts`)
- Navigation to upload wizard
- 7-step upload flow (Select → Preview → Map → Configure → Review → Upload → Complete)
- File type validation
- CSV file processing
- Column mapping (auto-detection)
- Enrichment options configuration
- Summary review
- Error handling (invalid files, empty files, missing columns)

### BOM Enrichment (`bom-enrichment.spec.ts`)
- Enrichment button visibility
- Progress tracking during enrichment
- Re-enrichment for stale data
- Completion status display
- BOM summary statistics
- Search and filtering
- Line item pricing dialogs
- Activity log access
- Risk analysis navigation
- Pagination controls
- Export functionality (CSV, etc.)
- Stock availability badges with color coding

### Settings Page (`settings.spec.ts`)
- Navigation to settings
- Tab switching (Profile, Notifications, Saved Searches, Appearance, Organization)
- Profile information display
- Notification preferences toggle and save
- Theme selection (Light, Dark, System)
- Organization settings (admin-only)
- Saved searches management
- Accessibility (ARIA labels, keyboard navigation)

### Global Search (`global-search.spec.ts`)
- Keyboard shortcut (Ctrl+K / Cmd+K)
- Search dialog open/close
- Search input focus management
- Debounced search queries
- Search results display
- Keyboard navigation (Arrow keys, Enter, Escape)
- Result selection and navigation
- Empty state and "no results" messages
- Result highlighting on hover
- BOM vs Component result types
- Accessibility (ARIA, focus trap, live regions)

### BOM List Page (`bom-list.spec.ts`)
- Page loading and authentication
- BOM list display in table format
- Search and filtering
- Column sorting
- Pagination controls
- Navigation to BOM detail
- Empty state handling
- Row actions (context menu)
- Bulk actions
- Refresh functionality
- Performance (load time, large list handling)
- Accessibility (table semantics, keyboard navigation)

## Setup

### Prerequisites

1. **Playwright** is already installed as a dev dependency
2. **Environment variables** (optional, defaults provided):
   ```bash
   E2E_BASE_URL=http://localhost:27100
   E2E_KEYCLOAK_URL=http://localhost:8180
   E2E_KEYCLOAK_REALM=master
   E2E_USERNAME=test@example.com
   E2E_PASSWORD=password
   E2E_TENANT_NAME=Test Tenant
   ```

3. **Running services**:
   - Customer Portal dev server on port 27100
   - Keycloak on port 8180
   - CNS API on port 27200
   - Supabase database with test data

### Installation

If you need to reinstall Playwright browsers:

```bash
npx playwright install
```

## Running Tests

### All E2E Tests (Headless)

```bash
npm run test:e2e
```

### Interactive UI Mode

```bash
npm run test:e2e:ui
```

This opens the Playwright UI where you can:
- See all tests in a tree view
- Run individual tests
- Watch tests run in real-time
- Time-travel debug with trace viewer
- See screenshots and videos

### Headed Mode (See Browser)

```bash
npm run test:e2e:headed
```

Runs tests in a visible browser window.

### Debug Mode

```bash
npm run test:e2e:debug
```

Opens Playwright Inspector for step-by-step debugging.

### Run Specific Test File

```bash
npx playwright test auth.spec.ts
npx playwright test global-search.spec.ts
npx playwright test settings.spec.ts
```

### Run Tests with Specific Browser

```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

### View Test Report

After running tests:

```bash
npm run test:e2e:report
```

Opens the HTML report with screenshots, videos, and traces.

## Code Generation

Generate new tests by recording interactions:

```bash
npm run test:e2e:codegen
```

This opens a browser where you can interact with the app, and Playwright will generate test code.

## Test Architecture

### Fixtures (`fixtures.ts`)

Provides reusable utilities:

- **config**: Environment configuration (URLs, credentials)
- **selectTenant**: Helper to select a tenant from dropdown
- **navigateTo**: Navigate to a path with proper waiting
- **waitForPageLoad**: Wait for page to fully load
- **waitForToast**: Wait for toast notifications
- **uploadFile**: File upload helper
- **waitForEnrichment**: Wait for enrichment to complete
- **createTestBomContent**: Generate test BOM CSV data
- **requireBomExists**: Skip test if no BOMs exist (explicit prerequisite)
- **requireBomWithStatus**: Skip test if specific BOM status doesn't exist
- **navigateToFirstBom**: Navigate to first BOM detail page
- **assertVisible**: Assert element is visible with descriptive error
- **findAndClick**: Find and click element with error handling

### Authentication Setup (`auth.setup.ts`)

Runs once before all tests to:
1. Navigate to app (redirects to Keycloak)
2. Fill in credentials
3. Submit login
4. Save authentication state to `e2e/.auth/user.json`

This state is reused across all tests to avoid repeated logins.

## Writing Tests

### Example Test

```typescript
import { test, expect, config } from './fixtures';

test.describe('My Feature', () => {
  test.beforeEach(async ({ page, selectTenant }) => {
    await page.goto(config.baseUrl);
    await page.waitForLoadState('networkidle');
    await selectTenant(config.tenantName);
  });

  test('should do something', async ({ page, navigateTo }) => {
    await navigateTo('/my-page');

    await expect(
      page.getByRole('heading', { name: /my heading/i })
    ).toBeVisible({ timeout: 10000 });
  });
});
```

### Best Practices

1. **Use semantic selectors**: Prefer `getByRole`, `getByLabel`, `getByText` over CSS selectors
2. **Add timeouts**: Always add `{ timeout: 10000 }` to assertions that may be slow
3. **Wait for network idle**: Use `page.waitForLoadState('networkidle')` after navigation
4. **Handle optional elements**: Use `.or()` for elements that may have different implementations
5. **Skip gracefully**: Use `requireBomExists(page, test)` to skip tests when prerequisites aren't met
6. **Test accessibility**: Use `getByRole` and check ARIA attributes
7. **Avoid hardcoded waits**: Use `waitForSelector` or `waitForLoadState` instead of `waitForTimeout`

### Data Prerequisites

Tests use explicit skip when data prerequisites aren't met:

```typescript
test('should test BOM detail', async ({ page, navigateTo }) => {
  await navigateTo('/boms');

  // Explicitly skip if no BOMs exist
  if (!(await requireBomExists(page, test))) return;

  // Continue test...
});
```

This ensures tests:
- Don't silently pass when data is missing
- Provide clear skip reasons in reports
- Are self-documenting about their requirements

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - name: Install dependencies
        run: npm ci
      - name: Install Playwright
        run: npx playwright install --with-deps
      - name: Start services
        run: docker-compose up -d
      - name: Wait for services
        run: npx wait-on http://localhost:27100
      - name: Run E2E tests
        run: npm run test:e2e
        env:
          E2E_USERNAME: ${{ secrets.E2E_USERNAME }}
          E2E_PASSWORD: ${{ secrets.E2E_PASSWORD }}
      - name: Upload test report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

## Debugging

### Screenshots

Playwright automatically takes screenshots on failure. View them in:
```
playwright-report/
```

### Videos

Videos are recorded on first retry. Enable for all tests:

```typescript
// playwright.config.ts
use: {
  video: 'on',
}
```

### Traces

Traces are recorded on first retry. View with:

```bash
npx playwright show-trace trace.zip
```

### Verbose Logging

```bash
DEBUG=pw:api npx playwright test
```

## Common Issues

### Port Already in Use

Kill stale processes before starting:

```bash
# Windows
taskkill /F /IM node.exe 2>nul
taskkill /F /IM bun.exe 2>nul

# Linux/Mac
pkill -f "node.*vite"
```

### Authentication Fails

1. Check Keycloak is running: `http://localhost:8180`
2. Verify credentials in environment variables
3. Delete auth state: `rm -rf e2e/.auth`
4. Re-run setup: `npx playwright test --project=setup`

### Tests Timeout

1. Increase timeout in `playwright.config.ts`:
   ```typescript
   timeout: 60000, // 60 seconds
   ```
2. Check services are running and accessible
3. Verify network is stable

### Element Not Found

1. Check if element exists in the UI (run in headed mode)
2. Wait for element to appear: `await page.waitForSelector('...')`
3. Use `.or()` for alternative selectors
4. Check if feature is behind a feature flag or role permission

## Test Maintenance

### Updating Selectors

When UI changes:

1. Run codegen to see current selectors:
   ```bash
   npm run test:e2e:codegen
   ```
2. Update test to use new selectors
3. Use data-testid for stable selectors

### Adding New Tests

1. Create new spec file: `e2e/my-feature.spec.ts`
2. Import fixtures: `import { test, expect, config } from './fixtures'`
3. Add test suite: `test.describe('My Feature', () => { ... })`
4. Document in this README

### Performance Optimization

- Use `test.describe.configure({ mode: 'parallel' })` for independent tests
- Share page instances where possible
- Minimize network requests with mocks (for flaky external APIs)
- Use `waitForLoadState('domcontentloaded')` instead of `'networkidle'` where appropriate

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright API Reference](https://playwright.dev/docs/api/class-playwright)
- [Debugging Guide](https://playwright.dev/docs/debug)
