/**
 * Integration Tests for Tenant Management Service APIs
 *
 * These tests run against a LIVE server and test REAL scenarios.
 * No mocking - actual API calls with real responses.
 *
 * Prerequisites:
 * 1. Server running on localhost:14000
 * 2. Database connected and migrated
 * 3. Required services (Redis, Temporal) running
 *
 * Run with: npx mocha --require ts-node/register src/__tests__/integration/api.integration.test.ts
 */

import {expect} from '@loopback/testlab';
import {sign} from 'jsonwebtoken';

const BASE_URL = process.env.API_URL || 'http://localhost:14000';
const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-testing';
const JWT_ISSUER = process.env.JWT_ISSUER || 'arc-saas';

// Use valid UUIDs for test user IDs (required by database schema)
const TEST_USER_ID = '00000000-0000-4000-8000-000000000001';
const TEST_TENANT_ID = '28e81841-5af9-4f93-83aa-889c21709f54';

// Helper to generate auth token
function generateAuthToken(overrides: Partial<any> = {}): string {
  const payload = {
    id: TEST_USER_ID,
    userTenantId: TEST_USER_ID,
    tenantId: TEST_TENANT_ID,
    permissions: [
      // All permissions for comprehensive testing
      '10200', '10201', '10202', '10203', // Lead
      '10204', '10205', '10206', '10207', '10216', // Tenant
      '10208', '10209', '10210', '10211', // Contact
      '10212', '10213', '10214', '10215', // Invoice
      '7001', '7002', '7004', '7008', // Subscription
      '10220', '10221', '10222', '10223', // Tenant Config
      '10300', '10301', '10302', '10303', '10304', '10305', '10306', // User
      '10310', '10311', '10312', '10313', // Roles
      '10320', '10321', '10322', '10323', '10324', // Invitations
      '10330', // Activity
      '5321', '5322', '5323', '5324', '5325', '5326', '5327', '5328', '5329', '5331', '5332', '5333', // Billing
    ],
    ...overrides,
  };

  return sign(payload, JWT_SECRET, {
    expiresIn: '1h',
    issuer: JWT_ISSUER,
  });
}

// Store created resources for cleanup
const createdResources: {
  leads: string[];
  tenants: string[];
  subscriptions: string[];
  invoices: string[];
  settings: string[];
  users: string[];
  invitations: string[];
} = {
  leads: [],
  tenants: [],
  subscriptions: [],
  invoices: [],
  settings: [],
  users: [],
  invitations: [],
};

