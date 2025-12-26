/**
 * Quality Queue Keyboard Shortcuts Hook
 *
 * Provides keyboard navigation and actions for the quality queue.
 *
 * Shortcuts:
 * - A: Approve focused/first selected item
 * - R: Reject focused/first selected item
 * - V: View details of focused item
 * - Shift+A: Approve all selected
 * - Shift+R: Reject all selected
 * - Ctrl+A: Select all
 * - Esc: Clear selection
 * - Arrow Up/Down: Navigate items
 * - Space: Toggle selection
 */

import { useEffect, useCallback } from 'react';

export interface UseQueueKeyboardOptions {
  items: Array<{ id: string; mpn: string }>;
  selectedIds: Set<string>;
  focusedIndex: number;
  onFocusChange: (index: number) => void;
  onSelect: (id: string, selected: boolean) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string, mpn: string) => void;
  onApproveSelected: () => void;
  onRejectSelected: () => void;
  onViewDetails: (id: string) => void;
  disabled?: boolean;
}

export function useQueueKeyboard({
  items,
  selectedIds,
  focusedIndex,
  onFocusChange,
  onSelect,
  onSelectAll,
  onClearSelection,
  onApprove,
  onReject,
  onApproveSelected,
  onRejectSelected,
  onViewDetails,
  disabled = false,
}: UseQueueKeyboardOptions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (disabled) return;

      // Ignore if typing in an input
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const focusedItem = items[focusedIndex];

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          if (focusedIndex < items.length - 1) {
            onFocusChange(focusedIndex + 1);
          }
          break;

        case 'ArrowUp':
          event.preventDefault();
          if (focusedIndex > 0) {
            onFocusChange(focusedIndex - 1);
          }
          break;

        case ' ': // Space
          event.preventDefault();
          if (focusedItem) {
            onSelect(focusedItem.id, !selectedIds.has(focusedItem.id));
          }
          break;

        case 'a':
        case 'A':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            onSelectAll();
          } else if (event.shiftKey) {
            event.preventDefault();
            if (selectedIds.size > 0) {
              onApproveSelected();
            }
          } else {
            event.preventDefault();
            if (selectedIds.size > 0) {
              const firstSelectedId = Array.from(selectedIds)[0];
              onApprove(firstSelectedId);
            } else if (focusedItem) {
              onApprove(focusedItem.id);
            }
          }
          break;

        case 'r':
        case 'R':
          if (event.shiftKey) {
            event.preventDefault();
            if (selectedIds.size > 0) {
              onRejectSelected();
            }
          } else {
            event.preventDefault();
            if (selectedIds.size > 0) {
              const firstSelectedId = Array.from(selectedIds)[0];
              const item = items.find((i) => i.id === firstSelectedId);
              if (item) {
                onReject(item.id, item.mpn);
              }
            } else if (focusedItem) {
              onReject(focusedItem.id, focusedItem.mpn);
            }
          }
          break;

        case 'v':
        case 'V':
          event.preventDefault();
          if (focusedItem) {
            onViewDetails(focusedItem.id);
          } else if (selectedIds.size > 0) {
            const firstSelectedId = Array.from(selectedIds)[0];
            onViewDetails(firstSelectedId);
          }
          break;

        case 'Escape':
          event.preventDefault();
          onClearSelection();
          break;

        default:
          break;
      }
    },
    [
      disabled,
      items,
      focusedIndex,
      selectedIds,
      onFocusChange,
      onSelect,
      onSelectAll,
      onClearSelection,
      onApprove,
      onReject,
      onApproveSelected,
      onRejectSelected,
      onViewDetails,
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Return keyboard shortcut hints for display
  return {
    shortcuts: [
      { key: 'A', description: 'Approve item' },
      { key: 'R', description: 'Reject item' },
      { key: 'V', description: 'View details' },
      { key: 'Shift+A', description: 'Approve selected' },
      { key: 'Shift+R', description: 'Reject selected' },
      { key: 'Ctrl+A', description: 'Select all' },
      { key: 'Space', description: 'Toggle selection' },
      { key: 'Esc', description: 'Clear selection' },
      { key: '↑/↓', description: 'Navigate' },
    ],
  };
}

export default useQueueKeyboard;
