/**
 * Error Code Mapping (N-P1-5 Requirement)
 *
 * Centralizes error code definitions and user-friendly message mapping.
 * Extracts error codes from Axios responses and maps them to friendly messages
 * for display in the UI.
 *
 * Integrated with centralized logger for error tracking.
 */

import type { AxiosError } from 'axios';
import { logError, logWarn, type LogContext } from './logger';

/**
 * Standard error codes following N-P1-5 requirement
 */
export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'PRECONDITION_FAILED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INTERNAL_SERVER_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'TENANT_NOT_ACTIVE'
  | 'TENANT_KEY_INVALID'
  | 'SUBSCRIPTION_EXPIRED'
  | 'PAYMENT_REQUIRED'
  | 'WORKFLOW_FAILED'
  | 'UNKNOWN_ERROR';

/**
 * User-friendly error messages mapped to error codes
 */
const ERROR_MESSAGES: Record<ErrorCode, string> = {
  UNAUTHORIZED: 'Your session has expired. Please log in again.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  CONFLICT: 'This action conflicts with existing data. Please verify and try again.',
  PRECONDITION_FAILED: 'A required condition was not met. Please check the status and try again.',
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please wait a moment and try again.',
  INTERNAL_SERVER_ERROR: 'An unexpected error occurred. Please try again later.',
  SERVICE_UNAVAILABLE: 'The service is temporarily unavailable. Please try again later.',
  TIMEOUT: 'The request timed out. Please check your connection and try again.',
  NETWORK_ERROR: 'Unable to connect to the server. Please check your internet connection.',
  TENANT_NOT_ACTIVE: 'This tenant is not active. Please contact support.',
  TENANT_KEY_INVALID: 'Invalid tenant key. Must be 2-10 lowercase letters/numbers.',
  SUBSCRIPTION_EXPIRED: 'Your subscription has expired. Please renew to continue.',
  PAYMENT_REQUIRED: 'Payment is required to access this feature.',
  WORKFLOW_FAILED: 'The operation failed. Please try again or contact support.',
  UNKNOWN_ERROR: 'An unknown error occurred. Please try again.',
};

/**
 * Extract error code from Axios error response
 *
 * Analyzes HTTP status code and error message to determine
 * the appropriate error code for user display.
 */
export function extractErrorCode(error: AxiosError): ErrorCode {
  const status = error.response?.status;
  const errorData = error.response?.data as { message?: string; error?: { message?: string } };

  // Check for specific error messages from backend
  const message = (errorData?.error?.message || errorData?.message || '').toLowerCase();

  // Map based on status code
  switch (status) {
    case 401:
      return 'UNAUTHORIZED';

    case 403:
      return 'FORBIDDEN';

    case 404:
      return 'NOT_FOUND';

    case 409:
      return 'CONFLICT';

    case 412:
      // Check message for specific precondition failures
      if (message.includes('not active')) return 'TENANT_NOT_ACTIVE';
      if (message.includes('subscription')) return 'SUBSCRIPTION_EXPIRED';
      return 'PRECONDITION_FAILED';

    case 422:
      // Validation errors
      if (message.includes('key')) return 'TENANT_KEY_INVALID';
      return 'VALIDATION_ERROR';

    case 429:
      return 'RATE_LIMIT_EXCEEDED';

    case 402:
      return 'PAYMENT_REQUIRED';

    case 500:
      // Check for workflow failures
      if (message.includes('workflow')) return 'WORKFLOW_FAILED';
      return 'INTERNAL_SERVER_ERROR';

    case 503:
      return 'SERVICE_UNAVAILABLE';

    case 504:
      return 'TIMEOUT';

    default:
      // Check for network errors (no response)
      if (!error.response) {
        if (error.code === 'ECONNABORTED') return 'TIMEOUT';
        if (error.code === 'ERR_NETWORK') return 'NETWORK_ERROR';
        return 'NETWORK_ERROR';
      }

      return 'UNKNOWN_ERROR';
  }
}

/**
 * Map error code to user-friendly message
 */
export function mapErrorToMessage(errorCode: ErrorCode): string {
  return ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.UNKNOWN_ERROR;
}

/**
 * Validation error detail from 422 responses
 */
export interface ValidationError {
  field: string;
  message: string;
  keyword?: string;
  params?: Record<string, unknown>;
}

/**
 * Extract validation errors from 422 response
 *
 * Parses validation error details from the backend response
 * for display in forms or error messages.
 */
export function extractValidationErrors(error: AxiosError): ValidationError[] {
  const errorData = error.response?.data as {
    error?: {
      details?: Array<{
        path?: string;
        message?: string;
        keyword?: string;
        params?: Record<string, unknown>;
      }>;
    };
  };

  const details = errorData?.error?.details;

  if (!Array.isArray(details)) {
    return [];
  }

  return details.map((detail) => ({
    field: detail.path || 'unknown',
    message: detail.message || `Validation failed for ${detail.path || 'field'}`,
    keyword: detail.keyword,
    params: detail.params,
  }));
}

/**
 * Enhanced error object with friendly message and validation details
 */
export interface EnhancedError extends Error {
  status?: number;
  body?: unknown;
  code?: ErrorCode;
  friendlyMessage: string;
  validationErrors?: ValidationError[];
}

/**
 * Create enhanced error from Axios error
 *
 * Wraps Axios error with user-friendly message and validation details.
 * Logs error to centralized logger with context.
 */
export function createEnhancedError(error: AxiosError, context?: LogContext): EnhancedError {
  const errorCode = extractErrorCode(error);
  const friendlyMessage = mapErrorToMessage(errorCode);
  const validationErrors = error.response?.status === 422 ? extractValidationErrors(error) : undefined;

  const enhanced = new Error(friendlyMessage) as EnhancedError;
  enhanced.status = error.response?.status;
  enhanced.body = error.response?.data;
  enhanced.code = errorCode;
  enhanced.friendlyMessage = friendlyMessage;
  enhanced.validationErrors = validationErrors;

  // Log error with context
  const logContext: LogContext = {
    ...context,
    module: context?.module || 'ErrorMapping',
    errorCode,
    status: error.response?.status,
    url: error.config?.url,
    method: error.config?.method,
  };

  // Use appropriate log level based on error severity
  if (errorCode === 'UNAUTHORIZED' || errorCode === 'FORBIDDEN') {
    logWarn(`API Error: ${errorCode}`, logContext, enhanced);
  } else if (error.response?.status && error.response.status >= 500) {
    logError(`API Error: ${errorCode}`, logContext, enhanced);
  } else if (validationErrors && validationErrors.length > 0) {
    logWarn(`Validation Error: ${validationErrors.length} field(s)`, {
      ...logContext,
      validationErrors: validationErrors.map((ve) => ve.field).join(', '),
    });
  } else {
    logWarn(`API Error: ${errorCode}`, logContext);
  }

  return enhanced;
}

/**
 * Check if error is retryable (network, timeout, or 5xx errors)
 */
export function isRetryableError(error: AxiosError): boolean {
  // Network errors
  if (!error.response) {
    return true;
  }

  const status = error.response.status;

  // Server errors (5xx) are retryable
  if (status >= 500 && status < 600) {
    return true;
  }

  // Rate limit (429) is retryable after delay
  if (status === 429) {
    return true;
  }

  return false;
}
