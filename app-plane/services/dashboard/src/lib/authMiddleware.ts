/**
 * Authentication Middleware for Control Plane Proxy
 *
 * Extracts and validates JWT tokens from requests before forwarding to Control Plane.
 * Ensures user identity is preserved in audit logs.
 */

import type { NextApiRequest, NextApiResponse } from 'next';

export interface AuthenticatedUser {
  userId: string;
  email?: string;
  tenantId?: string;
  roles?: string[];
  accessToken: string;
}

export interface AuthMiddlewareResult {
  success: boolean;
  user?: AuthenticatedUser;
  error?: string;
  status?: number;
}

/**
 * Extract JWT token from request headers
 */
export function extractToken(req: NextApiRequest): string | null {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  // Handle "Bearer <token>" format
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Handle direct token (no "Bearer" prefix)
  return authHeader;
}

/**
 * Parse JWT payload without verification (for forwarding)
 * NOTE: Token verification happens on Control Plane side
 */
export function parseJwtPayload(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // Decode base64url payload
    const payload = parts[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');

    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('[AUTH_MIDDLEWARE] Failed to parse JWT payload:', error);
    return null;
  }
}

/**
 * Extract user information from JWT token
 */
export function extractUserFromToken(token: string): AuthenticatedUser | null {
  const payload = parseJwtPayload(token);

  if (!payload) {
    return null;
  }

  // Check token expiration
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    console.warn('[AUTH_MIDDLEWARE] Token expired');
    return null;
  }

  // Extract user information (compatible with Keycloak and Auth0)
  const userId = payload.sub || payload.userId || payload.id;
  const email = payload.email || payload.preferred_username;
  const tenantId = payload.tenantId || payload.organization_id || payload.org_id;

  // Extract roles (support multiple formats)
  let roles: string[] = [];
  if (payload.realm_access?.roles) {
    roles = payload.realm_access.roles;
  } else if (payload.roles) {
    roles = Array.isArray(payload.roles) ? payload.roles : [payload.roles];
  } else if (payload.role) {
    roles = [payload.role];
  }

  if (!userId) {
    console.warn('[AUTH_MIDDLEWARE] No user ID in token');
    return null;
  }

  return {
    userId,
    email,
    tenantId,
    roles,
    accessToken: token,
  };
}

/**
 * Authenticate request and extract user information
 */
export function authenticateRequest(req: NextApiRequest): AuthMiddlewareResult {
  const token = extractToken(req);

  if (!token) {
    return {
      success: false,
      error: 'Authorization header missing. Please provide a valid JWT token.',
      status: 401,
    };
  }

  const user = extractUserFromToken(token);

  if (!user) {
    return {
      success: false,
      error: 'Invalid or expired token. Please log in again.',
      status: 401,
    };
  }

  console.log(`[AUTH_MIDDLEWARE] Authenticated user: ${user.userId} (${user.email})`);

  return {
    success: true,
    user,
  };
}

/**
 * Middleware wrapper that requires authentication
 */
export function requireAuth(
  handler: (req: NextApiRequest, res: NextApiResponse, user: AuthenticatedUser) => Promise<void>
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const authResult = authenticateRequest(req);

    if (!authResult.success) {
      return res.status(authResult.status || 401).json({
        error: authResult.error,
      });
    }

    // Call the actual handler with authenticated user
    try {
      await handler(req, res, authResult.user!);
    } catch (error: any) {
      console.error('[API_ERROR] Handler error:', error);

      // Extract status and message from error
      const status = error.status || error.statusCode || 500;
      const message = error.message || 'Internal server error';

      res.status(status).json({
        error: message,
        correlationId: error.correlationId,
      });
    }
  };
}

/**
 * Middleware wrapper that requires specific role
 */
export function requireRole(
  requiredRole: string,
  handler: (req: NextApiRequest, res: NextApiResponse, user: AuthenticatedUser) => Promise<void>
) {
  return requireAuth(async (req, res, user) => {
    if (!user.roles?.includes(requiredRole)) {
      return res.status(403).json({
        error: `This action requires the '${requiredRole}' role.`,
      });
    }

    await handler(req, res, user);
  });
}

/**
 * Middleware wrapper that requires minimum role level
 */
export function requireMinimumRole(
  minimumRole: string,
  handler: (req: NextApiRequest, res: NextApiResponse, user: AuthenticatedUser) => Promise<void>
) {
  const roleHierarchy: Record<string, number> = {
    analyst: 1,
    engineer: 2,
    admin: 3,
    owner: 4,
    super_admin: 5,
  };

  return requireAuth(async (req, res, user) => {
    const userLevel = Math.max(
      ...(user.roles || []).map(role => roleHierarchy[role] || 0)
    );

    const requiredLevel = roleHierarchy[minimumRole] || 0;

    if (userLevel < requiredLevel) {
      return res.status(403).json({
        error: `This action requires at least '${minimumRole}' role.`,
      });
    }

    await handler(req, res, user);
  });
}

/**
 * Create headers for Control Plane request with JWT forwarding
 */
export function createControlPlaneHeaders(user: AuthenticatedUser): Record<string, string> {
  return {
    Authorization: `Bearer ${user.accessToken}`,
    'X-User-Id': user.userId,
    'X-User-Email': user.email || '',
    'X-Tenant-Id': user.tenantId || '',
  };
}
