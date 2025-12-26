#!/usr/bin/env ts-node
/**
 * Test Runner for Tenant Management Service
 *
 * This script runs all integration tests against a live server.
 *
 * Usage:
 *   npx ts-node src/__tests__/run-tests.ts
 *
 * Prerequisites:
 *   - Server running on localhost:14000
 *   - Database connected
 *   - All dependencies running (Redis, Temporal, etc.)
 */

import {sign} from 'jsonwebtoken';

const BASE_URL = process.env.API_URL || 'http://localhost:14000';
const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-testing';
const JWT_ISSUER = process.env.JWT_ISSUER || 'arc-saas';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Use valid UUIDs for test user IDs (required by database schema)
const TEST_USER_ID = '00000000-0000-4000-8000-000000000001';
const TEST_TENANT_ID = '28e81841-5af9-4f93-83aa-889c21709f54';

function generateAuthToken(): string {
  return sign(
    {
      id: TEST_USER_ID,
      userTenantId: TEST_USER_ID,
      tenantId: TEST_TENANT_ID,
      permissions: [
        '10200', '10201', '10202', '10203',
        '10204', '10205', '10206', '10207', '10216',
        '10208', '10209', '10210', '10211',
        '10212', '10213', '10214', '10215',
        '7001', '7002', '7004', '7008',
        '10220', '10221', '10222', '10223',
        '10300', '10301', '10302', '10303', '10304', '10305', '10306',
        '10310', '10311', '10312', '10313',
        '10320', '10321', '10322', '10323', '10324',
        '10330',
        '5321', '5322', '5323', '5324', '5325', '5326', '5327', '5328', '5329', '5331', '5332', '5333',
      ],
    },
    JWT_SECRET,
    {expiresIn: '1h', issuer: JWT_ISSUER},
  );
}

interface TestResult {
  endpoint: string;
  method: string;
  status: number;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

async function testEndpoint(
  method: string,
  path: string,
  options: {
    auth?: boolean;
    body?: object;
    expectedStatus?: number | number[];
  } = {},
): Promise<TestResult> {
  const {auth = true, body, expectedStatus = 200} = options;
  const authToken = generateAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (auth) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const start = Date.now();

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const duration = Date.now() - start;
    const expectedStatuses = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
    const passed = expectedStatuses.includes(response.status);

    const result: TestResult = {
      endpoint: path,
      method,
      status: response.status,
      passed,
      duration,
    };

    if (!passed) {
      result.error = `Expected ${expectedStatuses.join(' or ')}, got ${response.status}`;
    }

    return result;
  } catch (error) {
    return {
      endpoint: path,
      method,
      status: 0,
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - start,
    };
  }
}

