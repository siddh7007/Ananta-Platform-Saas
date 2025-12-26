/**
 * Protected Route Component
 *
 * Wraps components/routes that require minimum role level.
 * Renders children if user has sufficient privileges, otherwise shows fallback or redirects.
 *
 * Usage:
 * ```tsx
 * <ProtectedRoute minRole="engineer">
 *   <EngineerOnlyComponent />
 * </ProtectedRoute>
 *
 * <ProtectedRoute
 *   minRole="admin"
 *   fallback={<AccessDenied />}
 * >
 *   <AdminPanel />
 * </ProtectedRoute>
 * ```
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { AppRole, hasMinimumRole, parseRolesFromToken, getHighestRole } from '../lib/role-parser';
import { getKeycloak } from '../lib/keycloak/keycloakConfig';

interface ProtectedRouteProps {
  /** Child components to render if access granted */
  children: React.ReactNode;
  /** Minimum required role level */
  minRole: AppRole;
  /** Optional fallback component if access denied (defaults to redirect) */
  fallback?: React.ReactNode;
  /** Optional redirect path if access denied (defaults to '/') */
  redirectTo?: string;
}

/**
 * Default Access Denied component
 */
const DefaultAccessDenied: React.FC<{ minRole: AppRole; userRole: AppRole }> = ({
  minRole,
  userRole,
}) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '400px',
      padding: '2rem',
      textAlign: 'center',
    }}
  >
    <h2 style={{ color: '#d32f2f', marginBottom: '1rem' }}>Access Denied</h2>
    <p style={{ color: '#666', marginBottom: '0.5rem' }}>
      You don't have permission to access this resource.
    </p>
    <p style={{ color: '#999', fontSize: '0.875rem' }}>
      Required role: <strong>{minRole}</strong>
    </p>
    <p style={{ color: '#999', fontSize: '0.875rem' }}>
      Your role: <strong>{userRole}</strong>
    </p>
    <button
      onClick={() => window.history.back()}
      style={{
        marginTop: '1.5rem',
        padding: '0.5rem 1.5rem',
        backgroundColor: '#1976d2',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '1rem',
      }}
    >
      Go Back
    </button>
  </div>
);

/**
 * Get current user's role from Keycloak token
 */
function getCurrentUserRole(): AppRole {
  try {
    const keycloak = getKeycloak();
    const token = keycloak.tokenParsed;

    if (!token) {
      console.warn('[ProtectedRoute] No token found, defaulting to analyst');
      return 'analyst';
    }

    const roles = parseRolesFromToken(token);
    if (roles.length === 0) {
      console.warn('[ProtectedRoute] No roles found in token, defaulting to analyst');
      return 'analyst';
    }

    return getHighestRole(roles);
  } catch (error) {
    console.error('[ProtectedRoute] Error getting user role:', error);
    return 'analyst'; // Fail-safe to lowest privilege
  }
}

/**
 * Protected Route Component
 *
 * Checks if user has minimum required role before rendering children.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  minRole,
  fallback,
  redirectTo = '/',
}) => {
  const userRole = getCurrentUserRole();
  const hasAccess = hasMinimumRole(userRole, minRole);

  if (!hasAccess) {
    console.log(
      `[ProtectedRoute] Access denied: required=${minRole}, user=${userRole}`
    );

    // Use custom fallback if provided
    if (fallback) {
      return <>{fallback}</>;
    }

    // Use default access denied component if redirectTo is not specified or is '/'
    if (redirectTo === '/') {
      return <DefaultAccessDenied minRole={minRole} userRole={userRole} />;
    }

    // Redirect to specified path
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};

/**
 * Hook for conditional rendering based on role
 *
 * @param minRole - Minimum required role
 * @returns true if user has sufficient role
 *
 * @example
 * const canEdit = useHasRole('engineer');
 * if (canEdit) return <EditButton />;
 */
export function useHasRole(minRole: AppRole): boolean {
  const userRole = getCurrentUserRole();
  return hasMinimumRole(userRole, minRole);
}

/**
 * HOC to protect components with role check
 *
 * @param Component - Component to protect
 * @param minRole - Minimum required role
 * @returns Protected component
 *
 * @example
 * const ProtectedAdminPanel = withRoleProtection(AdminPanel, 'admin');
 */
export function withRoleProtection<P extends object>(
  Component: React.ComponentType<P>,
  minRole: AppRole
): React.FC<P> {
  return (props: P) => (
    <ProtectedRoute minRole={minRole}>
      <Component {...props} />
    </ProtectedRoute>
  );
}

export default ProtectedRoute;
