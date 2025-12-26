/**
 * useEnrichmentStream Hook - Enhanced SSE with Fallback
 *
 * Primary hook for real-time BOM enrichment progress via Server-Sent Events.
 * Features:
 * - Native EventSource with automatic reconnection
 * - Exponential backoff on connection failures
 * - Automatic fallback to polling if SSE unavailable
 * - Component-level progress tracking
 * - Connection health monitoring
 * - Manual reconnection support
 *
 * Usage:
 * ```tsx
 * const { state, isConnected, isPolling, reconnect } = useEnrichmentStream(bomId, {
 *   enabled: true,
 *   onComplete: (state) => console.log('Done!', state),
 * });
 * ```
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { getCnsBaseUrl } from '../services/cnsApi';
import {
  createEnrichmentStream,
  closeEnrichmentStream,
  getStreamHealth,
  type StreamConnection,
  type StreamOptions
} from '../services/enrichment-stream.service';
import { supabase } from '../providers/dataProvider';

export interface EnrichmentState {
  status: 'idle' | 'connecting' | 'enriching' | 'completed' | 'failed' | 'paused' | 'stopped';
  total_items: number;
  enriched_items: number;
  failed_items: number;
  not_found_items?: number;
  pending_items: number;
  percent_complete: number;
  current_stage?: string;
  current_batch?: number;
  total_batches?: number;
  started_at?: string;
  completed_at?: string;
  failed_at?: string;
  error_message?: string;
}

export interface ComponentProgress {
  line_item_id: string;
  mpn: string;
  manufacturer: string;
  status: 'pending' | 'enriching' | 'enriched' | 'failed' | 'not_found';
  enrichment_data?: {
    supplier?: string;
    price?: number;
    stock?: number;
    datasheet_url?: string;
    lifecycle_status?: string;
    category?: string;
  };
  error_message?: string;
  updated_at: string;
}

export interface EnrichmentEvent {
  event_id: string;
  event_type: 'enrichment.started' | 'enrichment.progress' | 'enrichment.component.completed' |
              'enrichment.component.failed' | 'enrichment.completed' | 'enrichment.error';
  bom_id: string;
  organization_id: string;
  project_id?: string;
  state: EnrichmentState;
  component?: ComponentProgress;
  payload: Record<string, any>;
  created_at: string;
}

export interface UseEnrichmentStreamOptions {
  /** BOM ID to stream enrichment events for */
  bomId: string;
  /** Enable/disable streaming (useful for conditional rendering) */
  enabled?: boolean;
  /** Callback when enrichment starts */
  onStarted?: (state: EnrichmentState) => void;
  /** Callback on progress updates */
  onProgress?: (state: EnrichmentState) => void;
  /** Callback when a component completes */
  onComponentCompleted?: (component: ComponentProgress) => void;
  /** Callback when a component fails */
  onComponentFailed?: (component: ComponentProgress) => void;
  /** Callback when enrichment completes */
  onComplete?: (state: EnrichmentState) => void;
  /** Callback on errors */
  onError?: (error: Error) => void;
  /** Fallback to polling if SSE fails after N attempts (default: 3) */
  pollFallbackAfter?: number;
  /** Polling interval when in fallback mode (ms, default: 3000) */
  pollInterval?: number;
}

export interface UseEnrichmentStreamReturn {
  /** Current enrichment state */
  state: EnrichmentState | null;
  /** Latest component updates (last 50) */
  components: ComponentProgress[];
  /** SSE connection established */
  isConnected: boolean;
  /** Currently using polling fallback */
  isPolling: boolean;
  /** Connection error (if any) */
  error: Error | null;
  /** Latest event received */
  latestEvent: EnrichmentEvent | null;
  /** Manual reconnection */
  reconnect: () => void;
  /** Current retry attempt count */
  retryCount: number;
}

/**
 * Hook to stream enrichment progress via SSE with automatic fallback to polling
 */
