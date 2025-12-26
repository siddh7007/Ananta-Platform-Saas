/**
 * Data Provider - Supabase Integration with Auth0
 *
 * ============================================================================
 * AUTHENTICATION CONFIGURATION SWITCHES
 * ============================================================================
 *
 * 1. VITE_USE_DIRECT_AUTH0_JWT (docker-compose.yml)
 *    - 'true':  Option A - Send Auth0 JWT directly to Supabase PostgREST
 *               Requires PostgREST JWKS configuration for RS256 validation
 *    - 'false': Option B (CURRENT) - Middleware creates Supabase JWT session
 *               More reliable, works with standard Supabase auth
 *
 * 2. auth_mode (localStorage) - Set by auth provider on login
 *    - 'auth0_direct': Using direct Auth0 JWT (Option A)
 *    - 'supabase_jwt': Using middleware session (Option B)
 *    NOTE: Stale auth_mode values are auto-cleaned on startup if they don't
 *          match the build configuration (USE_DIRECT_AUTH0_JWT)
 *
 * 3. VITE_AUTH_PROVIDER (.env)
 *    - 'auth0':    Use Auth0 for authentication (current)
 *    - 'supabase': Use Supabase Auth directly
 *    - 'keycloak': Use Keycloak SSO
 *
 * Flow (Option B - Current):
 *   1. User logs in via Auth0
 *   2. createAuth0AuthProvider calls middleware /auth/create-supabase-session
 *   3. Middleware creates user in DB, generates Supabase JWT
 *   4. Frontend sets Supabase session with the JWT
 *   5. DataProvider uses Supabase session for all API calls
 *
 * ============================================================================
 */

import { DataProvider } from 'react-admin';
import { createClient } from '@supabase/supabase-js';
import { getAuth0State } from '../lib/auth';

// Supabase configuration - MUST be set via environment variables
// No hardcoded fallbacks to ensure proper configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
if (!supabaseUrl) {
  console.error('[Supabase] VITE_SUPABASE_URL is not set. Please configure it in .env');
}

// Single-app dev/prod gating: prefer service key only when explicitly enabled
const DEV_AUTH_BYPASS_ENABLED = [
  String(import.meta.env.VITE_DEV_AUTH_BYPASS_ENABLED ?? ''),
  String(import.meta.env.VITE_DEV_BYPASS_ENABLED ?? ''),
]
  .map(v => v.toLowerCase())
  .includes('true');

const supabaseKey =
  (DEV_AUTH_BYPASS_ENABLED && import.meta.env.VITE_SUPABASE_SERVICE_KEY)
    ? import.meta.env.VITE_SUPABASE_SERVICE_KEY
    : import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('[Supabase] VITE_SUPABASE_ANON_KEY is not set. Please configure it in .env');
}

/**
 * Custom fetch function for Option A: Direct Auth0 JWT with Supabase PostgREST
 *
 * Flow:
 * - Unauthenticated: Remove Authorization header → PostgREST uses anon role
 * - Authenticated: Send Auth0 JWT → PostgREST validates via JWKS (RS256)
 *
 * Note: Supabase client by default sends anon key as Authorization header,
 * which fails RS256 validation. We intercept to either remove it or replace with Auth0 JWT.
 *
 * IMPORTANT: We use getAccessTokenSilently() instead of localStorage to ensure
 * the token is always fresh. Auth0 SDK auto-refreshes expired tokens.
 */
const USE_DIRECT_AUTH0_JWT = import.meta.env.VITE_USE_DIRECT_AUTH0_JWT === 'true';

// Cleanup stale auth_mode on startup if build config doesn't match
// This prevents issues when switching between direct JWT and middleware modes
if (!USE_DIRECT_AUTH0_JWT) {
  const staleAuthMode = localStorage.getItem('auth_mode');
  if (staleAuthMode === 'auth0_direct') {
    console.info('[DataProvider] Clearing stale auth_mode=auth0_direct (build config: middleware mode)');
    localStorage.removeItem('auth_mode');
    localStorage.removeItem('auth0_access_token');
  }
}

