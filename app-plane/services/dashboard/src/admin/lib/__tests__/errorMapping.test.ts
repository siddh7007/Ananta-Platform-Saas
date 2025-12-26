import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AxiosError } from 'axios';
import {
  extractErrorCode,
  mapErrorToMessage,
  createEnhancedError,
  extractValidationErrors,
  isRetryableError,
  type ErrorCode,
} from '../errorMapping';

describe('Error Mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extractErrorCode', () => {
    it('should map 401 to UNAUTHORIZED', () => {
      const error = new AxiosError('Unauthorized');
      error.response = { status: 401, data: {}, headers: {}, statusText: 'Unauthorized', config: {} as any };

      expect(extractErrorCode(error)).toBe('UNAUTHORIZED');
    });

    it('should map 403 to FORBIDDEN', () => {
      const error = new AxiosError('Forbidden');
      error.response = { status: 403, data: {}, headers: {}, statusText: 'Forbidden', config: {} as any };

      expect(extractErrorCode(error)).toBe('FORBIDDEN');
    });

    it('should map 404 to NOT_FOUND', () => {
      const error = new AxiosError('Not Found');
      error.response = { status: 404, data: {}, headers: {}, statusText: 'Not Found', config: {} as any };

      expect(extractErrorCode(error)).toBe('NOT_FOUND');
    });

    it('should map 422 to VALIDATION_ERROR', () => {
      const error = new AxiosError('Validation Error');
      error.response = { status: 422, data: {}, headers: {}, statusText: 'Unprocessable Entity', config: {} as any };

      expect(extractErrorCode(error)).toBe('VALIDATION_ERROR');
    });

    it('should map 422 with "key" message to TENANT_KEY_INVALID', () => {
      const error = new AxiosError('Validation Error');
      error.response = {
        status: 422,
        data: { error: { message: 'Invalid key format' } },
        headers: {},
        statusText: 'Unprocessable Entity',
        config: {} as any,
      };

      expect(extractErrorCode(error)).toBe('TENANT_KEY_INVALID');
    });

    it('should map 409 to CONFLICT', () => {
      const error = new AxiosError('Conflict');
      error.response = { status: 409, data: {}, headers: {}, statusText: 'Conflict', config: {} as any };

      expect(extractErrorCode(error)).toBe('CONFLICT');
    });

    it('should map 412 to PRECONDITION_FAILED', () => {
      const error = new AxiosError('Precondition Failed');
      error.response = { status: 412, data: {}, headers: {}, statusText: 'Precondition Failed', config: {} as any };

      expect(extractErrorCode(error)).toBe('PRECONDITION_FAILED');
    });

    it('should map 412 with "not active" to TENANT_NOT_ACTIVE', () => {
      const error = new AxiosError('Precondition Failed');
      error.response = {
        status: 412,
        data: { error: { message: 'Tenant is not active' } },
        headers: {},
        statusText: 'Precondition Failed',
        config: {} as any,
      };

      expect(extractErrorCode(error)).toBe('TENANT_NOT_ACTIVE');
    });

    it('should map 412 with "subscription" to SUBSCRIPTION_EXPIRED', () => {
      const error = new AxiosError('Precondition Failed');
      error.response = {
        status: 412,
        data: { error: { message: 'Subscription has expired' } },
        headers: {},
        statusText: 'Precondition Failed',
        config: {} as any,
      };

      expect(extractErrorCode(error)).toBe('SUBSCRIPTION_EXPIRED');
    });

    it('should map 429 to RATE_LIMIT_EXCEEDED', () => {
      const error = new AxiosError('Too Many Requests');
      error.response = { status: 429, data: {}, headers: {}, statusText: 'Too Many Requests', config: {} as any };

      expect(extractErrorCode(error)).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should map 402 to PAYMENT_REQUIRED', () => {
      const error = new AxiosError('Payment Required');
      error.response = { status: 402, data: {}, headers: {}, statusText: 'Payment Required', config: {} as any };

      expect(extractErrorCode(error)).toBe('PAYMENT_REQUIRED');
    });

    it('should map 500 to INTERNAL_SERVER_ERROR', () => {
      const error = new AxiosError('Internal Server Error');
      error.response = { status: 500, data: {}, headers: {}, statusText: 'Internal Server Error', config: {} as any };

      expect(extractErrorCode(error)).toBe('INTERNAL_SERVER_ERROR');
    });

    it('should map 500 with "workflow" to WORKFLOW_FAILED', () => {
      const error = new AxiosError('Workflow Failed');
      error.response = {
        status: 500,
        data: { error: { message: 'Workflow execution failed' } },
        headers: {},
        statusText: 'Internal Server Error',
        config: {} as any,
      };

      expect(extractErrorCode(error)).toBe('WORKFLOW_FAILED');
    });

    it('should map 503 to SERVICE_UNAVAILABLE', () => {
      const error = new AxiosError('Service Unavailable');
      error.response = { status: 503, data: {}, headers: {}, statusText: 'Service Unavailable', config: {} as any };

      expect(extractErrorCode(error)).toBe('SERVICE_UNAVAILABLE');
    });

    it('should map 504 to TIMEOUT', () => {
      const error = new AxiosError('Gateway Timeout');
      error.response = { status: 504, data: {}, headers: {}, statusText: 'Gateway Timeout', config: {} as any };

      expect(extractErrorCode(error)).toBe('TIMEOUT');
    });

    it('should map ECONNABORTED to TIMEOUT', () => {
      const error = new AxiosError('Connection Aborted');
      error.code = 'ECONNABORTED';

      expect(extractErrorCode(error)).toBe('TIMEOUT');
    });

    it('should map network errors to NETWORK_ERROR', () => {
      const error = new AxiosError('Network Error');
      error.code = 'ERR_NETWORK';
      // No response object = network error

      expect(extractErrorCode(error)).toBe('NETWORK_ERROR');
    });

    it('should map unknown errors to UNKNOWN_ERROR', () => {
      const error = new AxiosError('Unknown');
      error.response = { status: 999, data: {}, headers: {}, statusText: 'Unknown', config: {} as any };

      expect(extractErrorCode(error)).toBe('UNKNOWN_ERROR');
    });
  });

  describe('mapErrorToMessage', () => {
    it('should return friendly message for UNAUTHORIZED', () => {
      expect(mapErrorToMessage('UNAUTHORIZED')).toBe('Your session has expired. Please log in again.');
    });

    it('should return friendly message for FORBIDDEN', () => {
      expect(mapErrorToMessage('FORBIDDEN')).toBe('You do not have permission to perform this action.');
    });

    it('should return friendly message for NOT_FOUND', () => {
      expect(mapErrorToMessage('NOT_FOUND')).toBe('The requested resource was not found.');
    });

    it('should return friendly message for VALIDATION_ERROR', () => {
      expect(mapErrorToMessage('VALIDATION_ERROR')).toBe('Please check your input and try again.');
    });

    it('should return friendly message for NETWORK_ERROR', () => {
      expect(mapErrorToMessage('NETWORK_ERROR')).toBe(
        'Unable to connect to the server. Please check your internet connection.',
      );
    });

    it('should return fallback message for unknown error code', () => {
      expect(mapErrorToMessage('INVALID_CODE' as ErrorCode)).toBe('An unknown error occurred. Please try again.');
    });
  });

  describe('createEnhancedError', () => {
    it('should create enhanced error with friendly message', () => {
      const axiosError = new AxiosError('Not Found');
      axiosError.response = {
        status: 404,
        data: { error: { message: 'Tenant not found' } },
        headers: {},
        statusText: 'Not Found',
        config: {} as any,
      };

      const enhanced = createEnhancedError(axiosError);

      expect(enhanced.code).toBe('NOT_FOUND');
      expect(enhanced.friendlyMessage).toBe('The requested resource was not found.');
      expect(enhanced.status).toBe(404);
      expect(enhanced.body).toEqual({ error: { message: 'Tenant not found' } });
    });

    it('should extract validation errors from 422 response', () => {
      const axiosError = new AxiosError('Validation Failed');
      axiosError.response = {
        status: 422,
        data: {
          error: {
            details: [
              { path: 'name', message: 'Name is required' },
              { path: 'key', message: 'Key must be 2-10 characters', keyword: 'maxLength' },
            ],
          },
        },
        headers: {},
        statusText: 'Unprocessable Entity',
        config: {} as any,
      };

      const enhanced = createEnhancedError(axiosError);

      expect(enhanced.validationErrors).toHaveLength(2);
      expect(enhanced.validationErrors?.[0].field).toBe('name');
      expect(enhanced.validationErrors?.[0].message).toBe('Name is required');
      expect(enhanced.validationErrors?.[1].field).toBe('key');
      expect(enhanced.validationErrors?.[1].keyword).toBe('maxLength');
    });

    it('should log errors appropriately based on severity', () => {
      const axiosError = new AxiosError('Server Error');
      axiosError.response = {
        status: 500,
        data: {},
        headers: {},
        statusText: 'Internal Server Error',
        config: { url: '/api/tenants', method: 'get' } as any,
      };

      createEnhancedError(axiosError, {
        module: 'Test',
        tenantId: 'tenant-123',
        requestId: 'req-456',
      });

      // Should log as ERROR for 5xx
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('API Error: INTERNAL_SERVER_ERROR'),
        expect.objectContaining({
          module: 'Test',
          errorCode: 'INTERNAL_SERVER_ERROR',
          status: 500,
          tenantId: 'tenant-123',
          requestId: 'req-456',
        }),
        expect.any(Error),
      );
    });

    it('should log 401/403 as WARN', () => {
      const axiosError = new AxiosError('Unauthorized');
      axiosError.response = {
        status: 401,
        data: {},
        headers: {},
        statusText: 'Unauthorized',
        config: {} as any,
      };

      createEnhancedError(axiosError);

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('API Error: UNAUTHORIZED'),
        expect.any(Object),
        expect.any(Error),
      );
    });
  });

  describe('extractValidationErrors', () => {
    it('should extract validation errors from error response', () => {
      const axiosError = new AxiosError('Validation Failed');
      axiosError.response = {
        status: 422,
        data: {
          error: {
            details: [
              { path: 'email', message: 'Invalid email format', keyword: 'format' },
              { path: 'age', message: 'Must be at least 18', keyword: 'minimum', params: { min: 18 } },
            ],
          },
        },
        headers: {},
        statusText: 'Unprocessable Entity',
        config: {} as any,
      };

      const validationErrors = extractValidationErrors(axiosError);

      expect(validationErrors).toHaveLength(2);
      expect(validationErrors[0]).toEqual({
        field: 'email',
        message: 'Invalid email format',
        keyword: 'format',
        params: undefined,
      });
      expect(validationErrors[1]).toEqual({
        field: 'age',
        message: 'Must be at least 18',
        keyword: 'minimum',
        params: { min: 18 },
      });
    });

    it('should handle missing details array', () => {
      const axiosError = new AxiosError('Error');
      axiosError.response = {
        status: 422,
        data: { error: {} },
        headers: {},
        statusText: 'Unprocessable Entity',
        config: {} as any,
      };

      const validationErrors = extractValidationErrors(axiosError);

      expect(validationErrors).toEqual([]);
    });

    it('should handle missing path in detail', () => {
      const axiosError = new AxiosError('Validation Failed');
      axiosError.response = {
        status: 422,
        data: {
          error: {
            details: [{ message: 'Validation failed' }],
          },
        },
        headers: {},
        statusText: 'Unprocessable Entity',
        config: {} as any,
      };

      const validationErrors = extractValidationErrors(axiosError);

      expect(validationErrors[0].field).toBe('unknown');
      expect(validationErrors[0].message).toBe('Validation failed for field');
    });
  });

  describe('isRetryableError', () => {
    it('should return true for network errors', () => {
      const error = new AxiosError('Network Error');
      error.code = 'ERR_NETWORK';

      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for timeout errors', () => {
      const error = new AxiosError('Timeout');
      error.code = 'ECONNABORTED';
      error.response = {
        status: 504,
        data: {},
        headers: {},
        statusText: 'Gateway Timeout',
        config: {} as any,
      };

      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for 5xx errors', () => {
      const error = new AxiosError('Server Error');
      error.response = {
        status: 500,
        data: {},
        headers: {},
        statusText: 'Internal Server Error',
        config: {} as any,
      };

      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for rate limit errors', () => {
      const error = new AxiosError('Too Many Requests');
      error.response = {
        status: 429,
        data: {},
        headers: {},
        statusText: 'Too Many Requests',
        config: {} as any,
      };

      expect(isRetryableError(error)).toBe(true);
    });

    it('should return false for 4xx client errors', () => {
      const error = new AxiosError('Bad Request');
      error.response = {
        status: 400,
        data: {},
        headers: {},
        statusText: 'Bad Request',
        config: {} as any,
      };

      expect(isRetryableError(error)).toBe(false);
    });

    it('should return false for auth errors', () => {
      const error = new AxiosError('Unauthorized');
      error.response = {
        status: 401,
        data: {},
        headers: {},
        statusText: 'Unauthorized',
        config: {} as any,
      };

      expect(isRetryableError(error)).toBe(false);
    });
  });
});
