/**
 * Roving Tab Index Hook
 * CBP-P1-003: Keyboard Navigation & Focus Management
 * For keyboard navigation in lists/grids
 */

import { useState, useCallback, useRef, KeyboardEvent, useEffect } from 'react';

interface RovingTabIndexOptions {
  /**
   * Function to determine if an item is disabled
   */
  isDisabled?: (index: number) => boolean;
  /**
   * Page jump size for PageUp/PageDown
   */
  pageSize?: number;
}

export function useRovingTabIndex<T>(
  items: T[],
  options: RovingTabIndexOptions = {}
) {
  const { isDisabled = () => false, pageSize = 10 } = options;
  const [focusedIndex, setFocusedIndex] = useState(0);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);

  // Clamp focused index when items array changes
  useEffect(() => {
    if (items.length === 0) {
      setFocusedIndex(0);
    } else if (focusedIndex >= items.length) {
      setFocusedIndex(Math.max(0, items.length - 1));
    }
  }, [items.length, focusedIndex]);

  const setItemRef = useCallback((index: number) => (el: HTMLElement | null) => {
    itemRefs.current[index] = el;
  }, []);

  /**
   * Find next non-disabled index in a direction
   */
  const findNextEnabledIndex = useCallback(
    (startIndex: number, direction: 1 | -1): number => {
      let index = startIndex;
      let attempts = 0;

      while (attempts < items.length) {
        index = (index + direction + items.length) % items.length;
        if (!isDisabled(index)) return index;
        attempts++;
      }

      return startIndex; // All items disabled, stay put
    },
    [items.length, isDisabled]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      let newIndex = focusedIndex;

      switch (e.key) {
        case 'ArrowDown':
        case 'ArrowRight':
          e.preventDefault();
          newIndex = findNextEnabledIndex(focusedIndex, 1);
          break;
        case 'ArrowUp':
        case 'ArrowLeft':
          e.preventDefault();
          newIndex = findNextEnabledIndex(focusedIndex, -1);
          break;
        case 'Home':
          e.preventDefault();
          newIndex = findNextEnabledIndex(-1, 1); // Start from beginning
          break;
        case 'End':
          e.preventDefault();
          newIndex = findNextEnabledIndex(items.length, -1); // Start from end
          break;
        case 'PageDown':
          e.preventDefault();
          newIndex = Math.min(focusedIndex + pageSize, items.length - 1);
          if (isDisabled(newIndex)) {
            newIndex = findNextEnabledIndex(newIndex, -1);
          }
          break;
        case 'PageUp':
          e.preventDefault();
          newIndex = Math.max(focusedIndex - pageSize, 0);
          if (isDisabled(newIndex)) {
            newIndex = findNextEnabledIndex(newIndex, 1);
          }
          break;
        default:
          return;
      }

      if (newIndex !== focusedIndex) {
        setFocusedIndex(newIndex);
        itemRefs.current[newIndex]?.focus();
      }
    },
    [focusedIndex, items.length, pageSize, findNextEnabledIndex, isDisabled]
  );

  const handleItemClick = useCallback((index: number) => {
    if (!isDisabled(index)) {
      setFocusedIndex(index);
      itemRefs.current[index]?.focus();
    }
  }, [isDisabled]);

  const getTabIndex = useCallback(
    (index: number) => (index === focusedIndex ? 0 : -1),
    [focusedIndex]
  );

  const getItemProps = useCallback(
    (index: number) => ({
      ref: setItemRef(index),
      tabIndex: getTabIndex(index),
      onKeyDown: handleKeyDown,
      onClick: () => handleItemClick(index),
      'aria-disabled': isDisabled(index) ? true : undefined,
    }),
    [setItemRef, getTabIndex, handleKeyDown, handleItemClick, isDisabled]
  );

  return {
    focusedIndex,
    setFocusedIndex,
    getTabIndex,
    getItemProps,
    handleKeyDown,
    handleItemClick,
  };
}

export default useRovingTabIndex;
