/**
 * useEnrichmentQueue Hook - Component-Level Enrichment Progress
 *
 * Fetches and tracks individual component enrichment events from the database.
 * Provides per-component status for queue display.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../providers/dataProvider';

// Component enrichment status
export type ComponentEnrichmentStatus =
  | 'pending'
  | 'enriching'
  | 'enriched'
  | 'failed'
  | 'not_found';

// Analysis status
export type AnalysisStatus =
  | 'pending'
  | 'analyzing'
  | 'completed'
  | 'failed';

// Individual component in the queue
export interface EnrichmentQueueComponent {
  id: string;
  mpn: string;
  manufacturer?: string;
  status: ComponentEnrichmentStatus;
  qualityScore?: number;
  errorMessage?: string;
  enrichedAt?: string;
  supplier?: string;
}

// Enrichment event from database
export interface EnrichmentEvent {
  id: string;
  event_id: string;
  event_type: string;
  bom_id: string;
  state: {
    status: string;
    total_items: number;
    enriched_items: number;
    failed_items: number;
    not_found_items?: number;
    pending_items: number;
    percent_complete: number;
    current_batch?: number;
    total_batches?: number;
  };
  payload: {
    component?: {
      mpn: string;
      manufacturer?: string;
      line_item_id: string;
    };
    enrichment?: {
      quality_score?: number;
      supplier?: string;
    };
    error?: string;
    // Analysis event payload fields
    risk_score?: number;
    items_analyzed?: number;
    total_items?: number;
  };
  created_at: string;
}

// Queue metrics
export interface EnrichmentQueueMetrics {
  total: number;
  pending: number;
  enriching: number;
  enriched: number;
  failed: number;
  notFound: number;
  percentComplete: number;
}

// Analysis metrics
export interface AnalysisQueueMetrics {
  status: AnalysisStatus;
  startedAt?: string;
  completedAt?: string;
  riskScore?: number;
  itemsAnalyzed?: number;
}

export interface UseEnrichmentQueueOptions {
  bomId: string;
  /** Poll interval in ms (default: 3000) */
  pollInterval?: number;
  /** Whether to fetch events (default: true) */
  enabled?: boolean;
  /** Callback when a component is enriched */
  onComponentEnriched?: (component: EnrichmentQueueComponent) => void;
  /** Callback when enrichment completes */
  onCompleted?: () => void;
}

export interface UseEnrichmentQueueReturn {
  /** All components in the queue */
  components: EnrichmentQueueComponent[];
  /** Recent events (for activity feed) */
  events: EnrichmentEvent[];
  /** Queue metrics */
  metrics: EnrichmentQueueMetrics;
  /** Analysis status */
  analysisMetrics: AnalysisQueueMetrics;
  /** Whether currently polling */
  isPolling: boolean;
  /** Any errors */
  error: Error | null;
  /** Force refresh */
  refresh: () => void;
}

/**
 * Hook to track individual component enrichment progress
 */
