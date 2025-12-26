/**
 * useEnrichmentProgress Hook - Real-time SSE Mode
 *
 * Subscribe to enrichment progress events via Server-Sent Events (SSE).
 * Uses Redis Pub/Sub backend for instant updates with automatic reconnection.
 *
 * REAL-TIME MODE: SSE streams with native browser reconnection
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { getCnsBaseUrl } from '../services/cnsApi';
import { subscribeToBom, getActiveEventSource } from '../services/sseManager';
import { supabase } from '../providers/dataProvider';

export interface EnrichmentState {
  status: 'enriching' | 'completed' | 'failed' | 'paused' | 'stopped';
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

export interface EnrichmentEvent {
  event_id: string;
  event_type: string;
  routing_key: string;
  bom_id: string;
  organization_id: string;
  project_id?: string;
  user_id?: string;
  source: 'customer' | 'staff';
  workflow_id?: string;
  workflow_run_id?: string;
  state: EnrichmentState;
  payload: Record<string, any>;
  created_at: string;
}

export interface ComponentEvent {
  mpn: string;
  manufacturer: string;
  line_item_id: string;
  success: boolean;
  error?: string;
  enrichment?: {
    supplier?: string;
    price?: number;
    stock?: number;
    datasheet_url?: string;
  };
}

export interface UseEnrichmentProgressOptions {
  bomId: string;
  onStarted?: (event: EnrichmentEvent) => void;
  onProgress?: (event: EnrichmentEvent) => void;
  onComponentCompleted?: (component: ComponentEvent) => void;
  onComponentFailed?: (component: ComponentEvent) => void;
  onCompleted?: (event: EnrichmentEvent) => void;
  onFailed?: (event: EnrichmentEvent) => void;
  onError?: (error: Error) => void;
}

export interface UseEnrichmentProgressReturn {
  state: EnrichmentState | null;
  events: EnrichmentEvent[];
  componentEvents: ComponentEvent[];
  isConnected: boolean;
  error: Error | null;
  latestEvent: EnrichmentEvent | null;
  refresh: () => void;
}

/**
 * Hook to subscribe to real-time enrichment progress via SSE
 */
