/**
 * Breadcrumb Component
 *
 * Generates breadcrumb trail from current route and menu schema.
 * Uses MUI Breadcrumbs with theme-aware styling.
 */
import React, { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Breadcrumbs, Typography, useTheme } from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import HomeIcon from '@mui/icons-material/Home';
import { MENU_SECTIONS, MenuSection, MenuItem } from '../config/menuSchema';
import type { BreadcrumbItem } from './types';

/**
 * Find menu item and its section by path
 */
function findItemByPath(path: string, sections: MenuSection[]): { section?: MenuSection; item?: MenuItem } {
  for (const section of sections) {
    const item = section.items.find(i => i.path === path);
    if (item) {
      return { section, item };
    }
  }
  return {};
}

/**
 * Build breadcrumb items from current path
 */
function buildBreadcrumbs(pathname: string, sections: MenuSection[]): BreadcrumbItem[] {
  const crumbs: BreadcrumbItem[] = [
    { label: 'Dashboard', path: '/', isActive: pathname === '/' }
  ];

  if (pathname === '/') {
    return crumbs;
  }

  const { section, item } = findItemByPath(pathname, sections);

  if (section && item) {
    // Add section as intermediate crumb (non-clickable)
    crumbs.push({
      label: section.label,
      path: '',  // No path = non-clickable
      isActive: false
    });

    // Add current item
    crumbs.push({
      label: item.label,
      path: item.path,
      isActive: true
    });
  } else {
    // Fallback: use path segments
    const segments = pathname.split('/').filter(Boolean);
    let currentPath = '';

    segments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      crumbs.push({
        label: segment.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        path: currentPath,
        isActive: index === segments.length - 1
      });
    });
  }

  return crumbs;
}

export interface BreadcrumbProps {
  /** Custom separator icon */
  separator?: React.ReactNode;
  /** Show home icon for dashboard */
  showHomeIcon?: boolean;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  separator = <NavigateNextIcon fontSize="small" />,
  showHomeIcon = true,
}) => {
  const theme = useTheme();
  const location = useLocation();

  const breadcrumbs = useMemo(
    () => buildBreadcrumbs(location.pathname, MENU_SECTIONS),
    [location.pathname]
  );

  if (breadcrumbs.length <= 1) {
    return null; // Don't show breadcrumbs on dashboard
  }

  return (
    <Breadcrumbs
      separator={separator}
      aria-label="breadcrumb"
      sx={{
        '& .MuiBreadcrumbs-separator': {
          color: theme.palette.text.disabled,
        },
      }}
    >
      {breadcrumbs.map((crumb, index) => {
        const isLast = index === breadcrumbs.length - 1;
        const isFirst = index === 0;

        if (isLast || !crumb.path) {
          // Current page or non-clickable section
          return (
            <Typography
              key={crumb.path || crumb.label}
              color={isLast ? 'text.primary' : 'text.secondary'}
              sx={{
                display: 'flex',
                alignItems: 'center',
                fontWeight: isLast ? 600 : 400,
                fontSize: '0.875rem',
              }}
            >
              {crumb.label}
            </Typography>
          );
        }

        // Clickable crumb
        return (
          <Link
            key={crumb.path}
            to={crumb.path}
            style={{
              display: 'flex',
              alignItems: 'center',
              color: theme.palette.text.secondary,
              textDecoration: 'none',
              fontSize: '0.875rem',
            }}
          >
            {isFirst && showHomeIcon && (
              <HomeIcon sx={{ mr: 0.5, fontSize: '1rem' }} />
            )}
            {crumb.label}
          </Link>
        );
      })}
    </Breadcrumbs>
  );
};

export default Breadcrumb;