export function useEnrichmentQueue(
  options: UseEnrichmentQueueOptions
): UseEnrichmentQueueReturn {
  const {
    bomId,
    pollInterval = 3000,
    enabled = true,
    onComponentEnriched,
    onCompleted,
  } = options;

  const [components, setComponents] = useState<EnrichmentQueueComponent[]>([]);
  const [events, setEvents] = useState<EnrichmentEvent[]>([]);
  const [metrics, setMetrics] = useState<EnrichmentQueueMetrics>({
    total: 0,
    pending: 0,
    enriching: 0,
    enriched: 0,
    failed: 0,
    notFound: 0,
    percentComplete: 0,
  });
  const [analysisMetrics, setAnalysisMetrics] = useState<AnalysisQueueMetrics>({
    status: 'pending',
  });
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const processedEventsRef = useRef<Set<string>>(new Set());
  const callbackRefs = useRef({ onComponentEnriched, onCompleted });
  const lastBomIdRef = useRef<string | null>(null);

  // Update callback refs
  useEffect(() => {
    callbackRefs.current = { onComponentEnriched, onCompleted };
  });

  // Reset state when bomId changes
  useEffect(() => {
    if (bomId !== lastBomIdRef.current) {
      console.log(`[EnrichmentQueue] BOM ID changed: ${lastBomIdRef.current} -> ${bomId}`);
      lastBomIdRef.current = bomId;

      // Clear processed events for new BOM
      processedEventsRef.current.clear();

      // Reset state
      setComponents([]);
      setEvents([]);
      setMetrics({
        total: 0,
        pending: 0,
        enriching: 0,
        enriched: 0,
        failed: 0,
        notFound: 0,
        percentComplete: 0,
      });
      setAnalysisMetrics({ status: 'pending' });
      setError(null);
    }
  }, [bomId]);

  // Fetch line items for component list
  const fetchComponents = useCallback(async (): Promise<boolean> => {
    if (!bomId) {
      console.debug('[EnrichmentQueue] Skipping fetch - no bomId');
      return false;
    }

    try {
      console.debug(`[EnrichmentQueue] Fetching components for BOM ${bomId}`);

      // Note: Column names in bom_line_items table:
      // - manufacturer_part_number (not mpn)
      // - specifications (JSONB, may contain quality_score, supplier)
      // - metadata (JSONB, may contain additional data)
      // - enriched_at (timestamp)
      const { data: lineItems, error: itemsError } = await supabase
        .from('bom_line_items')
        .select('id, manufacturer_part_number, manufacturer, enrichment_status, specifications, metadata, enriched_at, updated_at')
        .eq('bom_id', bomId)
        .order('created_at', { ascending: true });

      if (itemsError) {
        console.error('[EnrichmentQueue] Failed to fetch line items:', {
          error: itemsError.message,
          code: itemsError.code,
          bomId,
        });
        setError(new Error(`Failed to fetch line items: ${itemsError.message}`));
        return false;
      }

      // Map to queue components - extract quality_score from specifications or metadata JSONB
      const queueComponents: EnrichmentQueueComponent[] = (lineItems || []).map(item => ({
        id: item.id,
        mpn: item.manufacturer_part_number || 'Unknown',
        manufacturer: item.manufacturer,
        status: mapEnrichmentStatus(item.enrichment_status),
        qualityScore: item.specifications?.quality_score ?? item.metadata?.quality_score ?? undefined,
        enrichedAt: item.enriched_at || item.updated_at,
        supplier: item.specifications?.supplier ?? item.metadata?.supplier ?? undefined,
      }));

      setComponents(queueComponents);

      // Calculate metrics
      const newMetrics: EnrichmentQueueMetrics = {
        total: queueComponents.length,
        pending: queueComponents.filter(c => c.status === 'pending').length,
        enriching: queueComponents.filter(c => c.status === 'enriching').length,
        enriched: queueComponents.filter(c => c.status === 'enriched').length,
        failed: queueComponents.filter(c => c.status === 'failed').length,
        notFound: queueComponents.filter(c => c.status === 'not_found').length,
        percentComplete: queueComponents.length > 0
          ? Math.round(
              ((queueComponents.filter(c => ['enriched', 'failed', 'not_found'].includes(c.status)).length) /
                queueComponents.length) *
                100
            )
          : 0,
      };
      setMetrics(newMetrics);

      // Only log if there's a meaningful change (reduce noise)
      if (newMetrics.total > 0 && (newMetrics.pending === 0 || newMetrics.percentComplete === 100)) {
        console.log('[EnrichmentQueue] Components complete:', {
          total: newMetrics.total,
          enriched: newMetrics.enriched,
          failed: newMetrics.failed,
        });
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('[EnrichmentQueue] Error fetching components:', {
        error: errorMessage,
        bomId,
      });
      setError(err instanceof Error ? err : new Error('Failed to fetch components'));
      return false;
    }
  }, [bomId]);

  // Fetch enrichment events for activity feed
  const fetchEvents = useCallback(async (): Promise<boolean> => {
    if (!bomId) {
      console.debug('[EnrichmentQueue] Skipping events fetch - no bomId');
      return false;
    }

    try {
      console.debug(`[EnrichmentQueue] Fetching events for BOM ${bomId}`);

      const { data: eventData, error: eventsError } = await supabase
        .from('enrichment_events')
        .select('*')
        .eq('bom_id', bomId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (eventsError) {
        // Table might not exist yet or RLS restriction - log and continue
        console.warn('[EnrichmentQueue] Could not fetch events:', {
          error: eventsError.message,
          code: eventsError.code,
          bomId,
        });
        // Don't set error state - this is not critical
        return false;
      }

      if (eventData && eventData.length > 0) {
        console.debug(`[EnrichmentQueue] Fetched ${eventData.length} events`);

        // Log risk analysis events found
        const riskEvents = eventData.filter((e: any) => e.event_type?.startsWith('risk_analysis'));
        if (riskEvents.length > 0) {
          console.log('[EnrichmentQueue] Found risk_analysis events:', riskEvents.map((e: any) => ({
            type: e.event_type,
            id: e.event_id,
            alreadyProcessed: processedEventsRef.current.has(e.event_id)
          })));
        }

        setEvents(eventData as EnrichmentEvent[]);

        // Process new events for callbacks - reverse to process oldest first (chronological order)
        // This ensures the final state reflects the most recent event
        const newEventsCount = { component: 0, analysis: 0 };
        const eventsToProcess = [...eventData].reverse(); // Oldest first

        for (const event of eventsToProcess) {
          if (!processedEventsRef.current.has(event.event_id)) {
            processedEventsRef.current.add(event.event_id);

            console.debug('[EnrichmentQueue] Processing new event:', {
              type: event.event_type,
              eventId: event.event_id,
            });

            // Handle component enrichment events
            if (event.event_type === 'enrichment.component.completed' && event.payload?.component) {
              newEventsCount.component++;
              const comp: EnrichmentQueueComponent = {
                id: event.payload.component.line_item_id,
                mpn: event.payload.component.mpn,
                manufacturer: event.payload.component.manufacturer,
                status: 'enriched',
                qualityScore: event.payload.enrichment?.quality_score,
                supplier: event.payload.enrichment?.supplier,
                enrichedAt: event.created_at,
              };
              callbackRefs.current.onComponentEnriched?.(comp);
            }

            // Handle component failed events
            if (event.event_type === 'enrichment.component.failed' && event.payload?.component) {
              newEventsCount.component++;
              console.debug('[EnrichmentQueue] Component failed:', {
                mpn: event.payload.component.mpn,
                error: event.payload.error,
              });
            }

            // Handle completion
            if (event.event_type === 'enrichment.completed') {
              console.log('[EnrichmentQueue] Enrichment completed event received');
              callbackRefs.current.onCompleted?.();
            }

            // Handle analysis events
            if (event.event_type === 'risk_analysis_started') {
              newEventsCount.analysis++;
              console.log('[EnrichmentQueue] Risk analysis started');
              setAnalysisMetrics(prev => ({
                ...prev,
                status: 'analyzing',
                startedAt: event.created_at,
              }));
            }
            if (event.event_type === 'risk_analysis_completed') {
              newEventsCount.analysis++;
              console.log('[EnrichmentQueue] 🎯 Risk analysis completed - UPDATING STATE:', {
                riskScore: event.payload?.risk_score,
                itemsAnalyzed: event.payload?.items_analyzed,
                eventId: event.event_id,
              });
              setAnalysisMetrics(prev => {
                const newState = {
                  ...prev,
                  status: 'completed' as const,
                  completedAt: event.created_at,
                  riskScore: event.payload?.risk_score,
                  itemsAnalyzed: event.payload?.items_analyzed,
                };
                console.log('[EnrichmentQueue] 📊 New analysisMetrics state:', newState);
                return newState;
              });
            }
            if (event.event_type === 'risk_analysis_failed') {
              newEventsCount.analysis++;
              console.warn('[EnrichmentQueue] Risk analysis failed:', event.payload?.error);
              setAnalysisMetrics(prev => ({
                ...prev,
                status: 'failed',
              }));
            }
          }
        }

        if (newEventsCount.component > 0 || newEventsCount.analysis > 0) {
          console.debug('[EnrichmentQueue] Processed new events:', newEventsCount);
        }
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.warn('[EnrichmentQueue] Error fetching events:', {
        error: errorMessage,
        bomId,
      });
      // Don't set error state for events - not critical
      return false;
    }
  }, [bomId]);

  // Combined fetch
  const fetchAll = useCallback(async () => {
    console.debug('[EnrichmentQueue] Fetching all data...');
    const [componentsOk, eventsOk] = await Promise.all([fetchComponents(), fetchEvents()]);

    // Only clear error if components fetched successfully (events are optional)
    if (componentsOk) {
      setError(null);
    }

    console.debug('[EnrichmentQueue] Fetch complete:', { componentsOk, eventsOk });
  }, [fetchComponents, fetchEvents]);

  // Start polling
  const startPolling = useCallback(() => {
    if (intervalRef.current) return;

    console.log(`[EnrichmentQueue] Starting polling for BOM ${bomId}`);
    setIsPolling(true);

    // Fetch immediately
    fetchAll();

    // Start interval
    intervalRef.current = setInterval(fetchAll, pollInterval);
  }, [bomId, pollInterval, fetchAll]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      console.log('[EnrichmentQueue] Stopping polling');
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      setIsPolling(false);
    }
  }, []);

  // Refresh
  const refresh = useCallback(() => {
    console.log('[EnrichmentQueue] Manual refresh');
    fetchAll();
  }, [fetchAll]);

  // Check if we should stop polling (all work is done)
  const shouldStopPolling = metrics.total > 0 &&
    metrics.pending === 0 &&
    metrics.enriching === 0 &&
    (analysisMetrics.status === 'completed' || analysisMetrics.status === 'failed');

  // Auto-start polling
  useEffect(() => {
    if (!bomId || !enabled) {
      stopPolling();
      return;
    }

    // Stop polling if all work is done
    if (shouldStopPolling) {
      console.log('[EnrichmentQueue] Stopping polling - all work complete');
      stopPolling();
      return;
    }

    startPolling();

    return () => {
      stopPolling();
    };
  }, [bomId, enabled, shouldStopPolling, startPolling, stopPolling]);

  return {
    components,
    events,
    metrics,
    analysisMetrics,
    isPolling,
    error,
    refresh,
  };
}

/**
 * Map database enrichment status to queue status
 */
function mapEnrichmentStatus(dbStatus: string | null): ComponentEnrichmentStatus {
  switch (dbStatus) {
    case 'enriched':
      return 'enriched';
    case 'failed':
      return 'failed';
    case 'not_found':
      return 'not_found';
    case 'enriching':
      return 'enriching';
    default:
      return 'pending';
  }
}

export default useEnrichmentQueue;