const customFetch: typeof fetch = async (url, options: RequestInit = {}) => {
  const authMode = localStorage.getItem('auth_mode');
  const headers = new Headers(options.headers);

  // CRITICAL: Always ensure apikey header is present for Kong gateway
  // Kong requires apikey header to identify the consumer (anon/service_role)
  // This is separate from the Authorization header which PostgREST validates
  if (!headers.has('apikey')) {
    headers.set('apikey', supabaseKey);
  }

  // Option A: Direct Auth0 JWT flow
  // IMPORTANT: Only use direct Auth0 JWT if BOTH build config AND localStorage agree
  // This prevents stale localStorage values from overriding the build config
  if (USE_DIRECT_AUTH0_JWT && authMode === 'auth0_direct') {
    const auth0State = getAuth0State();

    // Try to get fresh token using getAccessTokenSilently (auto-refreshes if needed)
    if (auth0State.getAccessTokenSilently) {
      try {
        const freshToken = await auth0State.getAccessTokenSilently();
        headers.set('Authorization', `Bearer ${freshToken}`);

        // Update localStorage with fresh token for other parts of the app
        localStorage.setItem('auth0_access_token', freshToken);

        if (import.meta.env.DEV) {
          console.log('[DataProvider] Using fresh Auth0 JWT for request:', String(url).substring(0, 80));
        }
      } catch (err) {
        // Token refresh failed - user may need to re-login
        console.error('[DataProvider] Failed to refresh Auth0 token:', err);

        // Fallback to cached token (might be expired, but let PostgREST decide)
        const cachedToken = localStorage.getItem('auth0_access_token');
        if (cachedToken) {
          headers.set('Authorization', `Bearer ${cachedToken}`);
          console.warn('[DataProvider] Using cached Auth0 token (may be expired)');
        } else {
          // No token available - remove Authorization header for anon access
          headers.delete('Authorization');
          console.warn('[DataProvider] No Auth0 token available, using anon access');
        }
      }
    } else {
      // getAccessTokenSilently not ready yet (Auth0 still initializing)
      // Fallback to cached token from localStorage
      const cachedToken = localStorage.getItem('auth0_access_token');
      if (cachedToken) {
        headers.set('Authorization', `Bearer ${cachedToken}`);

        if (import.meta.env.DEV) {
          console.log('[DataProvider] Using cached Auth0 JWT (SDK not ready):', String(url).substring(0, 80));
        }
      } else {
        // No token available - remove Authorization header for anon access
        headers.delete('Authorization');

        if (import.meta.env.DEV) {
          console.log('[DataProvider] No Auth0 token, using anon access');
        }
      }
    }
  } else if (USE_DIRECT_AUTH0_JWT) {
    // Option A is enabled but auth_mode not set yet (user not authenticated)
    // Remove Authorization header so PostgREST uses anon role
    headers.delete('Authorization');

    if (import.meta.env.DEV) {
      console.log('[DataProvider] Auth0 direct mode but not authenticated, using anon access');
    }
  }
  // else: Default Supabase auth flow - keep headers as-is (Supabase session manages tokens)

  return fetch(url, {
    ...options,
    headers,
  });
};

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: customFetch,
  },
});

// Safe startup log for quick config verification
try {
  const masked = supabaseKey ? `${supabaseKey.slice(0, 8)}…` : 'none';
  console.info('[Supabase] Base URL:', supabaseUrl, '| key:', masked, DEV_AUTH_BYPASS_ENABLED ? '(service-role)' : '(anon)');
} catch {}

// Debug: Log auth state changes
if (import.meta.env.DEV) {
  supabase.auth.onAuthStateChange((event, session) => {
    console.log('[Supabase Auth]', event, session ? `User: ${session.user.email}` : 'No session');
  });
}

const RESOURCE_MAP: Record<string, string> = {
  organizations: 'organizations',
  users: 'users',
  projects: 'projects',
  boms: 'boms',
  bom_line_items: 'bom_line_items',
  bom_jobs: 'bom_jobs',
  alerts: 'alerts',
};

const TENANT_FILTER_COLUMN: Record<string, string> = {
  // Limit organizations to the current tenant's org
  organizations: 'id',
  users: 'organization_id',
  projects: 'organization_id',
  boms: 'organization_id',
  alerts: 'organization_id',
};

const getTableName = (resource: string) => RESOURCE_MAP[resource] || resource;

/**
 * CACHE MANAGEMENT - Using shared cache manager instance
 *
 * SECURITY FIX: Import from shared cacheManager.ts to ensure auth0AuthProvider
 * and dataProvider use the SAME cache instance. This prevents the cache leak
 * vulnerability where logout would only clear one cache, leaving tenant/admin
 * data in the other cache for the next user.
 *
 * The single cache instance is created in cacheManager.ts and shared across
 * both auth0AuthProvider.ts and dataProvider.ts.
 */
