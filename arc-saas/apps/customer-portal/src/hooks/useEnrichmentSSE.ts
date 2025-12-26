/**
 * useEnrichmentSSE Hook
 * SSE-based enrichment progress tracking using EventSource
 * Connects to CNS Service's /api/enrichment/stream/{bom_id} endpoint
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiLogger } from '@/lib/logger';

// Get CNS API base URL and strip trailing /api if present
// VITE_CNS_API_URL defaults to 'http://localhost:27200/api' for axios calls,
// but SSE endpoint is at /api/enrichment/stream, not /api/api/enrichment/stream
const rawCnsUrl = import.meta.env.VITE_CNS_API_URL || 'http://localhost:27200';
const CNS_API_URL = rawCnsUrl.endsWith('/api')
  ? rawCnsUrl.slice(0, -4)  // Remove trailing /api
  : rawCnsUrl;

export interface EnrichmentProgressState {
  bom_id: string;
  total_items: number;
  enriched_items: number;
  failed_items: number;
  pending_items: number;
  percent_complete: number;
  status: string;
  current_batch?: number;
  total_batches?: number;
  started_at?: string;
  completed_at?: string;
  last_update?: string;
  current_item?: {
    mpn: string;
    status: 'processing' | 'enriched' | 'error';
    message?: string;
  };
  estimated_time_remaining?: number;
}

export interface EnrichmentEvent {
  event_type: 'progress' | 'enrichment.completed' | 'enrichment.failed' | 'connected' | 'error';
  event_id?: string;
  bom_id: string;
  state?: EnrichmentProgressState;
  message?: string;
  error?: string;
}

export type SSEConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface UseEnrichmentSSEOptions {
  autoConnect?: boolean;
  onProgress?: (state: EnrichmentProgressState) => void;
  onComplete?: (event: EnrichmentEvent) => void;
  onError?: (error: string) => void;
  // Optional: Current BOM status to validate before connecting
  bomStatus?: string;
}

interface UseEnrichmentSSEReturn {
  progress: EnrichmentProgressState | null;
  progressPercent: number;
  isComplete: boolean;
  isFailed: boolean;
  error: string | null;
  isProcessing: boolean;
  connectionStatus: SSEConnectionStatus;
  connect: () => void;
  disconnect: () => void;
  retry: () => void;
}

/**
 * Hook for SSE-based enrichment progress tracking
 *
 * Uses native EventSource to connect to CNS Service's SSE endpoint.
 * Automatically handles reconnection (browser native) and cleanup.
 *
 * @example
 * ```tsx
 * const {
 *   progress,
 *   progressPercent,
 *   isComplete,
 *   error,
 *   connectionStatus,
 * } = useEnrichmentSSE(bomId, {
 *   onComplete: () => refetchBom(),
 *   onError: (err) => toast.error(err),
 * });
 * ```
 */
