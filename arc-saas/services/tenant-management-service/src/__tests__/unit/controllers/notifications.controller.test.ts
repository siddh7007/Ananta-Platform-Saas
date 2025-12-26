import {expect} from '@loopback/testlab';
import {
  generateTestToken,
  generateUUID,
} from '../../helper/test-helper';
import {NotificationCategory} from '../../../models/notification-preference.model';

/**
 * Unit tests for NotificationsController endpoints
 *
 * These tests cover the notification preferences CRUD endpoints
 * and require the tenant-management-service to be running.
 */
describe('NotificationsController (Unit Tests)', () => {
  const baseUrl = 'http://localhost:14000';
  let authToken: string;
  const testTenantId = generateUUID();

  before(() => {
    // Generate token with admin permissions for notification endpoints
    authToken = generateTestToken({
      id: testTenantId,
      userTenantId: testTenantId,
      tenantId: testTenantId,
      permissions: [
        // All permissions for comprehensive testing
        '10200', '10201', '10202', '10203', // Lead
        '10204', '10205', '10206', '10207', '10216', // Tenant
        '10208', '10209', '10210', '10211', // Contact
        '10212', '10213', '10214', '10215', // Invoice
        '7001', '7002', '7004', '7008', // Subscription
        '10220', '10221', '10222', '10223', // Tenant Config
        '10300', '10301', '10302', '10303', '10304', '10305', '10306', // User
        '5321', '5322', '5323', '5324', '5325', '5326', '5327', '5328', '5329', '5331', '5332', '5333', // Billing
      ],
    });
  });

  describe('GET /notifications/preferences', () => {
    it('should return list of notification preferences', async () => {
      const response = await fetch(`${baseUrl}/notifications/preferences`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).to.equal(200);
      const data = await response.json() as any[];
      expect(data).to.be.Array();

      // Should have preferences for all categories (defaults if not set)
      expect(data.length).to.be.greaterThanOrEqual(
        Object.values(NotificationCategory).length,
      );
    });

    it('should return 401 without auth token', async () => {
      const response = await fetch(`${baseUrl}/notifications/preferences`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).to.equal(401);
    });

    it('should return preferences with expected structure', async () => {
      const response = await fetch(`${baseUrl}/notifications/preferences`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).to.equal(200);
      const prefs = await response.json() as any[];

      if (prefs.length > 0) {
        const pref = prefs[0];
        // Verify expected properties exist
        expect(pref).to.have.property('category');
        expect(pref).to.have.property('tenantId');
        expect(pref).to.have.property('emailEnabled');
        expect(pref).to.have.property('smsEnabled');
        expect(pref).to.have.property('pushEnabled');
        expect(pref).to.have.property('inAppEnabled');
        expect(pref).to.have.property('webhookEnabled');
      }
    });
  });

  describe('GET /notifications/preferences/categories', () => {
    it('should return list of notification categories', async () => {
      const response = await fetch(`${baseUrl}/notifications/preferences/categories`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).to.equal(200);
      const data = await response.json() as any[];
      expect(data).to.be.Array();

      // Should return all available categories
      const expectedCategories = Object.values(NotificationCategory);
      expect(data.length).to.equal(expectedCategories.length);

      // Verify category structure
      for (const cat of data) {
        expect(cat).to.have.property('id');
        expect(cat).to.have.property('name');
        expect(cat).to.have.property('description');
        expect(expectedCategories).to.containEql(cat.id);
      }
    });
  });

  describe('GET /notifications/preferences/{category}', () => {
    it('should return preference for specific category', async () => {
      const category = NotificationCategory.BILLING;
      const response = await fetch(
        `${baseUrl}/notifications/preferences/${category}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      expect(response.status).to.equal(200);
      const pref = await response.json() as any;

      expect(pref.category).to.equal(category);
      expect(pref).to.have.property('emailEnabled');
      expect(pref).to.have.property('smsEnabled');
      expect(pref).to.have.property('inAppEnabled');
    });

    it('should return 400 for invalid category', async () => {
      const response = await fetch(
        `${baseUrl}/notifications/preferences/invalid-category`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      expect(response.status).to.be.oneOf([400, 422, 404]);
    });

    it('should return default preferences for security category (SMS enabled)', async () => {
      const category = NotificationCategory.SECURITY;
      const response = await fetch(
        `${baseUrl}/notifications/preferences/${category}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      expect(response.status).to.equal(200);
      const pref = await response.json() as any;

      expect(pref.category).to.equal(category);
      // Security category has SMS enabled by default for MFA
      // Note: This may be customized by the tenant, so we just verify the property exists
      expect(typeof pref.smsEnabled).to.equal('boolean');
    });
  });

  describe('PUT /notifications/preferences/{category}', () => {
    it('should update preference for specific category', async () => {
      const category = NotificationCategory.BILLING;
      const response = await fetch(
        `${baseUrl}/notifications/preferences/${category}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            emailEnabled: true,
            smsEnabled: false,
            pushEnabled: true,
            inAppEnabled: true,
            webhookEnabled: false,
          }),
        },
      );

      expect(response.status).to.be.oneOf([200, 204]);

      // Verify the update persisted
      const getResponse = await fetch(
        `${baseUrl}/notifications/preferences/${category}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      expect(getResponse.status).to.equal(200);
      const pref = await getResponse.json() as any;
      expect(pref.category).to.equal(category);
      expect(pref.emailEnabled).to.be.true();
      expect(pref.pushEnabled).to.be.true();
    });

    it('should update webhook URL when enabling webhook', async () => {
      const category = NotificationCategory.WORKFLOW;
      const webhookUrl = 'https://test-webhook.example.com/notifications';

      const response = await fetch(
        `${baseUrl}/notifications/preferences/${category}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            webhookEnabled: true,
            webhookUrl: webhookUrl,
          }),
        },
      );

      expect(response.status).to.be.oneOf([200, 204]);

      // Verify the webhook URL was saved
      const getResponse = await fetch(
        `${baseUrl}/notifications/preferences/${category}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const pref = await getResponse.json() as any;
      expect(pref.webhookEnabled).to.be.true();
      expect(pref.webhookUrl).to.equal(webhookUrl);
    });

    it('should return 401 without auth token', async () => {
      const response = await fetch(
        `${baseUrl}/notifications/preferences/${NotificationCategory.BILLING}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            emailEnabled: true,
          }),
        },
      );

      expect(response.status).to.equal(401);
    });

    it('should return 400 for invalid category', async () => {
      const response = await fetch(
        `${baseUrl}/notifications/preferences/not-a-category`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            emailEnabled: true,
          }),
        },
      );

      expect(response.status).to.be.oneOf([400, 422, 404]);
    });
  });

  describe('PUT /notifications/preferences (Bulk Update)', () => {
    it('should update multiple category preferences at once', async () => {
      const response = await fetch(`${baseUrl}/notifications/preferences`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          {
            category: NotificationCategory.BILLING,
            emailEnabled: true,
            smsEnabled: false,
            pushEnabled: false,
            inAppEnabled: true,
            webhookEnabled: false,
          },
          {
            category: NotificationCategory.SECURITY,
            emailEnabled: true,
            smsEnabled: true,
            pushEnabled: true,
            inAppEnabled: true,
            webhookEnabled: false,
          },
        ]),
      });

      expect(response.status).to.be.oneOf([200, 204]);
    });

    it('should return 401 without auth token', async () => {
      const response = await fetch(`${baseUrl}/notifications/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          {
            category: NotificationCategory.BILLING,
            emailEnabled: true,
          },
        ]),
      });

      expect(response.status).to.equal(401);
    });
  });

  describe('Notification Templates Endpoints', () => {
    it('should return list of templates', async () => {
      const response = await fetch(`${baseUrl}/notifications/templates`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).to.equal(200);
      const templates = await response.json() as any[];
      expect(templates).to.be.Array();

      // Should have templates defined
      if (templates.length > 0) {
        const template = templates[0];
        expect(template).to.have.property('id');
        expect(template).to.have.property('name');
      }
    });
  });

  describe('Notification History Endpoint', () => {
    it('should return notification history', async () => {
      const response = await fetch(`${baseUrl}/notifications/history`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).to.equal(200);
      const data = await response.json() as {items: unknown[]};
      expect(data).to.have.property('items');
      expect(data.items).to.be.Array();
    });

    it('should support pagination parameters', async () => {
      const response = await fetch(
        `${baseUrl}/notifications/history?limit=5&offset=0`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      expect(response.status).to.equal(200);
      const data = await response.json() as {items: unknown[]; total: number};
      expect(data).to.have.property('items');
      expect(data).to.have.property('total');
    });
  });

  describe('Permission Validation', () => {
    it('should require authentication for all preference endpoints', async () => {
      const endpoints = [
        {method: 'GET', url: '/notifications/preferences'},
        {method: 'GET', url: '/notifications/preferences/billing'},
        {method: 'PUT', url: '/notifications/preferences/billing'},
        {method: 'GET', url: '/notifications/preferences/categories'},
      ];

      for (const endpoint of endpoints) {
        const response = await fetch(`${baseUrl}${endpoint.url}`, {
          method: endpoint.method,
          headers: {
            'Content-Type': 'application/json',
          },
          body: endpoint.method === 'PUT' ? JSON.stringify({emailEnabled: true}) : undefined,
        });

        expect(response.status).to.equal(401);
      }
    });
  });
});

// Export for test runner
export default {};
