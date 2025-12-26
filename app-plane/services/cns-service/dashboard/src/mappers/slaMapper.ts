/**
 * SLA Mapper
 *
 * Transforms timestamps and durations into SLA metrics and display objects.
 * Tracks time-based performance indicators for enrichment and processing.
 *
 * @module mappers/slaMapper
 */

// ============================================================
// Types
// ============================================================

export interface SLAConfig {
  /** Target time in minutes */
  targetMinutes: number;
  /** Warning threshold as percentage of target (e.g., 0.8 = 80%) */
  warningThreshold: number;
  /** Critical threshold as percentage of target (e.g., 1.0 = 100%) */
  criticalThreshold: number;
}

export type SLAStatus = 'on_track' | 'warning' | 'critical' | 'breached';

export interface SLADisplay {
  status: SLAStatus;
  label: string;
  color: string;
  elapsedMinutes: number;
  remainingMinutes: number | null;
  percentUsed: number;
  isBreached: boolean;
  formattedElapsed: string;
  formattedRemaining: string | null;
}

export interface ProcessingDuration {
  startedAt: Date;
  completedAt: Date | null;
  durationMs: number;
  durationFormatted: string;
  isComplete: boolean;
}

// ============================================================
// Constants
// ============================================================

const DEFAULT_SLA_CONFIG: SLAConfig = {
  targetMinutes: 30,
  warningThreshold: 0.7,
  criticalThreshold: 1.0,
};

const SLA_COLORS: Record<SLAStatus, string> = {
  on_track: '#10b981', // Green
  warning: '#f59e0b', // Amber
  critical: '#ef4444', // Red
  breached: '#7f1d1d', // Dark red
};

const SLA_LABELS: Record<SLAStatus, string> = {
  on_track: 'On Track',
  warning: 'Warning',
  critical: 'Critical',
  breached: 'SLA Breached',
};

// ============================================================
// Time Formatting
// ============================================================

/**
 * Format minutes into a human-readable duration string
 */
export function formatDuration(minutes: number): string {
  if (minutes < 1) {
    return '<1 min';
  }
  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMins = Math.round(minutes % 60);
  if (remainingMins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remainingMins}m`;
}

/**
 * Format milliseconds into a human-readable duration string
 */
export function formatDurationMs(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return formatDuration(ms / 60000);
}

/**
 * Format a date as relative time (e.g., "5 minutes ago")
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = diffMs / 60000;

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${Math.round(diffMins)} minutes ago`;
  if (diffMins < 1440) return `${Math.round(diffMins / 60)} hours ago`;
  return `${Math.round(diffMins / 1440)} days ago`;
}

// ============================================================
// SLA Calculation
// ============================================================

/**
 * Calculate SLA status based on elapsed time
 */
export function calculateSLAStatus(
  elapsedMinutes: number,
  config: SLAConfig = DEFAULT_SLA_CONFIG
): SLAStatus {
  const percentUsed = elapsedMinutes / config.targetMinutes;

  if (percentUsed > 1) return 'breached';
  if (percentUsed >= config.criticalThreshold) return 'critical';
  if (percentUsed >= config.warningThreshold) return 'warning';
  return 'on_track';
}

/**
 * Map a start time and optional end time to SLA display
 */
export function mapSLA(
  startedAt: Date | string,
  completedAt?: Date | string | null,
  config: SLAConfig = DEFAULT_SLA_CONFIG
): SLADisplay {
  const startDate = typeof startedAt === 'string' ? new Date(startedAt) : startedAt;
  const endDate = completedAt
    ? typeof completedAt === 'string'
      ? new Date(completedAt)
      : completedAt
    : new Date();

  const elapsedMs = endDate.getTime() - startDate.getTime();
  const elapsedMinutes = elapsedMs / 60000;
  const remainingMinutes = completedAt ? null : Math.max(0, config.targetMinutes - elapsedMinutes);
  const percentUsed = (elapsedMinutes / config.targetMinutes) * 100;
  const status = calculateSLAStatus(elapsedMinutes, config);

  return {
    status,
    label: SLA_LABELS[status],
    color: SLA_COLORS[status],
    elapsedMinutes,
    remainingMinutes,
    percentUsed: Math.min(100, Math.round(percentUsed)),
    isBreached: status === 'breached',
    formattedElapsed: formatDuration(elapsedMinutes),
    formattedRemaining: remainingMinutes !== null ? formatDuration(remainingMinutes) : null,
  };
}

