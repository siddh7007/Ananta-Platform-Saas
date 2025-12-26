/**
 * LoopBack Data Provider Factory for React Admin
 *
 * Creates a data provider that communicates with ARC-SaaS LoopBack backend.
 * Designed to work with Keycloak authentication - tenant isolation is enforced
 * at the LoopBack controller level via JWT claims.
 *
 * Key differences from Supabase:
 * - RLS is enforced at application layer (LoopBack controllers) not database
 * - Uses standard REST API endpoints instead of PostgREST
 * - Token must be passed via Authorization header
 * - Pagination uses offset/limit pattern
 *
 * @example
 * ```tsx
 * import { createLoopbackDataProvider } from './lib/data/loopback';
 * import { getKeycloakState } from './lib/auth/keycloak';
 *
 * const dataProvider = createLoopbackDataProvider({
 *   apiUrl: 'http://localhost:14000',
 *   getToken: async () => {
 *     const state = getKeycloakState();
 *     return state.getToken ? await state.getToken() : null;
 *   },
 * });
 * ```
 */

import { DataProvider, GetListParams, GetOneParams, GetManyParams, GetManyReferenceParams, CreateParams, UpdateParams, UpdateManyParams, DeleteParams, DeleteManyParams, RaRecord, Identifier } from 'react-admin';

export interface LoopbackDataProviderConfig {
  /**
   * Base URL of the LoopBack API
   * @example 'http://localhost:14000'
   */
  apiUrl: string;

  /**
   * Function to get the current auth token
   * Should return the JWT token or null if not authenticated
   */
  getToken: () => Promise<string | null>;

  /**
   * Optional resource name mapping
   * Maps React-Admin resource names to LoopBack endpoint paths
   * @example { users: 'tenant-users', invoices: 'invoices' }
   */
  resourceMap?: Record<string, string>;

  /**
   * Optional primary key field name (default: 'id')
   * Some LoopBack models use different primary key names
   */
  primaryKey?: string;

  /**
   * Enable console logging for debugging
   */
  enableLogging?: boolean;

  /**
   * Custom headers to include in all requests
   */
  customHeaders?: Record<string, string>;
}

/**
 * Convert React-Admin filter to LoopBack filter format
 *
 * LoopBack uses a JSON filter query parameter with this structure:
 * {
 *   where: { field: value, ... },
 *   order: ['field ASC'],
 *   limit: 10,
 *   offset: 0
 * }
 */
const buildLoopbackFilter = (
  params: GetListParams | GetManyReferenceParams,
  targetField?: string,
  targetValue?: Identifier
): string => {
  const { pagination, sort, filter } = params;
  const { page, perPage } = pagination;
  const { field, order } = sort;

  const loopbackFilter: {
    where?: Record<string, unknown>;
    order?: string[];
    limit?: number;
    offset?: number;
  } = {};

  // Build where clause
  const where: Record<string, unknown> = {};

  // Add target field for getManyReference
  if (targetField && targetValue !== undefined) {
    where[targetField] = targetValue;
  }

  // Add filter conditions
  if (filter && typeof filter === 'object') {
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        // Handle special filter operators
        if (typeof value === 'string' && value.includes('%')) {
          // LIKE pattern
          where[key] = { like: value.replace(/%/g, '%') };
        } else if (key === 'q' && typeof value === 'string') {
          // Full-text search - skip, handled separately if needed
        } else {
          where[key] = value;
        }
      }
    });
  }

  if (Object.keys(where).length > 0) {
    loopbackFilter.where = where;
  }

  // Add sorting
  if (field) {
    loopbackFilter.order = [`${field} ${order || 'ASC'}`];
  }

  // Add pagination
  loopbackFilter.limit = perPage;
  loopbackFilter.offset = (page - 1) * perPage;

  return JSON.stringify(loopbackFilter);
};

/**
 * Build URL with query parameters
 */
