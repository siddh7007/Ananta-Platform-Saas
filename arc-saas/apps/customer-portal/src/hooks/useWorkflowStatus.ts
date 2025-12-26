/**
 * useWorkflowStatus Hook
 *
 * Manages Temporal workflow status and control operations for BOM processing.
 * Provides real-time workflow state and control actions (pause, resume, cancel).
 *
 * Features:
 * - Polls workflow status at regular intervals
 * - Provides workflow control operations (pause/resume/cancel)
 * - Handles error states and retries
 * - Auto-stops polling when workflow is complete
 *
 * @example
 * ```tsx
 * const {
 *   workflowStatus,
 *   isLoading,
 *   error,
 *   pause,
 *   resume,
 *   cancel,
 *   canPause,
 *   canResume,
 *   canCancel,
 * } = useWorkflowStatus(bomId, {
 *   enabled: true,
 *   pollInterval: 2000,
 *   onStatusChange: (status) => console.log('Status changed:', status),
 * });
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getWorkflowStatus,
  pauseWorkflow,
  resumeWorkflow,
  cancelWorkflow,
  type WorkflowStatusResponse,
} from '@/services/bom.service';
import { apiLogger } from '@/lib/logger';

export interface UseWorkflowStatusOptions {
  enabled?: boolean;
  pollInterval?: number; // milliseconds
  onStatusChange?: (status: WorkflowStatusResponse) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

export interface UseWorkflowStatusReturn {
  workflowStatus: WorkflowStatusResponse | null;
  isLoading: boolean;
  error: string | null;

  // Control operations
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  cancel: () => Promise<void>;
  refetch: () => Promise<void>;

  // State flags
  isPending: boolean;
  isRunning: boolean;
  isPaused: boolean;
  isCompleted: boolean;
  isFailed: boolean;
  isCancelled: boolean;

  // Control availability
  canPause: boolean;
  canResume: boolean;
  canCancel: boolean;

  // Progress
  progressPercent: number;
}

/**
 * Hook for managing Temporal workflow status and control
 */
export function useWorkflowStatus(
  bomId: string | null | undefined,
  options: UseWorkflowStatusOptions = {}
): UseWorkflowStatusReturn {
  const {
    enabled = true,
    pollInterval = 2000,
    onStatusChange,
    onComplete,
    onError,
  } = options;

  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPerformingAction, setIsPerformingAction] = useState(false);

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

  // Fetch workflow status
  const fetchStatus = useCallback(async () => {
    if (!bomId || !enabled) return;

    try {
      setIsLoading(true);
      setError(null);

      const status = await getWorkflowStatus(bomId);

      if (!isMountedRef.current) return;

      setWorkflowStatus(status);
      onStatusChange?.(status);

      // Check if workflow is complete
      if (status.status === 'completed') {
        apiLogger.info(`[useWorkflowStatus] Workflow completed for BOM ${bomId}`);
        onComplete?.();
        // Stop polling when complete
        if (pollTimerRef.current) {
          clearTimeout(pollTimerRef.current);
          pollTimerRef.current = null;
        }
      } else if (status.status === 'failed' || status.status === 'cancelled') {
        apiLogger.warn(`[useWorkflowStatus] Workflow ${status.status} for BOM ${bomId}`);
        // Stop polling on terminal states
        if (pollTimerRef.current) {
          clearTimeout(pollTimerRef.current);
          pollTimerRef.current = null;
        }
      }
    } catch (err) {
      if (!isMountedRef.current) return;

      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch workflow status';
      apiLogger.error(`[useWorkflowStatus] Error fetching status for BOM ${bomId}:`, errorMessage);
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [bomId, enabled, onStatusChange, onComplete, onError]);

  // Start polling
  useEffect(() => {
    if (!bomId || !enabled) {
      return;
    }

    // Initial fetch
    fetchStatus();

    // Setup polling
    const startPolling = () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
      }

      pollTimerRef.current = setTimeout(() => {
        fetchStatus().then(() => {
          // Continue polling if not in terminal state
          if (
            isMountedRef.current &&
            workflowStatus &&
            !['completed', 'failed', 'cancelled'].includes(workflowStatus.status)
          ) {
            startPolling();
          }
        });
      }, pollInterval);
    };

    // Start polling after initial fetch
    if (workflowStatus && !['completed', 'failed', 'cancelled'].includes(workflowStatus.status)) {
      startPolling();
    }

    return () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [bomId, enabled, pollInterval, fetchStatus, workflowStatus]);

  // Pause workflow
  const pause = useCallback(async () => {
    if (!bomId || isPerformingAction) return;

    try {
      setIsPerformingAction(true);
      apiLogger.info(`[useWorkflowStatus] Pausing workflow for BOM ${bomId}`);

      await pauseWorkflow(bomId);

      // Refetch status immediately
      await fetchStatus();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to pause workflow';
      apiLogger.error(`[useWorkflowStatus] Error pausing workflow:`, errorMessage);
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsPerformingAction(false);
    }
  }, [bomId, isPerformingAction, fetchStatus, onError]);

  // Resume workflow
  const resume = useCallback(async () => {
    if (!bomId || isPerformingAction) return;

    try {
      setIsPerformingAction(true);
      apiLogger.info(`[useWorkflowStatus] Resuming workflow for BOM ${bomId}`);

      await resumeWorkflow(bomId);

      // Refetch status immediately
      await fetchStatus();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to resume workflow';
      apiLogger.error(`[useWorkflowStatus] Error resuming workflow:`, errorMessage);
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsPerformingAction(false);
    }
  }, [bomId, isPerformingAction, fetchStatus, onError]);

  // Cancel workflow
  const cancel = useCallback(async () => {
    if (!bomId || isPerformingAction) return;

    try {
      setIsPerformingAction(true);
      apiLogger.info(`[useWorkflowStatus] Cancelling workflow for BOM ${bomId}`);

      await cancelWorkflow(bomId);

      // Refetch status immediately
      await fetchStatus();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to cancel workflow';
      apiLogger.error(`[useWorkflowStatus] Error cancelling workflow:`, errorMessage);
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsPerformingAction(false);
    }
  }, [bomId, isPerformingAction, fetchStatus, onError]);

  // Manual refetch
  const refetch = useCallback(async () => {
    await fetchStatus();
  }, [fetchStatus]);

  // Derive state flags
  const isPending = workflowStatus?.status === 'pending';
  const isRunning = workflowStatus?.status === 'running';
  const isPaused = workflowStatus?.status === 'paused';
  const isCompleted = workflowStatus?.status === 'completed';
  const isFailed = workflowStatus?.status === 'failed';
  const isCancelled = workflowStatus?.status === 'cancelled';

  // Determine control availability
  const canPause = isRunning && !isPerformingAction;
  const canResume = isPaused && !isPerformingAction;
  const canCancel = (isRunning || isPaused || isPending) && !isPerformingAction;

  // Calculate progress percentage
  const progressPercent = workflowStatus?.progress?.percentComplete ?? 0;

  return {
    workflowStatus,
    isLoading,
    error,

    // Control operations
    pause,
    resume,
    cancel,
    refetch,

    // State flags
    isPending,
    isRunning,
    isPaused,
    isCompleted,
    isFailed,
    isCancelled,

    // Control availability
    canPause,
    canResume,
    canCancel,

    // Progress
    progressPercent,
  };
}

export default useWorkflowStatus;
