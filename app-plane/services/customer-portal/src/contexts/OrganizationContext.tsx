/**
 * Organization Context
 *
 * Global state management for multi-organization support:
 * - Current organization selection with persistence
 * - Organizations list with refresh capability
 * - Role-based permissions
 * - Org switching with automatic header updates
 *
 * Usage:
 *   const { currentOrg, switchOrganization, permissions } = useOrganization();
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import {
  organizationsApi,
  Organization,
  OrgRole,
  getPermissions,
} from '../services/organizationsApi';
import {
  getCurrentOrganizationId as getOrgIdFromStorage,
  setCurrentOrganizationId,
  clearOrganizationId,
} from '../services/cnsApi';

// =====================================================
// Types
// =====================================================

interface Permissions {
  canInvite: boolean;
  canRemoveMembers: boolean;
  canEditOrg: boolean;
  canDeleteOrg: boolean;
  canTransferOwnership: boolean;
  canUploadBOM: boolean;
  canCreateProject: boolean;
  canViewRisk: boolean;
  canViewAlerts: boolean;
  canViewMembers: boolean;
}

interface OrganizationContextState {
  // Current organization
  currentOrg: Organization | null;

  // All user's organizations
  organizations: Organization[];
  totalOrgs: number;

  // Loading states
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Current role in selected org
  currentRole: OrgRole | null;

  // Permissions derived from role
  permissions: Permissions;
}

interface OrganizationContextActions {
  // Switch to a different organization
  switchOrganization: (orgId: string) => Promise<void>;

  // Refresh organizations list (returns updated list)
  refreshOrganizations: () => Promise<Organization[]>;

  // Create new organization and optionally switch to it
  createOrganization: (name: string, slug?: string, switchTo?: boolean) => Promise<Organization>;

  // Leave the current organization
  leaveCurrentOrg: () => Promise<void>;

  // Clear current organization (for logout)
  clearOrganization: () => void;
}

type OrganizationContextValue = OrganizationContextState & OrganizationContextActions;

// Default permissions (no access)
const defaultPermissions: Permissions = {
  canInvite: false,
  canRemoveMembers: false,
  canEditOrg: false,
  canDeleteOrg: false,
  canTransferOwnership: false,
  canUploadBOM: false,
  canCreateProject: false,
  canViewRisk: false,
  canViewAlerts: false,
  canViewMembers: false,
};

// =====================================================
// Context
// =====================================================

const OrganizationContext = createContext<OrganizationContextValue | null>(null);

// =====================================================
// Storage Keys (shared with cnsApi.ts)
// =====================================================

// Organization name is stored separately for quick display
const STORAGE_KEY_ORG_NAME = 'current_organization_name';

// =====================================================
// Provider
// =====================================================

interface OrganizationProviderProps {
  children: ReactNode;
}

export function OrganizationProvider({ children }: OrganizationProviderProps) {
  // State
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [totalOrgs, setTotalOrgs] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derived state
  const currentRole = currentOrg?.role ?? null;
  const permissions = useMemo(
    () => (currentRole ? getPermissions(currentRole) : defaultPermissions),
    [currentRole]
  );

  // =====================================================
  // Persistence Helpers
  // Uses shared storage utilities from cnsApi.ts
  // =====================================================

  const persistOrgSelection = useCallback((org: Organization | null) => {
    if (org) {
      // Use shared utility for org ID (handles legacy key too)
      setCurrentOrganizationId(org.id);
      localStorage.setItem(STORAGE_KEY_ORG_NAME, org.name);
      console.log(`[OrgContext] Persisted org: ${org.name} (${org.id})`);
    } else {
      // Use shared utility to clear
      clearOrganizationId();
      localStorage.removeItem(STORAGE_KEY_ORG_NAME);
      console.log('[OrgContext] Cleared org selection');
    }
  }, []);

  const getPersistedOrgId = useCallback((): string | null => {
    // Use shared utility from cnsApi.ts
    return getOrgIdFromStorage();
  }, []);

  // =====================================================
  // Core Actions
  // =====================================================

  const refreshOrganizations = useCallback(async () => {
    console.log('[OrgContext] Refreshing organizations...');
    try {
      const response = await organizationsApi.getMyOrganizations(100, 0);
      setOrganizations(response.items);
      setTotalOrgs(response.total);
      setError(null);
      console.log(`[OrgContext] Loaded ${response.items.length} organizations`);
      return response.items;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load organizations';
      console.error('[OrgContext] Failed to refresh organizations:', message);
      setError(message);
      throw err;
    }
  }, []);

  const switchOrganization = useCallback(async (orgId: string) => {
    console.log(`[OrgContext] Switching to org: ${orgId}`);

    // Find org in current list
    let org = organizations.find((o) => o.id === orgId);

    // If not found in list, refresh and try again
    if (!org) {
      console.log('[OrgContext] Org not in cache, refreshing...');
      const freshOrgs = await refreshOrganizations();
      org = freshOrgs.find((o) => o.id === orgId);
    }

    if (!org) {
      const error = `Organization ${orgId} not found or you don't have access`;
      console.error(`[OrgContext] ${error}`);
      throw new Error(error);
    }

    setCurrentOrg(org);
    persistOrgSelection(org);

    // Dispatch custom event so other components can react
    window.dispatchEvent(
      new CustomEvent('organization-changed', {
        detail: { organizationId: org.id, organizationName: org.name },
      })
    );
  }, [organizations, refreshOrganizations, persistOrgSelection]);

  const createOrganization = useCallback(async (
    name: string,
    slug?: string,
    switchTo: boolean = true
  ): Promise<Organization> => {
    console.log(`[OrgContext] Creating organization: ${name}`);

    const newOrg = await organizationsApi.createOrganization({ name, slug });
    console.log(`[OrgContext] Created organization: ${newOrg.id}`);

    // Refresh list to include new org
    await refreshOrganizations();

    // Optionally switch to new org
    if (switchTo) {
      setCurrentOrg(newOrg);
      persistOrgSelection(newOrg);
    }

    return newOrg;
  }, [refreshOrganizations, persistOrgSelection]);

  const leaveCurrentOrg = useCallback(async () => {
    if (!currentOrg) {
      throw new Error('No current organization to leave');
    }

    console.log(`[OrgContext] Leaving organization: ${currentOrg.name}`);

    await organizationsApi.leaveOrganization(currentOrg.id);

    // Refresh list (will exclude the org we just left)
    const freshOrgs = await refreshOrganizations();

    // Switch to first available org, or clear if none
    if (freshOrgs.length > 0) {
      const nextOrg = freshOrgs[0];
      setCurrentOrg(nextOrg);
      persistOrgSelection(nextOrg);
    } else {
      setCurrentOrg(null);
      persistOrgSelection(null);
    }
  }, [currentOrg, refreshOrganizations, persistOrgSelection]);

  const clearOrganization = useCallback(() => {
    setCurrentOrg(null);
    setOrganizations([]);
    setTotalOrgs(0);
    persistOrgSelection(null);
    setIsInitialized(false);
  }, [persistOrgSelection]);

  // =====================================================
  // Initialization with Retry Logic
  // =====================================================

  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const MAX_RETRIES = 5;
    const INITIAL_RETRY_DELAY = 500; // Start with 500ms

    const initialize = async () => {
      console.log(`[OrgContext] Initializing... (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);
      setIsLoading(true);

      try {
        // Fetch organizations
        const response = await organizationsApi.getMyOrganizations(100, 0);

        if (!isMounted) return;

        setOrganizations(response.items);
        setTotalOrgs(response.total);

        // Determine initial org selection
        const persistedOrgId = getPersistedOrgId();
        let selectedOrg: Organization | null = null;

        if (persistedOrgId) {
          // Try to restore persisted selection
          selectedOrg = response.items.find((o) => o.id === persistedOrgId) || null;
          if (!selectedOrg) {
            console.log(`[OrgContext] Persisted org ${persistedOrgId} not found in list`);
          }
        }

        if (!selectedOrg && response.items.length > 0) {
          // Default to first org
          selectedOrg = response.items[0];
          console.log(`[OrgContext] Defaulting to first org: ${selectedOrg.name}`);
        }

        if (selectedOrg) {
          setCurrentOrg(selectedOrg);
          persistOrgSelection(selectedOrg);
        }

        setError(null);
        retryCount = 0; // Reset on success
        console.log(`[OrgContext] Initialized with ${response.items.length} orgs, current: ${selectedOrg?.name || 'none'}`);
        setIsLoading(false);
        setIsInitialized(true);
      } catch (err) {
        if (!isMounted) return;

        const message = err instanceof Error ? err.message : 'Failed to initialize organizations';
        const isAuthError = message.includes('Authentication required') ||
                           message.includes('401') ||
                           message.includes('Unauthorized');

        // Retry with exponential backoff for auth errors
        if (isAuthError && retryCount < MAX_RETRIES) {
          const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
          console.log(`[OrgContext] Auth not ready, retrying in ${delay}ms... (${retryCount + 1}/${MAX_RETRIES})`);
          retryCount++;
          setTimeout(() => {
            if (isMounted) {
              initialize();
            }
          }, delay);
          return; // Don't set error/initialized yet
        }

        console.error('[OrgContext] Initialization failed:', message);
        setError(message);
        setIsLoading(false);
        setIsInitialized(true);
      }
    };

    initialize();

    // Also listen for auth-ready events to re-initialize
    const handleAuthReady = () => {
      console.log('[OrgContext] Auth ready event received, re-initializing...');
      retryCount = 0;
      initialize();
    };

    window.addEventListener('auth-ready', handleAuthReady);

    return () => {
      isMounted = false;
      window.removeEventListener('auth-ready', handleAuthReady);
    };
  }, [getPersistedOrgId, persistOrgSelection]);

  // =====================================================
  // Context Value
  // =====================================================

  const value = useMemo<OrganizationContextValue>(
    () => ({
      // State
      currentOrg,
      organizations,
      totalOrgs,
      isLoading,
      isInitialized,
      error,
      currentRole,
      permissions,
      // Actions
      switchOrganization,
      refreshOrganizations,
      createOrganization,
      leaveCurrentOrg,
      clearOrganization,
    }),
    [
      currentOrg,
      organizations,
      totalOrgs,
      isLoading,
      isInitialized,
      error,
      currentRole,
      permissions,
      switchOrganization,
      refreshOrganizations,
      createOrganization,
      leaveCurrentOrg,
      clearOrganization,
    ]
  );

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

// =====================================================
// Hook
// =====================================================

export function useOrganization(): OrganizationContextValue {
  const context = useContext(OrganizationContext);

  if (!context) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }

  return context;
}

// =====================================================
// Utility: Get current org outside of React
// Re-exports from cnsApi.ts for convenience
// =====================================================

// Re-export storage utilities for use outside React components
export { getCurrentOrganizationId } from '../services/cnsApi';

/**
 * Get the current organization name from localStorage.
 */
export function getCurrentOrganizationName(): string | null {
  return localStorage.getItem(STORAGE_KEY_ORG_NAME);
}

// =====================================================
// Export
// =====================================================

export default OrganizationContext;
