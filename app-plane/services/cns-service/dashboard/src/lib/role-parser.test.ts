/**
 * Role Parser Tests
 *
 * Unit tests for role extraction and hierarchy utilities
 */

import {
  AppRole,
  parseRolesFromToken,
  getHighestRole,
  hasMinimumRole,
  isSuperAdmin,
  isOwner,
  isAdmin,
  isEngineer,
  isAnalyst,
  getRoleDisplayName,
  getRoleLevel,
} from './role-parser';

describe('parseRolesFromToken', () => {
  it('should extract roles from realm_access.roles', () => {
    const token = {
      realm_access: {
        roles: ['admin', 'user'],
      },
    };

    const roles = parseRolesFromToken(token);
    expect(roles).toContain('admin');
    expect(roles).toContain('analyst');
  });

  it('should extract roles from resource_access', () => {
    const token = {
      resource_access: {
        'cns-dashboard': {
          roles: ['engineer', 'staff'],
        },
      },
    };

    const roles = parseRolesFromToken(token);
    expect(roles).toContain('engineer');
  });

  it('should extract roles from groups (strip leading /)', () => {
    const token = {
      groups: ['/admin', '/users'],
    };

    const roles = parseRolesFromToken(token);
    expect(roles).toContain('admin');
  });

  it('should handle multiple role sources', () => {
    const token = {
      realm_access: {
        roles: ['user'],
      },
      resource_access: {
        'cns-dashboard': {
          roles: ['engineer'],
        },
      },
      groups: ['/admin'],
    };

    const roles = parseRolesFromToken(token);
    expect(roles.length).toBeGreaterThan(0);
  });

  it('should return empty array for null/undefined token', () => {
    expect(parseRolesFromToken(null)).toEqual([]);
    expect(parseRolesFromToken(undefined)).toEqual([]);
    expect(parseRolesFromToken({})).toEqual([]);
  });

  it('should map super_admin variants', () => {
    const token = {
      realm_access: {
        roles: ['platform:super_admin', 'realm-admin', 'superadmin'],
      },
    };

    const roles = parseRolesFromToken(token);
    expect(roles).toContain('super_admin');
  });

  it('should map owner variants', () => {
    const token = {
      realm_access: {
        roles: ['owner', 'org-owner', 'billing_admin'],
      },
    };

    const roles = parseRolesFromToken(token);
    expect(roles).toContain('owner');
  });

  it('should map legacy staff to engineer', () => {
    const token = {
      realm_access: {
        roles: ['staff', 'developer', 'support'],
      },
    };

    const roles = parseRolesFromToken(token);
    expect(roles).toContain('engineer');
  });

  it('should map legacy user to analyst', () => {
    const token = {
      realm_access: {
        roles: ['user', 'viewer', 'customer'],
      },
    };

    const roles = parseRolesFromToken(token);
    expect(roles).toContain('analyst');
  });
});

describe('getHighestRole', () => {
  it('should return highest role from array', () => {
    const roles: AppRole[] = ['analyst', 'engineer', 'admin'];
    expect(getHighestRole(roles)).toBe('admin');
  });

  it('should return super_admin when present', () => {
    const roles: AppRole[] = ['analyst', 'super_admin', 'admin'];
    expect(getHighestRole(roles)).toBe('super_admin');
  });

  it('should return analyst for empty array', () => {
    expect(getHighestRole([])).toBe('analyst');
  });

  it('should handle single role', () => {
    expect(getHighestRole(['engineer'])).toBe('engineer');
  });
});

describe('hasMinimumRole', () => {
  it('should allow higher role access', () => {
    expect(hasMinimumRole('admin', 'engineer')).toBe(true);
    expect(hasMinimumRole('super_admin', 'admin')).toBe(true);
    expect(hasMinimumRole('owner', 'analyst')).toBe(true);
  });

  it('should allow exact role access', () => {
    expect(hasMinimumRole('admin', 'admin')).toBe(true);
    expect(hasMinimumRole('engineer', 'engineer')).toBe(true);
  });

  it('should deny lower role access', () => {
    expect(hasMinimumRole('analyst', 'engineer')).toBe(false);
    expect(hasMinimumRole('engineer', 'admin')).toBe(false);
    expect(hasMinimumRole('admin', 'owner')).toBe(false);
  });
});

describe('role check functions', () => {
  it('isSuperAdmin should only match super_admin', () => {
    expect(isSuperAdmin('super_admin')).toBe(true);
    expect(isSuperAdmin('owner')).toBe(false);
    expect(isSuperAdmin('admin')).toBe(false);
  });

  it('isOwner should match owner and super_admin', () => {
    expect(isOwner('super_admin')).toBe(true);
    expect(isOwner('owner')).toBe(true);
    expect(isOwner('admin')).toBe(false);
  });

  it('isAdmin should match admin and above', () => {
    expect(isAdmin('super_admin')).toBe(true);
    expect(isAdmin('owner')).toBe(true);
    expect(isAdmin('admin')).toBe(true);
    expect(isAdmin('engineer')).toBe(false);
  });

  it('isEngineer should match engineer and above', () => {
    expect(isEngineer('admin')).toBe(true);
    expect(isEngineer('engineer')).toBe(true);
    expect(isEngineer('analyst')).toBe(false);
  });

  it('isAnalyst should match all roles', () => {
    expect(isAnalyst('super_admin')).toBe(true);
    expect(isAnalyst('admin')).toBe(true);
    expect(isAnalyst('engineer')).toBe(true);
    expect(isAnalyst('analyst')).toBe(true);
  });
});

describe('utility functions', () => {
  it('getRoleDisplayName should return proper names', () => {
    expect(getRoleDisplayName('super_admin')).toBe('Super Admin');
    expect(getRoleDisplayName('owner')).toBe('Owner');
    expect(getRoleDisplayName('admin')).toBe('Admin');
    expect(getRoleDisplayName('engineer')).toBe('Engineer');
    expect(getRoleDisplayName('analyst')).toBe('Analyst');
  });

  it('getRoleLevel should return correct levels', () => {
    expect(getRoleLevel('super_admin')).toBe(5);
    expect(getRoleLevel('owner')).toBe(4);
    expect(getRoleLevel('admin')).toBe(3);
    expect(getRoleLevel('engineer')).toBe(2);
    expect(getRoleLevel('analyst')).toBe(1);
  });
});
