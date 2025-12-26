/**
 * Tenant Selector Component
 *
 * Dropdown selector for CNS super admin to switch between tenants/organizations.
 * Always visible in the app bar for super admins to select which organization to view.
 * Fetches available tenants from CNS admin API and persists selection via TenantContext.
 */

import { useState, useEffect } from 'react';
import { Box, FormControl, MenuItem, Select, SelectChangeEvent, Typography } from '@mui/material';
import { useTenant } from '../contexts/TenantContext';
import { CNS_API_URL } from '../config/api';
import { useNotification } from '../contexts/NotificationContext';
import { waitForAuth0Ready, subscribeToAuth0State, getAuth0State } from '../lib/auth/auth0/auth0State';
import { getToken as getKeycloakToken } from '../lib/keycloak';

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

export default function TenantSelector() {
  const { tenantId, setTenantId, setOrganizationId } = useTenant();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedTenant, setSelectedTenant] = useState<string>(tenantId || '');
  const { showWarning } = useNotification();
  const authProvider = (import.meta.env.VITE_AUTH_PROVIDER || 'auth0').toLowerCase();

  // Trigger re-fetch for Auth0 state changes only
  const [authRefreshKey, setAuthRefreshKey] = useState(0);
  useEffect(() => {
    if (authProvider !== 'auth0') return;
    const unsubscribe = subscribeToAuth0State(() => {
      setAuthRefreshKey((prev) => prev + 1);
    });
    return unsubscribe;
  }, [authProvider]);

  // Fetch available tenants from CNS Admin API (waits for Auth0 to be ready)
  useEffect(() => {
    let isMounted = true;

    const fallbackTenants: Tenant[] = [
      {
        id: 'a0000000-0000-0000-0000-000000000000',
        name: 'Platform Super Admin',
        slug: 'platform'
      }
    ];

    const fetchTenants = async () => {
      setLoading(true);
      try {
        // Get fresh token directly from Auth0 SDK
        const headers: Record<string, string> = { Accept: 'application/json' };
        if (authProvider === 'keycloak') {
          const token = await getKeycloakToken();
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
        } else {
          // Wait for Auth0 to finish loading
          const auth0State = await waitForAuth0Ready(10000, 2, true);
          if (!isMounted) return;

          // Only make API call if authenticated
          if (!auth0State.isAuthenticated) {
            console.log('[TenantSelector] User not authenticated yet, using fallback tenants');
            setTenants(fallbackTenants);
            setLoading(false);
            return;
          }

          if (auth0State.getAccessTokenSilently) {
            try {
              const token = await auth0State.getAccessTokenSilently();
              if (token) {
                headers['Authorization'] = `Bearer ${token}`;
              }
            } catch (tokenErr) {
              console.warn('[TenantSelector] Failed to get Auth0 token:', tokenErr);
            }
          }
        }
        if (!isMounted) return;

        const response = await fetch(`${CNS_API_URL}/admin/tenants?limit=200`, { headers });
        if (!isMounted) return;

        if (!response.ok) {
          throw new Error(`Admin tenants request failed (${response.status})`);
        }

        const payload = (await response.json()) as Tenant[];
        const normalizedTenants = (payload || []).map((tenant) => ({
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug || tenant.name || 'tenant',
        }));

        if (!isMounted) return;

        if (normalizedTenants.length > 0) {
          setTenants(normalizedTenants);
        } else {
          setTenants(fallbackTenants);
        }
      } catch (err) {
        if (!isMounted) return;
        console.warn('[TenantSelector] Failed to load organizations via CNS API:', err);
        showWarning('Failed to load organizations from CNS API. Using fallback list.');
        setTenants(fallbackTenants);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchTenants();

    return () => {
      isMounted = false;
    };
  }, [showWarning, authProvider, authRefreshKey]);  // Re-fetch when auth status changes

  // Sync selectedTenant with context tenantId
  useEffect(() => {
    setSelectedTenant(tenantId || '');
  }, [tenantId]);

  const handleTenantChange = (event: SelectChangeEvent<string>) => {
    const newTenantId = event.target.value;
    setSelectedTenant(newTenantId);
    setTenantId(newTenantId);
    setOrganizationId(newTenantId || undefined);
    console.log('[TenantSelector] Switched to organization:', newTenantId);
  };

  // Get current tenant name
  const currentTenant = tenants.find(t => t.id === selectedTenant);
  const currentTenantName = selectedTenant
    ? currentTenant?.name || 'Loading...'
    : 'All Organizations';

  // Always visible for super admins (CNS Dashboard is super admin only)
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pr: 2 }}>
      <FormControl size="small" sx={{ minWidth: 200 }}>
        <Select
          value={selectedTenant}
          onChange={handleTenantChange}
          disabled={loading || tenants.length === 0}
          displayEmpty
          sx={{
            fontSize: 13,
            '& .MuiSelect-select': {
              py: 0.5,
            }
          }}
        >
          {loading ? (
            <MenuItem value={selectedTenant}>Loading...</MenuItem>
          ) : tenants.length === 0 ? (
            <MenuItem value="">No organizations available</MenuItem>
          ) : (
            [
              <MenuItem key="all-tenants" value="">
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    All Organizations
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 11 }}>
                    Super Admin View
                  </Typography>
                </Box>
              </MenuItem>,
              ...tenants.map((tenant) => (
                <MenuItem key={tenant.id} value={tenant.id}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {tenant.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 11 }}>
                      {tenant.slug}
                    </Typography>
                  </Box>
                </MenuItem>
              )),
            ]
          )}
        </Select>
      </FormControl>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 11 }}>
        Selected: {currentTenantName}
      </Typography>
    </Box>
  );
}
