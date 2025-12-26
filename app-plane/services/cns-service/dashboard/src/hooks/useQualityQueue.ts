/**
 * useQualityQueue Hook
 *
 * Manages all state and API logic for the Quality Review Queue.
 * Extracted from QualityQueue.tsx to follow the Page → Hook pattern.
 *
 * Features:
 * - Queue items fetching with pagination
 * - Stats summary
 * - Single and batch approve/reject operations
 * - Selection management
 * - Component detail fetching
 * - Request deduplication
 *
 * @module hooks/useQualityQueue
 */

import { useState, useEffect, useCallback } from 'react';
import { getAuthHeaders, CNS_API_BASE_URL } from '../config/api';
import { useNotification } from '../contexts/NotificationContext';
import { useDebouncedCallback, useDeduplicatedFetch } from './index';
import type { QueueItem } from '../quality/QualityQueueRow';
import type { QueueStats } from '../quality/QualityQueueStats';
import type { ComponentDetail } from '../components/shared';

// ============================================================
// Types
// ============================================================

export type QueueFilter = 'staging' | 'rejected' | 'all';

export interface UseQualityQueueOptions {
  /** Initial filter value */
  initialFilter?: QueueFilter;
  /** Initial rows per page */
  initialRowsPerPage?: number;
}

export interface UseQualityQueueReturn {
  // Data
  items: QueueItem[];
  stats: QueueStats | null;
  loading: boolean;
  error: string | null;
  totalCount: number;

  // Filter
  filter: QueueFilter;
  setFilter: (filter: QueueFilter) => void;
  handleFilterChange: (event: React.SyntheticEvent, newValue: QueueFilter) => void;

  // Pagination
  page: number;
  rowsPerPage: number;
  handleChangePage: (event: unknown, newPage: number) => void;
  handleChangeRowsPerPage: (event: React.ChangeEvent<HTMLInputElement>) => void;

  // Selection
  selectedIds: Set<string>;
  focusedIndex: number;
  setFocusedIndex: (index: number) => void;
  handleSelect: (id: string, selected: boolean) => void;
  handleSelectAll: () => void;
  handleClearSelection: () => void;
  handleToggleSelectAll: (event: React.ChangeEvent<HTMLInputElement>) => void;

  // Single item operations
  processingId: string | null;
  handleApprove: (itemId: string) => Promise<void>;
  handleReject: () => Promise<void>;

  // Batch operations
  batchProcessing: boolean;
  handleApproveSelected: () => Promise<void>;
  handleRejectSelected: () => Promise<void>;

  // Confirm dialogs
  confirmReject: { id: string; mpn: string } | null;
  setConfirmReject: (value: { id: string; mpn: string } | null) => void;
  confirmBatchReject: boolean;
  setConfirmBatchReject: (value: boolean) => void;

  // Component detail
  detailDialogOpen: boolean;
  componentDetail: ComponentDetail | null;
  detailLoading: boolean;
  handleViewDetails: (itemId: string) => void;
  closeComponentDetail: () => void;

  // Refresh
  handleRefresh: () => void;
  clearError: () => void;
}

// ============================================================
// Hook Implementation
// ============================================================

