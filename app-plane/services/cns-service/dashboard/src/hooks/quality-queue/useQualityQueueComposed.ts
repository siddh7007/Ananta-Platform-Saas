/**
 * useQualityQueueComposed Hook
 *
 * Composed hook that combines all quality queue sub-hooks.
 * Provides backwards compatibility with the original useQualityQueue.
 *
 * @module hooks/quality-queue/useQualityQueueComposed
 */

import { useCallback } from 'react';
import { useQueueData, type QueueFilter } from './useQueueData';
import { useQueueSelection } from './useQueueSelection';
import { useQueueActions } from './useQueueActions';
import { useComponentDetail } from './useComponentDetail';
import type { QueueItem } from '../../quality/QualityQueueRow';
import type { QueueStats } from '../../quality/QualityQueueStats';
import type { ComponentDetail } from '../../components/shared';

// ============================================================
// Types
// ============================================================

export interface UseQualityQueueComposedOptions {
  /** Initial filter value */
  initialFilter?: QueueFilter;
  /** Initial rows per page */
  initialRowsPerPage?: number;
}

export interface UseQualityQueueComposedReturn {
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

export function useQualityQueueComposed(
  options: UseQualityQueueComposedOptions = {}
): UseQualityQueueComposedReturn {
  // Data hook
  const {
    items,
    stats,
    loading,
    error,
    totalCount,
    filter,
    setFilter,
    handleFilterChange,
    page,
    rowsPerPage,
    handleChangePage,
    handleChangeRowsPerPage,
    setItems,
    handleRefresh,
    fetchStats,
    clearError,
  } = useQueueData({
    initialFilter: options.initialFilter,
    initialRowsPerPage: options.initialRowsPerPage,
  });

  // Selection hook
  const {
    selectedIds,
    focusedIndex,
    setFocusedIndex,
    handleSelect,
    handleSelectAll,
    handleClearSelection,
    handleToggleSelectAll,
    removeFromSelection,
    clearSelectionState,
  } = useQueueSelection({ items });

  // Create callbacks for actions hook
  const handleItemsRemoved = useCallback(
    (ids: string[]) => {
      setItems((prev) => prev.filter((item) => !ids.includes(item.id)));
    },
    [setItems]
  );

  const handleStatsRefresh = useCallback(() => {
    void fetchStats();
  }, [fetchStats]);

  // Actions hook
  const {
    processingId,
    handleApprove,
    handleReject,
    batchProcessing,
    handleApproveSelected: handleApproveSelectedBase,
    handleRejectSelected: handleRejectSelectedBase,
    confirmReject,
    setConfirmReject,
    confirmBatchReject,
    setConfirmBatchReject,
  } = useQueueActions({
    onItemsRemoved: handleItemsRemoved,
    onStatsRefresh: handleStatsRefresh,
    onSelectionClear: clearSelectionState,
    onRemoveFromSelection: removeFromSelection,
  });

  // Wrap batch operations to pass selectedIds
  const handleApproveSelected = useCallback(async () => {
    await handleApproveSelectedBase(selectedIds);
  }, [handleApproveSelectedBase, selectedIds]);

  const handleRejectSelected = useCallback(async () => {
    await handleRejectSelectedBase(selectedIds);
  }, [handleRejectSelectedBase, selectedIds]);

  // Component detail hook
  const {
    detailDialogOpen,
    componentDetail,
    detailLoading,
    handleViewDetails,
    closeComponentDetail,
  } = useComponentDetail();

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

export default useQualityQueueComposed;
