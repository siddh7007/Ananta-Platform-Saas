/**
 * Audit Log Type Definitions
 * Based on Control Plane AuditLog model
 */

export interface AuditLog {
  id: string;
  action: string; // e.g., 'tenant.created', 'user.login', 'subscription.updated'
  actorId: string; // UUID of user who performed action
  actorType?: string; // 'user', 'system', 'api'
  targetId?: string; // UUID of entity that was affected
  targetType?: string; // 'tenant', 'user', 'subscription', 'invoice'
  tenantId: string;
  timestamp: string;
  details?: Record<string, unknown>; // Additional metadata
  ipAddress?: string;
  userAgent?: string;
  status?: 'success' | 'failure';
  errorMessage?: string;
}

export interface AuditLogFilterParams {
  action?: string;
  actorId?: string;
  targetId?: string;
  targetType?: string;
  startDate?: string;
  endDate?: string;
  status?: 'success' | 'failure';
  limit?: number;
  offset?: number;
}

export interface PaginatedAuditLogs {
  data: AuditLog[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Helper to format action name for display
 */
export function formatActionName(action: string): string {
  // Convert 'tenant.created' to 'Tenant Created'
  const parts = action.split('.');
  return parts
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Helper to get action category
 */
export function getActionCategory(action: string): string {
  const [category] = action.split('.');
  return category || 'unknown';
}

/**
 * Helper to get action icon based on category
 */
export function getActionIcon(action: string): string {
  const category = getActionCategory(action);
  const icons: Record<string, string> = {
    tenant: 'building',
    user: 'user',
    subscription: 'credit-card',
    invoice: 'file-text',
    plan: 'package',
    payment: 'dollar-sign',
    audit: 'shield',
    login: 'log-in',
    logout: 'log-out',
    system: 'server',
  };
  return icons[category] || 'activity';
}

/**
 * Helper to format timestamp for display
 */
export function formatAuditTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  if (diffMins < 10080) return `${Math.floor(diffMins / 1440)}d ago`;

  // Older than a week, show full date
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Helper to get status color
 */
export function getStatusColor(status?: string): 'green' | 'red' | 'gray' {
  if (status === 'success') return 'green';
  if (status === 'failure') return 'red';
  return 'gray';
}
