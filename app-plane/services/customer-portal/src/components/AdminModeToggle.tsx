import React from 'react';
import { Box, Chip, FormControlLabel, Switch, Tooltip } from '@mui/material';
import { useRefresh } from 'react-admin';

const ADMIN_MODE_KEY = 'admin_mode_all_tenants';

/**
 * Check if user has platform:super_admin role from Auth0
 * Auth0 roles are stored in localStorage as JSON array during login
 */
function hasPlatformSuperAdminRole(): boolean {
  try {
    const rolesJson = localStorage.getItem('auth0_roles');
    if (!rolesJson) return false;
    const roles: string[] = JSON.parse(rolesJson);
    return roles.includes('platform:super_admin');
  } catch {
    return false;
  }
}

export const AdminModeToggle: React.FC = () => {
  const refresh = useRefresh();
  const [isPlatformSuperAdmin, setIsPlatformSuperAdmin] = React.useState<boolean>(false);
  const [enabled, setEnabled] = React.useState<boolean>(false);

  // Check roles on mount and when localStorage changes
  const checkRoles = React.useCallback(() => {
    const isSuperAdmin = hasPlatformSuperAdminRole();
    console.log('[AdminModeToggle] Checking roles:', {
      auth0_roles: localStorage.getItem('auth0_roles'),
      isSuperAdmin
    });
    setIsPlatformSuperAdmin(isSuperAdmin);
    setEnabled(localStorage.getItem(ADMIN_MODE_KEY) === 'true');
  }, []);

  React.useEffect(() => {
    checkRoles();
  }, [checkRoles]);

  if (!isPlatformSuperAdmin) return null;

  const handleToggle = (_: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
    setEnabled(checked);
    localStorage.setItem(ADMIN_MODE_KEY, checked ? 'true' : 'false');
    refresh();
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 2 }}>
      <Chip label="Super Admin" color="secondary" size="small" />
      <Tooltip title={enabled ? 'Showing all tenants (Platform Super Admin mode)' : 'Showing current tenant only'}>
        <FormControlLabel
          control={<Switch checked={enabled} onChange={handleToggle} size="small" />}
          label={enabled ? 'All tenants' : 'My tenant'}
          sx={{ color: 'white' }}
        />
      </Tooltip>
    </Box>
  );
};
