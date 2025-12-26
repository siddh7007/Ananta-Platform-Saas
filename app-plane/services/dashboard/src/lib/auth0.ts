/**
 * Auth0 Configuration for Next.js Dashboard
 *
 * Provides platform admin authentication using @auth0/nextjs-auth0
 * Uses same Auth0 tenant as React Admin dashboards
 */

import { getSession, withApiAuthRequired } from '@auth0/nextjs-auth0';
import { NextApiRequest, NextApiResponse } from 'next';

/**
 * Get user info from Auth0 session
 */
export const getUserInfo = async () => {
  if (typeof window === 'undefined') {
    // Server-side: requires request/response context
    return null;
  }

  try {
    const response = await fetch('/api/auth/me');
    if (!response.ok) return null;

    const session = await response.json();
    return {
      username: session.user.nickname || session.user.email,
      email: session.user.email,
      name: session.user.name,
      picture: session.user.picture,
      orgId: session.user.org_id,
    };
  } catch (error) {
    console.error('[Auth0] Failed to get user info:', error);
    return null;
  }
};

/**
 * Get access token for API calls
 */
export const getToken = async (): Promise<string | undefined> => {
  try {
    const response = await fetch('/api/auth/token');
    if (!response.ok) return undefined;

    const { accessToken } = await response.json();
    return accessToken;
  } catch (error) {
    console.error('[Auth0] Failed to get access token:', error);
    return undefined;
  }
};

/**
 * Logout from Auth0
 */
export const logout = (): void => {
  window.location.href = '/api/auth/logout';
};

/**
 * Check if user is authenticated (client-side)
 */
export const isAuthenticated = async (): Promise<boolean> => {
  try {
    const response = await fetch('/api/auth/me');
    return response.ok;
  } catch {
    return false;
  }
};

/**
 * Server-side session helper
 */
export const getServerSession = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const session = await getSession(req, res);
    return session;
  } catch (error) {
    console.error('[Auth0] Failed to get server session:', error);
    return null;
  }
};

/**
 * Protected API route wrapper
 */
export const withAuth = withApiAuthRequired;
