import { Menu } from 'react-admin';
import { Box, Typography } from '@mui/material';
import {
  Dashboard as DashboardIcon,
  BarChart as BarChartIcon,
  UploadFile as UploadFileIcon,
  CloudQueue as CloudQueueIcon,
  Assessment as AssessmentIcon,
  Work as WorkIcon,
  MonitorHeart as MonitorIcon,
  ListAlt as ListAltIcon,
  Search as SearchIcon,
  PendingActions as PendingIcon,
  Storage as StorageIcon,
  History as HistoryIcon,
  Settings as SettingsIcon,
  Speed as SpeedIcon,
  Api as ApiIcon,
  CompareArrows as CompareIcon,
  Folder as FolderIcon,
} from '@mui/icons-material';
import { MENU_SECTIONS, MenuItem as MenuItemType, MenuSection } from './config/menuSchema';

const iconMap: Record<string, JSX.Element> = {
  dashboard: <DashboardIcon />,
  bar: <BarChartIcon />,
  upload: <UploadFileIcon />,
  cloud: <CloudQueueIcon />,
  assessment: <AssessmentIcon />,
  work: <WorkIcon />,
  monitor: <MonitorIcon />,
  list: <ListAltIcon />,
  search: <SearchIcon />,
  pending: <PendingIcon />,
  storage: <StorageIcon />,
  history: <HistoryIcon />,
  settings: <SettingsIcon />,
  speed: <SpeedIcon />,
  api: <ApiIcon />,
  compare: <CompareIcon />,
  folder: <FolderIcon />,
};

const hasRole = (roles: string[] | undefined, role: string) => !roles || roles.includes(role);

export default function CustomMenu() {
  // Internal dashboard: default to 'admin' unless explicitly overridden
  const role = (localStorage.getItem('cns_role') as 'admin' | 'customer') || 'admin';

  const renderItem = (item: MenuItemType) => (
    <Menu.Item
      key={item.id}
      to={item.path}
      primaryText={item.label}
      leftIcon={item.icon ? iconMap[item.icon] : undefined}
    />
  );

  const renderSection = (section: MenuSection) => {
    // CNS Dashboard: All menus always active for platform admins
    return (
      <Box key={section.id} sx={{ mt: 1 }}>
        <Typography sx={{ px: 2, py: 0.75, fontSize: 11, textTransform: 'uppercase', color: 'text.secondary', letterSpacing: 0.6, fontWeight: 700 }}>
          {section.label}
        </Typography>
        <Box>
          {section.items
            .filter((item) => hasRole(item.roles as any, role))
            .map(renderItem)}
        </Box>
      </Box>
    );
  };

  return (
    <Menu>
      {MENU_SECTIONS.filter((s) => hasRole(s.roles as any, role)).map(renderSection)}
    </Menu>
  );
}
