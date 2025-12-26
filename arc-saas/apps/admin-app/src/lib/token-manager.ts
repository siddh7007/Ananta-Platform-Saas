import { logger } from './logger';
import { API_URL } from '../config/api';

// Storage keys
const TOKEN_KEY = 'arc_admin_token';
const REFRESH_TOKEN_KEY = 'arc_admin_refresh_token';
const USER_KEY = 'arc_admin_user';

interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

interface RefreshState {
  isRefreshing: boolean;
  refreshPromise: Promise<string | null> | null;
}

// Singleton state for token refresh coordination
const refreshState: RefreshState = {
  isRefreshing: false,
  refreshPromise: null,
};

/**
 * Get the current access token from localStorage
 */
export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Get the current refresh token from localStorage
 */
export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

/**
 * Get the stored user from localStorage
 */
export function getStoredUser<T = unknown>(): T | null {
  const userJson = localStorage.getItem(USER_KEY);
  if (!userJson) return null;
  try {
    return JSON.parse(userJson) as T;
  } catch {
    return null;
  }
}

/**
 * Store tokens in localStorage
 */
export function setTokens(accessToken: string, refreshToken?: string): void {
  localStorage.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

/**
 * Store user in localStorage
 */
export function setStoredUser(user: unknown): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * Clear all auth tokens and user from localStorage
 */
export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * Check if the user is authenticated (has a token)
 */
export function isAuthenticated(): boolean {
  return !!getAccessToken();
}

/**
 * Get authorization headers for API requests
 */
export function getAuthHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Attempt to refresh the access token using the refresh token.
 * Uses a singleton pattern to prevent multiple concurrent refresh requests.
 * All concurrent callers will await the same refresh promise.
 */
export async function refreshAccessToken(): Promise<string | null> {
  // If already refreshing, wait for the existing promise
  if (refreshState.isRefreshing && refreshState.refreshPromise) {
    return refreshState.refreshPromise;
  }

  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    logger.warn('No refresh token available');
    return null;
  }

  refreshState.isRefreshing = true;
  refreshState.refreshPromise = (async () => {
    try {
      logger.info('Attempting to refresh access token');

      const response = await fetch(`${API_URL}/auth/token-refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        logger.warn('Token refresh failed', { status: response.status });
        clearTokens();
        return null;
      }

      const data: TokenResponse = await response.json();
      setTokens(data.accessToken, data.refreshToken);
      logger.info('Token refreshed successfully');
      return data.accessToken;
    } catch (error) {
      logger.error('Token refresh error', { error });
      clearTokens();
      return null;
    } finally {
      refreshState.isRefreshing = false;
      refreshState.refreshPromise = null;
    }
  })();

  return refreshState.refreshPromise;
}

/**
 * Handle session expiration by redirecting to login
 */
export function handleSessionExpired(): void {
  clearTokens();
  window.location.href = '/login';
}
