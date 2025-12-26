/**
 * Tests for Permission System
 */

import { describe, it, expect } from 'vitest';
import {
  type AppRole,
  type Permission,
  ROLE_HIERARCHY,
  PERMISSION_ROLES,
  hasMinimumRole,
  hasPermission,
  getPermissionsForRole,
  isSuperAdmin,
  isOwner,
  isAdmin,
  isEngineer,
  isAnalyst,
  getRoleLabel,
  getRoleDescription,
} from './permissions';

describe('Role Hierarchy', () => {
  it('should have correct hierarchy levels', () => {
    expect(ROLE_HIERARCHY.super_admin).toBe(5);
    expect(ROLE_HIERARCHY.owner).toBe(4);
    expect(ROLE_HIERARCHY.admin).toBe(3);
    expect(ROLE_HIERARCHY.engineer).toBe(2);
    expect(ROLE_HIERARCHY.analyst).toBe(1);
  });

  it('should have super_admin as highest level', () => {
    const levels = Object.values(ROLE_HIERARCHY);
    expect(Math.max(...levels)).toBe(ROLE_HIERARCHY.super_admin);
  });

  it('should have analyst as lowest level', () => {
    const levels = Object.values(ROLE_HIERARCHY);
    expect(Math.min(...levels)).toBe(ROLE_HIERARCHY.analyst);
  });
});

describe('hasMinimumRole', () => {
  it('should return true when user role equals required role', () => {
    expect(hasMinimumRole('admin', 'admin')).toBe(true);
    expect(hasMinimumRole('engineer', 'engineer')).toBe(true);
  });

  it('should return true when user role is higher than required role', () => {
    expect(hasMinimumRole('super_admin', 'admin')).toBe(true);
    expect(hasMinimumRole('admin', 'engineer')).toBe(true);
    expect(hasMinimumRole('engineer', 'analyst')).toBe(true);
  });

  it('should return false when user role is lower than required role', () => {
    expect(hasMinimumRole('analyst', 'engineer')).toBe(false);
    expect(hasMinimumRole('engineer', 'admin')).toBe(false);
    expect(hasMinimumRole('admin', 'super_admin')).toBe(false);
  });

  it('should work correctly for all role combinations', () => {
    const roles: AppRole[] = ['analyst', 'engineer', 'admin', 'owner', 'super_admin'];

    roles.forEach((userRole, i) => {
      roles.forEach((requiredRole, j) => {
        const expected = i >= j; // User role index >= required role index
        expect(hasMinimumRole(userRole, requiredRole)).toBe(expected);
      });
    });
  });
});

