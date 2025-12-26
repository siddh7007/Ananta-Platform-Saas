import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { env } from '@/config/env';
import { apiLogger } from '@/lib/logger';
import { withResilience, getCircuitStatus, resetCircuit } from '@/lib/api-retry';

// ============================================
// API Response Field Transformations
// ============================================
// CNS API returns snake_case fields, frontend expects camelCase
// Transform at the transport layer so all consumers get consistent data

/**
 * Convert snake_case string to camelCase
 * Example: manufacturer_part_number -> manufacturerPartNumber
 */
function snakeToCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Transform a single record's snake_case fields to camelCase
 * - Converts ALL snake_case fields to camelCase automatically
 * - Keeps original snake_case keys for backwards compatibility
 * - Handles BOM-specific field mappings (e.g., component_count -> lineCount)
 */
function transformSnakeToCamel(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(transformSnakeToCamel);
  if (typeof obj !== 'object') return obj;

  const record = obj as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    // Transform nested objects/arrays recursively
    const transformedValue = transformSnakeToCamel(value);

    // Always keep original key for backwards compatibility
    result[key] = transformedValue;

    // BOM-specific field mappings that need custom camelCase names
    switch (key) {
      case 'manufacturer_part_number':
        // Map to 'mpn' which is the standard abbreviation used in the frontend
        result.mpn = transformedValue;
        break;
      case 'bom_id':
        result.bomId = transformedValue;
        break;
      case 'line_number':
        result.lineNumber = transformedValue;
        break;
      case 'component_count':
        // Special mapping: component_count -> lineCount (not componentCount)
        result.lineCount = transformedValue;
        break;
      case 'enriched_count':
        result.enrichedCount = transformedValue;
        break;
      case 'file_name':
      case 'filename':
        result.fileName = transformedValue;
        break;
      case 'enrichment_status':
        result.enrichmentStatus = transformedValue;
        break;
      case 'enrichment_progress':
        // Also calculate enrichedCount from progress if not already set
        result.enrichmentProgress = transformedValue;
        if (transformedValue && typeof transformedValue === 'object' && !result.enrichedCount) {
          const progress = transformedValue as Record<string, unknown>;
          const matched = (progress.matched as number) || 0;
          const enriched = (progress.enriched as number) || 0;
          result.enrichedCount = matched + enriched;
        }
        break;
      default:
        // Auto-convert any snake_case key to camelCase
        // (only if key contains underscore to avoid unnecessary conversions)
        if (key.includes('_')) {
          const camelKey = snakeToCamelCase(key);
          result[camelKey] = transformedValue;
        }
    }
  }

  // Ensure defaults for BOM records (identified by having 'id' and some BOM-like fields)
  if ('id' in result && ('component_count' in record || 'enrichment_status' in record || 'filename' in record)) {
    if (result.lineCount === undefined) result.lineCount = 0;
    if (result.enrichedCount === undefined) result.enrichedCount = 0;
  }

  return result;
}

/**
 * Transform API response data - handles both direct arrays and wrapped responses
 */
function transformApiResponse(data: unknown): unknown {
  if (data === null || data === undefined) return data;

  // Handle wrapped responses: { data: [...], total: N } or { items: [...], total: N }
  if (typeof data === 'object' && !Array.isArray(data)) {
    const wrapped = data as Record<string, unknown>;
    if (Array.isArray(wrapped.data)) {
      return {
        ...wrapped,
        data: wrapped.data.map(transformSnakeToCamel),
      };
    }
    if (Array.isArray(wrapped.items)) {
      return {
        ...wrapped,
        items: wrapped.items.map(transformSnakeToCamel),
      };
    }
  }

  // Handle direct array responses
  if (Array.isArray(data)) {
    return data.map(transformSnakeToCamel);
  }

  // Handle single object
  return transformSnakeToCamel(data);
}

// ============================================
// Circuit breaker keys for each service
// ============================================

export const CIRCUIT_KEYS = {
  PLATFORM: 'platform-api',
  CNS: 'cns-api',
  SUPABASE: 'supabase-api',
} as const;

// ============================================
// Request ID / Correlation ID Generation
// ============================================

/**
 * Generate a unique request ID for distributed tracing
 * Format: cbp-{timestamp}-{random}
 */
function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `cbp-${timestamp}-${random}`;
}

/**
 * Session-level correlation ID (persists across requests in the same session)
 * This allows tracing all requests from a single user session
 */