// ============================================================
// Processing Duration
// ============================================================

/**
 * Map processing timestamps to a duration object
 */
export function mapProcessingDuration(
  startedAt: Date | string,
  completedAt?: Date | string | null
): ProcessingDuration {
  const startDate = typeof startedAt === 'string' ? new Date(startedAt) : startedAt;
  const isComplete = Boolean(completedAt);

  let endDate: Date;
  if (completedAt) {
    endDate = typeof completedAt === 'string' ? new Date(completedAt) : completedAt;
  } else {
    endDate = new Date();
  }

  const durationMs = endDate.getTime() - startDate.getTime();

  return {
    startedAt: startDate,
    completedAt: isComplete ? endDate : null,
    durationMs,
    durationFormatted: formatDurationMs(durationMs),
    isComplete,
  };
}

// ============================================================
// Batch Processing Metrics
// ============================================================

export interface BatchSLAMetrics {
  totalJobs: number;
  completedJobs: number;
  onTrackCount: number;
  warningCount: number;
  criticalCount: number;
  breachedCount: number;
  averageDurationMinutes: number;
  averageFormattedDuration: string;
  overallHealth: SLAStatus;
}

/**
 * Calculate aggregate SLA metrics for a batch of jobs
 */
export function mapBatchSLAMetrics(
  jobs: Array<{
    started_at?: string | Date;
    completed_at?: string | Date | null;
    status?: string;
  }>,
  config: SLAConfig = DEFAULT_SLA_CONFIG
): BatchSLAMetrics {
  let onTrackCount = 0;
  let warningCount = 0;
  let criticalCount = 0;
  let breachedCount = 0;
  let totalDurationMinutes = 0;
  let completedJobs = 0;

  for (const job of jobs) {
    if (!job.started_at) continue;

    const sla = mapSLA(job.started_at, job.completed_at, config);
    totalDurationMinutes += sla.elapsedMinutes;

    if (job.completed_at || job.status === 'completed') {
      completedJobs++;
    }

    switch (sla.status) {
      case 'on_track':
        onTrackCount++;
        break;
      case 'warning':
        warningCount++;
        break;
      case 'critical':
        criticalCount++;
        break;
      case 'breached':
        breachedCount++;
        break;
    }
  }

  const averageDurationMinutes = jobs.length > 0 ? totalDurationMinutes / jobs.length : 0;

  // Determine overall health
  let overallHealth: SLAStatus;
  if (breachedCount > 0) {
    overallHealth = 'breached';
  } else if (criticalCount > jobs.length * 0.1) {
    overallHealth = 'critical';
  } else if (warningCount > jobs.length * 0.2) {
    overallHealth = 'warning';
  } else {
    overallHealth = 'on_track';
  }

  return {
    totalJobs: jobs.length,
    completedJobs,
    onTrackCount,
    warningCount,
    criticalCount,
    breachedCount,
    averageDurationMinutes,
    averageFormattedDuration: formatDuration(averageDurationMinutes),
    overallHealth,
  };
}

// ============================================================
// Time Window Helpers
// ============================================================

export type TimeWindow = '1h' | '6h' | '24h' | '7d' | '30d';

const TIME_WINDOW_MS: Record<TimeWindow, number> = {
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

/**
 * Filter items to those within a time window
 */
export function filterByTimeWindow<T extends { created_at?: string | Date; started_at?: string | Date }>(
  items: T[],
  window: TimeWindow,
  dateField: 'created_at' | 'started_at' = 'created_at'
): T[] {
  const now = new Date();
  const cutoff = new Date(now.getTime() - TIME_WINDOW_MS[window]);

  return items.filter((item) => {
    const dateValue = item[dateField];
    if (!dateValue) return false;
    const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
    return date >= cutoff;
  });
}

/**
 * Get time window label
 */
export function getTimeWindowLabel(window: TimeWindow): string {
  const labels: Record<TimeWindow, string> = {
    '1h': 'Last Hour',
    '6h': 'Last 6 Hours',
    '24h': 'Last 24 Hours',
    '7d': 'Last 7 Days',
    '30d': 'Last 30 Days',
  };
  return labels[window];
}