describe('hasPermission', () => {
  describe('BOM permissions', () => {
    it('should allow analysts to read BOMs', () => {
      expect(hasPermission('analyst', 'bom:read')).toBe(true);
    });

    it('should not allow analysts to create BOMs', () => {
      expect(hasPermission('analyst', 'bom:create')).toBe(false);
    });

    it('should allow engineers to create BOMs', () => {
      expect(hasPermission('engineer', 'bom:create')).toBe(true);
      expect(hasPermission('engineer', 'bom:update')).toBe(true);
    });

    it('should not allow engineers to delete BOMs', () => {
      expect(hasPermission('engineer', 'bom:delete')).toBe(false);
    });

    it('should allow admins to delete BOMs', () => {
      expect(hasPermission('admin', 'bom:delete')).toBe(true);
    });
  });

  describe('Component permissions', () => {
    it('should allow all users to search components', () => {
      expect(hasPermission('analyst', 'component:search')).toBe(true);
      expect(hasPermission('engineer', 'component:search')).toBe(true);
      expect(hasPermission('admin', 'component:search')).toBe(true);
    });

    it('should allow all users to compare components', () => {
      expect(hasPermission('analyst', 'component:compare')).toBe(true);
      expect(hasPermission('engineer', 'component:compare')).toBe(true);
    });
  });

  describe('Team permissions', () => {
    it('should allow all users to view team', () => {
      expect(hasPermission('analyst', 'team:view')).toBe(true);
    });

    it('should not allow engineers to invite team members', () => {
      expect(hasPermission('engineer', 'team:invite')).toBe(false);
    });

    it('should allow admins to invite and manage team', () => {
      expect(hasPermission('admin', 'team:invite')).toBe(true);
      expect(hasPermission('admin', 'team:manage')).toBe(true);
      expect(hasPermission('admin', 'team:remove')).toBe(true);
    });
  });

  describe('Billing permissions', () => {
    it('should not allow admins to access billing', () => {
      expect(hasPermission('admin', 'billing:view')).toBe(false);
      expect(hasPermission('admin', 'billing:manage')).toBe(false);
    });

    it('should allow owners to access billing', () => {
      expect(hasPermission('owner', 'billing:view')).toBe(true);
      expect(hasPermission('owner', 'billing:manage')).toBe(true);
    });

    it('should allow super_admins to access billing', () => {
      expect(hasPermission('super_admin', 'billing:view')).toBe(true);
    });
  });

  describe('Settings permissions', () => {
    it('should allow engineers to view settings', () => {
      expect(hasPermission('engineer', 'settings:view')).toBe(true);
    });

    it('should not allow engineers to manage settings', () => {
      expect(hasPermission('engineer', 'settings:manage')).toBe(false);
    });

    it('should allow admins to manage settings', () => {
      expect(hasPermission('admin', 'settings:view')).toBe(true);
      expect(hasPermission('admin', 'settings:manage')).toBe(true);
      expect(hasPermission('admin', 'settings:api_keys')).toBe(true);
    });
  });

  describe('Admin permissions', () => {
    it('should not allow owners to access admin features', () => {
      expect(hasPermission('owner', 'admin:access')).toBe(false);
      expect(hasPermission('owner', 'admin:audit_logs')).toBe(false);
    });

    it('should allow super_admins to access admin features', () => {
      expect(hasPermission('super_admin', 'admin:access')).toBe(true);
      expect(hasPermission('super_admin', 'admin:audit_logs')).toBe(true);
      expect(hasPermission('super_admin', 'admin:platform_settings')).toBe(true);
    });
  });
});

describe('getPermissionsForRole', () => {
  it('should return all analyst permissions', () => {
    const permissions = getPermissionsForRole('analyst');
    expect(permissions).toContain('bom:read');
    expect(permissions).toContain('component:search');
    expect(permissions).toContain('team:view');
    expect(permissions).not.toContain('bom:create');
    expect(permissions).not.toContain('bom:delete');
  });

  it('should return engineer permissions including analyst permissions', () => {
    const permissions = getPermissionsForRole('engineer');
    // Engineer-specific
    expect(permissions).toContain('bom:create');
    expect(permissions).toContain('bom:update');
    expect(permissions).toContain('settings:view');
    // Inherited from analyst
    expect(permissions).toContain('bom:read');
    expect(permissions).toContain('component:search');
    // Not allowed
    expect(permissions).not.toContain('bom:delete');
    expect(permissions).not.toContain('team:invite');
  });

  it('should return admin permissions including lower role permissions', () => {
    const permissions = getPermissionsForRole('admin');
    // Admin-specific
    expect(permissions).toContain('bom:delete');
    expect(permissions).toContain('team:invite');
    expect(permissions).toContain('team:manage');
    expect(permissions).toContain('settings:manage');
    // Inherited
    expect(permissions).toContain('bom:create');
    expect(permissions).toContain('bom:read');
    // Not allowed
    expect(permissions).not.toContain('billing:view');
    expect(permissions).not.toContain('admin:access');
  });

  it('should return owner permissions', () => {
    const permissions = getPermissionsForRole('owner');
    expect(permissions).toContain('billing:view');
    expect(permissions).toContain('billing:manage');
    expect(permissions).toContain('subscription:view');
    expect(permissions).toContain('subscription:manage');
    expect(permissions).not.toContain('admin:access');
  });

  it('should return all permissions for super_admin', () => {
    const permissions = getPermissionsForRole('super_admin');
    const allPermissions = Object.keys(PERMISSION_ROLES) as Permission[];
    expect(permissions.length).toBe(allPermissions.length);
    allPermissions.forEach((permission) => {
      expect(permissions).toContain(permission);
    });
  });
});

