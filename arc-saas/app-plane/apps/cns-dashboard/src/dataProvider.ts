/**
 * CNS Dashboard Data Provider
 *
 * SECURITY MODEL - KNOWN LIMITATION:
 * ==================================
 *
 * This data provider uses a static admin token (VITE_CNS_ADMIN_TOKEN) for CNS API calls.
 * Auth0 authenticates the UI, but API calls use the admin token header, not Auth0 tokens.
 *
 * CURRENT AUTHENTICATION FLOW:
 * 1. User logs in via Auth0 (organization membership enforced)
 * 2. CNS Dashboard loads with build-time admin token
 * 3. All API calls include: Authorization: Bearer <admin-token>
 * 4. CNS API validates static token (no Auth0 verification)
 *
 * RESIDUAL RISK:
 * - Anyone who discovers VITE_CNS_ADMIN_TOKEN can call CNS API directly
 * - No server-side Auth0 token validation
 * - Relies on UI-level Auth0 enforcement only
 *
 * MITIGATION OPTIONS:
 * 1. Enable Auth0 on CNS API (set AUTH0_ENABLED=true in docker-compose)
 * 2. CNS middleware already supports Auth0 RS256 validation (see auth_middleware.py)
 * 3. Update this dataProvider to use Auth0 access token instead of admin token
 *
 * TO ENABLE DEFENSE-IN-DEPTH:
 * - Set AUTH0_ENABLED=true on cns-service in docker-compose.yml
 * - CNS API will validate Auth0 tokens AND admin token
 * - Provides dual authentication layer
 *
 * This is a conscious trade-off: CNS is an internal platform staff tool,
 * admin token provides convenience, Auth0 UI prevents unauthorized access.
 */

import { DataProvider, fetchUtils } from 'react-admin';
import { stringify } from 'query-string';
import { CNS_API_URL, getAdminAuthHeaders } from './config/api';

// Use CNS_API_URL from config instead of hardcoded relative path
// This ensures correct routing whether behind Traefik or standalone
const apiUrl = CNS_API_URL;

// Custom HTTP client that includes admin Authorization header
const httpClient = (url: string, options: fetchUtils.Options = {}) => {
  const adminHeaders = getAdminAuthHeaders();
  const headers = new Headers(options.headers);

  // Add admin Authorization header if available
  if (adminHeaders && typeof adminHeaders === 'object' && 'Authorization' in adminHeaders) {
    headers.set('Authorization', String(adminHeaders.Authorization));
  }

  return fetchUtils.fetchJson(url, { ...options, headers });
};

// Gate logging - controlled by environment variable
const ENABLE_GATE_LOGGING = import.meta.env.VITE_ENABLE_GATE_LOGGING !== 'false';

const gateLog = (message: string, data?: any) => {
  if (ENABLE_GATE_LOGGING) {
    console.log(`[GATE: DataProvider] ${message}`, data || '');
  }
};

export const dataProvider: DataProvider = {
  getList: (resource, params) => {
    gateLog('getList started', { resource, params });
    const { page, perPage } = params.pagination;
    const { field, order } = params.sort;
    const query = {
      sort: JSON.stringify([field, order]),
      range: JSON.stringify([(page - 1) * perPage, page * perPage - 1]),
      filter: JSON.stringify(params.filter),
    };
    const url = `${apiUrl}/${resource}?${stringify(query)}`;

    return httpClient(url).then(({ headers, json }) => {
      gateLog('getList successful', { resource, count: json.length });
      return {
        data: json,
        total: parseInt(headers.get('content-range')?.split('/').pop() || '0', 10),
      };
    }).catch((error) => {
      gateLog('getList failed', { resource, error: error.message });
      throw error;
    });
  },

  getOne: (resource, params) => {
    gateLog('getOne started', { resource, id: params.id });
    return httpClient(`${apiUrl}/${resource}/${params.id}`).then(({ json }) => {
      gateLog('getOne successful', { resource, id: params.id });
      return { data: json };
    }).catch((error) => {
      gateLog('getOne failed', { resource, id: params.id, error: error.message });
      throw error;
    });
  },

  getMany: (resource, params) => {
    gateLog('getMany started', { resource, ids: params.ids });
    const query = {
      filter: JSON.stringify({ id: params.ids }),
    };
    const url = `${apiUrl}/${resource}?${stringify(query)}`;
    return httpClient(url).then(({ json }) => {
      gateLog('getMany successful', { resource, count: json.length });
      return { data: json };
    }).catch((error) => {
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
      gateLog('getManyReference successful', { resource, count: json.length });
      return {
        data: json,
        total: parseInt(headers.get('content-range')?.split('/').pop() || '0', 10),
      };
    }).catch((error) => {
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
      gateLog('create successful', { resource, id: json.id });
      return {
        data: { ...params.data, id: json.id } as any,
      };
    }).catch((error) => {
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
      return { data: json };
    }).catch((error) => {
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
      return { data: json };
    }).catch((error) => {
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
      return { data: json };
    }).catch((error) => {
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
      return { data: json };
    }).catch((error) => {
      gateLog('deleteMany failed', { resource, error: error.message });
      throw error;
    });
  },
};