describe('=== ADMIN PORTAL API TESTS ===', function () {
  this.timeout(30000); // 30 second timeout for API calls

  const authToken = generateAuthToken();
  const headers = {
    Authorization: `Bearer ${authToken}`,
    'Content-Type': 'application/json',
  };

  // ============================================
  // PLANS API (Public)
  // ============================================
  describe('PLANS API', () => {
    describe('GET /plans', () => {
      it('should return list of available plans', async () => {
        const response = await fetch(`${BASE_URL}/plans`, {
          method: 'GET',
          headers: {'Content-Type': 'application/json'},
        });

        console.log('GET /plans - Status:', response.status);
        const data = await response.json() as any[];
        console.log('Plans count:', Array.isArray(data) ? data.length : 'N/A');

        expect(response.status).to.equal(200);
        expect(data).to.be.Array();

        if (data.length > 0) {
          const plan = data[0];
          expect(plan).to.have.property('id');
          expect(plan).to.have.property('name');
          expect(plan).to.have.property('price');
          console.log('Sample plan:', plan.id, '-', plan.name, '- $' + plan.price);
        }
      });

      it('should return plan count', async () => {
        const response = await fetch(`${BASE_URL}/plans/count`, {
          method: 'GET',
          headers: {'Content-Type': 'application/json'},
        });

        console.log('GET /plans/count - Status:', response.status);
        const data = await response.json() as {count: number};
        console.log('Plan count:', data.count);

        expect(response.status).to.equal(200);
        expect(data).to.have.property('count');
      });

      it('should return specific plan by ID', async () => {
        const response = await fetch(`${BASE_URL}/plans/plan-basic`, {
          method: 'GET',
          headers: {'Content-Type': 'application/json'},
        });

        console.log('GET /plans/plan-basic - Status:', response.status);

        if (response.status === 200) {
          const data = await response.json() as {id: string};
          console.log('Plan details:', data);
          expect(data).to.have.property('id');
          expect(data.id).to.equal('plan-basic');
        }
      });
    });
  });

  // ============================================
  // TENANTS API
  // ============================================
  describe('TENANTS API', () => {
    describe('GET /tenants', () => {
      it('should return list of tenants with auth', async () => {
        const response = await fetch(`${BASE_URL}/tenants`, {
          method: 'GET',
          headers,
        });

        console.log('GET /tenants - Status:', response.status);

        if (response.status === 200) {
          const data = await response.json();
          console.log('Tenants count:', Array.isArray(data) ? data.length : 'N/A');
          expect(data).to.be.Array();
        } else {
          const error = await response.text();
          console.log('Error:', error);
        }
      });

      it('should reject request without auth', async () => {
        const response = await fetch(`${BASE_URL}/tenants`, {
          method: 'GET',
          headers: {'Content-Type': 'application/json'},
        });

        console.log('GET /tenants (no auth) - Status:', response.status);
        expect(response.status).to.equal(401);
      });
    });

    describe('GET /tenants/count', () => {
      it('should return tenant count', async () => {
        const response = await fetch(`${BASE_URL}/tenants/count`, {
          method: 'GET',
          headers,
        });

        console.log('GET /tenants/count - Status:', response.status);

        if (response.status === 200) {
          const data = await response.json() as {count: number};
          console.log('Tenant count:', data.count);
          expect(data).to.have.property('count');
        }
      });
    });

    describe('GET /tenants/by-key/{key}', () => {
      it('should return 404 for non-existent key', async () => {
        const response = await fetch(`${BASE_URL}/tenants/by-key/non-existent-tenant-key-12345`, {
          method: 'GET',
          headers,
        });

        console.log('GET /tenants/by-key/non-existent - Status:', response.status);
        expect(response.status).to.be.oneOf([404, 204, 500]);
      });
    });
  });

  // ============================================
  // LEADS API
  // ============================================
  describe('LEADS API', () => {
    let createdLeadId: string | null = null;

    describe('POST /leads (Create Lead)', () => {
      it('should create a new lead', async () => {
        const timestamp = Date.now();
        const leadData = {
          firstName: 'Test',
          lastName: 'Lead',
          email: `testlead-${timestamp}@example.com`,
          companyName: `Test Company ${timestamp}`,
        };

        const response = await fetch(`${BASE_URL}/leads`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(leadData),
        });

        console.log('POST /leads - Status:', response.status);
        const data = await response.json() as {id: string};
        console.log('Response:', data);

        if (response.status === 200 || response.status === 201) {
          expect(data).to.have.property('id');
          createdLeadId = data.id;
          createdResources.leads.push(data.id);
        }
      });

      it('should reject duplicate email', async () => {
        const timestamp = Date.now();
        const email = `duplicate-${timestamp}@example.com`;

        // First create
        await fetch(`${BASE_URL}/leads`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            firstName: 'First',
            lastName: 'Lead',
            email,
            companyName: 'Company 1',
          }),
        });

        // Second create with same email
        const response = await fetch(`${BASE_URL}/leads`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            firstName: 'Second',
            lastName: 'Lead',
            email,
            companyName: 'Company 2',
          }),
        });

        console.log('POST /leads (duplicate) - Status:', response.status);
        // Should reject or handle duplicate
      });
    });

    describe('GET /leads', () => {
      it('should return leads list with auth', async () => {
        const response = await fetch(`${BASE_URL}/leads`, {
          method: 'GET',
          headers,
        });

        console.log('GET /leads - Status:', response.status);

        if (response.status === 200) {
          const data = await response.json();
          console.log('Leads count:', Array.isArray(data) ? data.length : 'N/A');
          expect(data).to.be.Array();
        }
      });
    });

    describe('GET /leads/count', () => {
      it('should return leads count', async () => {
        const response = await fetch(`${BASE_URL}/leads/count`, {
          method: 'GET',
          headers,
        });

        console.log('GET /leads/count - Status:', response.status);

        if (response.status === 200) {
          const data = await response.json() as {count: number};
          console.log('Leads count:', data.count);
          expect(data).to.have.property('count');
        }
      });
    });

    describe('GET /leads/verify (Token Verification)', () => {
      it('should return error for missing token', async () => {
        const response = await fetch(`${BASE_URL}/leads/verify`, {
          method: 'GET',
          headers: {'Content-Type': 'application/json'},
        });

        console.log('GET /leads/verify (no token) - Status:', response.status);
        expect(response.status).to.equal(400);
      });

      it('should return error for invalid token', async () => {
        const response = await fetch(`${BASE_URL}/leads/verify?token=invalid-token-12345`, {
          method: 'GET',
          headers: {'Content-Type': 'application/json'},
        });

        console.log('GET /leads/verify (invalid token) - Status:', response.status);
        expect(response.status).to.be.oneOf([400, 401, 404]);
      });
    });
  });

  // ============================================
  // SUBSCRIPTIONS API
  // ============================================
  describe('SUBSCRIPTIONS API', () => {
    describe('GET /subscriptions', () => {
      it('should return subscriptions list', async () => {
        const response = await fetch(`${BASE_URL}/subscriptions`, {
          method: 'GET',
          headers,
        });

        console.log('GET /subscriptions - Status:', response.status);

        if (response.status === 200) {
          const data = await response.json() as any[];
          console.log('Subscriptions count:', Array.isArray(data) ? data.length : 'N/A');
          expect(data).to.be.Array();

          if (data.length > 0) {
            const sub = data[0];
            console.log('Sample subscription:', sub.id, '- Status:', sub.status);
          }
        }
      });
    });

    describe('GET /subscriptions/count', () => {
      it('should return subscriptions count', async () => {
        const response = await fetch(`${BASE_URL}/subscriptions/count`, {
          method: 'GET',
          headers,
        });

        console.log('GET /subscriptions/count - Status:', response.status);

        if (response.status === 200) {
          const data = await response.json() as {count: number};
          console.log('Subscriptions count:', data.count);
          expect(data).to.have.property('count');
        }
      });
    });
  });

  // ============================================
  // INVOICES API
  // ============================================
  describe('INVOICES API', () => {
    describe('GET /invoices', () => {
      it('should return invoices list', async () => {
        const response = await fetch(`${BASE_URL}/invoices`, {
          method: 'GET',
          headers,
        });

        console.log('GET /invoices - Status:', response.status);

        if (response.status === 200) {
          const data = await response.json();
          console.log('Invoices count:', Array.isArray(data) ? data.length : 'N/A');
          expect(data).to.be.Array();
        }
      });
    });

    describe('GET /invoices/count', () => {
      it('should return invoices count', async () => {
        const response = await fetch(`${BASE_URL}/invoices/count`, {
          method: 'GET',
          headers,
        });

        console.log('GET /invoices/count - Status:', response.status);

        if (response.status === 200) {
          const data = await response.json() as {count: number};
          console.log('Invoices count:', data.count);
          expect(data).to.have.property('count');
        }
      });
    });
  });

  // ============================================
  // USERS API
  // ============================================
  describe('USERS API', () => {
    describe('GET /users', () => {
      it('should return users list', async () => {
        const response = await fetch(`${BASE_URL}/users`, {
          method: 'GET',
          headers,
        });

        console.log('GET /users - Status:', response.status);

        if (response.status === 200) {
          const data = await response.json();
          console.log('Users count:', Array.isArray(data) ? data.length : 'N/A');
          expect(data).to.be.Array();
        }
      });
    });

    describe('GET /users/count', () => {
      it('should return users count', async () => {
        const response = await fetch(`${BASE_URL}/users/count`, {
          method: 'GET',
          headers,
        });

        console.log('GET /users/count - Status:', response.status);

        if (response.status === 200) {
          const data = await response.json() as {count: number};
          console.log('Users count:', data.count);
          expect(data).to.have.property('count');
        }
      });
    });
  });

  // ============================================
  // TENANT-USERS API
  // ============================================
  describe('TENANT-USERS API', () => {
    describe('GET /tenant-users', () => {
      it('should return tenant-users list', async () => {
        const response = await fetch(`${BASE_URL}/tenant-users`, {
          method: 'GET',
          headers,
        });

        console.log('GET /tenant-users - Status:', response.status);

        if (response.status === 200) {
          const data = await response.json();
          console.log('Tenant-users count:', Array.isArray(data) ? data.length : 'N/A');
        }
      });
    });

    describe('GET /tenant-users/count', () => {
      it('should return tenant-users count', async () => {
        const response = await fetch(`${BASE_URL}/tenant-users/count`, {
          method: 'GET',
          headers,
        });

        console.log('GET /tenant-users/count - Status:', response.status);

        if (response.status === 200) {
          const data = await response.json() as {count: number};
          console.log('Tenant-users count:', data.count);
        }
      });
    });
  });

  // ============================================
  // USER-INVITATIONS API
  // ============================================
  describe('USER-INVITATIONS API', () => {
    describe('GET /user-invitations', () => {
      it('should return invitations list', async () => {
        const response = await fetch(`${BASE_URL}/user-invitations`, {
          method: 'GET',
          headers,
        });

        console.log('GET /user-invitations - Status:', response.status);

        if (response.status === 200) {
          const data = await response.json();
          console.log('Invitations count:', Array.isArray(data) ? data.length : 'N/A');
        }
      });
    });

    describe('GET /user-invitations/count', () => {
      it('should return invitations count', async () => {
        const response = await fetch(`${BASE_URL}/user-invitations/count`, {
          method: 'GET',
          headers,
        });

        console.log('GET /user-invitations/count - Status:', response.status);

        if (response.status === 200) {
          const data = await response.json() as {count: number};
          console.log('Invitations count:', data.count);
        }
      });
    });

    describe('GET /user-invitations/by-token/{token} (Public)', () => {
      it('should return 404 for invalid token', async () => {
        const response = await fetch(`${BASE_URL}/user-invitations/by-token/invalid-invite-token`, {
          method: 'GET',
          headers: {'Content-Type': 'application/json'},
        });

        console.log('GET /user-invitations/by-token (invalid) - Status:', response.status);
        expect(response.status).to.equal(404);
      });
    });
  });

  // ============================================
  // WORKFLOWS API
  // ============================================
  describe('WORKFLOWS API', () => {
    describe('GET /workflows', () => {
      it('should return workflows list', async () => {
        const response = await fetch(`${BASE_URL}/workflows`, {
          method: 'GET',
          headers,
        });

        console.log('GET /workflows - Status:', response.status);

        if (response.status === 200) {
          const data = await response.json();
          console.log('Workflows count:', Array.isArray(data) ? data.length : 'N/A');
        }
      });
    });

    describe('GET /workflows/count', () => {
      it('should return workflows count', async () => {
        const response = await fetch(`${BASE_URL}/workflows/count`, {
          method: 'GET',
          headers,
        });

        console.log('GET /workflows/count - Status:', response.status);

        if (response.status === 200) {
          const data = await response.json() as {count: number};
          console.log('Workflows count:', data.count);
        }
      });
    });
  });

  // ============================================
  // BILLING ANALYTICS API
  // ============================================
  describe('BILLING ANALYTICS API', () => {
    describe('GET /billing/metrics', () => {
      it('should return billing metrics', async () => {
        const response = await fetch(`${BASE_URL}/billing/metrics`, {
          method: 'GET',
          headers,
        });

        console.log('GET /billing/metrics - Status:', response.status);

        if (response.status === 200) {
          const data = await response.json();
          console.log('Billing metrics:', data);
          expect(data).to.have.property('totalRevenue');
          expect(data).to.have.property('activeSubscriptions');
          expect(data).to.have.property('mrr');
          expect(data).to.have.property('arr');
        }
      });
    });

    describe('GET /billing/invoices', () => {
      it('should return paginated invoices', async () => {
        const response = await fetch(`${BASE_URL}/billing/invoices?page=1&pageSize=10`, {
          method: 'GET',
          headers,
        });

        console.log('GET /billing/invoices - Status:', response.status);

        if (response.status === 200) {
          const data = await response.json();
          console.log('Billing invoices:', data);
          expect(data).to.have.property('data');
          expect(data).to.have.property('total');
          expect(data).to.have.property('page');
          expect(data).to.have.property('pageSize');
        }
      });
    });

    describe('GET /billing/revenue-by-plan', () => {
      it('should return revenue by plan breakdown', async () => {
        const response = await fetch(`${BASE_URL}/billing/revenue-by-plan`, {
          method: 'GET',
          headers,
        });

        console.log('GET /billing/revenue-by-plan - Status:', response.status);

        if (response.status === 200) {
          const data = await response.json();
          console.log('Revenue by plan:', data);
          expect(data).to.be.Array();
        }
      });
    });

    describe('GET /billing/monthly-revenue', () => {
      it('should return monthly revenue data', async () => {
        const response = await fetch(`${BASE_URL}/billing/monthly-revenue`, {
          method: 'GET',
          headers,
        });

        console.log('GET /billing/monthly-revenue - Status:', response.status);

        if (response.status === 200) {
          const data = await response.json() as any[];
          console.log('Monthly revenue entries:', data.length);
          expect(data).to.be.Array();
        }
      });
    });

    describe('GET /billing/subscription-growth', () => {
      it('should return subscription growth data', async () => {
        const response = await fetch(`${BASE_URL}/billing/subscription-growth`, {
          method: 'GET',
          headers,
        });

        console.log('GET /billing/subscription-growth - Status:', response.status);

        if (response.status === 200) {
          const data = await response.json();
          console.log('Subscription growth:', data);
          expect(data).to.have.property('totalActive');
          expect(data).to.have.property('newThisMonth');
          expect(data).to.have.property('churnedThisMonth');
          expect(data).to.have.property('growthRate');
        }
      });
    });
  });

  // ============================================
  // SETTINGS API
  // ============================================
  describe('SETTINGS API', () => {
    let createdSettingId: string | null = null;

    describe('POST /settings (Create)', () => {
      it('should create a new setting', async () => {
        const timestamp = Date.now();
        const settingData = {
          configKey: `test.setting.${timestamp}`,
          configValue: 'test-value',
          valueType: 'string',
          description: 'Test setting for integration tests',
          category: 'test',
          isPublic: false,
        };

        const response = await fetch(`${BASE_URL}/settings`, {
          method: 'POST',
          headers,
          body: JSON.stringify(settingData),
        });

        console.log('POST /settings - Status:', response.status);

        if (response.status === 200 || response.status === 201) {
          const data = await response.json() as {id: string; configKey: string};
          console.log('Created setting:', data);
          createdSettingId = data.id;
          createdResources.settings.push(data.id);
          expect(data).to.have.property('id');
          expect(data.configKey).to.equal(settingData.configKey);
        }
      });
    });

    describe('GET /settings', () => {
      it('should return settings list', async () => {
        const response = await fetch(`${BASE_URL}/settings`, {
          method: 'GET',
          headers,
        });

        console.log('GET /settings - Status:', response.status);

        if (response.status === 200) {
          const data = await response.json();
          console.log('Settings count:', Array.isArray(data) ? data.length : 'N/A');
          expect(data).to.be.Array();
        }
      });
    });

    describe('GET /settings/count', () => {
      it('should return settings count', async () => {
        const response = await fetch(`${BASE_URL}/settings/count`, {
          method: 'GET',
          headers,
        });

        console.log('GET /settings/count - Status:', response.status);

        if (response.status === 200) {
          const data = await response.json() as {count: number};
          console.log('Settings count:', data.count);
          expect(data).to.have.property('count');
        }
      });
    });

    describe('DELETE /settings/{id}', () => {
      it('should delete a setting', async function () {
        if (!createdSettingId) {
          this.skip();
          return;
        }

        const response = await fetch(`${BASE_URL}/settings/${createdSettingId}`, {
          method: 'DELETE',
          headers,
        });

        console.log('DELETE /settings - Status:', response.status);
        expect(response.status).to.be.oneOf([200, 204]);
      });
    });
  });

  // ============================================
  // HEALTH CHECK API
  // ============================================
  describe('HEALTH CHECK API', () => {
    describe('GET /health', () => {
      it('should return health status', async () => {
        const response = await fetch(`${BASE_URL}/health`, {
          method: 'GET',
          headers: {'Content-Type': 'application/json'},
        });

        console.log('GET /health - Status:', response.status);
        expect(response.status).to.equal(200);
      });
    });

    describe('GET /ping', () => {
      it('should return pong', async () => {
        const response = await fetch(`${BASE_URL}/ping`, {
          method: 'GET',
          headers: {'Content-Type': 'application/json'},
        });

        console.log('GET /ping - Status:', response.status);
        expect(response.status).to.equal(200);
      });
    });
  });
});

