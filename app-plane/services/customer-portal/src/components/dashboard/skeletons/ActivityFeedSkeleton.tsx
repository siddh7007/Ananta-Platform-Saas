/**
 * ActivityFeedSkeleton Component
 * Loading skeleton for ActivityFeed widget
 * @module components/dashboard/skeletons
 */

import React from 'react';

export interface ActivityFeedSkeletonProps {
  /** Number of activity items to display */
  count?: number;
  /** Chart title */
  title?: string;
  /** CSS class name for customization */
  className?: string;
}

/**
 * ActivityFeedSkeleton displays animated placeholder while activity feed loads
 */
export const ActivityFeedSkeleton: React.FC<ActivityFeedSkeletonProps> = ({
  count = 5,
  title = 'Recent Team Activity',
  className = '',
}) => {
  return (
    <div className={`dashboard-widget ${className}`} aria-busy="true" aria-live="polite">
      {/* Header */}
      <div className="dashboard-widget-header">
        <h3 className="dashboard-widget-title">{title}</h3>
      </div>

      <div className="dashboard-widget-body">
        <div>
          {Array.from({ length: count }).map((_, index) => (
            <div
              key={index}
              className="flex items-start gap-4 py-4 border-b border-gray-100 last:border-b-0"
            >
              {/* Avatar Skeleton */}
              <div className="skeleton-circle w-10 h-10 flex-shrink-0" />

              {/* Content Skeleton */}
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-full" />
                <div className="flex items-center gap-2">
                  <div className="skeleton h-6 w-20 rounded-full" />
                  <div className="skeleton h-3 w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <span className="sr-only">Loading activity feed...</span>
    </div>
  );
};

ActivityFeedSkeleton.displayName = 'ActivityFeedSkeleton';

export default ActivityFeedSkeleton;
