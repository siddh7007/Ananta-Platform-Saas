/**
 * Enrichment Progress Hook
 * CBP-P2-007: Real-time enrichment progress tracking via polling
 *
 * NOTE: WebSocket/SSE approaches have been replaced with polling due to
 * browser limitations with authentication headers. Polling provides
 * reliable progress updates with a 2-second interval.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { cnsApi } from '@/lib/axios';
import { useOrganizationId } from '@/contexts/TenantContext';

// Type definitions for enrichment progress
export interface EnrichmentProgress {
  bomId: string;
  totalItems: number;
  processedItems: number;
  enrichedItems: number;
  failedItems: number;
  pendingItems: number;
  status: 'pending' | 'enriching' | 'enriched' | 'failed' | 'completed';
  currentStage?: string;
  message?: string;
}

export interface EnrichmentComplete {
  bomId: string;
  totalItems: number;
  enrichedItems: number;
  failedItems: number;
  healthGrade?: string;
  averageRiskScore?: number;
}

export interface EnrichmentError {
  bomId: string;
  message: string;
  code?: string;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface UseEnrichmentProgressOptions {
  autoConnect?: boolean;
  pollInterval?: number; // Polling interval in ms (default: 2000)
  onComplete?: (data: EnrichmentComplete) => void;
  onError?: (error: EnrichmentError) => void;
}

interface UseEnrichmentProgressReturn {
  progress: EnrichmentProgress | null;
  progressPercent: number;
  isComplete: boolean;
  error: string | null;
  isProcessing: boolean;
  connectionStatus: ConnectionStatus;
  retry: () => void;
}

// API response type for BOM status
interface BomStatusResponse {
  id: string;
  status: string;
  enrichment_status: string;
  enrichment_progress?: {
    total?: number;
    pending?: number;
    matched?: number;
    enriched?: number;
    error?: number;
    failed?: number;
  };
  total_items?: number;
  enriched_items?: number;
  failed_items?: number;
  health_grade?: string;
  average_risk_score?: number;
}

export function useEnrichmentProgress(
  bomId: string,
  options: UseEnrichmentProgressOptions = {}
): UseEnrichmentProgressReturn {
  const { autoConnect = true, pollInterval = 2000, onComplete, onError } = options;
  const organizationId = useOrganizationId();

  const [progress, setProgress] = useState<EnrichmentProgress | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');

  // Refs for cleanup
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Stable refs for callbacks
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
  }, [onComplete, onError]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  // Fetch BOM status from API
  const fetchStatus = useCallback(async (signal?: AbortSignal) => {
    if (!bomId || !organizationId) return;

    try {
      // Fetch BOM details including enrichment progress
      const response = await cnsApi.get<BomStatusResponse>(`/boms/${bomId}`, {
        params: { organization_id: organizationId },
        signal,
      });

      if (signal?.aborted || !mountedRef.current) return;

      const data = response.data;
      const enrichmentProgress = data.enrichment_progress || {};

      // Map API response to progress state
      const total = enrichmentProgress.total || data.total_items || 0;
      const enriched = (enrichmentProgress.matched || 0) + (enrichmentProgress.enriched || 0);
      const failed = enrichmentProgress.error || enrichmentProgress.failed || data.failed_items || 0;
      const pending = enrichmentProgress.pending || (total - enriched - failed);

      const newProgress: EnrichmentProgress = {
        bomId,
        totalItems: total,
        processedItems: enriched + failed,
        enrichedItems: enriched,
        failedItems: failed,
        pendingItems: pending,
        status: data.enrichment_status as EnrichmentProgress['status'] || 'pending',
        currentStage: data.status,
        message: undefined,
      };

      setProgress(newProgress);
      setError(null);
      setConnectionStatus('connected');

      // Check for completion
      const terminalStates = ['enriched', 'completed', 'failed'];
      if (terminalStates.includes(data.enrichment_status || '')) {
        setIsComplete(true);
        stopPolling();
        setConnectionStatus('disconnected');

        if (data.enrichment_status === 'enriched' || data.enrichment_status === 'completed') {
          onCompleteRef.current?.({
            bomId,
            totalItems: total,
            enrichedItems: enriched,
            failedItems: failed,
            healthGrade: data.health_grade,
            averageRiskScore: data.average_risk_score,
          });
        } else if (data.enrichment_status === 'failed') {
          onErrorRef.current?.({
            bomId,
            message: 'Enrichment failed',
          });
        }
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      if ((err as { code?: string })?.code === 'ERR_CANCELED') return;

      if (mountedRef.current) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch status';
        setError(errorMessage);
        setConnectionStatus('error');
        onErrorRef.current?.({
          bomId,
          message: errorMessage,
        });
      }
    }
  }, [bomId, organizationId, stopPolling]);

  // Start polling
  const startPolling = useCallback(() => {
    // Clear any existing interval
    stopPolling();

    // Fetch immediately
    const controller = new AbortController();
    abortControllerRef.current = controller;
    fetchStatus(controller.signal);

    // Then poll at interval
    pollIntervalRef.current = setInterval(() => {
      if (mountedRef.current && !isComplete) {
        const controller = new AbortController();
        abortControllerRef.current = controller;
        fetchStatus(controller.signal);
      }
    }, pollInterval);
  }, [fetchStatus, pollInterval, stopPolling, isComplete]);

  // Retry
  const retry = useCallback(() => {
    setError(null);
    setIsComplete(false);
    setProgress(null);
    startPolling();
  }, [startPolling]);

  // Setup polling on mount
  useEffect(() => {
    mountedRef.current = true;

    if (autoConnect && bomId && organizationId) {
      setConnectionStatus('connecting');
      startPolling();
    }

    return () => {
      mountedRef.current = false;
      stopPolling();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [autoConnect, bomId, organizationId, startPolling, stopPolling]);

  // Calculate progress percentage
  const progressPercent = progress && progress.totalItems > 0
    ? Math.round((progress.processedItems / progress.totalItems) * 100)
    : 0;

  return {
    progress,
    progressPercent,
    isComplete,
    error,
    isProcessing: progress !== null && !isComplete && !error,
    connectionStatus,
    retry,
  };
}

export default useEnrichmentProgress;