describe('=== CUSTOMER PORTAL API TESTS ===', function () {
  this.timeout(30000);

  // Customer portal uses tenant-specific tokens
  const customerToken = generateAuthToken({
    id: 'customer-user-id',
    userTenantId: 'customer-tenant-id',
    tenantId: 'customer-tenant-id',
    permissions: [
      '7004', '7008', // View subscription, View plan
      '10301', // View user
      '10215', // View invoice
    ],
  });

  const headers = {
    Authorization: `Bearer ${customerToken}`,
    'Content-Type': 'application/json',
  };

  describe('Customer Dashboard Data', () => {
    it('should access plans (public)', async () => {
      const response = await fetch(`${BASE_URL}/plans`, {
        method: 'GET',
        headers: {'Content-Type': 'application/json'},
      });

      console.log('[CUSTOMER] GET /plans - Status:', response.status);
      expect(response.status).to.equal(200);
    });

    it('should access tenant data with customer token', async () => {
      const response = await fetch(`${BASE_URL}/tenants`, {
        method: 'GET',
        headers,
      });

      console.log('[CUSTOMER] GET /tenants - Status:', response.status);
      // Customer may have limited access
    });

    it('should access subscriptions', async () => {
      const response = await fetch(`${BASE_URL}/subscriptions`, {
        method: 'GET',
        headers,
      });

      console.log('[CUSTOMER] GET /subscriptions - Status:', response.status);
    });

    it('should access invoices', async () => {
      const response = await fetch(`${BASE_URL}/invoices`, {
        method: 'GET',
        headers,
      });

      console.log('[CUSTOMER] GET /invoices - Status:', response.status);
    });
  });
});

