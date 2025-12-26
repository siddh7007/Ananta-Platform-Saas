/**
 * useProcessingStatus Hook
 *
 * Real-time BOM processing status hook that:
 * - Fetches initial status from API with request cancellation
 * - Subscribes to SSE for live updates with proper cleanup
 * - Provides pause/resume/cancel controls with mounted checks
 * - Maps API response to ProcessingQueueView props
 * - Provides componentQueue, riskAnalysis, componentStatus for enhanced UI
 *
 * FIXES APPLIED:
 * - Race condition prevention with AbortController
 * - EventSource memory leak fix with proper listener cleanup
 * - Double polling prevention
 * - Safe unmount handling for all async operations
 *
 * ENHANCEMENTS:
 * - Added componentQueue fetched from /boms/{bom_id}/line_items
 * - Added riskAnalysis data fetched from /risk/boms/{bom_id}
 * - Added componentStatus calculated from line items enrichment_status
 * - Added queueStats calculation for Queue Progress Grid
 * - Added alertsCount calculated from high-risk components
 *
 * DATA SOURCES:
 * - Processing status: /bom/workflow/{bom_id}/processing-status
 * - Component queue: /boms/{bom_id}/line_items (enrichment_status)
 * - Risk analysis: /risk/boms/{bom_id} (category scores, grade)
 * - Component status: Derived from line items lifecycle_status
 * - Alerts count: Count of high/critical risk components
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { cnsApi } from '@/lib/axios';
import { useOrganizationId } from '@/contexts/TenantContext';
import { createLogger } from '@/lib/utils';
import type {
  ProcessingStage,
  StageStatus,
  StageInfo,
  ComponentQueueItem,
  QueueProgressStats,
  RiskAnalysisData,
  ComponentStatusBreakdown,
} from '@/components/bom/ProcessingQueueView';

// Create logger for this hook
const log = createLogger('useProcessingStatus');

// API Response Types
export interface ProcessingStageInfoAPI {
  stage: string;
  status: string;
  progress: number;
  message?: string;
  details?: string;
  started_at?: string;
  completed_at?: string;
  items_processed?: number;
  total_items?: number;
  error_message?: string;
}

export interface ProcessingStatusAPI {
  bom_id: string;
  organization_id: string;
  workflow_id: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  current_stage: string;
  stages: Record<string, ProcessingStageInfoAPI>;
  total_items: number;
  enriched_items: number;
  failed_items: number;
  risk_scored_items: number;
  health_grade?: string;
  average_risk_score?: number;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  paused_at?: string;
  // Enhanced data for Queue Card UI
  component_queue?: ComponentQueueItemAPI[];
  component_status?: {
    production_ready: number;
    staging: number;
    needs_review: number;
    not_found: number;
  };
  risk_analysis?: {
    status: 'pending' | 'analyzing' | 'complete';
    items_analyzed: number;
    total_items: number;
    overall_score?: number;
    grade?: 'A' | 'B' | 'C' | 'D' | 'F';
    high_risk_count: number;
    category_scores?: {
      lifecycle: number;
      supply_chain: number;
      compliance: number;
    };
  };
  alerts_count?: number;
}

/** API response type for component queue items */
export interface ComponentQueueItemAPI {
  mpn: string;
  manufacturer?: string;
  status: 'pending' | 'processing' | 'done' | 'failed';
  match_confidence?: number;
  error_message?: string;
}

/** API response type for line items (from /boms/{bom_id}/line_items) */
export interface LineItemAPI {
  id: string;
  bom_id: string;
  line_number?: number;
  manufacturer_part_number?: string;
  manufacturer?: string;
  quantity: number;
  reference_designator?: string;
  description?: string;
  enrichment_status: 'pending' | 'enriched' | 'error' | 'failed' | 'completed';
  component_id?: string;
  // Redis storage fields - indicates low-quality match stored in Redis instead of catalog
  component_storage?: 'catalog' | 'redis' | null;
  redis_component_key?: string;
  enrichment_error?: string;
  lifecycle_status?: string;
  match_confidence?: number;
  /** Risk level: low, medium, high, critical */
  risk_level?: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  updated_at: string;
}

/** API response type for line items list */
export interface LineItemsListAPI {
  items: LineItemAPI[];
  total: number;
  page: number;
  page_size: number;
  bom_id: string;
}

/** API response type for BOM risk summary (from /risk/boms/{bom_id}) */
export interface BOMRiskSummaryAPI {
  bom_id: string;
  bom_name?: string;
  project_id?: string;
  project_name?: string;
  total_line_items: number;
  low_risk_count: number;
  medium_risk_count: number;
  high_risk_count: number;
  critical_risk_count: number;
  average_risk_score: number;
  weighted_risk_score: number;
  health_grade: 'A' | 'B' | 'C' | 'D' | 'F' | 'N/A';
  score_trend: 'improving' | 'stable' | 'worsening';
  top_risk_components: Array<{
    component_id: string;
    mpn?: string;
    manufacturer?: string;
    total_risk_score: number;
    risk_level: string;
  }>;
}

