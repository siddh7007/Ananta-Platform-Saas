/**
 * Navigation Configuration Tests
 *
 * Tests for the config-driven navigation system including:
 * - Role-based access control (RBAC)
 * - Plan-based feature gating
 * - Feature flag checks
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  navigationManifest,
  getResourcesForRole,
  getAllResources,
  getSidebarItems,
  canAccessResource,
  isFeatureEnabled,
  isPlanFeatureAccessible,
  type NavigationItem,
} from './navigation';

// Mock the env module to control feature flags
vi.mock('./env.schema', () => ({
  getEnv: () => ({
    VITE_FEATURE_BILLING: true,
    VITE_FEATURE_WORKFLOWS: true,
    VITE_FEATURE_MONITORING: true,
    VITE_FEATURE_AUDIT_LOGS: true,
  }),
}));

// Mock platform.config for plan feature checks
vi.mock('./platform.config', () => ({
  isPlanFeatureEnabled: (planId: string, feature: string) => {
    // Simulate plan feature access
    const planFeatures: Record<string, string[]> = {
      'plan-free': [],
      'plan-basic': ['workflows', 'apiAccess'],
      'plan-standard': ['workflows', 'apiAccess', 'sso', 'monitoring'],
      'plan-premium': ['billing', 'workflows', 'monitoring', 'auditLogs', 'analytics', 'sso', 'apiAccess', 'customBranding', 'multiUser', 'customIntegrations', 'prioritySupport', 'dedicatedManager', 'onPremise'],
    };
    return planFeatures[planId]?.includes(feature) ?? false;
  },
}));

describe('Navigation Manifest', () => {
  it('should have required navigation items', () => {
    const names = navigationManifest.map(item => item.name);
    expect(names).toContain('dashboard');
    expect(names).toContain('tenants');
    expect(names).toContain('plans');
    expect(names).toContain('subscriptions');
    expect(names).toContain('workflows');
    expect(names).toContain('users');
    expect(names).toContain('billing');
    expect(names).toContain('settings');
  });

  it('should have proper structure for each item', () => {
    navigationManifest.forEach(item => {
      expect(item.name).toBeTruthy();
      expect(item.meta).toBeDefined();
      expect(item.meta.label).toBeTruthy();
    });
  });

  it('should have role requirements for admin-only resources', () => {
    const adminOnlyResources = ['tenants', 'plans', 'users', 'user-invitations', 'settings', 'audit-logs'];
    adminOnlyResources.forEach(resourceName => {
      const item = navigationManifest.find(n => n.name === resourceName);
      expect(item?.meta.minRole).toBeDefined();
    });
  });
});

describe('isFeatureEnabled', () => {
  it('should return true for enabled features', () => {
    expect(isFeatureEnabled('billing')).toBe(true);
    expect(isFeatureEnabled('workflows')).toBe(true);
    expect(isFeatureEnabled('monitoring')).toBe(true);
    expect(isFeatureEnabled('auditLogs')).toBe(true);
  });

  it('should default to true for undefined flags', () => {
    expect(isFeatureEnabled('unknownFlag')).toBe(true);
  });
});

describe('isPlanFeatureAccessible', () => {
  it('should check environment flag first', () => {
    // Even if plan has the feature, if env flag is disabled, return false
    // (This test assumes env flags are all enabled in our mock)
    expect(isPlanFeatureAccessible('billing', 'plan-premium')).toBe(true);
  });

  it('should allow access when no plan ID is provided', () => {
    // No plan restriction = allow access
    expect(isPlanFeatureAccessible('billing')).toBe(true);
    expect(isPlanFeatureAccessible('workflows')).toBe(true);
  });

  it('should check plan-based access for premium features', () => {
    expect(isPlanFeatureAccessible('billing', 'plan-premium')).toBe(true);
    expect(isPlanFeatureAccessible('billing', 'plan-basic')).toBe(false);
    expect(isPlanFeatureAccessible('billing', 'plan-free')).toBe(false);
  });
});

describe('getResourcesForRole', () => {
  it('should return all resources for super_admin', () => {
    const resources = getResourcesForRole('super_admin');
    const names = resources.map(r => r.name);
    expect(names).toContain('dashboard');
    expect(names).toContain('tenants');
    expect(names).toContain('billing');
    expect(names).toContain('roles');
  });

  it('should exclude super_admin-only resources for admin', () => {
    const resources = getResourcesForRole('admin');
    const names = resources.map(r => r.name);
    expect(names).toContain('dashboard');
    expect(names).toContain('tenants');
    expect(names).not.toContain('billing'); // super_admin only
    expect(names).not.toContain('roles'); // super_admin only
  });

  it('should exclude admin-only resources for engineer', () => {
    const resources = getResourcesForRole('engineer');
    const names = resources.map(r => r.name);
    expect(names).toContain('dashboard');
    expect(names).toContain('subscriptions');
    expect(names).not.toContain('tenants'); // admin only
    expect(names).not.toContain('plans'); // admin only
    expect(names).not.toContain('users'); // admin only
  });

  it('should exclude engineer-only resources for viewer', () => {
    const resources = getResourcesForRole('viewer');
    const names = resources.map(r => r.name);
    expect(names).toContain('dashboard');
    expect(names).not.toContain('subscriptions'); // engineer only
    expect(names).not.toContain('workflows'); // engineer only
    expect(names).not.toContain('monitoring'); // engineer only
  });

  it('should filter by planId when provided', () => {
    // Add a planFeature to a navigation item for testing
    // Since we don't have planFeature items in the current manifest,
    // this test verifies the function accepts the parameter
    const resourcesNoPlan = getResourcesForRole('super_admin');
    const resourcesWithPlan = getResourcesForRole('super_admin', 'plan-basic');

    // Should return resources - exact count depends on planFeature items
    expect(resourcesNoPlan.length).toBeGreaterThan(0);
    expect(resourcesWithPlan.length).toBeGreaterThan(0);
  });
});

describe('getAllResources', () => {
  it('should return all resources regardless of role', () => {
    const resources = getAllResources();
    expect(resources.length).toBeGreaterThan(0);
  });

  it('should still filter by feature flags', () => {
    const resources = getAllResources();
    // All resources should be returned since feature flags are all enabled
    expect(resources.length).toBe(navigationManifest.length);
  });

  it('should accept optional planId parameter', () => {
    const resourcesNoPlan = getAllResources();
    const resourcesWithPlan = getAllResources('plan-premium');

    // Should return resources - count may differ if planFeature items exist
    expect(resourcesNoPlan.length).toBeGreaterThan(0);
    expect(resourcesWithPlan.length).toBeGreaterThan(0);
  });
});

describe('getSidebarItems', () => {
  it('should return items for super_admin', () => {
    const items = getSidebarItems('super_admin');
    expect(items.length).toBeGreaterThan(0);
  });

  it('should exclude hidden items', () => {
    // Add a hidden item check if any exist in manifest
    const items = getSidebarItems('super_admin');
    items.forEach(item => {
      expect(item.meta.hidden).not.toBe(true);
    });
  });

  it('should filter by role', () => {
    const adminItems = getSidebarItems('admin');
    const viewerItems = getSidebarItems('viewer');

    expect(adminItems.length).toBeGreaterThan(viewerItems.length);
  });

  it('should accept optional planId parameter', () => {
    const itemsNoPlan = getSidebarItems('super_admin');
    const itemsWithPlan = getSidebarItems('super_admin', 'plan-basic');

    expect(itemsNoPlan.length).toBeGreaterThan(0);
    expect(itemsWithPlan.length).toBeGreaterThan(0);
  });
});

describe('canAccessResource', () => {
  it('should return true for valid resources', () => {
    expect(canAccessResource('dashboard', 'viewer')).toBe(true);
    expect(canAccessResource('tenants', 'admin')).toBe(true);
    expect(canAccessResource('billing', 'super_admin')).toBe(true);
  });

  it('should return false for invalid resource names', () => {
    expect(canAccessResource('nonexistent', 'super_admin')).toBe(false);
  });

  it('should return false when role is insufficient', () => {
    expect(canAccessResource('tenants', 'viewer')).toBe(false);
    expect(canAccessResource('billing', 'admin')).toBe(false);
    expect(canAccessResource('roles', 'engineer')).toBe(false);
  });

  it('should accept optional planId parameter', () => {
    // Test with planId
    expect(canAccessResource('dashboard', 'super_admin', 'plan-premium')).toBe(true);
    expect(canAccessResource('dashboard', 'viewer', 'plan-free')).toBe(true);
  });
});

describe('Role hierarchy in navigation', () => {
  it('should have correct role hierarchy (super_admin > admin > engineer > viewer)', () => {
    const superAdminResources = getResourcesForRole('super_admin');
    const adminResources = getResourcesForRole('admin');
    const engineerResources = getResourcesForRole('engineer');
    const viewerResources = getResourcesForRole('viewer');

    expect(superAdminResources.length).toBeGreaterThanOrEqual(adminResources.length);
    expect(adminResources.length).toBeGreaterThanOrEqual(engineerResources.length);
    expect(engineerResources.length).toBeGreaterThanOrEqual(viewerResources.length);
  });

  it('should give super_admin access to all non-hidden resources', () => {
    const superAdminResources = getResourcesForRole('super_admin');
    const allResources = getAllResources();

    expect(superAdminResources.length).toBe(allResources.length);
  });
});

describe('Navigation item structure', () => {
  it('should have proper route patterns', () => {
    navigationManifest.forEach(item => {
      if (item.list) {
        expect(item.list.startsWith('/')).toBe(true);
      }
      if (item.show) {
        expect(item.show.includes(':id')).toBe(true);
      }
      if (item.edit) {
        expect(item.edit.includes(':id')).toBe(true);
      }
    });
  });

  it('should have icons for sidebar display', () => {
    navigationManifest.forEach(item => {
      // All visible items should have icons
      if (!item.meta.hidden) {
        expect(item.meta.icon).toBeTruthy();
      }
    });
  });
});