async function runTests() {
  log('\n========================================', 'cyan');
  log('  TENANT MANAGEMENT SERVICE API TESTS', 'cyan');
  log('========================================\n', 'cyan');

  log(`Target: ${BASE_URL}`, 'blue');
  log('');

  // Check server health first
  log('Checking server health...', 'yellow');
  const healthResult = await testEndpoint('GET', '/health', {auth: false});
  if (!healthResult.passed) {
    log(`Server not responding! Status: ${healthResult.status}`, 'red');
    log('Make sure the server is running on localhost:14000', 'red');
    process.exit(1);
  }
  log('Server is healthy!\n', 'green');

  // ==========================================
  // PUBLIC ENDPOINTS
  // ==========================================
  log('=== PUBLIC ENDPOINTS ===', 'cyan');

  results.push(await testEndpoint('GET', '/health', {auth: false}));
  results.push(await testEndpoint('GET', '/ping', {auth: false}));
  results.push(await testEndpoint('GET', '/plans', {auth: false}));
  results.push(await testEndpoint('GET', '/plans/count', {auth: false}));
  results.push(await testEndpoint('GET', '/plans/plan-basic', {auth: false, expectedStatus: [200, 404]}));
  results.push(await testEndpoint('GET', '/leads/verify', {auth: false, expectedStatus: 400}));
  results.push(await testEndpoint('GET', '/user-invitations/by-token/invalid', {auth: false, expectedStatus: 404}));

  // ==========================================
  // TENANTS
  // ==========================================
  log('\n=== TENANTS ===', 'cyan');

  results.push(await testEndpoint('GET', '/tenants'));
  results.push(await testEndpoint('GET', '/tenants/count'));
  results.push(await testEndpoint('GET', '/tenants/by-key/testcorp', {expectedStatus: [200, 204, 404]}));
  results.push(await testEndpoint('GET', '/tenants', {auth: false, expectedStatus: 401}));

  // ==========================================
  // LEADS
  // ==========================================
  log('\n=== LEADS ===', 'cyan');

  results.push(await testEndpoint('GET', '/leads'));
  results.push(await testEndpoint('GET', '/leads/count'));

  const timestamp = Date.now();
  results.push(
    await testEndpoint('POST', '/leads', {
      auth: false,
      body: {
        firstName: 'Test',
        lastName: 'Lead',
        email: `test-${timestamp}@example.com`,
        companyName: `Test Company ${timestamp}`,
      },
      expectedStatus: [200, 201],
    }),
  );

  // ==========================================
  // SUBSCRIPTIONS
  // ==========================================
  log('\n=== SUBSCRIPTIONS ===', 'cyan');

  results.push(await testEndpoint('GET', '/subscriptions'));
  results.push(await testEndpoint('GET', '/subscriptions/count'));

  // ==========================================
  // INVOICES
  // ==========================================
  log('\n=== INVOICES ===', 'cyan');

  results.push(await testEndpoint('GET', '/invoices'));
  results.push(await testEndpoint('GET', '/invoices/count'));

  // ==========================================
  // USERS
  // ==========================================
  log('\n=== USERS ===', 'cyan');

  results.push(await testEndpoint('GET', '/users'));
  results.push(await testEndpoint('GET', '/users/count'));

  // ==========================================
  // TENANT-USERS
  // ==========================================
  log('\n=== TENANT-USERS ===', 'cyan');

  results.push(await testEndpoint('GET', '/tenant-users'));
  results.push(await testEndpoint('GET', '/tenant-users/count'));

  // ==========================================
  // USER-INVITATIONS
  // ==========================================
  log('\n=== USER-INVITATIONS ===', 'cyan');

  results.push(await testEndpoint('GET', '/user-invitations'));
  results.push(await testEndpoint('GET', '/user-invitations/count'));

  // ==========================================
  // WORKFLOWS
  // ==========================================
  log('\n=== WORKFLOWS ===', 'cyan');

  results.push(await testEndpoint('GET', '/workflows'));
  results.push(await testEndpoint('GET', '/workflows/count'));

  // ==========================================
  // BILLING ANALYTICS
  // ==========================================
  log('\n=== BILLING ANALYTICS ===', 'cyan');

  results.push(await testEndpoint('GET', '/billing/metrics'));
  results.push(await testEndpoint('GET', '/billing/invoices'));
  results.push(await testEndpoint('GET', '/billing/revenue-by-plan'));
  results.push(await testEndpoint('GET', '/billing/monthly-revenue'));
  results.push(await testEndpoint('GET', '/billing/subscription-growth'));

  // ==========================================
  // SETTINGS
  // ==========================================
  log('\n=== SETTINGS ===', 'cyan');

  results.push(await testEndpoint('GET', '/settings'));
  results.push(await testEndpoint('GET', '/settings/count'));

  const settingTimestamp = Date.now();
  results.push(
    await testEndpoint('POST', '/settings', {
      body: {
        configKey: `test.key.${settingTimestamp}`,
        configValue: 'test-value',
        valueType: 'string',
        category: 'test',
      },
      expectedStatus: [200, 201],
    }),
  );

  // ==========================================
  // PRINT RESULTS
  // ==========================================
  log('\n========================================', 'cyan');
  log('  TEST RESULTS', 'cyan');
  log('========================================\n', 'cyan');

  let passed = 0;
  let failed = 0;

  for (const result of results) {
    const statusIcon = result.passed ? '✓' : '✗';
    const statusColor = result.passed ? 'green' : 'red';

    log(
      `${statusIcon} ${result.method.padEnd(6)} ${result.endpoint.padEnd(45)} ${result.status} (${result.duration}ms)`,
      statusColor,
    );

    if (result.error) {
      log(`    Error: ${result.error}`, 'red');
    }

    if (result.passed) passed++;
    else failed++;
  }

  log('\n========================================', 'cyan');
  log(`  TOTAL: ${results.length} | PASSED: ${passed} | FAILED: ${failed}`, passed === results.length ? 'green' : 'yellow');
  log('========================================\n', 'cyan');

  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  log(`Fatal error: ${error.message}`, 'red');
  process.exit(1);
});
