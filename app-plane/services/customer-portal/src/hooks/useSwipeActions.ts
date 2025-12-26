import { useCallback, useState, useRef, useEffect } from 'react';

export type SwipeDirection = 'left' | 'right' | null;

export interface SwipeAction {
  label: string;
  icon?: React.ReactNode;
  color?: string;
  onAction: () => void | Promise<void>;
}

export interface SwipeActionsConfig {
  leftActions?: SwipeAction[];
  rightActions?: SwipeAction[];
  threshold?: number; // Minimum swipe distance to trigger (default: 80px)
  snapThreshold?: number; // Distance to snap to action state (default: 50px)
}

export interface SwipeState {
  direction: SwipeDirection;
  offset: number;
  isSwiping: boolean;
  isSnapped: boolean;
}

export interface UseSwipeActionsReturn {
  swipeState: SwipeState;
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
  };
  reset: () => void;
  executeAction: (direction: SwipeDirection) => Promise<void>;
}

/**
 * Hook to handle swipe gestures for card actions
 *
 * @param config - Swipe actions configuration
 * @returns Swipe state and event handlers
 *
 * @example
 * const { swipeState, handlers, reset } = useSwipeActions({
 *   leftActions: [{ label: 'Delete', onAction: handleDelete }],
 *   rightActions: [{ label: 'Archive', onAction: handleArchive }],
 * });
 *
 * <div {...handlers} style={{ transform: `translateX(${swipeState.offset}px)` }}>
 *   Card content
 * </div>
 */
export function useSwipeActions(config: SwipeActionsConfig): UseSwipeActionsReturn {
  const {
    leftActions = [],
    rightActions = [],
    threshold = 80,
    snapThreshold = 50,
  } = config;

  const [swipeState, setSwipeState] = useState<SwipeState>({
    direction: null,
    offset: 0,
    isSwiping: false,
    isSnapped: false,
  });

  const touchStartX = useRef<number>(0);
  const currentOffset = useRef<number>(0);
  const animationFrame = useRef<number | null>(null);

  const reset = useCallback(() => {
    setSwipeState({
      direction: null,
      offset: 0,
      isSwiping: false,
      isSnapped: false,
    });
    currentOffset.current = 0;
  }, []);

  const executeAction = useCallback(
    async (direction: SwipeDirection) => {
      if (!direction) return;

      const actions = direction === 'left' ? leftActions : rightActions;
      if (actions.length === 0) return;

      // Execute first action
      const action = actions[0];
      try {
        await action.onAction();
      } catch (error) {
        console.error('Swipe action failed:', error);
      } finally {
        reset();
      }
    },
    [leftActions, rightActions, reset]
  );

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    setSwipeState((prev) => ({
      ...prev,
      isSwiping: true,
    }));
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!swipeState.isSwiping) return;

      const currentX = e.touches[0].clientX;
      const diff = currentX - touchStartX.current;

      // Determine direction and apply resistance
      let offset = diff;
      let direction: SwipeDirection = null;

      if (diff < 0 && leftActions.length > 0) {
        // Swiping left
        direction = 'left';
        offset = Math.max(diff, -threshold * 1.2); // Add resistance
      } else if (diff > 0 && rightActions.length > 0) {
        // Swiping right
        direction = 'right';
        offset = Math.min(diff, threshold * 1.2); // Add resistance
      } else {
        offset = 0;
      }

      currentOffset.current = offset;

      // Use RAF for smooth animation
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }

      animationFrame.current = requestAnimationFrame(() => {
        setSwipeState({
          direction,
          offset,
          isSwiping: true,
          isSnapped: Math.abs(offset) >= snapThreshold,
        });
      });
    },
    [swipeState.isSwiping, leftActions, rightActions, threshold, snapThreshold]
  );

  const handleTouchEnd = useCallback(() => {
    const { direction, offset } = swipeState;

    // If swiped beyond threshold, snap to action state
    if (Math.abs(offset) >= threshold && direction) {
      const snapOffset = direction === 'left' ? -threshold : threshold;
      setSwipeState({
        direction,
        offset: snapOffset,
        isSwiping: false,
        isSnapped: true,
      });
    } else {
      // Otherwise, reset
      reset();
    }
  }, [swipeState, threshold, reset]);

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }
    };
  }, []);

  return {
    swipeState,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
    reset,
    executeAction,
  };
}

/**
 * Simpler hook for basic swipe detection without actions
 */
export function useSwipeDetection(
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void,
  threshold = 50
) {
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(() => {
    const diff = touchStartX.current - touchEndX.current;

    if (Math.abs(diff) > threshold) {
      if (diff > 0 && onSwipeLeft) {
        onSwipeLeft();
      } else if (diff < 0 && onSwipeRight) {
        onSwipeRight();
      }
    }
  }, [onSwipeLeft, onSwipeRight, threshold]);

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  };
}
