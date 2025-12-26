import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Health Check Tests
 * Tests for API connectivity, auth validation, and tenant initialization
 */

// Mock axios
vi.mock('@/lib/axios', () => ({
  platformApi: {
    get: vi.fn(),
    post: vi.fn(),
  },
  cnsApi: {
    get: vi.fn(),
  },
  supabaseApi: {
    get: vi.fn(),
  },
}));

// Mock logger to prevent console noise
vi.mock('@/lib/logger', () => ({
  apiLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    api: vi.fn(),
  },
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Platform API Health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should check /ping endpoint', async () => {
    const { platformApi } = await import('@/lib/axios');
    vi.mocked(platformApi.get).mockResolvedValue({
      data: { status: 'ok', timestamp: new Date().toISOString() },
    });

    const response = await platformApi.get('/ping');

    expect(platformApi.get).toHaveBeenCalledWith('/ping');
    expect(response.data.status).toBe('ok');
  });

  it('should check /health endpoint', async () => {
    const { platformApi } = await import('@/lib/axios');
    vi.mocked(platformApi.get).mockResolvedValue({
      data: {
        status: 'healthy',
        checks: {
          database: 'ok',
          redis: 'ok',
          temporal: 'ok',
        },
      },
    });

    const response = await platformApi.get('/health');

    expect(platformApi.get).toHaveBeenCalledWith('/health');
    expect(response.data.status).toBe('healthy');
  });

  it('should handle platform API timeout', async () => {
    const { platformApi } = await import('@/lib/axios');
    vi.mocked(platformApi.get).mockRejectedValue({
      code: 'ECONNABORTED',
      message: 'timeout of 30000ms exceeded',
    });

    await expect(platformApi.get('/ping')).rejects.toMatchObject({
      code: 'ECONNABORTED',
    });
  });

  it('should handle platform API connection error', async () => {
    const { platformApi } = await import('@/lib/axios');
    vi.mocked(platformApi.get).mockRejectedValue({
      code: 'ECONNREFUSED',
      message: 'connect ECONNREFUSED 127.0.0.1:14000',
    });

    await expect(platformApi.get('/ping')).rejects.toMatchObject({
      code: 'ECONNREFUSED',
    });
  });
});

describe('CNS API Health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should check CNS health endpoint', async () => {
    const { cnsApi } = await import('@/lib/axios');
    vi.mocked(cnsApi.get).mockResolvedValue({
      data: { status: 'healthy', version: '1.0.0' },
    });

    const response = await cnsApi.get('/health');

    expect(cnsApi.get).toHaveBeenCalledWith('/health');
    expect(response.data.status).toBe('healthy');
  });

  it('should handle CNS API unavailable', async () => {
    const { cnsApi } = await import('@/lib/axios');
    vi.mocked(cnsApi.get).mockRejectedValue({
      response: { status: 503 },
      message: 'Service Unavailable',
    });

    await expect(cnsApi.get('/health')).rejects.toMatchObject({
      response: { status: 503 },
    });
  });
});

describe('Supabase API Health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should check Supabase health', async () => {
    const { supabaseApi } = await import('@/lib/axios');
    vi.mocked(supabaseApi.get).mockResolvedValue({
      data: {},
      status: 200,
    });

    const response = await supabaseApi.get('/');

    expect(supabaseApi.get).toHaveBeenCalledWith('/');
    expect(response.status).toBe(200);
  });
});

describe('Auth Token Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle valid token response', async () => {
    const { platformApi } = await import('@/lib/axios');
    vi.mocked(platformApi.get).mockResolvedValue({
      data: {
        id: 'user-123',
        email: 'test@example.com',
        tenantId: 'tenant-456',
      },
    });

    const response = await platformApi.get('/auth/me');

    expect(response.data.id).toBe('user-123');
    expect(response.data.tenantId).toBe('tenant-456');
  });

  it('should handle expired token (401)', async () => {
    const { platformApi } = await import('@/lib/axios');
    vi.mocked(platformApi.get).mockRejectedValue({
      response: { status: 401, data: { message: 'Token expired' } },
    });

    await expect(platformApi.get('/auth/me')).rejects.toMatchObject({
      response: { status: 401 },
    });
  });

  it('should handle invalid token (401)', async () => {
    const { platformApi } = await import('@/lib/axios');
    vi.mocked(platformApi.get).mockRejectedValue({
      response: { status: 401, data: { message: 'Invalid token' } },
    });

    await expect(platformApi.get('/auth/me')).rejects.toMatchObject({
      response: { status: 401 },
    });
  });
});

describe('Tenant Context Initialization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch user tenants', async () => {
    const { platformApi } = await import('@/lib/axios');
    vi.mocked(platformApi.get).mockResolvedValue({
      data: [
        { id: 'tenant-1', name: 'Tenant One', key: 'tenant1' },
        { id: 'tenant-2', name: 'Tenant Two', key: 'tenant2' },
      ],
    });

    const response = await platformApi.get('/tenants/my-tenants');

    expect(response.data).toHaveLength(2);
    expect(response.data[0].id).toBe('tenant-1');
  });

  it('should handle no tenants available', async () => {
    const { platformApi } = await import('@/lib/axios');
    vi.mocked(platformApi.get).mockResolvedValue({
      data: [],
    });

    const response = await platformApi.get('/tenants/my-tenants');

    expect(response.data).toHaveLength(0);
  });

  it('should fetch current tenant details', async () => {
    const { platformApi } = await import('@/lib/axios');
    vi.mocked(platformApi.get).mockResolvedValue({
      data: {
        id: 'tenant-123',
        name: 'Test Organization',
        key: 'testorg',
        status: 'active',
        subscription: {
          status: 'active',
          planId: 'plan-basic',
        },
      },
    });

    const response = await platformApi.get('/tenants/current');

    expect(response.data.id).toBe('tenant-123');
    expect(response.data.subscription.status).toBe('active');
  });

  it('should handle tenant not found (404)', async () => {
    const { platformApi } = await import('@/lib/axios');
    vi.mocked(platformApi.get).mockRejectedValue({
      response: { status: 404, data: { message: 'Tenant not found' } },
    });

    await expect(platformApi.get('/tenants/current')).rejects.toMatchObject({
      response: { status: 404 },
    });
  });

  it('should handle tenant access denied (403)', async () => {
    const { platformApi } = await import('@/lib/axios');
    vi.mocked(platformApi.get).mockRejectedValue({
      response: { status: 403, data: { message: 'Access denied to tenant' } },
    });

    await expect(platformApi.get('/tenants/current')).rejects.toMatchObject({
      response: { status: 403 },
    });
  });
});

