import { useRef, useCallback, useState } from 'react';

export interface SwipeGestureConfig {
  /** Minimum distance in pixels to trigger a swipe */
  threshold?: number;
  /** Maximum time in ms for the swipe to be valid */
  maxDuration?: number;
  /** Callback when swipe left is detected */
  onSwipeLeft?: () => void;
  /** Callback when swipe right is detected */
  onSwipeRight?: () => void;
  /** Callback when swipe up is detected */
  onSwipeUp?: () => void;
  /** Callback when swipe down is detected */
  onSwipeDown?: () => void;
  /** Prevent default touch behavior */
  preventDefault?: boolean;
}

export interface SwipeState {
  isSwiping: boolean;
  direction: 'left' | 'right' | 'up' | 'down' | null;
  deltaX: number;
  deltaY: number;
}

interface TouchPoint {
  x: number;
  y: number;
  timestamp: number;
}

/**
 * Custom hook for handling swipe gestures on touch devices.
 * Provides a fallback implementation for environments where react-swipeable is not available.
 *
 * @param config - Configuration for swipe gesture detection
 * @returns Object with touch event handlers and current swipe state
 *
 * @example
 * ```tsx
 * const { handlers, swipeState } = useSwipeGesture({
 *   threshold: 50,
 *   onSwipeLeft: () => console.log('Swiped left'),
 *   onSwipeRight: () => console.log('Swiped right'),
 * });
 *
 * return <div {...handlers}>Swipe me!</div>;
 * ```
 */
export function useSwipeGesture(config: SwipeGestureConfig = {}) {
  const {
    threshold = 50,
    maxDuration = 500,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    preventDefault = true,
  } = config;

  const touchStart = useRef<TouchPoint | null>(null);
  const [swipeState, setSwipeState] = useState<SwipeState>({
    isSwiping: false,
    direction: null,
    deltaX: 0,
    deltaY: 0,
  });

  const handleTouchStart = useCallback((e: React.TouchEvent | TouchEvent) => {
    if (preventDefault) {
      e.preventDefault();
    }

    const touch = e.touches[0];
    if (!touch) return;

    touchStart.current = {
      x: touch.clientX,
      y: touch.clientY,
      timestamp: Date.now(),
    };

    setSwipeState({
      isSwiping: true,
      direction: null,
      deltaX: 0,
      deltaY: 0,
    });
  }, [preventDefault]);

  const handleTouchMove = useCallback((e: React.TouchEvent | TouchEvent) => {
    if (!touchStart.current) return;

    const touch = e.touches[0];
    if (!touch) return;

    const deltaX = touch.clientX - touchStart.current.x;
    const deltaY = touch.clientY - touchStart.current.y;

    // Determine primary direction
    let direction: 'left' | 'right' | 'up' | 'down' | null = null;
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      direction = deltaX > 0 ? 'right' : 'left';
    } else {
      direction = deltaY > 0 ? 'down' : 'up';
    }

    setSwipeState({
      isSwiping: true,
      direction,
      deltaX,
      deltaY,
    });
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent | TouchEvent) => {
    if (!touchStart.current) return;

    const touch = e.changedTouches[0];
    if (!touch) return;

    const deltaX = touch.clientX - touchStart.current.x;
    const deltaY = touch.clientY - touchStart.current.y;
    const duration = Date.now() - touchStart.current.timestamp;

    // Check if swipe meets criteria
    const isValidSwipe = duration <= maxDuration;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (isValidSwipe) {
      // Horizontal swipe
      if (absX > absY && absX >= threshold) {
        if (deltaX > 0 && onSwipeRight) {
          onSwipeRight();
        } else if (deltaX < 0 && onSwipeLeft) {
          onSwipeLeft();
        }
      }
      // Vertical swipe
      else if (absY >= threshold) {
        if (deltaY > 0 && onSwipeDown) {
          onSwipeDown();
        } else if (deltaY < 0 && onSwipeUp) {
          onSwipeUp();
        }
      }
    }

    // Reset state
    touchStart.current = null;
    setSwipeState({
      isSwiping: false,
      direction: null,
      deltaX: 0,
      deltaY: 0,
    });
  }, [threshold, maxDuration, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]);

  const handlers = {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  };

  return {
    handlers,
    swipeState,
  };
}

export default useSwipeGesture;
