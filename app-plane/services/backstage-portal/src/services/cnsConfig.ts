const DEFAULT_CNS_BASE_URL = 'http://localhost:27800';

export function getCnsBaseUrl(): string {
  return import.meta.env.VITE_CNS_API_URL || DEFAULT_CNS_BASE_URL;
}

export function getCnsApiUrl(): string {
  return getCnsBaseUrl() + "/api";
}

/**
 * Get auth headers for CNS API calls.
 * Backstage uses Auth0 SSO - check for token in localStorage or Supabase session.
 * Falls back to Django session auth.
 */
export async function getAuthHeaders(): Promise<HeadersInit> {
  // Try Auth0 token first (set by auth0AuthProvider after login)
  const auth0Token = localStorage.getItem('auth0_access_token');
  if (auth0Token) {
    return {
      'Authorization': `Bearer ${auth0Token}`,
    };
  }

  // Try Supabase session token (set by middleware after Auth0 login)
  try {
    const { supabase } = await import('../providers/supabaseDataProvider');
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      return {
        'Authorization': `Bearer ${session.access_token}`,
      };
    }
  } catch (e) {
    console.warn('[CNS Config] Could not get Supabase session:', e);
  }

  // Fall back to Django CSRF token for session auth
  const csrfToken = document.cookie
    .split('; ')
    .find(row => row.startsWith('csrftoken='))
    ?.split('=')[1];

  if (csrfToken) {
    return {
      'X-CSRFToken': csrfToken,
    };
  }

  return {};
}