export function useEnrichmentStream(
  options: UseEnrichmentStreamOptions
): UseEnrichmentStreamReturn {
  const {
    bomId,
    enabled = true,
    onStarted,
    onProgress,
    onComponentCompleted,
    onComponentFailed,
    onComplete,
    onError,
    pollFallbackAfter = 3,
    pollInterval = 3000,
  } = options;

  // State
  const [state, setState] = useState<EnrichmentState | null>(null);
  const [components, setComponents] = useState<ComponentProgress[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [latestEvent, setLatestEvent] = useState<EnrichmentEvent | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Refs
  const connectionRef = useRef<StreamConnection | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Store callbacks in refs to prevent re-subscription on callback changes
  const callbacksRef = useRef({
    onStarted,
    onProgress,
    onComponentCompleted,
    onComponentFailed,
    onComplete,
    onError,
  });

  useEffect(() => {
    callbacksRef.current = {
      onStarted,
      onProgress,
      onComponentCompleted,
      onComponentFailed,
      onComplete,
      onError,
    };
  });

  /**
   * Fetch latest enrichment state from database (for initial load and polling fallback)
   *
   * IMPORTANT: Progress is stored in boms.enrichment_progress column (updated by CNS workflow),
   * not in enrichment_events.state (which may be empty for component-level events).
   */
  const fetchState = useCallback(async (): Promise<EnrichmentState | null> => {
    try {
      console.log('[EnrichmentStream] Fetching state from Supabase for BOM:', bomId);

      // Primary: Get progress directly from boms.enrichment_progress (source of truth)
      const { data: bomData, error: bomError } = await supabase
        .from('boms')
        .select('id, status, enrichment_status, enrichment_progress')
        .eq('id', bomId)
        .single();

      if (bomError) {
        // If no BOM found, try enrichment_events as fallback
        if (bomError.code === 'PGRST116') {
          console.log('[EnrichmentStream] BOM not found, checking enrichment_events');
        } else {
          throw new Error(`Database error: ${bomError.message}`);
        }
      }

      // If we have enrichment_progress from BOM table, use it
      if (bomData?.enrichment_progress) {
        const progress = bomData.enrichment_progress as {
          total_items?: number;
          enriched_items?: number;
          failed_items?: number;
          pending_items?: number;
          percent_complete?: number;
        };

        // Map BOM status to enrichment state status
        let status: EnrichmentState['status'] = 'idle';
        if (bomData.status === 'completed' || bomData.enrichment_status === 'enriched') {
          status = 'completed';
        } else if (bomData.status === 'failed' || bomData.enrichment_status === 'failed') {
          status = 'failed';
        } else if (bomData.enrichment_status === 'processing' || bomData.status === 'analyzing') {
          status = 'enriching';
        } else if (bomData.enrichment_status === 'pending' || bomData.enrichment_status === 'queued') {
          status = 'idle';
        }

        const enrichmentState: EnrichmentState = {
          status,
          total_items: progress.total_items || 0,
          enriched_items: progress.enriched_items || 0,
          failed_items: progress.failed_items || 0,
          pending_items: progress.pending_items || 0,
          percent_complete: progress.percent_complete || 0,
        };

        console.log('[EnrichmentStream] Loaded progress from boms table:', enrichmentState.status, `${enrichmentState.percent_complete}%`);
        return enrichmentState;
      }

      // Fallback: Try enrichment_events for backwards compatibility
      const { data: events, error: dbError } = await supabase
        .from('enrichment_events')
        .select('*')
        .eq('bom_id', bomId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (dbError && dbError.code !== 'PGRST116') {
        throw new Error(`Database error: ${dbError.message}`);
      }

      if (events && events.length > 0) {
        const event = events[0];
        // Only use event.state if it has actual progress data
        if (event.state && Object.keys(event.state).length > 0 && event.state.percent_complete !== undefined) {
          console.log('[EnrichmentStream] Loaded state from enrichment_events:', event.state?.status);
          return event.state as EnrichmentState;
        }
      }

      console.log('[EnrichmentStream] No enrichment progress found in DB');
      return null;
    } catch (err) {
      console.error('[EnrichmentStream] Error fetching state:', err);
      return null;
    }
  }, [bomId]);

  /**
   * Handle incoming enrichment events
   */
  const handleEvent = useCallback((event: EnrichmentEvent) => {
    if (!mountedRef.current) return;

    console.log('[EnrichmentStream] Event received:', event.event_type, event.state?.status);

    // Update state
    setState(event.state);
    setLatestEvent(event);

    // Handle specific event types
    switch (event.event_type) {
      case 'enrichment.started':
        callbacksRef.current.onStarted?.(event.state);
        break;

      case 'enrichment.progress':
        callbacksRef.current.onProgress?.(event.state);
        break;

      case 'enrichment.component.completed':
        if (event.component) {
          setComponents(prev => {
            const updated = [...prev];
            const existing = updated.findIndex(c => c.line_item_id === event.component!.line_item_id);
            if (existing >= 0) {
              updated[existing] = event.component!;
            } else {
              updated.push(event.component!);
            }
            return updated.slice(-50); // Keep last 50
          });
          callbacksRef.current.onComponentCompleted?.(event.component);
        }
        break;

      case 'enrichment.component.failed':
        if (event.component) {
          setComponents(prev => {
            const updated = [...prev];
            const existing = updated.findIndex(c => c.line_item_id === event.component!.line_item_id);
            if (existing >= 0) {
              updated[existing] = event.component!;
            } else {
              updated.push(event.component!);
            }
            return updated.slice(-50);
          });
          callbacksRef.current.onComponentFailed?.(event.component);
        }
        break;

      case 'enrichment.completed':
        callbacksRef.current.onComplete?.(event.state);
        // Auto-close connection on completion
        if (connectionRef.current) {
          console.log('[EnrichmentStream] Auto-closing stream after completion');
          closeEnrichmentStream(connectionRef.current);
          connectionRef.current = null;
        }
        break;

      case 'enrichment.error':
        const err = new Error(event.state.error_message || 'Enrichment error');
        setError(err);
        callbacksRef.current.onError?.(err);
        break;
    }
  }, []);

  /**
   * Start polling fallback
   */
  const startPolling = useCallback(async () => {
    if (!mountedRef.current || !enabled) return;

    console.log('[EnrichmentStream] Starting polling fallback');
    setIsPolling(true);

    const poll = async () => {
      if (!mountedRef.current || !enabled) return;

      const currentState = await fetchState();
      if (currentState) {
        setState(currentState);

        // Check if completed
        if (currentState.status === 'completed' || currentState.status === 'failed') {
          console.log('[EnrichmentStream] Enrichment finished, stopping polling');
          if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }
          setIsPolling(false);

          if (currentState.status === 'completed') {
            callbacksRef.current.onComplete?.(currentState);
          } else if (currentState.status === 'failed') {
            callbacksRef.current.onError?.(new Error(currentState.error_message || 'Enrichment failed'));
          }
        } else {
          callbacksRef.current.onProgress?.(currentState);
        }
      }
    };

    // Initial poll
    await poll();

    // Setup interval
    pollTimerRef.current = setInterval(poll, pollInterval);
  }, [enabled, fetchState, pollInterval]);

  /**
   * Stop polling fallback
   */
  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setIsPolling(false);
  }, []);

  /**
   * Setup SSE stream
   */
  const setupStream = useCallback(async () => {
    if (!enabled || !bomId) return;

    console.log('[EnrichmentStream] Setting up SSE stream for BOM:', bomId);

    // Fetch initial state
    const initialState = await fetchState();
    if (initialState) {
      setState(initialState);

      // Don't start stream if already completed/failed
      if (initialState.status === 'completed' || initialState.status === 'failed') {
        console.log('[EnrichmentStream] BOM already finished, skipping stream setup');
        return;
      }
    }

    // Get auth token (Auth0 or Supabase)
    const auth0Token = localStorage.getItem('auth0_access_token');
    let token = auth0Token;

    if (!token) {
      const supabaseKeys = Object.keys(localStorage).filter(key =>
        key.startsWith('sb-') && key.endsWith('-auth-token')
      );
      if (supabaseKeys.length > 0) {
        try {
          const sessionData = JSON.parse(localStorage.getItem(supabaseKeys[0]) || '{}');
          token = sessionData?.access_token;
        } catch (e) {
          console.warn('[EnrichmentStream] Failed to parse Supabase session');
        }
      }
    }

    const streamUrl = `${getCnsBaseUrl()}/api/enrichment/stream/${bomId}${token ? `?token=${encodeURIComponent(token)}` : ''}`;

    const streamOptions: StreamOptions = {
      bomId,
      onConnected: () => {
        if (!mountedRef.current) return;
        console.log('[EnrichmentStream] SSE connected');
        setIsConnected(true);
        setError(null);
        setRetryCount(0);
        stopPolling(); // Stop polling if it was running
      },
      onMessage: (event: EnrichmentEvent) => {
        if (!mountedRef.current) return;
        handleEvent(event);
      },
      onError: (err: Error) => {
        if (!mountedRef.current) return;
        console.error('[EnrichmentStream] SSE error:', err);
        setIsConnected(false);
        setError(err);
        setRetryCount(prev => prev + 1);

        callbacksRef.current.onError?.(err);

        // Fallback to polling after max retries
        if (retryCount >= pollFallbackAfter - 1) {
          console.warn('[EnrichmentStream] Max SSE retries reached, falling back to polling');
          if (connectionRef.current) {
            closeEnrichmentStream(connectionRef.current);
            connectionRef.current = null;
          }
          startPolling();
        }
      },
      maxReconnectAttempts: pollFallbackAfter,
      reconnectInterval: 2000,
    };

    try {
      const connection = createEnrichmentStream(streamUrl, streamOptions);
      connectionRef.current = connection;
    } catch (err) {
      console.error('[EnrichmentStream] Failed to create stream:', err);
      setError(err as Error);
      startPolling();
    }
  }, [enabled, bomId, fetchState, handleEvent, retryCount, pollFallbackAfter, startPolling, stopPolling]);

  /**
   * Manual reconnection
   */
  const reconnect = useCallback(() => {
    console.log('[EnrichmentStream] Manual reconnect requested');

    // Close existing connections
    if (connectionRef.current) {
      closeEnrichmentStream(connectionRef.current);
      connectionRef.current = null;
    }
    stopPolling();

    // Reset state
    setIsConnected(false);
    setIsPolling(false);
    setError(null);
    setRetryCount(0);

    // Reconnect
    setupStream();
  }, [setupStream, stopPolling]);

  /**
   * Setup stream on mount or when bomId/enabled changes
   */
  useEffect(() => {
    if (!enabled || !bomId) {
      return;
    }

    setupStream();

    return () => {
      console.log('[EnrichmentStream] Cleaning up stream');
      if (connectionRef.current) {
        closeEnrichmentStream(connectionRef.current);
        connectionRef.current = null;
      }
      stopPolling();
    };
  }, [enabled, bomId, setupStream, stopPolling]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (connectionRef.current) {
        closeEnrichmentStream(connectionRef.current);
      }
      stopPolling();
    };
  }, [stopPolling]);

  return {
    state,
    components,
    isConnected,
    isPolling,
    error,
    latestEvent,
    reconnect,
    retryCount,
  };
}
