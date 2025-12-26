/**
 * useEnrichmentMonitor Hook
 *
 * Manages all state and data fetching logic for the EnrichmentMonitor page:
 * - Fetches enrichment list from CNS API
 * - Manages filters (source, status)
 * - Handles line item expansion/caching
 * - Manages component detail fetching
 * - Provides stop/delete operations
 *
 * @module hooks/useEnrichmentMonitor
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTenant } from '../contexts/TenantContext';
import { useNotification } from '../contexts/NotificationContext';
import { useDebouncedCallback, useDeduplicatedFetch } from '../hooks';
import { CNS_API_URL, getAuthHeaders } from '../config/api';
import type { ComponentDetail } from '../components/shared';
import type { LineItem } from '../enrichment/EnrichmentLineItems';

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

export interface UseEnrichmentMonitorOptions {
  refreshIntervalMs?: number;
}

export interface UseEnrichmentMonitorReturn {
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

  // Selection/Progress Dialog
  selectedBomId: string | null;
  selectedBomMeta: Pick<Enrichment, 'bom_id' | 'bom_name' | 'bom_filename'> | null;
  showProgress: boolean;
  handleSelectBom: (enrichment: Enrichment) => void;
  closeProgress: () => void;

  // Line items expansion
  expandedBomId: string | null;
  lineItems: Record<string, LineItem[]>;
  lineItemsLoading: Record<string, boolean>;
  toggleExpandRow: (bomId: string) => void;
  refreshLineItems: (bomId: string) => void;

  // Component detail dialog
  detailDialogOpen: boolean;
  componentDetail: ComponentDetail | null;
  detailLoading: boolean;
  openComponentDetail: (componentId: string) => void;
  closeComponentDetail: () => void;

  // Actions
  stoppingEnrichment: string | null;
  deletingBom: string | null;
  confirmDelete: string | null;
  setConfirmDelete: (bomId: string | null) => void;
  handleStopEnrichment: (bomId: string) => Promise<void>;
  handleDeleteBom: (bomId: string) => Promise<void>;
  handleOpenBomDetail: (bomId: string) => void;
  handleNavigateAudit: (bomId: string) => void;
  handleRefresh: () => void;
}

const DEFAULT_REFRESH_INTERVAL_MS = 30_000;

// ============================================================
// Hook Implementation
// ============================================================

export function useEnrichmentMonitor(
  options: UseEnrichmentMonitorOptions = {}
): UseEnrichmentMonitorReturn {
  const { refreshIntervalMs = DEFAULT_REFRESH_INTERVAL_MS } = options;

  // Context
  const { tenantId, adminModeAllTenants } = useTenant();
  const location = useLocation();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();

  // Initial BOM ID from navigation state
  const initialBomId = (location.state as { bomId?: string } | null)?.bomId;
  const autoOpenRef = useRef(false);

  // Core state
  const [allEnrichments, setAllEnrichments] = useState<Enrichment[]>([]);
  const [enrichments, setEnrichments] = useState<Enrichment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filter state
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Selection/Progress state
  const [selectedBomId, setSelectedBomId] = useState<string | null>(null);
  const [selectedBomMeta, setSelectedBomMeta] = useState<Pick<Enrichment, 'bom_id' | 'bom_name' | 'bom_filename'> | null>(null);
  const [showProgress, setShowProgress] = useState(false);

  // Line items state
  const [expandedBomId, setExpandedBomId] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<Record<string, LineItem[]>>({});
  const [lineItemsLoading, setLineItemsLoading] = useState<Record<string, boolean>>({});

  // Component detail state
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [componentDetail, setComponentDetail] = useState<ComponentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Action state
  const [stoppingEnrichment, setStoppingEnrichment] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deletingBom, setDeletingBom] = useState<string | null>(null);

  // Request deduplication
  const { execute: dedupeExecute, isPending } = useDeduplicatedFetch();

  // ============================================================
  // Filter Logic
  // ============================================================

  const applyFilters = useCallback((items: Enrichment[]): Enrichment[] => {
    let filtered = items;
    if (sourceFilter !== 'all') {
      filtered = filtered.filter((e) => e.source === sourceFilter);
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter((e) => e.status === statusFilter);
    }
    return filtered;
  }, [sourceFilter, statusFilter]);

  // ============================================================
  // API Response Mapping
  // ============================================================

  const mapApiResponse = useCallback((records: unknown[]): Enrichment[] => {
    if (!records || !Array.isArray(records)) return [];

    return records.map((item) => {
      const rawTotal = item.total_items ?? item.component_count ?? 0;
      const totalItems = typeof rawTotal === 'number' ? rawTotal : parseInt(rawTotal, 10) || 0;
      const percentCompleteRaw = typeof item.percent_complete === 'number' ? item.percent_complete : parseFloat(item.percent_complete || '0');
      const percentComplete = Number.isFinite(percentCompleteRaw) ? percentCompleteRaw : 0;
      const rawEnriched = item.enriched_items;
      const enrichedItems = typeof rawEnriched === 'number' ? rawEnriched : rawEnriched != null ? parseInt(rawEnriched, 10) || 0 : Math.round(totalItems * (percentComplete / 100));
      const rawFailed = item.failed_items;
      const failedItems = typeof rawFailed === 'number' ? rawFailed : rawFailed != null ? parseInt(rawFailed, 10) || 0 : 0;
      const completedAt = item.completed_at ?? (percentComplete >= 100 ? item.started_at : undefined);

      return {
        bom_id: item.bom_id,
        bom_name: item.bom_name,
        bom_filename: item.bom_filename,
        source: item.source === 'customer' || item.source === 'staff' ? item.source : 'unknown',
        tenant_id: item.tenant_id,
        project_id: item.project_id,
        status: item.status ?? 'unknown',
        total_items: totalItems,
        enriched_items: enrichedItems,
        failed_items: failedItems,
        percent_complete: percentComplete || 0,
        started_at: item.started_at,
        completed_at: completedAt,
        workflow_id: item.workflow_id,
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
      console.error('[useEnrichmentMonitor] API load failed:', error);
      setLoadError('Failed to load enrichment data from CNS API.');
      showError('Failed to load enrichment data from CNS API.');
      return null;
    }
  }, [adminModeAllTenants, tenantId, mapApiResponse, showError]);

  // ============================================================
  // Selection Handlers
  // ============================================================

  const handleSelectBom = useCallback((enrichment: Enrichment) => {
    setSelectedBomId(enrichment.bom_id);
    setSelectedBomMeta({
      bom_id: enrichment.bom_id,
      bom_name: enrichment.bom_name,
      bom_filename: enrichment.bom_filename,
    });
    setShowProgress(true);
  }, []);

  const closeProgress = useCallback(() => {
    setShowProgress(false);
  }, []);

  const handleOpenBomDetail = useCallback((bomId: string) => {
    if (!bomId) {
      showError('BOM ID missing; cannot open components view.');
      return;
    }
    navigate(`/bom-jobs/${bomId}`);
  }, [navigate, showError]);

  const handleNavigateAudit = useCallback((bomId: string) => {
    navigate(`/audit-stream?bomId=${bomId}`);
  }, [navigate]);

  // ============================================================
  // Stop/Delete Actions
  // ============================================================

  const handleStopEnrichment = useCallback(async (bomId: string) => {
    try {
      setStoppingEnrichment(bomId);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      const authHeaders = getAuthHeaders();
      if (authHeaders) {
        Object.assign(headers, authHeaders as Record<string, string>);
      }

      const response = await fetch(`${CNS_API_URL}/boms/${bomId}/enrichment/stop`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          bom_id: bomId,
          reason: 'Admin stopped from CNS Dashboard',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.message || 'Failed to stop enrichment');
      }

      showSuccess('Enrichment stopped successfully');
      // Reload after short delay
      setTimeout(() => loadEnrichments({ showSpinner: false }), 1000);
    } catch (error) {
      console.error('Error stopping enrichment:', error);
      showError(`Failed to stop enrichment: ${error.message}`);
    } finally {
      setStoppingEnrichment(null);
    }
  }, [showSuccess, showError]);

  const handleDeleteBom = useCallback(async (bomId: string) => {
    try {
      setDeletingBom(bomId);

      const headers: Record<string, string> = { Accept: 'application/json' };
      const authHeaders = getAuthHeaders();
      if (authHeaders) {
        Object.assign(headers, authHeaders as Record<string, string>);
      }

      const response = await fetch(`${CNS_API_URL}/boms/${bomId}/enrichment`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.message || 'Failed to delete enrichment');
      }

      showSuccess('Enrichment deleted successfully');
      setConfirmDelete(null);
      loadEnrichments({ showSpinner: false });
    } catch (error) {
      console.error('Error deleting enrichment:', error);
      showError(`Failed to delete enrichment: ${error.message}`);
    } finally {
      setDeletingBom(null);
    }
  }, [showSuccess, showError]);

  // ============================================================
  // Load Enrichments
  // ============================================================

  const loadEnrichments = useCallback(
    async (options: { showSpinner?: boolean } = {}) => {
      const { showSpinner = true } = options;
      if (showSpinner) {
        setLoading(true);
      }

      const applyAndSet = (list: Enrichment[]) => {
        setAllEnrichments(list);
        const filtered = applyFilters(list);
        setEnrichments(filtered);

        // Auto-open BOM from navigation state
        if (!autoOpenRef.current && initialBomId) {
          const matched = list.find((e) => e.bom_id === initialBomId);
          if (matched) {
            handleSelectBom(matched);
            autoOpenRef.current = true;
          }
        }
      };

      try {
        const apiList = await loadFromApi();
        if (apiList) {
          setLoadError(null);
          applyAndSet(apiList);
        } else {
          setAllEnrichments([]);
          setEnrichments([]);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load enrichment data.';
        console.error('[useEnrichmentMonitor] Error loading enrichments:', error);
        setLoadError(message);
        showError(message);
      } finally {
        if (showSpinner) {
          setLoading(false);
        }
      }
    },
    [loadFromApi, applyFilters, initialBomId, showError, handleSelectBom]
  );

  // ============================================================
  // Line Items Logic
  // ============================================================

  const fetchLineItems = useCallback(async (bomId: string, forceRefresh = false) => {
    if (lineItems[bomId] && !forceRefresh) return;

    setLineItemsLoading((prev) => ({ ...prev, [bomId]: true }));
    try {
      const headers: Record<string, string> = {};
      const authHeaders = getAuthHeaders();
      if (authHeaders) Object.assign(headers, authHeaders as Record<string, string>);

      const res = await fetch(`${CNS_API_URL}/boms/${bomId}/line_items?page=1&page_size=500`, { headers });
      if (!res.ok) throw new Error(await res.text());

      const data = await res.json();
      const items: LineItem[] = (data.items || []).map((item: any) => ({
        id: item.id,
        bom_id: item.bom_id,
        line_number: item.line_number,
        manufacturer_part_number: item.manufacturer_part_number,
        manufacturer: item.manufacturer,
        quantity: item.quantity || 1,
        reference_designator: item.reference_designator,
        description: item.description,
        enrichment_status: item.enrichment_status || 'pending',
        component_id: item.component_id,
        enrichment_error: item.enrichment_error,
      }));

      setLineItems((prev) => ({ ...prev, [bomId]: items }));
    } catch (err) {
      console.error('[useEnrichmentMonitor] Failed to fetch line items:', err);
      showError('Failed to load line items');
    } finally {
      setLineItemsLoading((prev) => ({ ...prev, [bomId]: false }));
    }
  }, [lineItems, showError]);

  const toggleExpandRow = useCallback((bomId: string) => {
    if (expandedBomId === bomId) {
      setExpandedBomId(null);
    } else {
      setExpandedBomId(bomId);
      void fetchLineItems(bomId);
    }
  }, [expandedBomId, fetchLineItems]);

  const refreshLineItems = useCallback((bomId: string) => {
    void fetchLineItems(bomId, true);
  }, [fetchLineItems]);

  const invalidateActiveEnrichmentsCache = useCallback(() => {
    const activeStatuses = ['enriching'];
    setLineItems((prev) => {
      const newCache: Record<string, LineItem[]> = {};
      Object.entries(prev).forEach(([bomId, items]) => {
        const bomRow = enrichments.find((e) => e.bom_id === bomId);
        if (bomRow && !activeStatuses.includes(bomRow.status)) {
          newCache[bomId] = items;
        }
      });
      return newCache;
    });
  }, [enrichments]);

  // ============================================================
  // Component Detail Logic
  // ============================================================

  const fetchComponentDetail = useCallback(async (componentId: string) => {
    setDetailLoading(true);
    try {
      const headers: Record<string, string> = {};
      const authHeaders = getAuthHeaders();
      if (authHeaders) Object.assign(headers, authHeaders as Record<string, string>);

      const res = await fetch(`${CNS_API_URL}/catalog/component/id/${componentId}`, { headers });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setComponentDetail(data);
    } catch (err) {
      console.error('[useEnrichmentMonitor] Failed to fetch component details:', err);
      showError('Failed to load component details');
      setComponentDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, [showError]);

  const openComponentDetail = useCallback((componentId: string) => {
    setDetailDialogOpen(true);
    void fetchComponentDetail(componentId);
  }, [fetchComponentDetail]);

  const closeComponentDetail = useCallback(() => {
    setDetailDialogOpen(false);
    setComponentDetail(null);
  }, []);

  // ============================================================
  // Debounced Refresh
  // ============================================================

  const handleRefresh = useDebouncedCallback(() => {
    if (isPending('enrichments')) {
      return;
    }

    void dedupeExecute(
      { key: 'enrichments', minInterval: 1000 },
      async () => {
        invalidateActiveEnrichmentsCache();
        await loadEnrichments();
      }
    );
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
        console.error('[useEnrichmentMonitor] Background refresh failed:', error);
      });
    }, refreshIntervalMs);

    return () => clearInterval(interval);
  }, [loadEnrichments, refreshIntervalMs]);

  // ============================================================
  // Stats Calculation
  // ============================================================

  const stats: EnrichmentStatsData = useMemo(() => ({
    total: allEnrichments.length,
    enriching: allEnrichments.filter((e) => e.status === 'enriching').length,
    completed: allEnrichments.filter((e) => e.status === 'completed').length,
    failed: allEnrichments.filter((e) => e.status === 'failed').length,
    customer: allEnrichments.filter((e) => e.source === 'customer').length,
    staff: allEnrichments.filter((e) => e.source === 'staff').length,
  }), [allEnrichments]);

  // ============================================================
  // Return Value
  // ============================================================

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

    // Selection/Progress
    selectedBomId,
    selectedBomMeta,
    showProgress,
    handleSelectBom,
    closeProgress,

    // Line items
    expandedBomId,
    lineItems,
    lineItemsLoading,
    toggleExpandRow,
    refreshLineItems,

    // Component detail
    detailDialogOpen,
    componentDetail,
    detailLoading,
    openComponentDetail,
    closeComponentDetail,

    // Actions
    stoppingEnrichment,
    deletingBom,
    confirmDelete,
    setConfirmDelete,
    handleStopEnrichment,
    handleDeleteBom,
    handleOpenBomDetail,
    handleNavigateAudit,
    handleRefresh,
  };
}

export default useEnrichmentMonitor;