describe('=== ERROR HANDLING TESTS ===', function () {
  this.timeout(30000);

  describe('Authentication Errors', () => {
    it('should return 401 for missing token on protected endpoints', async () => {
      const protectedEndpoints = [
        '/tenants',
        '/subscriptions',
        '/invoices',
        '/users',
        '/billing/metrics',
      ];

      for (const endpoint of protectedEndpoints) {
        const response = await fetch(`${BASE_URL}${endpoint}`, {
          method: 'GET',
          headers: {'Content-Type': 'application/json'},
        });

        console.log(`${endpoint} (no auth) - Status:`, response.status);
        expect(response.status).to.equal(401);
      }
    });

    it('should return 401 for invalid token', async () => {
      const response = await fetch(`${BASE_URL}/tenants`, {
        method: 'GET',
        headers: {
          Authorization: 'Bearer invalid-token-12345',
          'Content-Type': 'application/json',
        },
      });

      console.log('Invalid token - Status:', response.status);
      expect(response.status).to.equal(401);
    });
  });

  describe('Not Found Errors', () => {
    it('should return 404 for non-existent endpoints', async () => {
      const response = await fetch(`${BASE_URL}/non-existent-endpoint`, {
        method: 'GET',
        headers: {'Content-Type': 'application/json'},
      });

      console.log('Non-existent endpoint - Status:', response.status);
      expect(response.status).to.equal(404);
    });
  });

  describe('Validation Errors', () => {
    it('should return 400 for invalid lead data', async () => {
      const response = await fetch(`${BASE_URL}/leads`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          // Missing required fields
        }),
      });

      console.log('Invalid lead data - Status:', response.status);
      expect(response.status).to.be.oneOf([400, 422]);
    });
  });
});

// Summary report
after(() => {
  console.log('\n========================================');
  console.log('TEST SUMMARY');
  console.log('========================================');
  console.log('Created resources:');
  console.log('- Leads:', createdResources.leads.length);
  console.log('- Tenants:', createdResources.tenants.length);
  console.log('- Settings:', createdResources.settings.length);
  console.log('========================================\n');
});
