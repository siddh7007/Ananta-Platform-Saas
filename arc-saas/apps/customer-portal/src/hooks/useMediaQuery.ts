import { useState, useEffect } from 'react';

/**
 * useMediaQuery Hook
 *
 * Tracks if a media query matches the current viewport state.
 * Automatically updates on window resize.
 *
 * @param query - CSS media query string (e.g., "(min-width: 640px)")
 * @returns boolean indicating if the query matches
 *
 * @example
 * ```tsx
 * // Check for tablet portrait
 * const isTabletPortrait = useMediaQuery(
 *   '(min-width: 640px) and (max-width: 1024px) and (orientation: portrait)'
 * );
 * ```
 */
export function useMediaQuery(query: string): boolean {
  // Initialize state based on current match (if window is available)
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    // Skip if window is not available (SSR)
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia(query);

    // Update state when media query match changes
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Set initial value
    setMatches(mediaQuery.matches);

    // Listen for changes (modern API)
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
    }

    // Cleanup
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        // Fallback for older browsers
        mediaQuery.removeListener(handleChange);
      }
    };
  }, [query]);

  return matches;
}

/**
 * Common breakpoint hooks
 */
export const useIsTabletPortrait = () =>
  useMediaQuery('(min-width: 640px) and (max-width: 1024px) and (orientation: portrait)');

export const useIsMobile = () => useMediaQuery('(max-width: 639px)');

export const useIsTablet = () => useMediaQuery('(min-width: 640px) and (max-width: 1024px)');

export const useIsDesktop = () => useMediaQuery('(min-width: 1025px)');
