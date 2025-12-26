/**
 * CNS Dashboard AppBar
 *
 * Features:
 * - Theme toggle (4 variants: light, dark, midLight, midDark)
 * - Tenant/Organization selector for multi-tenant switching
 * - Super Admin badge (always visible for CNS Dashboard users)
 * - Optional breadcrumb display for navigation context
 *
 * Architecture:
 * - Integrates with ThemeContext for theme management
 * - Uses TenantSelector for organization switching
 * - Supports accessibility with focus-visible states
 * - Theme options defined outside component for performance
 */
import { AppBar as RAAppBar, UserMenu } from 'react-admin';
import { Box, Chip, IconButton, Menu, MenuItem, ListItemIcon, ListItemText, Tooltip } from '@mui/material';
import TenantSelector from '../components/TenantSelector';
import PaletteIcon from '@mui/icons-material/Palette';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import Brightness6Icon from '@mui/icons-material/Brightness6';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import { useState } from 'react';
import { useThemeContext } from '../contexts/ThemeContext';
import type { ThemeVariant } from '../theme';
import Breadcrumb from './Breadcrumb';

/**
 * Props for the AppBar component
 */
export interface AppBarProps {
  /**
   * Whether to show breadcrumb navigation
   * @default false
   */
  showBreadcrumb?: boolean;
}

/**
 * Theme options configuration
 *
 * Defined outside component to prevent re-creation on each render.
 * Each option includes:
 * - value: ThemeVariant enum value
 * - label: Human-readable theme name
 * - icon: Material-UI icon component
 */
const THEME_OPTIONS: Array<{ value: ThemeVariant; label: string; icon: React.ReactNode }> = [
  { value: 'light', label: 'Light', icon: <LightModeIcon fontSize="small" /> },
  { value: 'dark', label: 'Dark', icon: <DarkModeIcon fontSize="small" /> },
  { value: 'midLight', label: 'Mid Light', icon: <Brightness6Icon fontSize="small" /> },
  { value: 'midDark', label: 'Mid Dark', icon: <Brightness4Icon fontSize="small" /> },
];

/**
 * Theme Toggle Button Component
 *
 * Provides a dropdown menu to switch between 4 theme variants.
 * Integrates with ThemeContext for global theme state management.
 *
 * Features:
 * - Accessible with ARIA labels and focus-visible states
 * - Visual indicator of current theme selection
 * - Keyboard navigation support
 */
const ThemeToggle = () => {
  const { themeVariant, setThemeVariant } = useThemeContext();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleThemeSelect = (variant: ThemeVariant) => {
    setThemeVariant(variant);
    handleClose();
  };

  return (
    <>
      <Tooltip title="Switch theme">
        <IconButton
          color="inherit"
          onClick={handleClick}
          aria-label="Change theme"
          aria-controls="theme-menu"
          aria-haspopup="true"
          sx={{
            mr: 1,
            '&:focus-visible': {
              outline: '2px solid',
              outlineColor: 'primary.main',
              outlineOffset: '2px',
            },
          }}
        >
          <PaletteIcon />
        </IconButton>
      </Tooltip>
      <Menu
        id="theme-menu"
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        {THEME_OPTIONS.map((option) => (
          <MenuItem
            key={option.value}
            onClick={() => handleThemeSelect(option.value)}
            selected={themeVariant === option.value}
          >
            <ListItemIcon>{option.icon}</ListItemIcon>
            <ListItemText>{option.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

/**
 * Enhanced AppBar Component
 *
 * Main navigation bar for CNS Dashboard with multi-tenant support.
 *
 * Features:
 * - Super Admin access control (badge always visible)
 * - Theme switching (4 variants)
 * - Organization/tenant selector
 * - Optional breadcrumb navigation
 * - User menu integration
 *
 * Multi-Tenant Architecture:
 * - Super admins have full access to all features and all tenants
 * - TenantSelector allows switching between organizations
 * - No toggle needed - super admin access is always enabled
 *
 * @param props - Component props including showBreadcrumb flag
 * @param props.showBreadcrumb - Whether to display breadcrumb navigation
 */
export default function AppBar({ showBreadcrumb = false, ...props }: AppBarProps & any) {
  return (
    <RAAppBar {...props} userMenu={<UserMenu />}>
      {/* Optional breadcrumb navigation */}
      {showBreadcrumb && (
        <Box sx={{ mr: 2 }}>
          <Breadcrumb />
        </Box>
      )}

      {/* Spacer to push controls to the right */}
      <Box sx={{ flex: 1 }} />

      {/* Theme toggle with 4 variants */}
      <ThemeToggle />

      {/* Super Admin badge - always visible for CNS Dashboard users */}
      <Chip
        label="Super Admin"
        color="secondary"
        size="small"
        sx={{
          mr: 2,
          fontWeight: 600,
        }}
      />

      {/* Organization selector for switching between tenants */}
      <TenantSelector />
    </RAAppBar>
  );
}
