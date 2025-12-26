/**
 * Supabase Data Provider for React Admin
 *
 * Handles tenant-specific customer data with Row-Level Security (RLS)
 * Resources: components, boms, alerts
 */

import { createClient } from '@supabase/supabase-js';
import { supabaseDataProvider as createSupabaseDataProvider } from 'ra-supabase';

// Gate logging control via environment variable
const ENABLE_GATE_LOGGING = import.meta.env.VITE_ENABLE_GATE_LOGGING !== 'false';

// Option A: Direct Auth0 JWT to PostgREST (RS256 JWKS validation)
const USE_DIRECT_AUTH0_JWT = import.meta.env.VITE_USE_DIRECT_AUTH0_JWT === 'true';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'http://localhost:27540';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsImF1ZCI6ImF1dGhlbnRpY2F0ZWQiLCJzdWIiOiJhbm9ueW1vdXMiLCJyb2xlIjoiYW5vbiIsInJlZiI6ImxvY2FsaG9zdCIsImlhdCI6MTc2MjM3OTgwMywiZXhwIjoxOTIwMDU5ODAzfQ.j1nHQ-lkDL6slYZpBOuLCHSm40Uay_SHHHCv3fYYcWQ';

/**
 * Custom fetch for Supabase client that uses Auth0 JWT when in direct mode
 *
 * This is critical for Option A (direct Auth0 RS256 JWT):
 * - PostgREST is configured to validate Auth0 RS256 JWT via JWKS
 * - The Supabase client by default sends the anon key (HS256)
 * - We need to intercept requests and add the Auth0 JWT instead
 */
const customFetch: typeof fetch = async (url, options: RequestInit = {}) => {
  const headers = new Headers(options.headers);

  // Always include apikey for Kong gateway (identifies consumer)
  if (!headers.has('apikey')) {
    headers.set('apikey', SUPABASE_ANON_KEY);
  }

  // Option A: Use Auth0 JWT for Authorization if available
  if (USE_DIRECT_AUTH0_JWT) {
    const authMode = localStorage.getItem('auth_mode');
    const auth0Token = localStorage.getItem('auth0_access_token');

    if (authMode === 'auth0_direct' && auth0Token) {
      headers.set('Authorization', `Bearer ${auth0Token}`);
      if (import.meta.env.DEV) {
        console.log('[Supabase customFetch] Using Auth0 JWT for:', String(url).substring(0, 80));
      }
    }
  }

  return fetch(url, { ...options, headers });
};

/**
 * Supabase Client
 *
 * Configured with:
 * - Custom fetch to use Auth0 JWT (Option A)
 * - Auto token refresh (for Supabase auth fallback)
 * - Persistent sessions
 * - RLS enforcement
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  db: {
    schema: 'public',
  },
  global: {
    fetch: customFetch,
  },
});

// Safe startup log for quick config verification (dev only)
const masked = SUPABASE_ANON_KEY ? `${SUPABASE_ANON_KEY.slice(0, 8)}…` : 'none';
console.info('[Supabase] Base URL:', SUPABASE_URL, '| key:', masked, '(anon)');

/**
 * Supabase Data Provider
 *
 * Automatically handles:
 * - RLS filtering by tenant (tenant_id)
 * - Real-time subscriptions
 * - Optimistic updates
 * - Error handling
 */
const baseDataProvider = createSupabaseDataProvider({
  instanceUrl: SUPABASE_URL,
  apiKey: SUPABASE_ANON_KEY,
  supabaseClient: supabase,
});

/**
 * Wrapped Data Provider with Console Logging at Critical Gates
 */
