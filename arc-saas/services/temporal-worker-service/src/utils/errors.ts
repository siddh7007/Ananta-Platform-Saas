/**
 * Custom Error Types for Temporal Activities
 *
 * These error types help Temporal determine retry behavior:
 * - Retryable errors: Transient failures that may succeed on retry
 * - Non-retryable errors: Permanent failures that should not be retried
 */

/**
 * Base class for all custom errors
 */
export class BaseError extends Error {
  public readonly isRetryable: boolean;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    isRetryable: boolean,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.isRetryable = isRetryable;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

// ============================================
// Non-Retryable Errors (Permanent Failures)
// ============================================

/**
 * Invalid configuration that cannot be fixed by retry
 */
export class InvalidConfigurationError extends BaseError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'INVALID_CONFIGURATION', false, details);
  }
}

/**
 * Invalid credentials (wrong API keys, etc.)
 */
export class InvalidCredentialsError extends BaseError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'INVALID_CREDENTIALS', false, details);
  }
}

/**
 * Resource already exists (idempotency violation)
 */
export class ResourceAlreadyExistsError extends BaseError {
  constructor(resource: string, identifier?: string) {
    super(
      identifier ? `${resource} already exists: ${identifier}` : resource,
      'RESOURCE_ALREADY_EXISTS',
      false,
      identifier ? { resource, identifier } : { resource }
    );
  }
}

/**
 * Resource not found
 */
export class ResourceNotFoundError extends BaseError {
  constructor(message: string, identifier?: string) {
    super(
      identifier ? `${message}: ${identifier}` : message,
      'RESOURCE_NOT_FOUND',
      false,
      identifier ? { identifier } : undefined
    );
  }
}

/**
 * Validation error for invalid input
 */
export class ValidationError extends BaseError {
  constructor(message: string, field?: string) {
    super(message, 'VALIDATION_ERROR', false, { field });
  }
}

/**
 * Permission denied
 */
export class PermissionDeniedError extends BaseError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'PERMISSION_DENIED', false, details);
  }
}

// ============================================
// Retryable Errors (Transient Failures)
// ============================================

/**
 * External service temporarily unavailable
 */
export class ServiceUnavailableError extends BaseError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'SERVICE_UNAVAILABLE', true, details);
  }
}

/**
 * Rate limit exceeded
 */
export class RateLimitError extends BaseError {
  public readonly retryAfterMs?: number;

  constructor(service: string, retryAfterMs?: number) {
    super(
      `Rate limit exceeded for ${service}`,
      'RATE_LIMIT_EXCEEDED',
      true,
      { service, retryAfterMs }
    );
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Network/connection error
 */
export class ConnectionError extends BaseError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONNECTION_ERROR', true, details);
  }
}

/**
 * Timeout error
 */
export class TimeoutError extends BaseError {
  constructor(message: string, timeoutMs?: number) {
    super(
      timeoutMs ? `${message} (timeout: ${timeoutMs}ms)` : message,
      'TIMEOUT',
      true,
      timeoutMs ? { timeoutMs } : undefined
    );
  }
}

/**
 * Database error (usually retryable)
 */
export class DatabaseError extends BaseError {
  constructor(message: string, isRetryable = true, details?: Record<string, unknown>) {
    super(message, 'DATABASE_ERROR', isRetryable, details);
  }
}

// ============================================
// Error Utilities
// ============================================

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof BaseError) {
    return error.isRetryable;
  }

  // Check for common retryable error patterns
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Network errors
    if (
      message.includes('econnrefused') ||
      message.includes('econnreset') ||
      message.includes('etimedout') ||
      message.includes('enotfound')
    ) {
      return true;
    }

    // HTTP 5xx errors
    if (message.includes('500') || message.includes('502') || message.includes('503')) {
      return true;
    }

    // Rate limiting
    if (message.includes('429') || message.includes('rate limit')) {
      return true;
    }
  }

  // Default to retryable for unknown errors
  return true;
}

/**
 * Wrap an error with additional context
 */
export function wrapError(
  error: unknown,
  message: string,
  isRetryable?: boolean
): BaseError {
  const originalMessage = error instanceof Error ? error.message : String(error);
  const fullMessage = `${message}: ${originalMessage}`;

  if (isRetryable === undefined) {
    isRetryable = isRetryableError(error);
  }

  if (isRetryable) {
    return new ServiceUnavailableError(fullMessage);
  } else {
    return new InvalidConfigurationError(fullMessage);
  }
}

/**
 * List of non-retryable error type names for Temporal configuration
 */
export const NON_RETRYABLE_ERROR_TYPES = [
  'InvalidConfigurationError',
  'InvalidCredentialsError',
  'ResourceAlreadyExistsError',
  'ResourceNotFoundError',
  'ValidationError',
  'PermissionDeniedError',
];
