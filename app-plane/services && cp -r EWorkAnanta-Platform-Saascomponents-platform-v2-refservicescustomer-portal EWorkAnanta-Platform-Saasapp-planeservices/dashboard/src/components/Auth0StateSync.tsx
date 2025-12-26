import { useEffect, useLayoutEffect, useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { updateAuth0State } from '../lib/auth/auth0';

/**
 * Auth0 State Synchronizer
 *
 * This component syncs Auth0's authentication state to our shared state module,
 * allowing the auth provider to access Auth0 state without using React hooks.
 *
 * It also stores the Auth0 access token in localStorage for legacy code that
 * uses getAdminAuthHeaders() synchronously.
 *
 * CRITICAL: Uses useLayoutEffect for state sync to ensure the shared auth state
 * is updated BEFORE any child components or React Admin's auth checks run.
 * This prevents race conditions where checkAuth runs before state is synced.
 *
 * This must be rendered inside Auth0Provider.
 */
export const Auth0StateSync = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading, user, error, getAccessTokenSilently } = useAuth0();

  // Create a stable wrapper for getAccessTokenSilently
  // This ensures the auth provider always has access to the current function
  const getToken = useCallback(async (): Promise<string> => {
    try {
      const token = await getAccessTokenSilently();
      return token;
    } catch (err) {
      console.error('[Auth0StateSync] Failed to get access token:', err);
      throw err;
    }
  }, [getAccessTokenSilently]);

  // CRITICAL: Use useLayoutEffect for synchronous state sync
  // This ensures the shared auth state is updated BEFORE React Admin's auth checks
  // useLayoutEffect runs synchronously after DOM mutations but before browser paint
  useLayoutEffect(() => {
    console.log('[Auth0StateSync] Syncing state (layout) - isAuthenticated:', isAuthenticated, 'isLoading:', isLoading);

    updateAuth0State({
      isAuthenticated,
      isLoading,
      user: user || null,
      error: error || null,
      getAccessTokenSilently: getToken,
    });

    // CRITICAL: Also sync to localStorage in useLayoutEffect (not just useEffect)
    // This ensures localStorage is populated BEFORE any redirects or auth checks
    if (isAuthenticated && !isLoading && user) {
      const userId = user.sub || '';
      const userEmail = user.email || '';
      const userName = user.name || user.email || 'User';
      const userAvatar = user.picture || '';

      // Store user identity data synchronously
      if (userId) localStorage.setItem('user_id', userId);
      if (userEmail) localStorage.setItem('user_email', userEmail);
      if (userName) localStorage.setItem('user_name', userName);
      if (userAvatar) localStorage.setItem('user_avatar', userAvatar);

      console.log('[Auth0StateSync] ✅ User data synced to localStorage (layout):', { userId, userEmail });
    }
  }, [isAuthenticated, isLoading, user, error, getToken]);

  // Async operations (token storage, localStorage) can use regular useEffect
  useEffect(() => {
    // When authenticated, fetch and store the token in localStorage
    // This makes the token available for legacy code using getAdminAuthHeaders()
    // Also store user identity for getIdentity() to work immediately
    if (isAuthenticated && !isLoading && user) {
      // Store user identity data immediately so getIdentity() works
      // This prevents race conditions between checkAuth and getIdentity
      const userId = user.sub || '';
      const userEmail = user.email || '';
      const userName = user.name || user.email || 'User';
      const userAvatar = user.picture || '';

      // Only set if not already present (don't overwrite middleware-synced data)
      if (!localStorage.getItem('user_id') && userId) {
        localStorage.setItem('user_id', userId);
        console.log('[Auth0StateSync] Stored user_id:', userId);
      }
      if (!localStorage.getItem('user_email') && userEmail) {
        localStorage.setItem('user_email', userEmail);
        console.log('[Auth0StateSync] Stored user_email:', userEmail);
      }
      if (!localStorage.getItem('user_name') && userName) {
        localStorage.setItem('user_name', userName);
      }
      if (!localStorage.getItem('user_avatar') && userAvatar) {
        localStorage.setItem('user_avatar', userAvatar);
      }

      getToken()
        .then((token) => {
          localStorage.setItem('auth0_access_token', token);
          console.log('[Auth0StateSync] ✅ Token stored in localStorage');
        })
        .catch((err) => {
          console.warn('[Auth0StateSync] Failed to store token:', err);
        });
    }

    console.log('[Auth0StateSync] State updated - isAuthenticated:', isAuthenticated, 'isLoading:', isLoading, 'hasUser:', !!user);
  }, [isAuthenticated, isLoading, user, getToken]);

  // Clean up token and identity on logout
  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      localStorage.removeItem('auth0_access_token');
      // Note: Full cleanup happens in authProvider.logout()
      // This is just a safety net for the token
    }
  }, [isAuthenticated, isLoading]);

  return <>{children}</>;
};
