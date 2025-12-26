import { useState, useEffect } from 'react';

export type Orientation = 'portrait' | 'landscape';

export interface OrientationState {
  orientation: Orientation;
  isPortrait: boolean;
  isLandscape: boolean;
  angle: number;
}

/**
 * Hook to detect device orientation
 *
 * @returns Current orientation state
 *
 * @example
 * const { isPortrait, isLandscape, orientation } = useOrientation();
 *
 * if (isPortrait) {
 *   return <PortraitLayout />;
 * }
 * return <LandscapeLayout />;
 */
export function useOrientation(): OrientationState {
  const getOrientation = (): OrientationState => {
    // Check window.screen.orientation if available
    if (typeof window !== 'undefined' && window.screen?.orientation) {
      const type = window.screen.orientation.type;
      const angle = window.screen.orientation.angle;
      const isPortrait = type.includes('portrait');

      return {
        orientation: isPortrait ? 'portrait' : 'landscape',
        isPortrait,
        isLandscape: !isPortrait,
        angle,
      };
    }

    // Fallback to window dimensions
    if (typeof window !== 'undefined') {
      const isPortrait = window.innerHeight > window.innerWidth;
      return {
        orientation: isPortrait ? 'portrait' : 'landscape',
        isPortrait,
        isLandscape: !isPortrait,
        angle: isPortrait ? 0 : 90,
      };
    }

    // SSR fallback
    return {
      orientation: 'portrait',
      isPortrait: true,
      isLandscape: false,
      angle: 0,
    };
  };

  const [orientationState, setOrientationState] = useState<OrientationState>(getOrientation);

  useEffect(() => {
    const handleOrientationChange = () => {
      setOrientationState(getOrientation());
    };

    // Listen for orientation changes
    if (typeof window !== 'undefined') {
      // Modern API
      if (window.screen?.orientation) {
        window.screen.orientation.addEventListener('change', handleOrientationChange);
      } else {
        // Legacy API fallback
        window.addEventListener('orientationchange', handleOrientationChange);
      }

      // Also listen for resize (catches all cases)
      window.addEventListener('resize', handleOrientationChange);
    }

    return () => {
      if (typeof window !== 'undefined') {
        if (window.screen?.orientation) {
          window.screen.orientation.removeEventListener('change', handleOrientationChange);
        } else {
          window.removeEventListener('orientationchange', handleOrientationChange);
        }
        window.removeEventListener('resize', handleOrientationChange);
      }
    };
  }, []);

  return orientationState;
}

/**
 * Hook to detect if device is in portrait mode
 *
 * @returns true if portrait, false if landscape
 */
export function useIsPortrait(): boolean {
  const { isPortrait } = useOrientation();
  return isPortrait;
}

/**
 * Hook to detect if device is in landscape mode
 *
 * @returns true if landscape, false if portrait
 */
export function useIsLandscape(): boolean {
  const { isLandscape } = useOrientation();
  return isLandscape;
}
