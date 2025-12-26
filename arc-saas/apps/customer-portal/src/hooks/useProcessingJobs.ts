/**
 * useProcessingJobs Hook
 *
 * Fetches and manages BOM processing jobs with workflow controls.
 *
 * Features:
 * - Fetch all processing jobs from workflow API
 * - Filter jobs by status (pending, running, paused, completed, failed, cancelled)
 * - Workflow controls: pause, resume, cancel, restart
 * - Auto-refresh when active jobs exist (every 5 seconds)
 * - Computed properties for UI rendering (canPause, canResume, etc.)
 * - Error handling with retry support
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { cnsApi } from '@/lib/axios';
import { useOrganizationId } from '@/contexts/TenantContext';
import { createLogger } from '@/lib/logger';

const logger = createLogger('useProcessingJobs');

// ============================================
// Type Definitions
// ============================================

/**
 * Processing job status values
 */
export type JobStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

/**
 * API Response: Processing job from workflow API
 */
export interface ProcessingJobAPI {
  bom_id: string;
  bom_name: string | null;
  workflow_id: string;
  status: JobStatus;
  current_stage: string;
  overall_progress: number;
  total_items: number;
  enriched_items: number;
  failed_items: number;
  health_grade: string | null;
  started_at: string | null;
  updated_at: string | null;
}

/**
 * Processed job data with computed properties for UI
 */
export interface ProcessingJob {
  bomId: string;
  bomName: string | null;
  workflowId: string;
  status: JobStatus;
  currentStage: string;
  overallProgress: number;
  totalItems: number;
  enrichedItems: number;
  failedItems: number;
  healthGrade: string | null;
  startedAt: string | null;
  updatedAt: string | null;
  canPause: boolean;
  canResume: boolean;
  canCancel: boolean;
  canRestart: boolean;
}

/**
 * Hook options
 */
export interface UseProcessingJobsOptions {
  /**
   * Enable/disable the hook
   * @default true
   */
  enabled?: boolean;

  /**
   * Auto-refresh interval in milliseconds when active jobs exist
   * @default 5000 (5 seconds)
   */
  autoRefreshInterval?: number;

  /**
   * Filter jobs by status
   */
  statusFilter?: JobStatus | JobStatus[];

  /**
   * Callback when job completes
   */
  onJobComplete?: (job: ProcessingJob) => void;

  /**
   * Callback when job fails
   */
  onJobFail?: (job: ProcessingJob) => void;

  /**
   * Callback on error
   */
  onError?: (error: Error) => void;
}

/**
 * Hook return value
 */
export interface UseProcessingJobsResult {
  /**
   * List of processing jobs
   */
  jobs: ProcessingJob[];

  /**
   * Loading state
   */
  isLoading: boolean;

  /**
   * Error state
   */
  error: Error | null;

  /**
   * Manual refresh function
   */
  refresh: () => Promise<void>;

  /**
   * Pause a job by BOM ID
   */
  pauseJob: (bomId: string) => Promise<void>;

  /**
   * Resume a paused job
   */
  resumeJob: (bomId: string) => Promise<void>;

  /**
   * Cancel a job
   */
  cancelJob: (bomId: string) => Promise<void>;

  /**
   * Restart a failed/cancelled job
   */
  restartJob: (bomId: string) => Promise<void>;

  /**
   * Number of active jobs (running or paused)
   */
  activeJobsCount: number;

