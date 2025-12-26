/**
 * useBomUploadStatus Hook
 *
 * Unified hook that combines upload, enrichment, and analysis status tracking.
 * Provides overall progress percentage and handles all phases of BOM processing.
 *
 * Processing Phases:
 * 1. Upload (0-10%) - File upload to server
 * 2. Parsing (10-20%) - File parsing and validation
 * 3. Enrichment (20-80%) - Component enrichment via Temporal workflow
 * 4. Risk Analysis (80-95%) - Risk scoring and health grade
 * 5. Complete (95-100%) - Finalization and notifications
 *
 * Features:
 * - Unified progress tracking across all phases
 * - Real-time SSE updates during enrichment
 * - Workflow control operations (pause/resume/cancel)
 * - Error handling and retry logic
 * - Stage-specific status and messages
 *
 * @example
 * ```tsx
 * const {
 *   overallProgress,
 *   currentPhase,
 *   status,
 *   processingStatus,
 *   enrichmentProgress,
 *   workflowStatus,
 *   isComplete,
 *   error,
 *   pause,
 *   resume,
 *   cancel,
 *   retry,
 * } = useBomUploadStatus(bomId, {
 *   enableSSE: true,
 *   enableWorkflowPolling: true,
 *   onComplete: () => console.log('BOM processing complete'),
 * });
 * ```
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useEnrichmentSSE } from './useEnrichmentSSE';
import { useWorkflowStatus } from './useWorkflowStatus';
import {
  getProcessingStatus,
  type ProcessingStatusResponse,
  type ProcessingStageInfo,
} from '@/services/bom.service';
import { apiLogger } from '@/lib/logger';

export type BomProcessingPhase =
  | 'upload'
  | 'parsing'
  | 'enrichment'
  | 'risk_analysis'
  | 'complete'
  | 'idle';

export interface UseBomUploadStatusOptions {
  enableSSE?: boolean; // Enable SSE for enrichment progress
  enableWorkflowPolling?: boolean; // Enable Temporal workflow polling
  pollInterval?: number; // Workflow poll interval (ms)
  onComplete?: () => void;
  onError?: (error: string) => void;
  onPhaseChange?: (phase: BomProcessingPhase) => void;
}

export interface UseBomUploadStatusReturn {
  // Overall status
  overallProgress: number; // 0-100
  currentPhase: BomProcessingPhase;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  isComplete: boolean;
  error: string | null;

  // Detailed status
  processingStatus: ProcessingStatusResponse | null;
  enrichmentProgress: ReturnType<typeof useEnrichmentSSE>['progress'];
  workflowStatus: ReturnType<typeof useWorkflowStatus>['workflowStatus'];

  // Stage information
  stages: Record<string, ProcessingStageInfo> | null;
  currentStage: string;

  // Control operations
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  cancel: () => Promise<void>;
  retry: () => void;
  refetch: () => Promise<void>;

  // State flags
  isLoading: boolean;
  isPaused: boolean;
  canPause: boolean;
  canResume: boolean;
  canCancel: boolean;

  // Metrics
  totalItems: number;
  enrichedItems: number;
  failedItems: number;
  riskScoredItems: number;
  healthGrade: string | null;
}

/**
 * Hook for unified BOM upload and processing status tracking
 */
