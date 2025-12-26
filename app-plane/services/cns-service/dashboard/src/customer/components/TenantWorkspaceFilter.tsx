/**
 * TenantWorkspaceFilter Component
 *
 * Filter bar for Customer Portal that allows CNS staff to select a specific
 * tenant (organization) and workspace. Scopes all data displayed in tabs below.
 *
 * Uses real API data from:
 * - /admin/tenants - List all tenants (organizations)
 * - /workspaces?organization_id={tenantId} - List workspaces for a tenant
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import ClearIcon from '@mui/icons-material/Clear';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import AsyncAutocomplete, { Option } from '../../components/AsyncAutocomplete';
import { API_CONFIG, getAuthHeaders } from '../../config/api';

export interface TenantWorkspaceFilterProps {
  selectedTenantId: string | null;
  selectedWorkspaceId: string | null;
  onTenantChange: (tenantId: string | null) => void;
  onWorkspaceChange: (workspaceId: string | null) => void;
  adminModeAllTenants?: boolean;
  onAdminModeChange?: (enabled: boolean) => void;
  onRefresh?: () => void;
}

const ADMIN_MODE_KEY = 'cns_customer_portal_admin_mode';

export default function TenantWorkspaceFilter({
  selectedTenantId,
  selectedWorkspaceId,
  onTenantChange,
  onWorkspaceChange,
  adminModeAllTenants: adminModeProp,
  onAdminModeChange,
  onRefresh,
}: TenantWorkspaceFilterProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // AbortController refs for cancelling in-flight requests
  const tenantAbortRef = useRef<AbortController | null>(null);
  const workspaceAbortRef = useRef<AbortController | null>(null);

  // Helper to safely read from localStorage (SSR-safe with error handling)
  const safeLocalStorageGet = (key: string, defaultValue: string | null = null): string | null => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.warn('localStorage read error:', error);
      return defaultValue;
    }
  };

  // Helper to safely write to localStorage (SSR-safe with error handling)
  const safeLocalStorageSet = (key: string, value: string): boolean => {
    if (typeof window === 'undefined') return false;
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.warn('localStorage write error:', error);
      return false;
    }
  };

  // Local admin mode state (if not controlled externally)
  const [localAdminMode, setLocalAdminMode] = useState<boolean>(() => {
    return safeLocalStorageGet(ADMIN_MODE_KEY) === 'true';
  });

  const adminModeAllTenants = adminModeProp ?? localAdminMode;

  // Selected options for controlled display
  const [tenantOption, setTenantOption] = useState<Option | null>(null);
  const [workspaceOption, setWorkspaceOption] = useState<Option | null>(null);

  // Error states for displaying API issues
  const [tenantError, setTenantError] = useState<string | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  // Fetch tenants from admin endpoint (real API only)
  const loadTenants = useCallback(async (query: string): Promise<Option[]> => {
    // Cancel any in-flight tenant request
    if (tenantAbortRef.current) {
      tenantAbortRef.current.abort();
    }
    tenantAbortRef.current = new AbortController();
    const { signal } = tenantAbortRef.current;

    setTenantError(null);
    try {
      const url = new URL(`${API_CONFIG.BASE_URL}/admin/tenants`, window.location.origin);
      if (query) url.searchParams.set('search', query);
      url.searchParams.set('limit', '50');

      const response = await fetch(url.toString(), {
        headers: getAuthHeaders(),
        signal,
      });

      // Check if request was aborted
      if (signal.aborted) {
        return [];
      }

      if (!response.ok) {
        const errorMsg = `API error: ${response.status} ${response.statusText}`;
        console.error('Failed to fetch tenants:', errorMsg);
        setTenantError(errorMsg);
        return [];
      }

      const data = await response.json();

      // Robust API response validation
      let tenants: unknown[];
      if (Array.isArray(data)) {
        tenants = data;
      } else if (data && typeof data === 'object') {
        // Handle { items: [...] }, { data: [...] }, or other envelope formats
        const itemsArray = data.items ?? data.data ?? data.tenants ?? data.results;
        tenants = Array.isArray(itemsArray) ? itemsArray : [];
      } else {
        console.warn('Unexpected API response format for tenants:', typeof data);
        tenants = [];
      }

      if (tenants.length === 0) {
        console.log('No tenants found in database');
        return [];
      }

      // Validate and transform each tenant object
      return tenants
        .filter((tenant): tenant is { id: string; name?: string; key?: string } => {
          return tenant !== null && typeof tenant === 'object' && 'id' in tenant && typeof (tenant as { id: unknown }).id === 'string';
        })
        .map((tenant) => ({
          id: tenant.id,
          label: tenant.name
            ? `${tenant.name} (${tenant.id.substring(0, 8)}...)`
            : tenant.key || tenant.id.substring(0, 8),
        }));
    } catch (error) {
      // Ignore abort errors - they're expected when user types quickly
      if (error instanceof Error && error.name === 'AbortError') {
        return [];
      }
      const errorMsg = error instanceof Error ? error.message : 'Network error';
      console.error('Error loading tenants:', errorMsg);
      setTenantError(errorMsg);
      return [];
    }
  }, []);

  // Fetch workspaces scoped by selected tenant (real API only)
  const loadWorkspaces = useCallback(
    async (query: string): Promise<Option[]> => {
      if (!selectedTenantId) return [];

      // Cancel any in-flight workspace request
      if (workspaceAbortRef.current) {
        workspaceAbortRef.current.abort();
      }
      workspaceAbortRef.current = new AbortController();
      const { signal } = workspaceAbortRef.current;

      setWorkspaceError(null);

      try {
        const url = new URL(`${API_CONFIG.BASE_URL}/workspaces`, window.location.origin);
        url.searchParams.set('organization_id', selectedTenantId);
        if (query) url.searchParams.set('search', query);
        url.searchParams.set('limit', '50');

        const response = await fetch(url.toString(), {
          headers: getAuthHeaders(),
          signal,
        });

        // Check if request was aborted
        if (signal.aborted) {
          return [];
        }

        if (!response.ok) {
          const errorMsg = `API error: ${response.status} ${response.statusText}`;
          console.error('Failed to fetch workspaces:', errorMsg);
          setWorkspaceError(errorMsg);
          return [];
        }

        const data = await response.json();

        // Robust API response validation
        let workspaces: unknown[];
        if (Array.isArray(data)) {
          workspaces = data;
        } else if (data && typeof data === 'object') {
          // Handle { items: [...] }, { data: [...] }, or other envelope formats
          const itemsArray = data.items ?? data.data ?? data.workspaces ?? data.results;
          workspaces = Array.isArray(itemsArray) ? itemsArray : [];
        } else {
          console.warn('Unexpected API response format for workspaces:', typeof data);
          workspaces = [];
        }

        if (workspaces.length === 0) {
          console.log('No workspaces found for tenant:', selectedTenantId);
          return [];
        }

        // Validate and transform each workspace object
        return workspaces
          .filter((ws): ws is { id: string; name?: string } => {
            return ws !== null && typeof ws === 'object' && 'id' in ws && typeof (ws as { id: unknown }).id === 'string';
          })
          .map((ws) => ({
            id: ws.id,
            label: ws.name || ws.id.substring(0, 8),
          }));
      } catch (error) {
        // Ignore abort errors - they're expected when user types quickly
        if (error instanceof Error && error.name === 'AbortError') {
          return [];
        }
        const errorMsg = error instanceof Error ? error.message : 'Network error';
        console.error('Error loading workspaces:', errorMsg);
        setWorkspaceError(errorMsg);
        return [];
      }
    },
    [selectedTenantId]
  );

  // Handle tenant selection
  const handleTenantChange = useCallback(
    (opt: Option | null) => {
      setTenantOption(opt);
      onTenantChange(opt?.id ?? null);
      // Clear workspace when tenant changes
      setWorkspaceOption(null);
      onWorkspaceChange(null);
      setWorkspaceError(null);
    },
    [onTenantChange, onWorkspaceChange]
  );

  // Handle workspace selection
  const handleWorkspaceChange = useCallback(
    (opt: Option | null) => {
      setWorkspaceOption(opt);
      onWorkspaceChange(opt?.id ?? null);
    },
    [onWorkspaceChange]
  );

  // Handle admin mode toggle
  const handleAdminModeToggle = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const enabled = event.target.checked;
      setLocalAdminMode(enabled);
      safeLocalStorageSet(ADMIN_MODE_KEY, enabled ? 'true' : 'false');
      onAdminModeChange?.(enabled);
    },
    [onAdminModeChange]
  );

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setTenantOption(null);
    setWorkspaceOption(null);
    onTenantChange(null);
    onWorkspaceChange(null);
    setTenantError(null);
    setWorkspaceError(null);
  }, [onTenantChange, onWorkspaceChange]);

  // Cleanup: Cancel any in-flight requests on unmount
  useEffect(() => {
    return () => {
      if (tenantAbortRef.current) {
        tenantAbortRef.current.abort();
      }
      if (workspaceAbortRef.current) {
        workspaceAbortRef.current.abort();
      }
    };
  }, []);

  // Sync local state with controlled props when they change externally
  // This handles cases where parent component changes selectedTenantId/selectedWorkspaceId
  useEffect(() => {
    // If tenant ID changes externally and we have a stale option, clear it
    if (selectedTenantId === null && tenantOption !== null) {
      setTenantOption(null);
    }
    // If workspace ID changes externally and we have a stale option, clear it
    if (selectedWorkspaceId === null && workspaceOption !== null) {
      setWorkspaceOption(null);
    }
  }, [selectedTenantId, selectedWorkspaceId, tenantOption, workspaceOption]);

  // Sync admin mode with external prop changes
  useEffect(() => {
    if (adminModeProp !== undefined && adminModeProp !== localAdminMode) {
      setLocalAdminMode(adminModeProp);
    }
  }, [adminModeProp, localAdminMode]);

  return (
    <Box
      sx={{
        p: 2,
        bgcolor: 'background.paper',
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Stack
        direction={isMobile ? 'column' : 'row'}
        spacing={2}
        alignItems={isMobile ? 'stretch' : 'center'}
        flexWrap="wrap"
      >
        {/* Tenant Dropdown */}
        <Box sx={{ minWidth: 280, flexGrow: isMobile ? 1 : 0 }}>
          <AsyncAutocomplete
            label="Tenant (Organization)"
            value={tenantOption}
            onChange={handleTenantChange}
            loadOptions={loadTenants}
            placeholder="Search tenants..."
            sx={{ width: '100%' }}
          />
          {tenantError && (
            <Typography variant="caption" color="error" sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
              <WarningAmberIcon sx={{ fontSize: 14, mr: 0.5 }} />
              {tenantError}
            </Typography>
          )}
        </Box>

        {/* Workspace Dropdown */}
        <Box sx={{ minWidth: 280, flexGrow: isMobile ? 1 : 0 }}>
          <AsyncAutocomplete
            label="Workspace"
            value={workspaceOption}
            onChange={handleWorkspaceChange}
            loadOptions={loadWorkspaces}
            placeholder="Select workspace..."
            disabled={!selectedTenantId}
            sx={{ width: '100%' }}
          />
          {workspaceError && (
            <Typography variant="caption" color="error" sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
              <WarningAmberIcon sx={{ fontSize: 14, mr: 0.5 }} />
              {workspaceError}
            </Typography>
          )}
        </Box>

        {/* Admin Mode Toggle */}
        <Tooltip title="When enabled, queries bypass tenant filter to show all data">
          <FormControlLabel
            control={
              <Checkbox
                checked={adminModeAllTenants}
                onChange={handleAdminModeToggle}
                size="small"
              />
            }
            label="Show All Tenants"
            sx={{ ml: isMobile ? 0 : 1, whiteSpace: 'nowrap' }}
          />
        </Tooltip>

        {/* Action Buttons */}
        <Stack direction="row" spacing={1} sx={{ ml: isMobile ? 0 : 'auto' }}>
          <Tooltip title="Refresh data">
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={onRefresh}
            >
              Refresh
            </Button>
          </Tooltip>

          <Tooltip title="Clear all filters">
            <Button
              variant="outlined"
              size="small"
              color="secondary"
              startIcon={<ClearIcon />}
              onClick={handleClearFilters}
              disabled={!selectedTenantId && !selectedWorkspaceId}
            >
              Clear
            </Button>
          </Tooltip>
        </Stack>
      </Stack>
    </Box>
  );
}
