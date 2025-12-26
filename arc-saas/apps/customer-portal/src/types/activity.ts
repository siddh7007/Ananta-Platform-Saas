/**
 * Activity and History types for BOM version tracking
 *
 * Used by:
 * - BOM history/audit log display
 * - Activity timeline in BOM detail page
 * - User attribution for changes
 */

/**
 * Activity event types - what actions can be tracked
 */
export type ActivityEventType =
  | 'bom_created'
  | 'bom_updated'
  | 'bom_deleted'
  | 'bom_duplicated'
  | 'bom_exported'
  | 'enrichment_started'
  | 'enrichment_completed'
  | 'enrichment_failed'
  | 'line_item_added'
  | 'line_item_updated'
  | 'line_item_deleted'
  | 'component_linked'
  | 'component_unlinked'
  | 'status_changed'
  | 'file_uploaded'
  | 'note_added'
  | 'version_created'
  | 'version_restored';

/**
 * Activity event for BOM history
 */
export interface BomActivityEvent {
  id: string;
  bomId: string;
  eventType: ActivityEventType;

  // User who performed the action
  userId?: string;
  userName?: string;
  userEmail?: string;

  // Event details
  description: string;
  timestamp: string;

  // Change tracking
  changes?: ActivityChange[];
  metadata?: Record<string, unknown>;

  // For version/snapshot events
  versionId?: string;
  versionNumber?: number;

  // For line item events
  lineItemId?: string;
  lineItemMpn?: string;
}

/**
 * Represents a single field change
 */
export interface ActivityChange {
  field: string;
  fieldLabel?: string;
  previousValue?: string | number | boolean | null;
  newValue?: string | number | boolean | null;
}

/**
 * BOM version/snapshot for history
 */
export interface BomVersion {
  id: string;
  bomId: string;
  versionNumber: number;

  // Snapshot data
  name: string;
  lineCount: number;
  enrichedCount: number;
  status: string;

  // User who created this version
  createdBy?: string;
  createdByName?: string;
  createdAt: string;

  // Optional comment/reason for version
  comment?: string;

  // Whether this version can be restored
  canRestore: boolean;
}

/**
 * History response from API
 */
export interface BomHistoryResponse {
  bomId: string;
  activities: BomActivityEvent[];
  versions: BomVersion[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Configuration for activity event display
 */
export const ACTIVITY_EVENT_CONFIG: Record<
  ActivityEventType,
  {
    label: string;
    icon: string;
    color: string;
    bgColor: string;
  }
> = {
  bom_created: {
    label: 'BOM Created',
    icon: 'file-plus',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
  },
  bom_updated: {
    label: 'BOM Updated',
    icon: 'edit',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
  },
  bom_deleted: {
    label: 'BOM Deleted',
    icon: 'trash-2',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
  },
  bom_duplicated: {
    label: 'BOM Duplicated',
    icon: 'copy',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
  },
  bom_exported: {
    label: 'BOM Exported',
    icon: 'download',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
  },
  enrichment_started: {
    label: 'Enrichment Started',
    icon: 'sparkles',
    color: 'text-amber-700',
    bgColor: 'bg-amber-100',
  },
  enrichment_completed: {
    label: 'Enrichment Completed',
    icon: 'check-circle',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
  },
  enrichment_failed: {
    label: 'Enrichment Failed',
    icon: 'x-circle',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
  },
  line_item_added: {
    label: 'Line Item Added',
    icon: 'plus-circle',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
  },
  line_item_updated: {
    label: 'Line Item Updated',
    icon: 'edit-2',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
  },
  line_item_deleted: {
    label: 'Line Item Deleted',
    icon: 'minus-circle',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
  },
  component_linked: {
    label: 'Component Linked',
    icon: 'link',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
  },
  component_unlinked: {
    label: 'Component Unlinked',
    icon: 'unlink',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
  },
  status_changed: {
    label: 'Status Changed',
    icon: 'refresh-cw',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
  },
  file_uploaded: {
    label: 'File Uploaded',
    icon: 'upload',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
  },
  note_added: {
    label: 'Note Added',
    icon: 'message-square',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
  },
  version_created: {
    label: 'Version Created',
    icon: 'git-commit',
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-100',
  },
  version_restored: {
    label: 'Version Restored',
    icon: 'history',
    color: 'text-teal-700',
    bgColor: 'bg-teal-100',
  },
};

/**
 * Format timestamp for display
 */
export function formatActivityTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Format full timestamp for tooltip
 */
export function formatActivityTimeFull(timestamp: string): string {
  return new Date(timestamp).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Group activities by date
 */
export function groupActivitiesByDate(
  activities: BomActivityEvent[]
): Map<string, BomActivityEvent[]> {
  const groups = new Map<string, BomActivityEvent[]>();

  for (const activity of activities) {
    const date = new Date(activity.timestamp);
    const dateKey = date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const existing = groups.get(dateKey) || [];
    existing.push(activity);
    groups.set(dateKey, existing);
  }

  return groups;
}

/**
 * Get display name for a user
 */
export function getActivityUserDisplay(activity: BomActivityEvent): string {
  if (activity.userName) return activity.userName;
  if (activity.userEmail) return activity.userEmail.split('@')[0];
  return 'System';
}
