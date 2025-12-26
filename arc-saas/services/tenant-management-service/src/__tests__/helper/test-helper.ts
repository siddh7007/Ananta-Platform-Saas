import {TenantMgmtServiceApplication} from '../../application';
import {
  createRestAppClient,
  givenHttpServerConfig,
  Client,
} from '@loopback/testlab';
import {sign} from 'jsonwebtoken';

export interface TestContext {
  app: TenantMgmtServiceApplication;
  client: Client;
}

/**
 * Setup test application
 */
export async function setupApplication(): Promise<TestContext> {
  const restConfig = givenHttpServerConfig({
    host: '127.0.0.1',
    port: 0, // Use random available port
  });

  const app = new TenantMgmtServiceApplication({
    rest: restConfig,
  });

  await app.boot();
  await app.start();

  const client = createRestAppClient(app);

  return {app, client};
}

/**
 * Generate a test JWT token
 */
export function generateTestToken(payload: {
  id: string;
  userTenantId: string;
  tenantId?: string;
  permissions?: string[];
  email?: string;
}): string {
  const secret = process.env.JWT_SECRET || 'test-secret';
  const issuer = process.env.JWT_ISSUER || 'arc-saas';

  return sign(
    {
      id: payload.id,
      userTenantId: payload.userTenantId,
      tenantId: payload.tenantId || payload.userTenantId,
      permissions: payload.permissions || getAllPermissions(),
      email: payload.email || 'test@example.com',
    },
    secret,
    {
      expiresIn: '1h',
      issuer,
    },
  );
}

/**
 * Get all permissions for admin testing
 */
export function getAllPermissions(): string[] {
  return [
    // Lead
    '10200', '10201', '10202', '10203',
    // Tenant
    '10204', '10205', '10206', '10207', '10216',
    // Contact
    '10208', '10209', '10210', '10211',
    // Invoice
    '10212', '10213', '10214', '10215',
    // Subscription
    '7001', '7002', '7004', '7008',
    // Tenant Config
    '10220', '10221', '10222', '10223',
    // User
    '10300', '10301', '10302', '10303', '10304', '10305', '10306',
    // Roles
    '10310', '10311', '10312', '10313',
    // Invitations
    '10320', '10321', '10322', '10323', '10324',
    // Activity
    '10330',
    // Billing
    '5321', '5322', '5323', '5324', '5325', '5326', '5327', '5328', '5329', '5331', '5332', '5333',
  ];
}

/**
 * Generate a valid UUID for testing
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Create test tenant data
 */
export function createTestTenant(overrides: Partial<any> = {}): any {
  return {
    name: `Test Tenant ${Date.now()}`,
    key: `test-tenant-${Date.now()}`,
    status: 1,
    planId: 'plan-basic',
    ...overrides,
  };
}

/**
 * Create test lead data
 */
export function createTestLead(overrides: Partial<any> = {}): any {
  const timestamp = Date.now();
  return {
    firstName: 'Test',
    lastName: 'User',
    email: `test-${timestamp}@example.com`,
    companyName: `Test Company ${timestamp}`,
    ...overrides,
  };
}

/**
 * Create test subscription data
 */
export function createTestSubscription(overrides: Partial<any> = {}): any {
  const now = new Date();
  const endDate = new Date(now);
  endDate.setMonth(endDate.getMonth() + 1);

  return {
    planId: 'plan-basic',
    planName: 'Basic',
    planTier: 'basic',
    status: 'active',
    currentPeriodStart: now.toISOString(),
    currentPeriodEnd: endDate.toISOString(),
    amount: 29,
    currency: 'USD',
    billingCycle: 'monthly',
    ...overrides,
  };
}

/**
 * Create test user data
 */
export function createTestUser(overrides: Partial<any> = {}): any {
  const timestamp = Date.now();
  return {
    firstName: 'Test',
    lastName: 'User',
    email: `testuser-${timestamp}@example.com`,
    username: `testuser-${timestamp}`,
    status: 'active',
    ...overrides,
  };
}

/**
 * Create test invoice data
 */
export function createTestInvoice(overrides: Partial<any> = {}): any {
  const now = new Date();
  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + 30);

  return {
    amount: 29.00,
    currency: 'USD',
    status: 'pending',
    dueDate: dueDate.toISOString(),
    ...overrides,
  };
}

/**
 * Create test setting data
 */
export function createTestSetting(overrides: Partial<any> = {}): any {
  const timestamp = Date.now();
  return {
    configKey: `test.setting.${timestamp}`,
    configValue: 'test-value',
    valueType: 'string',
    description: 'Test setting',
    category: 'test',
    isPublic: false,
    ...overrides,
  };
}

/**
 * Create test payment method data
 */
export function createTestPaymentMethod(overrides: Partial<any> = {}): any {
  return {
    type: 'card',
    isDefault: false,
    stripeCustomerId: `cus_test_${Date.now()}`,
    stripePaymentMethodId: `pm_test_${Date.now()}`,
    cardDetails: {
      brand: 'visa',
      last4: '4242',
      expMonth: 12,
      expYear: new Date().getFullYear() + 2,
      funding: 'credit',
    },
    billingName: 'Test User',
    billingEmail: 'test@example.com',
    ...overrides,
  };
}

/**
 * Create test payment intent data
 */
export function createTestPaymentIntent(overrides: Partial<any> = {}): any {
  return {
    stripePaymentIntentId: `pi_test_${Date.now()}`,
    stripeCustomerId: `cus_test_${Date.now()}`,
    stripePaymentMethodId: `pm_test_${Date.now()}`,
    amount: 2900, // $29.00 in cents
    currency: 'usd',
    status: 'succeeded',
    description: 'Test payment',
    ...overrides,
  };
}

/**
 * Get billing-specific permissions
 */
export function getBillingPermissions(): string[] {
  return [
    // Billing permissions from permissions.ts
    '5321', // ViewBillingAnalytics
    '5322', // CreateBillingPaymentSource
    '5323', // DeleteBillingPaymentSource
    '5324', // GetBillingPaymentSource
    '5325', // GetBillingInvoice
    '5326', // ListBillingInvoices
    '5327', // DownloadBillingInvoice
    '5328', // PayBillingInvoice
    '5329', // GetBillingSubscription
    '5331', // ManagePaymentMethods
    '5332', // ViewPaymentIntents
    '5333', // CreatePaymentIntent
    // Invoice permissions
    '10212', '10213', '10214', '10215',
  ];
}

/**
 * Wait helper for async operations
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Clean up test data - placeholder for future implementation
 * Note: Direct repository access requires class reference, not string
 */
export async function cleanupTestData(
  _app: TenantMgmtServiceApplication,
  tableName: string,
  _whereClause: object,
): Promise<void> {
  // Placeholder - actual cleanup would require proper repository binding
  console.log(`Cleanup requested for ${tableName} - skipped in integration tests`);
}
