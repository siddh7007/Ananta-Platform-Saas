/**
 * WorkspaceLayout Component
 *
 * Task-oriented layout system for structured page layouts.
 * Provides consistent spacing, panels, and responsive behavior.
 *
 * Layout Structure:
 * ```
 * +------------------------------------------+
 * | Header (PageHeader)                      |
 * +------------------------------------------+
 * | Toolbar (filters, actions)               |
 * +------------------------------------------+
 * | Main Content Area                        |
 * | +--------+ +---------------------------+ |
 * | | Side   | |      Primary              | |
 * | | Panel  | |      Content              | |
 * | |        | |                           | |
 * | +--------+ +---------------------------+ |
 * +------------------------------------------+
 * | Footer (pagination, summary)             |
 * +------------------------------------------+
 * ```
 *
 * @module layout/WorkspaceLayout
 */

import React from 'react';
import { Box, Paper, Divider, useTheme, useMediaQuery } from '@mui/material';

// ============================================================
// Types
// ============================================================

export interface WorkspaceLayoutProps {
  /** Page header content (PageHeader component) */
  header?: React.ReactNode;
  /** Toolbar content (filters, bulk actions) */
  toolbar?: React.ReactNode;
  /** Main content area */
  children: React.ReactNode;
  /** Side panel content (optional) */
  sidePanel?: React.ReactNode;
  /** Side panel position */
  sidePanelPosition?: 'left' | 'right';
  /** Side panel width (number or string) */
  sidePanelWidth?: number | string;
  /** Footer content (pagination, summary) */
  footer?: React.ReactNode;
  /** Remove default padding */
  disablePadding?: boolean;
  /** Max width constraint */
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
  /** Background variant */
  variant?: 'default' | 'paper' | 'transparent';
}

// ============================================================
// Component
// ============================================================

export const WorkspaceLayout: React.FC<WorkspaceLayoutProps> = ({
  header,
  toolbar,
  children,
  sidePanel,
  sidePanelPosition = 'left',
  sidePanelWidth = 280,
  footer,
  disablePadding = false,
  maxWidth = false,
  variant = 'default',
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Side panel collapses on mobile
  const showSidePanel = sidePanel && !isMobile;

  // Calculate max width
  const maxWidthValue = maxWidth
    ? theme.breakpoints.values[maxWidth]
    : undefined;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100%',
        maxWidth: maxWidthValue,
        mx: maxWidth ? 'auto' : 0,
        bgcolor: variant === 'paper' ? 'background.paper' : variant === 'transparent' ? 'transparent' : 'background.default',
      }}
    >
      {/* Header */}
      {header && (
        <Box sx={{ px: disablePadding ? 0 : 3, pt: disablePadding ? 0 : 3 }}>
          {header}
        </Box>
      )}

      {/* Toolbar */}
      {toolbar && (
        <Box sx={{ px: disablePadding ? 0 : 3, py: 2 }}>
          {toolbar}
        </Box>
      )}

      {/* Main Content Area */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: sidePanelPosition === 'left' ? 'row' : 'row-reverse',
          gap: 3,
          px: disablePadding ? 0 : 3,
          pb: disablePadding ? 0 : 3,
        }}
      >
        {/* Side Panel */}
        {showSidePanel && (
          <Box
            sx={{
              width: sidePanelWidth,
              flexShrink: 0,
            }}
          >
            {sidePanel}
          </Box>
        )}

        {/* Primary Content */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {children}
        </Box>
      </Box>

      {/* Footer */}
      {footer && (
        <Box sx={{ px: disablePadding ? 0 : 3, pb: disablePadding ? 0 : 3 }}>
          {footer}
        </Box>
      )}
    </Box>
  );
};

// ============================================================
// Panel Component
// ============================================================

export interface PanelProps {
  /** Panel title */
  title?: string;
  /** Panel content */
  children: React.ReactNode;
  /** Panel variant */
  variant?: 'outlined' | 'elevated' | 'flat';
  /** Padding size */
  padding?: 'none' | 'small' | 'medium' | 'large';
  /** Header actions (buttons, etc.) */
  actions?: React.ReactNode;
  /** Collapsible panel */
  collapsible?: boolean;
  /** Initial collapsed state */
  defaultCollapsed?: boolean;
  /** Full height */
  fullHeight?: boolean;
}

export const Panel: React.FC<PanelProps> = ({
  title,
  children,
  variant = 'outlined',
  padding = 'medium',
  actions,
  collapsible = false,
  defaultCollapsed = false,
  fullHeight = false,
}) => {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);

  const paddingMap = {
    none: 0,
    small: 1.5,
    medium: 2,
    large: 3,
  };

  const paperProps: React.ComponentProps<typeof Paper> = {
    elevation: variant === 'elevated' ? 2 : 0,
    variant: variant === 'outlined' ? 'outlined' : 'elevation',
    sx: {
      height: fullHeight ? '100%' : 'auto',
      display: 'flex',
      flexDirection: 'column',
      bgcolor: variant === 'flat' ? 'transparent' : undefined,
      border: variant === 'flat' ? 'none' : undefined,
    },
  };

  return (
    <Paper {...paperProps}>
      {/* Panel Header */}
      {(title || actions) && (
        <>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: paddingMap[padding],
              py: 1.5,
              cursor: collapsible ? 'pointer' : 'default',
            }}
            onClick={collapsible ? () => setCollapsed(!collapsed) : undefined}
          >
            {title && (
              <Box
                component="h3"
                sx={{
                  m: 0,
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'text.primary',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                {collapsible && (
                  <Box
                    component="span"
                    sx={{
                      transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s',
                      display: 'inline-flex',
                    }}
                  >
                    ▼
                  </Box>
                )}
                {title}
              </Box>
            )}
            {actions && !collapsed && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {actions}
              </Box>
            )}
          </Box>
          {!collapsed && <Divider />}
        </>
      )}

      {/* Panel Content */}
      {!collapsed && (
        <Box
          sx={{
            flex: 1,
            p: paddingMap[padding],
            overflow: 'auto',
          }}
        >
          {children}
        </Box>
      )}
    </Paper>
  );
};

