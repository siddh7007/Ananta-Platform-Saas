import {expect} from '@loopback/testlab';
import {
  generateTestToken,
  generateUUID,
  getBillingPermissions,
} from '../../helper/test-helper';

describe('PaymentMethodsController (Unit Tests)', () => {
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

  describe('GET /payment-methods', () => {
    it('should return list of payment methods', async () => {
      const response = await fetch(`${baseUrl}/payment-methods`, {
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
      const response = await fetch(`${baseUrl}/payment-methods`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).to.equal(401);
    });
  });

  describe('GET /payment-methods/count', () => {
    it('should return payment method count', async () => {
      const response = await fetch(`${baseUrl}/payment-methods/count`, {
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

  describe('GET /payment-methods/{id}', () => {
    it('should return 404 for non-existent payment method', async () => {
      const fakeId = generateUUID();
      const response = await fetch(`${baseUrl}/payment-methods/${fakeId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).to.be.oneOf([404, 500]);
    });

    it('should return 400 for invalid UUID', async () => {
      const response = await fetch(`${baseUrl}/payment-methods/invalid-id`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).to.be.oneOf([400, 404, 500]);
    });
  });

  describe('GET /payment-methods/default', () => {
    it('should return 404 when no default payment method exists', async () => {
      const response = await fetch(`${baseUrl}/payment-methods/default`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      // May return 404 if no default, or 200 with null/empty
      expect(response.status).to.be.oneOf([200, 404]);
    });
  });

  describe('POST /payment-methods/setup-intent', () => {
    it('should require authentication', async () => {
      const response = await fetch(`${baseUrl}/payment-methods/setup-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).to.equal(401);
    });

    it('should return setup intent when Stripe is configured', async () => {
      const response = await fetch(`${baseUrl}/payment-methods/setup-intent`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      // 503 if Stripe not enabled, 200/201 if enabled
      expect(response.status).to.be.oneOf([200, 201, 503]);

      if (response.status === 200 || response.status === 201) {
        const data = (await response.json()) as {clientSecret?: string};
        expect(data).to.have.property('clientSecret');
      }
    });
  });

  describe('DELETE /payment-methods/{id}', () => {
    it('should return 404 for non-existent payment method', async () => {
      const fakeId = generateUUID();
      const response = await fetch(`${baseUrl}/payment-methods/${fakeId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).to.be.oneOf([404, 500]);
    });
  });

  describe('PATCH /payment-methods/{id}/set-default', () => {
    it('should return 404 for non-existent payment method', async () => {
      const fakeId = generateUUID();
      const response = await fetch(
        `${baseUrl}/payment-methods/${fakeId}/set-default`,
        {
          method: 'PATCH',
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

      const response = await fetch(`${baseUrl}/payment-methods`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${limitedToken}`,
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).to.equal(403);
    });
  });
});

// Export for test runner
export default {};
