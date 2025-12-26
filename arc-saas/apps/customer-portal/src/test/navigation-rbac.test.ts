import { describe, it, expect } from 'vitest';

/**
 * Navigation RBAC Tests
 * Comprehensive tests for role-based route access control
 */

describe('Navigation Manifest Structure', () => {
  it('should have all required navigation items', async () => {
    const { navigationManifest } = await import('@/config/navigation');

    const expectedItems = ['dashboard', 'boms', 'components', 'team', 'billing', 'settings'];

    expectedItems.forEach((name) => {
      const item = navigationManifest.find((i) => i.name === name);
      expect(item, `Missing navigation item: ${name}`).toBeDefined();
    });
  });

  it('should have valid minRole for all items', async () => {
    const { navigationManifest } = await import('@/config/navigation');
    const { ROLE_HIERARCHY } = await import('@/config/auth');

    const validRoles = Object.keys(ROLE_HIERARCHY);

    const checkItem = (item: { name: string; minRole: string; children?: unknown[] }) => {
      expect(validRoles).toContain(item.minRole);
      if (item.children) {
        (item.children as { name: string; minRole: string; children?: unknown[] }[]).forEach(checkItem);
      }
    };

    navigationManifest.forEach(checkItem);
  });

  it('should have href for all items', async () => {
    const { navigationManifest } = await import('@/config/navigation');

    const checkItem = (item: { name: string; href: string; children?: unknown[] }) => {
      expect(item.href).toBeDefined();
      expect(item.href.startsWith('/')).toBe(true);
      if (item.children) {
        (item.children as { name: string; href: string; children?: unknown[] }[]).forEach(checkItem);
      }
    };

    navigationManifest.forEach(checkItem);
  });

  it('should have icon for all items', async () => {
    const { navigationManifest } = await import('@/config/navigation');

    const checkItem = (item: { name: string; icon: unknown; children?: unknown[] }) => {
      expect(item.icon).toBeDefined();
      if (item.children) {
        (item.children as { name: string; icon: unknown; children?: unknown[] }[]).forEach(checkItem);
      }
    };

    navigationManifest.forEach(checkItem);
  });
});

describe('Route Access by Role - Analyst (Level 1)', () => {
  const role = 'analyst';

  it('should allow dashboard', async () => {
    const { canAccessRoute } = await import('@/config/navigation');
    expect(canAccessRoute(role, '/')).toBe(true);
  });

  it('should allow BOMs list', async () => {
    const { canAccessRoute } = await import('@/config/navigation');
    expect(canAccessRoute(role, '/boms')).toBe(true);
  });

  it('should allow components', async () => {
    const { canAccessRoute } = await import('@/config/navigation');
    expect(canAccessRoute(role, '/components')).toBe(true);
  });

  it('should allow billing overview', async () => {
    const { canAccessRoute } = await import('@/config/navigation');
    expect(canAccessRoute(role, '/billing')).toBe(true);
  });

  it('should allow settings', async () => {
    const { canAccessRoute } = await import('@/config/navigation');
    expect(canAccessRoute(role, '/settings')).toBe(true);
  });

  it('should allow team', async () => {
    const { canAccessRoute } = await import('@/config/navigation');
    expect(canAccessRoute(role, '/team')).toBe(true);
  });

  it('should DENY team invitations', async () => {
    const { canAccessRoute } = await import('@/config/navigation');
    expect(canAccessRoute(role, '/team/invitations')).toBe(false);
  });

  it('should DENY admin panel', async () => {
    const { canAccessRoute } = await import('@/config/navigation');
    expect(canAccessRoute(role, '/admin')).toBe(false);
  });
});

describe('Route Access by Role - Engineer (Level 2)', () => {
  const role = 'engineer';

  it('should allow dashboard', async () => {
    const { canAccessRoute } = await import('@/config/navigation');
    expect(canAccessRoute(role, '/')).toBe(true);
  });

  it('should allow BOMs including upload', async () => {
    const { canAccessRoute } = await import('@/config/navigation');
    expect(canAccessRoute(role, '/boms')).toBe(true);
    expect(canAccessRoute(role, '/boms/create')).toBe(true);
  });

  it('should allow billing invoices', async () => {
    const { canAccessRoute } = await import('@/config/navigation');
    expect(canAccessRoute(role, '/billing/invoices')).toBe(true);
  });

  it('should allow team', async () => {
    const { canAccessRoute } = await import('@/config/navigation');
    expect(canAccessRoute(role, '/team')).toBe(true);
  });

  it('should DENY admin panel', async () => {
    const { canAccessRoute } = await import('@/config/navigation');
    expect(canAccessRoute(role, '/admin')).toBe(false);
  });
});