let sessionCorrelationId: string | null = null;

function getSessionCorrelationId(): string {
  if (!sessionCorrelationId) {
    // Try to get from sessionStorage first (persists across page refreshes)
    sessionCorrelationId = sessionStorage.getItem('cbp_correlation_id');
    if (!sessionCorrelationId) {
      sessionCorrelationId = `sess-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
      sessionStorage.setItem('cbp_correlation_id', sessionCorrelationId);
    }
  }
  return sessionCorrelationId;
}

/**
 * Reset session correlation ID (call on logout)
 */
export function resetSessionCorrelation(): void {
  sessionCorrelationId = null;
  sessionStorage.removeItem('cbp_correlation_id');
}

/**
 * Get access token from storage (set by auth provider)
 *
 * This reads the token from localStorage where oidc-client-ts stores it.
 * During silent token renewal, there may be a brief window where the token
 * is being updated. We handle this by:
 * 1. Checking if the token exists
 * 2. Checking if the token is not expired (exp claim)
 * 3. Returning null if either check fails (caller should retry or wait)
 */
function getAccessToken(): string | null {
  try {
    const oidcKey = `oidc.user:${env.keycloak.url}/realms/${env.keycloak.realm}:${env.keycloak.clientId}`;
    const oidcData = localStorage.getItem(oidcKey);
    if (oidcData) {
      const parsed = JSON.parse(oidcData);
      const accessToken = parsed.access_token;
      if (!accessToken) {
        console.debug('[axios] No access_token in OIDC storage');
        return null;
      }

      // Check if token is expired (with 10 second buffer for network latency)
      // This prevents sending expired tokens during silent renewal
      try {
        const tokenParts = accessToken.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(atob(tokenParts[1].replace(/-/g, '+').replace(/_/g, '/')));
          const exp = payload.exp;
          if (exp && Date.now() / 1000 > exp - 10) {
            console.debug('[axios] Token expired or about to expire, waiting for renewal');
            return null;
          }
        }
      } catch (parseErr) {
        // If we can't parse the token, still try to use it
        console.debug('[axios] Could not parse token expiry, using token anyway');
      }

      return accessToken;
    }
  } catch {
    // Ignore parsing errors
  }
  return null;
}

/**
 * Get current tenant ID from storage
 */
function getCurrentTenantId(): string | null {
  return localStorage.getItem('cbp_selected_tenant');
}

/**
 * Create axios instance with interceptors for auth, tenant headers, and logging
 * @param baseURL - Base URL for the API
 * @param clientName - Name for logging purposes
 * @param transformResponse - Whether to transform snake_case to camelCase (for CNS API)
 * @param timeout - Request timeout in milliseconds (defaults to env.timeout.default)
 */
function createApiClient(
  baseURL: string,
  clientName: string = 'API',
  transformResponse: boolean = false,
  timeout: number = env.timeout.default
): AxiosInstance {
  const client = axios.create({
    baseURL,
    timeout,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor - add auth, tenant, and correlation headers + logging
  client.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      // Handle FormData: delete Content-Type so axios can auto-set multipart/form-data with boundary
      if (config.data instanceof FormData) {
        delete config.headers['Content-Type'];
        // Debug: log FormData keys to verify organization_id is included
        const formDataKeys: string[] = [];
        config.data.forEach((_, key) => formDataKeys.push(key));
        console.log(`[${clientName}] FormData request detected, keys:`, formDataKeys);
      }

      // Add Authorization header with retry logic for token renewal
      // During silent token renewal, the token may be temporarily unavailable
      let token = getAccessToken();
      if (!token) {
        // Wait briefly for token renewal (max 2 seconds, check every 100ms)
        const maxWaitMs = 2000;
        const checkIntervalMs = 100;
        let waited = 0;
        while (!token && waited < maxWaitMs) {
          await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
          waited += checkIntervalMs;
          token = getAccessToken();
        }
        if (token) {
          apiLogger.debug(`[${clientName}] Token available after ${waited}ms wait`);
        } else {
          apiLogger.warn(`[${clientName}] No token available after ${maxWaitMs}ms - request may fail with 401`);
        }
      }
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Add organization/tenant headers for multi-tenant isolation
      // CNS service expects X-Organization-ID, but also add X-Tenant-Id for compatibility
      const tenantId = getCurrentTenantId();
      if (tenantId) {
        config.headers['X-Organization-ID'] = tenantId;
        config.headers['X-Tenant-Id'] = tenantId; // Keep for backwards compatibility
      }

      // Add correlation headers for distributed tracing
      const requestId = generateRequestId();
      const correlationId = getSessionCorrelationId();
      config.headers['X-Request-Id'] = requestId;
      config.headers['X-Correlation-Id'] = correlationId;

      // Add request timing metadata (including request ID for logging)
      (config as InternalAxiosRequestConfig & { metadata?: { startTime: number; requestId: string } }).metadata = {
        startTime: performance.now(),
        requestId,
      };

      // Log outgoing request with request ID
      const url = config.url || '';
      apiLogger.debug(`[${clientName}] ${config.method?.toUpperCase()} ${url} [${requestId}]`);

      return config;
    },
    (error) => {
      apiLogger.error(`[${clientName}] Request error:`, error.message);
      return Promise.reject(error);
    }
  );

  // Response interceptor - handle errors + logging + field transformation
  client.interceptors.response.use(
    (response: AxiosResponse) => {
      // Calculate request duration
      const config = response.config as InternalAxiosRequestConfig & { metadata?: { startTime: number; requestId: string } };
      const duration = config.metadata?.startTime
        ? Math.round(performance.now() - config.metadata.startTime)
        : undefined;

      // Log successful response with request ID
      apiLogger.api(
        response.config.method || 'GET',
        response.config.url || '',
        response.status,
        duration
      );

      // Transform response data if enabled (snake_case -> camelCase)
      if (transformResponse && response.data) {
        response.data = transformApiResponse(response.data);
      }

      return response;
    },
    (error) => {
      // Calculate request duration for failed requests
      const config = error.config as InternalAxiosRequestConfig & { metadata?: { startTime: number; requestId: string } };
      const duration = config?.metadata?.startTime
        ? Math.round(performance.now() - config.metadata.startTime)
        : undefined;
      const requestId = config?.metadata?.requestId || 'unknown';

      // Log error response with request ID for troubleshooting
      const status = error.response?.status;
      const url = config?.url || '';
      const method = config?.method || 'GET';

      apiLogger.api(method, url, status, duration);

      // Enhanced error logging - distinguish timeout errors
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        apiLogger.error(`[${clientName}] TIMEOUT Request exceeded ${config?.timeout || 'unknown'}ms [${requestId}]`);
      } else {
        apiLogger.error(`[${clientName}] ${status || 'NETWORK'} ${error.message} [${requestId}]`);
      }

      // Handle 401 - clear all caches and redirect to login
      if (error.response?.status === 401) {
        apiLogger.warn(`[${clientName}] Unauthorized - clearing caches and redirecting to login`);
        // Clear all tenant-related caches (inline to avoid circular dependency with clearTenantCache)
        localStorage.removeItem('cbp_selected_tenant');
        localStorage.removeItem('cbp_tenant_list');
        localStorage.removeItem('cbp_tenant_settings');
        // Clear session correlation ID for fresh session on re-auth
        sessionCorrelationId = null;
        sessionStorage.removeItem('cbp_correlation_id');
        window.location.href = '/login';
      }

      // Handle 403 - tenant access denied
      if (error.response?.status === 403) {
        apiLogger.warn(`[${clientName}] Forbidden - access denied to resource`);
      }

      return Promise.reject(error);
    }
  );

  return client;
}

/**
 * Platform API client (tenant-management-service)
 * Base URL: /platform or http://localhost:14000
 */
export const platformApi = createApiClient(env.api.platform, 'Platform');

/**
 * CNS API client (cns-service)
 * Base URL: /api/cns or http://localhost:27200
 * Response transformation enabled: snake_case fields -> camelCase
 * (component_count -> lineCount, enriched_count -> enrichedCount, etc.)
 */
export const cnsApi = createApiClient(env.api.cns, 'CNS', true);

/**
 * Supabase API client (read-only component catalog)
 * Base URL: http://localhost:27810
 */
export const supabaseApi = createApiClient(env.api.supabase, 'Supabase');

/**
 * Helper to set tenant ID manually (used by tenant selector)
 */
export function setCurrentTenant(tenantId: string): void {
  localStorage.setItem('cbp_selected_tenant', tenantId);
}

/**
 * Helper to clear tenant selection
 */
export function clearCurrentTenant(): void {
  localStorage.removeItem('cbp_selected_tenant');
}

/**
 * Clear all tenant-related caches and session data
 * Call this on logout, tenant switch, or role change
 */
export function clearTenantCache(): void {
  // Clear tenant selection
  localStorage.removeItem('cbp_selected_tenant');

  // Clear any cached tenant data
  localStorage.removeItem('cbp_tenant_list');
  localStorage.removeItem('cbp_tenant_settings');

  // Clear session correlation ID
  resetSessionCorrelation();

  // Reset all circuit breakers (fresh start for new session)
  resetCircuit(CIRCUIT_KEYS.PLATFORM);
  resetCircuit(CIRCUIT_KEYS.CNS);
  resetCircuit(CIRCUIT_KEYS.SUPABASE);

  apiLogger.info('Tenant cache cleared');
}

/**
 * Assert that a tenant ID is set for multi-tenant operations
 * Throws if no tenant is selected - use for sensitive operations that require tenant isolation
 */
export function assertTenantContext(): string {
  const tenantId = getCurrentTenantId();
  if (!tenantId) {
    throw new Error('Tenant context required: No tenant selected. Please select a tenant before accessing this resource.');
  }
  return tenantId;
}

/**
 * Get tenant ID with fallback - for non-critical operations that can proceed without tenant
 */
export function getTenantIdOrNull(): string | null {
  return getCurrentTenantId();
}

// ============================================
// Resilient API Wrappers with Retry + Circuit Breaker
// ============================================

/**
 * Resilient GET request with retry and circuit breaker
 */
export async function resilientGet<T>(
  client: AxiosInstance,
  url: string,
  circuitKey: string
): Promise<AxiosResponse<T>> {
  return withResilience(circuitKey, () => client.get<T>(url));
}

/**
 * Resilient POST request with retry and circuit breaker
 */
export async function resilientPost<T>(
  client: AxiosInstance,
  url: string,
  data: unknown,
  circuitKey: string
): Promise<AxiosResponse<T>> {
  return withResilience(circuitKey, () => client.post<T>(url, data));
}

/**
 * Resilient PUT request with retry and circuit breaker
 */
export async function resilientPut<T>(
  client: AxiosInstance,
  url: string,
  data: unknown,
  circuitKey: string
): Promise<AxiosResponse<T>> {
  return withResilience(circuitKey, () => client.put<T>(url, data));
}

/**
 * Resilient DELETE request with retry and circuit breaker
 */
export async function resilientDelete<T>(
  client: AxiosInstance,
  url: string,
  circuitKey: string
): Promise<AxiosResponse<T>> {
  return withResilience(circuitKey, () => client.delete<T>(url));
}

/**
 * Check if a circuit breaker is open for a given service
 */
export function isServiceCircuitOpen(circuitKey: string): boolean {
  return getCircuitStatus(circuitKey) === 'open';
}

/**
 * Reset a service's circuit breaker (e.g., after manual recovery)
 */
export function resetServiceCircuit(circuitKey: string): void {
  resetCircuit(circuitKey);
  apiLogger.info(`Circuit breaker reset for: ${circuitKey}`);
}

// ============================================
// Timeout Helper Types & Functions
// ============================================

/**
 * Check if an error is a timeout error
 */
export function isTimeoutError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { code?: string; message?: string };
  return err.code === 'ECONNABORTED' || err.message?.toLowerCase().includes('timeout') || false;
}

/**
 * Make a search request with shorter timeout
 * Use this for component search, catalog queries, etc. where fast response is critical
 *
 * @example
 * const response = await searchWithTimeout(cnsApi, '/catalog/search?query=resistor');
 */
export async function searchWithTimeout<T = any>(
  client: AxiosInstance,
  url: string,
  config?: Omit<import('axios').AxiosRequestConfig, 'timeout'>
): Promise<import('axios').AxiosResponse<T>> {
  return client.get<T>(url, {
    ...config,
    timeout: env.timeout.search, // Use shorter search timeout (default 15s)
  });
}

/**
 * Make a POST search request with shorter timeout
 */
export async function searchPostWithTimeout<T = any>(
  client: AxiosInstance,
  url: string,
  data?: unknown,
  config?: Omit<import('axios').AxiosRequestConfig, 'timeout'>
): Promise<import('axios').AxiosResponse<T>> {
  return client.post<T>(url, data, {
    ...config,
    timeout: env.timeout.search,
  });
}

export default platformApi;
