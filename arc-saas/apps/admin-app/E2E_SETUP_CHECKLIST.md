# E2E Test Suite - Setup Checklist

Use this checklist to verify your E2E test suite is properly configured and ready to use.

## Pre-Installation Checklist

- [ ] Node.js version 20 or higher installed
  ```bash
  node --version
  ```

- [ ] npm or bun package manager available
  ```bash
  npm --version
  ```

- [ ] Admin app runs successfully on port 27555
  ```bash
  cd E:\Work\Ananta-Platform-Saas\arc-saas\apps\admin-app
  npm run dev
  # Visit http://localhost:27555
  ```

## Installation Checklist

- [ ] Install project dependencies
  ```bash
  npm install
  ```

- [ ] Verify Playwright is in package.json devDependencies
  ```bash
  npm list @playwright/test
  ```

- [ ] Install Playwright browsers
  ```bash
  npx playwright install
  ```

- [ ] Verify browser installation
  ```bash
  npx playwright install --dry-run
  ```

## File Structure Verification

- [ ] `playwright.config.ts` exists in root
- [ ] `e2e/` directory exists
- [ ] `e2e/fixtures/auth.ts` exists
- [ ] Test spec files exist:
  - [ ] `e2e/auth.spec.ts`
  - [ ] `e2e/dashboard.spec.ts`
  - [ ] `e2e/navigation.spec.ts`
  - [ ] `e2e/tenants.spec.ts`
  - [ ] `e2e/plans.spec.ts`
  - [ ] `e2e/subscriptions.spec.ts`
  - [ ] `e2e/accessibility.spec.ts`
- [ ] `e2e/README.md` exists
- [ ] `e2e/.gitignore` exists
- [ ] `.env.test.example` exists

## Configuration Verification

- [ ] package.json has E2E test scripts:
  - [ ] `test:e2e`
  - [ ] `test:e2e:ui`
  - [ ] `test:e2e:headed`
  - [ ] `test:e2e:debug`
  - [ ] `test:e2e:chromium`
  - [ ] `test:e2e:firefox`
  - [ ] `test:e2e:webkit`
  - [ ] `test:e2e:report`

- [ ] playwright.config.ts specifies:
  - [ ] baseURL: http://localhost:27555
  - [ ] testDir: ./e2e
  - [ ] Browser projects: chromium, firefox, webkit
  - [ ] Mobile projects: Mobile Chrome, Mobile Safari
  - [ ] Web server configuration

## Environment Setup (Optional)

- [ ] Create `.env.test` if needed
  ```bash
  cp .env.test.example .env.test
  ```

- [ ] Configure test credentials if using real auth
  - [ ] TEST_USER_USERNAME
  - [ ] TEST_USER_PASSWORD
  - [ ] TEST_USER_EMAIL

## Initial Test Run

- [ ] Start dev server in one terminal
  ```bash
  npm run dev
  ```

- [ ] Run a simple test to verify setup
  ```bash
  npm run test:e2e:headed
  ```

- [ ] Verify test execution:
  - [ ] Browser opens
  - [ ] Tests execute
  - [ ] Tests pass (or show expected results)
  - [ ] Browser closes

## Test Execution Verification

- [ ] Run all tests
  ```bash
  npm run test:e2e
  ```

- [ ] Check test results summary
  - [ ] Number of tests executed
  - [ ] Pass/fail count
  - [ ] Execution time

- [ ] View HTML report
  ```bash
  npm run test:e2e:report
  ```

- [ ] Verify report shows:
  - [ ] Test results by file
  - [ ] Screenshots (if any failures)
  - [ ] Execution details

## UI Mode Verification

- [ ] Open Playwright UI
  ```bash
  npm run test:e2e:ui
  ```

- [ ] Verify UI features:
  - [ ] Test list displays
  - [ ] Can select individual tests
  - [ ] Can run tests
  - [ ] Can view test execution
  - [ ] Can inspect elements
  - [ ] Can view network requests

## Debug Mode Verification

- [ ] Run test in debug mode
  ```bash
  npx playwright test e2e/dashboard.spec.ts --debug
  ```

- [ ] Verify Playwright Inspector:
  - [ ] Opens successfully
  - [ ] Can step through test
  - [ ] Can pause/resume
  - [ ] Can inspect page elements
  - [ ] Shows action timeline

## Browser-Specific Tests

- [ ] Run Chromium tests
  ```bash
  npm run test:e2e:chromium
  ```

- [ ] Run Firefox tests
  ```bash
  npm run test:e2e:firefox
  ```

- [ ] Run WebKit tests
  ```bash
  npm run test:e2e:webkit
  ```

- [ ] Verify all browsers pass (or show consistent results)

## Authentication Tests

- [ ] Mock authentication works
  - [ ] authenticatedPage fixture loads
  - [ ] Tests can access protected routes
  - [ ] No Keycloak dependency needed

- [ ] Real Keycloak auth (if configured)
  - [ ] Keycloak is running
  - [ ] Test credentials are valid
  - [ ] authenticateWithKeycloak() works
  - [ ] Can complete login flow

