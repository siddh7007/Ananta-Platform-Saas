/**
 * CNS Dashboard Data Provider
 *
 * SECURITY MODEL - KNOWN LIMITATION:
 * ==================================
 *
 * This data provider uses staff auth tokens (Keycloak/Auth0) for CNS API calls.
 * UI auth and API auth are now aligned to the same identity provider.
 *
 * CURRENT AUTHENTICATION FLOW:
 * 1. User logs in via Keycloak or Auth0 (organization membership enforced)
 * 2. CNS Dashboard uses the access token for API calls
 * 3. All API calls include: Authorization: Bearer <access-token>
 * 4. CNS API validates the JWT
 *
 * RESIDUAL RISK:
 * - Token validation depends on CNS API JWT middleware configuration
 *
 * MITIGATION OPTIONS:
 * 1. Enable Auth0 on CNS API (set AUTH0_ENABLED=true in docker-compose)
 * 2. CNS middleware already supports Auth0 RS256 validation (see auth_middleware.py)
 * 3. Keep dataProvider aligned with staff access tokens (Keycloak/Auth0)
 *
 * TO ENABLE DEFENSE-IN-DEPTH:
 * - Set AUTH0_ENABLED=true on cns-service in docker-compose.yml
 * - CNS API will validate staff access tokens
 *
 * This is a conscious trade-off: CNS is an internal platform staff tool,
 * Staff access tokens are now required for both UI and API access.
 */

import { DataProvider, fetchUtils, RaRecord } from 'react-admin';
import { stringify } from 'query-string';
import { CNS_API_URL, getAuthHeadersAsync } from './config/api';
import { AdminRecord } from './types/api';

// Use CNS_API_URL from config instead of hardcoded relative path
// This ensures correct routing whether behind Traefik or standalone
const apiUrl = CNS_API_URL;

/**
 * Resource to API endpoint mapping
 * Some React Admin resources map to different API endpoints
 */
const RESOURCE_ENDPOINT_MAP: Record<string, string> = {
  // bom_line_items Resource maps to /admin/line-items endpoint
  'bom_line_items': 'admin/line-items',
};

/**
 * Get the API endpoint path for a resource
 */
const getResourceEndpoint = (resource: string): string => {
  return RESOURCE_ENDPOINT_MAP[resource] || resource;
};

// Custom HTTP client that includes staff Authorization header
const httpClient = async (url: string, options: fetchUtils.Options = {}) => {
  const authHeaders = await getAuthHeadersAsync();
  const headers = new Headers(options.headers);

  if (authHeaders && typeof authHeaders === 'object' && 'Authorization' in authHeaders) {
    headers.set('Authorization', String(authHeaders.Authorization));
  }

  return fetchUtils.fetchJson(url, { ...options, headers });
};

// Gate logging - controlled by environment variable
const ENABLE_GATE_LOGGING = import.meta.env.VITE_ENABLE_GATE_LOGGING !== 'false';

const gateLog = (message: string, data?: unknown) => {
  if (ENABLE_GATE_LOGGING) {
    console.log(`[GATE: DataProvider] ${message}`, data || '');
  }
};

