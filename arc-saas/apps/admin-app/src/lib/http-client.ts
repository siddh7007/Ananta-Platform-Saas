import { logger } from './logger';
import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
  refreshAccessToken,
  handleSessionExpired,
} from './token-manager';

// Re-export token utilities for backward compatibility
export { getAccessToken, getRefreshToken, setTokens, clearTokens };

const API_URL = '/api';

export interface HttpClientOptions extends RequestInit {
  /** Skip adding authorization header */
  skipAuth?: boolean;
  /** Custom base URL (defaults to /api) */
  baseUrl?: string;
}

/**
 * HTTP client with automatic token refresh on 401 responses.
 * Wraps fetch with auth header injection and retry logic.
 */
export async function httpClient<T = unknown>(
  endpoint: string,
  options: HttpClientOptions = {}
): Promise<T> {
  const { skipAuth = false, baseUrl = API_URL, ...fetchOptions } = options;

  const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;
  const method = fetchOptions.method || 'GET';

  // Debug logging for request
  console.log(`%c[API Request] ${method} ${url}`, 'color: #2196F3; font-weight: bold');
  if (fetchOptions.body) {
    try {
      const bodyData = JSON.parse(fetchOptions.body as string);
      console.log('%c[Request Body]', 'color: #9C27B0', bodyData);
    } catch {
      console.log('%c[Request Body]', 'color: #9C27B0', fetchOptions.body);
    }
  }

  // Build headers with auth token
  const headers = new Headers(fetchOptions.headers);
  if (!headers.has('Content-Type') && fetchOptions.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (!skipAuth) {
    const token = getAccessToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
      console.log('%c[Auth] Token attached', 'color: #4CAF50');
    } else {
      console.log('%c[Auth] No token available', 'color: #FF9800');
    }
  }

  const startTime = performance.now();

  // Make the request
  let response = await fetch(url, {
    ...fetchOptions,
    headers,
  });

  // Handle 401 - attempt token refresh and retry
  if (response.status === 401 && !skipAuth) {
    logger.info('Received 401, attempting token refresh');

    const newToken = await refreshAccessToken();

    if (newToken) {
      // Retry the request with new token
      headers.set('Authorization', `Bearer ${newToken}`);
      response = await fetch(url, {
        ...fetchOptions,
        headers,
      });
    } else {
      // Redirect to login
      handleSessionExpired();
      throw new Error('Session expired');
    }
  }

  const duration = performance.now() - startTime;

  // Handle non-OK responses
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    console.log(
      `%c[API Error] ${method} ${url} - ${response.status} (${duration.toFixed(0)}ms)`,
      'color: #F44336; font-weight: bold',
      error
    );
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  // Parse response
  const contentType = response.headers.get('content-type');
  let data: T;
  if (contentType?.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text() as unknown as T;
  }

  // Success logging
  console.log(
    `%c[API Success] ${method} ${url} - ${response.status} (${duration.toFixed(0)}ms)`,
    'color: #4CAF50; font-weight: bold'
  );
  console.log('%c[Response Data]', 'color: #009688', data);

  return data;
}

/**
 * Convenience methods for common HTTP operations
 */
export const http = {
  get: <T = unknown>(endpoint: string, options?: HttpClientOptions) =>
    httpClient<T>(endpoint, { ...options, method: 'GET' }),

  post: <T = unknown>(endpoint: string, body?: unknown, options?: HttpClientOptions) =>
    httpClient<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T = unknown>(endpoint: string, body?: unknown, options?: HttpClientOptions) =>
    httpClient<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T = unknown>(endpoint: string, body?: unknown, options?: HttpClientOptions) =>
    httpClient<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T = unknown>(endpoint: string, options?: HttpClientOptions) =>
    httpClient<T>(endpoint, { ...options, method: 'DELETE' }),
};

export default httpClient;
