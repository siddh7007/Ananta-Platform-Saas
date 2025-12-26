/**
 * CNS Dashboard Sidebar
 *
 * Schema-driven navigation with:
 * - Grouped sections from MENU_SECTIONS config
 * - Role-based visibility (admin/customer)
 * - Active state styling with theme colors
 * - Theme-aware colors throughout
 * - Collapsible sections with localStorage persistence
 *
 * @module layout/Sidebar
 */

import { Menu, MenuItemLink, useGetIdentity, useLogout } from 'react-admin';
import { useMemo, useState, useCallback } from 'react';
import { Box, Divider, List, Typography, useTheme, alpha, Theme, Collapse, IconButton } from '@mui/material';
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
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  Autorenew as AutorenewIcon,
  Apps as AppsIcon,
  Person as PersonIcon,
  Notifications as NotificationsIcon,
  Logout as LogoutIcon,
  Warning as WarningIcon,
  Business as BusinessIcon,
} from '@mui/icons-material';
import { MENU_SECTIONS, MenuItem as MenuItemType, MenuSection, MenuRole } from '../config/menuSchema';

// Storage key for persisting expanded state
const SIDEBAR_EXPANDED_KEY = 'cns_sidebar_expanded';

/**
 * Icon mapping
 * Maps logical icon names from menuSchema to MUI icon components
 */
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
  autorenew: <AutorenewIcon />,
  warning: <WarningIcon />,
  business: <BusinessIcon />,
};

/**
 * Check if user has required role
 * @param roles - Array of allowed roles, or undefined (all roles)
 * @param userRole - Current user's role
 * @returns True if user has access
 */
const hasRole = (roles: MenuRole[] | undefined, userRole: MenuRole): boolean => {
  return !roles || roles.includes(userRole);
};

/**
 * Get initial expanded state from localStorage or defaults
 */
