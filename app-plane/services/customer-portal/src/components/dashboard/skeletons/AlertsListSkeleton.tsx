/**
 * AlertsListSkeleton Component
 * Loading skeleton for AlertsList widget
 * @module components/dashboard/skeletons
 */

import React from 'react';

export interface AlertsListSkeletonProps {
  /** Number of alert items to display */
  count?: number;
  /** Chart title */
  title?: string;
  /** CSS class name for customization */
  className?: string;
}

/**
 * AlertsListSkeleton displays animated placeholder while alerts load
 */
export const AlertsListSkeleton: React.FC<AlertsListSkeletonProps> = ({
  count = 3,
  title = 'Critical Alerts',
  className = '',
}) => {
  return (
    <div className={`dashboard-widget ${className}`} aria-busy="true" aria-live="polite">
      {/* Header */}
      <div className="dashboard-widget-header">
        <h3 className="dashboard-widget-title">{title}</h3>
      </div>

      <div className="dashboard-widget-body">
        <div className="space-y-3">
          {Array.from({ length: count }).map((_, index) => (
            <div
              key={index}
              className="flex items-start gap-4 p-4 rounded-lg border border-gray-200"
            >
              {/* Icon Skeleton */}
              <div className="skeleton-circle w-6 h-6 flex-shrink-0" />

              {/* Content Skeleton */}
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-full" />
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton h-3 w-24" />
              </div>

              {/* Action Button Skeleton */}
              <div className="skeleton h-9 w-24 flex-shrink-0 rounded-md" />
            </div>
          ))}
        </div>
      </div>

      <span className="sr-only">Loading alerts...</span>
    </div>
  );
};

AlertsListSkeleton.displayName = 'AlertsListSkeleton';

export default AlertsListSkeleton;
