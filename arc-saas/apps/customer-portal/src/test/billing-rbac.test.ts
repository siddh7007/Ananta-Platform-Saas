import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for billing RBAC and navigation access control
 * Verifies role-based visibility and action permissions
 */

// Mock env before imports
vi.mock('@/config/env', () => ({
  env: {
    keycloak: {
      url: 'http://localhost:8180',
      realm: 'cbp',
      clientId: 'cbp-frontend',
    },
  },
}));

// Mock oidc-client-ts
vi.mock('oidc-client-ts', () => ({
  UserManager: vi.fn().mockImplementation(() => ({
    getUser: vi.fn(),
    events: {
      addUserLoaded: vi.fn(),
      addUserUnloaded: vi.fn(),
      addAccessTokenExpired: vi.fn(),
      addAccessTokenExpiring: vi.fn(),
      addSilentRenewError: vi.fn(),
      removeUserLoaded: vi.fn(),
      removeUserUnloaded: vi.fn(),
      removeAccessTokenExpired: vi.fn(),
      removeAccessTokenExpiring: vi.fn(),
      removeSilentRenewError: vi.fn(),
    },
  })),
  WebStorageStateStore: vi.fn(),
}));

describe('Navigation RBAC', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('filterNavByRole', () => {
    it('should show billing to all users (analyst+)', async () => {
      const { filterNavByRole, navigationManifest } = await import('@/config/navigation');

      const analystNav = filterNavByRole(navigationManifest, 'analyst');
      const billingItem = analystNav.find((item) => item.name === 'billing');

      expect(billingItem).toBeDefined();
      expect(billingItem?.label).toBe('Billing');
    });

    it('should show billing children to appropriate roles', async () => {
      const { filterNavByRole, navigationManifest } = await import('@/config/navigation');

      // Analyst should see overview and usage but not invoices
      const analystNav = filterNavByRole(navigationManifest, 'analyst');
      const analystBilling = analystNav.find((item) => item.name === 'billing');
      const analystInvoices = analystBilling?.children?.find((c) => c.name === 'billing-invoices');
      expect(analystInvoices).toBeUndefined();

      // Engineer should see invoices too
      const engineerNav = filterNavByRole(navigationManifest, 'engineer');
      const engineerBilling = engineerNav.find((item) => item.name === 'billing');
      const engineerInvoices = engineerBilling?.children?.find((c) => c.name === 'billing-invoices');
      expect(engineerInvoices).toBeDefined();
    });

    it('should hide team from non-admin users', async () => {
      const { filterNavByRole, navigationManifest } = await import('@/config/navigation');

      const analystNav = filterNavByRole(navigationManifest, 'analyst');
      const engineerNav = filterNavByRole(navigationManifest, 'engineer');
      const adminNav = filterNavByRole(navigationManifest, 'admin');

      expect(analystNav.find((item) => item.name === 'team')).toBeUndefined();
      expect(engineerNav.find((item) => item.name === 'team')).toBeUndefined();
      expect(adminNav.find((item) => item.name === 'team')).toBeDefined();
    });

    it('should show settings to all users', async () => {
      const { filterNavByRole, navigationManifest } = await import('@/config/navigation');

      const analystNav = filterNavByRole(navigationManifest, 'analyst');
      const settingsItem = analystNav.find((item) => item.name === 'settings');

      expect(settingsItem).toBeDefined();
      expect(settingsItem?.children).toBeDefined();
    });
  });

  describe('canAccessRoute', () => {
    it('should allow all users to access /billing', async () => {
      const { canAccessRoute } = await import('@/config/navigation');

      expect(canAccessRoute('analyst', '/billing')).toBe(true);
      expect(canAccessRoute('engineer', '/billing')).toBe(true);
      expect(canAccessRoute('admin', '/billing')).toBe(true);
      expect(canAccessRoute('owner', '/billing')).toBe(true);
    });

    it('should allow all users to access /billing/invoices', async () => {
      const { canAccessRoute } = await import('@/config/navigation');

      expect(canAccessRoute('analyst', '/billing/invoices')).toBe(true);
      expect(canAccessRoute('engineer', '/billing/invoices')).toBe(true);
      expect(canAccessRoute('admin', '/billing/invoices')).toBe(true);
      expect(canAccessRoute('owner', '/billing/invoices')).toBe(true);
    });

    it('should allow all users to access /settings/organization', async () => {
      const { canAccessRoute } = await import('@/config/navigation');

      expect(canAccessRoute('analyst', '/settings/organization')).toBe(true);
      expect(canAccessRoute('engineer', '/settings/organization')).toBe(true);
      expect(canAccessRoute('admin', '/settings/organization')).toBe(true);
    });

    it('should allow all users to access /team', async () => {
      const { canAccessRoute } = await import('@/config/navigation');

      expect(canAccessRoute('analyst', '/team')).toBe(true);
      expect(canAccessRoute('engineer', '/team')).toBe(true);
      expect(canAccessRoute('admin', '/team')).toBe(true);
      expect(canAccessRoute('owner', '/team')).toBe(true);
    });
  });

  describe('getNavigationForRole', () => {
    it('should include admin panel only for super_admin', async () => {
      const { getNavigationForRole } = await import('@/config/navigation');

      const ownerNav = getNavigationForRole('owner');
      const superAdminNav = getNavigationForRole('super_admin');

      expect(ownerNav.find((item) => item.name === 'admin-panel')).toBeUndefined();
      expect(superAdminNav.find((item) => item.name === 'admin-panel')).toBeDefined();
    });
  });
});

