import { DataProvider, fetchUtils } from 'react-admin';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://localhost:27500/supabase';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsImF1ZCI6ImF1dGhlbnRpY2F0ZWQiLCJzdWIiOiJhbm9ueW1vdXMiLCJyb2xlIjoiYW5vbiIsInJlZiI6ImxvY2FsaG9zdCIsImlhdCI6MTc2MjM3OTgwMywiZXhwIjoxOTIwMDU5ODAzfQ.j1nHQ-lkDL6slYZpBOuLCHSm40Uay_SHHHCv3fYYcWQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Supabase Data Provider for React Admin
 *
 * Maps React Admin data provider methods to Supabase PostgREST API
 * Supports:
 * - CRUD operations
 * - Filtering, sorting, pagination
 * - RLS (Row-Level Security) enforcement
 * - Real-time subscriptions (via separate hook)
 */
export const dataProvider: DataProvider = {
  /**
   * Get a list of records
   *
   * @example
   * dataProvider.getList('components', {
   *   pagination: { page: 1, perPage: 10 },
   *   sort: { field: 'created_at', order: 'DESC' },
   *   filter: { risk_level: 'HIGH' }
   * })
   */
  getList: async (resource, params) => {
    const { page, perPage } = params.pagination;
    const { field, order } = params.sort;
    const filter = params.filter;

    let query = supabase
      .from(resource)
      .select('*', { count: 'exact' })
      .range((page - 1) * perPage, page * perPage - 1);

    // Apply sorting
    if (field) {
      query = query.order(field, { ascending: order === 'ASC' });
    }

    // Apply filters
    Object.keys(filter).forEach((key) => {
      if (filter[key] !== undefined && filter[key] !== null && filter[key] !== '') {
        // Support for different filter types
        if (Array.isArray(filter[key])) {
          // Array filter (e.g., category_id in [1, 2, 3])
          query = query.in(key, filter[key]);
        } else if (typeof filter[key] === 'string' && filter[key].includes('%')) {
          // LIKE filter (e.g., name LIKE '%capacitor%')
          query = query.like(key, filter[key]);
        } else {
          // Exact match
          query = query.eq(key, filter[key]);
        }
      }
    });

    const { data, error, count } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return {
      data: data || [],
      total: count || 0,
    };
  },

  /**
   * Get a single record by ID
   *
   * @example
   * dataProvider.getOne('components', { id: 123 })
   */
  getOne: async (resource, params) => {
    const { data, error } = await supabase
      .from(resource)
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return { data };
  },

  /**
   * Get multiple records by IDs
   *
   * @example
   * dataProvider.getMany('components', { ids: [1, 2, 3] })
   */
  getMany: async (resource, params) => {
    const { data, error } = await supabase
      .from(resource)
      .select('*')
      .in('id', params.ids);

    if (error) {
      throw new Error(error.message);
    }

    return { data: data || [] };
  },

  /**
   * Get multiple records with reference
   * Used for one-to-many relationships
   *
   * @example
   * dataProvider.getManyReference('bom_line_items', {
   *   target: 'bom_id',
   *   id: 123,
   *   pagination: { page: 1, perPage: 10 },
   *   sort: { field: 'created_at', order: 'DESC' },
   *   filter: {}
   * })
   */
  getManyReference: async (resource, params) => {
    const { page, perPage } = params.pagination;
    const { field, order } = params.sort;
    const filter = params.filter;

    let query = supabase
      .from(resource)
      .select('*', { count: 'exact' })
      .eq(params.target, params.id)
      .range((page - 1) * perPage, page * perPage - 1);

    // Apply sorting
    if (field) {
      query = query.order(field, { ascending: order === 'ASC' });
    }

    // Apply filters
    Object.keys(filter).forEach((key) => {
      if (filter[key] !== undefined && filter[key] !== null && filter[key] !== '') {
        query = query.eq(key, filter[key]);
      }
    });

    const { data, error, count } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return {
      data: data || [],
      total: count || 0,
    };
  },

  /**
   * Create a new record
   *
   * @example
   * dataProvider.create('components', {
   *   data: { manufacturer_part_number: 'ABC123', ... }
   * })
   */
  create: async (resource, params) => {
    const { data, error } = await supabase
      .from(resource)
      .insert(params.data)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return { data };
  },

  /**
   * Update a record
   *
   * @example
   * dataProvider.update('components', {
   *   id: 123,
   *   data: { risk_level: 'HIGH' },
   *   previousData: { ... }
   * })
   */
  update: async (resource, params) => {
    const { data, error } = await supabase
      .from(resource)
      .update(params.data)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return { data };
  },

  /**
   * Update multiple records
   *
   * @example
   * dataProvider.updateMany('components', {
   *   ids: [1, 2, 3],
   *   data: { risk_level: 'MEDIUM' }
   * })
   */
  updateMany: async (resource, params) => {
    const { data, error } = await supabase
      .from(resource)
      .update(params.data)
      .in('id', params.ids)
      .select();

    if (error) {
      throw new Error(error.message);
    }

    return { data: params.ids };
  },

  /**
   * Delete a record
   *
   * @example
   * dataProvider.delete('components', { id: 123, previousData: { ... } })
   */
  delete: async (resource, params) => {
    const { error } = await supabase
      .from(resource)
      .delete()
      .eq('id', params.id);

    if (error) {
      throw new Error(error.message);
    }

    return { data: params.previousData };
  },

  /**
   * Delete multiple records
   *
   * @example
   * dataProvider.deleteMany('components', { ids: [1, 2, 3] })
   */
  deleteMany: async (resource, params) => {
    const { error } = await supabase
      .from(resource)
      .delete()
      .in('id', params.ids);

    if (error) {
      throw new Error(error.message);
    }

    return { data: params.ids };
  },
};

/**
 * Helper function to get the current user's organization ID
 * Used for filtering data by tenant
 */
export const getCurrentTenantId = async (): Promise<string | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.user_metadata?.organization_id || null;
};

/**
 * Helper function to check if a record belongs to the current tenant
 * Used for RLS validation on the client side
 */
export const checkTenantAccess = async (resource: string, id: number): Promise<boolean> => {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return false;

  const { data, error } = await supabase
    .from(resource)
    .select('organization_id')
    .eq('id', id)
    .single();

  if (error || !data) return false;

  return data.organization_id === tenantId;
};
