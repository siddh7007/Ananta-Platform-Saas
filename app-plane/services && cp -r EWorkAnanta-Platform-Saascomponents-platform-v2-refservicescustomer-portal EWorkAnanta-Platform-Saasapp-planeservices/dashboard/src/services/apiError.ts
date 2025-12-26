/**
 * Centralized API Error Handling
 *
 * Provides standardized error handling for API requests.
 *
 * Features:
 * - Typed API errors with status codes
 * - Automatic error message extraction
 * - Network error detection
 * - Error logging with context
 */

/**
 * Custom API error class with additional context.
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly statusText: string;
  public readonly detail?: string;
  public readonly code?: string;
  public readonly isNetworkError: boolean;
  public readonly timestamp: Date;

  constructor(options: {
    message: string;
    status?: number;
    statusText?: string;
    detail?: string;
    code?: string;
    isNetworkError?: boolean;
  }) {
    super(options.message);
    this.name = 'ApiError';
    this.status = options.status ?? 0;
    this.statusText = options.statusText ?? '';
    this.detail = options.detail;
    this.code = options.code;
    this.isNetworkError = options.isNetworkError ?? false;
    this.timestamp = new Date();

    // Maintains proper stack trace for V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

  /**
   * Get a user-friendly error message.
   */
  getUserMessage(): string {
    if (this.isNetworkError) {
      return 'Network error. Please check your connection and try again.';
    }

    switch (this.status) {
      case 400:
        return this.detail || 'Invalid request. Please check your input.';
      case 401:
        return 'Session expired. Please log in again.';
      case 403:
        return 'You do not have permission to perform this action.';
      case 404:
        return this.detail || 'The requested resource was not found.';
      case 409:
        return this.detail || 'A conflict occurred. Please refresh and try again.';
      case 422:
        return this.detail || 'Invalid data provided. Please check your input.';
      case 429:
        return 'Too many requests. Please wait a moment and try again.';
      case 500:
        return 'Server error. Please try again later.';
      case 502:
      case 503:
      case 504:
        return 'Service temporarily unavailable. Please try again later.';
      default:
        return this.detail || this.message || 'An unexpected error occurred.';
    }
  }

  /**
   * Check if error is retriable (network/server errors).
   */
  isRetriable(): boolean {
    return this.isNetworkError || this.status >= 500 || this.status === 429;
  }
}

/**
 * Parse error response from fetch API.
 */
export async function parseApiError(
  response: Response,
  context?: string
): Promise<ApiError> {
  let detail: string | undefined;
  let code: string | undefined;

  try {
    const data = await response.json();
    detail = data.detail || data.message || data.error;
    code = data.code || data.error_code;
  } catch {
    // Response body is not JSON
    try {
      detail = await response.text();
    } catch {
      // Ignore text parsing errors
    }
  }

  const contextPrefix = context ? `[${context}] ` : '';
  const message = `${contextPrefix}API request failed: ${response.status} ${response.statusText}`;

  console.error(message, { status: response.status, detail, code, url: response.url });

  return new ApiError({
    message,
    status: response.status,
    statusText: response.statusText,
    detail,
    code,
  });
}

/**
 * Create an ApiError from a caught exception.
 */
export function createApiError(error: unknown, context?: string): ApiError {
  const contextPrefix = context ? `[${context}] ` : '';

  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof TypeError && error.message.includes('fetch')) {
    return new ApiError({
      message: `${contextPrefix}Network request failed`,
      isNetworkError: true,
    });
  }

  if (error instanceof Error) {
    return new ApiError({
      message: `${contextPrefix}${error.message}`,
      detail: error.message,
    });
  }

  return new ApiError({
    message: `${contextPrefix}An unexpected error occurred`,
    detail: String(error),
  });
}

/**
 * Wrapper for fetch that handles errors consistently.
 */
export async function apiFetch<T>(
  url: string,
  options?: RequestInit,
  context?: string
): Promise<T> {
  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      throw await parseApiError(response, context);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw createApiError(error, context);
  }
}

/**
 * Type-safe fetch wrapper with automatic error handling.
 * Returns [data, error] tuple.
 */
export async function safeApiFetch<T>(
  url: string,
  options?: RequestInit,
  context?: string
): Promise<[T | null, ApiError | null]> {
  try {
    const data = await apiFetch<T>(url, options, context);
    return [data, null];
  } catch (error) {
    if (error instanceof ApiError) {
      return [null, error];
    }
    return [null, createApiError(error, context)];
  }
}

export default ApiError;