export function useEnrichmentSSE(
  bomId: string,
  options: UseEnrichmentSSEOptions = {}
): UseEnrichmentSSEReturn {
  const { autoConnect = true, onProgress, onComplete, onError, bomStatus } = options;
  const { getAccessToken } = useAuth();

  const [progress, setProgress] = useState<EnrichmentProgressState | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [isFailed, setIsFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<SSEConnectionStatus>('disconnected');

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs for state to avoid stale closures in callbacks
  const isCompleteRef = useRef(false);
  const isFailedRef = useRef(false);

  // Sync refs with state
  useEffect(() => {
    isCompleteRef.current = isComplete;
    isFailedRef.current = isFailed;
  }, [isComplete, isFailed]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  // Disconnect
  const disconnect = useCallback(() => {
    cleanup();
    setConnectionStatus('disconnected');
    apiLogger.info(`[SSE] Disconnected from enrichment stream for BOM ${bomId}`);
  }, [bomId, cleanup]);

  // Connect to SSE stream
  const connect = useCallback(() => {
    const token = getAccessToken();
    if (!token || !bomId) {
      console.warn('[SSE] Cannot connect: missing token or bomId', { token: !!token, bomId });
      apiLogger.warn('[SSE] Cannot connect: missing token or bomId');
      return;
    }

    // Check if BOM is in a state that requires enrichment progress tracking
    // Don't connect SSE for already-completed BOMs (no events will be published)
    // Valid states for SSE: enriching, processing, analyzing, pending, running
    const activeStates = ['enriching', 'processing', 'analyzing', 'pending', 'running'];
    if (bomStatus && !activeStates.includes(bomStatus)) {
      console.warn('[SSE] BOM is not in active state, skipping SSE connection', { bomId, bomStatus });
      apiLogger.warn(`[SSE] BOM ${bomId} status is '${bomStatus}', not active - skipping SSE connection`);
      setError(`BOM is ${bomStatus}, not processing`);
      return;
    }

    // Close existing connection
    cleanup();

    setConnectionStatus('connecting');
    setError(null);

    // Build SSE URL with token query parameter
    // EventSource doesn't support custom headers, so we pass token as query param
    const sseUrl = `${CNS_API_URL}/api/enrichment/stream/${bomId}?token=${encodeURIComponent(token)}`;

    console.log('[SSE] Connecting to enrichment stream:', {
      bomId,
      url: sseUrl.replace(/token=[^&]+/, 'token=REDACTED'),
      baseUrl: CNS_API_URL,
    });
    apiLogger.info(`[SSE] Connecting to enrichment stream for BOM ${bomId}`);

    try {
      const eventSource = new EventSource(sseUrl);
      eventSourceRef.current = eventSource;

      // Connection opened
      eventSource.onopen = () => {
        console.log('[SSE] Connection opened successfully', { bomId });
        setConnectionStatus('connected');
        apiLogger.info(`[SSE] Connected to enrichment stream for BOM ${bomId}`);
      };

      // Handle 'connected' event (initial confirmation from server)
      eventSource.addEventListener('connected', (event) => {
        const data = JSON.parse((event as MessageEvent).data) as EnrichmentEvent;
        console.log('[SSE] Received connected event', data);
        apiLogger.debug('[SSE] Received connected event', data);
      });

      // Handle 'progress' events
      eventSource.addEventListener('progress', (event) => {
        const data = JSON.parse((event as MessageEvent).data) as EnrichmentEvent;
        console.log('[SSE] Progress update:', {
          enriched: data.state?.enriched_items,
          total: data.state?.total_items,
          percent: data.state?.percent_complete,
          current: data.state?.current_item?.mpn,
        });
        if (data.state) {
          setProgress(data.state);
          onProgress?.(data.state);
        }
      });

      // Handle 'enrichment.completed' event
      eventSource.addEventListener('enrichment.completed', (event) => {
        const data = JSON.parse((event as MessageEvent).data) as EnrichmentEvent;
        console.log('[SSE] Enrichment completed', { bomId, data });
        setIsComplete(true);
        setIsFailed(false);
        onComplete?.(data);
        apiLogger.info(`[SSE] Enrichment completed for BOM ${bomId}`);
        // Don't disconnect - let stream_end handle it
      });

      // Handle 'enrichment.failed' event
      eventSource.addEventListener('enrichment.failed', (event) => {
        const data = JSON.parse((event as MessageEvent).data) as EnrichmentEvent;
        console.error('[SSE] Enrichment failed', { bomId, error: data.error || data.message });
        setIsFailed(true);
        setError(data.error || data.message || 'Enrichment failed');
        onError?.(data.error || data.message || 'Enrichment failed');
        apiLogger.error(`[SSE] Enrichment failed for BOM ${bomId}`, data);
      });

      // Handle 'stream_end' event
      eventSource.addEventListener('stream_end', (event) => {
        const data = JSON.parse((event as MessageEvent).data) as { type: string; reason: string };
        console.log('[SSE] Stream ended', { bomId, reason: data.reason });
        apiLogger.info(`[SSE] Stream ended for BOM ${bomId}: ${data.reason}`);
        disconnect();
      });

      // Handle 'keepalive' events (sent every 30s to keep connection alive)
      eventSource.addEventListener('keepalive', (event) => {
        const data = JSON.parse((event as MessageEvent).data);
        console.debug('[SSE] Keepalive received', { bomId, timestamp: data.timestamp });
      });

      // Handle 'enrichment.started' event
      eventSource.addEventListener('enrichment.started', (event) => {
        const data = JSON.parse((event as MessageEvent).data) as EnrichmentEvent;
        console.log('[SSE] Enrichment started', { bomId, data });
      });

      // Handle 'error' events from server
      eventSource.addEventListener('error', (event) => {
        // Check if it's a server-sent error event with data
        if (event instanceof MessageEvent && event.data) {
          const data = JSON.parse(event.data) as EnrichmentEvent;
          console.error('[SSE] Server error event', { bomId, error: data.message });
          setError(data.message || 'Stream error');
          setConnectionStatus('error');
          onError?.(data.message || 'Stream error');
        }
      });

      // Handle connection errors
      eventSource.onerror = (event) => {
        console.error('[SSE] Connection error', {
          bomId,
          readyState: eventSource.readyState,
          CONNECTING: EventSource.CONNECTING,
          OPEN: EventSource.OPEN,
          CLOSED: EventSource.CLOSED,
        });
        apiLogger.error(`[SSE] Connection error for BOM ${bomId}`, event);

        if (eventSource.readyState === EventSource.CLOSED) {
          // Use refs to get current state (avoid stale closure)
          console.warn('[SSE] Connection closed', { bomId, isComplete: isCompleteRef.current, isFailed: isFailedRef.current });
          setConnectionStatus('disconnected');

          // EventSource will auto-reconnect for certain errors
          // If it's closed, we don't need to manually reconnect
          if (!isCompleteRef.current && !isFailedRef.current) {
            setError('Connection lost');
            onError?.('Connection lost');
          }
        } else {
          console.warn('[SSE] Connection error but not closed', { bomId, readyState: eventSource.readyState });
          setConnectionStatus('error');
        }
      };
    } catch (err) {
      apiLogger.error('[SSE] Failed to create EventSource', err);
      setConnectionStatus('error');
      setError('Failed to connect to enrichment stream');
      onError?.('Failed to connect to enrichment stream');
    }
  // Note: Removed isComplete/isFailed from deps - using refs instead to avoid stale closures
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bomId, bomStatus, getAccessToken, cleanup, disconnect, onProgress, onComplete, onError]);

  // Retry connection
  const retry = useCallback(() => {
    setError(null);
    setIsComplete(false);
    setIsFailed(false);
    setProgress(null);
    connect();
  }, [connect]);

  // Stable ref for connect to avoid effect re-triggering
  const connectRef = useRef(connect);
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  // Auto-connect on mount - only depends on bomId and autoConnect, not the connect function
  useEffect(() => {
    if (autoConnect && bomId) {
      connectRef.current();
    }

    return () => {
      cleanup();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConnect, bomId, cleanup]);

  // Calculate progress percentage
  const progressPercent = progress?.percent_complete || 0;

  return {
    progress,
    progressPercent,
    isComplete,
    isFailed,
    error,
    isProcessing: progress !== null && !isComplete && !isFailed,
    connectionStatus,
    connect,
    disconnect,
    retry,
  };
}

export default useEnrichmentSSE;
