/**
 * API Client for Customer App
 *
 * Handles authenticated requests to the tenant API.
 * Includes console logging for debugging.
 *
 * Environment flags:
 * - VITE_ENABLE_API_LOGGING: 'true' to enable detailed API logging (default in dev)
 */

const API_BASE = '/api';

// Token storage keys - must match auth-context.tsx
const TOKEN_KEY = 'arc_customer_token';

/**
 * Check if API logging is enabled via environment variable
 */
const isLoggingEnabled = (): boolean => {
  const envFlag = import.meta.env.VITE_ENABLE_API_LOGGING;
  if (envFlag !== undefined) {
    return envFlag === 'true' || envFlag === true;
  }
  // Default: enabled in development, disabled in production
  return import.meta.env.MODE !== 'production';
};

/**
 * Conditional console logging - only logs when enabled
 */
const apiLog = {
  request: (method: string, url: string, body?: any, params?: any) => {
    if (!isLoggingEnabled()) return;
    console.log(`%c[API] ${method} ${url}`, 'color: #2196F3; font-weight: bold');
    if (body) console.log('%c[Request Body]', 'color: #9C27B0', body);
    if (params) console.log('%c[Query Params]', 'color: #673AB7', params);
  },
  auth: (hasToken: boolean) => {
    if (!isLoggingEnabled()) return;
    if (hasToken) {
      console.log('%c[Auth] Token attached', 'color: #4CAF50');
    } else {
      console.log('%c[Auth] No token available', 'color: #FF9800');
    }
  },
  success: (method: string, url: string, status: number, duration: number, data?: any) => {
    if (!isLoggingEnabled()) return;
    console.log(
      `%c[API] ✓ ${method} ${url} - ${status} (${duration}ms)`,
      'color: #4CAF50; font-weight: bold'
    );
    if (data) {
      const summary = Array.isArray(data)
        ? `[Array: ${data.length} items]`
        : typeof data === 'object' && data !== null
          ? `{${Object.keys(data).slice(0, 5).join(', ')}${Object.keys(data).length > 5 ? '...' : ''}}`
          : data;
      console.log('%c[Response]', 'color: #009688', summary);
    }
  },
  error: (method: string, url: string, status: number, duration: number, error: any) => {
    if (!isLoggingEnabled()) return;
    console.log(
      `%c[API] ✗ ${method} ${url} - ${status} (${duration}ms)`,
      'color: #F44336; font-weight: bold'
    );
    console.log('%c[Error]', 'color: #F44336', error);
  },
};

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean>;
}

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { params, ...fetchOptions } = options;
  const method = fetchOptions.method || 'GET';

  // Build URL with query params
  let url = `${API_BASE}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      searchParams.append(key, String(value));
    });
    url += `?${searchParams.toString()}`;
  }

  // Parse body for logging
  let bodyData: any;
  if (fetchOptions.body) {
    try {
      bodyData = JSON.parse(fetchOptions.body as string);
    } catch {
      bodyData = fetchOptions.body;
    }
  }

  // Log request
  apiLog.request(method, url, bodyData, params);

  // Get auth token - try multiple storage keys for compatibility
  let token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    token = localStorage.getItem('auth_token'); // Legacy fallback
  }

  apiLog.auth(!!token);

  const startTime = performance.now();

  const response = await fetch(url, {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...fetchOptions.headers,
    },
  });

  const duration = Math.round(performance.now() - startTime);

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    apiLog.error(method, url, response.status, duration, errorData);
    throw new ApiError(
      errorData?.message || `Request failed with status ${response.status}`,
      response.status,
      errorData
    );
  }

  const data = await response.json();
  apiLog.success(method, url, response.status, duration, data);

  return data;
}

export const api = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, data?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T>(endpoint: string, data?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }),

  patch: <T>(endpoint: string, data?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),
};

export { ApiError };
