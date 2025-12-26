import { AppBar, UserMenu } from 'react-admin';
import { Box } from '@mui/material';
import AdminModeToggleDashboard from './components/AdminModeToggleDashboard';

export default function CustomAppBar(props: any) {
  return (
    <AppBar {...props} userMenu={<UserMenu />}>
      <Box sx={{ flex: 1 }} />
      <AdminModeToggleDashboard />
    </AppBar>
  );
}

