/**
 * Role Parser Tests
 *
 * Verifies Keycloak JWT role extraction and mapping to CBP/CNS 5-level hierarchy.
 *
 * Role Hierarchy (privilege levels 1-5):
 * - analyst (1): Read-only access + reports (lowest customer role)
 * - engineer (2): Can manage BOMs, components, specifications
 * - admin (3): Organization management, user administration
 * - owner (4): Organization owner - billing, delete org
 * - super_admin (5): Platform-wide access (Ananta staff only)
 */

import { describe, it, expect } from 'vitest';
import {
  ROLE_HIERARCHY,
  DEFAULT_ROLE,
  mapToAppRole,
  hasMinimumRole,
  isSuperAdmin,
  isAdmin,
  isOwner,
  isEngineer,
  isAnalyst,
  decodeJwtPayload,
  extractKeycloakRoles,
  getRoleFromToken,
  type AppRole,
} from './role-parser';

// Test JWT tokens (base64 encoded payloads)
function createTestToken(payload: Record<string, unknown>): string {
  // JWT format: header.payload.signature
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const encodedPayload = btoa(JSON.stringify(payload));
  const signature = 'test-signature'; // Not validated in UI
  return `${header}.${encodedPayload}.${signature}`;
}

describe('Role Hierarchy', () => {
  it('has correct priority levels for CBP/CNS alignment', () => {
    expect(ROLE_HIERARCHY.analyst).toBe(1);
    expect(ROLE_HIERARCHY.engineer).toBe(2);
    expect(ROLE_HIERARCHY.admin).toBe(3);
    expect(ROLE_HIERARCHY.owner).toBe(4);
    expect(ROLE_HIERARCHY.super_admin).toBe(5);
  });

  it('has analyst as default role (lowest customer level)', () => {
    expect(DEFAULT_ROLE).toBe('analyst');
  });

  it('has 5 roles in hierarchy', () => {
    expect(Object.keys(ROLE_HIERARCHY)).toHaveLength(5);
  });
});

describe('mapToAppRole', () => {
  describe('Super Admin Mappings', () => {
    it.each([
      ['platform:super_admin'],
      ['platform-super-admin'],
      ['super-admin'],
      ['superadmin'],
      ['super_admin'],
      ['realm-admin'],
      ['platform_admin'],
    ])('maps "%s" to super_admin', (keycloakRole) => {
      expect(mapToAppRole([keycloakRole])).toBe('super_admin');
    });
  });

  describe('Owner Mappings', () => {
    it.each([
      ['owner'],
      ['org-owner'],
      ['organization-owner'],
      ['billing_admin'],
    ])('maps "%s" to owner', (keycloakRole) => {
      expect(mapToAppRole([keycloakRole])).toBe('owner');
    });
  });

  describe('Admin Mappings', () => {
    it.each([
      ['platform:admin'],
      ['tenant-admin'],
      ['admin'],
      ['administrator'],
      ['org_admin'],
      ['org-admin'],
    ])('maps "%s" to admin', (keycloakRole) => {
      expect(mapToAppRole([keycloakRole])).toBe('admin');
    });
  });

  describe('Engineer Mappings', () => {
    it.each([
      ['platform:engineer'],
      ['platform:staff'],
      ['engineer'],
      ['staff'],
      ['developer'],
      ['support'],
      ['operator'],
    ])('maps "%s" to engineer', (keycloakRole) => {
      expect(mapToAppRole([keycloakRole])).toBe('engineer');
    });
  });

  describe('Analyst Mappings', () => {
    it.each([
      ['analyst'],
      ['user'],
      ['customer'],
      ['viewer'],
      ['member'],
    ])('maps "%s" to analyst', (keycloakRole) => {
      expect(mapToAppRole([keycloakRole])).toBe('analyst');
    });
  });

  describe('Priority Selection', () => {
    it('returns highest priority role when multiple roles present', () => {
      expect(mapToAppRole(['user', 'admin'])).toBe('admin');
      expect(mapToAppRole(['analyst', 'engineer', 'admin'])).toBe('admin');
      expect(mapToAppRole(['staff', 'super_admin'])).toBe('super_admin');
    });

    it('returns default role when no roles provided', () => {
      expect(mapToAppRole([])).toBe('analyst');
    });

    it('returns default role when unknown roles provided', () => {
      expect(mapToAppRole(['unknown-role'])).toBe('analyst');
    });

    it('ignores unknown roles and uses known ones', () => {
      expect(mapToAppRole(['unknown', 'admin', 'invalid'])).toBe('admin');
    });

    it('is case insensitive', () => {
      expect(mapToAppRole(['ADMIN'])).toBe('admin');
      expect(mapToAppRole(['Super_Admin'])).toBe('super_admin');
      expect(mapToAppRole(['ENGINEER'])).toBe('engineer');
    });
  });
});