## Test Coverage Verification

Run each test file individually to verify functionality:

- [ ] Authentication tests pass
  ```bash
  npx playwright test e2e/auth.spec.ts
  ```

- [ ] Dashboard tests pass
  ```bash
  npx playwright test e2e/dashboard.spec.ts
  ```

- [ ] Navigation tests pass
  ```bash
  npx playwright test e2e/navigation.spec.ts
  ```

- [ ] Tenants tests pass
  ```bash
  npx playwright test e2e/tenants.spec.ts
  ```

- [ ] Plans tests pass
  ```bash
  npx playwright test e2e/plans.spec.ts
  ```

- [ ] Subscriptions tests pass
  ```bash
  npx playwright test e2e/subscriptions.spec.ts
  ```

- [ ] Accessibility tests pass
  ```bash
  npx playwright test e2e/accessibility.spec.ts
  ```

## Documentation Verification

- [ ] README files are clear and complete:
  - [ ] `e2e/README.md` - comprehensive docs
  - [ ] `E2E_TESTING_GUIDE.md` - quick start
  - [ ] `E2E_TEST_SUITE_SUMMARY.md` - overview

- [ ] Documentation includes:
  - [ ] Installation instructions
  - [ ] Running tests guide
  - [ ] Debugging guide
  - [ ] Best practices
  - [ ] Troubleshooting section

## CI/CD Setup (Optional)

- [ ] GitHub Actions workflow example exists
  - [ ] `.github-workflows-example.yml`

- [ ] Review workflow configuration:
  - [ ] Correct working directory
  - [ ] Proper Node.js version
  - [ ] Browser installation step
  - [ ] Test execution command
  - [ ] Artifact upload configured

- [ ] Copy to `.github/workflows/` if deploying
  ```bash
  mkdir -p ../../.github/workflows
  cp .github-workflows-example.yml ../../.github/workflows/e2e-admin-portal.yml
  ```

## Troubleshooting Verification

Test common issues to ensure solutions work:

- [ ] Port 27555 conflict handling
  ```bash
  # Stop dev server, restart, verify tests run
  ```

- [ ] Stale auth clearing
  ```bash
  rm -rf e2e/.auth
  # Verify tests still pass
  ```

- [ ] Browser reinstall
  ```bash
  npx playwright install --force
  # Verify tests still pass
  ```

## Performance Verification

- [ ] Test execution completes in reasonable time
  - [ ] Full suite < 5 minutes (varies by system)
  - [ ] Single test < 30 seconds

- [ ] Parallel execution works
  ```bash
  npx playwright test --workers=4
  ```

- [ ] Tests don't timeout unnecessarily
  - [ ] Check playwright.config.ts timeout settings
  - [ ] Verify no tests have arbitrary waits

## Final Verification

- [ ] All 62 tests are present
  - [ ] 6 auth tests
  - [ ] 7 dashboard tests
  - [ ] 10 navigation tests
  - [ ] 11 tenants tests
  - [ ] 7 plans tests
  - [ ] 9 subscriptions tests
  - [ ] 12 accessibility tests

- [ ] Test suite runs successfully
  ```bash
  npm run test:e2e
  ```

- [ ] Reports are generated
  - [ ] HTML report: `playwright-report/`
  - [ ] JSON results: `test-results/results.json`

- [ ] Artifacts are git-ignored
  - [ ] `e2e/.auth/`
  - [ ] `test-results/`
  - [ ] `playwright-report/`

## Success Criteria

Your E2E test suite is ready when:

✅ All installation steps complete without errors
✅ Dev server runs on port 27555
✅ Playwright browsers are installed
✅ Test suite executes successfully
✅ Reports are generated and viewable
✅ UI mode and debug mode work
✅ Documentation is clear and accessible
✅ Tests can run in all browsers (Chromium, Firefox, WebKit)
✅ Mock authentication works out of the box
✅ No critical errors in test output

## Getting Help

If you encounter issues:

1. Check the documentation:
   - `e2e/README.md`
   - `E2E_TESTING_GUIDE.md`

2. Review Playwright docs:
   - https://playwright.dev

3. Check test output and logs:
   ```bash
   npm run test:e2e -- --reporter=list
   ```

4. View trace for failed tests:
   ```bash
   npx playwright show-trace test-results/[test-name]/trace.zip
   ```

5. Search for common issues:
   - Playwright GitHub issues
   - Stack Overflow

## Next Steps After Setup

Once everything is verified:

1. **Integrate into workflow**:
   - Add to PR review process
   - Run before deployments
   - Monitor test trends

2. **Expand test coverage**:
   - Add tests for new features
   - Increase assertion coverage
   - Test edge cases

3. **Optimize**:
   - Review slow tests
   - Add parallel execution where safe
   - Optimize waits and timeouts

4. **Maintain**:
   - Update tests when UI changes
   - Review and refactor tests regularly
   - Keep documentation current

---

**Checklist Version**: 1.0.0
**Last Updated**: 2025-12-14