/** API response type for risk statistics (from /risk/stats) */
export interface RiskStatsAPI {
  total_components: number;
  average_risk_score: number;
  risk_distribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  factor_averages: {
    lifecycle: number;
    supply_chain: number;
    compliance: number;
    obsolescence: number;
    single_source: number;
  };
  components_requiring_attention: number;
}

export interface UseProcessingStatusOptions {
  bomId: string;
  enabled?: boolean;
  pollInterval?: number; // Polling interval in ms (default: 2000 for responsive progress bars)
  onComplete?: (status: ProcessingStatusAPI) => void;
  onError?: (error: Error) => void;
}

export interface UseProcessingStatusResult {
  // Status data
  status: ProcessingStatusAPI | null;
  stages: StageInfo[];
  currentStage: ProcessingStage;
  isLoading: boolean;
  error: Error | null;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';

  // Enhanced UI data
  componentQueue: ComponentQueueItem[];
  riskAnalysis: RiskAnalysisData | null;
  componentStatus: ComponentStatusBreakdown | null;
  queueStats: QueueProgressStats;
  alertsCount: number;

  // Controls
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  cancel: () => Promise<void>;
  refresh: () => Promise<void>;

  // Computed
  isPaused: boolean;
  isComplete: boolean;
  isFailed: boolean;
  overallProgress: number;
}

// Known valid statuses for logging unknown ones
const KNOWN_STATUSES = new Set(['pending', 'in_progress', 'completed', 'failed', 'skipped', 'paused']);

/**
 * Map API stage status to component StageStatus with logging for unknown values
 */
function mapStageStatus(apiStatus: string): StageStatus {
  const statusMap: Record<string, StageStatus> = {
    'pending': 'pending',
    'in_progress': 'in_progress',
    'completed': 'completed',
    'failed': 'failed',
    'skipped': 'skipped',
    'paused': 'pending', // Paused shows as pending visually
  };

  if (!KNOWN_STATUSES.has(apiStatus)) {
    console.warn(`[useProcessingStatus] Unknown stage status: "${apiStatus}", defaulting to "pending"`);
  }

  return statusMap[apiStatus] || 'pending';
}

/**
 * Convert API response stages to StageInfo array for ProcessingQueueView
 */
function mapStagesToStageInfo(
  stages: Record<string, ProcessingStageInfoAPI>,
  status: ProcessingStatusAPI
): StageInfo[] {
  const stageOrder: ProcessingStage[] = [
    'raw_upload',
    'parsing',
    'enrichment',
    'risk_analysis',
    'complete',
  ];

  return stageOrder.map((stageName) => {
    const stageData: ProcessingStageInfoAPI = stages[stageName] || {
      stage: stageName,
      status: 'pending',
      progress: 0,
      message: undefined,
      details: undefined,
      started_at: undefined,
      completed_at: undefined,
      items_processed: undefined,
      total_items: undefined,
      error_message: undefined,
    };

    // Determine items for enrichment stage
    let itemsProcessed = stageData.items_processed;
    let totalItems = stageData.total_items;

    if (stageName === 'enrichment') {
      itemsProcessed = status.enriched_items + status.failed_items;
      totalItems = status.total_items;
    }

    return {
      stage: stageName as ProcessingStage,
      status: mapStageStatus(stageData.status),
      progress: stageData.progress || 0,
      message: stageData.message,
      details: stageData.details,
      startedAt: stageData.started_at ? new Date(stageData.started_at) : undefined,
      completedAt: stageData.completed_at ? new Date(stageData.completed_at) : undefined,
      itemsProcessed,
      totalItems,
    };
  });
}

/**
 * Map API component queue items to UI format (from direct API response)
 */
function mapComponentQueue(items?: ComponentQueueItemAPI[]): ComponentQueueItem[] {
  if (!items || items.length === 0) return [];

  return items.map((item) => ({
    mpn: item.mpn,
    manufacturer: item.manufacturer,
    status: item.status,
    matchConfidence: item.match_confidence,
    errorMessage: item.error_message,
  }));
}

/**
 * Build component queue from line items (fetch from /boms/{bom_id}/line_items)
 * Maps line item enrichment_status to queue item status
 *
 * Key Logic:
 * - Items with 'enriched' status AND component_id OR redis match -> 'done'
 * - Items with 'enriched' status but NO match -> 'failed' (no component found)
 * - Redis-stored items (component_storage === 'redis') are valid matches with lower confidence
 */