describe('hasMinimumRole', () => {
  describe('Analyst (level 1)', () => {
    it('can access analyst level', () => {
      expect(hasMinimumRole('analyst', 'analyst')).toBe(true);
    });
    it('cannot access engineer level', () => {
      expect(hasMinimumRole('analyst', 'engineer')).toBe(false);
    });
    it('cannot access admin level', () => {
      expect(hasMinimumRole('analyst', 'admin')).toBe(false);
    });
  });

  describe('Engineer (level 2)', () => {
    it('can access analyst level', () => {
      expect(hasMinimumRole('engineer', 'analyst')).toBe(true);
    });
    it('can access engineer level', () => {
      expect(hasMinimumRole('engineer', 'engineer')).toBe(true);
    });
    it('cannot access admin level', () => {
      expect(hasMinimumRole('engineer', 'admin')).toBe(false);
    });
  });

  describe('Admin (level 3)', () => {
    it('can access all levels up to admin', () => {
      expect(hasMinimumRole('admin', 'analyst')).toBe(true);
      expect(hasMinimumRole('admin', 'engineer')).toBe(true);
      expect(hasMinimumRole('admin', 'admin')).toBe(true);
    });
    it('cannot access owner level', () => {
      expect(hasMinimumRole('admin', 'owner')).toBe(false);
    });
  });

  describe('Owner (level 4)', () => {
    it('can access all levels up to owner', () => {
      expect(hasMinimumRole('owner', 'analyst')).toBe(true);
      expect(hasMinimumRole('owner', 'engineer')).toBe(true);
      expect(hasMinimumRole('owner', 'admin')).toBe(true);
      expect(hasMinimumRole('owner', 'owner')).toBe(true);
    });
    it('cannot access super_admin level', () => {
      expect(hasMinimumRole('owner', 'super_admin')).toBe(false);
    });
  });

  describe('Super Admin (level 5)', () => {
    it('can access all levels', () => {
      expect(hasMinimumRole('super_admin', 'analyst')).toBe(true);
      expect(hasMinimumRole('super_admin', 'engineer')).toBe(true);
      expect(hasMinimumRole('super_admin', 'admin')).toBe(true);
      expect(hasMinimumRole('super_admin', 'owner')).toBe(true);
      expect(hasMinimumRole('super_admin', 'super_admin')).toBe(true);
    });
  });
});

describe('Role Check Helpers', () => {
  describe('isSuperAdmin', () => {
    it('returns true only for super_admin', () => {
      expect(isSuperAdmin('super_admin')).toBe(true);
      expect(isSuperAdmin('owner')).toBe(false);
      expect(isSuperAdmin('admin')).toBe(false);
      expect(isSuperAdmin('engineer')).toBe(false);
      expect(isSuperAdmin('analyst')).toBe(false);
    });
  });

  describe('isOwner', () => {
    it('returns true for owner and higher', () => {
      expect(isOwner('super_admin')).toBe(true);
      expect(isOwner('owner')).toBe(true);
      expect(isOwner('admin')).toBe(false);
      expect(isOwner('engineer')).toBe(false);
      expect(isOwner('analyst')).toBe(false);
    });
  });

  describe('isAdmin', () => {
    it('returns true for admin and higher', () => {
      expect(isAdmin('super_admin')).toBe(true);
      expect(isAdmin('owner')).toBe(true);
      expect(isAdmin('admin')).toBe(true);
      expect(isAdmin('engineer')).toBe(false);
      expect(isAdmin('analyst')).toBe(false);
    });
  });

  describe('isEngineer', () => {
    it('returns true for engineer and higher', () => {
      expect(isEngineer('super_admin')).toBe(true);
      expect(isEngineer('owner')).toBe(true);
      expect(isEngineer('admin')).toBe(true);
      expect(isEngineer('engineer')).toBe(true);
      expect(isEngineer('analyst')).toBe(false);
    });
  });

  describe('isAnalyst', () => {
    it('returns true for all roles (analyst is minimum)', () => {
      expect(isAnalyst('super_admin')).toBe(true);
      expect(isAnalyst('owner')).toBe(true);
      expect(isAnalyst('admin')).toBe(true);
      expect(isAnalyst('engineer')).toBe(true);
      expect(isAnalyst('analyst')).toBe(true);
    });
  });
});

