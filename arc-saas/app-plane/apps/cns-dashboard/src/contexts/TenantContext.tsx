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

import React, { createContext, useContext, useState, useCallback } from 'react';

interface TenantContextType {
  tenantId: string;
  setTenantId: (tenantId: string) => void;
  organizationId?: string;
  setOrganizationId: (organizationId: string | undefined) => void;
  adminModeAllTenants: boolean;
  setAdminModeAllTenants: (enabled: boolean) => void;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

const STORAGE_KEY = 'cns_dashboard_tenant_id';
const ORG_STORAGE_KEY = 'cns_dashboard_organization_id';
const ADMIN_ALL_TENANTS_KEY = 'cns_admin_mode_all_tenants';

// Default tenant for CNS staff (Platform Super Admin organization)
// Uses environment variable with fallback to seeded default
const DEFAULT_TENANT_ID = import.meta.env.VITE_PLATFORM_ORG_ID || 'a0000000-0000-0000-0000-000000000000';

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

  const [adminModeAllTenants, setAdminModeAllTenantsState] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return localStorage.getItem(ADMIN_ALL_TENANTS_KEY) === 'true';
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

  return (
    <TenantContext.Provider value={{ tenantId, setTenantId, organizationId, setOrganizationId, adminModeAllTenants, setAdminModeAllTenants }}>
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
