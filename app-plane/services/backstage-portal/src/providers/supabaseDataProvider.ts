/**
 * Supabase Data Provider for Backstage Portal (Platform Admin Tool)
 *
 * SECURITY MODEL - INTENTIONAL DESIGN:
 * ====================================
 *
 * This data provider does NOT filter by organization_id or enforce tenant isolation.
 * Platform admins (backstage portal users) can see ALL organizations by design.
 *
 * WHY NO TENANT FILTERING:
 * - Backstage portal is for platform administrators only
 * - Auth0 organization enforcement (org_oNtVXvVrzXz1ubua) at login
 * - Platform admins need cross-tenant visibility for support and operations
 * - RLS policies on Supabase allow super_admin role to bypass filters
 *
 * SECURITY BOUNDARIES:
 * 1. Access Control: Auth0 organization membership (invite-only)
 * 2. Authentication: Dual auth (Auth0 + Supabase)
 * 3. Authorization: RLS policies grant super_admin full access
 *
 * IF TENANT SCOPING IS EVER NEEDED:
 * - Add organization_id filtering in this dataProvider
 * - Update RLS policies to enforce for platform admins
 * - Consider splitting into separate admin vs support dashboards
 *
 * Resources: components, boms, alerts, organizations, users
 */

import { createClient } from '@supabase/supabase-js';
import { supabaseDataProvider as createSupabaseDataProvider } from 'ra-supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'http://localhost:27500/supabase';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsImF1ZCI6ImF1dGhlbnRpY2F0ZWQiLCJzdWIiOiJhbm9ueW1vdXMiLCJyb2xlIjoiYW5vbiIsInJlZiI6ImxvY2FsaG9zdCIsImlhdCI6MTc2MjM3OTgwMywiZXhwIjoxOTIwMDU5ODAzfQ.j1nHQ-lkDL6slYZpBOuLCHSm40Uay_SHHHCv3fYYcWQ';

/**
 * Supabase Client
 *
 * Configured with:
 * - Auto token refresh
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
});

/**
 * Supabase Data Provider
 *
 * Automatically handles:
 * - RLS filtering by organization_id
 * - Real-time subscriptions
 * - Optimistic updates
 * - Error handling
 */
export const supabaseDataProvider = createSupabaseDataProvider({
  instanceUrl: SUPABASE_URL,
  apiKey: SUPABASE_ANON_KEY,
  supabaseClient: supabase,
});

/**
 * Helper: Get current user's organization
 */
export const getCurrentOrganization = async () => {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  // Get user's organization from user_profiles
  const { data, error } = await supabase
    .from('user_profiles')
    .select('organization_id, organizations(id, name, slug)')
    .eq('keycloak_user_id', user.id)
    .single();

  if (error) {
    throw error;
  }

  return data;
};

/**
 * Helper: Subscribe to real-time changes
 */
export const subscribeToChanges = (
  table: string,
  callback: (payload: any) => void
) => {
  return supabase
    .channel(`public:${table}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      callback
    )
    .subscribe();
};
