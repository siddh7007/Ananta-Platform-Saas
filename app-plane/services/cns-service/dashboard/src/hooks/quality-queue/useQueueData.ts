/**
 * useQueueData Hook
 *
 * Handles data fetching and state for the quality queue.
 * Part of the split useQualityQueue hook.
 *
 * @module hooks/quality-queue/useQueueData
 */

import { useState, useEffect, useCallback } from 'react';
import { getAuthHeaders, CNS_API_BASE_URL } from '../../config/api';
import { useDebouncedCallback, useDeduplicatedFetch } from '../index';
import type { QueueItem } from '../../quality/QualityQueueRow';
import type { QueueStats } from '../../quality/QualityQueueStats';

// ============================================================
// Types
// ============================================================

export type QueueFilter = 'staging' | 'rejected' | 'all';

export interface UseQueueDataOptions {
  /** Initial filter value */
  initialFilter?: QueueFilter;
  /** Initial rows per page */
  initialRowsPerPage?: number;
}

export interface UseQueueDataReturn {
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

  // Mutations
  setItems: React.Dispatch<React.SetStateAction<QueueItem[]>>;

  // Refresh
  handleRefresh: () => void;
  fetchStats: () => Promise<void>;
  clearError: () => void;
}

// ============================================================
// Hook Implementation
// ============================================================

export function useQueueData(options: UseQueueDataOptions = {}): UseQueueDataReturn {
  const { initialFilter = 'staging', initialRowsPerPage = 25 } = options;

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

  const clearError = useCallback(() => {
    setError(null);
  }, []);

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

    // Mutations
    setItems,

    // Refresh
    handleRefresh,
    fetchStats,
    clearError,
  };
}

export default useQueueData;
