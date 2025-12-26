import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { apiClient } from '../apiClient';

// Mock Keycloak provider
vi.mock('@/admin/providers/keycloak', () => ({
  getToken: vi.fn().mockResolvedValue('mock-token-123'),
}));

// Mock TenantContext
vi.mock('@/admin/contexts/TenantContext', () => ({
  getActiveTenantId: vi.fn().mockReturnValue('tenant-456'),
}));

// Mock logger
vi.mock('../logger', () => ({
  logApiRequest: vi.fn(),
  logApiResponse: vi.fn(),
  logError: vi.fn(),
  logInfo: vi.fn(),
}));

// Mock error mapping
vi.mock('../errorMapping', () => ({
  createEnhancedError: vi.fn((error) => {
    const enhanced = new Error('Enhanced error') as any;
    enhanced.code = 'TEST_ERROR';
    enhanced.friendlyMessage = 'Test friendly message';
    enhanced.status = error.response?.status;
    return enhanced;
  }),
}));

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Request Interceptor', () => {
    it('should inject Authorization header with token', async () => {
      const { getToken } = await import('@/admin/providers/keycloak');

      // Make a request
      try {
        await apiClient.get('/test');
      } catch (error) {
        // Expected to fail since we're mocking
      }

      // Check that getToken was called
      expect(getToken).toHaveBeenCalled();
    });

    it('should inject X-Tenant-Id header', async () => {
      const { getActiveTenantId } = await import('@/admin/contexts/TenantContext');

      // Make a request
      try {
        await apiClient.get('/test');
      } catch (error) {
        // Expected to fail since we're mocking
      }

      // Check that getActiveTenantId was called
      expect(getActiveTenantId).toHaveBeenCalled();
    });

    it('should add X-Request-Id correlation header', async () => {
      let capturedConfig: InternalAxiosRequestConfig | null = null;

      // Intercept the request to capture config
      const interceptor = apiClient.interceptors.request.use(
        (config) => {
          capturedConfig = config;
          return config;
        },
      );

      try {
        await apiClient.get('/test');
      } catch (error) {
        // Expected to fail
      }

      // Remove the interceptor
      apiClient.interceptors.request.eject(interceptor);

      // Check that X-Request-Id was added
      expect(capturedConfig?.headers?.['X-Request-Id']).toMatch(/^req_\d+_[a-z0-9]+$/);
    });

    it('should add timing metadata to request', async () => {
      let capturedConfig: any = null;

      // Intercept the request to capture config
      const interceptor = apiClient.interceptors.request.use(
        (config: any) => {
          capturedConfig = config;
          return config;
        },
      );

      try {
        await apiClient.get('/test');
      } catch (error) {
        // Expected to fail
      }

      // Remove the interceptor
      apiClient.interceptors.request.eject(interceptor);

      // Check that metadata with startTime was added
      expect(capturedConfig?.metadata?.startTime).toBeTypeOf('number');
      expect(capturedConfig?.metadata?.startTime).toBeLessThanOrEqual(Date.now());
    });

    it('should log API request', async () => {
      const { logApiRequest } = await import('../logger');

      try {
        await apiClient.get('/test');
      } catch (error) {
        // Expected to fail
      }

      // Check that logApiRequest was called
      expect(logApiRequest).toHaveBeenCalledWith(
        'GET',
        '/test',
        expect.objectContaining({
          tenantId: 'tenant-456',
          hasAuth: true,
        }),
      );
    });

    it('should log error when no token available', async () => {
      const { getToken } = await import('@/admin/providers/keycloak');
      const { logError } = await import('../logger');

      // Mock getToken to return null
      (getToken as any).mockResolvedValueOnce(null);

      try {
        await apiClient.get('/test');
      } catch (error) {
        // Expected to fail
      }

      // Check that logError was called
      expect(logError).toHaveBeenCalledWith(
        'No authentication token available',
        expect.objectContaining({
          module: 'ApiClient',
          action: 'injectAuthHeaders',
        }),
      );
    });
  });

  describe('Response Interceptor', () => {
    it('should log successful API response with duration', async () => {
      const { logApiResponse } = await import('../logger');

      // Mock successful response
      vi.spyOn(axios, 'get').mockResolvedValueOnce({
        status: 200,
        data: { result: 'success' },
        config: {
          url: '/test',
          method: 'get',
          headers: { 'X-Request-Id': 'req-123' },
          metadata: { startTime: Date.now() - 100 },
        } as any,
      });

      await apiClient.get('/test');

      // Check that logApiResponse was called with duration
      expect(logApiResponse).toHaveBeenCalledWith(
        'get',
        '/test',
        200,
        expect.any(Number),
        expect.objectContaining({
          requestId: 'req-123',
          responseSize: expect.any(Number),
        }),
      );
    });

    it('should create enhanced error on failure', async () => {
      const { createEnhancedError } = await import('../errorMapping');

      // Mock failed response
      const mockError = {
        response: {
          status: 404,
          data: { error: { message: 'Not found' } },
        },
        config: {
          url: '/test',
          method: 'get',
          headers: { 'X-Request-Id': 'req-789' },
        },
      };

      vi.spyOn(axios, 'get').mockRejectedValueOnce(mockError);

      try {
        await apiClient.get('/test');
      } catch (error) {
        // Expected to throw enhanced error
        expect(createEnhancedError).toHaveBeenCalledWith(
          mockError,
          expect.objectContaining({
            module: 'ApiClient',
            action: 'response',
            requestId: 'req-789',
          }),
        );
      }
    });

    it('should log API error response', async () => {
      const { logApiResponse } = await import('../logger');

      // Mock failed response
      const mockError = {
        response: {
          status: 500,
          data: { error: { message: 'Server error' } },
        },
        config: {
          url: '/test',
          method: 'post',
          headers: { 'X-Request-Id': 'req-999' },
          metadata: { startTime: Date.now() - 200 },
        },
      };

      vi.spyOn(axios, 'post').mockRejectedValueOnce(mockError);

      try {
        await apiClient.post('/test', {});
      } catch (error) {
        // Expected to throw
      }

      // Check that logApiResponse was called with error code
      expect(logApiResponse).toHaveBeenCalledWith(
        'post',
        '/test',
        500,
        expect.any(Number),
        expect.objectContaining({
          requestId: 'req-999',
          errorCode: 'TEST_ERROR',
        }),
      );
    });
  });

  describe('buildResourcePath', () => {
    it('should prepend API prefix to resource path', () => {
      const { buildResourcePath } = require('../apiClient');

      expect(buildResourcePath('/tenants')).toBe('/cns/tenants');
      expect(buildResourcePath('tenants')).toBe('/cns/tenants');
    });

    it('should handle paths that already start with slash', () => {
      const { buildResourcePath } = require('../apiClient');

      expect(buildResourcePath('/api/tenants')).toBe('/cns/api/tenants');
    });
  });

  describe('Integration Tests', () => {
    it('should complete full request/response cycle with logging', async () => {
      const { logApiRequest, logApiResponse } = await import('../logger');

      // Mock successful response
      vi.spyOn(axios, 'get').mockResolvedValueOnce({
        status: 200,
        data: [{ id: 1, name: 'Test' }],
        config: {
          url: '/tenants',
          method: 'get',
          headers: { 'X-Request-Id': 'req-integration-test' },
          metadata: { startTime: Date.now() - 150 },
        } as any,
      });

      const response = await apiClient.get('/tenants');

      // Verify response
      expect(response.status).toBe(200);
      expect(response.data).toEqual([{ id: 1, name: 'Test' }]);

      // Verify logging
      expect(logApiRequest).toHaveBeenCalled();
      expect(logApiResponse).toHaveBeenCalledWith(
        'get',
        '/tenants',
        200,
        expect.any(Number),
        expect.any(Object),
      );
    });

    it('should handle error response with enhanced error and logging', async () => {
      const { createEnhancedError } = await import('../errorMapping');
      const { logApiResponse } = await import('../logger');

      // Mock error response
      const mockError = {
        response: {
          status: 403,
          data: { error: { message: 'Forbidden' } },
        },
        config: {
          url: '/admin/users',
          method: 'delete',
          headers: { 'X-Request-Id': 'req-error-test' },
          metadata: { startTime: Date.now() - 50 },
        },
      };

      vi.spyOn(axios, 'delete').mockRejectedValueOnce(mockError);

      try {
        await apiClient.delete('/admin/users');
        // Should not reach here
        expect.fail('Should have thrown error');
      } catch (error: any) {
        // Verify enhanced error
        expect(error.friendlyMessage).toBe('Test friendly message');
        expect(error.code).toBe('TEST_ERROR');

        // Verify logging
        expect(createEnhancedError).toHaveBeenCalled();
        expect(logApiResponse).toHaveBeenCalledWith(
          'delete',
          '/admin/users',
          403,
          expect.any(Number),
          expect.objectContaining({
            requestId: 'req-error-test',
            errorCode: 'TEST_ERROR',
          }),
        );
      }
    });
  });
});
