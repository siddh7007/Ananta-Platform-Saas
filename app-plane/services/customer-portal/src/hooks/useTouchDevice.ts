import { useState, useEffect } from 'react';

export interface TouchDeviceState {
  isTouchDevice: boolean;
  hasCoarsePointer: boolean;
  hasFinePointer: boolean;
  supportsHover: boolean;
  isTablet: boolean;
  isMobile: boolean;
  isDesktop: boolean;
}

/**
 * Hook to detect touch device capabilities
 *
 * @returns Device capability information
 *
 * @example
 * const { isTouchDevice, isTablet, supportsHover } = useTouchDevice();
 *
 * if (isTablet) {
 *   return <TabletLayout />;
 * }
 */
export function useTouchDevice(): TouchDeviceState {
  const getDeviceState = (): TouchDeviceState => {
    if (typeof window === 'undefined') {
      return {
        isTouchDevice: false,
        hasCoarsePointer: false,
        hasFinePointer: true,
        supportsHover: true,
        isTablet: false,
        isMobile: false,
        isDesktop: true,
      };
    }

    // Check for touch support
    const isTouchDevice =
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      // @ts-ignore - legacy property
      navigator.msMaxTouchPoints > 0;

    // Check pointer capabilities using media queries
    const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
    const hasFinePointer = window.matchMedia('(pointer: fine)').matches;
    const supportsHover = window.matchMedia('(hover: hover)').matches;

    // Determine device type based on screen size and capabilities
    const width = window.innerWidth;
    const height = window.innerHeight;
    const maxDimension = Math.max(width, height);
    const minDimension = Math.min(width, height);

    // Tablet detection: 768px - 1366px, touch enabled
    const isTablet =
      isTouchDevice &&
      minDimension >= 768 &&
      maxDimension <= 1366;

    // Mobile detection: < 768px, touch enabled
    const isMobile =
      isTouchDevice &&
      maxDimension < 768;

    // Desktop: > 1366px or no touch support
    const isDesktop =
      !isTouchDevice ||
      minDimension > 1366;

    return {
      isTouchDevice,
      hasCoarsePointer,
      hasFinePointer,
      supportsHover,
      isTablet,
      isMobile,
      isDesktop,
    };
  };

  const [deviceState, setDeviceState] = useState<TouchDeviceState>(getDeviceState);

  useEffect(() => {
    const handleResize = () => {
      setDeviceState(getDeviceState());
    };

    window.addEventListener('resize', handleResize);

    // Also listen for pointer media query changes
    const coarsePointerMql = window.matchMedia('(pointer: coarse)');
    const finePointerMql = window.matchMedia('(pointer: fine)');
    const hoverMql = window.matchMedia('(hover: hover)');

    const handleMediaQueryChange = () => {
      setDeviceState(getDeviceState());
    };

    // Modern browsers
    if (coarsePointerMql.addEventListener) {
      coarsePointerMql.addEventListener('change', handleMediaQueryChange);
      finePointerMql.addEventListener('change', handleMediaQueryChange);
      hoverMql.addEventListener('change', handleMediaQueryChange);
    } else {
      // Legacy browsers
      // @ts-ignore
      coarsePointerMql.addListener(handleMediaQueryChange);
      // @ts-ignore
      finePointerMql.addListener(handleMediaQueryChange);
      // @ts-ignore
      hoverMql.addListener(handleMediaQueryChange);
    }

    return () => {
      window.removeEventListener('resize', handleResize);

      if (coarsePointerMql.removeEventListener) {
        coarsePointerMql.removeEventListener('change', handleMediaQueryChange);
        finePointerMql.removeEventListener('change', handleMediaQueryChange);
        hoverMql.removeEventListener('change', handleMediaQueryChange);
      } else {
        // @ts-ignore
        coarsePointerMql.removeListener(handleMediaQueryChange);
        // @ts-ignore
        finePointerMql.removeListener(handleMediaQueryChange);
        // @ts-ignore
        hoverMql.removeListener(handleMediaQueryChange);
      }
    };
  }, []);

  return deviceState;
}

/**
 * Hook to detect if current device is a tablet
 */
export function useIsTablet(): boolean {
  const { isTablet } = useTouchDevice();
  return isTablet;
}

/**
 * Hook to detect if current device is mobile
 */
export function useIsMobile(): boolean {
  const { isMobile } = useTouchDevice();
  return isMobile;
}

/**
 * Hook to detect if current device is desktop
 */
export function useIsDesktop(): boolean {
  const { isDesktop } = useTouchDevice();
  return isDesktop;
}
