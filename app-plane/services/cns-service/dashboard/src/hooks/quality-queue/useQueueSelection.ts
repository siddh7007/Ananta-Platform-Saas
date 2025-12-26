/**
 * useQueueSelection Hook
 *
 * Handles selection state for the quality queue.
 * Part of the split useQualityQueue hook.
 *
 * @module hooks/quality-queue/useQueueSelection
 */

import { useState, useCallback } from 'react';
import type { QueueItem } from '../../quality/QualityQueueRow';

// ============================================================
// Types
// ============================================================

export interface UseQueueSelectionOptions {
  /** Items to select from */
  items: QueueItem[];
}

export interface UseQueueSelectionReturn {
  // Selection state
  selectedIds: Set<string>;
  focusedIndex: number;
  setFocusedIndex: (index: number) => void;

  // Selection handlers
  handleSelect: (id: string, selected: boolean) => void;
  handleSelectAll: () => void;
  handleClearSelection: () => void;
  handleToggleSelectAll: (event: React.ChangeEvent<HTMLInputElement>) => void;

  // Utility
  removeFromSelection: (id: string) => void;
  clearSelectionState: () => void;
}

// ============================================================
// Hook Implementation
// ============================================================

export function useQueueSelection(options: UseQueueSelectionOptions): UseQueueSelectionReturn {
  const { items } = options;

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState(0);

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

  const removeFromSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const clearSelectionState = useCallback(() => {
    setSelectedIds(new Set());
    setFocusedIndex(0);
  }, []);

  return {
    // Selection state
    selectedIds,
    focusedIndex,
    setFocusedIndex,

    // Selection handlers
    handleSelect,
    handleSelectAll,
    handleClearSelection,
    handleToggleSelectAll,

    // Utility
    removeFromSelection,
    clearSelectionState,
  };
}

export default useQueueSelection;
