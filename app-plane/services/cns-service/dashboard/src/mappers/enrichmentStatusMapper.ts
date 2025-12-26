/**
 * Enrichment Status Mapper
 *
 * Transforms raw enrichment status values into normalized display objects
 * with colors, labels, icons, and progress indicators.
 *
 * IMPORTANT: This mapper now uses types from types/index.ts for consistency
 * with the database schema. DBEnrichmentStatus values come from the database,
 * EnrichmentStatus values are used for UI display.
 *
 * @module mappers/enrichmentStatusMapper
 */

import {
  getEnrichmentStatusColor,
  getJobStatusColor,
  getWorkflowStatusColor,
  enrichmentStatusColors,
  jobStatusColors,
  workflowStatusColors,
} from '../theme';
import { DBEnrichmentStatus, EnrichmentStatus, mapDBStatusToDisplay } from '../types';

// ============================================================
// Types
// ============================================================

/**
 * Extended enrichment phase including UI-specific states.
 * Superset of EnrichmentStatus with additional display states.
 */
export type EnrichmentPhase =
  | 'pending'
  | 'queued'
  | 'processing'
  | 'enriching'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'partial';

export interface EnrichmentStatusDisplay {
  status: EnrichmentPhase;
  label: string;
  color: string;
  isActive: boolean;
  isComplete: boolean;
  isFailed: boolean;
  progressPercent: number | null;
  canRetry: boolean;
  canCancel: boolean;
}

export interface JobStatusDisplay {
  status: string;
  label: string;
  color: string;
  isTerminal: boolean;
  priority: number;
}

export interface WorkflowStepDisplay {
  step: number;
  name: string;
  status: 'pending' | 'active' | 'completed' | 'failed' | 'skipped';
  color: string;
}

// ============================================================
// Status Normalization
// ============================================================

/**
 * Alias mapping for various status string formats.
 *
 * Maps both database values (DBEnrichmentStatus) and legacy/alternative
 * status strings to the canonical EnrichmentPhase used in the UI.
 *
 * Database values (from bom_line_items.enrichment_status):
 * - pending, queued, processing, enriched, failed, requires_approval
 *
 * Legacy/alternative values (for backward compatibility):
 * - Various synonyms like 'running', 'complete', 'success', etc.
 */
const STATUS_ALIASES: Record<string, EnrichmentPhase> = {
  // Pending states
  pending: 'pending',
  waiting: 'pending',
  new: 'pending',
  created: 'pending',
  initialized: 'pending',
  requires_approval: 'pending',  // DB value - needs review before proceeding

  // Queued states
  queued: 'queued',              // DB value
  scheduled: 'queued',
  in_queue: 'queued',

  // Processing states
  processing: 'processing',      // DB value
  running: 'processing',
  enriching: 'enriching',
  in_progress: 'processing',
  active: 'processing',

  // Completed states
  completed: 'completed',
  complete: 'completed',
  enriched: 'completed',         // DB value - successfully enriched
  success: 'completed',
  done: 'completed',
  finished: 'completed',

  // Failed states
  failed: 'failed',              // DB value
  error: 'failed',
  errored: 'failed',

  // Cancelled states
  cancelled: 'cancelled',
  canceled: 'cancelled',
  aborted: 'cancelled',
  stopped: 'cancelled',

  // Partial states
  partial: 'partial',
  partial_success: 'partial',
  partially_completed: 'partial',
};

/**
 * Normalize various status string formats to a canonical EnrichmentPhase.
 *
 * Handles:
 * - Database values (DBEnrichmentStatus)
 * - Legacy status strings
 * - Alternative/synonymous status values
 *
 * @param rawStatus - Raw status string from database or API
 * @returns Normalized EnrichmentPhase for consistent UI display
 */
export function normalizeEnrichmentStatus(rawStatus: string): EnrichmentPhase {
  const normalized = rawStatus.toLowerCase().replace(/[^a-z_]/g, '');
  return STATUS_ALIASES[normalized] ?? 'pending';
}

// ============================================================
// Status Labels
// ============================================================

const STATUS_LABELS: Record<EnrichmentPhase, string> = {
  pending: 'Pending',
  queued: 'Queued',
  processing: 'Processing',
  enriching: 'Enriching',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
  partial: 'Partial',
};

// ============================================================
// Enrichment Status Mapper
// ============================================================

/**
 * Map a raw enrichment status to a display object
 */
export function mapEnrichmentStatus(
  rawStatus: string,
  progress?: { current?: number; total?: number }
): EnrichmentStatusDisplay {
  const status = normalizeEnrichmentStatus(rawStatus);

  const isActive = status === 'processing' || status === 'enriching' || status === 'queued';
  const isComplete = status === 'completed';
  const isFailed = status === 'failed';

  // Calculate progress percentage
  let progressPercent: number | null = null;
  if (progress?.total && progress.total > 0) {
    progressPercent = Math.round((progress.current ?? 0) / progress.total * 100);
  } else if (isComplete) {
    progressPercent = 100;
  } else if (status === 'pending') {
    progressPercent = 0;
  }

  return {
    status,
    label: STATUS_LABELS[status],
    color: getEnrichmentStatusColor(status),
    isActive,
    isComplete,
    isFailed,
    progressPercent,
    canRetry: isFailed || status === 'partial',
    canCancel: isActive,
  };
}