  /**
   * Whether there are any active jobs
   */
  hasActiveJobs: boolean;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Convert snake_case API response to camelCase UI model
 */
function mapJobAPIToJob(apiJob: ProcessingJobAPI): ProcessingJob {
  const { status } = apiJob;

  // Determine which workflow controls are available
  const canPause = status === 'running';
  const canResume = status === 'paused';
  const canCancel = status === 'pending' || status === 'running' || status === 'paused';
  const canRestart = status === 'failed' || status === 'cancelled';

  return {
    bomId: apiJob.bom_id,
    bomName: apiJob.bom_name,
    workflowId: apiJob.workflow_id,
    status: apiJob.status,
    currentStage: apiJob.current_stage,
    overallProgress: apiJob.overall_progress,
    totalItems: apiJob.total_items,
    enrichedItems: apiJob.enriched_items,
    failedItems: apiJob.failed_items,
    healthGrade: apiJob.health_grade,
    startedAt: apiJob.started_at,
    updatedAt: apiJob.updated_at,
    canPause,
    canResume,
    canCancel,
    canRestart,
  };
}

/**
 * Filter jobs by status
 */
function filterJobsByStatus(
  jobs: ProcessingJob[],
  statusFilter?: JobStatus | JobStatus[]
): ProcessingJob[] {
  if (!statusFilter) {
    return jobs;
  }

  const statuses = Array.isArray(statusFilter) ? statusFilter : [statusFilter];
  return jobs.filter((job) => statuses.includes(job.status));
}

/**
 * Check if a job is active (running or paused)
 */
function isJobActive(job: ProcessingJob): boolean {
  return job.status === 'running' || job.status === 'paused';
}

// ============================================
// Main Hook
// ============================================

/**
 * Hook to fetch and manage BOM processing jobs
 *
 * @example
 * ```tsx
 * const {
 *   jobs,
 *   isLoading,
 *   error,
 *   pauseJob,
 *   resumeJob,
 *   cancelJob,
 *   activeJobsCount,
 * } = useProcessingJobs({
 *   statusFilter: ['running', 'paused'],
 *   onJobComplete: (job) => console.log('Job completed:', job.bomName),
 * });
 * ```
 */
export function useProcessingJobs(
  options: UseProcessingJobsOptions = {}
): UseProcessingJobsResult {
  const {
    enabled = true,
    autoRefreshInterval = 5000,
    statusFilter,
    onJobComplete,
    onJobFail,
    onError,
  } = options;

  // CRITICAL: Get organization_id for CNS API calls (tenant_id = organization_id in our architecture)
  const organizationId = useOrganizationId();

  // State
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Refs
  const mountedRef = useRef(true);
  const autoRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const previousJobsRef = useRef<ProcessingJob[]>([]);

  /**
   * Fetch jobs from API
   */
  const fetchJobs = useCallback(async () => {
    if (!enabled) return;

    // Ensure organization_id is available
    if (!organizationId) {
      const errorObj = new Error('No organization selected. Please select a workspace.');
      setError(errorObj);
      setIsLoading(false);
      onError?.(errorObj);
      return;
    }

    try {
      logger.debug('Fetching processing jobs...');

      // CRITICAL: Pass organization_id as query parameter (CNS API requirement)
      const response = await cnsApi.get<{ jobs: ProcessingJobAPI[] }>('/bom/workflow/jobs', {
        params: { organization_id: organizationId },
      });

      if (!mountedRef.current) return;

      const apiJobs = response.data.jobs || [];
      const mappedJobs = apiJobs.map(mapJobAPIToJob);
      const filteredJobs = filterJobsByStatus(mappedJobs, statusFilter);

      // Check for job state transitions (completed/failed)
      if (previousJobsRef.current.length > 0) {
        filteredJobs.forEach((job) => {
          const previousJob = previousJobsRef.current.find((j) => j.bomId === job.bomId);

          // Detect completion
          if (previousJob && previousJob.status !== 'completed' && job.status === 'completed') {
            logger.info(`Job completed: ${job.bomName || job.bomId}`);
            onJobComplete?.(job);
          }

          // Detect failure
          if (previousJob && previousJob.status !== 'failed' && job.status === 'failed') {
            logger.warn(`Job failed: ${job.bomName || job.bomId}`);
            onJobFail?.(job);
          }
        });
      }

      previousJobsRef.current = filteredJobs;
      setJobs(filteredJobs);
      setError(null);
      setIsLoading(false);

      logger.debug(`Fetched ${filteredJobs.length} jobs`);
    } catch (err) {
      if (!mountedRef.current) return;

      const errorObj = err instanceof Error ? err : new Error('Failed to fetch jobs');
      logger.error('Failed to fetch processing jobs', errorObj);

      setError(errorObj);
      setIsLoading(false);
      onError?.(errorObj);
    }
  }, [enabled, organizationId, statusFilter, onJobComplete, onJobFail, onError]);

  /**
   * Manual refresh function
   */
  const refresh = useCallback(async () => {
    await fetchJobs();
  }, [fetchJobs]);

  /**
   * Pause a job
   */
  const pauseJob = useCallback(
    async (bomId: string) => {
      if (!organizationId) {
        throw new Error('No organization selected');
      }

      try {
        logger.info(`Pausing job: ${bomId}`);
        // CRITICAL: Pass organization_id as query parameter
        await cnsApi.post(`/bom/workflow/${bomId}/pause`, null, {
          params: { organization_id: organizationId },
        });
        await fetchJobs(); // Refresh to get updated status
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error('Failed to pause job');
        logger.error(`Failed to pause job ${bomId}`, errorObj);
        onError?.(errorObj);
        throw errorObj;
      }
    },
    [organizationId, fetchJobs, onError]
  );

  /**
   * Resume a paused job
   */
  const resumeJob = useCallback(
    async (bomId: string) => {
      if (!organizationId) {
        throw new Error('No organization selected');
      }

      try {
        logger.info(`Resuming job: ${bomId}`);
        // CRITICAL: Pass organization_id as query parameter
        await cnsApi.post(`/bom/workflow/${bomId}/resume`, null, {
          params: { organization_id: organizationId },
        });
        await fetchJobs(); // Refresh to get updated status
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error('Failed to resume job');
        logger.error(`Failed to resume job ${bomId}`, errorObj);
        onError?.(errorObj);
        throw errorObj;
      }
    },
    [organizationId, fetchJobs, onError]
  );

  /**
   * Cancel a job
   */
  const cancelJob = useCallback(
    async (bomId: string) => {
      if (!organizationId) {
        throw new Error('No organization selected');
      }

      try {
        logger.info(`Cancelling job: ${bomId}`);
        // CRITICAL: Pass organization_id as query parameter
        await cnsApi.post(`/bom/workflow/${bomId}/cancel`, null, {
          params: { organization_id: organizationId },
        });
        await fetchJobs(); // Refresh to get updated status
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error('Failed to cancel job');
        logger.error(`Failed to cancel job ${bomId}`, errorObj);
        onError?.(errorObj);
        throw errorObj;
      }
    },
    [organizationId, fetchJobs, onError]
  );

  /**
   * Restart a failed/cancelled job
   */
  const restartJob = useCallback(
    async (bomId: string) => {
      if (!organizationId) {
        throw new Error('No organization selected');
      }

      try {
        logger.info(`Restarting job: ${bomId}`);
        // CRITICAL: Pass organization_id as query parameter
        await cnsApi.post(`/bom/workflow/${bomId}/restart`, null, {
          params: { organization_id: organizationId },
        });
        await fetchJobs(); // Refresh to get updated status
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error('Failed to restart job');
        logger.error(`Failed to restart job ${bomId}`, errorObj);
        onError?.(errorObj);
        throw errorObj;
      }
    },
    [organizationId, fetchJobs, onError]
  );

  /**
   * Setup auto-refresh when active jobs exist
   */
  useEffect(() => {
    const hasActive = jobs.some(isJobActive);

    // Clear existing timer
    if (autoRefreshTimerRef.current) {
      clearInterval(autoRefreshTimerRef.current);
      autoRefreshTimerRef.current = null;
    }

    // Start auto-refresh if there are active jobs
    if (hasActive && enabled) {
      logger.debug(`Starting auto-refresh (${autoRefreshInterval}ms) - ${jobs.filter(isJobActive).length} active jobs`);

      autoRefreshTimerRef.current = setInterval(() => {
        if (mountedRef.current) {
          fetchJobs();
        }
      }, autoRefreshInterval);
    }

    return () => {
      if (autoRefreshTimerRef.current) {
        clearInterval(autoRefreshTimerRef.current);
        autoRefreshTimerRef.current = null;
      }
    };
  }, [jobs, enabled, autoRefreshInterval, fetchJobs]);

  /**
   * Initial fetch on mount
   */
  useEffect(() => {
    mountedRef.current = true;

    if (enabled) {
      fetchJobs();
    }

    return () => {
      mountedRef.current = false;
    };
  }, [enabled, fetchJobs]);

  // Compute derived values
  const activeJobsCount = jobs.filter(isJobActive).length;
  const hasActiveJobs = activeJobsCount > 0;

  return {
    jobs,
    isLoading,
    error,
    refresh,
    pauseJob,
    resumeJob,
    cancelJob,
    restartJob,
    activeJobsCount,
    hasActiveJobs,
  };
}

export default useProcessingJobs;