function buildComponentQueueFromLineItems(lineItems: LineItemAPI[]): ComponentQueueItem[] {
  // Sort: processing first, then pending, then failed, then done
  const sortOrder: Record<string, number> = {
    'processing': 0,
    'pending': 1,
    'failed': 2,
    'done': 3,
  };

  return lineItems
    .filter((item) => item.manufacturer_part_number) // Only items with MPN
    .map((item) => {
      // Determine if item has an actual match (catalog or Redis)
      const hasMatch = item.component_id || item.component_storage === 'redis' || item.redis_component_key;

      // Determine match confidence based on storage type
      // - Catalog match (component_id): Use API-provided confidence or 100%
      // - Redis match (redis_component_key): 75% confidence (lower quality but valid)
      // - No match: 0%
      let matchConfidence: number | undefined;
      if (item.component_id) {
        matchConfidence = item.match_confidence ?? 100;
      } else if (item.component_storage === 'redis' || item.redis_component_key) {
        matchConfidence = item.match_confidence ?? 75;
      } else {
        matchConfidence = 0;
      }

      // Determine queue status based on enrichment_status AND actual match
      let queueStatus: ComponentQueueItem['status'];
      let errorMessage = item.enrichment_error;

      if (item.enrichment_status === 'pending') {
        queueStatus = 'pending';
      } else if (item.enrichment_status === 'error' || item.enrichment_status === 'failed') {
        queueStatus = 'failed';
      } else if (item.enrichment_status === 'enriched' || item.enrichment_status === 'completed') {
        // CRITICAL: Mark as 'done' only if there's an actual match
        // Otherwise mark as 'failed' because enrichment ran but found nothing
        if (hasMatch) {
          queueStatus = 'done';
        } else {
          queueStatus = 'failed';
          errorMessage = errorMessage || 'No component match found';
        }
      } else {
        queueStatus = 'pending';
      }

      return {
        mpn: item.manufacturer_part_number || 'Unknown',
        manufacturer: item.manufacturer,
        status: queueStatus,
        matchConfidence,
        errorMessage,
        // Enhanced fields for improved display
        description: item.description,
        lifecycleStatus: item.lifecycle_status,
        riskLevel: item.risk_level,
      };
    })
    .sort((a, b) => (sortOrder[a.status] || 4) - (sortOrder[b.status] || 4))
    .slice(0, 20); // Limit to 20 items for UI performance
}

/**
 * Calculate component status breakdown from line items
 * Based on lifecycle_status, enrichment_status, and component_storage
 *
 * Key insight: Components can be enriched and stored in either:
 * - 'catalog': High-quality match in component catalog DB (has component_id)
 * - 'redis': Low-quality match stored in Redis (has redis_component_key, no component_id)
 *
 * Both are valid enrichment outcomes - Redis storage is NOT "notFound"
 */
function calculateComponentStatusFromLineItems(lineItems: LineItemAPI[]): ComponentStatusBreakdown {
  const result: ComponentStatusBreakdown = {
    productionReady: 0,
    staging: 0,
    needsReview: 0,
    notFound: 0,
  };

  for (const item of lineItems) {
    // Components that failed enrichment (error or failed status)
    if (item.enrichment_status === 'error' || item.enrichment_status === 'failed') {
      result.needsReview++;
      continue;
    }

    // Components still pending
    if (item.enrichment_status === 'pending') {
      result.staging++;
      continue;
    }

    // Check if enriched (either in catalog or Redis)
    const isEnriched = item.enrichment_status === 'enriched' || item.enrichment_status === 'completed';

    if (isEnriched) {
      // Check if component was found (either in catalog DB or Redis)
      // FIX: Ensure redis storage has actual key, not just storage type
      const hasMatch = item.component_id ||
                       (item.component_storage === 'redis' && item.redis_component_key);

      if (!hasMatch) {
        // No match found anywhere - truly not found
        result.notFound++;
        continue;
      }

      // Component was enriched with a match - check lifecycle status
      const lifecycle = item.lifecycle_status?.toLowerCase() || '';

      if (lifecycle === 'active' || lifecycle === 'production') {
        result.productionReady++;
      } else if (lifecycle === 'nrnd' || lifecycle === 'not recommended' || lifecycle === 'eol') {
        result.needsReview++;
      } else if (lifecycle === 'obsolete' || lifecycle === 'discontinued') {
        result.needsReview++;
      } else {
        // Unknown lifecycle, Redis-stored items, or pending review
        // Redis-stored items (low-quality matches) go to staging for review
        if (item.component_storage === 'redis') {
          result.staging++;
        } else {
          result.staging++;
        }
      }
    }
  }

  return result;
}

/**
 * Map API risk analysis data to UI format (from direct processing status)
 */
function mapRiskAnalysis(data?: ProcessingStatusAPI['risk_analysis']): RiskAnalysisData | null {
  if (!data) return null;

  return {
    status: data.status,
    itemsAnalyzed: data.items_analyzed,
    totalItems: data.total_items,
    overallScore: data.overall_score,
    grade: data.grade,
    highRiskCount: data.high_risk_count,
    categoryScores: data.category_scores
      ? {
          lifecycle: data.category_scores.lifecycle,
          supplyChain: data.category_scores.supply_chain,
          compliance: data.category_scores.compliance,
        }
      : undefined,
  };
}

