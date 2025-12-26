import { describe, it, expect, beforeEach, vi } from 'vitest';
import { logger, LogLevel, logDebug, logInfo, logWarn, logError, logApiRequest, logApiResponse } from '../logger';

describe('Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Log Levels', () => {
    it('should filter logs based on minimum level', () => {
      // Logger is configured with INFO level from setup.ts
      logDebug('Debug message'); // Should not log
      logInfo('Info message'); // Should log
      logWarn('Warn message'); // Should log
      logError('Error message'); // Should log

      // Debug should not be called (below INFO threshold)
      expect(console.debug).not.toHaveBeenCalled();

      // Info, warn, error should be called
      expect(console.info).toHaveBeenCalledTimes(1);
      expect(console.warn).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledTimes(2); // error logs twice (message + stack)
    });
  });

  describe('Structured Logging', () => {
    it('should include context in log output', () => {
      const context = {
        module: 'TestModule',
        action: 'testAction',
        userId: 'user-123',
        tenantId: 'tenant-456',
      };

      logInfo('Test message', context);

      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('[TestModule]'),
        context,
      );
    });

    it('should format timestamp correctly', () => {
      logInfo('Test message');

      const call = (console.info as any).mock.calls[0][0];
      // Check ISO timestamp format
      expect(call).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
    });

    it('should include log level in output', () => {
      logInfo('Info test');
      logWarn('Warn test');
      logError('Error test');

      expect((console.info as any).mock.calls[0][0]).toContain('INFO');
      expect((console.warn as any).mock.calls[0][0]).toContain('WARN');
      expect((console.error as any).mock.calls[0][0]).toContain('ERROR');
    });
  });

  describe('Error Logging', () => {
    it('should log error with stack trace', () => {
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test.ts:10:15';

      logError('Error occurred', { module: 'Test' }, error);

      expect(console.error).toHaveBeenCalledTimes(2);
      expect((console.error as any).mock.calls[0][0]).toContain('ERROR');
      expect((console.error as any).mock.calls[1][0]).toContain('at test.ts:10:15');
    });

    it('should handle errors without stack traces', () => {
      const error = new Error('Test error');
      delete error.stack;

      logError('Error occurred', { module: 'Test' }, error);

      // Should still log error message without throwing
      expect(console.error).toHaveBeenCalledTimes(1);
    });
  });

  describe('API Request Logging', () => {
    it('should log API requests with method and URL', () => {
      logApiRequest('GET', '/api/tenants', {
        tenantId: 'tenant-123',
        requestId: 'req-456',
        hasAuth: true,
      });

      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('API Request: GET /api/tenants'),
        expect.objectContaining({
          module: 'API',
          action: 'request',
          tenantId: 'tenant-123',
          requestId: 'req-456',
          hasAuth: true,
        }),
      );
    });
  });

  describe('API Response Logging', () => {
    it('should log successful responses as INFO', () => {
      logApiResponse('GET', '/api/tenants', 200, 150, {
        requestId: 'req-123',
      });

      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('API Response: GET /api/tenants - 200'),
        expect.objectContaining({
          module: 'API',
          action: 'response',
          status: 200,
          duration: 150,
          requestId: 'req-123',
        }),
      );
    });

    it('should log 4xx responses as ERROR', () => {
      logApiResponse('POST', '/api/tenants', 400, 100, {
        requestId: 'req-456',
      });

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('API Response: POST /api/tenants - 400'),
        expect.objectContaining({
          module: 'API',
          action: 'response',
          status: 400,
          duration: 100,
        }),
      );
    });

    it('should log 5xx responses as ERROR', () => {
      logApiResponse('GET', '/api/tenants', 500, 200, {
        requestId: 'req-789',
      });

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('API Response: GET /api/tenants - 500'),
        expect.objectContaining({
          module: 'API',
          action: 'response',
          status: 500,
        }),
      );
    });
  });

  describe('Performance Logging', () => {
    it('should log performance metrics', () => {
      logger.performance('API Call Duration', 250, {
        endpoint: '/api/tenants',
      });

      expect(console.debug).toHaveBeenCalledWith(
        expect.stringContaining('Performance: API Call Duration = 250ms'),
        expect.objectContaining({
          module: 'Performance',
          metric: 'API Call Duration',
          value: 250,
          endpoint: '/api/tenants',
        }),
      );
    });
  });

  describe('Auth Logging', () => {
    it('should log authentication events', () => {
      logger.auth('Login', {
        userId: 'user-123',
        method: 'keycloak',
      });

      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('Auth: Login'),
        expect.objectContaining({
          module: 'Auth',
          action: 'Login',
          userId: 'user-123',
          method: 'keycloak',
        }),
      );
    });
  });

  describe('User Action Logging', () => {
    it('should log user actions', () => {
      logger.userAction('Create Tenant', {
        userId: 'user-123',
        tenantId: 'tenant-456',
        tenantName: 'Acme Corp',
      });

      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('User Action: Create Tenant'),
        expect.objectContaining({
          module: 'User',
          action: 'Create Tenant',
          userId: 'user-123',
          tenantId: 'tenant-456',
          tenantName: 'Acme Corp',
        }),
      );
    });
  });

  describe('Context Merging', () => {
    it('should merge custom context with specialized logger context', () => {
      logApiRequest('GET', '/api/tenants', {
        customField: 'customValue',
        tenantId: 'tenant-123',
      });

      expect(console.info).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          module: 'API',
          action: 'request',
          customField: 'customValue',
          tenantId: 'tenant-123',
        }),
      );
    });
  });
});
