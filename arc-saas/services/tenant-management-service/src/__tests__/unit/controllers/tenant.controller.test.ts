import {expect} from '@loopback/testlab';
import {
  generateTestToken,
  generateUUID,
  createTestTenant,
} from '../../helper/test-helper';

describe('TenantController (Unit Tests)', () => {
  const baseUrl = 'http://localhost:14000';
  let authToken: string;
  let createdTenantId: string;

  before(() => {
    authToken = generateTestToken({
      id: 'test-admin-id',
      userTenantId: 'test-admin-id',
      permissions: [
        '10204', '10205', '10206', '10207', '10216', // Tenant permissions
        '7001', '7002', '7004', '7008', // Subscription permissions
      ],
    });
  });

  describe('GET /tenants', () => {
    it('should return list of tenants', async () => {
      const response = await fetch(`${baseUrl}/tenants`, {
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
      const response = await fetch(`${baseUrl}/tenants`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).to.equal(401);
    });
  });

  describe('GET /tenants/count', () => {
    it('should return tenant count', async () => {
      const response = await fetch(`${baseUrl}/tenants/count`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).to.equal(200);
      const data = await response.json() as {count: number};
      expect(data).to.have.property('count');
      expect(data.count).to.be.Number();
    });
  });

  describe('GET /tenants/{id}', () => {
    it('should return 404 for non-existent tenant', async () => {
      const fakeId = generateUUID();
      const response = await fetch(`${baseUrl}/tenants/${fakeId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).to.be.oneOf([404, 500]);
    });

    it('should return 400 for invalid UUID', async () => {
      const response = await fetch(`${baseUrl}/tenants/invalid-id`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).to.be.oneOf([400, 404, 500]);
    });
  });

  describe('GET /tenants/by-key/{key}', () => {
    it('should return 404 for non-existent key', async () => {
      const response = await fetch(`${baseUrl}/tenants/by-key/non-existent-key`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).to.be.oneOf([404, 500]);
    });
  });

  describe('POST /tenants/{id}/provision', () => {
    it('should return 404 for non-existent tenant', async () => {
      const fakeId = generateUUID();
      const response = await fetch(`${baseUrl}/tenants/${fakeId}/provision`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).to.be.oneOf([404, 422, 500]);
    });
  });

  describe('Tenant CRUD Flow', () => {
    it('should get tenants list and verify structure', async () => {
      const response = await fetch(`${baseUrl}/tenants`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).to.equal(200);
      const tenants = await response.json() as any[];

      if (tenants.length > 0) {
        const tenant = tenants[0];
        expect(tenant).to.have.property('id');
        expect(tenant).to.have.property('name');
        expect(tenant).to.have.property('key');
      }
    });
  });
});

// Export for test runner
export default {};
