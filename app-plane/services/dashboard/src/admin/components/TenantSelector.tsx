import React, { useEffect } from 'react';
import { useTenant } from '@/admin/contexts/TenantContext';
import { useTenants } from '@/admin/hooks';
import { Select, MenuItem, FormControl, InputLabel, CircularProgress, SelectChangeEvent } from '@mui/material';

/**
 * TenantSelector Component
 *
 * Displays a dropdown to select the active tenant.
 * Fetches tenant list dynamically from the API, with fallback to env vars.
 */
export const TenantSelector: React.FC = () => {
  const { tenantId, setTenantId } = useTenant();

  // Fetch tenants from API
  const { tenants, loading, error } = useTenants({
    sort: { field: 'name', order: 'asc' },
    enabled: true,
  });

  // Fallback to environment variables if API fails
  const envTenants = (process.env.NEXT_PUBLIC_TENANT_OPTIONS || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  // Use API tenants if available, otherwise use env tenants
  const availableTenants = tenants.length > 0 ? tenants : envTenants.map((id) => ({ id, name: id }));

  // Auto-select first tenant if none selected
  useEffect(() => {
    if (!tenantId && availableTenants.length > 0) {
      setTenantId(availableTenants[0].id);
    }
  }, [tenantId, availableTenants, setTenantId]);

  const handleChange = (event: SelectChangeEvent<string>) => {
    setTenantId(event.target.value);
  };

  // Hide selector if no tenants available
  if (!loading && availableTenants.length === 0) {
    return null;
  }

  return (
    <FormControl size="small" sx={{ minWidth: 200 }}>
      <InputLabel id="tenant-selector-label">Tenant</InputLabel>
      <Select
        labelId="tenant-selector-label"
        value={tenantId || ''}
        label="Tenant"
        onChange={handleChange}
        disabled={loading}
        endAdornment={
          loading ? (
            <CircularProgress size={20} sx={{ position: 'absolute', right: 32 }} />
          ) : null
        }
      >
        {availableTenants.map((tenant) => (
          <MenuItem key={typeof tenant === 'string' ? tenant : tenant.id} value={typeof tenant === 'string' ? tenant : tenant.id}>
            {typeof tenant === 'string' ? tenant : tenant.name}
          </MenuItem>
        ))}
      </Select>
      {error && (
        <div style={{ fontSize: '0.75rem', color: '#d32f2f', marginTop: '4px' }}>
          {error} (using fallback)
        </div>
      )}
    </FormControl>
  );
};