import {
  getCachedTenantId,
  setCachedTenantId,
  getCachedSuperAdmin,
  setCachedSuperAdmin,
} from './cacheManager';

/**
 * Get Current Tenant ID - Unified Approach
 *
 * IMPORTANT: This implements the unified tenant_id = organization_id strategy.
 * When a tenant is provisioned in the Control Plane, the App Plane webhook
 * handler creates an organization with id = tenantId.
 *
 * Priority order:
 * 1. Check cache (fast path)
 * 2. Check localStorage 'tenant_id' (set by Keycloak auth provider)
 * 3. Check Supabase user metadata for organization_id
 * 4. Fallback to mock auth localStorage
 * 5. Final fallback: lookup by email in users table
 *
 * With the unified ID approach (tenant_id === organization_id), steps 2 and 3
 * will return the same value, making queries consistent across Control Plane
 * and App Plane.
 */
const getCurrentTenantId = async (): Promise<string | null> => {
  const cached = getCachedTenantId();
  if (cached !== undefined) {
    return cached;
  }

  // Priority 1: Check localStorage for tenant_id (set by Keycloak/auth provider)
  // This is the unified ID approach - tenant_id === organization_id
  let tenantId = localStorage.getItem('tenant_id');
  if (tenantId) {
    if (import.meta.env.DEV) {
      console.log('[getCurrentTenantId] Using tenant_id from localStorage:', tenantId);
    }
    setCachedTenantId(tenantId);
    return tenantId;
  }

  // Priority 2: Try Supabase auth for organization_id
  const { data } = await supabase.auth.getUser();
  tenantId = data?.user?.user_metadata?.organization_id || null;

  if (tenantId) {
    if (import.meta.env.DEV) {
      console.log('[getCurrentTenantId] Using organization_id from Supabase metadata:', tenantId);
    }
    setCachedTenantId(tenantId);
    return tenantId;
  }

  // Priority 3: Fallback to mock auth (localStorage user object)
  if (!tenantId) {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        tenantId = user?.user_metadata?.organization_id || null;
        if (tenantId && import.meta.env.DEV) {
          console.log('[getCurrentTenantId] Using organization_id from mock auth:', tenantId);
        }
      } catch {
        // Ignore JSON parse errors
      }
    }
  }

  // Priority 4: Final fallback - lookup users by email to resolve organization_id
  if (!tenantId && data?.user?.email) {
    const { data: row } = await supabase
      .from('users')
      .select('id, organization_id')
      .eq('email', data.user.email)
      .maybeSingle();
    tenantId = (row as any)?.organization_id || null;

    if (tenantId && import.meta.env.DEV) {
      console.log('[getCurrentTenantId] Using organization_id from users table lookup:', tenantId);
    }

    // Check if user is super_admin by querying organization_memberships
    if (row?.id) {
      const { data: membership } = await supabase
        .from('organization_memberships')
        .select('role')
        .eq('user_id', row.id)
        .maybeSingle();
      if (membership?.role === 'super_admin') {
        setCachedSuperAdmin(true);
      }
    }
  }

  setCachedTenantId(tenantId);
  return tenantId;
};

const isSuperAdmin = async (): Promise<boolean> => {
  // Priority 1: Check Auth0 roles from localStorage (set during Auth0 login)
  // Skip cache check for Auth0 roles - always re-check since localStorage is fast
  // and roles may be updated after initial page load
  try {
    const rolesJson = localStorage.getItem('auth0_roles');
    if (rolesJson) {
      const roles: string[] = JSON.parse(rolesJson);
      const hasRole = roles.includes('platform:super_admin');
      console.log('[DataProvider.isSuperAdmin] Auth0 roles check:', { roles, hasRole });
      if (hasRole) {
        setCachedSuperAdmin(true);
        return true;
      }
    }
  } catch {
    // Continue to fallback methods
  }

  // Only use cache for database lookups (expensive operations)
  const cached = getCachedSuperAdmin();
  if (typeof cached !== 'undefined') return cached;

  // Priority 2: Check Supabase database (backwards compatibility)
  const { data } = await supabase.auth.getUser();
  const email = data?.user?.email;
  if (!email) {
    setCachedSuperAdmin(false);
    return false;
  }
  // Get user ID first
  const { data: userRow } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (!userRow) {
    setCachedSuperAdmin(false);
    return false;
  }

  // Check role in organization_memberships
  const { data: membership } = await supabase
    .from('organization_memberships')
    .select('role')
    .eq('user_id', userRow.id)
    .maybeSingle();

  const isSuperAdminRole = membership?.role === 'super_admin';
  setCachedSuperAdmin(isSuperAdminRole);
  return isSuperAdminRole;
};

