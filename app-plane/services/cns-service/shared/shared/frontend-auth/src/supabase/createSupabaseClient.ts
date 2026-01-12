import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  /**
   * Supabase project URL
   */
  url: string;

  /**
   * Supabase anonymous key
   */
  anonKey: string;

  /**
   * Auto-refresh token (default: true)
   */
  autoRefreshToken?: boolean;

  /**
   * Persist session (default: true)
   */
  persistSession?: boolean;

  /**
   * Detect session in URL (default: true)
   */
  detectSessionInUrl?: boolean;
}

/**
 * Create Supabase client with standard configuration
 */
export function createSupabaseClient(config: SupabaseConfig): SupabaseClient {
  const {
    url,
    anonKey,
    autoRefreshToken = true,
    persistSession = true,
    detectSessionInUrl = true,
  } = config;

  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken,
      persistSession,
      detectSessionInUrl,
    },
  });
}
