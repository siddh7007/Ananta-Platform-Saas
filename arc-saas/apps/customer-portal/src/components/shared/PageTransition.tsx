import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

/**
 * Animation variants for page transitions
 *
 * - fade: Simple opacity transition
 * - slide-up: Slides in from bottom
 * - slide-left: Slides in from right (forward navigation)
 * - slide-right: Slides in from left (back navigation)
 * - scale: Scales up from center
 * - none: No animation (instant)
 */
export type AnimationVariant = 'fade' | 'slide-up' | 'slide-left' | 'slide-right' | 'scale' | 'none';

/**
 * Animation duration presets
 *
 * - fast: 150ms
 * - normal: 200ms
 * - slow: 300ms
 */
export type AnimationDuration = 'fast' | 'normal' | 'slow';

/**
 * Transition state machine states
 */
export type TransitionState = 'entering' | 'entered' | 'exiting' | 'exited';

export interface PageTransitionProps {
  /** Content to animate */
  children: React.ReactNode;
  /** Animation variant to use */
  variant?: AnimationVariant;
  /** Animation duration preset */
  duration?: AnimationDuration;
  /** Additional CSS classes */
  className?: string;
  /**
   * Unique key to trigger re-animation on route change
   * Pass the current route pathname or a unique identifier
   */
  transitionKey?: string;
  /**
   * Callback when transition completes
   */
  onTransitionComplete?: (state: TransitionState) => void;
  /**
   * Disable animation (useful for testing or accessibility)
   */
  disabled?: boolean;
}

/**
 * Duration mappings in milliseconds
 */
const DURATION_MS: Record<AnimationDuration, number> = {
  fast: 150,
  normal: 200,
  slow: 300,
};

/**
 * PageTransition Component
 *
 * Provides smooth page transitions using CSS animations with proper
 * mounting/unmounting state management. Respects user's motion preferences.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <PageTransition variant="fade">
 *   <YourPageContent />
 * </PageTransition>
 *
 * // With route-based transitions
 * <PageTransition
 *   variant="slide-left"
 *   duration="fast"
 *   transitionKey={location.pathname}
 * >
 *   <YourPageContent />
 * </PageTransition>
 * ```
 */
export function PageTransition({
  children,
  variant = 'fade',
  duration = 'normal',
  className,
  transitionKey,
  onTransitionComplete,
  disabled = false,
}: PageTransitionProps) {
  const [transitionState, setTransitionState] = useState<TransitionState>('entering');
  const [displayChildren, setDisplayChildren] = useState(children);
  const prevKeyRef = useRef<string | undefined>(transitionKey);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const durationMs = DURATION_MS[duration];

  /**
   * Handle transition state changes with callbacks
   */
  const updateTransitionState = useCallback(
    (newState: TransitionState) => {
      setTransitionState(newState);
      onTransitionComplete?.(newState);
    },
    [onTransitionComplete]
  );

  /**
   * Handle initial mount and transition key changes
   */
  useEffect(() => {
    // If disabled, immediately show content
    if (disabled) {
      updateTransitionState('entered');
      return;
    }

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Check if transition key changed (route navigation)
    const keyChanged = transitionKey !== prevKeyRef.current;
    prevKeyRef.current = transitionKey;

    if (keyChanged && transitionKey !== undefined) {
      // Exit current content
      updateTransitionState('exiting');

      timeoutRef.current = setTimeout(() => {
        // Update children during exit phase (invisible)
        setDisplayChildren(children);
        updateTransitionState('exited');

        // Start entering new content
        requestAnimationFrame(() => {
          updateTransitionState('entering');

          timeoutRef.current = setTimeout(() => {
            updateTransitionState('entered');
          }, durationMs);
        });
      }, durationMs);
    } else {
      // Initial mount
      updateTransitionState('entering');
      setDisplayChildren(children);

      timeoutRef.current = setTimeout(() => {
        updateTransitionState('entered');
      }, durationMs);
    }

    // Cleanup timeout on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [transitionKey, children, durationMs, disabled, updateTransitionState]);

  /**
   * Update children immediately if transition key hasn't changed
   */
  useEffect(() => {
    if (transitionKey === prevKeyRef.current) {
      setDisplayChildren(children);
    }
  }, [children, transitionKey]);

  // Skip animation classes if disabled or variant is 'none'
  if (disabled || variant === 'none') {
    return <div className={className}>{children}</div>;
  }

  /**
   * Build CSS classes based on animation state
   */
  const animationClasses = cn(
    'page-transition',
    `page-transition-${variant}`,
    `page-transition-${duration}`,
    {
      'page-transition-entering': transitionState === 'entering',
      'page-transition-entered': transitionState === 'entered',
      'page-transition-exiting': transitionState === 'exiting',
      'page-transition-exited': transitionState === 'exited',
    },
    className
  );

  return (
    <div className={animationClasses} data-transition-state={transitionState}>
      {displayChildren}
    </div>
  );
}

/**
 * Hook to access current page transition state
 * Useful for coordinating animations with other components
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { state, triggerTransition } = usePageTransition();
 *
 *   const handleNavigate = () => {
 *     triggerTransition(() => {
 *       // Navigate after exit animation
 *       navigate('/new-page');
 *     });
 *   };
 * }
 * ```
 */
export function usePageTransition() {
  const [state, setState] = useState<TransitionState>('entered');
  const [isTransitioning, setIsTransitioning] = useState(false);

  const triggerTransition = useCallback(
    (callback?: () => void, duration: AnimationDuration = 'normal') => {
      setIsTransitioning(true);
      setState('exiting');

      const durationMs = DURATION_MS[duration];

      setTimeout(() => {
        setState('exited');
        callback?.();

        requestAnimationFrame(() => {
          setState('entering');

          setTimeout(() => {
            setState('entered');
            setIsTransitioning(false);
          }, durationMs);
        });
      }, durationMs);
    },
    []
  );

  return {
    state,
    isTransitioning,
    triggerTransition,
  };
}

/**
 * Pre-built transition variants for common navigation patterns
 */
export const PAGE_TRANSITIONS = {
  /** Simple fade in/out */
  fade: { variant: 'fade' as const, duration: 'normal' as const },

  /** Slide up from bottom */
  slideUp: { variant: 'slide-up' as const, duration: 'normal' as const },

  /** Slide from right (forward navigation) */
  forward: { variant: 'slide-left' as const, duration: 'normal' as const },

  /** Slide from left (back navigation) */
  back: { variant: 'slide-right' as const, duration: 'normal' as const },

  /** Scale from center */
  scale: { variant: 'scale' as const, duration: 'normal' as const },

  /** Quick fade for subtle transitions */
  subtle: { variant: 'fade' as const, duration: 'fast' as const },

  /** Slow, dramatic slide */
  dramatic: { variant: 'slide-up' as const, duration: 'slow' as const },

  /** No animation */
  instant: { variant: 'none' as const, duration: 'fast' as const },
} as const;

/**
 * Utility function to get animation classes without using the component
 * Useful for custom implementations
 */
export function getTransitionClasses(
  variant: AnimationVariant,
  duration: AnimationDuration,
  state: TransitionState
): string {
  return cn(
    'page-transition',
    `page-transition-${variant}`,
    `page-transition-${duration}`,
    `page-transition-${state}`
  );
}