describe('Route Access by Role - Admin (Level 3)', () => {
  const role = 'admin';

  it('should allow all base routes', async () => {
    const { canAccessRoute } = await import('@/config/navigation');
    expect(canAccessRoute(role, '/')).toBe(true);
    expect(canAccessRoute(role, '/boms')).toBe(true);
    expect(canAccessRoute(role, '/components')).toBe(true);
    expect(canAccessRoute(role, '/billing')).toBe(true);
    expect(canAccessRoute(role, '/settings')).toBe(true);
  });

  it('should allow team management', async () => {
    const { canAccessRoute } = await import('@/config/navigation');
    expect(canAccessRoute(role, '/team')).toBe(true);
    expect(canAccessRoute(role, '/team/invitations')).toBe(true);
  });

  it('should DENY admin panel', async () => {
    const { canAccessRoute } = await import('@/config/navigation');
    expect(canAccessRoute(role, '/admin')).toBe(false);
  });
});

describe('Route Access by Role - Owner (Level 4)', () => {
  const role = 'owner';

  it('should allow all standard routes', async () => {
    const { canAccessRoute } = await import('@/config/navigation');
    expect(canAccessRoute(role, '/')).toBe(true);
    expect(canAccessRoute(role, '/boms')).toBe(true);
    expect(canAccessRoute(role, '/components')).toBe(true);
    expect(canAccessRoute(role, '/billing')).toBe(true);
    expect(canAccessRoute(role, '/settings')).toBe(true);
    expect(canAccessRoute(role, '/team')).toBe(true);
  });

  it('should DENY admin panel (super_admin only)', async () => {
    const { canAccessRoute } = await import('@/config/navigation');
    expect(canAccessRoute(role, '/admin')).toBe(false);
  });
});

describe('Route Access by Role - Super Admin (Level 5)', () => {
  const role = 'super_admin';

  it('should allow ALL routes', async () => {
    const { canAccessRoute } = await import('@/config/navigation');
    expect(canAccessRoute(role, '/')).toBe(true);
    expect(canAccessRoute(role, '/boms')).toBe(true);
    expect(canAccessRoute(role, '/components')).toBe(true);
    expect(canAccessRoute(role, '/billing')).toBe(true);
    expect(canAccessRoute(role, '/settings')).toBe(true);
    expect(canAccessRoute(role, '/team')).toBe(true);
    expect(canAccessRoute(role, '/admin')).toBe(true);
  });

  it('should allow admin sub-routes', async () => {
    const { canAccessRoute } = await import('@/config/navigation');
    expect(canAccessRoute(role, '/admin/tenants')).toBe(true);
    expect(canAccessRoute(role, '/admin/users')).toBe(true);
  });
});

describe('filterNavByRole', () => {
  it('should include analyst-accessible items in navigation', async () => {
    const { filterNavByRole, navigationManifest } = await import('@/config/navigation');

    const analystNav = filterNavByRole(navigationManifest, 'analyst');
    const teamItem = analystNav.find((i) => i.name === 'team');

    expect(teamItem).toBeDefined();
  });

  it('should include items at or below user role level', async () => {
    const { filterNavByRole, navigationManifest } = await import('@/config/navigation');

    const adminNav = filterNavByRole(navigationManifest, 'admin');
    const teamItem = adminNav.find((i) => i.name === 'team');
    const dashboardItem = adminNav.find((i) => i.name === 'dashboard');

    expect(teamItem).toBeDefined();
    expect(dashboardItem).toBeDefined();
  });

  it('should filter children recursively', async () => {
    const { filterNavByRole, navigationManifest } = await import('@/config/navigation');

    const analystNav = filterNavByRole(navigationManifest, 'analyst');
    const bomsItem = analystNav.find((i) => i.name === 'boms');

    // Analyst should not see BOM upload (engineer+)
    const uploadChild = bomsItem?.children?.find((c) => c.name === 'boms-create');
    expect(uploadChild).toBeUndefined();
  });

  it('should include children at user role level', async () => {
    const { filterNavByRole, navigationManifest } = await import('@/config/navigation');

    const engineerNav = filterNavByRole(navigationManifest, 'engineer');
    const bomsItem = engineerNav.find((i) => i.name === 'boms');

    // Engineer should see BOM upload
    const uploadChild = bomsItem?.children?.find((c) => c.name === 'boms-create');
    expect(uploadChild).toBeDefined();
  });
});

describe('getNavigationForRole', () => {
  it('should return base nav for non-super_admin', async () => {
    const { getNavigationForRole } = await import('@/config/navigation');

    const adminNav = getNavigationForRole('admin');
    const adminPanel = adminNav.find((i) => i.name === 'admin-panel');

    expect(adminPanel).toBeUndefined();
  });

  it('should include admin panel for super_admin', async () => {
    const { getNavigationForRole } = await import('@/config/navigation');

    const superAdminNav = getNavigationForRole('super_admin');
    const adminPanel = superAdminNav.find((i) => i.name === 'admin-panel');

    expect(adminPanel).toBeDefined();
  });

  it('should return correct item count per role', async () => {
    const { getNavigationForRole } = await import('@/config/navigation');

    const analystNav = getNavigationForRole('analyst');
    const adminNav = getNavigationForRole('admin');
    const superAdminNav = getNavigationForRole('super_admin');

    // Admin should have more items than analyst (team added)
    expect(adminNav.length).toBeGreaterThanOrEqual(analystNav.length);
    // Super admin should have admin-panel
    expect(superAdminNav.length).toBeGreaterThan(adminNav.length);
  });
});