export function useEnrichmentProgress(
  options: UseEnrichmentProgressOptions
): UseEnrichmentProgressReturn {
  const {
    bomId,
    onStarted,
    onProgress,
    onComponentCompleted,
    onComponentFailed,
    onCompleted,
    onFailed,
    onError,
  } = options;

  const [state, setState] = useState<EnrichmentState | null>(null);
  const [events, setEvents] = useState<EnrichmentEvent[]>([]);
  const [componentEvents, setComponentEvents] = useState<ComponentEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [latestEvent, setLatestEvent] = useState<EnrichmentEvent | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const activeBomIdRef = useRef<string | null>(null);
  const lastEventIdRef = useRef<string | null>(null);

  // Store callbacks in refs to avoid re-triggering effect on callback changes
  const callbackRefs = useRef({
    onStarted,
    onProgress,
    onComponentCompleted,
    onComponentFailed,
    onCompleted,
    onFailed,
    onError,
  });

  // Update refs when callbacks change (doesn't trigger re-render)
  useEffect(() => {
    callbackRefs.current = {
      onStarted,
      onProgress,
      onComponentCompleted,
      onComponentFailed,
      onCompleted,
      onFailed,
      onError,
    };
  });

  // Stable event handler that reads from refs
  const handleNewEventRef = useRef((event: EnrichmentEvent) => {
    console.log('[Enrichment SSE] New event:', event.event_type, event.state);

    // Update state with latest enrichment state
    setState(event.state);
    setLatestEvent(event);

    // Add to events history
    setEvents(prev => {
      const exists = prev.some(e => e.event_id === event.event_id);
      if (exists) return prev;
      return [...prev, event].slice(-100);
    });

    // Handle specific event types
    switch (event.event_type) {
      case 'enrichment.started':
        callbackRefs.current.onStarted?.(event);
        break;

      case 'enrichment.progress':
        callbackRefs.current.onProgress?.(event);
        break;

      case 'enrichment.component.completed':
        if (event.payload?.component) {
          const componentEvent: ComponentEvent = {
            ...event.payload.component,
            success: true,
            enrichment: event.payload.enrichment,
          };
          setComponentEvents(prev => {
            const exists = prev.some(c => c.line_item_id === componentEvent.line_item_id);
            if (exists) return prev;
            return [...prev, componentEvent].slice(-200);
          });
          callbackRefs.current.onComponentCompleted?.(componentEvent);
        }
        break;

      case 'enrichment.component.failed':
        if (event.payload?.component) {
          const componentEvent: ComponentEvent = {
            ...event.payload.component,
            success: false,
            error: event.payload.error,
          };
          setComponentEvents(prev => {
            const exists = prev.some(c => c.line_item_id === componentEvent.line_item_id);
            if (exists) return prev;
            return [...prev, componentEvent].slice(-200);
          });
          callbackRefs.current.onComponentFailed?.(componentEvent);
        }
        break;

      case 'enrichment.completed': {
        callbackRefs.current.onCompleted?.(event);
        // Close EventSource when completed
        const activeEs = getActiveEventSource(event.bom_id);
        if (activeEs) {
          activeEs.close();
          eventSourceRef.current = null;
        }
        break;
      }

      case 'enrichment.failed': {
        callbackRefs.current.onFailed?.(event);
        // Close EventSource when failed
        const activeEs = getActiveEventSource(event.bom_id);
        if (activeEs) {
          activeEs.close();
          eventSourceRef.current = null;
        }
        break;
      }
    }
  });

  const refresh = useCallback(() => {
    // For SSE, reconnecting is handled automatically by EventSource
    // This is a no-op for compatibility
    console.log('[Enrichment SSE] Refresh called - EventSource handles reconnection automatically');
  }, []);

  // Fetch initial enrichment status from database
  useEffect(() => {
    if (!bomId) return;

    // Defensive guard: if an EventSource already exists for this BOM, don't create another
    if (
      eventSourceRef.current &&
      activeBomIdRef.current === bomId &&
      eventSourceRef.current.readyState !== EventSource.CLOSED
    ) {
      console.log('[Enrichment SSE] EventSource already active for', bomId);
      return;
    }

    const fetchInitialStatus = async () => {
      try {
        console.log('[Enrichment SSE] Fetching initial status from Supabase...');

        // Primary: Get progress directly from boms.enrichment_progress (source of truth)
        // CNS service updates this column, NOT enrichment_events.state
        const { data: bomData, error: bomError } = await supabase
          .from('boms')
          .select('id, status, enrichment_status, enrichment_progress')
          .eq('id', bomId)
          .single();

        if (bomError && bomError.code !== 'PGRST116') {
          console.error('[Enrichment SSE] Error fetching BOM status:', bomError);
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
          let status: EnrichmentState['status'] = 'enriching';
          if (bomData.status === 'completed' || bomData.enrichment_status === 'enriched') {
            status = 'completed';
          } else if (bomData.status === 'failed' || bomData.enrichment_status === 'failed') {
            status = 'failed';
          } else if (bomData.enrichment_status === 'paused') {
            status = 'paused';
          } else if (bomData.enrichment_status === 'stopped') {
            status = 'stopped';
          }

          const enrichmentState: EnrichmentState = {
            status,
            total_items: progress.total_items || 0,
            enriched_items: progress.enriched_items || 0,
            failed_items: progress.failed_items || 0,
            pending_items: progress.pending_items || 0,
            percent_complete: progress.percent_complete || 0,
          };

          console.log('[Enrichment SSE] Initial status from boms table:', status, `${enrichmentState.percent_complete}%`);
          setState(enrichmentState);
          return;
        }

        // Fallback: Try enrichment_events for backwards compatibility
        const { data: events, error } = await supabase
          .from('enrichment_events')
          .select('*')
          .eq('bom_id', bomId)
          .order('created_at', { ascending: false })
          .limit(1);

        if (error && error.code !== 'PGRST116') {
          console.error('[Enrichment SSE] Error fetching initial status:', error);
          return;
        }

        if (events && events.length > 0) {
          const latestEvent = events[0];
          // Only use event.state if it has actual progress data
          if (latestEvent.state && Object.keys(latestEvent.state).length > 0 && latestEvent.state.percent_complete !== undefined) {
            console.log('[Enrichment SSE] Initial status from enrichment_events:', latestEvent.state?.status);
            setState(latestEvent.state);
            setLatestEvent(latestEvent);
            setEvents([latestEvent]);
          }
        } else {
          console.log('[Enrichment SSE] No existing enrichment progress found');
        }
      } catch (err) {
        console.error('[Enrichment SSE] Failed to fetch initial status:', err);
      }
    };

    fetchInitialStatus();
  }, [bomId]);

  // Setup SSE connection
  useEffect(() => {
    if (!bomId) return;

    const cnsApiUrl = getCnsBaseUrl();

    // EventSource doesn't support custom headers, so we pass token as query param
    // Try Auth0 first, then fall back to Supabase access token
    const auth0Token = localStorage.getItem('auth0_access_token');
    let token = auth0Token;

    // If no Auth0 token, try to get Supabase access token from session
    if (!token) {
      // Supabase stores session in localStorage with pattern: sb-<project-ref>-auth-token
      const supabaseKeys = Object.keys(localStorage).filter(key =>
        key.startsWith('sb-') && key.endsWith('-auth-token')
      );
      if (supabaseKeys.length > 0) {
        try {
          const sessionData = JSON.parse(localStorage.getItem(supabaseKeys[0]) || '{}');
          token = sessionData?.access_token;
        } catch (e) {
          console.warn('[Enrichment SSE] Failed to parse Supabase session');
        }
      }
    }

    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
    const streamUrl = `${cnsApiUrl}/api/enrichment/stream/${bomId}${tokenParam}`;

    console.log(`[Enrichment SSE] Subscribing to stream: ${cnsApiUrl}/api/enrichment/stream/${bomId} (token: ${token ? 'present' : 'missing'})`);
    const unsubscribe = subscribeToBom(bomId, streamUrl, {
      onConnected: () => {
        console.log('[Enrichment SSE] Connected to stream');
        setIsConnected(true);
        setError(null);
      },
      onMessage: (data) => {
        try {
          const event = typeof data === 'string' ? JSON.parse(data) : data;
          if (lastEventIdRef.current !== event.event_id) {
            lastEventIdRef.current = event.event_id;
            // Use ref to avoid dependency on handleNewEvent callback
            handleNewEventRef.current(event);
          }
        } catch (err) {
          console.error('[Enrichment SSE] Failed to parse event:', err);
        }
      },
      onError: (e) => {
        console.error('[Enrichment SSE] Connection error via manager', e);
        setIsConnected(false);
        const err = new Error('SSE stream error');
        setError(err);
        // Use ref to avoid dependency on onError callback
        callbackRefs.current.onError?.(err);
      },
    });
    activeBomIdRef.current = bomId;

    // Expose manager's EventSource for legacy code paths
    eventSourceRef.current = getActiveEventSource(bomId);

    // Cleanup on unmount or when bomId changes
    return () => {
      console.log('[Enrichment SSE] Unsubscribing stream');
      try { unsubscribe(); } catch(e) { /* ignore */ }
      activeBomIdRef.current = null;
      setIsConnected(false);
    };
  }, [bomId]); // Only re-subscribe when bomId changes

  return {
    state,
    events,
    componentEvents,
    isConnected,
    error,
    latestEvent,
    refresh,
  };
}