describe('Convenience role check functions', () => {
  describe('isSuperAdmin', () => {
    it('should return true only for super_admin', () => {
      expect(isSuperAdmin('super_admin')).toBe(true);
      expect(isSuperAdmin('owner')).toBe(false);
      expect(isSuperAdmin('admin')).toBe(false);
    });
  });

  describe('isOwner', () => {
    it('should return true for owner and super_admin', () => {
      expect(isOwner('owner')).toBe(true);
      expect(isOwner('super_admin')).toBe(true);
      expect(isOwner('admin')).toBe(false);
    });
  });

  describe('isAdmin', () => {
    it('should return true for admin and above', () => {
      expect(isAdmin('admin')).toBe(true);
      expect(isAdmin('owner')).toBe(true);
      expect(isAdmin('super_admin')).toBe(true);
      expect(isAdmin('engineer')).toBe(false);
    });
  });

  describe('isEngineer', () => {
    it('should return true for engineer and above', () => {
      expect(isEngineer('engineer')).toBe(true);
      expect(isEngineer('admin')).toBe(true);
      expect(isEngineer('owner')).toBe(true);
      expect(isEngineer('analyst')).toBe(false);
    });
  });

  describe('isAnalyst', () => {
    it('should return true for all roles', () => {
      expect(isAnalyst('analyst')).toBe(true);
      expect(isAnalyst('engineer')).toBe(true);
      expect(isAnalyst('admin')).toBe(true);
      expect(isAnalyst('owner')).toBe(true);
      expect(isAnalyst('super_admin')).toBe(true);
    });
  });
});

describe('Role labels and descriptions', () => {
  it('should return correct role labels', () => {
    expect(getRoleLabel('super_admin')).toBe('Super Admin');
    expect(getRoleLabel('owner')).toBe('Owner');
    expect(getRoleLabel('admin')).toBe('Admin');
    expect(getRoleLabel('engineer')).toBe('Engineer');
    expect(getRoleLabel('analyst')).toBe('Analyst');
  });

  it('should return role descriptions', () => {
    const descriptions = [
      'super_admin',
      'owner',
      'admin',
      'engineer',
      'analyst',
    ] as AppRole[];

    descriptions.forEach((role) => {
      const description = getRoleDescription(role);
      expect(description).toBeTruthy();
      expect(typeof description).toBe('string');
      expect(description.length).toBeGreaterThan(10);
    });
  });
});

describe('Permission-Role mapping completeness', () => {
  it('should have a valid role for every permission', () => {
    const roles: AppRole[] = ['analyst', 'engineer', 'admin', 'owner', 'super_admin'];
    Object.entries(PERMISSION_ROLES).forEach(([permission, requiredRole]) => {
      expect(roles).toContain(requiredRole);
    });
  });

  it('should have all BOM permissions defined', () => {
    const bomPermissions = [
      'bom:create',
      'bom:read',
      'bom:update',
      'bom:delete',
      'bom:export',
    ] as Permission[];

    bomPermissions.forEach((permission) => {
      expect(PERMISSION_ROLES[permission]).toBeDefined();
    });
  });

  it('should have all component permissions defined', () => {
    const componentPermissions = [
      'component:search',
      'component:compare',
      'component:export',
    ] as Permission[];

    componentPermissions.forEach((permission) => {
      expect(PERMISSION_ROLES[permission]).toBeDefined();
    });
  });

  it('should have all team permissions defined', () => {
    const teamPermissions = ['team:view', 'team:invite', 'team:manage'] as Permission[];

    teamPermissions.forEach((permission) => {
      expect(PERMISSION_ROLES[permission]).toBeDefined();
    });
  });
});
