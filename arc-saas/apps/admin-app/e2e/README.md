# E2E Test Suite for Admin Portal

This directory contains end-to-end tests for the ARC SaaS Admin Portal using Playwright.

## Overview

The test suite covers:
- **Authentication**: Login/logout flows with Keycloak
- **Dashboard**: Main dashboard functionality and navigation
- **Navigation**: Sidebar, breadcrumbs, and routing
- **Tenants**: Tenant CRUD operations
- **Plans**: Plan management
- **Subscriptions**: Subscription management
- **Accessibility**: WCAG compliance and keyboard navigation

## Setup

### Installation

Install Playwright and browsers:

```bash
# Install dependencies
npm install --save-dev @playwright/test

# Install browsers
npx playwright install
```

### Environment Configuration

Tests use the following environment variables (with defaults):

```bash
# Base URL for the application
BASE_URL=http://localhost:27555

# Test user credentials (for Keycloak tests)
TEST_USER_USERNAME=admin
TEST_USER_PASSWORD=admin
TEST_USER_EMAIL=admin@ananta.com
```

Create a `.env.test` file for custom configuration:

```bash
BASE_URL=http://localhost:27555
TEST_USER_USERNAME=testuser@example.com
TEST_USER_PASSWORD=YourSecurePassword123
```

## Running Tests

### All Tests

```bash
# Run all tests
npm run test:e2e

# Run all tests with UI
npm run test:e2e:ui

# Run tests in headed mode
npm run test:e2e:headed

# Run tests in debug mode
npm run test:e2e:debug
```

### Specific Test Files

```bash
# Run specific test file
npx playwright test e2e/auth.spec.ts

# Run specific test by name
npx playwright test -g "should display login page"

# Run tests in specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

### Debugging

```bash
# Debug mode with Playwright Inspector
npx playwright test --debug

# Debug specific test
npx playwright test e2e/auth.spec.ts --debug

# Run with browser UI visible
npx playwright test --headed

# Run with trace
npx playwright test --trace on
```

## Test Structure

### Fixtures

**`fixtures/auth.ts`**
- Authentication helpers
- Mock authentication for fast tests
- Real Keycloak authentication helpers
- Authenticated page fixture

### Test Files

**`auth.spec.ts`**
- Login page rendering
- Authentication flow
- Logout functionality
- Protected route access

**`dashboard.spec.ts`**
- Dashboard loading
- Navigation menu
- User information display
- Console error checking

**`navigation.spec.ts`**
- Sidebar navigation
- Browser back/forward buttons
- Direct URL navigation
- Responsive navigation
- Keyboard navigation

**`tenants.spec.ts`**
- Tenant list display
- Tenant details view
- Tenant creation
- Search and filtering
- Pagination

**`plans.spec.ts`**
- Plan list display
- Plan details
- Plan creation/editing
- Plan tier display

**`subscriptions.spec.ts`**
- Subscription list display
- Subscription details
- Status filtering
- Subscription actions

**`accessibility.spec.ts`**
- Semantic HTML structure
- ARIA attributes
- Keyboard navigation
- Form accessibility
- Focus indicators
- Image alt text

## Authentication Strategies

### Mock Authentication (Default)

For faster test execution, tests use mock authentication by default:

```typescript
import { test } from './fixtures/auth';

test('should load dashboard', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/');
  // Already authenticated with mock token
});
```

### Real Keycloak Authentication

For integration testing with real Keycloak:

```typescript
import { authenticateWithKeycloak } from './fixtures/auth';

test('should login with Keycloak', async ({ page }) => {
  await authenticateWithKeycloak(page);
  // Logged in with real Keycloak credentials
});
```

## Best Practices

### 1. Use Authenticated Fixture

```typescript
// Good - uses authenticated fixture
test('should view tenants', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/tenants');
});

// Avoid - manual auth setup in each test
test('should view tenants', async ({ page }) => {
  await mockAuthentication(page);
  await page.goto('/tenants');
});
```

### 2. Wait for Network Idle

```typescript
test('should load page', async ({ authenticatedPage: page }) => {
  await page.goto('/tenants');
  await page.waitForLoadState('networkidle');
  // Now safe to interact with elements
});
```

### 3. Use Role Selectors

```typescript
// Good - semantic selectors
await page.getByRole('button', { name: /create/i }).click();

// Less ideal - CSS selectors
await page.locator('.create-button').click();
```

### 4. Handle Empty States

```typescript
test('should handle empty data', async ({ authenticatedPage: page }) => {
  await page.goto('/tenants');

  // Check for either data or empty state
  const hasData = await page.locator('table tbody tr').count() > 0;
  const hasEmptyState = await page.locator('text=/no data/i').isVisible();

  expect(hasData || hasEmptyState).toBeTruthy();
});
```

### 5. Test Permissions

```typescript
test('should show create button for authorized users', async ({ authenticatedPage: page }) => {
  // Test accounts with different roles to verify RBAC
  await page.goto('/tenants');

  const createButton = page.getByRole('button', { name: /create/i });
  // Button visibility depends on user role
});
```

## CI/CD Integration

### GitHub Actions

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

      - name: Run E2E tests
        run: npm run test:e2e
        env:
          BASE_URL: http://localhost:27555

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

### Docker

```dockerfile
# Run tests in Docker
FROM mcr.microsoft.com/playwright:v1.40.0-focal

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

CMD ["npm", "run", "test:e2e"]
```

## Reports

### HTML Report

After test execution, view the HTML report:

```bash
npx playwright show-report
```

The report includes:
- Test results with pass/fail status
- Screenshots of failures
- Video recordings (on failure)
- Traces for debugging

### JSON Report

Test results are also saved as JSON:

```
test-results/results.json
```

## Troubleshooting

### Tests Failing Locally

1. **App not running**: Ensure dev server is running on port 27555
   ```bash
   npm run dev
   ```

2. **Port conflict**: Check if port 27555 is available
   ```bash
   # Windows
   netstat -ano | findstr :27555

   # Linux/Mac
   lsof -i :27555
   ```

3. **Stale auth state**: Clear auth state
   ```bash
   rm -rf e2e/.auth
   ```

### Browser Issues

```bash
# Reinstall browsers
npx playwright install --force

# Install system dependencies (Linux)
npx playwright install-deps
```

### Slow Tests

```bash
# Run tests in parallel
npx playwright test --workers=4

# Run only one project
npx playwright test --project=chromium
```

### Debugging Failures

```bash
# Run with trace on failure
npx playwright test --trace on

# Open trace viewer
npx playwright show-trace trace.zip
```

## Contributing

When adding new tests:

1. Follow existing patterns and fixtures
2. Use semantic selectors (role, label, text)
3. Handle empty states gracefully
4. Add appropriate timeouts and waits
5. Test both success and error scenarios
6. Update this README with new test coverage

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Accessibility Testing](https://playwright.dev/docs/accessibility-testing)
- [Refine Documentation](https://refine.dev/docs)
