/**
 * Tenant Context Provider
 *
 * Provides tenant_id context to all components, eliminating hardcoded tenant values.
 * Persists tenant selection in localStorage for convenience during development.
 *
 * Usage:
 *   const { tenantId, setTenantId } = useTenant();
 *
 *   // Use in API calls
 *   body: JSON.stringify({
 *     tenant_id: tenantId,
 *     ...otherData
 *   })
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

interface TenantContextType {
  tenantId: string;
  setTenantId: (tenantId: string) => void;
  organizationId?: string;
  setOrganizationId: (organizationId: string | undefined) => void;
  adminModeAllTenants: boolean;
  setAdminModeAllTenants: (enabled: boolean) => void;

  // Workspace context
  workspaceId: string | null;
  setWorkspaceId: (id: string | null) => void;

  // Project context
  projectId: string | null;
  setProjectId: (id: string | null) => void;

  // Clear workspace/project when org changes
  clearWorkspaceContext: () => void;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

const STORAGE_KEY = 'cns_dashboard_tenant_id';
const ORG_STORAGE_KEY = 'cns_dashboard_organization_id';
const ADMIN_ALL_TENANTS_KEY = 'cns_admin_mode_all_tenants';
const WORKSPACE_STORAGE_KEY = 'cns_workspace_id';
const PROJECT_STORAGE_KEY = 'cns_project_id';

// Default tenant for CNS staff (Platform Super Admin organization)
const DEFAULT_TENANT_ID = 'a0000000-0000-0000-0000-000000000000';

const resolveInitialIds = () => {
  if (typeof window === 'undefined') {
    return {
      tenant: DEFAULT_TENANT_ID,
      organization: DEFAULT_TENANT_ID,
    };
  }

  const storedTenant = localStorage.getItem(STORAGE_KEY);
  const storedOrganization = localStorage.getItem(ORG_STORAGE_KEY);
  const fallback = storedOrganization || storedTenant || DEFAULT_TENANT_ID;

  return {
    tenant: storedTenant ?? fallback,
    organization: storedOrganization ?? fallback,
  };
};

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialIds = resolveInitialIds();

  // Initialize from localStorage or use default (organization + tenant stay in sync)
  const [tenantId, setTenantIdState] = useState<string>(initialIds.tenant);

  const [organizationId, setOrganizationIdState] = useState<string | undefined>(initialIds.organization);

  // Super admin always has full access - adminModeAllTenants is always true
  // The toggle was removed as super admins should have all access all the time
  const [adminModeAllTenants, setAdminModeAllTenantsState] = useState<boolean>(true);

  // Workspace and project context (optional, null when not selected)
  const [workspaceId, setWorkspaceIdState] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(WORKSPACE_STORAGE_KEY);
  });

  const [projectId, setProjectIdState] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(PROJECT_STORAGE_KEY);
  });

  // Persist tenant_id to localStorage when it changes
  const setTenantId = useCallback((newTenantId: string) => {
    setTenantIdState(newTenantId);
    if (newTenantId) {
      localStorage.setItem(STORAGE_KEY, newTenantId);
      setOrganizationIdState(newTenantId);
      localStorage.setItem(ORG_STORAGE_KEY, newTenantId);
    } else {
      localStorage.removeItem(STORAGE_KEY);
      setOrganizationIdState(undefined);
      localStorage.removeItem(ORG_STORAGE_KEY);
    }
  }, []);

  // Persist organization_id to localStorage when it changes (and mirror tenant)
  const setOrganizationId = useCallback((newOrganizationId: string | undefined) => {
    if (newOrganizationId) {
      setOrganizationIdState(newOrganizationId);
      localStorage.setItem(ORG_STORAGE_KEY, newOrganizationId);
      setTenantIdState(newOrganizationId);
      localStorage.setItem(STORAGE_KEY, newOrganizationId);
    } else {
      setOrganizationIdState(undefined);
      localStorage.removeItem(ORG_STORAGE_KEY);
      setTenantIdState('');
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const setAdminModeAllTenants = useCallback((enabled: boolean) => {
    setAdminModeAllTenantsState(enabled);
    localStorage.setItem(ADMIN_ALL_TENANTS_KEY, enabled ? 'true' : 'false');
  }, []);

  // Workspace ID setter with localStorage persistence
  const setWorkspaceId = useCallback((newWorkspaceId: string | null) => {
    setWorkspaceIdState(newWorkspaceId);
    if (newWorkspaceId) {
      localStorage.setItem(WORKSPACE_STORAGE_KEY, newWorkspaceId);
    } else {
      localStorage.removeItem(WORKSPACE_STORAGE_KEY);
    }
    // Clear project when workspace changes
    setProjectIdState(null);
    localStorage.removeItem(PROJECT_STORAGE_KEY);
  }, []);

  // Project ID setter with localStorage persistence
  const setProjectId = useCallback((newProjectId: string | null) => {
    setProjectIdState(newProjectId);
    if (newProjectId) {
      localStorage.setItem(PROJECT_STORAGE_KEY, newProjectId);
    } else {
      localStorage.removeItem(PROJECT_STORAGE_KEY);
    }
  }, []);

  // Clear workspace and project context
  const clearWorkspaceContext = useCallback(() => {
    setWorkspaceIdState(null);
    setProjectIdState(null);
    localStorage.removeItem(WORKSPACE_STORAGE_KEY);
    localStorage.removeItem(PROJECT_STORAGE_KEY);
  }, []);

  // Auto-clear workspace/project when organization changes
  useEffect(() => {
    clearWorkspaceContext();
  }, [organizationId, clearWorkspaceContext]);

  return (
    <TenantContext.Provider
      value={{
        tenantId,
        setTenantId,
        organizationId,
        setOrganizationId,
        adminModeAllTenants,
        setAdminModeAllTenants,
        workspaceId,
        setWorkspaceId,
        projectId,
        setProjectId,
        clearWorkspaceContext,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = (): TenantContextType => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};

// Convenience hooks for specific context values
export function useTenantId(): string {
  const { tenantId } = useTenant();
  return tenantId;
}

export function useOrganizationId(): string | undefined {
  const { organizationId } = useTenant();
  return organizationId;
}

export function useWorkspaceId(): string | null {
  const { workspaceId } = useTenant();
  return workspaceId;
}

export function useProjectId(): string | null {
  const { projectId } = useTenant();
  return projectId;
}
