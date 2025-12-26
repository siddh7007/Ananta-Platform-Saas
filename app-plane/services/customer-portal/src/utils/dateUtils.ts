/**
 * Date Utilities
 *
 * Shared date formatting and manipulation functions.
 */

/**
 * Format a date string as relative time (e.g., "5m ago", "2h ago", "3d ago").
 * Handles both past and future dates gracefully.
 */
export function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return 'Unknown';

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'Unknown';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const absDiffMs = Math.abs(diffMs);
  const isFuture = diffMs < 0;

  const diffMins = Math.floor(absDiffMs / 60000);
  const diffHours = Math.floor(absDiffMs / 3600000);
  const diffDays = Math.floor(absDiffMs / 86400000);

  if (diffMins < 1) return 'Just now';

  let timeStr: string;
  if (diffMins < 60) {
    timeStr = `${diffMins}m`;
  } else if (diffHours < 24) {
    timeStr = `${diffHours}h`;
  } else {
    timeStr = `${diffDays}d`;
  }

  return isFuture ? `in ${timeStr}` : `${timeStr} ago`;
}

/**
 * Format a date for display with month, day, and time.
 */
export function formatDateTime(dateStr: string): string {
  if (!dateStr) return 'Unknown';

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'Unknown';

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format a date for display with full date.
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return 'Unknown';

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'Unknown';

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
