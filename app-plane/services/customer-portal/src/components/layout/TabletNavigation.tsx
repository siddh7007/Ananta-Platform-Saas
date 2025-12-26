import React from 'react';
import {
  Drawer,
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Close as CloseIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import { useTabletNavigation } from '../../hooks/useTabletNavigation';
import { useOrientation } from '../../hooks/useOrientation';
import { useSafeAreaInsets } from '../../hooks/useSafeAreaInsets';
import { TouchTarget } from '../shared/TouchTarget';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path?: string;
  onClick?: () => void;
  badge?: number;
  divider?: boolean;
}

export interface TabletNavigationProps {
  items: NavItem[];
  activeId?: string;
  logo?: React.ReactNode;
  footer?: React.ReactNode;
  onNavigate?: (item: NavItem) => void;
}

/**
 * TabletNavigation - Responsive navigation sidebar
 *
 * Portrait: Overlay hamburger menu
 * Landscape: Slim sidebar (icons only, expand on hover)
 *
 * @example
 * <TabletNavigation
 *   items={navItems}
 *   activeId="dashboard"
 *   onNavigate={handleNavigate}
 *   logo={<Logo />}
 * />
 */
export const TabletNavigation: React.FC<TabletNavigationProps> = ({
  items,
  activeId,
  logo,
  footer,
  onNavigate,
}) => {
  const nav = useTabletNavigation();
  const { isPortrait, isLandscape } = useOrientation();
  const insets = useSafeAreaInsets();

  const handleItemClick = (item: NavItem) => {
    if (item.onClick) {
      item.onClick();
    } else if (onNavigate) {
      onNavigate(item);
    }

    // Close drawer on portrait after navigation
    if (isPortrait) {
      nav.close();
    }
  };

  const renderNavItem = (item: NavItem, expanded: boolean) => {
    const isActive = item.id === activeId;

    return (
      <React.Fragment key={item.id}>
        {item.divider && <Divider sx={{ my: 1 }} />}
        <ListItem disablePadding>
          <Tooltip title={!expanded ? item.label : ''} placement="right">
            <ListItemButton
              selected={isActive}
              onClick={() => handleItemClick(item)}
              sx={{
                minHeight: 56, // Touch-friendly height
                px: expanded ? 2 : 1.5,
                justifyContent: expanded ? 'flex-start' : 'center',
                borderRadius: 1,
                mx: 0.5,
                '&.Mui-selected': {
                  bgcolor: 'primary.light',
                  '&:hover': {
                    bgcolor: 'primary.light',
                  },
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: expanded ? 40 : 'auto',
                  color: isActive ? 'primary.main' : 'text.secondary',
                  justifyContent: 'center',
                }}
              >
                {item.icon}
              </ListItemIcon>
              {expanded && (
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontSize: '0.875rem',
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? 'primary.main' : 'text.primary',
                  }}
                />
              )}
              {expanded && item.badge && (
                <Box
                  sx={{
                    bgcolor: 'error.main',
                    color: 'white',
                    borderRadius: '50%',
                    minWidth: 20,
                    height: 20,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}
                >
                  {item.badge}
                </Box>
              )}
            </ListItemButton>
          </Tooltip>
        </ListItem>
      </React.Fragment>
    );
  };

  const renderDrawerContent = (expanded: boolean) => (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        paddingTop: `${insets.top}px`,
        paddingBottom: `${insets.bottom}px`,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: expanded ? 'space-between' : 'center',
          minHeight: 64,
        }}
      >
        {expanded && logo}
        {isPortrait && (
          <TouchTarget onClick={nav.close} ariaLabel="Close menu">
            <CloseIcon />
          </TouchTarget>
        )}
        {isLandscape && !isPortrait && (
          <TouchTarget onClick={nav.toggleExpanded} ariaLabel="Toggle sidebar">
            {nav.isExpanded ? <ChevronLeftIcon /> : <ChevronRightIcon />}
          </TouchTarget>
        )}
      </Box>

      <Divider />

      {/* Navigation items */}
      <List sx={{ flex: 1, py: 2, overflowY: 'auto' }}>
        {items.map((item) => renderNavItem(item, expanded))}
      </List>

      {/* Footer */}
      {expanded && footer && (
        <>
          <Divider />
          <Box sx={{ p: 2 }}>{footer}</Box>
        </>
      )}
    </Box>
  );

  // Portrait mode - overlay drawer
  if (isPortrait) {
    return (
      <>
        {/* Menu button */}
        <TouchTarget
          onClick={nav.toggle}
          ariaLabel="Open menu"
          sx={{
            position: 'fixed',
            top: 16 + insets.top,
            left: 16,
            zIndex: 1200,
            bgcolor: 'background.paper',
            borderRadius: 2,
            boxShadow: 2,
          }}
        >
          <MenuIcon />
        </TouchTarget>

        {/* Overlay drawer */}
        <Drawer
          anchor="left"
          open={nav.isOpen}
          onClose={nav.close}
          data-tablet-sidebar
          PaperProps={{
            sx: {
              width: 280,
              borderRight: 'none',
            },
          }}
        >
          {renderDrawerContent(true)}
        </Drawer>
      </>
    );
  }

  // Landscape mode - slim sidebar
  return (
    <Drawer
      variant="permanent"
      data-tablet-sidebar
      PaperProps={{
        sx: {
          width: nav.isExpanded ? 240 : 72,
          transition: 'width 0.3s ease',
          borderRight: '1px solid',
          borderColor: 'divider',
          overflowX: 'hidden',
        },
      }}
      onMouseEnter={nav.expand}
      onMouseLeave={nav.collapse}
    >
      {renderDrawerContent(nav.isExpanded)}
    </Drawer>
  );
};

export default TabletNavigation;