const applyTenantFilter = async (
  resource: string,
  query: any,
  filter: Record<string, unknown>
) => {
  if (import.meta.env.DEV) {
    console.log(`[applyTenantFilter] START - query type:`, typeof query, 'has .eq?', typeof query?.eq);
  }

  const column = TENANT_FILTER_COLUMN[resource];
  if (!column) {
    if (import.meta.env.DEV) console.log(`[applyTenantFilter] No column for resource ${resource}, returning query`);
    return query;
  }

  if (filter && Object.prototype.hasOwnProperty.call(filter, column)) {
    if (import.meta.env.DEV) console.log(`[applyTenantFilter] Filter already has ${column}, returning query`);
    return query;
  }

  // If super admin opted into all-tenants mode, skip tenant filter
  // Default to true for super admins on first load
  const isAdmin = await isSuperAdmin();
  if (import.meta.env.DEV) console.log(`[applyTenantFilter] isAdmin=${isAdmin}`);

  if (isAdmin) {
    const adminModeValue = typeof window !== 'undefined' ? localStorage.getItem('admin_mode_all_tenants') : null;
    // Default to 'true' if not explicitly set to 'false'
    const adminMode = adminModeValue === null ? true : adminModeValue === 'true';
    if (import.meta.env.DEV) console.log(`[applyTenantFilter] adminMode=${adminMode}`);

    if (adminMode) {
      if (import.meta.env.DEV) console.log(`[applyTenantFilter] Admin mode ON, returning query as-is`);
      return query;
    }
  }

  const tenantId = await getCurrentTenantId();
  if (import.meta.env.DEV) console.log(`[applyTenantFilter] tenantId=${tenantId}`);

  if (!tenantId) {
    if (import.meta.env.DEV) console.log(`[applyTenantFilter] No tenantId, returning query`);
    return query;
  }

  const result = query.eq(column, tenantId);
  if (import.meta.env.DEV) {
    console.log(`[applyTenantFilter] After .eq(), result type:`, typeof result, 'has .eq?', typeof result?.eq);
  }
  return result;
};

const withTenantDefault = async (resource: string, payload: Record<string, unknown>) => {
  const column = TENANT_FILTER_COLUMN[resource];
  if (!column || payload[column] !== undefined) {
    return payload;
  }

  const tenantId = await getCurrentTenantId();
  if (!tenantId) {
    return payload;
  }

  return { ...payload, [column]: tenantId };
};

