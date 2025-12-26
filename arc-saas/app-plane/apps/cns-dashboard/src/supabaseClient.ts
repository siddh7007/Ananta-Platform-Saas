/**
 * Supabase Client for CNS Dashboard
 *
 * Used for Realtime subscriptions to enrichment events.
 * Note: CNS Dashboard uses CNS API for CRUD, but Supabase Realtime for live updates.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://localhost:27540';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabaseRealtimeEnabled = (import.meta.env.VITE_SUPABASE_REALTIME_ENABLED ?? 'true') !== 'false';

if (!supabaseAnonKey) {
  console.warn('[Supabase] VITE_SUPABASE_ANON_KEY not configured. Real-time features will not work.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

if (import.meta.env.DEV) {
  console.log('[Supabase] Client initialized:', {
    url: supabaseUrl,
    hasKey: !!supabaseAnonKey,
    realtime: supabaseRealtimeEnabled,
  });
}

export const SUPABASE_REALTIME_ENABLED = supabaseRealtimeEnabled;
