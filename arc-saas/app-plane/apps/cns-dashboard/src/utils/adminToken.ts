import API_CONFIG from '../config/api';

const STORAGE_KEY = 'cns_admin_api_token';

const normalize = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return undefined;
  return trimmed;
};

let bootstrapPromise: Promise<void> | null = null;

const isDev = Boolean((import.meta as any)?.env?.DEV ?? false);

/**
 * Ensure the default admin token is present in localStorage.
 *
 * This helper fetches the `/admin/default-token` endpoint (only enabled in
 * local/dev environments) and caches the returned token the first time it is
 * needed. Subsequent calls short-circuit if a token is already stored.
 */
export const ensureDefaultAdminToken = async (): Promise<void> => {
  if (typeof window === 'undefined') {
    return;
  }

  const existing = normalize(localStorage.getItem(STORAGE_KEY));
  if (existing) {
    return;
  }

  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/admin/default-token`, {
          credentials: 'include',
        });

        if (!response.ok) {
          if (isDev) {
            console.warn('[AdminToken] Failed to fetch default token', response.status);
          }
          return;
        }

        const payload = await response.json();
        const token = normalize(payload?.token);
        if (token) {
          localStorage.setItem(STORAGE_KEY, token);
          if (isDev) {
            console.log('[AdminToken] Default admin token bootstrapped from API', payload?.environment);
          }
        }
      } catch (error) {
        if (isDev) {
          console.warn('[AdminToken] Error fetching default token', error);
        }
      } finally {
        bootstrapPromise = null;
      }
    })();
  }

  return bootstrapPromise;
};
