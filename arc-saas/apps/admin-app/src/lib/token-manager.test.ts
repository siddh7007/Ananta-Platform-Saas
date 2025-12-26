/**
 * Token Manager Tests
 *
 * Tests for token storage, retrieval, refresh, and session handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  setTokens,
  setStoredUser,
  clearTokens,
  isAuthenticated,
  getAuthHeaders,
  refreshAccessToken,
  handleSessionExpired,
} from './token-manager';

// Mock the logger
vi.mock('./logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock API_URL
vi.mock('../config/api', () => ({
  API_URL: 'http://localhost:14000',
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Storage keys (must match token-manager.ts)
const TOKEN_KEY = 'arc_admin_token';
const REFRESH_TOKEN_KEY = 'arc_admin_refresh_token';
const USER_KEY = 'arc_admin_user';

describe('token-manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAccessToken', () => {
    it('returns null when no token stored', () => {
      expect(getAccessToken()).toBeNull();
    });

    it('returns stored token', () => {
      localStorage.setItem(TOKEN_KEY, 'test-access-token');
      expect(getAccessToken()).toBe('test-access-token');
    });
  });

  describe('getRefreshToken', () => {
    it('returns null when no refresh token stored', () => {
      expect(getRefreshToken()).toBeNull();
    });

    it('returns stored refresh token', () => {
      localStorage.setItem(REFRESH_TOKEN_KEY, 'test-refresh-token');
      expect(getRefreshToken()).toBe('test-refresh-token');
    });
  });

  describe('getStoredUser', () => {
    it('returns null when no user stored', () => {
      expect(getStoredUser()).toBeNull();
    });

    it('returns parsed user object', () => {
      const user = { id: '123', email: 'test@example.com', role: 'admin' };
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      expect(getStoredUser()).toEqual(user);
    });

    it('returns null for invalid JSON', () => {
      localStorage.setItem(USER_KEY, 'invalid-json');
      expect(getStoredUser()).toBeNull();
    });
  });

  describe('setTokens', () => {
    it('stores access token', () => {
      setTokens('new-access-token');
      expect(localStorage.getItem(TOKEN_KEY)).toBe('new-access-token');
    });

    it('stores both access and refresh tokens', () => {
      setTokens('new-access-token', 'new-refresh-token');
      expect(localStorage.getItem(TOKEN_KEY)).toBe('new-access-token');
      expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe('new-refresh-token');
    });

    it('does not overwrite refresh token if not provided', () => {
      localStorage.setItem(REFRESH_TOKEN_KEY, 'existing-refresh-token');
      setTokens('new-access-token');
      expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe('existing-refresh-token');
    });
  });

  describe('setStoredUser', () => {
    it('stores user as JSON string', () => {
      const user = { id: '123', email: 'test@example.com' };
      setStoredUser(user);
      expect(localStorage.getItem(USER_KEY)).toBe(JSON.stringify(user));
    });
  });

  describe('clearTokens', () => {
    it('removes all auth data from localStorage', () => {
      localStorage.setItem(TOKEN_KEY, 'access-token');
      localStorage.setItem(REFRESH_TOKEN_KEY, 'refresh-token');
      localStorage.setItem(USER_KEY, JSON.stringify({ id: '123' }));

      clearTokens();

      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
      expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
      expect(localStorage.getItem(USER_KEY)).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('returns false when no token', () => {
      expect(isAuthenticated()).toBe(false);
    });

    it('returns true when token exists', () => {
      localStorage.setItem(TOKEN_KEY, 'some-token');
      expect(isAuthenticated()).toBe(true);
    });
  });

  describe('getAuthHeaders', () => {
    it('returns empty object when no token', () => {
      expect(getAuthHeaders()).toEqual({});
    });

    it('returns Authorization header with Bearer token', () => {
      localStorage.setItem(TOKEN_KEY, 'my-token');
      expect(getAuthHeaders()).toEqual({
        Authorization: 'Bearer my-token',
      });
    });
  });

  describe('refreshAccessToken', () => {
    it('returns null when no refresh token', async () => {
      const result = await refreshAccessToken();
      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('calls API with refresh token and stores new tokens', async () => {
      localStorage.setItem(REFRESH_TOKEN_KEY, 'valid-refresh-token');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
        }),
      });

      const result = await refreshAccessToken();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:14000/auth/token-refresh',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: 'valid-refresh-token' }),
        })
      );

      expect(result).toBe('new-access-token');
      expect(localStorage.getItem(TOKEN_KEY)).toBe('new-access-token');
      expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe('new-refresh-token');
    });

    it('clears tokens and returns null on refresh failure', async () => {
      localStorage.setItem(TOKEN_KEY, 'old-access-token');
      localStorage.setItem(REFRESH_TOKEN_KEY, 'invalid-refresh-token');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const result = await refreshAccessToken();

      expect(result).toBeNull();
      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
      expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
    });

    it('clears tokens and returns null on network error', async () => {
      localStorage.setItem(TOKEN_KEY, 'old-access-token');
      localStorage.setItem(REFRESH_TOKEN_KEY, 'some-refresh-token');

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await refreshAccessToken();

      expect(result).toBeNull();
      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    });

    it('prevents concurrent refresh requests (singleton pattern)', async () => {
      localStorage.setItem(REFRESH_TOKEN_KEY, 'valid-refresh-token');

      // Create a delayed response
      let resolveFirst: (value: any) => void;
      const firstPromise = new Promise((resolve) => {
        resolveFirst = resolve;
      });

      mockFetch.mockReturnValueOnce(firstPromise);

      // Start two concurrent refresh requests
      const refresh1 = refreshAccessToken();
      const refresh2 = refreshAccessToken();

      // Resolve the first request
      resolveFirst!({
        ok: true,
        json: async () => ({
          accessToken: 'shared-new-token',
          refreshToken: 'shared-new-refresh',
        }),
      });

      // Both should receive the same result
      const [result1, result2] = await Promise.all([refresh1, refresh2]);

      // Only one fetch call should have been made
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result1).toBe('shared-new-token');
      expect(result2).toBe('shared-new-token');
    });
  });

  describe('handleSessionExpired', () => {
    it('clears tokens and redirects to login', () => {
      localStorage.setItem(TOKEN_KEY, 'expired-token');
      localStorage.setItem(REFRESH_TOKEN_KEY, 'expired-refresh');
      localStorage.setItem(USER_KEY, JSON.stringify({ id: '123' }));

      // Mock window.location.href
      const originalLocation = window.location;
      delete (window as any).location;
      window.location = { ...originalLocation, href: '' } as Location;

      handleSessionExpired();

      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
      expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
      expect(localStorage.getItem(USER_KEY)).toBeNull();
      expect(window.location.href).toBe('/login');

      // Restore
      window.location = originalLocation;
    });
  });
});