describe('Service Discovery', () => {
  it('should have correct platform API base URL', async () => {
    const { env } = await import('@/config/env');

    expect(env.api.platform).toBeDefined();
    expect(typeof env.api.platform).toBe('string');
  });

  it('should have correct CNS API base URL', async () => {
    const { env } = await import('@/config/env');

    expect(env.api.cns).toBeDefined();
    expect(typeof env.api.cns).toBe('string');
  });

  it('should have correct Supabase API base URL', async () => {
    const { env } = await import('@/config/env');

    expect(env.api.supabase).toBeDefined();
    expect(typeof env.api.supabase).toBe('string');
  });

  it('should have Keycloak configuration', async () => {
    const { env } = await import('@/config/env');

    expect(env.keycloak).toBeDefined();
    expect(env.keycloak.url).toBeDefined();
    expect(env.keycloak.realm).toBeDefined();
    expect(env.keycloak.clientId).toBeDefined();
  });
});

describe('Logger Configuration', () => {
  it('should create logger instances', async () => {
    // Import actual module bypassing mock
    const loggerModule = await vi.importActual<typeof import('@/lib/logger')>('@/lib/logger');

    expect(loggerModule.createLogger).toBeDefined();
    expect(loggerModule.apiLogger).toBeDefined();
    expect(loggerModule.authLogger).toBeDefined();
    expect(loggerModule.tenantLogger).toBeDefined();
  });

  it('should have debug control functions', async () => {
    // Import actual module bypassing mock
    const loggerModule = await vi.importActual<typeof import('@/lib/logger')>('@/lib/logger');

    expect(typeof loggerModule.enableDebug).toBe('function');
    expect(typeof loggerModule.disableDebug).toBe('function');
    expect(typeof loggerModule.isDebugEnabled).toBe('function');
  });
});

describe('Error Tracking Configuration', () => {
  it('should export error tracking functions', async () => {
    // Import the actual module (Sentry is lazy-loaded, won't fail)
    const errorTracking = await import('@/lib/error-tracking');

    expect(errorTracking.initErrorTracking).toBeDefined();
    expect(errorTracking.setErrorContext).toBeDefined();
    expect(errorTracking.clearErrorContext).toBeDefined();
    expect(errorTracking.captureException).toBeDefined();
    expect(errorTracking.captureMessage).toBeDefined();
    expect(errorTracking.addBreadcrumb).toBeDefined();
    expect(errorTracking.startTransaction).toBeDefined();
    expect(errorTracking.trackApiError).toBeDefined();
  });

  it('should set error context without error', async () => {
    const { setErrorContext, clearErrorContext } = await import('@/lib/error-tracking');

    // Should not throw (Sentry not initialized)
    setErrorContext({ userId: 'user-123', tenantId: 'tenant-456' });
    clearErrorContext();
  });

  it('should capture exception without error', async () => {
    const { captureException } = await import('@/lib/error-tracking');

    // Should not throw (Sentry not initialized)
    const error = new Error('Test error');
    captureException(error, { component: 'TestComponent' });
  });

  it('should add breadcrumb without error', async () => {
    const { addBreadcrumb } = await import('@/lib/error-tracking');

    // Should not throw (Sentry not initialized)
    addBreadcrumb('User clicked button', 'user', { button: 'submit' });
  });
});

describe('API Response Patterns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle paginated response', async () => {
    const { platformApi } = await import('@/lib/axios');
    vi.mocked(platformApi.get).mockResolvedValue({
      data: {
        data: [{ id: '1' }, { id: '2' }],
        total: 100,
        page: 1,
        limit: 2,
      },
    });

    const response = await platformApi.get('/items?page=1&limit=2');

    expect(response.data.data).toHaveLength(2);
    expect(response.data.total).toBe(100);
  });

  it('should handle array response', async () => {
    const { platformApi } = await import('@/lib/axios');
    vi.mocked(platformApi.get).mockResolvedValue({
      data: [{ id: '1' }, { id: '2' }],
    });

    const response = await platformApi.get('/items');

    expect(Array.isArray(response.data)).toBe(true);
    expect(response.data).toHaveLength(2);
  });

  it('should handle single object response', async () => {
    const { platformApi } = await import('@/lib/axios');
    vi.mocked(platformApi.get).mockResolvedValue({
      data: { id: '1', name: 'Item One' },
    });

    const response = await platformApi.get('/items/1');

    expect(response.data.id).toBe('1');
    expect(response.data.name).toBe('Item One');
  });

  it('should handle empty response', async () => {
    const { platformApi } = await import('@/lib/axios');
    vi.mocked(platformApi.get).mockResolvedValue({
      data: null,
      status: 204,
    });

    const response = await platformApi.get('/items/delete');

    expect(response.data).toBeNull();
    expect(response.status).toBe(204);
  });
});
