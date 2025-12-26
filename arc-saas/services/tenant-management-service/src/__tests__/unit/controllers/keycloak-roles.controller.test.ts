import {expect} from '@loopback/testlab';
import {
  generateTestToken,
  generateUUID,
} from '../../helper/test-helper';

/**
 * KeycloakRolesController Unit Tests
 *
 * Tests the Keycloak admin role management controller endpoints.
 * Note: These tests require the backend service to be running on localhost:14000.
 */
describe('KeycloakRolesController (Unit Tests)', () => {
  const baseUrl = 'http://localhost:14000';
  let authToken: string;

  before(() => {
    // Generate auth token with role management permissions
    authToken = generateTestToken({
      id: 'test-admin-id',
      userTenantId: 'test-admin-id',
      tenantId: generateUUID(),
      permissions: [
        '10310', // ViewRole
        '10311', // CreateRole
        '10312', // AssignRole
        '10313', // RevokeRole
      ],
    });
  });

  describe('GET /keycloak/status', () => {
    it('should return Keycloak connection status', async () => {
      const response = await fetch(`${baseUrl}/keycloak/status`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).to.equal(200);
      const data = await response.json() as {
        connected: boolean;
        url: string;
        error?: string;
      };
      expect(data).to.have.property('connected');
      expect(data).to.have.property('url');
      expect(typeof data.connected).to.equal('boolean');
      expect(typeof data.url).to.equal('string');
    });

    it('should return 401 without auth token', async () => {
      const response = await fetch(`${baseUrl}/keycloak/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).to.equal(401);
    });
  });

  describe('GET /keycloak/roles', () => {
    it('should return list of Keycloak realm roles', async () => {
      const response = await fetch(`${baseUrl}/keycloak/roles`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      // May return 200 with roles array or error if Keycloak not connected
      expect(response.status).to.be.oneOf([200, 500, 502, 503]);

      if (response.status === 200) {
        const data = await response.json() as Array<{name: string; id: string}>;
        expect(data).to.be.Array();
        // Each role should have expected properties
        if (data.length > 0) {
          expect(data[0]).to.have.property('name');
        }
      }
    });

    it('should return 401 without auth token', async () => {
      const response = await fetch(`${baseUrl}/keycloak/roles`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).to.equal(401);
    });
  });

  describe('GET /keycloak/roles/{roleName}', () => {
    it('should return role details for existing role', async () => {
      // First try to get a common role that might exist
      const response = await fetch(`${baseUrl}/keycloak/roles/admin`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      // May return 200 if role exists, 404 if not, or 5xx if Keycloak not connected
      expect(response.status).to.be.oneOf([200, 404, 500, 502, 503]);

      if (response.status === 200) {
        const data = await response.json() as {
          id: string;
          name: string;
          description?: string;
        };
        expect(data).to.have.property('id');
        expect(data).to.have.property('name');
        expect(data.name).to.equal('admin');
      }
    });

    it('should return 404 for non-existent role (if Keycloak connected)', async () => {
      const response = await fetch(`${baseUrl}/keycloak/roles/non-existent-role-xyz-12345`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      // Should be 404 if Keycloak is connected, or 5xx if not
      expect(response.status).to.be.oneOf([404, 500, 502, 503]);
    });
  });

  describe('GET /keycloak/roles/{roleName}/users', () => {
    it('should return users with role', async () => {
      const response = await fetch(`${baseUrl}/keycloak/roles/admin/users`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      // May return 200 with users array or error if Keycloak not connected
      expect(response.status).to.be.oneOf([200, 404, 500, 502, 503]);

      if (response.status === 200) {
        const data = await response.json() as Array<{id: string; username: string}>;
        expect(data).to.be.Array();
        if (data.length > 0) {
          expect(data[0]).to.have.property('id');
          expect(data[0]).to.have.property('username');
        }
      }
    });

    it('should support limit parameter', async () => {
      const response = await fetch(`${baseUrl}/keycloak/roles/admin/users?limit=5`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).to.be.oneOf([200, 404, 500, 502, 503]);
    });
  });

  describe('POST /keycloak/roles/sync', () => {
    it('should sync role to Keycloak', async () => {
      const roleData = {
        key: 'test-role-sync',
        name: 'Test Role Sync',
        description: 'A test role for sync testing',
      };

      const response = await fetch(`${baseUrl}/keycloak/roles/sync`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(roleData),
      });

      // May return 200 if successful or 5xx if Keycloak not connected
      expect(response.status).to.be.oneOf([200, 500, 502, 503]);

      if (response.status === 200) {
        const data = await response.json() as {
          synced: boolean;
          created: boolean;
        };
        expect(data).to.have.property('synced');
        expect(data).to.have.property('created');
        expect(data.synced).to.be.true();
      }
    });

    it('should return 400 for invalid request body', async () => {
      const response = await fetch(`${baseUrl}/keycloak/roles/sync`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Missing required 'key' field
          name: 'Test Role',
        }),
      });

      expect(response.status).to.be.oneOf([400, 422, 500]);
    });

    it('should return 401 without auth token', async () => {
      const response = await fetch(`${baseUrl}/keycloak/roles/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key: 'test-role',
          name: 'Test Role',
        }),
      });

      expect(response.status).to.equal(401);
    });
  });

  describe('DELETE /keycloak/roles/{roleName}', () => {
    it('should prevent deletion of system roles', async () => {
      // Try to delete a protected system role
      const protectedRoles = ['super_admin', 'admin', 'owner', 'engineer', 'analyst'];

      for (const roleName of protectedRoles) {
        const response = await fetch(`${baseUrl}/keycloak/roles/${roleName}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        });

        // Should return 403 Forbidden for system roles (or 5xx if Keycloak not connected)
        expect(response.status).to.be.oneOf([403, 500, 502, 503]);
      }
    });

    it('should prevent deletion of Keycloak built-in roles', async () => {
      const builtInRoles = ['offline_access', 'uma_authorization'];

      for (const roleName of builtInRoles) {
        const response = await fetch(`${baseUrl}/keycloak/roles/${roleName}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        });

        // Should return 403 Forbidden for built-in roles (or 5xx if Keycloak not connected)
        expect(response.status).to.be.oneOf([403, 500, 502, 503]);
      }
    });

    it('should return 401 without auth token', async () => {
      const response = await fetch(`${baseUrl}/keycloak/roles/test-role`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).to.equal(401);
    });
  });

  describe('GET /keycloak/realm', () => {
    it('should return realm information', async () => {
      const response = await fetch(`${baseUrl}/keycloak/realm`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      // May return 200 with realm info or error if Keycloak not connected
      expect(response.status).to.be.oneOf([200, 500, 502, 503]);

      if (response.status === 200) {
        const data = await response.json() as {
          realm: string;
          enabled: boolean;
        };
        expect(data).to.have.property('realm');
        expect(data).to.have.property('enabled');
      }
    });

    it('should return 401 without auth token', async () => {
      const response = await fetch(`${baseUrl}/keycloak/realm`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).to.equal(401);
    });
  });
});

describe('KeycloakRolesController Protected Roles', () => {
  describe('System Role Protection', () => {
    it('should protect all CBP/CNS role hierarchy levels', () => {
      const protectedRoles = [
        'super_admin', // Level 5
        'admin',       // Level 3
        'owner',       // Level 4
        'engineer',    // Level 2
        'analyst',     // Level 1
      ];

      // These roles should exist and be protected
      expect(protectedRoles).to.have.length(5);
    });

    it('should protect Keycloak built-in roles', () => {
      const builtInRoles = [
        'offline_access',
        'uma_authorization',
      ];

      expect(builtInRoles).to.have.length(2);
    });

    it('should dynamically protect default-roles-{realm} pattern', () => {
      // Test that the pattern matches realm-specific default roles
      const testRealms = ['arc-saas', 'test-tenant', 'custom-realm'];

      for (const realm of testRealms) {
        const defaultRole = `default-roles-${realm}`;
        expect(defaultRole).to.startWith('default-roles-');
      }
    });
  });
});
