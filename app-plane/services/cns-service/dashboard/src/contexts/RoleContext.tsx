/**
 * Role Context Provider
 *
 * Provides user role information throughout the application.
 * Integrates with Keycloak authentication and role hierarchy.
 *
 * Usage:
 * ```tsx
 * const { role, roles, isLoading, hasMinRole, isSuperAdmin, isAdmin } = useRole();
 *
 * if (hasMinRole('engineer')) {
 *   return <EngineerFeature />;
 * }
 * ```
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  AppRole,
  parseRolesFromToken,
  getHighestRole,
  hasMinimumRole,
  isSuperAdmin as checkIsSuperAdmin,
  isOwner as checkIsOwner,
  isAdmin as checkIsAdmin,
  isEngineer as checkIsEngineer,
  getRoleDisplayName,
  getRoleLevel,
} from '../lib/role-parser';
import { getKeycloak } from '../lib/keycloak/keycloakConfig';

interface RoleContextType {
  /** User's highest privilege role */
  role: AppRole;
  /** All roles assigned to user */
  roles: AppRole[];
  /** Loading state during role extraction */
  isLoading: boolean;
  /** Error during role extraction */
  error: Error | null;
  /** Check if user has minimum required role */
  hasMinRole: (minRole: AppRole) => boolean;
  /** Check if user is super_admin */
  isSuperAdmin: boolean;
  /** Check if user is owner or higher */
  isOwner: boolean;
  /** Check if user is admin or higher */
  isAdmin: boolean;
  /** Check if user is engineer or higher */
  isEngineer: boolean;
  /** Get role display name */
  getRoleName: () => string;
  /** Get role level (1-5) */
  getLevel: () => number;
  /** Refresh roles from token */
  refresh: () => void;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

/**
 * Extract roles from current Keycloak token
 */
function extractRolesFromToken(): { role: AppRole; roles: AppRole[] } {
  try {
    const keycloak = getKeycloak();
    const token = keycloak.tokenParsed;

    if (!token) {
      console.warn('[RoleContext] No token found, defaulting to analyst');
      return { role: 'analyst', roles: ['analyst'] };
    }

    const roles = parseRolesFromToken(token);
    if (roles.length === 0) {
      console.warn('[RoleContext] No roles found in token, defaulting to analyst');
      return { role: 'analyst', roles: ['analyst'] };
    }

    const highestRole = getHighestRole(roles);
    console.log('[RoleContext] Extracted roles:', roles, 'highest:', highestRole);
    return { role: highestRole, roles };
  } catch (error) {
    console.error('[RoleContext] Error extracting roles:', error);
    return { role: 'analyst', roles: ['analyst'] }; // Fail-safe
  }
}

export const RoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<AppRole>('analyst');
  const [roles, setRoles] = useState<AppRole[]>(['analyst']);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // Extract roles on mount and when token changes
  const loadRoles = useCallback(() => {
    try {
      setIsLoading(true);
      setError(null);
      const { role: highestRole, roles: allRoles } = extractRolesFromToken();
      setRole(highestRole);
      setRoles(allRoles);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load roles');
      setError(error);
      console.error('[RoleContext] Error loading roles:', error);
      // Set defaults on error
      setRole('analyst');
      setRoles(['analyst']);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoles();

    // Listen for Keycloak token refresh events
    const keycloak = getKeycloak();
    const onTokenRefresh = () => {
      console.log('[RoleContext] Token refreshed, reloading roles');
      loadRoles();
    };

    keycloak.onTokenExpired = onTokenRefresh;

    // Cleanup
    return () => {
      keycloak.onTokenExpired = () => {};
    };
  }, [loadRoles]);

  // Role check functions
  const hasMinRole = useCallback(
    (minRole: AppRole) => hasMinimumRole(role, minRole),
    [role]
  );

  const isSuperAdmin = checkIsSuperAdmin(role);
  const isOwner = checkIsOwner(role);
  const isAdmin = checkIsAdmin(role);
  const isEngineer = checkIsEngineer(role);

  const getRoleName = useCallback(() => getRoleDisplayName(role), [role]);
  const getLevel = useCallback(() => getRoleLevel(role), [role]);

  const contextValue: RoleContextType = {
    role,
    roles,
    isLoading,
    error,
    hasMinRole,
    isSuperAdmin,
    isOwner,
    isAdmin,
    isEngineer,
    getRoleName,
    getLevel,
    refresh: loadRoles,
  };

  return <RoleContext.Provider value={contextValue}>{children}</RoleContext.Provider>;
};

/**
 * Hook to access role context
 *
 * @throws Error if used outside RoleProvider
 */
export const useRole = (): RoleContextType => {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
};

/**
 * Hook to get current user role
 *
 * @returns User's highest role
 */
export const useUserRole = (): AppRole => {
  const { role } = useRole();
  return role;
};

/**
 * Hook to check minimum role requirement
 *
 * @param minRole - Minimum required role
 * @returns true if user meets requirement
 */
export const useHasMinimumRole = (minRole: AppRole): boolean => {
  const { hasMinRole } = useRole();
  return hasMinRole(minRole);
};

/**
 * Hook to check if user is super admin
 *
 * @returns true if user is super_admin
 */
export const useIsSuperAdmin = (): boolean => {
  const { isSuperAdmin } = useRole();
  return isSuperAdmin;
};

/**
 * Hook to check if user is admin or higher
 *
 * @returns true if user is admin, owner, or super_admin
 */
export const useIsAdmin = (): boolean => {
  const { isAdmin } = useRole();
  return isAdmin;
};

/**
 * Hook to check if user is engineer or higher
 *
 * @returns true if user is engineer or higher
 */
export const useIsEngineer = (): boolean => {
  const { isEngineer } = useRole();
  return isEngineer;
};

export default RoleContext;
