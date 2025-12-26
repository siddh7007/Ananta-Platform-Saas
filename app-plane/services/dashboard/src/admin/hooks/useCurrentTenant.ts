import { useState, useEffect, useCallback } from 'react';
import { useTenant } from '@/admin/contexts/TenantContext';
import { apiClient, buildResourcePath } from '@/admin/lib/apiClient';
import type { AxiosError } from 'axios';
import type { EnhancedError } from '@/admin/lib/errorMapping';
import type { Tenant } from './useTenants';

/**
 * Return type for useCurrentTenant hook
 */
export interface UseCurrentTenantResult {
  /** Current tenant data */
  tenant: Tenant | null;
  /** Loading state */
  loading: boolean;
  /** Error message (if any) */
  error: string | null;
  /** Refetch function to manually trigger fetch */
  refetch: () => Promise<void>;
}

/**
 * Custom hook to fetch current tenant details
 *
 * Uses the active tenant ID from TenantContext and fetches
 * full tenant details from the API.
 *
 * @example
 * ```tsx
 * const { tenant, loading, error } = useCurrentTenant();
 *
 * if (loading) return <Spinner />;
 * if (error) return <Error message={error} />;
 * if (!tenant) return <NoTenantSelected />;
 *
 * return <div>Current Tenant: {tenant.name}</div>;
 * ```
 */
export function useCurrentTenant(): UseCurrentTenantResult {
  const { tenantId } = useTenant();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCurrentTenant = useCallback(async () => {
    // Reset state if no tenant selected
    if (!tenantId) {
      setTenant(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Try /tenants/current first (may not exist), fallback to /tenants/:id
      let response;
      try {
        response = await apiClient.get(buildResourcePath('/tenants/current'));
      } catch (err) {
        // Fallback to direct ID lookup
        response = await apiClient.get(buildResourcePath(`/tenants/${tenantId}`));
      }

      // Handle different response formats
      const data = response.data?.data || response.data;
      setTenant(data);
    } catch (err) {
      const enhancedError = err as EnhancedError;
      setError(enhancedError.friendlyMessage || 'Failed to fetch current tenant');
      setTenant(null);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  // Fetch when tenant ID changes
  useEffect(() => {
    fetchCurrentTenant();
  }, [fetchCurrentTenant]);

  return {
    tenant,
    loading,
    error,
    refetch: fetchCurrentTenant,
  };
}