export const supabaseDataProvider = {
  ...baseDataProvider,

  getList: async (resource: string, params: any) => {
    if (ENABLE_GATE_LOGGING) console.log('[GATE: DataProvider] getList started', { resource, params });
    try {
      const result = await baseDataProvider.getList(resource, params);
      if (ENABLE_GATE_LOGGING) console.log('[GATE: DataProvider] getList successful', {
        resource,
        count: result.data?.length || 0,
        total: result.total
      });
      return result;
    } catch (error: any) {
      if (ENABLE_GATE_LOGGING) console.error('[GATE: DataProvider] getList failed', {
        resource,
        error: error.message
      });
      throw error;
    }
  },

  getOne: async (resource: string, params: any) => {
    if (ENABLE_GATE_LOGGING) console.log('[GATE: DataProvider] getOne started', { resource, id: params.id });
    try {
      const result = await baseDataProvider.getOne(resource, params);
      if (ENABLE_GATE_LOGGING) console.log('[GATE: DataProvider] getOne successful', {
        resource,
        id: params.id,
        hasData: !!result.data
      });
      return result;
    } catch (error: any) {
      if (ENABLE_GATE_LOGGING) console.error('[GATE: DataProvider] getOne failed', {
        resource,
        id: params.id,
        error: error.message
      });
      throw error;
    }
  },

  getMany: async (resource: string, params: any) => {
    if (ENABLE_GATE_LOGGING) console.log('[GATE: DataProvider] getMany started', {
      resource,
      ids: params.ids,
      count: params.ids?.length || 0
    });
    try {
      const result = await baseDataProvider.getMany(resource, params);
      if (ENABLE_GATE_LOGGING) console.log('[GATE: DataProvider] getMany successful', {
        resource,
        requested: params.ids?.length || 0,
        retrieved: result.data?.length || 0
      });
      return result;
    } catch (error: any) {
      if (ENABLE_GATE_LOGGING) console.error('[GATE: DataProvider] getMany failed', {
        resource,
        error: error.message
      });
      throw error;
    }
  },

  getManyReference: async (resource: string, params: any) => {
    if (ENABLE_GATE_LOGGING) console.log('[GATE: DataProvider] getManyReference started', {
      resource,
      target: params.target,
      id: params.id
    });
    try {
      const result = await baseDataProvider.getManyReference(resource, params);
      if (ENABLE_GATE_LOGGING) console.log('[GATE: DataProvider] getManyReference successful', {
        resource,
        count: result.data?.length || 0
      });
      return result;
    } catch (error: any) {
      if (ENABLE_GATE_LOGGING) console.error('[GATE: DataProvider] getManyReference failed', {
        resource,
        error: error.message
      });
      throw error;
    }
  },

  create: async (resource: string, params: any) => {
    if (ENABLE_GATE_LOGGING) console.log('[GATE: DataProvider] create started', {
      resource,
      hasData: !!params.data
    });
    try {
      const result = await baseDataProvider.create(resource, params);
      if (ENABLE_GATE_LOGGING) console.log('[GATE: DataProvider] create successful', {
        resource,
        id: result.data?.id
      });
      return result;
    } catch (error: any) {
      if (ENABLE_GATE_LOGGING) console.error('[GATE: DataProvider] create failed', {
        resource,
        error: error.message
      });
      throw error;
    }
  },

  update: async (resource: string, params: any) => {
    if (ENABLE_GATE_LOGGING) console.log('[GATE: DataProvider] update started', {
      resource,
      id: params.id
    });
    try {
      const result = await baseDataProvider.update(resource, params);
      if (ENABLE_GATE_LOGGING) console.log('[GATE: DataProvider] update successful', {
        resource,
        id: params.id
      });
      return result;
    } catch (error: any) {
      if (ENABLE_GATE_LOGGING) console.error('[GATE: DataProvider] update failed', {
        resource,
        id: params.id,
        error: error.message
      });
      throw error;
    }
  },

  updateMany: async (resource: string, params: any) => {
    if (ENABLE_GATE_LOGGING) console.log('[GATE: DataProvider] updateMany started', {
      resource,
      ids: params.ids,
      count: params.ids?.length || 0
    });
    try {
      const result = await baseDataProvider.updateMany(resource, params);
      if (ENABLE_GATE_LOGGING) console.log('[GATE: DataProvider] updateMany successful', {
        resource,
        count: result.data?.length || 0
      });
      return result;
    } catch (error: any) {
      if (ENABLE_GATE_LOGGING) console.error('[GATE: DataProvider] updateMany failed', {
        resource,
        error: error.message
      });
      throw error;
    }
  },

  delete: async (resource: string, params: any) => {
    if (ENABLE_GATE_LOGGING) console.log('[GATE: DataProvider] delete started', {
      resource,
      id: params.id
    });
    try {
      const result = await baseDataProvider.delete(resource, params);
      if (ENABLE_GATE_LOGGING) console.log('[GATE: DataProvider] delete successful', {
        resource,
        id: params.id
      });
      return result;
    } catch (error: any) {
      if (ENABLE_GATE_LOGGING) console.error('[GATE: DataProvider] delete failed', {
        resource,
        id: params.id,
        error: error.message
      });
      throw error;
    }
  },

  deleteMany: async (resource: string, params: any) => {
    if (ENABLE_GATE_LOGGING) console.log('[GATE: DataProvider] deleteMany started', {
      resource,
      ids: params.ids,
      count: params.ids?.length || 0
    });
    try {
      const result = await baseDataProvider.deleteMany(resource, params);
      if (ENABLE_GATE_LOGGING) console.log('[GATE: DataProvider] deleteMany successful', {
        resource,
        count: result.data?.length || 0
      });
      return result;
    } catch (error: any) {
      if (ENABLE_GATE_LOGGING) console.error('[GATE: DataProvider] deleteMany failed', {
        resource,
        error: error.message
      });
      throw error;
    }
  },
};

/**
 * Helper: Get current user's organization
 */
export const getCurrentOrganization = async () => {
  if (ENABLE_GATE_LOGGING) console.log('[GATE: DataProvider] getCurrentOrganization started');

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    if (ENABLE_GATE_LOGGING) console.error('[GATE: DataProvider] getCurrentOrganization failed: Not authenticated');
    throw new Error('Not authenticated');
  }

  if (ENABLE_GATE_LOGGING) console.log('[GATE: DataProvider] Looking up tenant for user', { email: user.email });

  // Look up user's tenant from users
  const { data, error} = await supabase
    .from('users')
    .select('organization_id, organization:organizations(id, name, slug)')
    .eq('email', user.email)
    .single();

  if (error) {
    if (ENABLE_GATE_LOGGING) console.error('[GATE: DataProvider] getCurrentOrganization failed', { error: error.message });
    throw error;
  }

  if (ENABLE_GATE_LOGGING) console.log('[GATE: DataProvider] getCurrentOrganization successful', {
    tenantId: data.organization_id,
    tenantName: (data as any).tenant?.name
  });

  return data;
};

/**
 * Helper: Subscribe to real-time changes
 */
export const subscribeToChanges = (
  table: string,
  callback: (payload: any) => void
) => {
  if (ENABLE_GATE_LOGGING) console.log('[GATE: DataProvider] subscribeToChanges started', { table });

  const channel = supabase
    .channel(`public:${table}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      (payload) => {
        if (ENABLE_GATE_LOGGING) console.log('[GATE: DataProvider] Real-time change received', {
          table,
          event: payload.eventType,
          hasNew: !!payload.new,
          hasOld: !!payload.old
        });
        callback(payload);
      }
    )
    .subscribe((status) => {
      if (ENABLE_GATE_LOGGING) console.log('[GATE: DataProvider] Subscription status changed', { table, status });
    });

  if (ENABLE_GATE_LOGGING) console.log('[GATE: DataProvider] subscribeToChanges channel created', { table });

  return channel;
};