export const dataProvider: DataProvider = {
  getList: async (resource, params) => {
    const { page, perPage } = params.pagination;
    const { field, order } = params.sort;
    const filter = { ...(params.filter || {}) };
    const tableName = getTableName(resource);
    const projectScope =
      resource === 'bom_line_items' && typeof filter.project_id === 'string' && filter.project_id !== 'all'
        ? filter.project_id
        : undefined;

    if (resource === 'bom_line_items') {
      delete filter.project_id;
    }

    // Build query step-by-step to ensure we keep the builder alive before range/await
    let query = supabase
      .from(tableName)
      .select('*', { count: 'exact' });

    // Inline tenant filter logic to avoid passing query through async function
    const column = TENANT_FILTER_COLUMN[resource];
    if (column && !filter[column]) {
      const isAdmin = await isSuperAdmin();
      const adminModeValue = typeof window !== 'undefined' ? localStorage.getItem('admin_mode_all_tenants') : null;
      const adminMode = adminModeValue === null ? true : adminModeValue === 'true';
      const shouldFilter = !isAdmin || !adminMode;

      if (shouldFilter) {
        const tenantId = await getCurrentTenantId();
        if (tenantId) {
          query = query.eq(column, tenantId);
        }
      }
    }

    // Full-text like search: support `q` filter for common list views
    const q = typeof (filter as any).q === 'string' ? (filter as any).q.trim() : '';
    if (q) {
      const pattern = `%${q}%`;
      const anyQuery: any = query as any;
      if (typeof anyQuery.or === 'function') {
        // Search across key textual fields when present
        // Safe for tables lacking some columns: conditions on missing columns are ignored
        query = anyQuery.or(
          `manufacturer_part_number.ilike.${pattern},manufacturer.ilike.${pattern},name.ilike.${pattern},description.ilike.${pattern}`
        );
      }
      // Do not forward `q` to generic filter loop
      delete (filter as any).q;
    }

    Object.keys(filter).forEach((key) => {
      const value = (filter as Record<string, unknown>)[key];
      // Skip undefined, null, empty strings, and React elements/objects
      if (
        value === undefined ||
        value === null ||
        value === '' ||
        typeof value === 'object' && value !== null && !Array.isArray(value)
      ) {
        return;
      }

      if (Array.isArray(value)) {
        query = query.in(key, value);
      } else if (typeof value === 'string' && value.includes('%')) {
        // wildcard provided -> use LIKE
        query = (query as any).ilike ? (query as any).ilike(key, value) : query.like(key, value);
      } else {
        query = query.eq(key, value as unknown);
      }
    });

    if (field) {
      // Safe-guard: only attempt order if builder still provides it
      const anyQuery: any = query as any;
      if (typeof anyQuery.order === 'function') {
        query = anyQuery.order(field, { ascending: order === 'ASC' });
      }
    }

    if (resource === 'bom_line_items' && projectScope) {
      const bomsTable = getTableName('boms');
      let bomQuery = supabase.from(bomsTable).select('id');
      bomQuery = await applyTenantFilter('boms', bomQuery, {});
      const { data: bomRows, error: bomError } = await bomQuery.eq('project_id', projectScope);
      if (bomError) {
        console.error('[DataProvider.getList] ❌ project filter lookup failed:', bomError);
        throw new Error(bomError.message);
      }
      const bomIds = (bomRows || []).map((row) => row.id);
      if (bomIds.length === 0) {
        return { data: [], total: 0 };
      }
      query = (query as any).in('bom_id', bomIds);
    }

    // Apply range as last step before awaiting (guard for environments lacking .range)
    const anyQuery2: any = query as any;
    if (typeof anyQuery2.range === 'function') {
      query = anyQuery2.range((page - 1) * perPage, page * perPage - 1);
    }

    const { data, error, count } = await query;

    // Debug logging (development mode only)
    if (import.meta.env.DEV) {
      console.log(`[DataProvider.getList] resource=${resource}, table=${tableName}`);
      console.log(`[DataProvider.getList] data length=${data?.length ?? 'null'}, count=${count}, error=${error?.message ?? 'none'}`);
    }

    if (error) {
      console.error('[DataProvider.getList] ERROR:', error);
      throw new Error(error.message);
    }

    // Handle null count - use data length as fallback
    // This happens when PostgREST can't compute count efficiently
    const totalCount = count !== null ? count : (data?.length || 0);

    const result = { data: data || [], total: totalCount };
    if (import.meta.env.DEV) {
      console.log(`[DataProvider.getList] returning:`, result);
    }
    return result;
  },

  getOne: async (resource, params) => {
    const tableName = getTableName(resource);

    // Build the query
    let query = supabase.from(tableName).select('*').eq('id', params.id);

    // Apply tenant filter by determining if we should filter, then adding the condition
    const column = TENANT_FILTER_COLUMN[resource];
    if (column) {
      const isAdmin = await isSuperAdmin();
      const adminModeValue = typeof window !== 'undefined' ? localStorage.getItem('admin_mode_all_tenants') : null;
      const adminMode = adminModeValue === null ? true : adminModeValue === 'true';
      const shouldFilter = !isAdmin || !adminMode;

      if (shouldFilter) {
        const tenantId = await getCurrentTenantId();
        if (tenantId) {
          query = query.eq(column, tenantId);
        }
      }
    }

    // Execute the query
    const { data, error } = await query.single();

    if (import.meta.env.DEV) {
      console.log(`[DataProvider.getOne] resource=${resource}, id=${params.id}`);
      console.log(`[DataProvider.getOne] data=`, data, `error=`, error?.message);
    }

    if (error) {
      console.error('[DataProvider.getOne] ERROR:', error);
      throw new Error(error.message);
    }

    return { data };
  },

  getMany: async (resource, params) => {
    const tableName = getTableName(resource);
    let query = supabase.from(tableName).select('*').in('id', params.ids);

    // Inline tenant filter logic to avoid passing query through async function
    const column = TENANT_FILTER_COLUMN[resource];
    if (column) {
      const isAdmin = await isSuperAdmin();
      const adminModeValue = typeof window !== 'undefined' ? localStorage.getItem('admin_mode_all_tenants') : null;
      const adminMode = adminModeValue === null ? true : adminModeValue === 'true';
      const shouldFilter = !isAdmin || !adminMode;

      if (shouldFilter) {
        const tenantId = await getCurrentTenantId();
        if (tenantId) {
          query = query.eq(column, tenantId);
        }
      }
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return { data: data || [] };
  },

  getManyReference: async (resource, params) => {
    const { page, perPage } = params.pagination;
    const { field, order } = params.sort;
    const filter = params.filter || {};
    const tableName = getTableName(resource);

    let query = supabase
      .from(tableName)
      .select('*', { count: 'exact' })
      .eq(params.target, params.id);

    // Inline tenant filter logic to avoid passing query through async function
    const column = TENANT_FILTER_COLUMN[resource];
    if (column && !filter[column]) {
      const isAdmin = await isSuperAdmin();
      const adminModeValue = typeof window !== 'undefined' ? localStorage.getItem('admin_mode_all_tenants') : null;
      const adminMode = adminModeValue === null ? true : adminModeValue === 'true';
      const shouldFilter = !isAdmin || !adminMode;

      if (shouldFilter) {
        const tenantId = await getCurrentTenantId();
        if (tenantId) {
          query = query.eq(column, tenantId);
        }
      }
    }

    // `q` search support in many-reference as well
    const q = typeof (filter as any).q === 'string' ? (filter as any).q.trim() : '';
    if (q) {
      const pattern = `%${q}%`;
      const anyQuery: any = query as any;
      if (typeof anyQuery.or === 'function') {
        query = anyQuery.or(
          `manufacturer_part_number.ilike.${pattern},manufacturer.ilike.${pattern},name.ilike.${pattern},description.ilike.${pattern}`
        );
      }
      delete (filter as any).q;
    }

    Object.keys(filter).forEach((key) => {
      const value = (filter as Record<string, unknown>)[key];
      if (value !== undefined && value !== null && value !== '') {
        query = query.eq(key, value as unknown);
      }
    });

    if (field) {
      const anyQuery: any = query as any;
      if (typeof anyQuery.order === 'function') {
        query = anyQuery.order(field, { ascending: order === 'ASC' });
      }
    }

    const anyQuery3: any = query as any;
    if (typeof anyQuery3.range === 'function') {
      query = anyQuery3.range((page - 1) * perPage, page * perPage - 1);
    }

    const { data, error, count } = await (query as any);

    if (error) {
      throw new Error(error.message);
    }

    return {
      data: data || [],
      total: count || 0,
    };
  },

  create: async (resource, params) => {
    const tableName = getTableName(resource);
    const payload = await withTenantDefault(resource, params.data);

    const { data, error } = await supabase
      .from(tableName)
      .insert(payload)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return { data };
  },

  update: async (resource, params) => {
    console.log('[DataProvider.update] 🔄 resource=', resource, 'id=', params.id);
    console.log('[DataProvider.update] 📦 params.data=', params.data);

    const tableName = getTableName(resource);
    const payload = await withTenantDefault(resource, params.data);

    console.log('[DataProvider.update] 📝 payload (after tenant default)=', payload);
    console.log('[DataProvider.update] 📊 table=', tableName);

    const { data, error } = await supabase
      .from(tableName)
      .update(payload)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('[DataProvider.update] ❌ error=', error);
      throw new Error(error.message);
    }

    console.log('[DataProvider.update] ✅ success, data=', data);
    return { data };
  },

  updateMany: async (resource, params) => {
    const tableName = getTableName(resource);
    const payload = await withTenantDefault(resource, params.data);

    const { error } = await supabase
      .from(tableName)
      .update(payload)
      .in('id', params.ids);

    if (error) {
      throw new Error(error.message);
    }

    return { data: params.ids };
  },

  delete: async (resource, params) => {
    const tableName = getTableName(resource);

    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq('id', params.id);

    if (error) {
      throw new Error(error.message);
    }

    return { data: params.previousData };
  },

  deleteMany: async (resource, params) => {
    const tableName = getTableName(resource);

    const { error } = await supabase
      .from(tableName)
      .delete()
      .in('id', params.ids);

    if (error) {
      throw new Error(error.message);
    }

    return { data: params.ids };
  },
};
