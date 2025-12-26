/**
 * useEnrichmentProgress Hook - Real-time SSE Mode (CNS Dashboard)
 *
 * Subscribe to enrichment progress events via Server-Sent Events (SSE).
 * Uses Redis Pub/Sub backend for instant updates with automatic reconnection.
 *
 * REAL-TIME MODE: SSE streams with native browser reconnection
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { CNS_API_URL, getAdminAuthHeaders } from '../config/api';
import { subscribeToBom, getActiveEventSource } from '../services/sseManager';

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
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Use refs for callbacks to prevent SSE reconnection on callback changes
  const callbacksRef = useRef({
    onStarted,
    onProgress,
    onComponentCompleted,
    onComponentFailed,
    onCompleted,
    onFailed,
    onError,
  });

  // Update refs when callbacks change (but don't trigger useEffect)
  useEffect(() => {
    callbacksRef.current = {
      onStarted,
      onProgress,
      onComponentCompleted,
      onComponentFailed,
      onCompleted,
      onFailed,
      onError,
    };
  }, [onStarted, onProgress, onComponentCompleted, onComponentFailed, onCompleted, onFailed, onError]);

  const handleNewEvent = useCallback(
    (event: EnrichmentEvent) => {
      console.log('[CNS Enrichment SSE] New event:', event.event_type, event.state);

      // Update state with latest enrichment state
      setState(event.state);
      setLatestEvent(event);

      // Add to events history (keep last 100)
      setEvents(prev => {
        const exists = prev.some(e => e.event_id === event.event_id);
        if (exists) return prev;
        return [...prev, event].slice(-100);
      });

      // Call appropriate callback using refs
      switch (event.event_type) {
        case 'enrichment.started':
          callbacksRef.current.onStarted?.(event);
          break;
        case 'enrichment.progress':
          callbacksRef.current.onProgress?.(event);
          break;
        case 'enrichment.component.completed':
          if (event.payload?.component) {
            const comp = event.payload.component as ComponentEvent;
            setComponentEvents(prev => [...prev, comp].slice(-100));
            callbacksRef.current.onComponentCompleted?.(comp);
          }
          break;
        case 'enrichment.component.failed':
          if (event.payload?.component) {
            const comp = event.payload.component as ComponentEvent;
            setComponentEvents(prev => [...prev, comp].slice(-100));
            callbacksRef.current.onComponentFailed?.(comp);
          }
          break;
        case 'enrichment.completed':
          callbacksRef.current.onCompleted?.(event);
          break;
        case 'enrichment.failed':
          callbacksRef.current.onFailed?.(event);
          break;
      }

      // Auto-close on completion or failure
      if (event.state.status === 'completed' || event.state.status === 'failed') {
        // Close EventSource after a delay to allow final events to process
        setTimeout(() => {
          const es = getActiveEventSource(event.bom_id);
          if (es) {
            console.log('[CNS Enrichment SSE] Enrichment finished, closing stream (via manager)');
            es.close();
            eventSourceRef.current = null;
          }
        }, 2000);
      }
    },
    [] // No dependencies - stable callback
  );

  const refresh = useCallback(() => {
    // For SSE, reconnecting is handled automatically by EventSource
    // Just log that refresh was called
    console.log('[CNS Enrichment SSE] Refresh called - EventSource handles reconnection automatically');
  }, []);

  // Setup SSE connection
  useEffect(() => {
    if (!bomId) return;

    // Defensive guard: if an EventSource already exists for this BOM, don't create another
    if (
      eventSourceRef.current &&
      activeBomIdRef.current === bomId &&
      eventSourceRef.current.readyState !== EventSource.CLOSED
    ) {
      console.log('[CNS Enrichment SSE] EventSource already active for', bomId);
      return;
    }

    // EventSource doesn't support headers, so pass token as query param
    const authHeaders = getAdminAuthHeaders() as Record<string, string> | undefined;
    const token = authHeaders?.Authorization?.replace('Bearer ', '') || '';
    const streamUrl = `${CNS_API_URL}/enrichment/stream/${bomId}${token ? `?token=${encodeURIComponent(token)}` : ''}`;

    console.log(`[CNS Enrichment SSE] Subscribing to stream via manager: ${streamUrl.split('?')[0]}`);
    const unsubscribe = subscribeToBom(bomId, streamUrl, {
      onConnected: () => {
        console.log('[CNS Enrichment SSE] Connected to stream');
        setIsConnected(true);
        setError(null);
      },
      onMessage: (data) => {
        try {
          const event = typeof data === 'string' ? JSON.parse(data) : data;
          if (lastEventIdRef.current !== event.event_id) {
            lastEventIdRef.current = event.event_id;
            handleNewEvent(event);
          }
        } catch (err) {
          console.error('[CNS Enrichment SSE] Failed to parse event via manager:', err);
        }
      },
      onError: (err) => {
        console.error('[CNS Enrichment SSE] Connection error via manager:', err);
        setIsConnected(false);
        const errObj = new Error('SSE stream error');
        setError(errObj);
        callbacksRef.current.onError?.(errObj);
      }
    });
    activeBomIdRef.current = bomId;
    unsubscribeRef.current = unsubscribe;

    // Expose manager's EventSource for legacy code paths
    eventSourceRef.current = getActiveEventSource(bomId);

    // Cleanup on unmount
    return () => {
      console.log('[CNS Enrichment SSE] Closing stream');
      if (unsubscribeRef.current) {
        try {
          unsubscribeRef.current();
        } finally {
          unsubscribeRef.current = null;
        }
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
        activeBomIdRef.current = null;
      }
      setIsConnected(false);
    };
  }, [bomId, handleNewEvent]); // handleNewEvent is now stable, won't cause reconnects

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
