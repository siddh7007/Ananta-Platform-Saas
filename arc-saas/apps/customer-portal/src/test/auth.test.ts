import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for authentication flow and role parsing
 */

// Mock oidc-client-ts
vi.mock('oidc-client-ts', () => ({
  UserManager: vi.fn().mockImplementation(() => ({
    signinRedirect: vi.fn(),
    signinRedirectCallback: vi.fn(),
    signoutRedirect: vi.fn(),
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

// Mock env
vi.mock('@/config/env', () => ({
  env: {
    keycloak: {
      url: 'http://localhost:8180',
      realm: 'cbp',
      clientId: 'cbp-frontend',
    },
    api: {
      platform: 'http://localhost:14000',
      cns: 'http://localhost:27200',
      supabase: 'http://localhost:27810',
    },
  },
}));

describe('Auth Configuration', () => {
  it('should create OIDC config with correct authority', async () => {
    const { oidcConfig } = await import('@/config/auth');

    expect(oidcConfig.authority).toBe('http://localhost:8180/realms/cbp');
    expect(oidcConfig.client_id).toBe('cbp-frontend');
  });

  it('should use code response type (PKCE)', async () => {
    const { oidcConfig } = await import('@/config/auth');

    expect(oidcConfig.response_type).toBe('code');
  });

  it('should request correct scopes including cns-api', async () => {
    const { oidcConfig } = await import('@/config/auth');

    expect(oidcConfig.scope).toContain('openid');
    expect(oidcConfig.scope).toContain('profile');
    expect(oidcConfig.scope).toContain('email');
    expect(oidcConfig.scope).toContain('cns-api');
  });

  it('should enable automatic silent renew', async () => {
    const { oidcConfig } = await import('@/config/auth');

    expect(oidcConfig.automaticSilentRenew).toBe(true);
  });
});

describe('Role Hierarchy', () => {
  it('should define 5-level role hierarchy', async () => {
    const { ROLE_HIERARCHY } = await import('@/config/auth');

    expect(ROLE_HIERARCHY.analyst).toBe(1);
    expect(ROLE_HIERARCHY.engineer).toBe(2);
    expect(ROLE_HIERARCHY.admin).toBe(3);
    expect(ROLE_HIERARCHY.owner).toBe(4);
    expect(ROLE_HIERARCHY.super_admin).toBe(5);
  });

  it('should have exactly 5 roles', async () => {
    const { ROLE_HIERARCHY } = await import('@/config/auth');

    expect(Object.keys(ROLE_HIERARCHY)).toHaveLength(5);
  });
});

describe('Role Mappings', () => {
  it('should map platform:admin to admin role', async () => {
    const { KEYCLOAK_ROLE_MAPPINGS } = await import('@/config/auth');

    expect(KEYCLOAK_ROLE_MAPPINGS['platform:admin']).toBe('admin');
  });

  it('should map platform:engineer to engineer role', async () => {
    const { KEYCLOAK_ROLE_MAPPINGS } = await import('@/config/auth');

    expect(KEYCLOAK_ROLE_MAPPINGS['platform:engineer']).toBe('engineer');
  });

  it('should map super-admin to super_admin role', async () => {
    const { KEYCLOAK_ROLE_MAPPINGS } = await import('@/config/auth');

    expect(KEYCLOAK_ROLE_MAPPINGS['super-admin']).toBe('super_admin');
  });

  it('should map analyst to analyst role', async () => {
    const { KEYCLOAK_ROLE_MAPPINGS } = await import('@/config/auth');

    expect(KEYCLOAK_ROLE_MAPPINGS['analyst']).toBe('analyst');
  });

  it('should map user to analyst (lowest role)', async () => {
    const { KEYCLOAK_ROLE_MAPPINGS } = await import('@/config/auth');

    expect(KEYCLOAK_ROLE_MAPPINGS['user']).toBe('analyst');
  });

  it('should map viewer to analyst', async () => {
    const { KEYCLOAK_ROLE_MAPPINGS } = await import('@/config/auth');

    expect(KEYCLOAK_ROLE_MAPPINGS['viewer']).toBe('analyst');
  });
});

describe('hasMinimumRole function', () => {
  it('should return true when user role equals minimum', async () => {
    const { hasMinimumRole } = await import('@/config/auth');

    expect(hasMinimumRole('admin', 'admin')).toBe(true);
  });

  it('should return true when user role exceeds minimum', async () => {
    const { hasMinimumRole } = await import('@/config/auth');

    expect(hasMinimumRole('super_admin', 'admin')).toBe(true);
    expect(hasMinimumRole('owner', 'engineer')).toBe(true);
    expect(hasMinimumRole('admin', 'analyst')).toBe(true);
  });

  it('should return false when user role is below minimum', async () => {
    const { hasMinimumRole } = await import('@/config/auth');

    expect(hasMinimumRole('analyst', 'admin')).toBe(false);
    expect(hasMinimumRole('engineer', 'owner')).toBe(false);
  });

  it('should return false for invalid role', async () => {
    const { hasMinimumRole } = await import('@/config/auth');

    expect(hasMinimumRole('invalid_role' as any, 'admin')).toBe(false);
  });
});

describe('extractUserFromToken function', () => {
  it('should extract user info from decoded token', async () => {
    const { extractUserFromToken } = await import('@/config/auth');

    const mockProfile = {
      sub: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      preferred_username: 'testuser',
      tenant_id: 'tenant-456',
      realm_access: {
        roles: ['admin'],
      },
    };

    const user = extractUserFromToken(mockProfile);

    expect(user.id).toBe('user-123');
    expect(user.email).toBe('test@example.com');
    expect(user.name).toBe('Test User');
    expect(user.role).toBe('admin');
    expect(user.tenantId).toBe('tenant-456');
  });

  it('should extract highest role from multiple roles', async () => {
    const { extractUserFromToken } = await import('@/config/auth');

    const mockProfile = {
      sub: 'user-123',
      email: 'test@example.com',
      realm_access: {
        roles: ['analyst', 'engineer', 'admin'],
      },
    };

    const user = extractUserFromToken(mockProfile);

    // Should pick admin as highest role
    expect(user.role).toBe('admin');
  });

  it('should fall back to analyst for unknown roles', async () => {
    const { extractUserFromToken } = await import('@/config/auth');

    const mockProfile = {
      sub: 'user-123',
      email: 'test@example.com',
      realm_access: {
        roles: ['some-unknown-role'],
      },
    };

    const user = extractUserFromToken(mockProfile);

    expect(user.role).toBe('analyst');
  });

  it('should check resource_access for client-specific roles', async () => {
    const { extractUserFromToken } = await import('@/config/auth');

    const mockProfile = {
      sub: 'user-123',
      email: 'test@example.com',
      resource_access: {
        'cbp-frontend': {
          roles: ['owner'],
        },
      },
    };

    const user = extractUserFromToken(mockProfile);

    expect(user.role).toBe('owner');
  });

  it('should handle groups as role source', async () => {
    const { extractUserFromToken } = await import('@/config/auth');

    // Groups are stripped of leading / and matched against KEYCLOAK_ROLE_MAPPINGS
    const mockProfile = {
      sub: 'user-123',
      email: 'test@example.com',
      groups: ['/admin', '/engineer'],
    };

    const user = extractUserFromToken(mockProfile);

    // Should map admin group to admin role (highest)
    expect(user.role).toBe('admin');
  });
});

describe('Auth Provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should implement required auth provider methods', async () => {
    const { authProvider } = await import('@/providers/authProvider');

    expect(authProvider.login).toBeDefined();
    expect(authProvider.logout).toBeDefined();
    expect(authProvider.check).toBeDefined();
    expect(authProvider.getIdentity).toBeDefined();
    expect(authProvider.getPermissions).toBeDefined();
  });

  it('should redirect to login when not authenticated', async () => {
    const { authProvider } = await import('@/providers/authProvider');

    // Mock UserManager to return no user
    vi.mocked((await import('oidc-client-ts')).UserManager).mockImplementation(
      () =>
        ({
          getUser: vi.fn().mockResolvedValue(null),
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
        }) as any
    );

    const result = await authProvider.check();

    expect(result.authenticated).toBe(false);
  });
});
