/**
 * ChartSkeleton Component
 * Loading skeleton for chart widgets
 * @module components/dashboard/skeletons
 */

import React from 'react';

export interface ChartSkeletonProps {
  /** Chart type for optimized skeleton layout */
  variant?: 'donut' | 'area' | 'bar';
  /** Chart title */
  title?: string;
  /** CSS class name for customization */
  className?: string;
}

/**
 * ChartSkeleton displays animated placeholder while chart data loads
 * Adapts layout based on chart type
 */
export const ChartSkeleton: React.FC<ChartSkeletonProps> = ({
  variant = 'area',
  title,
  className = '',
}) => {
  return (
    <div className={`dashboard-widget ${className}`} aria-busy="true" aria-live="polite">
      {/* Header */}
      <div className="dashboard-widget-header">
        {title ? (
          <h3 className="dashboard-widget-title">{title}</h3>
        ) : (
          <div className="skeleton-title w-48" />
        )}
      </div>

      <div className="dashboard-widget-body">
        {/* Chart Area */}
        <div className="chart-container flex items-center justify-center">
          {variant === 'donut' ? (
            <DonutChartSkeleton />
          ) : variant === 'area' ? (
            <AreaChartSkeleton />
          ) : (
            <BarChartSkeleton />
          )}
        </div>

        {/* Legend Skeleton */}
        <div className="chart-legend mt-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="skeleton-circle w-4 h-4" />
              <div className="skeleton h-3 w-20" />
            </div>
          ))}
        </div>
      </div>

      <span className="sr-only">Loading chart data...</span>
    </div>
  );
};

/**
 * DonutChartSkeleton - Circular placeholder for donut charts
 */
const DonutChartSkeleton: React.FC = () => (
  <div className="relative w-64 h-64">
    <div className="skeleton-circle w-full h-full" />
    <div className="absolute inset-12 bg-white rounded-full" />
  </div>
);

/**
 * AreaChartSkeleton - Line graph placeholder
 */
const AreaChartSkeleton: React.FC = () => (
  <div className="w-full h-64 flex items-end gap-2 px-8">
    {[40, 65, 45, 70, 55, 80, 60].map((height, i) => (
      <div key={i} className="flex-1 flex flex-col justify-end">
        <div
          className="skeleton w-full rounded-t"
          style={{ height: `${height}%` }}
        />
      </div>
    ))}
  </div>
);

/**
 * BarChartSkeleton - Bar graph placeholder
 */
const BarChartSkeleton: React.FC = () => (
  <div className="w-full h-64 flex items-end gap-4 px-8">
    {[50, 75, 60, 90, 45, 80].map((height, i) => (
      <div key={i} className="flex-1 flex flex-col justify-end">
        <div
          className="skeleton w-full rounded-t"
          style={{ height: `${height}%` }}
        />
      </div>
    ))}
  </div>
);

ChartSkeleton.displayName = 'ChartSkeleton';

export default ChartSkeleton;