// ============================================================
// Job Status Mapper
// ============================================================

const JOB_STATUS_LABELS: Record<string, string> = {
  created: 'Created',
  pending: 'Pending',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
  paused: 'Paused',
  retrying: 'Retrying',
};

const JOB_STATUS_PRIORITY: Record<string, number> = {
  running: 1,
  retrying: 2,
  pending: 3,
  paused: 4,
  created: 5,
  completed: 6,
  failed: 7,
  cancelled: 8,
};

/**
 * Map a job status to a display object
 */
export function mapJobStatus(rawStatus: string): JobStatusDisplay {
  const status = rawStatus.toLowerCase();
  const isTerminal = ['completed', 'failed', 'cancelled'].includes(status);

  return {
    status,
    label: JOB_STATUS_LABELS[status] ?? rawStatus,
    color: getJobStatusColor(status),
    isTerminal,
    priority: JOB_STATUS_PRIORITY[status] ?? 99,
  };
}

/**
 * Sort jobs by status priority (active jobs first)
 */
export function sortJobsByStatus<T extends { status: string }>(jobs: T[]): T[] {
  return [...jobs].sort((a, b) => {
    const priorityA = JOB_STATUS_PRIORITY[a.status.toLowerCase()] ?? 99;
    const priorityB = JOB_STATUS_PRIORITY[b.status.toLowerCase()] ?? 99;
    return priorityA - priorityB;
  });
}

// ============================================================
// Workflow Step Mapper
// ============================================================

const WORKFLOW_STEPS = [
  { step: 1, name: 'Upload' },
  { step: 2, name: 'Parse' },
  { step: 3, name: 'Map Columns' },
  { step: 4, name: 'Validate' },
  { step: 5, name: 'Enrich' },
  { step: 6, name: 'Analyze' },
  { step: 7, name: 'Complete' },
];

/**
 * Map workflow progress to step displays
 */
export function mapWorkflowSteps(
  currentStep: number,
  status: 'active' | 'failed' | 'completed' = 'active'
): WorkflowStepDisplay[] {
  return WORKFLOW_STEPS.map(({ step, name }) => {
    let stepStatus: WorkflowStepDisplay['status'];
    let color: string;

    if (step < currentStep) {
      stepStatus = 'completed';
      color = workflowStatusColors.completed;
    } else if (step === currentStep) {
      if (status === 'failed') {
        stepStatus = 'failed';
        color = workflowStatusColors.failed;
      } else if (status === 'completed') {
        stepStatus = 'completed';
        color = workflowStatusColors.completed;
      } else {
        stepStatus = 'active';
        color = workflowStatusColors.inprogress;
      }
    } else {
      stepStatus = 'pending';
      color = workflowStatusColors.pending;
    }

    return { step, name, status: stepStatus, color };
  });
}

// ============================================================
// Aggregate Status
// ============================================================

export interface EnrichmentAggregate {
  totalItems: number;
  enrichedCount: number;
  pendingCount: number;
  failedCount: number;
  progressPercent: number;
  overallStatus: EnrichmentPhase;
  color: string;
}

/**
 * Calculate aggregate enrichment status from item counts
 */
export function mapEnrichmentAggregate(
  total: number,
  enriched: number,
  failed: number
): EnrichmentAggregate {
  const pending = total - enriched - failed;
  const progressPercent = total > 0 ? Math.round((enriched / total) * 100) : 0;

  let overallStatus: EnrichmentPhase;
  if (total === 0) {
    overallStatus = 'pending';
  } else if (enriched === total) {
    overallStatus = 'completed';
  } else if (failed > 0 && enriched + failed === total) {
    overallStatus = 'partial';
  } else if (failed === total) {
    overallStatus = 'failed';
  } else if (pending > 0) {
    overallStatus = 'processing';
  } else {
    overallStatus = 'completed';
  }

  return {
    totalItems: total,
    enrichedCount: enriched,
    pendingCount: pending,
    failedCount: failed,
    progressPercent,
    overallStatus,
    color: getEnrichmentStatusColor(overallStatus),
  };
}

// ============================================================
// Batch Mappers
// ============================================================

/**
 * Map an array of items with status to display objects
 */
export function mapEnrichmentStatuses<T extends { status?: string; enrichment_status?: string }>(
  items: T[]
): Array<T & { statusDisplay: EnrichmentStatusDisplay }> {
  return items.map((item) => ({
    ...item,
    statusDisplay: mapEnrichmentStatus(item.status ?? item.enrichment_status ?? 'pending'),
  }));
}
