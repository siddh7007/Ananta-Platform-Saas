/**
 * useQueueActions Hook
 *
 * Handles approve/reject operations for the quality queue.
 * Part of the split useQualityQueue hook.
 *
 * @module hooks/quality-queue/useQueueActions
 */

import { useState, useCallback } from 'react';
import { getAuthHeaders, CNS_API_BASE_URL } from '../../config/api';
import { useNotification } from '../../contexts/NotificationContext';
import type { QueueItem } from '../../quality/QualityQueueRow';

// ============================================================
// Types
// ============================================================

export interface UseQueueActionsOptions {
  /** Callback when items are removed */
  onItemsRemoved: (ids: string[]) => void;
  /** Callback to refresh stats */
  onStatsRefresh: () => void;
  /** Callback when selection should be cleared */
  onSelectionClear: () => void;
  /** Callback to remove item from selection */
  onRemoveFromSelection: (id: string) => void;
}

export interface UseQueueActionsReturn {
  // Single item operations
  processingId: string | null;
  handleApprove: (itemId: string) => Promise<void>;
  handleReject: () => Promise<void>;

  // Batch operations
  batchProcessing: boolean;
  handleApproveSelected: (selectedIds: Set<string>) => Promise<void>;
  handleRejectSelected: (selectedIds: Set<string>) => Promise<void>;

  // Confirm dialogs
  confirmReject: { id: string; mpn: string } | null;
  setConfirmReject: (value: { id: string; mpn: string } | null) => void;
  confirmBatchReject: boolean;
  setConfirmBatchReject: (value: boolean) => void;
}

// ============================================================
// Hook Implementation
// ============================================================

export function useQueueActions(options: UseQueueActionsOptions): UseQueueActionsReturn {
  const { onItemsRemoved, onStatsRefresh, onSelectionClear, onRemoveFromSelection } = options;
  const { showSuccess, showError } = useNotification();

  // Processing state
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [batchProcessing, setBatchProcessing] = useState(false);

  // Confirm dialogs
  const [confirmReject, setConfirmReject] = useState<{ id: string; mpn: string } | null>(null);
  const [confirmBatchReject, setConfirmBatchReject] = useState(false);

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

        onItemsRemoved([itemId]);
        onRemoveFromSelection(itemId);
        onStatsRefresh();
      } catch (err) {
        showError(err instanceof Error ? err.message : 'Approval failed');
      } finally {
        setProcessingId(null);
      }
    },
    [showSuccess, showError, onItemsRemoved, onRemoveFromSelection, onStatsRefresh]
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

      onItemsRemoved([itemId]);
      onRemoveFromSelection(itemId);
      onStatsRefresh();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Rejection failed');
    } finally {
      setProcessingId(null);
    }
  }, [confirmReject, showSuccess, showError, onItemsRemoved, onRemoveFromSelection, onStatsRefresh]);

  // ============================================================
  // Batch Operations
  // ============================================================

  const handleApproveSelected = useCallback(
    async (selectedIds: Set<string>) => {
      if (selectedIds.size === 0) return;

      setBatchProcessing(true);
      const ids = Array.from(selectedIds);
      let successCount = 0;
      let failCount = 0;
      const removedIds: string[] = [];

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
            removedIds.push(id);
          } else {
            failCount++;
          }
        } catch {
          failCount++;
        }
      }

      setBatchProcessing(false);
      onSelectionClear();

      if (removedIds.length > 0) {
        onItemsRemoved(removedIds);
      }

      if (successCount > 0) {
        showSuccess(`Approved ${successCount} component${successCount > 1 ? 's' : ''}`);
      }
      if (failCount > 0) {
        showError(`Failed to approve ${failCount} component${failCount > 1 ? 's' : ''}`);
      }
      onStatsRefresh();
    },
    [showSuccess, showError, onItemsRemoved, onSelectionClear, onStatsRefresh]
  );

  const handleRejectSelected = useCallback(
    async (selectedIds: Set<string>) => {
      setConfirmBatchReject(false);
      if (selectedIds.size === 0) return;

      setBatchProcessing(true);
      const ids = Array.from(selectedIds);
      let successCount = 0;
      let failCount = 0;
      const removedIds: string[] = [];

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
            removedIds.push(id);
          } else {
            failCount++;
          }
        } catch {
          failCount++;
        }
      }

      setBatchProcessing(false);
      onSelectionClear();

      if (removedIds.length > 0) {
        onItemsRemoved(removedIds);
      }

      if (successCount > 0) {
        showSuccess(`Rejected ${successCount} component${successCount > 1 ? 's' : ''}`);
      }
      if (failCount > 0) {
        showError(`Failed to reject ${failCount} component${failCount > 1 ? 's' : ''}`);
      }
      onStatsRefresh();
    },
    [showSuccess, showError, onItemsRemoved, onSelectionClear, onStatsRefresh]
  );

  return {
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
  };
}

export default useQueueActions;
