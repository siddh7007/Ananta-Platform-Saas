/**
 * Django Backend Data Provider
 *
 * Handles complex business logic that requires backend processing:
 * - BOM upload and parsing
 * - Component auto-matching
 * - Risk analysis and grading
 * - Vendor API integration
 */

import { DataProvider } from 'react-admin';
import { supabase } from './supabaseDataProvider';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:27200';

/**
 * Get authentication token from Supabase session
 * Uses the same Supabase instance that Auth0 middleware sets the session on
 */
const getToken = async (): Promise<string | null> => {
  // First try localStorage (set by Auth0 direct JWT mode)
  const auth0Token = localStorage.getItem('auth0_access_token');
  if (auth0Token) {
    return auth0Token;
  }

  // Fall back to Supabase session (set by middleware after Auth0 login)
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
};

/**
 * Helper to get auth headers
 */
const getAuthHeaders = async () => {
  const token = await getToken();
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

/**
 * Django Backend Data Provider
 *
 * For resources that need complex backend processing
 */
export const djangoDataProvider: DataProvider = {
  getList: async (resource, params) => {
    const { page, perPage } = params.pagination;
    const { field, order } = params.sort;

    const query = {
      page: page.toString(),
      page_size: perPage.toString(),
      ordering: `${order === 'DESC' ? '-' : ''}${field}`,
      ...params.filter,
    };

    const url = `${BACKEND_URL}/api/${resource}/?${new URLSearchParams(query)}`;
    const token = await getToken();

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();

    return {
      data: json.results || json,
      total: json.count || json.length,
    };
  },

  getOne: async (resource, params) => {
    const url = `${BACKEND_URL}/api/${resource}/${params.id}/`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${await getToken()}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return { data: await response.json() };
  },

  getMany: async (resource, params) => {
    const query = {
      id__in: params.ids.join(','),
    };

    const url = `${BACKEND_URL}/api/${resource}/?${new URLSearchParams(query)}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${await getToken()}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();
    return { data: json.results || json };
  },

  getManyReference: async (resource, params) => {
    const { page, perPage } = params.pagination;
    const { field, order } = params.sort;

    const query = {
      [params.target]: params.id,
      page: page.toString(),
      page_size: perPage.toString(),
      ordering: `${order === 'DESC' ? '-' : ''}${field}`,
      ...params.filter,
    };

    const url = `${BACKEND_URL}/api/${resource}/?${new URLSearchParams(query)}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${await getToken()}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();

    return {
      data: json.results || json,
      total: json.count || json.length,
    };
  },

  create: async (resource, params) => {
    // Special handling for BOM upload
    if (resource === 'boms' && params.data.file) {
      return uploadBOM(params.data);
    }

    const url = `${BACKEND_URL}/api/${resource}/`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${await getToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params.data),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return { data: await response.json() };
  },

  update: async (resource, params) => {
    const url = `${BACKEND_URL}/api/${resource}/${params.id}/`;

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${await getToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params.data),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return { data: await response.json() };
  },

  updateMany: async (resource, params) => {
    const token = await getToken();
    const results = await Promise.all(
      params.ids.map(id =>
        fetch(`${BACKEND_URL}/api/${resource}/${id}/`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(params.data),
        })
      )
    );

    return { data: params.ids };
  },

  delete: async (resource, params) => {
    const url = `${BACKEND_URL}/api/${resource}/${params.id}/`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${await getToken()}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return { data: params.previousData };
  },

  deleteMany: async (resource, params) => {
    const token = await getToken();
    await Promise.all(
      params.ids.map(id =>
        fetch(`${BACKEND_URL}/api/${resource}/${id}/`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })
      )
    );

    return { data: params.ids };
  },
};

/**
 * Upload BOM file for processing
 *
 * Backend will:
 * 1. Parse the file (CSV/Excel)
 * 2. Extract component data
 * 3. Auto-match with component database
 * 4. Calculate risk scores
 * 5. Grade the BOM (A-F)
 * 6. Return BOM with all line items
 */
const uploadBOM = async (data: any) => {
  const formData = new FormData();
  formData.append('file', data.file.rawFile);
  formData.append('name', data.name);

  if (data.description) {
    formData.append('description', data.description);
  }

  const response = await fetch(`${BACKEND_URL}/api/boms/upload/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${await getToken()}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || `HTTP ${response.status}: ${response.statusText}`);
  }

  return { data: await response.json() };
};

/**
 * Trigger BOM analysis
 *
 * Re-analyze BOM with latest component data and pricing
 */
export const analyzeBOM = async (bomId: string) => {
  const response = await fetch(`${BACKEND_URL}/api/boms/${bomId}/analyze/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${await getToken()}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.json();
};

/**
 * Get component alternatives
 *
 * Find alternative components for a given part
 */
export const getComponentAlternatives = async (componentId: string) => {
  const response = await fetch(
    `${BACKEND_URL}/api/components/${componentId}/alternatives/`,
    {
      headers: {
        'Authorization': `Bearer ${await getToken()}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.json();
};
