/**
 * Usage Tracking Type Definitions
 * Based on Control Plane Usage API
 */

export enum UsageMetricType {
  API_CALLS = 'api_calls',
  STORAGE_GB = 'storage_gb',
  USERS = 'users',
  BOMS = 'boms',
  COMPONENTS = 'components',
  DATA_EXPORTS = 'data_exports',
  ENRICHMENTS = 'enrichments',
}

export interface UsageStatus {
  metricType: string;
  metricName: string;
  currentUsage: number;
  softLimit: number | null;
  hardLimit: number | null;
  percentUsed: number;
  isOverSoftLimit: boolean;
  isOverHardLimit: boolean;
  unit: string;
  remainingAllowance: number | null;
}

export interface TenantQuota {
  id: string;
  tenantId: string;
  metricType: UsageMetricType;
  metricName: string;
  softLimit: number | null;
  hardLimit: number | null;
  currentUsage: number;
  unit: string;
  resetSchedule: 'monthly' | 'daily' | 'never';
  nextReset?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UsageTrend {
  period: string; // e.g., "2025-01", "2025-01-15"
  quantity: number;
  eventCount: number;
}

export interface UsageAnalytics {
  period: string;
  metrics: Array<{
    metricType: string;
    currentUsage: number;
    quota: number | null;
    percentUsed: number;
    overageAmount?: number;
    overageCost?: number;
  }>;
  totalOverageAmount?: number;
}

export interface UsageSummary {
  id: string;
  tenantId: string;
  billingPeriod: string;
  metricType: UsageMetricType;
  totalUsage: number;
  quota: number | null;
  overageAmount: number;
  overageCost: number | null;
  unit: string;
  createdAt: string;
  updatedAt: string;
}

export interface UsageEvent {
  id: string;
  tenantId: string;
  metricType: UsageMetricType;
  quantity: number;
  unit: string;
  eventTimestamp: string;
  billingPeriod: string;
  source?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

export interface QuotaCheckResult {
  exceeded: boolean;
  currentUsage?: number;
  limit?: number;
}

/**
 * Helper to format usage metric name for display
 */
export function formatMetricName(metricType: string): string {
  const names: Record<string, string> = {
    api_calls: 'API Calls',
    storage_gb: 'Storage (GB)',
    users: 'Users',
    boms: 'BOMs',
    components: 'Components',
    data_exports: 'Data Exports',
    enrichments: 'Enrichments',
  };
  return names[metricType] || metricType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Helper to get usage status color
 */
export function getUsageStatusColor(status: UsageStatus): 'green' | 'yellow' | 'red' | 'gray' {
  if (status.isOverHardLimit) return 'red';
  if (status.isOverSoftLimit) return 'yellow';
  if (status.percentUsed >= 80) return 'yellow';
  if (status.hardLimit === null) return 'gray'; // Unlimited
  return 'green';
}

/**
 * Helper to format usage value with unit
 */
export function formatUsageValue(value: number, unit: string): string {
  if (unit === 'GB') {
    return `${value.toFixed(2)} GB`;
  }
  if (unit === 'count' || !unit) {
    return value.toLocaleString();
  }
  return `${value.toLocaleString()} ${unit}`;
}

/**
 * Helper to calculate percent used
 */
export function calculatePercentUsed(current: number, limit: number | null): number {
  if (limit === null || limit === 0) return 0;
  return Math.min(100, Math.round((current / limit) * 100));
}