/**
 * Build risk analysis data from BOM risk summary API response
 * Combines BOM risk summary and risk stats for complete picture
 *
 * IMPORTANT: Risk analysis data should only show itemsAnalyzed > 0 when
 * the risk_analysis stage has actually started or completed. Before that,
 * we should show 0 items analyzed to avoid misleading the user.
 */
function buildRiskAnalysisFromAPI(
  bomRisk: BOMRiskSummaryAPI | null,
  riskStats: RiskStatsAPI | null,
  processingStatus: ProcessingStatusAPI | null
): RiskAnalysisData | null {
  // Determine status based on processing status
  let riskStatus: 'pending' | 'analyzing' | 'complete' = 'pending';
  let hasRiskAnalysisStarted = false;

  if (processingStatus) {
    if (processingStatus.current_stage === 'risk_analysis') {
      riskStatus = 'analyzing';
      hasRiskAnalysisStarted = true;
    } else if (
      processingStatus.current_stage === 'complete' ||
      processingStatus.status === 'completed'
    ) {
      riskStatus = 'complete';
      hasRiskAnalysisStarted = true;
    }
    // For any earlier stage (raw_upload, parsing, enrichment), risk analysis hasn't started
  }

  // If no BOM risk data but we have processing status, return minimal data
  if (!bomRisk) {
    return {
      status: riskStatus,
      // Only show risk_scored_items if risk analysis has actually started
      itemsAnalyzed: hasRiskAnalysisStarted ? (processingStatus?.risk_scored_items || 0) : 0,
      totalItems: processingStatus?.total_items || 0,
      overallScore: hasRiskAnalysisStarted ? processingStatus?.average_risk_score : undefined,
      grade: hasRiskAnalysisStarted ? (processingStatus?.health_grade as 'A' | 'B' | 'C' | 'D' | 'F' | undefined) : undefined,
      highRiskCount: 0,
      categoryScores: hasRiskAnalysisStarted && riskStats?.factor_averages
        ? {
            lifecycle: Math.round(riskStats.factor_averages.lifecycle),
            supplyChain: Math.round(riskStats.factor_averages.supply_chain),
            compliance: Math.round(riskStats.factor_averages.compliance),
          }
        : undefined,
    };
  }

  // Build complete risk analysis from BOM risk summary
  // Only populate itemsAnalyzed if risk analysis has started, otherwise show 0
  return {
    status: riskStatus,
    itemsAnalyzed: hasRiskAnalysisStarted ? bomRisk.total_line_items : 0,
    totalItems: bomRisk.total_line_items,
    overallScore: hasRiskAnalysisStarted ? bomRisk.average_risk_score : undefined,
    grade: hasRiskAnalysisStarted && bomRisk.health_grade !== 'N/A' ? bomRisk.health_grade : undefined,
    highRiskCount: hasRiskAnalysisStarted ? (bomRisk.high_risk_count + bomRisk.critical_risk_count) : 0,
    categoryScores: hasRiskAnalysisStarted && riskStats?.factor_averages
      ? {
          lifecycle: Math.round(riskStats.factor_averages.lifecycle),
          supplyChain: Math.round(riskStats.factor_averages.supply_chain),
          compliance: Math.round(riskStats.factor_averages.compliance),
        }
      : undefined,
  };
}

/**
 * Calculate alerts count from risk data
 * Alerts = high risk + critical risk components
 */
function calculateAlertsCount(bomRisk: BOMRiskSummaryAPI | null, riskStats: RiskStatsAPI | null): number {
  if (bomRisk) {
    return bomRisk.high_risk_count + bomRisk.critical_risk_count;
  }
  if (riskStats) {
    return riskStats.risk_distribution.high + riskStats.risk_distribution.critical;
  }
  return 0;
}

/**
 * Map API component status to UI format
 */
function mapComponentStatus(data?: ProcessingStatusAPI['component_status']): ComponentStatusBreakdown | null {
  if (!data) return null;

  return {
    productionReady: data.production_ready,
    staging: data.staging,
    needsReview: data.needs_review,
    notFound: data.not_found,
  };
}

/**
 * Calculate queue stats from stages
 */
function calculateQueueStats(stages: StageInfo[]): QueueProgressStats {
  const pending = stages.filter((s) => s.status === 'pending').length;
  const processing = stages.filter((s) => s.status === 'in_progress').length;
  const completed = stages.filter((s) => s.status === 'completed').length;
  const failed = stages.filter((s) => s.status === 'failed').length;
  const total = stages.filter((s) => s.status !== 'skipped').length;
  const successRate =
    total > 0 && completed + failed > 0
      ? Math.round((completed / (completed + failed)) * 100)
      : 0;

  return { pending, processing, completed, failed, total, successRate };
}