const getInitialExpandedState = (): Record<string, boolean> => {
  try {
    const stored = localStorage.getItem(SIDEBAR_EXPANDED_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('[Sidebar] Failed to load expanded state from localStorage');
  }

  // Build default state from section configuration
  return MENU_SECTIONS.reduce(
    (acc, section) => ({
      ...acc,
      [section.id]: section.defaultExpanded ?? true,
    }),
    {} as Record<string, boolean>
  );
};

/**
 * Section header styling with theme tokens
 * @param theme - MUI theme object
 * @param isCollapsible - Whether section is collapsible
 * @returns SX prop object for section headers
 */
const sectionHeaderSx = (theme: Theme, isCollapsible: boolean) => ({
  px: 2,
  py: 0.75,
  fontSize: 11,
  textTransform: 'uppercase',
  color: theme.palette.text.secondary,
  letterSpacing: '0.06em',
  fontWeight: 700,
  borderBottom: `1px solid ${theme.palette.divider}`,
  mt: 1,
  mb: 0.5,
  userSelect: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  cursor: isCollapsible ? 'pointer' : 'default',
  '&:hover': isCollapsible
    ? {
        backgroundColor: alpha(theme.palette.action.hover, 0.04),
      }
    : {},
  transition: theme.transitions.create('background-color', {
    duration: theme.transitions.duration.shortest,
  }),
});

/**
 * Menu item styling with active state
 * @param theme - MUI theme object
 * @returns SX prop object for menu items
 */
const menuItemSx = (theme: Theme) => ({
  // Active state styling
  '&.RaMenuItemLink-active': {
    backgroundColor: alpha(theme.palette.primary.main, 0.12),
    borderLeft: `3px solid ${theme.palette.primary.main}`,
    color: theme.palette.primary.main,
    fontWeight: 600,
    '& .MuiListItemIcon-root': {
      color: theme.palette.primary.main,
    },
    '& .MuiListItemText-primary': {
      color: theme.palette.primary.main,
      fontWeight: 600,
    },
  },
  // Hover state
  '&:hover': {
    backgroundColor: alpha(theme.palette.action.hover, 0.08),
  },
  // Transition for smooth color changes
  transition: theme.transitions.create(['background-color', 'border-left', 'color'], {
    duration: theme.transitions.duration.shortest,
  }),
  // Default border for alignment consistency
  borderLeft: '3px solid transparent',
  // Icon color
  '& .MuiListItemIcon-root': {
    color: theme.palette.action.active,
  },
});

/**
 * Section container styling
 * @returns SX prop object for section container
 */
const sectionContainerSx = () => ({
  mt: 1,
  mb: 0.5,
  '&:first-of-type': {
    mt: 0,
  },
});

/**
 * Extract role from user identity
 * CNS Dashboard uses platform roles from Auth0/Keycloak tokens
 *
 * Role priority: identity.role > localStorage fallback > 'admin' default
 */
function extractRole(identity: { role?: string; roles?: string[] } | undefined): MenuRole {
  if (identity?.role) {
    // Normalize platform roles to menu schema roles
    const normalizedRole = identity.role
      .replace('platform:', '')
      .replace('super-admin', 'super_admin')
      .replace('super_admin', 'super_admin')
      .replace('admin', 'admin')
      .replace('staff', 'admin') // staff maps to admin for sidebar visibility
      .replace('customer', 'customer');

    if (['super_admin', 'admin', 'customer'].includes(normalizedRole)) {
      return normalizedRole as MenuRole;
    }
  }

  // Check roles array if present
  if (identity?.roles?.length) {
    if (identity.roles.some((r) => r.includes('super_admin') || r.includes('super-admin'))) return 'super_admin';
    if (identity.roles.some((r) => r.includes('admin') || r.includes('staff'))) return 'admin';
    if (identity.roles.some((r) => r.includes('customer'))) return 'customer';
  }

  // Fallback to localStorage (legacy support)
  const storedRole = localStorage.getItem('cns_role') as MenuRole | null;
  if (storedRole && ['super_admin', 'admin', 'customer'].includes(storedRole)) {
    return storedRole;
  }

  // Default: CNS Dashboard users are platform admins
  return 'admin';
}

/**
 * CNS Dashboard Sidebar Component
 *
 * Renders a schema-driven navigation menu with:
 * - Role-based filtering
 * - Theme-aware styling
 * - Collapsible sections with localStorage persistence
 *
 * @returns Sidebar navigation component
 */
export default function Sidebar() {
  const theme = useTheme();
  const { data: identity } = useGetIdentity();
  const logout = useLogout();

  // Extract role from identity with fallbacks
  const role = useMemo(() => extractRole(identity as any), [identity]);

  // Collapsible section state with localStorage persistence
  const [expanded, setExpanded] = useState<Record<string, boolean>>(getInitialExpandedState);

  /**
   * Toggle section expanded state
   */
  const toggleSection = useCallback((sectionId: string) => {
    setExpanded((prev) => {
      const next = { ...prev, [sectionId]: !prev[sectionId] };
      try {
        localStorage.setItem(SIDEBAR_EXPANDED_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn('[Sidebar] Failed to save expanded state to localStorage');
      }
      return next;
    });
  }, []);

  /**
   * Render a single menu item
   * @param item - Menu item configuration
   * @returns Menu.Item component
   */
  const renderItem = (item: MenuItemType) => (
    <Menu.Item
      key={item.id}
      to={item.path}
      primaryText={item.label}
      leftIcon={item.icon ? iconMap[item.icon] : undefined}
      sx={menuItemSx(theme)}
    />
  );

  /**
   * Render a menu section with header and items
   * Supports collapsible sections with expand/collapse toggle
   * @param section - Menu section configuration
   * @returns Box containing section header and items
   */
  const renderSection = (section: MenuSection) => {
    // Filter items by role visibility and sidebar visibility flag
    const visibleItems = section.items.filter(
      (item) => hasRole(item.roles, role) && item.showInSidebar !== false
    );

    // Skip empty sections
    if (visibleItems.length === 0) {
      return null;
    }

    const isCollapsible = section.collapsible ?? false;
    const isExpanded = expanded[section.id] ?? true;

    const handleHeaderClick = () => {
      if (isCollapsible) {
        toggleSection(section.id);
      }
    };

    return (
      <Box key={section.id} sx={sectionContainerSx()}>
        {/* Section header with optional collapse toggle */}
        <Box
          onClick={handleHeaderClick}
          sx={sectionHeaderSx(theme, isCollapsible)}
          role={isCollapsible ? 'button' : undefined}
          aria-expanded={isCollapsible ? isExpanded : undefined}
          tabIndex={isCollapsible ? 0 : undefined}
          onKeyDown={(e) => {
            if (isCollapsible && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              toggleSection(section.id);
            }
          }}
        >
          <Typography
            component="span"
            sx={{
              fontSize: 'inherit',
              fontWeight: 'inherit',
              letterSpacing: 'inherit',
              textTransform: 'inherit',
            }}
          >
            {section.label}
          </Typography>

          {/* Expand/Collapse icon for collapsible sections */}
          {isCollapsible && (
            <IconButton
              size="small"
              sx={{
                p: 0,
                color: theme.palette.text.secondary,
                transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                transition: theme.transitions.create('transform', {
                  duration: theme.transitions.duration.short,
                }),
              }}
              aria-label={isExpanded ? 'Collapse section' : 'Expand section'}
              tabIndex={-1} // Header already handles keyboard
            >
              <ExpandMoreIcon fontSize="small" />
            </IconButton>
          )}
        </Box>

        {/* Section items - wrapped in Collapse for collapsible sections */}
        {isCollapsible ? (
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <Box>{visibleItems.map(renderItem)}</Box>
          </Collapse>
        ) : (
          <Box>{visibleItems.map(renderItem)}</Box>
        )}
      </Box>
    );
  };

  const footerItems = [
    { id: 'portals', label: 'Portals', to: '/portals', icon: <AppsIcon /> },
    { id: 'profile', label: 'Profile', to: '/profile', icon: <PersonIcon /> },
    { id: 'notifications', label: 'Notifications', to: '/notifications', icon: <NotificationsIcon /> },
    { id: 'settings', label: 'Settings', to: '/config', icon: <SettingsIcon /> },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Menu sx={{ flex: 1 }}>
        {/* Render all sections that user has access to */}
        {MENU_SECTIONS.filter((section) => hasRole(section.roles, role)).map(renderSection)}
      </Menu>

      {/* Bottom-left account/tools menu */}
      <Box sx={{ mt: 'auto', pb: 1 }}>
        <Divider sx={{ mx: 2, mb: 1 }} />
        <List dense disablePadding>
          {footerItems.map((item) => (
            <MenuItemLink
              key={item.id}
              to={item.to}
              primaryText={item.label}
              leftIcon={item.icon}
              sx={menuItemSx(theme)}
            />
          ))}
          <MenuItemLink
            to="#"
            primaryText="Log out"
            leftIcon={<LogoutIcon />}
            onClick={(event) => {
              event.preventDefault();
              logout();
            }}
            sx={menuItemSx(theme)}
          />
        </List>
      </Box>
    </Box>
  );
}