export function useQualityQueue(options: UseQualityQueueOptions = {}): UseQualityQueueReturn {
  const { initialFilter = 'staging', initialRowsPerPage = 25 } = options;
  const { showSuccess, showError } = useNotification();

  // Core data state
  const [items, setItems] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  // Filter state
  const [filter, setFilter] = useState<QueueFilter>(initialFilter);

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(initialRowsPerPage);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState(0);

  // Processing state
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [batchProcessing, setBatchProcessing] = useState(false);

  // Confirm dialogs
  const [confirmReject, setConfirmReject] = useState<{ id: string; mpn: string } | null>(null);
  const [confirmBatchReject, setConfirmBatchReject] = useState(false);

  // Component detail dialog
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [componentDetail, setComponentDetail] = useState<ComponentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Request deduplication
  const { execute: dedupeExecute, isPending } = useDeduplicatedFetch();

  // ============================================================
  // Data Fetching
  // ============================================================

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`${CNS_API_BASE_URL}/quality-queue/stats/summary`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  const fetchQueueItems = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        status: filter,
        page: String(page + 1), // API uses 1-based pagination
        page_size: String(rowsPerPage),
      });

      const response = await fetch(`${CNS_API_BASE_URL}/quality-queue?${params.toString()}`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to load quality queue');
      }

      const data = await response.json();
      setItems(data.items || []);
      setTotalCount(data.total || data.items?.length || 0);
      setSelectedIds(new Set()); // Clear selection on page/filter change
      setFocusedIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load queue');
      setItems([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [filter, page, rowsPerPage]);

  // Initial load and refresh on dependencies change
  useEffect(() => {
    void fetchQueueItems();
    void fetchStats();
  }, [fetchQueueItems, fetchStats]);

  // Debounced refresh to prevent rapid-fire clicks
  const handleRefresh = useDebouncedCallback(() => {
    if (isPending('qualityQueue')) {
      return;
    }

    void dedupeExecute(
      { key: 'qualityQueue', minInterval: 1000 },
      async () => {
        await Promise.all([fetchQueueItems(), fetchStats()]);
      }
    );
  }, 300);

  // ============================================================
  // Filter & Pagination Handlers
  // ============================================================

  const handleFilterChange = (_: React.SyntheticEvent, newValue: QueueFilter) => {
    setPage(0);
    setFilter(newValue);
  };

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // ============================================================
  // Selection Handlers
  // ============================================================

  const handleSelect = useCallback((id: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(items.map((item) => item.id)));
  }, [items]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleToggleSelectAll = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.checked) {
        handleSelectAll();
      } else {
        handleClearSelection();
      }
    },
    [handleSelectAll, handleClearSelection]
  );

  // ============================================================
  // Single Item Operations
  // ============================================================

  const handleApprove = useCallback(
    async (itemId: string) => {
      setProcessingId(itemId);
      try {
        const response = await fetch(
          `${CNS_API_BASE_URL}/quality-queue/${encodeURIComponent(itemId)}/approve`,
          {
            method: 'POST',
            headers: {
              ...(getAuthHeaders() || {}),
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || 'Failed to approve component');
        }

        const result = await response.json();
        showSuccess(
          `Component approved${result.component_id ? ` (ID: ${result.component_id.slice(0, 8)}...)` : ''}`
        );

        setItems((prev) => prev.filter((item) => item.id !== itemId));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(itemId);
          return next;
        });
        void fetchStats();
      } catch (err) {
        showError(err instanceof Error ? err.message : 'Approval failed');
      } finally {
        setProcessingId(null);
      }
    },
    [showSuccess, showError, fetchStats]
  );

  const handleReject = useCallback(async () => {
    if (!confirmReject) return;

    const itemId = confirmReject.id;
    setConfirmReject(null);
    setProcessingId(itemId);

    try {
      const response = await fetch(
        `${CNS_API_BASE_URL}/quality-queue/${encodeURIComponent(itemId)}/reject`,
        {
          method: 'POST',
          headers: {
            ...(getAuthHeaders() || {}),
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to reject component');
      }

      showSuccess('Component rejected and removed from queue');

      setItems((prev) => prev.filter((item) => item.id !== itemId));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
      void fetchStats();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Rejection failed');
    } finally {
      setProcessingId(null);
    }
  }, [confirmReject, showSuccess, showError, fetchStats]);

  // ============================================================
  // Batch Operations
  // ============================================================

  const handleApproveSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;

    setBatchProcessing(true);
    const ids = Array.from(selectedIds);
    let successCount = 0;
    let failCount = 0;

    for (const id of ids) {
      try {
        const response = await fetch(
          `${CNS_API_BASE_URL}/quality-queue/${encodeURIComponent(id)}/approve`,
          {
            method: 'POST',
            headers: {
              ...(getAuthHeaders() || {}),
              'Content-Type': 'application/json',
            },
          }
        );

        if (response.ok) {
          successCount++;
          setItems((prev) => prev.filter((item) => item.id !== id));
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    setBatchProcessing(false);
    setSelectedIds(new Set());

    if (successCount > 0) {
      showSuccess(`Approved ${successCount} component${successCount > 1 ? 's' : ''}`);
    }
    if (failCount > 0) {
      showError(`Failed to approve ${failCount} component${failCount > 1 ? 's' : ''}`);
    }
    void fetchStats();
  }, [selectedIds, showSuccess, showError, fetchStats]);

  const handleRejectSelected = useCallback(async () => {
    setConfirmBatchReject(false);
    if (selectedIds.size === 0) return;

    setBatchProcessing(true);
    const ids = Array.from(selectedIds);
    let successCount = 0;
    let failCount = 0;

    for (const id of ids) {
      try {
        const response = await fetch(
          `${CNS_API_BASE_URL}/quality-queue/${encodeURIComponent(id)}/reject`,
          {
            method: 'POST',
            headers: {
              ...(getAuthHeaders() || {}),
              'Content-Type': 'application/json',
            },
          }
        );

        if (response.ok) {
          successCount++;
          setItems((prev) => prev.filter((item) => item.id !== id));
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    setBatchProcessing(false);
    setSelectedIds(new Set());

    if (successCount > 0) {
      showSuccess(`Rejected ${successCount} component${successCount > 1 ? 's' : ''}`);
    }
    if (failCount > 0) {
      showError(`Failed to reject ${failCount} component${failCount > 1 ? 's' : ''}`);
    }
    void fetchStats();
  }, [selectedIds, showSuccess, showError, fetchStats]);

  // ============================================================
  // Component Detail
  // ============================================================

  const fetchComponentDetail = useCallback(
    async (itemId: string) => {
      setDetailLoading(true);
      try {
        const response = await fetch(
          `${CNS_API_BASE_URL}/quality-queue/${encodeURIComponent(itemId)}`,
          {
            headers: getAuthHeaders(),
          }
        );

        if (!response.ok) throw new Error('Failed to fetch component details');

        const data = await response.json();
        const enrichmentData = data.enrichment_data || {};

        setComponentDetail({
          id: data.id,
          mpn: data.mpn,
          manufacturer: data.manufacturer,
          category: enrichmentData.category,
          description: enrichmentData.description,
          datasheet_url: enrichmentData.datasheet_url,
          image_url: enrichmentData.image_url,
          lifecycle: enrichmentData.lifecycle_status,
          rohs: enrichmentData.rohs_compliant ? 'Compliant' : undefined,
          reach: enrichmentData.reach_compliant ? 'Compliant' : undefined,
          parameters: enrichmentData.parameters,
          pricing: enrichmentData.price_breaks,
          quality_score: data.quality_score,
          enrichment_source: data.enrichment_source || data.api_source,
          last_enriched_at: data.stored_at,
          stock_quantity: enrichmentData.stock_quantity,
          lead_time_days: enrichmentData.lead_time_days,
          moq: enrichmentData.minimum_order_quantity,
          aec_qualified: enrichmentData.aec_qualified,
          halogen_free: enrichmentData.halogen_free,
        });
      } catch (err) {
        console.error('Failed to fetch component details:', err);
        showError('Failed to load component details');
        setComponentDetail(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [showError]
  );

  const handleViewDetails = useCallback(
    (itemId: string) => {
      setDetailDialogOpen(true);
      void fetchComponentDetail(itemId);
    },
    [fetchComponentDetail]
  );

  const closeComponentDetail = useCallback(() => {
    setDetailDialogOpen(false);
    setComponentDetail(null);
  }, []);

  // ============================================================
  // Utility
  // ============================================================

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // ============================================================
  // Return
  // ============================================================

  return {
    // Data
    items,
    stats,
    loading,
    error,
    totalCount,

    // Filter
    filter,
    setFilter,
    handleFilterChange,

    // Pagination
    page,
    rowsPerPage,
    handleChangePage,
    handleChangeRowsPerPage,

    // Selection
    selectedIds,
    focusedIndex,
    setFocusedIndex,
    handleSelect,
    handleSelectAll,
    handleClearSelection,
    handleToggleSelectAll,

    // Single item operations
    processingId,
    handleApprove,
    handleReject,

    // Batch operations
    batchProcessing,
    handleApproveSelected,
    handleRejectSelected,

    // Confirm dialogs
    confirmReject,
    setConfirmReject,
    confirmBatchReject,
    setConfirmBatchReject,

    // Component detail
    detailDialogOpen,
    componentDetail,
    detailLoading,
    handleViewDetails,
    closeComponentDetail,

    // Refresh
    handleRefresh,
    clearError,
  };
}

export default useQualityQueue;
