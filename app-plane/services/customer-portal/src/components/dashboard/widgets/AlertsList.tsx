/**
 * AlertsList Component
 * Displays critical alerts with swipe-to-dismiss on tablet
 * @module components/dashboard/widgets
 */

import React, { useState } from 'react';
import { AlertTriangle, XCircle, ChevronRight, FileWarning } from 'lucide-react';
import type { Alert, AlertType, AlertSeverity } from '../../../types/dashboard';

export interface AlertsListProps {
  /** Array of critical alerts */
  alerts: Alert[];
  /** Maximum alerts to display */
  maxAlerts?: number;
  /** Chart title */
  title?: string;
  /** Callback when action button clicked */
  onActionClick?: (alert: Alert) => void;
  /** Callback when alert dismissed */
  onDismiss?: (alertId: string) => void;
  /** CSS class name for customization */
  className?: string;
}

/**
 * AlertsList displays critical portfolio alerts with inline actions
 * Touch-friendly with swipe gesture support
 */
export const AlertsList: React.FC<AlertsListProps> = ({
  alerts,
  maxAlerts = 5,
  title = 'Critical Alerts',
  onActionClick,
  onDismiss,
  className = '',
}) => {
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set());

  // Get icon for alert type
  const getAlertIcon = (severity: AlertSeverity) => {
    const iconClass = `alert-card-icon ${severity}`;
    const iconProps = {
      size: 24,
      'aria-hidden': true,
    };

    switch (severity) {
      case 'error':
        return <XCircle className={iconClass} {...iconProps} />;
      case 'warning':
      default:
        return <AlertTriangle className={iconClass} {...iconProps} />;
    }
  };

  // Get action button text based on alert type
  const getActionText = (type: AlertType): string => {
    switch (type) {
      case 'obsolete':
        return 'View BOMs';
      case 'quota':
        return 'Upgrade';
      case 'inactive_user':
        return 'Manage Team';
      case 'enrichment_failed':
        return 'Retry';
      default:
        return 'View Details';
    }
  };

  // Toggle expanded state for long messages
  const toggleExpanded = (alertId: string) => {
    setExpandedAlerts((prev) => {
      const next = new Set(prev);
      if (next.has(alertId)) {
        next.delete(alertId);
      } else {
        next.add(alertId);
      }
      return next;
    });
  };

  // Truncate message if too long
  const truncateMessage = (message: string, maxLength: number = 100): string => {
    if (message.length <= maxLength) return message;
    return `${message.substring(0, maxLength)}...`;
  };

  // Empty state
  const EmptyState = () => (
    <div
      className="flex flex-col items-center justify-center py-12 px-4 text-center"
      role="status"
    >
      <div className="w-16 h-16 mb-4 rounded-full bg-green-100 flex items-center justify-center">
        <FileWarning className="w-8 h-8 text-green-600" aria-hidden="true" />
      </div>
      <p className="text-lg font-medium text-gray-900">All clear!</p>
      <p className="text-sm text-gray-600 mt-1">No critical alerts at this time</p>
    </div>
  );

  const displayedAlerts = alerts.slice(0, maxAlerts);
  const hasMoreAlerts = alerts.length > maxAlerts;

  return (
    <div className={`dashboard-widget fade-in ${className}`}>
      <div className="dashboard-widget-header">
        <h3 className="dashboard-widget-title">
          {title}
          {alerts.length > 0 && (
            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
              {alerts.length}
            </span>
          )}
        </h3>
      </div>

      <div className="dashboard-widget-body">
        {alerts.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3" role="list" aria-label="Critical alerts">
            {displayedAlerts.map((alert) => {
              const isExpanded = expandedAlerts.has(alert.id);
              const shouldTruncate = alert.message.length > 100;
              const displayMessage = isExpanded
                ? alert.message
                : truncateMessage(alert.message);

              return (
                <div
                  key={alert.id}
                  className={`alert-card ${alert.severity}`}
                  role="listitem"
                  aria-label={`${alert.severity} alert: ${alert.message}`}
                >
                  {/* Alert Icon */}
                  {getAlertIcon(alert.severity)}

                  {/* Alert Content */}
                  <div className="alert-card-content">
                    <p className="alert-card-message">
                      {displayMessage}
                      {shouldTruncate && (
                        <button
                          onClick={() => toggleExpanded(alert.id)}
                          className="ml-2 text-blue-600 hover:text-blue-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                          aria-expanded={isExpanded}
                          aria-label={isExpanded ? 'Show less' : 'Show more'}
                        >
                          {isExpanded ? 'Less' : 'More'}
                        </button>
                      )}
                    </p>

                    {/* Timestamp */}
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(alert.createdAt).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>

                  {/* Action Button */}
                  {alert.actionUrl && (
                    <div className="alert-card-action">
                      <button
                        onClick={() => onActionClick?.(alert)}
                        className="inline-flex items-center gap-1 px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                        aria-label={`${getActionText(alert.type)} for this alert`}
                      >
                        {getActionText(alert.type)}
                        <ChevronRight size={16} aria-hidden="true" />
                      </button>
                    </div>
                  )}

                  {/* Dismiss Button (optional) */}
                  {onDismiss && (
                    <button
                      onClick={() => onDismiss(alert.id)}
                      className="ml-2 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 rounded p-1"
                      aria-label="Dismiss alert"
                    >
                      <XCircle size={20} aria-hidden="true" />
                    </button>
                  )}
                </div>
              );
            })}

            {/* More Alerts Indicator */}
            {hasMoreAlerts && (
              <div className="text-center pt-2">
                <p className="text-sm text-gray-600">
                  +{alerts.length - maxAlerts} more alert
                  {alerts.length - maxAlerts > 1 ? 's' : ''}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

AlertsList.displayName = 'AlertsList';

export default AlertsList;
