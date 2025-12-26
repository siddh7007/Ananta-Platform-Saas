/**
 * useEnrichmentData Hook
 *
 * Handles data fetching and filtering for enrichment monitor.
 * Part of the split useEnrichmentMonitor hook.
 *
 * @module hooks/enrichment-monitor/useEnrichmentData
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTenant } from '../../contexts/TenantContext';
import { useNotification } from '../../contexts/NotificationContext';
import { useDebouncedCallback, useDeduplicatedFetch } from '../index';
import { CNS_API_URL, getAuthHeaders } from '../../config/api';

// ============================================================
// Types
// ============================================================

export type SourceFilter = 'all' | 'customer' | 'staff';
export type StatusFilter = 'all' | 'pending' | 'enriching' | 'completed' | 'failed';

export interface Enrichment {
  bom_id: string;
  bom_name?: string;
  bom_filename?: string;
  source: 'customer' | 'staff' | 'unknown';
  tenant_id?: string;
  project_id?: string;
  status: string;
  total_items: number;
  enriched_items: number;
  failed_items: number;
  percent_complete: number;
  started_at?: string;
  completed_at?: string;
  workflow_id?: string;
}

export interface EnrichmentStatsData {
  total: number;
  enriching: number;
  completed: number;
  failed: number;
  customer: number;
  staff: number;
}

export interface UseEnrichmentDataOptions {
  refreshIntervalMs?: number;
}

export interface UseEnrichmentDataReturn {
  // Data
  enrichments: Enrichment[];
  allEnrichments: Enrichment[];
  stats: EnrichmentStatsData;
  loading: boolean;
  loadError: string | null;

  // Filters
  sourceFilter: SourceFilter;
  statusFilter: StatusFilter;
  setSourceFilter: (filter: SourceFilter) => void;
  setStatusFilter: (filter: StatusFilter) => void;

  // Refresh
  handleRefresh: () => void;
  loadEnrichments: (options?: { showSpinner?: boolean }) => Promise<void>;
}

const DEFAULT_REFRESH_INTERVAL_MS = 30_000;

// ============================================================
// Hook Implementation
// ============================================================

export function useEnrichmentData(options: UseEnrichmentDataOptions = {}): UseEnrichmentDataReturn {
  const { refreshIntervalMs = DEFAULT_REFRESH_INTERVAL_MS } = options;

  // Context
  const { tenantId, adminModeAllTenants } = useTenant();
  const { showError } = useNotification();

  // Core state
  const [allEnrichments, setAllEnrichments] = useState<Enrichment[]>([]);
  const [enrichments, setEnrichments] = useState<Enrichment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filter state
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Request deduplication
  const { execute: dedupeExecute, isPending } = useDeduplicatedFetch();

  // ============================================================
  // Filter Logic
  // ============================================================

  const applyFilters = useCallback(
    (items: Enrichment[]): Enrichment[] => {
      let filtered = items;
      if (sourceFilter !== 'all') {
        filtered = filtered.filter((e) => e.source === sourceFilter);
      }
      if (statusFilter !== 'all') {
        filtered = filtered.filter((e) => e.status === statusFilter);
      }
      return filtered;
    },
    [sourceFilter, statusFilter]
  );

  // ============================================================
  // API Response Mapping
  // ============================================================

  const mapApiResponse = useCallback((records: unknown[]): Enrichment[] => {
    if (!records || !Array.isArray(records)) return [];

    return records.map((item: Record<string, unknown>) => {
      const rawTotal = (item.total_items ?? item.component_count ?? 0) as number | string;
      const totalItems = typeof rawTotal === 'number' ? rawTotal : parseInt(rawTotal as string, 10) || 0;
      const percentCompleteRaw =
        typeof item.percent_complete === 'number'
          ? item.percent_complete
          : parseFloat((item.percent_complete as string) || '0');
      const percentComplete = Number.isFinite(percentCompleteRaw) ? percentCompleteRaw : 0;
      const rawEnriched = item.enriched_items as number | string | null | undefined;
      const enrichedItems =
        typeof rawEnriched === 'number'
          ? rawEnriched
          : rawEnriched != null
            ? parseInt(rawEnriched as string, 10) || 0
            : Math.round(totalItems * (percentComplete / 100));
      const rawFailed = item.failed_items as number | string | null | undefined;
      const failedItems =
        typeof rawFailed === 'number' ? rawFailed : rawFailed != null ? parseInt(rawFailed as string, 10) || 0 : 0;
      const completedAt =
        (item.completed_at as string | undefined) ?? (percentComplete >= 100 ? (item.started_at as string) : undefined);

      return {
        bom_id: item.bom_id as string,
        bom_name: item.bom_name as string | undefined,
        bom_filename: item.bom_filename as string | undefined,
        source: item.source === 'customer' || item.source === 'staff' ? item.source : 'unknown',
        tenant_id: item.tenant_id as string | undefined,
        project_id: item.project_id as string | undefined,
        status: (item.status as string) ?? 'unknown',
        total_items: totalItems,
        enriched_items: enrichedItems,
        failed_items: failedItems,
        percent_complete: percentComplete || 0,
        started_at: item.started_at as string | undefined,
        completed_at: completedAt,
        workflow_id: item.workflow_id as string | undefined,
      } as Enrichment;
    });
  }, []);

  // ============================================================
  // API Calls
  // ============================================================

  const loadFromApi = useCallback(async (): Promise<Enrichment[] | null> => {
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (!adminModeAllTenants && tenantId) {
        params.set('tenant_id', tenantId);
      }

      const headers: Record<string, string> = { Accept: 'application/json' };
      const authHeaders = getAuthHeaders();
      if (authHeaders) {
        if (authHeaders instanceof Headers) {
          authHeaders.forEach((value, key) => {
            headers[key] = value;
          });
        } else if (Array.isArray(authHeaders)) {
          authHeaders.forEach(([key, value]) => {
            headers[key] = value;
          });
        } else {
          Object.assign(headers, authHeaders as Record<string, string>);
        }
      }

      const response = await fetch(`${CNS_API_URL}/admin/enrichment?${params.toString()}`, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`Admin enrichment request failed (${response.status})`);
      }

      const payload = await response.json();
      return mapApiResponse(payload);
    } catch (error) {
      console.error('[useEnrichmentData] API load failed:', error);
      setLoadError('Failed to load enrichment data from CNS API.');
      showError('Failed to load enrichment data from CNS API.');
      return null;
    }
  }, [adminModeAllTenants, tenantId, mapApiResponse, showError]);

  // ============================================================
  // Load Enrichments
  // ============================================================

  const loadEnrichments = useCallback(
    async (opts: { showSpinner?: boolean } = {}) => {
      const { showSpinner = true } = opts;
      if (showSpinner) {
        setLoading(true);
      }

      try {
        const apiList = await loadFromApi();
        if (apiList) {
          setLoadError(null);
          setAllEnrichments(apiList);
          const filtered = applyFilters(apiList);
          setEnrichments(filtered);
        } else {
          setAllEnrichments([]);
          setEnrichments([]);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load enrichment data.';
        console.error('[useEnrichmentData] Error loading enrichments:', error);
        setLoadError(message);
        showError(message);
      } finally {
        if (showSpinner) {
          setLoading(false);
        }
      }
    },
    [loadFromApi, applyFilters, showError]
  );

  // ============================================================
  // Debounced Refresh
  // ============================================================

  const handleRefresh = useDebouncedCallback(() => {
    if (isPending('enrichments')) {
      return;
    }

    void dedupeExecute({ key: 'enrichments', minInterval: 1000 }, async () => {
      await loadEnrichments();
    });
  }, 300);

  // ============================================================
  // Effects
  // ============================================================

  // Initial load
  useEffect(() => {
    void loadEnrichments();
  }, [loadEnrichments]);

  // Re-apply filters when they change
  useEffect(() => {
    setEnrichments(applyFilters(allEnrichments));
  }, [allEnrichments, applyFilters]);

  // Auto-refresh interval
  useEffect(() => {
    const interval = setInterval(() => {
      loadEnrichments({ showSpinner: false }).catch((error) => {
        console.error('[useEnrichmentData] Background refresh failed:', error);
      });
    }, refreshIntervalMs);

    return () => clearInterval(interval);
  }, [loadEnrichments, refreshIntervalMs]);

  // ============================================================
  // Stats Calculation
  // ============================================================

  const stats: EnrichmentStatsData = useMemo(
    () => ({
      total: allEnrichments.length,
      enriching: allEnrichments.filter((e) => e.status === 'enriching').length,
      completed: allEnrichments.filter((e) => e.status === 'completed').length,
      failed: allEnrichments.filter((e) => e.status === 'failed').length,
      customer: allEnrichments.filter((e) => e.source === 'customer').length,
      staff: allEnrichments.filter((e) => e.source === 'staff').length,
    }),
    [allEnrichments]
  );

  return {
    // Data
    enrichments,
    allEnrichments,
    stats,
    loading,
    loadError,

    // Filters
    sourceFilter,
    statusFilter,
    setSourceFilter,
    setStatusFilter,

    // Refresh
    handleRefresh,
    loadEnrichments,
  };
}

export default useEnrichmentData;
