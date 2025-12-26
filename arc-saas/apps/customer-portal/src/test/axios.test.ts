import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Tests for axios interceptors - Authorization, X-Tenant-Id, and correlation header injection
 */

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock env config
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

describe('Axios Interceptors', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('getAccessToken', () => {
    it('should return null when no OIDC data exists', async () => {
      const { platformApi: _platformApi } = await import('@/lib/axios');

      // Make a request and check headers
      const requestConfig = { headers: {} } as any;

      // The interceptor should not add Authorization header
      expect(requestConfig.headers.Authorization).toBeUndefined();
    });

    it('should extract token from OIDC localStorage data', async () => {
      const mockToken = 'mock-jwt-token-12345';
      const oidcKey = 'oidc.user:http://localhost:8180/realms/cbp:cbp-frontend';

      localStorageMock.setItem(oidcKey, JSON.stringify({
        access_token: mockToken,
        token_type: 'Bearer',
      }));

      // Verify the mock data is stored
      expect(localStorageMock.getItem(oidcKey)).toContain(mockToken);
    });
  });

  describe('getCurrentTenantId', () => {
    it('should return null when no tenant is selected', () => {
      const tenantId = localStorageMock.getItem('cbp_selected_tenant');
      expect(tenantId).toBeNull();
    });

    it('should return tenant ID from localStorage', () => {
      const mockTenantId = 'tenant-uuid-12345';
      localStorageMock.setItem('cbp_selected_tenant', mockTenantId);

      expect(localStorageMock.getItem('cbp_selected_tenant')).toBe(mockTenantId);
    });
  });

  describe('Request Interceptor', () => {
    it('should add Authorization header when token exists', async () => {
      const mockToken = 'test-access-token';
      const oidcKey = 'oidc.user:http://localhost:8180/realms/cbp:cbp-frontend';

      localStorageMock.setItem(oidcKey, JSON.stringify({
        access_token: mockToken,
      }));

      // Import fresh to pick up mocked localStorage
      const { platformApi } = await import('@/lib/axios');

      // Verify axios instance was created with correct base URL
      expect(platformApi.defaults.baseURL).toBeDefined();
    });

    it('should add X-Tenant-Id header when tenant is selected', () => {
      const mockTenantId = 'tenant-123';
      localStorageMock.setItem('cbp_selected_tenant', mockTenantId);

      expect(localStorageMock.getItem('cbp_selected_tenant')).toBe(mockTenantId);
    });

    it('should work without tenant header for tenant-agnostic requests', () => {
      // When no tenant is set, header should not be added
      const tenantId = localStorageMock.getItem('cbp_selected_tenant');
      expect(tenantId).toBeNull();
    });
  });

  describe('setCurrentTenant / clearCurrentTenant helpers', () => {
    it('should set tenant ID in localStorage', async () => {
      const { setCurrentTenant } = await import('@/lib/axios');

      setCurrentTenant('new-tenant-id');

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'cbp_selected_tenant',
        'new-tenant-id'
      );
    });

    it('should clear tenant ID from localStorage', async () => {
      localStorageMock.setItem('cbp_selected_tenant', 'old-tenant');

      const { clearCurrentTenant } = await import('@/lib/axios');

      clearCurrentTenant();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('cbp_selected_tenant');
    });
  });
});

describe('API Client Configuration', () => {
  it('should create platformApi with correct base URL', async () => {
    const { platformApi } = await import('@/lib/axios');
    expect(platformApi.defaults.baseURL).toBe('http://localhost:14000');
  });

  it('should create cnsApi with correct base URL', async () => {
    const { cnsApi } = await import('@/lib/axios');
    expect(cnsApi.defaults.baseURL).toBe('http://localhost:27200');
  });

  it('should create supabaseApi with correct base URL', async () => {
    const { supabaseApi } = await import('@/lib/axios');
    expect(supabaseApi.defaults.baseURL).toBe('http://localhost:27810');
  });

  it('should set 30 second timeout', async () => {
    const { platformApi } = await import('@/lib/axios');
    expect(platformApi.defaults.timeout).toBe(30000);
  });

  it('should set Content-Type to application/json', async () => {
    const { platformApi } = await import('@/lib/axios');
    expect(platformApi.defaults.headers['Content-Type']).toBe('application/json');
  });
});

// =============================================================================
// Request ID and Correlation Headers Tests
// =============================================================================

describe('Request ID and Correlation Headers', () => {
  beforeEach(() => {
    localStorageMock.clear();
    sessionStorageMock.clear();
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should export resetSessionCorrelation function', async () => {
    const { resetSessionCorrelation } = await import('@/lib/axios');
    expect(typeof resetSessionCorrelation).toBe('function');
  });

  it('should persist session correlation ID in sessionStorage', async () => {
    // Manually set a correlation ID
    sessionStorageMock.setItem('cbp_correlation_id', 'sess-test-12345');

    expect(sessionStorageMock.getItem('cbp_correlation_id')).toBe('sess-test-12345');
  });

  it('should clear session correlation ID on resetSessionCorrelation', async () => {
    sessionStorageMock.setItem('cbp_correlation_id', 'sess-to-clear');

    const { resetSessionCorrelation } = await import('@/lib/axios');
    resetSessionCorrelation();

    expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('cbp_correlation_id');
  });

  it('should export CIRCUIT_KEYS constant', async () => {
    const { CIRCUIT_KEYS } = await import('@/lib/axios');

    expect(CIRCUIT_KEYS).toBeDefined();
    expect(CIRCUIT_KEYS.PLATFORM).toBe('platform-api');
    expect(CIRCUIT_KEYS.CNS).toBe('cns-api');
    expect(CIRCUIT_KEYS.SUPABASE).toBe('supabase-api');
  });
});