export function useBomUploadStatus(
  bomId: string | null | undefined,
  options: UseBomUploadStatusOptions = {}
): UseBomUploadStatusReturn {
  const {
    enableSSE = true,
    enableWorkflowPolling = true,
    pollInterval = 2000,
    onComplete,
    onError,
    onPhaseChange,
  } = options;

  const [processingStatus, setProcessingStatus] = useState<ProcessingStatusResponse | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [currentPhase, setCurrentPhase] = useState<BomProcessingPhase>('idle');

  // SSE for real-time enrichment updates
  const {
    progress: enrichmentProgress,
    progressPercent: enrichmentPercent,
    isComplete: enrichmentComplete,
    error: sseError,
    connectionStatus,
    retry: retrySSE,
  } = useEnrichmentSSE(bomId ?? '', {
    autoConnect: enableSSE && !!bomId,
    onComplete: () => {
      apiLogger.info(`[useBomUploadStatus] Enrichment complete for BOM ${bomId}`);
      fetchProcessingStatus();
    },
    onError: (err) => {
      apiLogger.error(`[useBomUploadStatus] SSE error:`, err);
      onError?.(err);
    },
  });

  // Temporal workflow status polling
  const {
    workflowStatus,
    isLoading: isWorkflowLoading,
    error: workflowError,
    pause: pauseWorkflow,
    resume: resumeWorkflow,
    cancel: cancelWorkflow,
    canPause: canPauseWorkflow,
    canResume: canResumeWorkflow,
    canCancel: canCancelWorkflow,
    refetch: refetchWorkflow,
  } = useWorkflowStatus(bomId, {
    enabled: enableWorkflowPolling && !!bomId,
    pollInterval,
    onComplete: () => {
      apiLogger.info(`[useBomUploadStatus] Workflow complete for BOM ${bomId}`);
      fetchProcessingStatus();
      onComplete?.();
    },
    onError: (err) => {
      apiLogger.error(`[useBomUploadStatus] Workflow error:`, err);
      onError?.(err);
    },
  });

  // Fetch detailed processing status
  const fetchProcessingStatus = useCallback(async () => {
    if (!bomId) return;

    try {
      setIsLoadingStatus(true);
      setStatusError(null);

      const status = await getProcessingStatus(bomId);
      setProcessingStatus(status);

      // Trigger completion if processing is complete
      if (status.status === 'completed') {
        onComplete?.();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch processing status';
      apiLogger.error(`[useBomUploadStatus] Error fetching status:`, errorMessage);
      setStatusError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsLoadingStatus(false);
    }
  }, [bomId, onComplete, onError]);

  // Initial fetch and periodic refresh
  useEffect(() => {
    if (!bomId) return;

    fetchProcessingStatus();

    // Refresh status every 5 seconds if not using SSE
    if (!enableSSE) {
      const interval = setInterval(fetchProcessingStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [bomId, enableSSE, fetchProcessingStatus]);

  // Determine current phase from processing status
  useEffect(() => {
    if (!processingStatus) {
      setCurrentPhase('idle');
      return;
    }

    const stage = processingStatus.currentStage;
    let phase: BomProcessingPhase = 'idle';

    if (stage === 'raw_upload') {
      phase = 'upload';
    } else if (stage === 'parsing') {
      phase = 'parsing';
    } else if (stage === 'enrichment') {
      phase = 'enrichment';
    } else if (stage === 'risk_analysis') {
      phase = 'risk_analysis';
    } else if (stage === 'complete') {
      phase = 'complete';
    }

    if (phase !== currentPhase) {
      setCurrentPhase(phase);
      onPhaseChange?.(phase);
    }
  }, [processingStatus, currentPhase, onPhaseChange]);

  // Calculate overall progress (0-100)
  const overallProgress = useMemo(() => {
    if (!processingStatus) return 0;

    const stages = processingStatus.stages;
    if (!stages) return 0;

    // Weight each stage
    const weights = {
      raw_upload: 10,
      parsing: 10,
      enrichment: 60,
      risk_analysis: 15,
      complete: 5,
    };

    let totalProgress = 0;
    Object.entries(weights).forEach(([stageName, weight]) => {
      const stage = stages[stageName];
      if (stage) {
        const stageProgress = stage.progress || 0;
        totalProgress += (stageProgress * weight) / 100;
      }
    });

    return Math.min(100, Math.max(0, totalProgress));
  }, [processingStatus]);

  // Determine overall status
  const status = processingStatus?.status ?? 'pending';
  const isComplete = status === 'completed';
  const isPaused = status === 'paused';

  // Combine errors
  const error = statusError || workflowError || sseError;

  // Control operations
  const pause = useCallback(async () => {
    await pauseWorkflow();
    await fetchProcessingStatus();
  }, [pauseWorkflow, fetchProcessingStatus]);

  const resume = useCallback(async () => {
    await resumeWorkflow();
    await fetchProcessingStatus();
  }, [resumeWorkflow, fetchProcessingStatus]);

  const cancel = useCallback(async () => {
    await cancelWorkflow();
    await fetchProcessingStatus();
  }, [cancelWorkflow, fetchProcessingStatus]);

  const retry = useCallback(() => {
    // Retry SSE connection if failed
    if (connectionStatus === 'error' || connectionStatus === 'disconnected') {
      retrySSE();
    }
    // Refetch status
    fetchProcessingStatus();
  }, [connectionStatus, retrySSE, fetchProcessingStatus]);

  const refetch = useCallback(async () => {
    await Promise.all([fetchProcessingStatus(), refetchWorkflow()]);
  }, [fetchProcessingStatus, refetchWorkflow]);

  // Control availability
  const canPause = canPauseWorkflow && status === 'running';
  const canResume = canResumeWorkflow && status === 'paused';
  const canCancel = canCancelWorkflow && ['running', 'paused', 'pending'].includes(status);

  // Metrics
  const totalItems = processingStatus?.totalItems ?? 0;
  const enrichedItems = processingStatus?.enrichedItems ?? 0;
  const failedItems = processingStatus?.failedItems ?? 0;
  const riskScoredItems = processingStatus?.riskScoredItems ?? 0;
  const healthGrade = processingStatus?.healthGrade ?? null;

  return {
    // Overall status
    overallProgress,
    currentPhase,
    status,
    isComplete,
    error,

    // Detailed status
    processingStatus,
    enrichmentProgress,
    workflowStatus,

    // Stage information
    stages: processingStatus?.stages ?? null,
    currentStage: processingStatus?.currentStage ?? 'raw_upload',

    // Control operations
    pause,
    resume,
    cancel,
    retry,
    refetch,

    // State flags
    isLoading: isLoadingStatus || isWorkflowLoading,
    isPaused,
    canPause,
    canResume,
    canCancel,

    // Metrics
    totalItems,
    enrichedItems,
    failedItems,
    riskScoredItems,
    healthGrade,
  };
}

export default useBomUploadStatus;
