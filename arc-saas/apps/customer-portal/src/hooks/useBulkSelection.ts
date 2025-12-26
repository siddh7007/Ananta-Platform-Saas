/**
 * Bulk Selection Hook
 * CBP-P2-004: Bulk Line Item Operations
 */

import { useState, useCallback, useMemo, useRef } from 'react';

interface UseBulkSelectionOptions<T> {
  items: T[];
  getItemId: (item: T) => string;
}

interface UseBulkSelectionReturn<T> {
  selectedIds: string[];
  selectedCount: number;
  selectedItems: T[];
  isAllSelected: boolean;
  isPartiallySelected: boolean;
  toggleItem: (id: string) => void;
  toggleAll: () => void;
  selectRange: (fromId: string, toId: string) => void;
  selectItems: (ids: string[]) => void;
  deselectItems: (ids: string[]) => void;
  clearSelection: () => void;
  isSelected: (id: string) => boolean;
  handleShiftClick: (id: string) => void;
}

export function useBulkSelection<T>({
  items,
  getItemId,
}: UseBulkSelectionOptions<T>): UseBulkSelectionReturn<T> {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastSelectedIdRef = useRef<string | null>(null);

  // Memoize all item IDs
  const allIds = useMemo(() => items.map(getItemId), [items, getItemId]);

  // Check if all items are selected
  const isAllSelected = useMemo(
    () => allIds.length > 0 && allIds.every((id) => selectedIds.has(id)),
    [allIds, selectedIds]
  );

  // Check if some (but not all) items are selected
  const isPartiallySelected = useMemo(
    () => allIds.some((id) => selectedIds.has(id)) && !isAllSelected,
    [allIds, selectedIds, isAllSelected]
  );

  // Count of selected items
  const selectedCount = selectedIds.size;

  // Get full item objects for selected IDs
  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.has(getItemId(item))),
    [items, selectedIds, getItemId]
  );

  // Toggle a single item
  const toggleItem = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    lastSelectedIdRef.current = id;
  }, []);

  // Toggle all items (select all or clear all)
  const toggleAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  }, [isAllSelected, allIds]);

  // Select a range of items (for shift+click)
  const selectRange = useCallback(
    (fromId: string, toId: string) => {
      const fromIndex = allIds.indexOf(fromId);
      const toIndex = allIds.indexOf(toId);

      if (fromIndex === -1 || toIndex === -1) return;

      const [start, end] = [Math.min(fromIndex, toIndex), Math.max(fromIndex, toIndex)];
      const rangeIds = allIds.slice(start, end + 1);

      setSelectedIds((prev) => {
        const next = new Set(prev);
        rangeIds.forEach((id) => next.add(id));
        return next;
      });
    },
    [allIds]
  );

  // Select multiple specific items
  const selectItems = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  // Deselect multiple specific items
  const deselectItems = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  // Clear all selections
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    lastSelectedIdRef.current = null;
  }, []);

  // Check if a specific item is selected
  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  );

  // Handle shift+click for range selection
  const handleShiftClick = useCallback(
    (id: string) => {
      if (lastSelectedIdRef.current && lastSelectedIdRef.current !== id) {
        selectRange(lastSelectedIdRef.current, id);
      } else {
        toggleItem(id);
      }
    },
    [selectRange, toggleItem]
  );

  return {
    selectedIds: Array.from(selectedIds),
    selectedCount,
    selectedItems,
    isAllSelected,
    isPartiallySelected,
    toggleItem,
    toggleAll,
    selectRange,
    selectItems,
    deselectItems,
    clearSelection,
    isSelected,
    handleShiftClick,
  };
}

export default useBulkSelection;
