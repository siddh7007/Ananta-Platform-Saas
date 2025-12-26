/**
 * useProcessingQueue Hook
 *
 * Manages the processing queue for multiple BOMs in the organization.
 * Provides queue position tracking, estimated time, and batch processing status.
 *
 * Features:
 * - Lists all processing jobs for the organization
 * - Tracks queue position and estimated completion time
 * - Filters jobs by status (running, paused, completed, etc.)
 * - Auto-refreshes queue status at intervals
 *
 * @example
 * ```tsx
 * const {
 *   queue,
 *   isLoading,
 *   error,
 *   refetch,
 *   getJobPosition,
 *   runningJobs,
 *   pausedJobs,
 *   completedJobs,
 * } = useProcessingQueue({
 *   enabled: true,
 *   pollInterval: 5000,
 *   statusFilter: 'running',
 * });
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  listProcessingJobs,
  type ProcessingJobListItem,
  type ProcessingJobListResponse,
} from '@/services/bom.service';
import { apiLogger } from '@/lib/logger';

export interface UseProcessingQueueOptions {
  enabled?: boolean;
  pollInterval?: number; // milliseconds
  statusFilter?: 'running' | 'paused' | 'completed' | 'failed' | 'cancelled' | 'pending';
  onQueueUpdate?: (queue: ProcessingJobListResponse) => void;
  onError?: (error: string) => void;
}

export interface UseProcessingQueueReturn {
  queue: ProcessingJobListResponse | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  refetch: () => Promise<void>;
  setStatusFilter: (status?: string) => void;

  // Derived data
  totalJobs: number;
  runningJobs: ProcessingJobListItem[];
  pausedJobs: ProcessingJobListItem[];
  completedJobs: ProcessingJobListItem[];
  failedJobs: ProcessingJobListItem[];
  pendingJobs: ProcessingJobListItem[];

  // Queue metrics
  queueLength: number;
  avgProcessingTime: number; // seconds
  getJobPosition: (bomId: string) => number | null;
  getEstimatedWaitTime: (bomId: string) => number | null; // seconds
}

/**
 * Hook for managing BOM processing queue
 */
export function useProcessingQueue(
  options: UseProcessingQueueOptions = {}
): UseProcessingQueueReturn {
  const {
    enabled = true,
    pollInterval = 5000,
    statusFilter: initialStatusFilter,
    onQueueUpdate,
    onError,
  } = options;

  const [queue, setQueue] = useState<ProcessingJobListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilterState] = useState<string | undefined>(initialStatusFilter);

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, []);

  // Fetch queue status
  const fetchQueue = useCallback(async () => {
    if (!enabled) return;

    try {
      setIsLoading(true);
      setError(null);

      const queueData = await listProcessingJobs(statusFilter);

      if (!isMountedRef.current) return;

      setQueue(queueData);
      onQueueUpdate?.(queueData);

      apiLogger.debug(`[useProcessingQueue] Queue updated: ${queueData.total} jobs`);
    } catch (err) {
      if (!isMountedRef.current) return;

      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch processing queue';
      apiLogger.error(`[useProcessingQueue] Error fetching queue:`, errorMessage);
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [enabled, statusFilter, onQueueUpdate, onError]);

  // Start polling
  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Initial fetch
    fetchQueue();

    // Setup polling
    const startPolling = () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
      }

      pollTimerRef.current = setTimeout(() => {
        fetchQueue().then(() => {
          if (isMountedRef.current) {
            startPolling();
          }
        });
      }, pollInterval);
    };

    startPolling();

    return () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [enabled, pollInterval, fetchQueue]);

  // Manual refetch
  const refetch = useCallback(async () => {
    await fetchQueue();
  }, [fetchQueue]);

  // Set status filter
  const setStatusFilter = useCallback((status?: string) => {
    setStatusFilterState(status);
  }, []);

  // Derived data - categorize jobs by status
  const jobs = queue?.jobs ?? [];
  const runningJobs = jobs.filter((job) => job.status === 'running');
  const pausedJobs = jobs.filter((job) => job.status === 'paused');
  const completedJobs = jobs.filter((job) => job.status === 'completed');
  const failedJobs = jobs.filter((job) => job.status === 'failed');
  const pendingJobs = jobs.filter((job) => job.status === 'pending');

  // Queue metrics
  const totalJobs = queue?.total ?? 0;
  const queueLength = runningJobs.length + pendingJobs.length;

  // Calculate average processing time from completed jobs
  const avgProcessingTime = (() => {
    if (completedJobs.length === 0) return 0;

    const completedWithTimes = completedJobs.filter(
      (job) => job.startedAt && job.updatedAt
    );

    if (completedWithTimes.length === 0) return 0;

    const totalTime = completedWithTimes.reduce((sum, job) => {
      const start = new Date(job.startedAt!).getTime();
      const end = new Date(job.updatedAt!).getTime();
      return sum + (end - start);
    }, 0);

    return totalTime / completedWithTimes.length / 1000; // Convert to seconds
  })();

  // Get queue position for a specific BOM (1-indexed)
  const getJobPosition = useCallback(
    (bomId: string): number | null => {
      if (!queue) return null;

      // Position is based on pending/running jobs, ordered by start time
      const activeJobs = [...pendingJobs, ...runningJobs].sort((a, b) => {
        const aTime = a.startedAt ? new Date(a.startedAt).getTime() : Date.now();
        const bTime = b.startedAt ? new Date(b.startedAt).getTime() : Date.now();
        return aTime - bTime;
      });

      const index = activeJobs.findIndex((job) => job.bomId === bomId);
      return index === -1 ? null : index + 1; // 1-indexed position
    },
    [queue, pendingJobs, runningJobs]
  );

  // Estimate wait time for a specific BOM
  const getEstimatedWaitTime = useCallback(
    (bomId: string): number | null => {
      if (!queue || avgProcessingTime === 0) return null;

      const position = getJobPosition(bomId);
      if (position === null || position <= 0) return null;

      // If job is running, estimate based on progress
      const job = jobs.find((j) => j.bomId === bomId);
      if (job && job.status === 'running') {
        const remainingPercent = 100 - job.overallProgress;
        return (remainingPercent / 100) * avgProcessingTime;
      }

      // If job is pending, estimate based on queue position
      // Assume jobs ahead will take avgProcessingTime each
      return (position - 1) * avgProcessingTime;
    },
    [queue, avgProcessingTime, getJobPosition, jobs]
  );

  return {
    queue,
    isLoading,
    error,

    // Actions
    refetch,
    setStatusFilter,

    // Derived data
    totalJobs,
    runningJobs,
    pausedJobs,
    completedJobs,
    failedJobs,
    pendingJobs,

    // Queue metrics
    queueLength,
    avgProcessingTime,
    getJobPosition,
    getEstimatedWaitTime,
  };
}

export default useProcessingQueue;
