import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { getActiveTenantId } from '@/admin/contexts/TenantContext';
import { getToken } from '@/admin/providers/keycloak';
import { logApiRequest, logApiResponse, logError, logInfo } from './logger';
import { createEnhancedError } from './errorMapping';

const API_BASE_URL = process.env.NEXT_PUBLIC_PLATFORM_API_URL || 'http://localhost:14000';
const API_PREFIX = (process.env.NEXT_PUBLIC_PLATFORM_API_PREFIX || '/cns').replace(/\/$/, '');
const API_AUDIENCE = process.env.NEXT_PUBLIC_PLATFORM_API_AUDIENCE;

const client: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

const injectAuthHeaders = async (
  config: InternalAxiosRequestConfig,
): Promise<InternalAxiosRequestConfig> => {
  const headers = config.headers ?? {};
  const token = await getToken();
  const tenantId = getActiveTenantId();

  // Add correlation ID for request tracing
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  headers['X-Request-Id'] = requestId;

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else {
    logError('No authentication token available', {
      module: 'ApiClient',
      action: 'injectAuthHeaders',
      url: config.url,
    });
  }

  if (tenantId) {
    headers['X-Tenant-Id'] = tenantId;
  }

  if (API_AUDIENCE) {
    headers['X-Api-Audience'] = API_AUDIENCE;
  }

  config.headers = headers;

  // Log API request
  if (config.url) {
    logApiRequest(config.method || 'GET', config.url, {
      tenantId: tenantId || undefined,
      requestId,
      hasAuth: !!token,
    });
  }

  return config;
};

client.interceptors.request.use(
  (config) => injectAuthHeaders(config),
  (error) => Promise.reject(error),
);

client.interceptors.response.use(
  (response) => {
    // Log successful API response
    const requestConfig = response.config;
    const requestId = requestConfig.headers?.['X-Request-Id'] as string;

    if (requestConfig.url) {
      logApiResponse(
        requestConfig.method || 'GET',
        requestConfig.url,
        response.status,
        undefined, // Duration tracking removed (not supported by axios types)
        {
          requestId,
          responseSize: JSON.stringify(response.data).length,
        },
      );
    }

    return response;
  },
  (error: AxiosError) => {
    // Create enhanced error with logging
    const requestConfig = error.config;
    const requestId = requestConfig?.headers?.['X-Request-Id'] as string;
    const tenantId = getActiveTenantId();

    const enhancedError = createEnhancedError(error, {
      module: 'ApiClient',
      action: 'response',
      tenantId: tenantId || undefined,
      requestId,
    });

    // Log API response error
    if (requestConfig?.url) {
      // Duration tracking removed (not supported by axios types)
      const duration = undefined;

      logApiResponse(
        requestConfig.method || 'GET',
        requestConfig.url,
        error.response?.status || 0,
        duration,
        {
          requestId,
          errorCode: enhancedError.code,
          tenantId: tenantId || undefined,
        },
      );
    }

    return Promise.reject(enhancedError);
  },
);

// Add request timing metadata
client.interceptors.request.use(
  (config) => {
    (config as any).metadata = { startTime: Date.now() };
    return config;
  },
  (error) => Promise.reject(error),
);

export const buildResourcePath = (resource: string): string => {
  const sanitized = resource.startsWith('/') ? resource : `/${resource}`;
  return `${API_PREFIX}${sanitized}`;
};

export const apiClient = client;
