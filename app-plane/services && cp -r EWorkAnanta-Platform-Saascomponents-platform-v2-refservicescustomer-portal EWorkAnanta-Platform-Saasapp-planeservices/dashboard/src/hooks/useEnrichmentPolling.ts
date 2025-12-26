/**
 * useEnrichmentPolling Hook - Polling-based Progress Updates (CNS Dashboard)
 *
 * Simple polling alternative to SSE for enrichment progress.
 * More reliable than SSE, no CORS issues, works everywhere.
 *
 * Polls the CNS API enrichment status endpoint every few seconds.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { CNS_API_URL, getAdminAuthHeaders } from '../config/api';

export interface EnrichmentState {
  status: 'pending' | 'enriching' | 'completed' | 'failed' | 'paused' | 'stopped';
  total_items: number;
  enriched_items: number;
  failed_items: number;
  not_found_items?: number;
  pending_items: number;
  percent_complete: number;
  current_batch?: number;
  total_batches?: number;
  started_at?: string;
  completed_at?: string;
  failed_at?: string;
}

export interface UseEnrichmentPollingOptions {
  bomId: string;
  /** Polling interval in milliseconds (default: 2000) */
  pollInterval?: number;
  /** Whether polling is enabled (default: true) */
  enabled?: boolean;
  /** Callback when enrichment completes */
  onCompleted?: (state: EnrichmentState) => void;
  /** Callback when enrichment fails */
  onFailed?: (state: EnrichmentState) => void;
  /** Callback on progress update */
  onProgress?: (state: EnrichmentState) => void;
}

export interface UseEnrichmentPollingReturn {
  state: EnrichmentState | null;
  isPolling: boolean;
  error: Error | null;
  /** Force an immediate refresh */
  refresh: () => void;
  /** Start polling */
  startPolling: () => void;
  /** Stop polling */
  stopPolling: () => void;
}

/**
 * Hook to poll enrichment progress from CNS API
 */
export function useEnrichmentPolling(
  options: UseEnrichmentPollingOptions
): UseEnrichmentPollingReturn {
  const {
    bomId,
    pollInterval = 2000,
    enabled = true,
    onCompleted,
    onFailed,
    onProgress,
  } = options;

  const [state, setState] = useState<EnrichmentState | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastStateRef = useRef<string | null>(null);

  // Store callbacks in refs to avoid effect re-runs
  const callbackRefs = useRef({ onCompleted, onFailed, onProgress });
  useEffect(() => {
    callbackRefs.current = { onCompleted, onFailed, onProgress };
  });

  // Fetch current enrichment status from CNS API
  const fetchStatus = useCallback(async () => {
    if (!bomId) return;

    try {
      const headers = getAdminAuthHeaders() || {};

      // Use the enrichment status endpoint
      const response = await fetch(`${CNS_API_URL}/boms/${bomId}/enrichment/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch status: ${response.status}`);
      }

      const data = await response.json();

      // API returns: { status, progress: { total_items, enriched_items, ... }, ... }
      // Support both nested (progress) and flat response formats for compatibility
      const progress = data.progress || {};

      // Extract enrichment state from response
      const newState: EnrichmentState = {
        status: data.enrichment_status || data.status || 'pending',
        total_items: progress.total_items || data.total_items || data.total_rows || 0,
        enriched_items: progress.enriched_items || data.enriched_items || data.enriched_count || 0,
        failed_items: progress.failed_items || data.failed_items || data.failed_count || 0,
        not_found_items: progress.not_found_items || data.not_found_items,
        pending_items: progress.pending_items || data.pending_items || 0,
        percent_complete: progress.percent_complete || data.percent_complete || 0,
        current_batch: progress.current_batch || data.current_batch,
        total_batches: progress.total_batches || data.total_batches,
        started_at: data.started_at,
        completed_at: progress.completed_at || data.completed_at,
        failed_at: data.failed_at,
      };

      // Calculate pending if not provided
      if (!newState.pending_items && newState.total_items > 0) {
        newState.pending_items = Math.max(0,
          newState.total_items - newState.enriched_items - newState.failed_items
        );
      }

      // Calculate percent if not provided
      if (!newState.percent_complete && newState.total_items > 0) {
        newState.percent_complete = Math.round(
          ((newState.enriched_items + newState.failed_items) / newState.total_items) * 100
        );
      }

      // Check if state changed
      const stateKey = JSON.stringify(newState);
      if (stateKey !== lastStateRef.current) {
        console.debug('[CNS Polling] Status:', newState.status,
          `(${newState.enriched_items}/${newState.total_items} enriched, ${newState.pending_items} pending)`);
        lastStateRef.current = stateKey;
        setState(newState);
        setError(null);

        // Call progress callback
        callbackRefs.current.onProgress?.(newState);

        // Check for completion
        if (newState.status === 'completed' ||
            (newState.pending_items === 0 && newState.total_items > 0 && newState.enriched_items > 0)) {
          console.log('[CNS Polling] Enrichment completed');
          callbackRefs.current.onCompleted?.(newState);
          // Stop polling on completion
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
            setIsPolling(false);
          }
        } else if (newState.status === 'failed') {
          console.log('[CNS Polling] Enrichment failed');
          callbackRefs.current.onFailed?.(newState);
          // Stop polling on failure
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
            setIsPolling(false);
          }
        }
      }
    } catch (err) {
      console.error('[CNS Polling] Error fetching status:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch enrichment status'));
    }
  }, [bomId]);

  // Start polling
  const startPolling = useCallback(() => {
    if (intervalRef.current) return; // Already polling

    console.log(`[CNS Polling] Starting polling for BOM ${bomId} (interval: ${pollInterval}ms)`);
    setIsPolling(true);
    lastStateRef.current = null; // Reset to trigger initial callback

    // Fetch immediately
    fetchStatus();

    // Start interval
    intervalRef.current = setInterval(fetchStatus, pollInterval);
  }, [bomId, pollInterval, fetchStatus]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      console.log('[CNS Polling] Stopping polling');
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      setIsPolling(false);
    }
  }, []);

  // Refresh (manual fetch)
  const refresh = useCallback(() => {
    console.log('[CNS Polling] Manual refresh');
    fetchStatus();
  }, [fetchStatus]);

  // Auto-start polling when enabled and bomId changes
  useEffect(() => {
    if (!bomId || !enabled) {
      stopPolling();
      return;
    }

    startPolling();

    return () => {
      stopPolling();
    };
  }, [bomId, enabled, startPolling, stopPolling]);

  return {
    state,
    isPolling,
    error,
    refresh,
    startPolling,
    stopPolling,
  };
}

export default useEnrichmentPolling;