export const dataProvider: DataProvider = {
  getList: (resource, params) => {
    gateLog('getList started', { resource, params });
    const { page, perPage } = params.pagination;
    const { field, order } = params.sort;
    const endpoint = getResourceEndpoint(resource);

    // Special handling for admin/line-items endpoint (uses different query params)
    if (endpoint === 'admin/line-items') {
      const query: Record<string, string | number> = {
        limit: perPage,
        offset: (page - 1) * perPage,
      };
      // Map React Admin filters to API query params
      if (params.filter) {
        if (params.filter.bom_id) query.bom_id = params.filter.bom_id;
        if (params.filter.organization_id) query.organization_id = params.filter.organization_id;
        if (params.filter.manufacturer_part_number) query.search = params.filter.manufacturer_part_number;
        if (params.filter.manufacturer) query.search = params.filter.manufacturer;
      }
      const url = `${apiUrl}/${endpoint}?${stringify(query)}`;

      // First get count, then get items (parallel requests)
      return Promise.all([
        httpClient(url),
        httpClient(`${apiUrl}/${endpoint}/count?${stringify({
          bom_id: query.bom_id,
          organization_id: query.organization_id,
          search: query.search,
        })}`),
      ]).then(([listResponse, countResponse]) => {
        const items = listResponse.json as AdminRecord[];
        const countData = countResponse.json as { total: number };
        gateLog('getList successful (admin/line-items)', { resource, count: items.length, total: countData.total });
        return {
          data: items,
          total: countData.total,
        };
      }).catch((error: Error) => {
        gateLog('getList failed (admin/line-items)', { resource, error: error.message });
        throw error;
      });
    }

    // Standard React Admin query format for other resources
    const query = {
      sort: JSON.stringify([field, order]),
      range: JSON.stringify([(page - 1) * perPage, page * perPage - 1]),
      filter: JSON.stringify(params.filter),
    };
    const url = `${apiUrl}/${endpoint}?${stringify(query)}`;

    return httpClient(url).then(({ headers, json }) => {
      gateLog('getList successful', { resource, count: Array.isArray(json) ? json.length : 0 });
      return {
        data: json as AdminRecord[],
        total: parseInt(headers.get('content-range')?.split('/').pop() || '0', 10),
      };
    }).catch((error: Error) => {
      gateLog('getList failed', { resource, error: error.message });
      throw error;
    });
  },

  getOne: (resource, params) => {
    gateLog('getOne started', { resource, id: params.id });
    const endpoint = getResourceEndpoint(resource);

    // admin/line-items has a dedicated get-by-id endpoint: GET /admin/line-items/{item_id}
    const url = `${apiUrl}/${endpoint}/${params.id}`;

    return httpClient(url).then(({ json }) => {
      gateLog('getOne successful', { resource, id: params.id });
      return { data: json as AdminRecord };
    }).catch((error: Error) => {
      gateLog('getOne failed', { resource, id: params.id, error: error.message });
      throw error;
    });
  },

  getMany: (resource, params) => {
    gateLog('getMany started', { resource, ids: params.ids });
    const endpoint = getResourceEndpoint(resource);

    // For admin/line-items, fetch each item individually (no bulk get endpoint)
    if (endpoint === 'admin/line-items') {
      const promises = params.ids.map(id =>
        httpClient(`${apiUrl}/${endpoint}/${id}`).then(({ json }) => json as AdminRecord)
      );
      return Promise.all(promises).then(items => {
        gateLog('getMany successful (admin/line-items)', { resource, count: items.length });
        return { data: items };
      }).catch((error: Error) => {
        gateLog('getMany failed (admin/line-items)', { resource, error: error.message });
        throw error;
      });
    }

    const query = {
      filter: JSON.stringify({ id: params.ids }),
    };
    const url = `${apiUrl}/${endpoint}?${stringify(query)}`;
    return httpClient(url).then(({ json }) => {
      gateLog('getMany successful', { resource, count: Array.isArray(json) ? json.length : 0 });
      return { data: json as AdminRecord[] };
    }).catch((error: Error) => {
      gateLog('getMany failed', { resource, error: error.message });
      throw error;
    });
  },

  getManyReference: (resource, params) => {
    gateLog('getManyReference started', { resource, target: params.target, id: params.id });
    const { page, perPage } = params.pagination;
    const { field, order } = params.sort;
    const query = {
      sort: JSON.stringify([field, order]),
      range: JSON.stringify([(page - 1) * perPage, page * perPage - 1]),
      filter: JSON.stringify({
        ...params.filter,
        [params.target]: params.id,
      }),
    };
    const url = `${apiUrl}/${resource}?${stringify(query)}`;

    return httpClient(url).then(({ headers, json }) => {
      gateLog('getManyReference successful', { resource, count: Array.isArray(json) ? json.length : 0 });
      return {
        data: json as AdminRecord[],
        total: parseInt(headers.get('content-range')?.split('/').pop() || '0', 10),
      };
    }).catch((error: Error) => {
      gateLog('getManyReference failed', { resource, error: error.message });
      throw error;
    });
  },

  create: (resource, params) => {
    gateLog('create started', { resource, data: params.data });
    return httpClient(`${apiUrl}/${resource}`, {
      method: 'POST',
      body: JSON.stringify(params.data),
    }).then(({ json }) => {
      gateLog('create successful', { resource, id: (json as RaRecord).id });
      return {
        data: { ...params.data, id: (json as RaRecord).id } as AdminRecord,
      };
    }).catch((error: Error) => {
      gateLog('create failed', { resource, error: error.message });
      throw error;
    });
  },

  update: (resource, params) => {
    gateLog('update started', { resource, id: params.id });
    return httpClient(`${apiUrl}/${resource}/${params.id}`, {
      method: 'PUT',
      body: JSON.stringify(params.data),
    }).then(({ json }) => {
      gateLog('update successful', { resource, id: params.id });
      return { data: json as AdminRecord };
    }).catch((error: Error) => {
      gateLog('update failed', { resource, id: params.id, error: error.message });
      throw error;
    });
  },

  updateMany: (resource, params) => {
    gateLog('updateMany started', { resource, ids: params.ids });
    const query = {
      filter: JSON.stringify({ id: params.ids }),
    };
    return httpClient(`${apiUrl}/${resource}?${stringify(query)}`, {
      method: 'PUT',
      body: JSON.stringify(params.data),
    }).then(({ json }) => {
      gateLog('updateMany successful', { resource, count: params.ids.length });
      return { data: json as AdminRecord[] };
    }).catch((error: Error) => {
      gateLog('updateMany failed', { resource, error: error.message });
      throw error;
    });
  },

  delete: (resource, params) => {
    gateLog('delete started', { resource, id: params.id });
    return httpClient(`${apiUrl}/${resource}/${params.id}`, {
      method: 'DELETE',
    }).then(({ json }) => {
      gateLog('delete successful', { resource, id: params.id });
      return { data: json as AdminRecord };
    }).catch((error: Error) => {
      gateLog('delete failed', { resource, id: params.id, error: error.message });
      throw error;
    });
  },

  deleteMany: (resource, params) => {
    gateLog('deleteMany started', { resource, ids: params.ids });
    const query = {
      filter: JSON.stringify({ id: params.ids }),
    };
    return httpClient(`${apiUrl}/${resource}?${stringify(query)}`, {
      method: 'DELETE',
    }).then(({ json }) => {
      gateLog('deleteMany successful', { resource, count: params.ids.length });
      return { data: json as AdminRecord[] };
    }).catch((error: Error) => {
      gateLog('deleteMany failed', { resource, error: error.message });
      throw error;
    });
  },
};
