import { useState, useEffect } from 'react';

export interface SafeAreaInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * Hook to get safe area insets (for devices with notches)
 *
 * @returns Safe area inset values in pixels
 *
 * @example
 * const insets = useSafeAreaInsets();
 *
 * <div style={{ paddingTop: insets.top }}>
 *   Content below notch
 * </div>
 */
export function useSafeAreaInsets(): SafeAreaInsets {
  const getInsets = (): SafeAreaInsets => {
    if (typeof window === 'undefined' || typeof getComputedStyle === 'undefined') {
      return { top: 0, bottom: 0, left: 0, right: 0 };
    }

    const style = getComputedStyle(document.documentElement);

    const parseInset = (value: string): number => {
      const parsed = parseInt(value, 10);
      return isNaN(parsed) ? 0 : parsed;
    };

    return {
      top: parseInset(style.getPropertyValue('env(safe-area-inset-top)').replace('px', '')),
      bottom: parseInset(style.getPropertyValue('env(safe-area-inset-bottom)').replace('px', '')),
      left: parseInset(style.getPropertyValue('env(safe-area-inset-left)').replace('px', '')),
      right: parseInset(style.getPropertyValue('env(safe-area-inset-right)').replace('px', '')),
    };
  };

  const [insets, setInsets] = useState<SafeAreaInsets>(getInsets);

  useEffect(() => {
    const handleResize = () => {
      setInsets(getInsets());
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return insets;
}

/**
 * Hook to get safe area inset as CSS variable string
 *
 * @example
 * const safeAreaCSS = useSafeAreaInsetsCSS();
 *
 * <div style={{ paddingTop: safeAreaCSS.top }}>
 *   Content with env() values
 * </div>
 */
export function useSafeAreaInsetsCSS() {
  return {
    top: 'env(safe-area-inset-top, 0px)',
    bottom: 'env(safe-area-inset-bottom, 0px)',
    left: 'env(safe-area-inset-left, 0px)',
    right: 'env(safe-area-inset-right, 0px)',
  };
}

/**
 * Hook to check if device has safe area insets (has a notch)
 */
export function useHasSafeAreaInsets(): boolean {
  const insets = useSafeAreaInsets();
  return insets.top > 0 || insets.bottom > 0 || insets.left > 0 || insets.right > 0;
}
