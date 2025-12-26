/**
 * DashboardGrid Component
 * Responsive CSS Grid layout for dashboard widgets
 * @module components/dashboard
 */

import React from 'react';

export interface DashboardGridProps {
  /** Grid children (widgets) */
  children: React.ReactNode;
  /** Number of columns at tablet breakpoint (768px+) */
  tabletColumns?: number;
  /** Number of columns at desktop breakpoint (1024px+) */
  desktopColumns?: number;
  /** Gap between grid items (Tailwind spacing value) */
  gap?: string;
  /** CSS class name for customization */
  className?: string;
}

export interface GridAreaProps {
  /** Grid area children (widget) */
  children: React.ReactNode;
  /** Column span at tablet (768px+) */
  colSpanTablet?: number;
  /** Column span at desktop (1024px+) */
  colSpanDesktop?: number;
  /** Row span */
  rowSpan?: number;
  /** CSS class name for customization */
  className?: string;
}

/**
 * DashboardGrid provides responsive grid layout with configurable columns
 * Automatically adapts from mobile (1 col) → tablet (2 col) → desktop (4 col)
 */
export const DashboardGrid: React.FC<DashboardGridProps> = ({
  children,
  tabletColumns = 2,
  desktopColumns = 4,
  gap = '6',
  className = '',
}) => {
  const gridClass = `
    grid
    grid-cols-1
    md:grid-cols-${tabletColumns}
    lg:grid-cols-${desktopColumns}
    gap-${gap}
    ${className}
  `.trim().replace(/\s+/g, ' ');

  return (
    <div
      className={gridClass}
      role="region"
      aria-label="Dashboard widgets grid"
    >
      {children}
    </div>
  );
};

/**
 * GridArea allows fine-grained control over widget placement
 * Supports column/row spanning for custom layouts
 */
export const GridArea: React.FC<GridAreaProps> = ({
  children,
  colSpanTablet = 1,
  colSpanDesktop = 1,
  rowSpan = 1,
  className = '',
}) => {
  const areaClass = `
    col-span-1
    md:col-span-${colSpanTablet}
    lg:col-span-${colSpanDesktop}
    row-span-${rowSpan}
    ${className}
  `.trim().replace(/\s+/g, ' ');

  return <div className={areaClass}>{children}</div>;
};

DashboardGrid.displayName = 'DashboardGrid';
GridArea.displayName = 'GridArea';

export default DashboardGrid;