describe('getBreadcrumbs', () => {
  it('should always start with Home', async () => {
    const { getBreadcrumbs } = await import('@/config/navigation');

    const breadcrumbs = getBreadcrumbs('/any/path');
    expect(breadcrumbs[0]).toEqual({ label: 'Home', href: '/' });
  });

  it('should build correct path for nested routes', async () => {
    const { getBreadcrumbs } = await import('@/config/navigation');

    const breadcrumbs = getBreadcrumbs('/billing/invoices');

    expect(breadcrumbs).toHaveLength(3);
    expect(breadcrumbs[0]).toEqual({ label: 'Home', href: '/' });
    expect(breadcrumbs[1]).toEqual({ label: 'Billing', href: '/billing' });
    expect(breadcrumbs[2]).toEqual({ label: 'Invoices', href: '/billing/invoices' });
  });

  it('should handle root path', async () => {
    const { getBreadcrumbs } = await import('@/config/navigation');

    const breadcrumbs = getBreadcrumbs('/');
    expect(breadcrumbs).toHaveLength(1);
    expect(breadcrumbs[0]).toEqual({ label: 'Home', href: '/' });
  });

  it('should handle team routes', async () => {
    const { getBreadcrumbs } = await import('@/config/navigation');

    const breadcrumbs = getBreadcrumbs('/team/invitations');

    expect(breadcrumbs).toHaveLength(3);
    expect(breadcrumbs[1]).toEqual({ label: 'Team', href: '/team' });
    expect(breadcrumbs[2]).toEqual({ label: 'Invitations', href: '/team/invitations' });
  });
});

describe('getRefineResources', () => {
  it('should generate resources array for Refine', async () => {
    const { getRefineResources } = await import('@/config/navigation');

    const resources = getRefineResources('admin');

    expect(Array.isArray(resources)).toBe(true);
    expect(resources.length).toBeGreaterThan(0);
  });

  it('should include meta with label and minRole', async () => {
    const { getRefineResources } = await import('@/config/navigation');

    const resources = getRefineResources('admin');
    const dashboardResource = resources.find((r) => r.name === 'dashboard');

    expect(dashboardResource?.meta?.label).toBe('Dashboard');
    expect(dashboardResource?.meta?.minRole).toBe('analyst');
  });

  it('should include dataProviderName in meta', async () => {
    const { getRefineResources } = await import('@/config/navigation');

    const resources = getRefineResources('admin');
    const bomsResource = resources.find((r) => r.name === 'boms');

    expect(bomsResource?.meta?.dataProviderName).toBe('cns');
  });
});

describe('Super Admin Navigation Items', () => {
  it('should define admin-panel with children', async () => {
    const { superAdminNavItems } = await import('@/config/navigation');

    const adminPanel = superAdminNavItems.find((i) => i.name === 'admin-panel');

    expect(adminPanel).toBeDefined();
    expect(adminPanel?.children).toBeDefined();
    expect(adminPanel?.children?.length).toBeGreaterThan(0);
  });

  it('should have correct hrefs for admin routes', async () => {
    const { superAdminNavItems } = await import('@/config/navigation');

    const adminPanel = superAdminNavItems.find((i) => i.name === 'admin-panel');

    expect(adminPanel?.href).toBe('/admin');

    const tenantsChild = adminPanel?.children?.find((c) => c.name === 'admin-tenants');
    expect(tenantsChild?.href).toBe('/admin/tenants');

    const usersChild = adminPanel?.children?.find((c) => c.name === 'admin-users');
    expect(usersChild?.href).toBe('/admin/users');
  });

  it('should require super_admin for all admin items', async () => {
    const { superAdminNavItems } = await import('@/config/navigation');

    const checkItem = (item: { minRole: string; children?: unknown[] }) => {
      expect(item.minRole).toBe('super_admin');
      if (item.children) {
        (item.children as { minRole: string; children?: unknown[] }[]).forEach(checkItem);
      }
    };

    superAdminNavItems.forEach(checkItem);
  });
});

describe('Navigation Data Provider Assignments', () => {
  it('should assign platform provider to tenant-related routes', async () => {
    const { navigationManifest } = await import('@/config/navigation');

    const teamItem = navigationManifest.find((i) => i.name === 'team');
    const billingItem = navigationManifest.find((i) => i.name === 'billing');
    const settingsItem = navigationManifest.find((i) => i.name === 'settings');

    expect(teamItem?.dataProviderName).toBe('platform');
    expect(billingItem?.dataProviderName).toBe('platform');
    expect(settingsItem?.dataProviderName).toBe('platform');
  });

  it('should assign cns provider to BOM routes', async () => {
    const { navigationManifest } = await import('@/config/navigation');

    const bomsItem = navigationManifest.find((i) => i.name === 'boms');
    expect(bomsItem?.dataProviderName).toBe('cns');
  });

  it('should assign supabase provider to component routes', async () => {
    const { navigationManifest } = await import('@/config/navigation');

    const componentsItem = navigationManifest.find((i) => i.name === 'components');
    expect(componentsItem?.dataProviderName).toBe('supabase');
  });
});
