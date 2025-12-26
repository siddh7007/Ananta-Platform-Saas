/**
 * MetricCardSkeleton Component
 * Loading skeleton for MetricCard widget
 * @module components/dashboard/skeletons
 */

import React from 'react';

export interface MetricCardSkeletonProps {
  /** CSS class name for customization */
  className?: string;
}

/**
 * MetricCardSkeleton displays animated placeholder while metric data loads
 */
export const MetricCardSkeleton: React.FC<MetricCardSkeletonProps> = ({
  className = '',
}) => {
  return (
    <div className={`metric-card ${className}`} aria-busy="true" aria-live="polite">
      <div className="dashboard-widget-body">
        {/* Value Skeleton */}
        <div className="skeleton h-12 w-32 mb-3" />

        {/* Label Skeleton */}
        <div className="skeleton h-4 w-24 mb-4" />

        {/* Trend Skeleton */}
        <div className="flex items-center gap-2">
          <div className="skeleton-circle w-5 h-5" />
          <div className="skeleton h-3 w-20" />
        </div>
      </div>
      <span className="sr-only">Loading metric data...</span>
    </div>
  );
};

MetricCardSkeleton.displayName = 'MetricCardSkeleton';

export default MetricCardSkeleton;