describe('JWT Decoding', () => {
  describe('decodeJwtPayload', () => {
    it('decodes valid JWT payload', () => {
      const payload = { sub: 'user-123', email: 'test@example.com' };
      const token = createTestToken(payload);
      const result = decodeJwtPayload(token);
      expect(result).toMatchObject(payload);
    });

    it('returns null for invalid tokens', () => {
      expect(decodeJwtPayload('invalid')).toBeNull();
      expect(decodeJwtPayload('')).toBeNull();
      expect(decodeJwtPayload('only.two')).toBeNull();
    });

    it('returns null for non-base64 payload', () => {
      expect(decodeJwtPayload('a.invalid!@#.c')).toBeNull();
    });
  });

  describe('extractKeycloakRoles', () => {
    it('extracts roles from realm_access', () => {
      const token = createTestToken({
        realm_access: { roles: ['admin', 'user'] },
      });
      const roles = extractKeycloakRoles(token);
      expect(roles).toContain('admin');
      expect(roles).toContain('user');
    });

    it('extracts roles from resource_access with client ID', () => {
      const token = createTestToken({
        resource_access: {
          'admin-app': { roles: ['engineer', 'analyst'] },
        },
      });
      const roles = extractKeycloakRoles(token);
      expect(roles).toContain('engineer');
      expect(roles).toContain('analyst');
    });

    it('extracts roles from direct roles claim', () => {
      const token = createTestToken({
        roles: ['owner', 'admin'],
      });
      const roles = extractKeycloakRoles(token);
      expect(roles).toContain('owner');
      expect(roles).toContain('admin');
    });

    it('extracts roles from groups (removing leading slash)', () => {
      const token = createTestToken({
        groups: ['/admins', '/engineers'],
      });
      const roles = extractKeycloakRoles(token);
      expect(roles).toContain('admins');
      expect(roles).toContain('engineers');
    });

    it('combines roles from all sources (deduplicated)', () => {
      const token = createTestToken({
        realm_access: { roles: ['admin'] },
        resource_access: {
          'admin-app': { roles: ['admin', 'engineer'] },
        },
        roles: ['admin'],
      });
      const roles = extractKeycloakRoles(token);
      expect(roles).toContain('admin');
      expect(roles).toContain('engineer');
      // Deduplication - admin should appear only once
      expect(roles.filter(r => r === 'admin')).toHaveLength(1);
    });

    it('returns empty array for invalid token', () => {
      expect(extractKeycloakRoles('invalid')).toEqual([]);
    });
  });

  describe('getRoleFromToken', () => {
    it('returns highest priority role from token', () => {
      const token = createTestToken({
        realm_access: { roles: ['user', 'admin', 'engineer'] },
      });
      expect(getRoleFromToken(token)).toBe('admin');
    });

    it('returns default role for token without roles', () => {
      const token = createTestToken({ sub: 'user-123' });
      expect(getRoleFromToken(token)).toBe('analyst');
    });

    it('returns default role for invalid token', () => {
      expect(getRoleFromToken('invalid')).toBe('analyst');
    });

    it('correctly maps platform roles', () => {
      const token = createTestToken({
        realm_access: { roles: ['platform:super_admin'] },
      });
      expect(getRoleFromToken(token)).toBe('super_admin');
    });
  });
});

describe('Legacy Role Backwards Compatibility', () => {
  it('maps old "staff" role to "engineer"', () => {
    expect(mapToAppRole(['staff'])).toBe('engineer');
  });

  it('maps old "user" role to "analyst"', () => {
    expect(mapToAppRole(['user'])).toBe('analyst');
  });

  it('maps "viewer" to "analyst"', () => {
    expect(mapToAppRole(['viewer'])).toBe('analyst');
  });

  it('maps "member" to "analyst"', () => {
    expect(mapToAppRole(['member'])).toBe('analyst');
  });

  it('maps "developer" to "engineer"', () => {
    expect(mapToAppRole(['developer'])).toBe('engineer');
  });

  it('maps "org_admin" to "admin"', () => {
    expect(mapToAppRole(['org_admin'])).toBe('admin');
  });
});
