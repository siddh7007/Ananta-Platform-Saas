import { Box, Chip, Switch, Tooltip, Typography } from '@mui/material';
import { useTenant } from '../contexts/TenantContext';

const ROLE_KEY = 'cns_role';

export default function AdminModeToggleDashboard() {
  const { adminModeAllTenants, setAdminModeAllTenants } = useTenant();
  const role = (localStorage.getItem(ROLE_KEY) as 'admin' | 'customer') || 'admin';

  if (role !== 'admin') return null;

  const handleToggle = (_: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
    setAdminModeAllTenants(checked);
    // Consumers can listen to storage event or context change; pages should re-read context
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pr: 2 }}>
      <Chip label="Admin" color="secondary" size="small" />
      <Tooltip
        title={adminModeAllTenants
          ? 'Tenant Enabled: All tenants + CNS admin tasks'
          : 'CNS Admin only: Tenant section disabled'}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Left label corresponds to switch OFF */}
          <Typography variant="body2" sx={{ fontSize: 13, fontWeight: !adminModeAllTenants ? 700 : 400 }}>
            CNS Admin only
          </Typography>
          <Switch checked={adminModeAllTenants} onChange={handleToggle} size="small" />
          {/* Right label corresponds to switch ON */}
          <Typography variant="body2" sx={{ fontSize: 13, fontWeight: adminModeAllTenants ? 700 : 400 }}>
            Tenant Enabled
          </Typography>
        </Box>
      </Tooltip>
    </Box>
  );
}
