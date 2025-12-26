/**
 * ActivityLog Component
 *
 * Timeline view of BOM history and changes:
 * - Chronological activity feed
 * - User attribution
 * - Change details with diff view
 * - Version history with restore option
 */

import { useState, useMemo } from 'react';
import {
  FilePlus,
  Edit,
  Trash2,
  Copy,
  Download,
  Sparkles,
  CheckCircle,
  XCircle,
  PlusCircle,
  Edit2,
  MinusCircle,
  Link,
  Unlink,
  RefreshCw,
  Upload,
  MessageSquare,
  GitCommit,
  History,
  ChevronDown,
  ChevronRight,
  Clock,
  User,
  RotateCcw,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import type {
  BomActivityEvent,
  BomVersion,
  ActivityEventType,
  ActivityChange,
} from '@/types/activity';
import {
  ACTIVITY_EVENT_CONFIG,
  formatActivityTime,
  formatActivityTimeFull,
  groupActivitiesByDate,
  getActivityUserDisplay,
} from '@/types/activity';

/**
 * Map event types to Lucide icons
 */
const EVENT_ICONS: Record<ActivityEventType, React.ReactNode> = {
  bom_created: <FilePlus className="h-4 w-4" />,
  bom_updated: <Edit className="h-4 w-4" />,
  bom_deleted: <Trash2 className="h-4 w-4" />,
  bom_duplicated: <Copy className="h-4 w-4" />,
  bom_exported: <Download className="h-4 w-4" />,
  enrichment_started: <Sparkles className="h-4 w-4" />,
  enrichment_completed: <CheckCircle className="h-4 w-4" />,
  enrichment_failed: <XCircle className="h-4 w-4" />,
  line_item_added: <PlusCircle className="h-4 w-4" />,
  line_item_updated: <Edit2 className="h-4 w-4" />,
  line_item_deleted: <MinusCircle className="h-4 w-4" />,
  component_linked: <Link className="h-4 w-4" />,
  component_unlinked: <Unlink className="h-4 w-4" />,
  status_changed: <RefreshCw className="h-4 w-4" />,
  file_uploaded: <Upload className="h-4 w-4" />,
  note_added: <MessageSquare className="h-4 w-4" />,
  version_created: <GitCommit className="h-4 w-4" />,
  version_restored: <History className="h-4 w-4" />,
};

/**
 * Fallback config for unknown event types - prevents render crashes
 */
const UNKNOWN_EVENT_CONFIG = {
  label: 'Activity',
  icon: 'circle',
  color: 'text-gray-700',
  bgColor: 'bg-gray-100',
};

const UNKNOWN_EVENT_ICON = <Clock className="h-4 w-4" />;

/**
 * Safe getter for event config with fallback for unknown types
 */
function getEventConfig(eventType: string) {
  return ACTIVITY_EVENT_CONFIG[eventType as ActivityEventType] || UNKNOWN_EVENT_CONFIG;
}

/**
 * Safe getter for event icon with fallback for unknown types
 */
function getEventIcon(eventType: string) {
  return EVENT_ICONS[eventType as ActivityEventType] || UNKNOWN_EVENT_ICON;
}

interface ActivityLogProps {
  /** BOM ID for fetching history */
  bomId: string;
  /** Activity events to display */
  activities: BomActivityEvent[];
  /** Version history for restore functionality */
  versions?: BomVersion[];
  /** Loading state */
  isLoading?: boolean;
  /** Error message */
  error?: string;
  /** Callback when restore is requested */
  onRestoreVersion?: (version: BomVersion) => Promise<void>;
  /** Whether restore is in progress */
  isRestoring?: boolean;
  /** Show compact view */
  compact?: boolean;
  /** Maximum items to show before "Show more" */
  maxItems?: number;
  /** Additional class names */
  className?: string;
  /** Total activities available on server (for pagination) */
  totalActivities?: number;
  /** Whether more activities can be loaded from server */
  hasMoreActivities?: boolean;
  /** Callback to load more activities from server */
  onLoadMoreActivities?: () => Promise<void>;
  /** Whether more activities are currently loading */
  isLoadingMore?: boolean;
}

export function ActivityLog({
  bomId: _bomId,
  activities,
  versions = [],
  isLoading = false,
  error,
  onRestoreVersion,
  isRestoring = false,
  compact = false,
  maxItems = 10,
  className = '',
  totalActivities,
  hasMoreActivities = false,
  onLoadMoreActivities,
  isLoadingMore = false,
}: ActivityLogProps) {
  // bomId reserved for future use (e.g., fetching more history)
  void _bomId;

  const [expandedActivities, setExpandedActivities] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [restoreConfirmVersion, setRestoreConfirmVersion] = useState<BomVersion | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  // Group activities by date (reserved for future grouped timeline view)
  const _groupedActivities = useMemo(
    () => groupActivitiesByDate(activities),
    [activities]
  );
  void _groupedActivities;

  // Limit displayed activities unless showing all
  const displayedActivities = useMemo(() => {
    if (showAll || activities.length <= maxItems) {
      return activities;
    }
    return activities.slice(0, maxItems);
  }, [activities, showAll, maxItems]);

  // Toggle activity details expansion
  const toggleExpanded = (activityId: string) => {
    setExpandedActivities((prev) => {
      const next = new Set(prev);
      if (next.has(activityId)) {
        next.delete(activityId);
      } else {
        next.add(activityId);
      }
      return next;
    });
  };

  // Handle restore confirmation
  const handleRestoreClick = (version: BomVersion) => {
    setRestoreError(null);
    setRestoreConfirmVersion(version);
  };

  const handleRestoreConfirm = async () => {
    if (!restoreConfirmVersion || !onRestoreVersion) return;

    setRestoreError(null);
    try {
      await onRestoreVersion(restoreConfirmVersion);
      setRestoreConfirmVersion(null);
    } catch (err) {
      // Display error to user and keep dialog open for retry
      const message = err instanceof Error ? err.message : 'Failed to restore version';
      setRestoreError(message);
      console.error('[ActivityLog] Restore failed:', err);
    }
  };

  const handleRestoreCancel = () => {
    setRestoreConfirmVersion(null);
    setRestoreError(null);
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5" />
            Activity Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5" />
            Activity Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-destructive p-4 bg-destructive/10 rounded-md">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5" />
            Activity Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No activity recorded yet</p>
            <p className="text-sm mt-1">Changes to this BOM will appear here</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="h-5 w-5" />
              Activity Log
            </CardTitle>
            <CardDescription>
              {activities.length} event{activities.length !== 1 ? 's' : ''}
              {versions.length > 0 && ` | ${versions.length} version${versions.length !== 1 ? 's' : ''}`}
            </CardDescription>
          </div>
          {versions.length > 0 && (
            <Badge variant="outline" className="text-xs">
              <GitCommit className="h-3 w-3 mr-1" />
              v{versions[0]?.versionNumber || 1}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <div className={`overflow-y-auto ${compact ? 'h-64' : 'max-h-[500px]'}`}>
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

            {/* Activity items */}
            <div className="space-y-0" role="feed" aria-label="Activity timeline">
              {displayedActivities.map((activity) => {
                // Use safe getters with fallback for unknown event types
                const config = getEventConfig(activity.eventType);
                const icon = getEventIcon(activity.eventType);
                const isExpanded = expandedActivities.has(activity.id);
                const hasDetails =
                  (activity.changes && activity.changes.length > 0) ||
                  activity.metadata;

                return (
                  <article
                    key={activity.id}
                    className="relative pl-10 pb-6 last:pb-0"
                    aria-label={`${config.label}: ${activity.description}`}
                  >
                    {/* Timeline dot */}
                    <div
                      className={`absolute left-0 top-0 w-8 h-8 rounded-full flex items-center justify-center ${config.bgColor} ${config.color}`}
                      aria-hidden="true"
                    >
                      {icon}
                    </div>

                    {/* Content */}
                    <div className="min-h-8">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          {/* Event label and description */}
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${config.color}`}>
                              {config.label}
                            </span>
                            {activity.lineItemMpn && (
                              <Badge variant="outline" className="text-xs font-mono">
                                {activity.lineItemMpn}
                              </Badge>
                            )}
                          </div>

                          {/* Description */}
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {activity.description}
                          </p>

                          {/* User and time */}
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="flex items-center gap-1 cursor-help">
                                    <User className="h-3 w-3" />
                                    {getActivityUserDisplay(activity)}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {activity.userEmail || 'System action'}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="flex items-center gap-1 cursor-help">
                                    <Clock className="h-3 w-3" />
                                    {formatActivityTime(activity.timestamp)}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {formatActivityTimeFull(activity.timestamp)}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </div>

                        {/* Expand/collapse button for details */}
                        {hasDetails && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => toggleExpanded(activity.id)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>

                      {/* Expanded details */}
                      {isExpanded && hasDetails && (
                        <div className="mt-3 p-3 bg-muted/50 rounded-md">
                          {activity.changes && activity.changes.length > 0 && (
                            <ChangesList changes={activity.changes} />
                          )}
                          {activity.metadata && (
                            <div className="mt-2 text-xs text-muted-foreground">
                              <pre className="whitespace-pre-wrap">
                                {JSON.stringify(activity.metadata, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Version restore button */}
                      {activity.eventType === 'version_created' &&
                        activity.versionId &&
                        onRestoreVersion && (
                          <div className="mt-2">
                            {(() => {
                              const version = versions.find(
                                (v) => v.id === activity.versionId
                              );
                              if (!version || !version.canRestore) return null;
                              return (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => handleRestoreClick(version)}
                                  disabled={isRestoring}
                                >
                                  <RotateCcw className="h-3 w-3 mr-1" />
                                  Restore this version
                                </Button>
                              );
                            })()}
                          </div>
                        )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          {/* Show more button - supports both client-side and server-side pagination */}
          {(activities.length > maxItems && !showAll) || hasMoreActivities ? (
            <div className="text-center mt-4 pt-4 border-t">
              {/* Client-side: show remaining loaded activities */}
              {activities.length > maxItems && !showAll && (
                <Button variant="ghost" size="sm" onClick={() => setShowAll(true)}>
                  Show {activities.length - maxItems} more events
                </Button>
              )}

              {/* Server-side: load more from API
                  Show when:
                  1. All client-side items are visible (showAll=true OR activities.length <= maxItems)
                  2. AND server has more items (hasMoreActivities=true)
                  This fixes the bug where first page has fewer items than maxItems */}
              {(showAll || activities.length <= maxItems) &&
                hasMoreActivities &&
                onLoadMoreActivities && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onLoadMoreActivities}
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        Load more events
                        {totalActivities && totalActivities > activities.length && (
                          <span className="ml-1 text-muted-foreground">
                            ({totalActivities - activities.length} remaining)
                          </span>
                        )}
                      </>
                    )}
                  </Button>
                )}
            </div>
          ) : null}
        </div>
      </CardContent>

      {/* Restore confirmation dialog */}
      <Dialog
        open={restoreConfirmVersion !== null}
        onOpenChange={(open) => !open && handleRestoreCancel()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Restore Version
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to restore this BOM to version{' '}
              {restoreConfirmVersion?.versionNumber}?
            </DialogDescription>
          </DialogHeader>

          {restoreConfirmVersion && (
            <div className="bg-muted/50 rounded-md p-4 text-sm">
              <dl className="space-y-2">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Version</dt>
                  <dd className="font-medium">v{restoreConfirmVersion.versionNumber}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Created</dt>
                  <dd>{formatActivityTimeFull(restoreConfirmVersion.createdAt)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Line Count</dt>
                  <dd>{restoreConfirmVersion.lineCount}</dd>
                </div>
                {restoreConfirmVersion.comment && (
                  <div className="pt-2 border-t">
                    <dt className="text-muted-foreground mb-1">Comment</dt>
                    <dd>{restoreConfirmVersion.comment}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-md text-amber-800 text-sm">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>
              This will create a new version with the restored content. The current
              version will remain in history.
            </span>
          </div>

          {/* Error display */}
          {restoreError && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-md text-destructive text-sm">
              <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{restoreError}</span>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleRestoreCancel}
              disabled={isRestoring}
            >
              Cancel
            </Button>
            <Button onClick={handleRestoreConfirm} disabled={isRestoring}>
              {isRestoring ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Restoring...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Restore Version
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/**
 * Display list of field changes
 */
function ChangesList({ changes }: { changes: ActivityChange[] }) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground mb-2">Changes:</div>
      <div className="space-y-1">
        {changes.map((change, idx) => (
          <div key={idx} className="flex items-center gap-2 text-xs">
            <span className="font-medium min-w-20">
              {change.fieldLabel || change.field}:
            </span>
            <span className="text-red-600 line-through">
              {formatChangeValue(change.previousValue)}
            </span>
            <span className="text-muted-foreground">-&gt;</span>
            <span className="text-green-600">
              {formatChangeValue(change.newValue)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Format change value for display
 */
function formatChangeValue(value: unknown): string {
  if (value === null || value === undefined) return '(empty)';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value.toLocaleString();
  return String(value);
}

/**
 * Compact activity log for sidebar/drawer display
 */
export function ActivityLogCompact({
  activities,
  maxItems = 5,
  className = '',
}: {
  activities: BomActivityEvent[];
  maxItems?: number;
  className?: string;
}) {
  const displayedActivities = activities.slice(0, maxItems);

  if (activities.length === 0) {
    return (
      <div className={`text-center py-4 text-muted-foreground text-sm ${className}`}>
        No recent activity
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`} role="feed" aria-label="Recent activity">
      {displayedActivities.map((activity) => {
        // Use safe getters with fallback for unknown event types
        const config = getEventConfig(activity.eventType);
        const icon = getEventIcon(activity.eventType);

        return (
          <div key={activity.id} className="flex items-start gap-2">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${config.bgColor} ${config.color}`}
              aria-hidden="true"
            >
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">{activity.description}</p>
              <p className="text-xs text-muted-foreground">
                {formatActivityTime(activity.timestamp)}
              </p>
            </div>
          </div>
        );
      })}

      {activities.length > maxItems && (
        <p className="text-xs text-muted-foreground text-center">
          +{activities.length - maxItems} more events
        </p>
      )}
    </div>
  );
}

export default ActivityLog;
