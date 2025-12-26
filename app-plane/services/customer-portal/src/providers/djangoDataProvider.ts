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
import { supabase } from './dataProvider';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:27200';

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

    const token = (await supabase.auth.getSession()).data.session?.access_token;
    const response = await fetch(url, {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
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

    const token = (await supabase.auth.getSession()).data.session?.access_token;
    const response = await fetch(url, {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
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

    const token = (await supabase.auth.getSession()).data.session?.access_token;
    const response = await fetch(url, {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
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

    const token = (await supabase.auth.getSession()).data.session?.access_token;
    const response = await fetch(url, {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
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

    const token = (await supabase.auth.getSession()).data.session?.access_token;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
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

    const token = (await supabase.auth.getSession()).data.session?.access_token;
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
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
    const results = await Promise.all(
      params.ids.map(id =>
        fetch(`${BACKEND_URL}/api/${resource}/${id}/`, {
          method: 'PATCH',
          headers: {
            // Optional: forward Supabase session token if backend accepts it
            
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

    const token = (await supabase.auth.getSession()).data.session?.access_token;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return { data: params.previousData };
  },

  deleteMany: async (resource, params) => {
    await Promise.all(
      params.ids.map(id =>
        fetch(`${BACKEND_URL}/api/${resource}/${id}/`, {
          method: 'DELETE',
          headers: {},
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

  const token = (await supabase.auth.getSession()).data.session?.access_token;
  const response = await fetch(`${BACKEND_URL}/api/boms/upload/`, {
    method: 'POST',
    headers: {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
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
  const token2 = (await supabase.auth.getSession()).data.session?.access_token;
  const response = await fetch(`${BACKEND_URL}/api/boms/${bomId}/analyze/`, {
    method: 'POST',
    headers: {
      ...(token2 ? { 'Authorization': `Bearer ${token2}` } : {}),
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
  const token3 = (await supabase.auth.getSession()).data.session?.access_token;
  const response = await fetch(
    `${BACKEND_URL}/api/components/${componentId}/alternatives/`,
    {
      headers: {
        ...(token3 ? { 'Authorization': `Bearer ${token3}` } : {}),
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.json();
};
