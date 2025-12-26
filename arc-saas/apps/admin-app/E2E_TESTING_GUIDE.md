# E2E Testing Quick Start Guide

## Installation and Setup

### 1. Install Playwright

```bash
cd E:\Work\Ananta-Platform-Saas\arc-saas\apps\admin-app

# Install Playwright
npm install --save-dev @playwright/test

# Install browsers
npx playwright install
```

### 2. Verify Installation

```bash
# Run a quick test to verify setup
npx playwright test e2e/dashboard.spec.ts --headed
```

## Running Tests

### Quick Commands

```bash
# Run all E2E tests
npm run test:e2e

# Run with UI mode (recommended for development)
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed

# Debug mode (step through tests)
npm run test:e2e:debug

# Run specific browser
npm run test:e2e:chromium
npm run test:e2e:firefox
npm run test:e2e:webkit
```

### Running Specific Tests

```bash
# Run specific test file
npx playwright test e2e/auth.spec.ts

# Run specific test by name
npx playwright test -g "should login"

# Run only failed tests
npx playwright test --last-failed
```

## Test Development Workflow

### 1. Start the Dev Server

```bash
# In one terminal, start the app
npm run dev
```

### 2. Run Tests in UI Mode

```bash
# In another terminal, run tests with UI
npm run test:e2e:ui
```

This opens Playwright's UI where you can:
- Select which tests to run
- See tests execute in real-time
- Inspect DOM at any point
- See network requests
- Time travel through test execution

### 3. Debug Failing Tests

```bash
# Run specific test in debug mode
npx playwright test e2e/tenants.spec.ts --debug
```

Use the Playwright Inspector to:
- Step through test actions
- Pause and resume execution
- Inspect page state
- Try selectors in the console

## Test Structure

### Using the Authenticated Fixture

Most tests need authentication. Use the `authenticatedPage` fixture:

```typescript
import { test, expect } from './fixtures/auth';

test('should view tenants', async ({ authenticatedPage: page }) => {
  // Already authenticated with mock token
  await page.goto('/tenants');

  // Your test assertions
  await expect(page).toHaveURL(/\/tenants/);
});
```

### Testing Without Authentication

For login/auth flow tests:

```typescript
import { test, expect } from '@playwright/test';

test('should show login page', async ({ page }) => {
  await page.goto('/');

  // Test login UI
  await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
});
```

## Common Testing Patterns

### Waiting for Elements

```typescript
// Wait for element to be visible
await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();

// Wait for network to be idle
await page.waitForLoadState('networkidle');

// Wait for specific timeout
await page.waitForTimeout(1000);
```

### Handling Dynamic Data

```typescript
// Check for data or empty state
const hasData = await page.locator('table tbody tr').count() > 0;
const hasEmptyState = await page.locator('text=/no data/i').isVisible();

expect(hasData || hasEmptyState).toBeTruthy();
```

### Form Testing

```typescript
// Fill and submit form
await page.fill('input[name="email"]', 'test@example.com');
await page.fill('input[name="name"]', 'Test User');
await page.click('button[type="submit"]');

// Wait for success
await expect(page.locator('text=/success/i')).toBeVisible();
```

### Navigation Testing

```typescript
// Navigate via sidebar
await page.getByRole('link', { name: /tenants/i }).click();
await expect(page).toHaveURL(/\/tenants/);

// Use browser back button
await page.goBack();
await expect(page).toHaveURL(/^\/$/);
```

## Viewing Test Reports

### After Test Execution

```bash
# Open HTML report
npm run test:e2e:report

# Or manually
npx playwright show-report
```

The report shows:
- Test results (pass/fail)
- Execution time
- Screenshots (on failure)
- Videos (on failure)
- Test traces

### Viewing Traces

If a test fails, view its trace:

```bash
npx playwright show-trace test-results/[test-name]/trace.zip
```

Traces include:
- Full DOM snapshots
- Network activity
- Console logs
- Screenshots at each step

## Troubleshooting

### App Not Running

**Error**: `Error: connect ECONNREFUSED 127.0.0.1:27555`

**Solution**: Start the dev server
```bash
npm run dev
```

### Port Already in Use

**Error**: `Port 27555 is already in use`

**Solution**: Kill the process using the port
```bash
# Windows
netstat -ano | findstr :27555
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:27555 | xargs kill -9
```

### Stale Authentication

**Error**: Tests fail with auth errors

**Solution**: Clear auth cache
```bash
rm -rf e2e/.auth
```