const buildUrl = (
  baseUrl: string,
  resource: string,
  params?: Record<string, string>
): string => {
  const url = new URL(`${baseUrl}/${resource}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }
  return url.toString();
};

/**
 * Create a LoopBack data provider
 */
export function createLoopbackDataProvider(
  config: LoopbackDataProviderConfig
): DataProvider {
  const {
    apiUrl,
    getToken,
    resourceMap = {},
    primaryKey = 'id',
    enableLogging = false,
    customHeaders = {},
  } = config;

  const log = (...args: unknown[]) => {
    if (enableLogging) {
      console.log('[LoopbackDataProvider]', ...args);
    }
  };

  const logError = (...args: unknown[]) => {
    console.error('[LoopbackDataProvider]', ...args);
  };

  /**
   * Get the API endpoint path for a resource
   */
  const getResourcePath = (resource: string): string => {
    return resourceMap[resource] || resource;
  };

  /**
   * Make an authenticated fetch request
   */
  const fetchWithAuth = async (
    url: string,
    options: RequestInit = {}
  ): Promise<Response> => {
    const token = await getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...customHeaders,
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    log('Fetching:', url, { method: options.method || 'GET', hasToken: !!token });

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorJson = JSON.parse(errorBody);
        errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
      } catch {
        // Use default error message
      }
      logError('Request failed:', errorMessage, { url, status: response.status });
      throw new Error(errorMessage);
    }

    return response;
  };

  /**
   * Parse response and extract data
   */
  const parseResponse = async <T>(response: Response): Promise<T> => {
    const text = await response.text();
    if (!text) {
      return {} as T;
    }
    return JSON.parse(text);
  };

  /**
   * Get total count from response headers or make a separate count request
   */
  const getTotal = async (resource: string, filter?: Record<string, unknown>): Promise<number> => {
    const resourcePath = getResourcePath(resource);
    const countFilter = filter ? JSON.stringify({ where: filter }) : undefined;
    const url = buildUrl(apiUrl, `${resourcePath}/count`, countFilter ? { filter: countFilter } : undefined);

    try {
      const response = await fetchWithAuth(url);
      const data = await parseResponse<{ count: number }>(response);
      return data.count || 0;
    } catch (error) {
      log('Count request failed, returning 0:', error);
      return 0;
    }
  };

  return {
    /**
     * Get a list of records
     */
    getList: async <RecordType extends RaRecord = RaRecord>(
      resource: string,
      params: GetListParams
    ): Promise<{ data: RecordType[]; total: number }> => {
      log('getList', { resource, params });

      const resourcePath = getResourcePath(resource);
      const filter = buildLoopbackFilter(params);
      const url = buildUrl(apiUrl, resourcePath, { filter });

      const response = await fetchWithAuth(url);
      const data = await parseResponse<RecordType[]>(response);

      // Get total count
      const whereFilter = params.filter && Object.keys(params.filter).length > 0
        ? params.filter
        : undefined;
      const total = await getTotal(resource, whereFilter);

      log('getList result', { resource, count: data.length, total });

      return {
        data: Array.isArray(data) ? data : [],
        total,
      };
    },

    /**
     * Get a single record by ID
     */
    getOne: async <RecordType extends RaRecord = RaRecord>(
      resource: string,
      params: GetOneParams<RecordType>
    ): Promise<{ data: RecordType }> => {
      log('getOne', { resource, id: params.id });

      const resourcePath = getResourcePath(resource);
      const url = `${apiUrl}/${resourcePath}/${params.id}`;

      const response = await fetchWithAuth(url);
      const data = await parseResponse<RecordType>(response);

      log('getOne result', { resource, id: params.id, hasData: !!data });

      return { data };
    },

    /**
     * Get multiple records by IDs
     */
    getMany: async <RecordType extends RaRecord = RaRecord>(
      resource: string,
      params: GetManyParams
    ): Promise<{ data: RecordType[] }> => {
      log('getMany', { resource, ids: params.ids });

      const resourcePath = getResourcePath(resource);
      const filter = JSON.stringify({
        where: { [primaryKey]: { inq: params.ids } },
      });
      const url = buildUrl(apiUrl, resourcePath, { filter });

      const response = await fetchWithAuth(url);
      const data = await parseResponse<RecordType[]>(response);

      log('getMany result', { resource, requested: params.ids.length, retrieved: data.length });

      return { data: Array.isArray(data) ? data : [] };
    },

    /**
     * Get records that reference a specific record
     */
    getManyReference: async <RecordType extends RaRecord = RaRecord>(
      resource: string,
      params: GetManyReferenceParams
    ): Promise<{ data: RecordType[]; total: number }> => {
      log('getManyReference', { resource, target: params.target, id: params.id });

      const resourcePath = getResourcePath(resource);
      const filter = buildLoopbackFilter(params, params.target, params.id);
      const url = buildUrl(apiUrl, resourcePath, { filter });

      const response = await fetchWithAuth(url);
      const data = await parseResponse<RecordType[]>(response);

      // Build where clause for count
      const whereFilter: Record<string, unknown> = { [params.target]: params.id };
      if (params.filter) {
        Object.assign(whereFilter, params.filter);
      }
      const total = await getTotal(resource, whereFilter);

      log('getManyReference result', { resource, count: data.length, total });

      return {
        data: Array.isArray(data) ? data : [],
        total,
      };
    },

    /**
     * Create a new record
     */
    create: async <RecordType extends RaRecord = RaRecord>(
      resource: string,
      params: CreateParams
    ): Promise<{ data: RecordType }> => {
      log('create', { resource, data: params.data });

      const resourcePath = getResourcePath(resource);
      const url = `${apiUrl}/${resourcePath}`;

      const response = await fetchWithAuth(url, {
        method: 'POST',
        body: JSON.stringify(params.data),
      });
      const data = await parseResponse<RecordType>(response);

      log('create result', { resource, id: data[primaryKey as keyof RecordType] });

      return { data };
    },

    /**
     * Update a record
     */
    update: async <RecordType extends RaRecord = RaRecord>(
      resource: string,
      params: UpdateParams<RecordType>
    ): Promise<{ data: RecordType }> => {
      log('update', { resource, id: params.id });

      const resourcePath = getResourcePath(resource);
      const url = `${apiUrl}/${resourcePath}/${params.id}`;

      // Use PATCH for partial updates (LoopBack convention)
      const response = await fetchWithAuth(url, {
        method: 'PATCH',
        body: JSON.stringify(params.data),
      });

      // LoopBack PATCH might not return the full object
      // Fetch the updated record to return complete data
      const getResponse = await fetchWithAuth(url);
      const data = await parseResponse<RecordType>(getResponse);

      log('update result', { resource, id: params.id });

      return { data };
    },

    /**
     * Update multiple records
     */
    updateMany: async (
      resource: string,
      params: UpdateManyParams
    ): Promise<{ data: Identifier[] }> => {
      log('updateMany', { resource, ids: params.ids });

      const resourcePath = getResourcePath(resource);

      // LoopBack doesn't have a built-in bulk update endpoint
      // Use updateAll with where clause or update individually
      const url = `${apiUrl}/${resourcePath}`;
      const filter = JSON.stringify({
        where: { [primaryKey]: { inq: params.ids } },
      });

      // Try updateAll endpoint (PATCH /resource?where=...)
      try {
        await fetchWithAuth(`${url}?${new URLSearchParams({ where: JSON.stringify({ [primaryKey]: { inq: params.ids } }) })}`, {
          method: 'PATCH',
          body: JSON.stringify(params.data),
        });
      } catch {
        // Fallback: update records individually
        await Promise.all(
          params.ids.map((id) =>
            fetchWithAuth(`${url}/${id}`, {
              method: 'PATCH',
              body: JSON.stringify(params.data),
            })
          )
        );
      }

      log('updateMany result', { resource, count: params.ids.length });

      return { data: params.ids };
    },

    /**
     * Delete a record
     */
    delete: async <RecordType extends RaRecord = RaRecord>(
      resource: string,
      params: DeleteParams<RecordType>
    ): Promise<{ data: RecordType }> => {
      log('delete', { resource, id: params.id });

      const resourcePath = getResourcePath(resource);
      const url = `${apiUrl}/${resourcePath}/${params.id}`;

      await fetchWithAuth(url, { method: 'DELETE' });

      log('delete result', { resource, id: params.id });

      // Return the previous data if available
      return { data: params.previousData as RecordType };
    },

    /**
     * Delete multiple records
     */
    deleteMany: async (
      resource: string,
      params: DeleteManyParams
    ): Promise<{ data: Identifier[] }> => {
      log('deleteMany', { resource, ids: params.ids });

      const resourcePath = getResourcePath(resource);

      // Delete records individually (LoopBack doesn't have bulk delete by default)
      await Promise.all(
        params.ids.map((id) =>
          fetchWithAuth(`${apiUrl}/${resourcePath}/${id}`, { method: 'DELETE' })
        )
      );

      log('deleteMany result', { resource, count: params.ids.length });

      return { data: params.ids };
    },
  };
}

export default createLoopbackDataProvider;
