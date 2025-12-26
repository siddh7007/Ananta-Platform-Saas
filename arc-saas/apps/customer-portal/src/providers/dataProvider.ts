import {
  DataProvider,
  BaseRecord,
  GetListParams,
  GetListResponse,
  GetOneParams,
  GetOneResponse,
  CreateParams,
  CreateResponse,
  UpdateParams,
  UpdateResponse,
  DeleteOneParams,
  DeleteOneResponse,
  GetManyParams,
  GetManyResponse,
  CustomParams,
  CustomResponse,
} from '@refinedev/core';
import { platformApi, cnsApi, supabaseApi } from '@/lib/axios';
import { AxiosInstance } from 'axios';

// NOTE: Field transformation (snake_case -> camelCase) is handled by axios interceptors
// in @/lib/axios.ts. cnsApi has transformResponse=true which auto-converts:
// - component_count -> lineCount
// - enriched_count -> enrichedCount
// - filename/file_name -> fileName
// - organization_id -> organizationId
// - etc.

/**
 * Create a Refine data provider for a given axios client
 * Handles standard CRUD operations with LoopBack/REST-style APIs
 */
function createLoopbackDataProvider(api: AxiosInstance, _name: string): DataProvider {
  return {
    getList: async <TData extends BaseRecord = BaseRecord>({
      resource,
      pagination,
      filters,
      sorters,
      meta,
    }: GetListParams): Promise<GetListResponse<TData>> => {
      const { current = 1, pageSize = 20, mode = 'server' } = pagination ?? {};

      // Build LoopBack-style filter object
      const filter: Record<string, unknown> = {};

      // Where clause from filters
      if (filters && filters.length > 0) {
        filter.where = {};
        for (const f of filters) {
          if ('field' in f && f.field) {
            const { field, operator, value } = f;
            switch (operator) {
              case 'eq':
                (filter.where as Record<string, unknown>)[field] = value;
                break;
              case 'ne':
                (filter.where as Record<string, unknown>)[field] = { neq: value };
                break;
              case 'lt':
                (filter.where as Record<string, unknown>)[field] = { lt: value };
                break;
              case 'gt':
                (filter.where as Record<string, unknown>)[field] = { gt: value };
                break;
              case 'lte':
                (filter.where as Record<string, unknown>)[field] = { lte: value };
                break;
              case 'gte':
                (filter.where as Record<string, unknown>)[field] = { gte: value };
                break;
              case 'contains':
                (filter.where as Record<string, unknown>)[field] = { like: `%${value}%` };
                break;
              case 'startswith':
                (filter.where as Record<string, unknown>)[field] = { like: `${value}%` };
                break;
              case 'endswith':
                (filter.where as Record<string, unknown>)[field] = { like: `%${value}` };
                break;
              case 'in':
                (filter.where as Record<string, unknown>)[field] = { inq: value };
                break;
              default:
                (filter.where as Record<string, unknown>)[field] = value;
            }
          }
        }
      }

      // Pagination
      if (mode === 'server') {
        filter.limit = pageSize;
        filter.skip = (current - 1) * pageSize;
      }

      // Sorting
      if (sorters && sorters.length > 0) {
        filter.order = sorters.map((s) => `${s.field} ${s.order.toUpperCase()}`);
      }

      // Include relations if specified in meta
      if (meta?.include) {
        filter.include = meta.include;
      }

      const url = `/${resource}`;
      const params: Record<string, string> = { filter: JSON.stringify(filter) };

      // Add query parameters from meta (for FastAPI-style APIs that need direct params)
      // This allows pages to pass organization_id, workspace_id, etc. via meta.queryParams
      if (meta?.queryParams && typeof meta.queryParams === 'object') {
        Object.entries(meta.queryParams).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            params[key] = String(value);
          }
        });
      }

      const response = await api.get(url, { params });

      // Handle different response formats
      let data: TData[];
      let total: number;

      if (Array.isArray(response.data)) {
        data = response.data;
        total = response.headers['x-total-count']
          ? parseInt(response.headers['x-total-count'], 10)
          : data.length;
      } else if (response.data?.data) {
        // Wrapped response: { data: [...], total: N }
        data = response.data.data;
        total = response.data.total ?? response.data.count ?? data.length;
      } else if (response.data?.items) {
        // FastAPI-style response: { items: [...], total: N }
        data = response.data.items;
        total = response.data.total ?? data.length;
      } else {
        data = [];
        total = 0;
      }

      // Field transformation handled by axios interceptor for cnsApi
      return { data: data as TData[], total };
    },

    getOne: async <TData extends BaseRecord = BaseRecord>({
      resource,
      id,
      meta,
    }: GetOneParams): Promise<GetOneResponse<TData>> => {
      const url = `/${resource}/${id}`;
      const params: Record<string, string> = {};

      if (meta?.include) {
        params.filter = JSON.stringify({ include: meta.include });
      }

      const response = await api.get(url, { params });

      // Handle wrapped or direct response
      // Field transformation handled by axios interceptor for cnsApi
      const data = response.data?.data ?? response.data;

      return { data };
    },

    getMany: async <TData extends BaseRecord = BaseRecord>({
      resource,
      ids,
      meta,
    }: GetManyParams): Promise<GetManyResponse<TData>> => {
      const filter: Record<string, unknown> = {
        where: { id: { inq: ids } },
      };

      if (meta?.include) {
        filter.include = meta.include;
      }

      const url = `/${resource}`;
      const params = { filter: JSON.stringify(filter) };

      const response = await api.get(url, { params });

      // Field transformation handled by axios interceptor for cnsApi
      const data = Array.isArray(response.data)
        ? response.data
        : response.data?.data ?? [];

      return { data };
    },

    create: async <TData extends BaseRecord = BaseRecord, TVariables = object>({
      resource,
      variables,
      meta: _meta,
    }: CreateParams<TVariables>): Promise<CreateResponse<TData>> => {
      const url = `/${resource}`;
      const response = await api.post(url, variables);

      const data = response.data?.data ?? response.data;

      return { data };
    },

    update: async <TData extends BaseRecord = BaseRecord, TVariables = object>({
      resource,
      id,
      variables,
      meta: _meta,
    }: UpdateParams<TVariables>): Promise<UpdateResponse<TData>> => {
      const url = `/${resource}/${id}`;
      const response = await api.patch(url, variables);

      const data = response.data?.data ?? response.data;

      return { data };
    },

    deleteOne: async <TData extends BaseRecord = BaseRecord, TVariables = object>({
      resource,
      id,
      meta: _meta,
    }: DeleteOneParams<TVariables>): Promise<DeleteOneResponse<TData>> => {
      const url = `/${resource}/${id}`;
      const response = await api.delete(url);

      const data = response.data?.data ?? response.data ?? { id };

      return { data };
    },

    getApiUrl: () => api.defaults.baseURL ?? '',

    custom: async <TData extends BaseRecord = BaseRecord, TQuery = unknown, TPayload = unknown>({
      url,
      method,
      filters: _filters,
      sorters: _sorters,
      payload,
      query,
      headers,
      meta: _meta,
    }: CustomParams<TQuery, TPayload>): Promise<CustomResponse<TData>> => {
      const requestConfig: Record<string, unknown> = {
        method,
        url,
      };

      if (headers) {
        requestConfig.headers = headers;
      }

      if (query) {
        requestConfig.params = query;
      }

      if (payload) {
        requestConfig.data = payload;
      }

      const response = await api.request(requestConfig);

      const data = response.data?.data ?? response.data;

      return { data };
    },
  };
}