describe('Billing Role Checks', () => {
  describe('Action permissions', () => {
    it('should only allow owner to manage billing', async () => {
      const { hasMinimumRole } = await import('@/config/auth');

      // Manage Billing and Change Plan require owner
      expect(hasMinimumRole('analyst', 'owner')).toBe(false);
      expect(hasMinimumRole('engineer', 'owner')).toBe(false);
      expect(hasMinimumRole('admin', 'owner')).toBe(false);
      expect(hasMinimumRole('owner', 'owner')).toBe(true);
      expect(hasMinimumRole('super_admin', 'owner')).toBe(true);
    });

    it('should allow admin+ to edit organization settings', async () => {
      const { hasMinimumRole } = await import('@/config/auth');

      expect(hasMinimumRole('analyst', 'admin')).toBe(false);
      expect(hasMinimumRole('engineer', 'admin')).toBe(false);
      expect(hasMinimumRole('admin', 'admin')).toBe(true);
      expect(hasMinimumRole('owner', 'admin')).toBe(true);
    });

    it('should only allow owner to delete organization', async () => {
      const { hasMinimumRole } = await import('@/config/auth');

      // Delete org is owner-only, stricter than admin
      expect(hasMinimumRole('admin', 'owner')).toBe(false);
      expect(hasMinimumRole('owner', 'owner')).toBe(true);
    });
  });
});

describe('Subscription Type Helpers', () => {
  it('should calculate usage percent correctly', async () => {
    const { calculateUsagePercent } = await import('@/types/subscription');

    expect(calculateUsagePercent(50, 100)).toBe(50);
    expect(calculateUsagePercent(0, 100)).toBe(0);
    expect(calculateUsagePercent(100, 100)).toBe(100);
    // Capped at 100
    expect(calculateUsagePercent(150, 100)).toBe(100);
    expect(calculateUsagePercent(50, 0)).toBe(0); // Avoid division by zero
    expect(calculateUsagePercent(50, -1)).toBe(0); // limit <= 0
  });

  it('should return correct subscription status colors', async () => {
    const { getSubscriptionStatusColor } = await import('@/types/subscription');

    expect(getSubscriptionStatusColor('active')).toContain('green');
    expect(getSubscriptionStatusColor('trialing')).toContain('blue');
    expect(getSubscriptionStatusColor('past_due')).toContain('red');
    expect(getSubscriptionStatusColor('cancelled')).toContain('gray');
  });

  it('should return correct usage bar colors', async () => {
    const { getUsageBarColor } = await import('@/types/subscription');

    expect(getUsageBarColor(50)).toContain('blue'); // < 75%
    expect(getUsageBarColor(80)).toContain('yellow'); // 75-90%
    expect(getUsageBarColor(95)).toContain('red'); // >= 90%
  });

  it('should format currency correctly', async () => {
    const { formatCurrency } = await import('@/types/subscription');

    // Stripe uses cents
    expect(formatCurrency(2900, 'USD')).toBe('$29.00');
    expect(formatCurrency(7900, 'USD')).toBe('$79.00');
  });

  it('should have subscription status config', async () => {
    const { SUBSCRIPTION_STATUS_CONFIG } = await import('@/types/subscription');

    expect(SUBSCRIPTION_STATUS_CONFIG.active.label).toBe('Active');
    expect(SUBSCRIPTION_STATUS_CONFIG.trialing.label).toBe('Trial');
    expect(SUBSCRIPTION_STATUS_CONFIG.past_due.label).toBe('Past Due');
  });
});

describe('Organization Type Helpers', () => {
  it('should format address as single line', async () => {
    const { formatAddress } = await import('@/types/organization');

    const address = {
      line1: '123 Main St',
      city: 'San Francisco',
      state: 'CA',
      postalCode: '94102',
      country: 'USA',
    };

    expect(formatAddress(address)).toBe('123 Main St, San Francisco, CA, 94102, USA');
    expect(formatAddress(undefined)).toBe('');
    expect(formatAddress({})).toBe('');
  });

  it('should validate single-level domain format', async () => {
    const { isValidDomain } = await import('@/types/organization');

    expect(isValidDomain('example.com')).toBe(true);
    expect(isValidDomain('invalid')).toBe(false);
    expect(isValidDomain('invalid.')).toBe(false);
    expect(isValidDomain('.invalid')).toBe(false);
  });

  it('should return correct org status colors', async () => {
    const { getOrgStatusColor } = await import('@/types/organization');

    expect(getOrgStatusColor('active')).toContain('green');
    expect(getOrgStatusColor('suspended')).toContain('red');
    expect(getOrgStatusColor('pending')).toContain('yellow');
    expect(getOrgStatusColor('inactive')).toContain('gray');
  });

  it('should have org status config', async () => {
    const { ORG_STATUS_CONFIG } = await import('@/types/organization');

    expect(ORG_STATUS_CONFIG.active.label).toBe('Active');
    expect(ORG_STATUS_CONFIG.suspended.label).toBe('Suspended');
    expect(ORG_STATUS_CONFIG.pending.label).toBe('Pending');
  });
});