export function useProcessingStatus(
  options: UseProcessingStatusOptions
): UseProcessingStatusResult {
  const { bomId, enabled = true, pollInterval = 2000, onComplete, onError } = options;

  // CRITICAL: Get organization_id for CNS API calls (tenant_id = organization_id in our architecture)
  const organizationId = useOrganizationId();

  const [status, setStatus] = useState<ProcessingStatusAPI | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    'connecting' | 'connected' | 'disconnected' | 'error'
  >('connecting');

  // Enhanced data state - fetched separately from processing status
  const [lineItems, setLineItems] = useState<LineItemAPI[]>([]);
  const [bomRiskData, setBomRiskData] = useState<BOMRiskSummaryAPI | null>(null);
  const [riskStats, setRiskStats] = useState<RiskStatsAPI | null>(null);

  // Refs for cleanup and state management
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const enhancedPollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const sseCleanupRef = useRef<(() => void) | null>(null);
  const enhancedDataFetchedRef = useRef(false);

  // Stable refs for callbacks to avoid dependency issues
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
  }, [onComplete, onError]);

  /**
   * Stop polling - defined first as it's used by other functions
   */
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (enhancedPollIntervalRef.current) {
      clearInterval(enhancedPollIntervalRef.current);
      enhancedPollIntervalRef.current = null;
    }
  }, []);

  /**
   * Fetch current status from API with AbortController for race condition prevention
   */
  const fetchStatus = useCallback(async (signal?: AbortSignal) => {
    if (!bomId || !enabled) {
      log.debug('Skipping status fetch', { bomId, enabled });
      return;
    }

    // Ensure organization_id is available
    if (!organizationId) {
      const err = new Error('No organization selected. Please select a workspace.');
      log.error('Missing organization ID', err, { bomId });
      if (mountedRef.current) {
        setError(err);
        setIsLoading(false);
      }
      onErrorRef.current?.(err);
      return;
    }

    log.debug('Fetching processing status', { bomId, organizationId });

    try {
      // CRITICAL: Pass organization_id as query parameter (CNS API requirement)
      const response = await cnsApi.get<ProcessingStatusAPI>(
        `/bom/workflow/${bomId}/processing-status`,
        {
          params: { organization_id: organizationId },
          signal,
        }
      );

      // Check if request was aborted
      if (signal?.aborted) {
        log.debug('Request aborted', { bomId });
        return;
      }

      if (mountedRef.current) {
        const prevStage = status?.current_stage;
        const newStage = response.data.current_stage;

        // Log stage transitions
        if (prevStage !== newStage) {
          log.info('Stage transition', {
            bomId,
            from: prevStage || 'none',
            to: newStage,
            status: response.data.status,
          });
        }

        // Log progress updates
        log.debug('Status update received', {
          bomId,
          stage: newStage,
          status: response.data.status,
          enriched: response.data.enriched_items,
          failed: response.data.failed_items,
          total: response.data.total_items,
        });

        setStatus(response.data);
        setError(null);
        setIsLoading(false);

        // Check for completion or terminal states - stop polling when done
        const terminalStates = ['completed', 'failed', 'cancelled'];
        if (terminalStates.includes(response.data.status)) {
          log.info('Processing reached terminal state', {
            bomId,
            status: response.data.status,
            enriched: response.data.enriched_items,
            failed: response.data.failed_items,
            healthGrade: response.data.health_grade,
          });
          stopPolling();
          setConnectionStatus('disconnected');
          if (response.data.status === 'completed') {
            onCompleteRef.current?.(response.data);
          }
        }
      }
    } catch (err) {
      // Ignore aborted requests
      if (err instanceof Error && err.name === 'AbortError') {
        log.debug('Request aborted by signal', { bomId });
        return;
      }
      // Ignore cancelled requests from axios
      if ((err as { code?: string })?.code === 'ERR_CANCELED') {
        log.debug('Request cancelled by axios', { bomId });
        return;
      }

      if (mountedRef.current) {
        const error = err instanceof Error ? err : new Error('Failed to fetch status');
        log.error('Failed to fetch processing status', error, { bomId, organizationId });
        setError(error);
        setIsLoading(false);
        onErrorRef.current?.(error);
      }
    }
  }, [bomId, enabled, organizationId, stopPolling, status?.current_stage]);

  /**
   * Fetch enhanced data: line items, BOM risk summary, and risk stats
   * This data is used to calculate componentQueue, componentStatus, riskAnalysis locally
   */
  const fetchEnhancedData = useCallback(async (signal?: AbortSignal) => {
    if (!bomId || !enabled || !organizationId) {
      log.debug('Skipping enhanced data fetch', { bomId, enabled, organizationId: !!organizationId });
      return;
    }

    log.debug('Fetching enhanced data', { bomId });

    // Fetch all enhanced data in parallel
    const fetchLineItems = async () => {
      try {
        // Fetch line items with enrichment status
        const response = await cnsApi.get<LineItemsListAPI | LineItemAPI[]>(
          `/boms/${bomId}/line_items`,
          {
            params: { organization_id: organizationId, page_size: 100 },
            signal,
          }
        );

        if (signal?.aborted) return;

        if (mountedRef.current) {
          // Handle both array and paginated response formats
          const items = Array.isArray(response.data) ? response.data : response.data.items;
          log.debug('Line items fetched', { bomId, count: items?.length || 0 });
          setLineItems(items || []);
        }
      } catch (err) {
        // Silently ignore aborted/canceled requests - they're expected during navigation
        const isCanceled = (err instanceof Error && err.name === 'AbortError') ||
                          (err as { code?: string })?.code === 'ERR_CANCELED';
        if (!isCanceled) {
          log.warn('Failed to fetch line items', { bomId, error: err instanceof Error ? err.message : String(err) });
        }
      }
    };

    const fetchBomRisk = async () => {
      try {
        // Fetch BOM risk summary
        const response = await cnsApi.get<BOMRiskSummaryAPI>(
          `/risk/boms/${bomId}`,
          {
            params: { organization_id: organizationId },
            signal,
          }
        );

        if (signal?.aborted) return;

        if (mountedRef.current) {
          log.debug('BOM risk data fetched', {
            bomId,
            grade: response.data.health_grade,
            avgScore: response.data.average_risk_score,
          });
          setBomRiskData(response.data);
        }
      } catch (err) {
        // Silently ignore aborted/canceled requests and 404 (risk analysis hasn't run yet)
        const isCanceled = (err instanceof Error && err.name === 'AbortError') ||
                          (err as { code?: string })?.code === 'ERR_CANCELED';
        const is404 = (err as { response?: { status?: number } })?.response?.status === 404;
        if (!isCanceled && !is404) {
          log.warn('Failed to fetch BOM risk', { bomId, error: err instanceof Error ? err.message : String(err) });
        }
      }
    };

    const fetchRiskStats = async () => {
      try {
        // Fetch risk statistics for category scores
        const response = await cnsApi.get<RiskStatsAPI>(
          `/risk/stats`,
          {
            params: { organization_id: organizationId },
            signal,
          }
        );

        if (signal?.aborted) return;

        if (mountedRef.current) {
          log.debug('Risk stats fetched', {
            totalComponents: response.data.total_components,
            avgScore: response.data.average_risk_score,
          });
          setRiskStats(response.data);
        }
      } catch (err) {
        // Silently ignore aborted/canceled requests - risk stats are optional
        const isCanceled = (err instanceof Error && err.name === 'AbortError') ||
                          (err as { code?: string })?.code === 'ERR_CANCELED';
        if (!isCanceled) {
          log.warn('Failed to fetch risk stats', { error: err instanceof Error ? err.message : String(err) });
        }
      }
    };

    // Run all fetches in parallel
    await Promise.all([fetchLineItems(), fetchBomRisk(), fetchRiskStats()]);
    log.debug('Enhanced data fetch complete', { bomId });
    enhancedDataFetchedRef.current = true;
  }, [bomId, enabled, organizationId]);

  /**
   * Start polling fallback - prevents double polling
   * Also starts enhanced data polling at 3x the interval for component queue updates
   *
   * FIX: Removed abortControllerRef assignment inside interval to prevent stale closure issues
   * Each poll request uses its own local controller that isn't stored in the ref
   */
  const startPolling = useCallback(() => {
    // Clear any existing interval first to prevent duplicates
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    if (enhancedPollIntervalRef.current) {
      clearInterval(enhancedPollIntervalRef.current);
    }

    log.info('Starting polling', { bomId, pollInterval });

    // Poll processing status at the configured interval
    // Note: Each poll uses a local controller - not stored in ref to avoid stale closures
    pollIntervalRef.current = setInterval(() => {
      if (mountedRef.current) {
        const controller = new AbortController();
        // Don't assign to abortControllerRef here - prevents stale closure issues
        fetchStatus(controller.signal);
      }
    }, pollInterval);

    // Poll enhanced data (line items, risk) at 3x the interval
    // This keeps the component queue updated during enrichment
    const enhancedPollInterval = Math.max(pollInterval * 3, 5000); // At least 5 seconds
    log.debug('Enhanced data polling interval', { enhancedPollInterval });
    enhancedPollIntervalRef.current = setInterval(() => {
      if (mountedRef.current) {
        const controller = new AbortController();
        fetchEnhancedData(controller.signal);
      }
    }, enhancedPollInterval);
  }, [fetchStatus, fetchEnhancedData, pollInterval, bomId]);

  /**
   * Setup SSE connection for real-time updates with proper cleanup
   */
  const setupSSE = useCallback(() => {
    if (!bomId || !enabled) {
      log.debug('Skipping SSE setup', { bomId, enabled });
      return;
    }

    // Ensure organization_id is available
    if (!organizationId) {
      log.warn('Cannot setup SSE - no organization ID');
      setConnectionStatus('error');
      return;
    }

    // Clean up existing SSE connection and listeners
    if (sseCleanupRef.current) {
      sseCleanupRef.current();
      sseCleanupRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    log.info('Setting up SSE connection', { bomId });
    setConnectionStatus('connecting');

    try {
      const baseUrl = import.meta.env.VITE_CNS_API_URL || 'http://localhost:27200/api';
      // CRITICAL: URL-encode parameters to prevent injection attacks
      const sseUrl = `${baseUrl}/bom/workflow/${encodeURIComponent(bomId)}/processing-stream?organization_id=${encodeURIComponent(organizationId)}`;

      const eventSource = new EventSource(sseUrl);
      eventSourceRef.current = eventSource;

      // Define handlers as named functions for proper removal
      const handleConnected = () => {
        if (mountedRef.current) {
          log.info('SSE connected', { bomId });
          setConnectionStatus('connected');
          // Stop polling if SSE is connected
          stopPolling();
        }
      };

      const handleStatusUpdate = (event: MessageEvent) => {
        if (mountedRef.current) {
          try {
            const data = JSON.parse(event.data) as ProcessingStatusAPI;
            log.debug('SSE status update', {
              bomId,
              stage: data.current_stage,
              status: data.status,
            });
            setStatus(data);
            setError(null);

            if (data.status === 'completed') {
              log.info('SSE: Processing completed', { bomId });
              onCompleteRef.current?.(data);
            }
          } catch (e) {
            log.error('Failed to parse SSE data', e);
          }
        }
      };

      const handleError = () => {
        if (mountedRef.current) {
          log.warn('SSE connection error, falling back to polling', { bomId });
          setConnectionStatus('disconnected');
          eventSource.close();
          // Fall back to polling only if we haven't already started
          if (!pollIntervalRef.current) {
            startPolling();
          }
        }
      };

      // Add event listeners
      eventSource.addEventListener('connected', handleConnected);
      eventSource.addEventListener('status_update', handleStatusUpdate);
      // Use only onerror, not both addEventListener('error') and onerror
      eventSource.onerror = handleError;

      // Store cleanup function
      sseCleanupRef.current = () => {
        log.debug('Cleaning up SSE connection', { bomId });
        eventSource.removeEventListener('connected', handleConnected);
        eventSource.removeEventListener('status_update', handleStatusUpdate);
        eventSource.onerror = null;
        eventSource.close();
      };

    } catch (err) {
      log.error('Failed to setup SSE', err, { bomId });
      setConnectionStatus('error');
      // Fall back to polling
      if (!pollIntervalRef.current) {
        startPolling();
      }
    }
  }, [bomId, enabled, organizationId, startPolling, stopPolling]);

  /**
   * Pause processing with mounted check
   */
  const pause = useCallback(async () => {
    if (!bomId || !organizationId || !mountedRef.current) {
      log.debug('Cannot pause - missing requirements', { bomId, organizationId: !!organizationId });
      return;
    }

    log.info('Pausing processing', { bomId });

    try {
      // CRITICAL: Pass organization_id as query parameter
      await cnsApi.post(`/bom/workflow/${bomId}/pause`, null, {
        params: { organization_id: organizationId },
      });
      log.info('Processing paused successfully', { bomId });
      if (mountedRef.current) {
        const controller = new AbortController();
        await fetchStatus(controller.signal);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      const error = err instanceof Error ? err : new Error('Failed to pause');
      log.error('Failed to pause processing', error, { bomId });
      setError(error);
      onErrorRef.current?.(error);
      throw error;
    }
  }, [bomId, organizationId, fetchStatus]);

  /**
   * Resume processing with mounted check
   */
  const resume = useCallback(async () => {
    if (!bomId || !organizationId || !mountedRef.current) {
      log.debug('Cannot resume - missing requirements', { bomId, organizationId: !!organizationId });
      return;
    }

    log.info('Resuming processing', { bomId });

    try {
      // CRITICAL: Pass organization_id as query parameter
      await cnsApi.post(`/bom/workflow/${bomId}/resume`, null, {
        params: { organization_id: organizationId },
      });
      log.info('Processing resumed successfully', { bomId });
      if (mountedRef.current) {
        const controller = new AbortController();
        await fetchStatus(controller.signal);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      const error = err instanceof Error ? err : new Error('Failed to resume');
      log.error('Failed to resume processing', error, { bomId });
      setError(error);
      onErrorRef.current?.(error);
      throw error;
    }
  }, [bomId, organizationId, fetchStatus]);

  /**
   * Cancel processing with mounted check
   */
  const cancel = useCallback(async () => {
    if (!bomId || !organizationId || !mountedRef.current) {
      log.debug('Cannot cancel - missing requirements', { bomId, organizationId: !!organizationId });
      return;
    }

    log.info('Cancelling processing', { bomId });

    try {
      // CRITICAL: Pass organization_id as query parameter
      await cnsApi.post(`/bom/workflow/${bomId}/cancel`, null, {
        params: { organization_id: organizationId },
      });
      log.info('Processing cancelled successfully', { bomId });
      if (mountedRef.current) {
        const controller = new AbortController();
        await fetchStatus(controller.signal);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      const error = err instanceof Error ? err : new Error('Failed to cancel');
      log.error('Failed to cancel processing', error, { bomId });
      setError(error);
      onErrorRef.current?.(error);
      throw error;
    }
  }, [bomId, organizationId, fetchStatus]);

  /**
   * Manual refresh with abort controller
   */
  const refresh = useCallback(async () => {
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    await Promise.all([
      fetchStatus(controller.signal),
      fetchEnhancedData(controller.signal),
    ]);
  }, [fetchStatus, fetchEnhancedData]);

  // Initial fetch and polling setup
  // NOTE: SSE is disabled due to browser limitations (EventSource can't send Authorization headers)
  // Using polling-only approach for reliable progress updates
  useEffect(() => {
    mountedRef.current = true;
    enhancedDataFetchedRef.current = false;

    if (enabled && bomId) {
      // Cancel any pending request before making a new one
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Fetch processing status and enhanced data in parallel
      fetchStatus(controller.signal);
      fetchEnhancedData(controller.signal);

      // Start polling immediately (SSE disabled - doesn't work reliably with auth)
      // Poll at configured interval (default 5s) for real-time progress updates
      setConnectionStatus('connected'); // Indicate we're actively fetching
      startPolling();
    }

    return () => {
      mountedRef.current = false;

      // Cancel any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      // Stop polling
      stopPolling();

      // Clean up SSE with listeners (in case it was used)
      if (sseCleanupRef.current) {
        sseCleanupRef.current();
        sseCleanupRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [bomId, enabled, fetchStatus, fetchEnhancedData, startPolling, stopPolling]);

  // Re-fetch enhanced data when processing stage changes to enrichment or risk_analysis
  // This ensures we have fresh data as components are being processed
  const currentStageValue = status?.current_stage;
  useEffect(() => {
    if (!currentStageValue || !enabled || !bomId || !organizationId) return;

    const shouldRefetch =
      currentStageValue === 'enrichment' ||
      currentStageValue === 'risk_analysis' ||
      currentStageValue === 'complete';

    if (shouldRefetch && enhancedDataFetchedRef.current) {
      // Cancel any pending enhanced data fetch before starting new one
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller; // Store for cleanup
      fetchEnhancedData(controller.signal);
    }
  }, [currentStageValue, enabled, bomId, organizationId, fetchEnhancedData]);

  // Compute derived values with useMemo to prevent unnecessary recalculations
  const stages = useMemo(() => {
    return status ? mapStagesToStageInfo(status.stages, status) : [];
  }, [status]);

  const currentStage = (status?.current_stage || 'raw_upload') as ProcessingStage;
  const isPaused = status?.status === 'paused';
  const isComplete = status?.status === 'completed';
  const isFailed = status?.status === 'failed';

  // Calculate overall progress with safety check for division by zero
  const overallProgress = useMemo(() => {
    const completedStages = stages.filter((s) => s.status === 'completed').length;
    const totalStages = stages.filter((s) => s.status !== 'skipped').length;
    return totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;
  }, [stages]);

  // Build component queue from line items if not provided directly by API
  // Priority: API response > calculated from line items
  const componentQueue = useMemo(() => {
    // First try to use data from processing status API
    if (status?.component_queue && status.component_queue.length > 0) {
      return mapComponentQueue(status.component_queue);
    }
    // Fall back to building from line items
    if (lineItems.length > 0) {
      return buildComponentQueueFromLineItems(lineItems);
    }
    return [];
  }, [status?.component_queue, lineItems]);

  // Build risk analysis from BOM risk data and risk stats
  // Priority: API response > calculated from risk endpoints
  const riskAnalysis = useMemo(() => {
    // First try to use data from processing status API
    if (status?.risk_analysis) {
      return mapRiskAnalysis(status.risk_analysis);
    }
    // Fall back to building from risk endpoints
    return buildRiskAnalysisFromAPI(bomRiskData, riskStats, status);
  }, [status?.risk_analysis, status, bomRiskData, riskStats]);

  // Calculate component status from line items
  // Priority: API response > calculated from line items
  const componentStatus = useMemo(() => {
    // First try to use data from processing status API
    if (status?.component_status) {
      return mapComponentStatus(status.component_status);
    }
    // Fall back to calculating from line items
    if (lineItems.length > 0) {
      return calculateComponentStatusFromLineItems(lineItems);
    }
    return null;
  }, [status?.component_status, lineItems]);

  const queueStats = useMemo(() => {
    return calculateQueueStats(stages);
  }, [stages]);

  // Calculate alerts count from risk data
  // Priority: API response > calculated from risk endpoints
  const alertsCount = useMemo(() => {
    if (status?.alerts_count !== undefined) {
      return status.alerts_count;
    }
    return calculateAlertsCount(bomRiskData, riskStats);
  }, [status?.alerts_count, bomRiskData, riskStats]);

  return {
    status,
    stages,
    currentStage,
    isLoading,
    error,
    connectionStatus,
    // Enhanced UI data
    componentQueue,
    riskAnalysis,
    componentStatus,
    queueStats,
    alertsCount,
    // Controls
    pause,
    resume,
    cancel,
    refresh,
    // Computed
    isPaused,
    isComplete,
    isFailed,
    overallProgress,
  };
}

export default useProcessingStatus;
