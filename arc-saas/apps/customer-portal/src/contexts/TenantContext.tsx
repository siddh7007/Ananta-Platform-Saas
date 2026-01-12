import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Tenant } from '@/types/tenant';
import { useAuth } from './AuthContext';
import { env } from '@/config/env';

/**
 * Error codes for tenant-related issues
 */
export type TenantErrorCode =
  | 'NO_TENANT_ACCESS'      // User has no tenant assigned or tenant doesn't exist
  | 'TENANT_FETCH_FAILED'   // API call to fetch tenants failed
  | 'NO_TOKEN'              // No access token available
  | 'NETWORK_ERROR'         // Network connectivity issue
  | 'INVALID_AUDIENCE';     // JWT audience validation failed

export interface TenantError {
  code: TenantErrorCode;
  message: string;
  details?: string;
}

interface TenantContextType {
  tenants: Tenant[];
  currentTenant: Tenant | null;
  isLoading: boolean;
  error: string | null;
  /** Structured error for better error handling */
  tenantError: TenantError | null;
  selectTenant: (tenantId: string) => void;
  refreshTenants: () => Promise<void>;
  isSuperAdmin: boolean;
  /** Clear the tenant error (e.g., before retry) */
  clearError: () => void;
}

const TenantContext = createContext<TenantContextType | null>(null);

const TENANT_STORAGE_KEY = 'cbp_selected_tenant';

interface TenantProviderProps {
  children: ReactNode;
}

export function TenantProvider({ children }: TenantProviderProps) {
  const { user, isAuthenticated, getAccessToken } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tenantError, setTenantError] = useState<TenantError | null>(null);

  const isSuperAdmin = user?.role === 'super_admin';

  const clearError = useCallback(() => {
    setError(null);
    setTenantError(null);
  }, []);

  const fetchTenants = useCallback(async () => {
    if (!isAuthenticated) {
      setTenants([]);
      setCurrentTenant(null);
      setIsLoading(false);
      return;
    }

    const token = getAccessToken();
    if (!token) {
      const tokenError: TenantError = {
        code: 'NO_TOKEN',
        message: 'Authentication required',
        details: 'No access token available. Please log in again.',
      };
      setError(tokenError.message);
      setTenantError(tokenError);
      setIsLoading(false);
      console.error('[TenantContext] No access token available');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setTenantError(null);

      // Fetch user's assigned tenant (use my-tenants for all users)
      // Super admin access to all tenants is handled separately in admin UI
      const apiUrl = `${env.api.platform}/tenants/my-tenants`;
      console.log('[TenantContext] Fetching from:', apiUrl);
      console.log('[TenantContext] Token length:', token?.length);
      console.log('[TenantContext] User role:', user?.role);

      const response = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('[TenantContext] Response status:', response.status);
      console.log('[TenantContext] Response ok:', response.ok);

      if (!response.ok) {
        // Handle different HTTP errors
        const errMsg = `Failed to fetch tenants: ${response.status} ${response.statusText}`;
        console.error('[TenantContext]', errMsg);

        const fetchError: TenantError = {
          code: 'TENANT_FETCH_FAILED',
          message: 'Unable to load workspace',
          details: response.status === 401
            ? 'Your session has expired. Please log in again.'
            : response.status === 403
            ? 'You do not have permission to access any workspaces.'
            : `Server error (${response.status}). Please try again later.`,
        };
        setError(fetchError.message);
        setTenantError(fetchError);
        setIsLoading(false);
        return;
      }

      // Debug: log response details before parsing
      const responseText = await response.text();
      console.log('[TenantContext] Response text:', responseText.substring(0, 200));

      const data = JSON.parse(responseText);
      const tenantList: Tenant[] = data.data || data || [];

      // CRITICAL: Check if user has any tenants assigned
      if (tenantList.length === 0) {
        const noTenantError: TenantError = {
          code: 'NO_TENANT_ACCESS',
          message: 'No workspace access',
          details: `Your account (${user?.email || user?.id || 'unknown'}) is not associated with any workspace. Please contact your administrator to be added to a workspace, or sign up for a new account.`,
        };
        console.error('[TenantContext] User has no tenant access:', user?.id);
        setError(noTenantError.message);
        setTenantError(noTenantError);
        setTenants([]);
        setCurrentTenant(null);
        setIsLoading(false);
        return;
      }

      setTenants(tenantList);

      // Restore previously selected tenant or select first
      const savedTenantId = localStorage.getItem(TENANT_STORAGE_KEY);
      const savedTenant = savedTenantId
        ? tenantList.find((t) => t.id === savedTenantId)
        : null;

      if (savedTenant) {
        setCurrentTenant(savedTenant);
      } else if (tenantList.length > 0) {
        setCurrentTenant(tenantList[0]);
        localStorage.setItem(TENANT_STORAGE_KEY, tenantList[0].id);
      }
    } catch (err) {
      console.error('[TenantContext] Failed to fetch tenants:', err);

      // Check for network errors - covers various browser implementations:
      // - Chrome/Edge: "TypeError: Failed to fetch"
      // - Firefox: "TypeError: NetworkError when attempting to fetch resource"
      // - Network down, CORS, DNS failures, connection refused
      const isNetworkError =
        err instanceof TypeError &&
        (err.message.includes('NetworkError') ||
          err.message.includes('Failed to fetch') ||
          err.message.includes('Network request failed') ||
          err.message.includes('fetch'));

      const tenantFetchError: TenantError = isNetworkError
        ? {
            code: 'NETWORK_ERROR',
            message: 'Connection failed',
            details: 'Unable to connect to the server. Please check your internet connection and try again.',
          }
        : {
            code: 'TENANT_FETCH_FAILED',
            message: 'Failed to load workspace',
            details: err instanceof Error ? err.message : 'An unexpected error occurred.',
          };

      setError(tenantFetchError.message);
      setTenantError(tenantFetchError);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, getAccessToken, isSuperAdmin, user?.tenantId, user?.email, user?.id]);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  const selectTenant = useCallback(
    (tenantId: string) => {
      const tenant = tenants.find((t) => t.id === tenantId);
      if (tenant) {
        setCurrentTenant(tenant);
        localStorage.setItem(TENANT_STORAGE_KEY, tenantId);
      }
    },
    [tenants]
  );

  const refreshTenants = useCallback(async () => {
    await fetchTenants();
  }, [fetchTenants]);

  return (
    <TenantContext.Provider
      value={{
        tenants,
        currentTenant,
        isLoading,
        error,
        tenantError,
        selectTenant,
        refreshTenants,
        isSuperAdmin,
        clearError,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}

/**
 * Hook to get the current tenant ID for API requests
 */
export function useTenantId(): string | null {
  const { currentTenant } = useTenant();
  return currentTenant?.id ?? null;
}

/**
 * IMPORTANT: App Plane Tenant ID = Organization ID Mapping
 *
 * In our multi-tenant architecture:
 * - Control Plane uses "tenant" terminology (tenant_id, tenantId)
 * - App Plane/CNS uses "organization" terminology (organization_id)
 *
 * These are THE SAME concept - just named differently based on the layer.
 * The tenant.id from Control Plane IS the organization_id for App Plane APIs.
 *
 * Use this hook when calling CNS/App Plane APIs that require organization_id.
 */
export function useOrganizationId(): string | null {
  const { currentTenant } = useTenant();
  // tenant.id IS organization_id for App Plane APIs
  return currentTenant?.id ?? null;
}
