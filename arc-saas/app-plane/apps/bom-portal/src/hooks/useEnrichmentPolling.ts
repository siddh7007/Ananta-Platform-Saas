/**
 * useEnrichmentPolling Hook - Polling-based Progress Updates
 *
 * Simple polling alternative to SSE for enrichment progress.
 * More reliable than SSE, no CORS issues, works everywhere.
 *
 * Polls the enrichment status endpoint every few seconds.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../providers/dataProvider';

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
 * Hook to poll enrichment progress from database
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

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastStateRef = useRef<string | null>(null);

  // Store callbacks in refs to avoid effect re-runs
  const callbackRefs = useRef({ onCompleted, onFailed, onProgress });
  useEffect(() => {
    callbackRefs.current = { onCompleted, onFailed, onProgress };
  });

  // Fetch current enrichment status from database
  const fetchStatus = useCallback(async () => {
    if (!bomId) return;

    try {
      // Get BOM with enrichment status (only columns that exist)
      const { data: bom, error: bomError } = await supabase
        .from('boms')
        .select('id, enrichment_status')
        .eq('id', bomId)
        .single();

      if (bomError) {
        console.error('[Polling] Failed to fetch BOM:', bomError);
        setError(new Error(`Failed to fetch BOM: ${bomError.message}`));
        return;
      }

      // Get line item counts
      const { data: lineItems, error: itemsError } = await supabase
        .from('bom_line_items')
        .select('id, enrichment_status')
        .eq('bom_id', bomId);

      if (itemsError) {
        console.error('[Polling] Failed to fetch line items:', itemsError);
        setError(new Error(`Failed to fetch line items: ${itemsError.message}`));
        return;
      }

      // Calculate counts
      const total = lineItems?.length || 0;
      const enriched = lineItems?.filter(li => li.enrichment_status === 'enriched').length || 0;
      const failed = lineItems?.filter(li => li.enrichment_status === 'failed').length || 0;
      const pending = lineItems?.filter(li =>
        !li.enrichment_status || li.enrichment_status === 'pending'
      ).length || 0;
      const percentComplete = total > 0 ? Math.round(((enriched + failed) / total) * 100) : 0;

      // Determine overall status from BOM enrichment_status field or calculate from items
      let status: EnrichmentState['status'] = 'pending';
      const bomStatus = bom?.enrichment_status;

      if (bomStatus === 'completed' || bomStatus === 'enriched' || (pending === 0 && total > 0 && enriched > 0)) {
        status = 'completed';
      } else if (bomStatus === 'failed') {
        status = 'failed';
      } else if (bomStatus === 'enriching' || enriched > 0 || failed > 0) {
        status = 'enriching';
      }

      const newState: EnrichmentState = {
        status,
        total_items: total,
        enriched_items: enriched,
        failed_items: failed,
        pending_items: pending,
        percent_complete: percentComplete,
      };

      // Check if state changed
      const stateKey = JSON.stringify(newState);
      if (stateKey !== lastStateRef.current) {
        // Only log on state changes to reduce noise
        console.debug('[Polling] Status:', status, `(${enriched}/${total} enriched, ${pending} pending)`);
        lastStateRef.current = stateKey;
        setState(newState);
        setError(null);

        // Call progress callback
        callbackRefs.current.onProgress?.(newState);

        // Check for completion
        if (status === 'completed' && newState.pending_items === 0) {
          console.log('[Polling] Enrichment completed');
          callbackRefs.current.onCompleted?.(newState);
          // Stop polling on completion
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
            setIsPolling(false);
          }
        } else if (status === 'failed') {
          console.log('[Polling] Enrichment failed');
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
      console.error('[Polling] Error fetching status:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch enrichment status'));
    }
  }, [bomId]);

  // Start polling
  const startPolling = useCallback(() => {
    if (intervalRef.current) return; // Already polling

    console.log(`[Polling] Starting polling for BOM ${bomId} (interval: ${pollInterval}ms)`);
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
      console.log('[Polling] Stopping polling');
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      setIsPolling(false);
    }
  }, []);

  // Refresh (manual fetch)
  const refresh = useCallback(() => {
    console.log('[Polling] Manual refresh');
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