### Browser Installation Issues

**Error**: `Executable doesn't exist`

**Solution**: Reinstall browsers
```bash
npx playwright install --force
```

### Slow Test Execution

**Solution**: Run tests in parallel
```bash
npx playwright test --workers=4
```

Or run only Chromium:
```bash
npm run test:e2e:chromium
```

## Best Practices

### 1. Use Semantic Selectors

```typescript
// GOOD - semantic, resilient
await page.getByRole('button', { name: /create/i });
await page.getByLabel('Email');
await page.getByText('Dashboard');

// AVOID - fragile, implementation-specific
await page.locator('.btn-primary');
await page.locator('#email-input');
```

### 2. Test User Behavior, Not Implementation

```typescript
// GOOD - tests user interaction
test('should create a tenant', async ({ authenticatedPage: page }) => {
  await page.goto('/tenants');
  await page.getByRole('button', { name: /create/i }).click();
  await page.fill('input[name="name"]', 'New Tenant');
  await page.click('button[type="submit"]');
  await expect(page.getByText('Tenant created')).toBeVisible();
});

// AVOID - tests internal state
test('should update state', async ({ page }) => {
  const state = await page.evaluate(() => window.__STATE__);
  expect(state.tenants).toHaveLength(1);
});
```

### 3. Make Tests Independent

```typescript
// GOOD - each test is independent
test('should view tenant list', async ({ authenticatedPage: page }) => {
  await page.goto('/tenants');
  // Test doesn't depend on previous tests
});

test('should create tenant', async ({ authenticatedPage: page }) => {
  await page.goto('/tenants/create');
  // Can run in any order
});

// AVOID - tests depend on each other
test('should create tenant', async ({ page }) => {
  // Creates tenant
});

test('should edit tenant', async ({ page }) => {
  // Assumes tenant from previous test exists
});
```

### 4. Use Descriptive Test Names

```typescript
// GOOD
test('should display error message when email is invalid', async ({ page }) => {
  // ...
});

// AVOID
test('test1', async ({ page }) => {
  // ...
});
```

### 5. Handle Async Operations

```typescript
// GOOD - explicit waits
await page.click('button');
await page.waitForLoadState('networkidle');
await expect(page.getByText('Success')).toBeVisible();

// AVOID - hard-coded timeouts
await page.click('button');
await page.waitForTimeout(3000); // Brittle!
```

## Writing New Tests

### 1. Create Test File

```bash
# Create new test file
touch e2e/my-feature.spec.ts
```

### 2. Basic Template

```typescript
import { test, expect } from './fixtures/auth';

test.describe('My Feature', () => {
  test('should do something', async ({ authenticatedPage: page }) => {
    // Navigate to page
    await page.goto('/my-feature');

    // Wait for page load
    await page.waitForLoadState('networkidle');

    // Interact with elements
    await page.click('button');

    // Assert expected state
    await expect(page.getByText('Success')).toBeVisible();
  });
});
```

### 3. Run Your Test

```bash
npx playwright test e2e/my-feature.spec.ts --headed
```

### 4. Debug if Needed

```bash
npx playwright test e2e/my-feature.spec.ts --debug
```

## CI/CD Integration

### GitHub Actions

See `.github-workflows-example.yml` for a complete workflow.

Key points:
- Run tests on push/PR
- Install Playwright browsers
- Upload reports as artifacts
- Run tests in parallel across browsers

### Running Tests in CI

```bash
# Set CI flag for optimized execution
CI=true npm run test:e2e
```

CI mode:
- Runs headless
- Retries failed tests 2 times
- Captures traces on failure
- Uses 1 worker for stability

## Resources

- **Playwright Docs**: https://playwright.dev
- **Best Practices**: https://playwright.dev/docs/best-practices
- **API Reference**: https://playwright.dev/docs/api/class-test
- **Debugging Guide**: https://playwright.dev/docs/debug
- **CI/CD Guide**: https://playwright.dev/docs/ci

## Support

For issues or questions:
1. Check the [E2E README](./e2e/README.md)
2. Review [Playwright docs](https://playwright.dev)
3. Check existing test files for examples
4. Ask the team on Slack/Discord

## Next Steps

1. **Run the test suite**: `npm run test:e2e:ui`
2. **Explore existing tests**: Look at `e2e/*.spec.ts` files
3. **Write your first test**: Follow the template above
4. **Add tests to CI**: Copy the GitHub Actions workflow
5. **Monitor coverage**: Add more tests to increase coverage

Happy Testing!
