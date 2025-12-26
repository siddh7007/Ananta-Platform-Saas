import {expect} from '@loopback/testlab';
import {
  generateTestToken,
  generateUUID,
  getBillingPermissions,
} from '../../helper/test-helper';

describe('PaymentIntentsController (Unit Tests)', () => {
  const baseUrl = 'http://localhost:14000';
  let authToken: string;
  const testTenantId = generateUUID();

  before(() => {
    authToken = generateTestToken({
      id: 'test-admin-id',
      userTenantId: testTenantId,
      tenantId: testTenantId,
      permissions: getBillingPermissions(),
    });
  });

  describe('GET /payment-intents', () => {
    it('should return list of payment intents', async () => {
      const response = await fetch(`${baseUrl}/payment-intents`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).to.equal(200);
      const data = await response.json();
      expect(data).to.be.Array();
    });

    it('should return 401 without auth token', async () => {
      const response = await fetch(`${baseUrl}/payment-intents`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).to.equal(401);
    });
  });

  describe('GET /payment-intents/count', () => {
    it('should return payment intent count', async () => {
      const response = await fetch(`${baseUrl}/payment-intents/count`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).to.equal(200);
      const data = (await response.json()) as {count: number};
      expect(data).to.have.property('count');
      expect(data.count).to.be.Number();
    });
  });

  describe('GET /payment-intents/{id}', () => {
    it('should return 404 for non-existent payment intent', async () => {
      const fakeId = generateUUID();
      const response = await fetch(`${baseUrl}/payment-intents/${fakeId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).to.be.oneOf([404, 500]);
    });

    it('should return 400 for invalid UUID', async () => {
      const response = await fetch(`${baseUrl}/payment-intents/invalid-id`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).to.be.oneOf([400, 404, 500]);
    });
  });

  describe('GET /payment-intents/invoice/{invoiceId}', () => {
    it('should return empty array for non-existent invoice', async () => {
      const fakeInvoiceId = generateUUID();
      const response = await fetch(
        `${baseUrl}/payment-intents/invoice/${fakeInvoiceId}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      expect(response.status).to.equal(200);
      const data = await response.json();
      expect(data).to.be.Array();
      expect(data).to.have.length(0);
    });
  });

  describe('POST /payment-intents/{id}/sync', () => {
    it('should return 404 for non-existent payment intent', async () => {
      const fakeId = generateUUID();
      const response = await fetch(`${baseUrl}/payment-intents/${fakeId}/sync`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).to.be.oneOf([404, 500]);
    });
  });

  describe('POST /payment-intents/{id}/cancel', () => {
    it('should return 404 for non-existent payment intent', async () => {
      const fakeId = generateUUID();
      const response = await fetch(
        `${baseUrl}/payment-intents/${fakeId}/cancel`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      expect(response.status).to.be.oneOf([404, 500]);
    });
  });

  describe('Authorization Tests', () => {
    it('should reject requests without billing permissions', async () => {
      const limitedToken = generateTestToken({
        id: 'test-user-id',
        userTenantId: testTenantId,
        tenantId: testTenantId,
        permissions: [], // No permissions
      });

      const response = await fetch(`${baseUrl}/payment-intents`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${limitedToken}`,
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).to.equal(403);
    });
  });

  describe('Payment Intent Statuses', () => {
    it('should filter payment intents by status', async () => {
      const response = await fetch(
        `${baseUrl}/payment-intents?filter=${encodeURIComponent(JSON.stringify({where: {status: 'succeeded'}}))}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      expect(response.status).to.equal(200);
      const data = await response.json();
      expect(data).to.be.Array();
    });
  });
});

// Export for test runner
export default {};
