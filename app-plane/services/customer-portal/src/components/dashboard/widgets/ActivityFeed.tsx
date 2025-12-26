/**
 * ActivityFeed Component
 * Timeline of recent team activity with user avatars
 * @module components/dashboard/widgets
 */

import React, { useState } from 'react';
import {
  Upload,
  GitCompare,
  Sparkles,
  CheckCircle,
  Download,
  User,
} from 'lucide-react';
import type { ActivityItem, ActivityAction } from '../../../types/dashboard';

export interface ActivityFeedProps {
  /** Array of activity items */
  activities: ActivityItem[];
  /** Maximum activities to display initially */
  maxActivities?: number;
  /** Chart title */
  title?: string;
  /** Enable infinite scroll */
  enableLoadMore?: boolean;
  /** Callback when load more clicked */
  onLoadMore?: () => void;
  /** Loading state */
  isLoading?: boolean;
  /** CSS class name for customization */
  className?: string;
}

/**
 * ActivityFeed displays chronological team activity with visual action badges
 * Compact design for sidebar placement
 */
export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  activities,
  maxActivities = 10,
  title = 'Recent Team Activity',
  enableLoadMore = false,
  onLoadMore,
  isLoading = false,
  className = '',
}) => {
  const [displayCount, setDisplayCount] = useState(maxActivities);

  // Get icon for activity action
  const getActionIcon = (action: ActivityAction) => {
    const iconProps = {
      size: 16,
      'aria-hidden': true,
    };

    switch (action) {
      case 'upload':
        return <Upload {...iconProps} />;
      case 'compare':
        return <GitCompare {...iconProps} />;
      case 'enrich':
        return <Sparkles {...iconProps} />;
      case 'approve':
        return <CheckCircle {...iconProps} />;
      case 'export':
        return <Download {...iconProps} />;
      default:
        return <User {...iconProps} />;
    }
  };

  // Get action verb text
  const getActionText = (action: ActivityAction): string => {
    switch (action) {
      case 'upload':
        return 'uploaded';
      case 'compare':
        return 'compared';
      case 'enrich':
        return 'enriched';
      case 'approve':
        return 'approved';
      case 'export':
        return 'exported';
      default:
        return 'performed action on';
    }
  };

  // Format relative timestamp
  const formatTimestamp = (timestamp: Date): string => {
    const now = new Date();
    const diff = now.getTime() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  // Get user initials for avatar
  const getUserInitials = (name: string): string => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Handle load more
  const handleLoadMore = () => {
    if (onLoadMore) {
      onLoadMore();
    } else {
      setDisplayCount((prev) => prev + maxActivities);
    }
  };

  const displayedActivities = activities.slice(0, displayCount);
  const hasMore = activities.length > displayCount;

  return (
    <div className={`dashboard-widget fade-in ${className}`}>
      <div className="dashboard-widget-header">
        <h3 className="dashboard-widget-title">{title}</h3>
      </div>

      <div className="dashboard-widget-body">
        {activities.length === 0 ? (
          <div
            className="text-center py-8 px-4"
            role="status"
            aria-label="No recent activity"
          >
            <p className="text-sm text-gray-600">No recent activity</p>
          </div>
        ) : (
          <div role="list" aria-label="Team activity timeline">
            {displayedActivities.map((activity) => (
              <div
                key={activity.id}
                className="activity-item"
                role="listitem"
                aria-label={`${activity.userName} ${getActionText(activity.action)} ${activity.target} ${formatTimestamp(activity.timestamp)}`}
              >
                {/* User Avatar */}
                <div className="activity-avatar">
                  {activity.userAvatar ? (
                    <img
                      src={activity.userAvatar}
                      alt={`${activity.userName} avatar`}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span aria-label={`${activity.userName} initials`}>
                      {getUserInitials(activity.userName)}
                    </span>
                  )}
                </div>

                {/* Activity Content */}
                <div className="activity-content">
                  <div className="activity-text">
                    <strong className="font-medium text-gray-900">
                      {activity.userName}
                    </strong>{' '}
                    {getActionText(activity.action)}{' '}
                    <span className="activity-target">
                      &quot;{activity.target}&quot;
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    {/* Action Badge */}
                    <span className={`activity-badge ${activity.action}`}>
                      {getActionIcon(activity.action)}
                      <span className="ml-1 capitalize">{activity.action}</span>
                    </span>

                    {/* Timestamp */}
                    <span className="activity-timestamp">
                      {formatTimestamp(activity.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Load More Button */}
        {(hasMore || enableLoadMore) && !isLoading && (
          <div className="mt-4 text-center">
            <button
              onClick={handleLoadMore}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md transition-colors"
              aria-label="Load more activities"
            >
              Load More
            </button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="mt-4 text-center" role="status" aria-live="polite">
            <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="sr-only">Loading more activities...</span>
          </div>
        )}
      </div>
    </div>
  );
};

ActivityFeed.displayName = 'ActivityFeed';

export default ActivityFeed;