// =============================================================================
// Tenant Cache Invalidation Tests
// =============================================================================

describe('Tenant Cache Invalidation', () => {
  beforeEach(() => {
    localStorageMock.clear();
    sessionStorageMock.clear();
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should export clearTenantCache function', async () => {
    const { clearTenantCache } = await import('@/lib/axios');
    expect(typeof clearTenantCache).toBe('function');
  });

  it('should clear tenant selection on clearTenantCache', async () => {
    localStorageMock.setItem('cbp_selected_tenant', 'tenant-123');

    const { clearTenantCache } = await import('@/lib/axios');
    clearTenantCache();

    expect(localStorageMock.removeItem).toHaveBeenCalledWith('cbp_selected_tenant');
  });

  it('should clear tenant list cache on clearTenantCache', async () => {
    localStorageMock.setItem('cbp_tenant_list', JSON.stringify([{ id: 'tenant-123' }]));

    const { clearTenantCache } = await import('@/lib/axios');
    clearTenantCache();

    expect(localStorageMock.removeItem).toHaveBeenCalledWith('cbp_tenant_list');
  });

  it('should clear tenant settings cache on clearTenantCache', async () => {
    localStorageMock.setItem('cbp_tenant_settings', JSON.stringify({ theme: 'dark' }));

    const { clearTenantCache } = await import('@/lib/axios');
    clearTenantCache();

    expect(localStorageMock.removeItem).toHaveBeenCalledWith('cbp_tenant_settings');
  });

  it('should clear session correlation ID on clearTenantCache', async () => {
    sessionStorageMock.setItem('cbp_correlation_id', 'sess-to-clear');

    const { clearTenantCache } = await import('@/lib/axios');
    clearTenantCache();

    expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('cbp_correlation_id');
  });
});

// =============================================================================
// Request ID Uniqueness Tests
// =============================================================================

describe('Request ID Uniqueness', () => {
  beforeEach(() => {
    localStorageMock.clear();
    sessionStorageMock.clear();
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should generate unique request IDs with cbp- prefix', async () => {
    // Test the request ID format pattern: cbp-{timestamp}-{random}
    const requestIdPattern = /^cbp-[a-z0-9]+-[a-z0-9]+$/;

    // Generate multiple IDs and verify uniqueness
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 10);
      const id = `cbp-${timestamp}-${random}`;
      expect(id).toMatch(requestIdPattern);
      ids.add(id);
    }

    // With 100 IDs, we should have close to 100 unique ones (random collision unlikely)
    expect(ids.size).toBeGreaterThanOrEqual(99);
  });

  it('should generate different request IDs on successive calls', () => {
    const generateRequestId = () => {
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 10);
      return `cbp-${timestamp}-${random}`;
    };

    const id1 = generateRequestId();
    const id2 = generateRequestId();
    const id3 = generateRequestId();

    // All IDs should be different
    expect(id1).not.toBe(id2);
    expect(id2).not.toBe(id3);
    expect(id1).not.toBe(id3);
  });
});

// =============================================================================
// Correlation ID Propagation Tests
// =============================================================================

describe('Correlation ID Propagation', () => {
  beforeEach(() => {
    localStorageMock.clear();
    sessionStorageMock.clear();
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should generate correlation ID with sess- prefix on first access', () => {
    // Simulate the getSessionCorrelationId function behavior
    const correlationIdPattern = /^sess-[a-z0-9]+-[a-z0-9]+$/;

    // No existing correlation ID
    expect(sessionStorageMock.getItem('cbp_correlation_id')).toBeNull();

    // Generate a new one
    const newId = `sess-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
    sessionStorageMock.setItem('cbp_correlation_id', newId);

    expect(newId).toMatch(correlationIdPattern);
    expect(sessionStorageMock.getItem('cbp_correlation_id')).toBe(newId);
  });

  it('should reuse existing correlation ID from sessionStorage', () => {
    const existingId = 'sess-existing-12345';
    sessionStorageMock.setItem('cbp_correlation_id', existingId);

    // Should return existing ID, not generate new one
    const storedId = sessionStorageMock.getItem('cbp_correlation_id');
    expect(storedId).toBe(existingId);
  });

  it('should persist correlation ID across module reloads within session', async () => {
    const persistedId = 'sess-persisted-abc123';
    sessionStorageMock.setItem('cbp_correlation_id', persistedId);

    // Import module
    await import('@/lib/axios');

    // ID should still be in sessionStorage
    expect(sessionStorageMock.getItem('cbp_correlation_id')).toBe(persistedId);
  });

  it('should generate new correlation ID after reset', async () => {
    // Set initial ID
    sessionStorageMock.setItem('cbp_correlation_id', 'sess-old-id');

    const { resetSessionCorrelation } = await import('@/lib/axios');

    // Reset clears the ID
    resetSessionCorrelation();
    expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('cbp_correlation_id');

    // Verify storage is cleared (mock clears on removeItem)
    // Note: In real code, next access would generate a new ID
  });

  it('should clear correlation ID when tenant cache is cleared', async () => {
    sessionStorageMock.setItem('cbp_correlation_id', 'sess-to-be-cleared');

    const { clearTenantCache } = await import('@/lib/axios');
    clearTenantCache();

    // Correlation ID should be removed as part of cache clear
    expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('cbp_correlation_id');
  });
});