// ============================================================
// Grid Layout Component
// ============================================================

export interface GridLayoutProps {
  /** Grid items */
  children: React.ReactNode;
  /** Number of columns (responsive) */
  columns?: number | { xs?: number; sm?: number; md?: number; lg?: number; xl?: number };
  /** Gap between items */
  gap?: number;
  /** Equal height items */
  equalHeight?: boolean;
}

export const GridLayout: React.FC<GridLayoutProps> = ({
  children,
  columns = { xs: 1, sm: 2, md: 3, lg: 4 },
  gap = 2,
  equalHeight = false,
}) => {
  const getColumnsStyle = () => {
    if (typeof columns === 'number') {
      return `repeat(${columns}, 1fr)`;
    }
    // This will be handled by responsive sx prop
    return undefined;
  };

  return (
    <Box
      sx={(theme) => ({
        display: 'grid',
        gap,
        gridTemplateColumns:
          typeof columns === 'number'
            ? getColumnsStyle()
            : {
                xs: `repeat(${columns.xs ?? 1}, 1fr)`,
                sm: `repeat(${columns.sm ?? columns.xs ?? 1}, 1fr)`,
                md: `repeat(${columns.md ?? columns.sm ?? columns.xs ?? 1}, 1fr)`,
                lg: `repeat(${columns.lg ?? columns.md ?? columns.sm ?? columns.xs ?? 1}, 1fr)`,
                xl: `repeat(${columns.xl ?? columns.lg ?? columns.md ?? columns.sm ?? columns.xs ?? 1}, 1fr)`,
              },
        ...(equalHeight && {
          '& > *': {
            height: '100%',
          },
        }),
      })}
    >
      {children}
    </Box>
  );
};

// ============================================================
// Split Layout Component
// ============================================================

export interface SplitLayoutProps {
  /** Left/top content */
  primary: React.ReactNode;
  /** Right/bottom content */
  secondary: React.ReactNode;
  /** Split direction */
  direction?: 'horizontal' | 'vertical';
  /** Primary panel size (number = pixels, string = percentage) */
  primarySize?: number | string;
  /** Gap between panels */
  gap?: number;
  /** Reverse order on mobile */
  reverseOnMobile?: boolean;
}

export const SplitLayout: React.FC<SplitLayoutProps> = ({
  primary,
  secondary,
  direction = 'horizontal',
  primarySize = '50%',
  gap = 2,
  reverseOnMobile = false,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const isVertical = direction === 'vertical' || isMobile;
  const shouldReverse = reverseOnMobile && isMobile;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: isVertical
          ? shouldReverse ? 'column-reverse' : 'column'
          : shouldReverse ? 'row-reverse' : 'row',
        gap,
        height: '100%',
      }}
    >
      <Box
        sx={{
          width: isVertical ? '100%' : primarySize,
          flexShrink: 0,
        }}
      >
        {primary}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0, minHeight: 0 }}>
        {secondary}
      </Box>
    </Box>
  );
};

// ============================================================
// Stack Layout Component
// ============================================================

export interface StackLayoutProps {
  /** Stack items */
  children: React.ReactNode;
  /** Stack direction */
  direction?: 'row' | 'column';
  /** Gap between items */
  gap?: number;
  /** Align items */
  align?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
  /** Justify content */
  justify?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around';
  /** Wrap items */
  wrap?: boolean;
  /** Dividers between items */
  dividers?: boolean;
}

export const StackLayout: React.FC<StackLayoutProps> = ({
  children,
  direction = 'column',
  gap = 2,
  align = 'stretch',
  justify = 'flex-start',
  wrap = false,
  dividers = false,
}) => {
  const childArray = React.Children.toArray(children);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: direction,
        gap: dividers ? 0 : gap,
        alignItems: align,
        justifyContent: justify,
        flexWrap: wrap ? 'wrap' : 'nowrap',
      }}
    >
      {dividers
        ? childArray.map((child, index) => (
            <React.Fragment key={index}>
              {child}
              {index < childArray.length - 1 && (
                <Divider
                  orientation={direction === 'row' ? 'vertical' : 'horizontal'}
                  flexItem={direction === 'row'}
                  sx={{ my: direction === 'column' ? gap / 2 : 0, mx: direction === 'row' ? gap / 2 : 0 }}
                />
              )}
            </React.Fragment>
          ))
        : children}
    </Box>
  );
};

export default WorkspaceLayout;