/**
 * Platform API data provider (tenant-management-service)
 * Used for: tenants, subscriptions, plans, users, invitations, billing
 */
export const platformDataProvider = createLoopbackDataProvider(platformApi, 'platform');

/**
 * CNS API data provider (cns-service)
 * Used for: BOMs, BOM line items, enrichment, components
 */
export const cnsDataProvider = createLoopbackDataProvider(cnsApi, 'cns');

/**
 * Supabase/Component DB data provider
 * Used for: read-only component catalog lookups
 */
export const supabaseDataProvider = createLoopbackDataProvider(supabaseApi, 'supabase');

/**
 * Multi-provider setup for Refine
 * Routes resources to appropriate backend based on resource name
 */
export const dataProviders = {
  default: platformDataProvider,
  platform: platformDataProvider,
  cns: cnsDataProvider,
  supabase: supabaseDataProvider,
};

/**
 * Resource to provider mapping
 */
export const resourceProviderMap: Record<string, keyof typeof dataProviders> = {
  // Platform resources (tenant-management-service)
  tenants: 'platform',
  subscriptions: 'platform',
  plans: 'platform',
  users: 'platform',
  'user-invitations': 'platform',
  roles: 'platform',
  settings: 'platform',
  invoices: 'platform',

  // CNS resources (cns-service handles workspaces, projects, BOMs)
  workspaces: 'cns',
  projects: 'cns',
  boms: 'cns',
  'bom-line-items': 'cns',
  enrichment: 'cns',
  alerts: 'cns',
  risk: 'cns',

  // Component catalog (supabase/postgrest)
  components: 'supabase',
  manufacturers: 'supabase',
  categories: 'supabase',
};

/**
 * Get the appropriate data provider for a resource
 * Supports both exact matches and nested resource paths like 'boms/{id}/line-items'
 */
export function getProviderForResource(resource: string): DataProvider {
  // First try exact match
  if (resourceProviderMap[resource]) {
    return dataProviders[resourceProviderMap[resource]];
  }

  // For nested resources like 'boms/xxx/line-items', check if parent resource maps to a provider
  // This handles dynamic paths like 'boms/{bomId}/line-items'
  const parts = resource.split('/');
  if (parts.length > 0) {
    const parentResource = parts[0];
    if (resourceProviderMap[parentResource]) {
      return dataProviders[resourceProviderMap[parentResource]];
    }
  }

  // Default fallback
  return dataProviders['default'];
}

export default platformDataProvider;
