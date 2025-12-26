/**
 * useThemeColor Hook
 *
 * Syncs the <meta name="theme-color"> tag with the current resolved theme.
 * This keeps the browser chrome (address bar, etc.) matching the active theme.
 *
 * Must be used within a next-themes ThemeProvider.
 */

import { useEffect } from 'react';
import { useTheme } from 'next-themes';

const THEME_COLORS: Record<string, string> = {
  light: '#ffffff',
  dark: '#0a0a1a',
  'mid-light': '#f0f2f5',
  'mid-dark': '#1a1d24',
};

export function useThemeColor() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!resolvedTheme) return;

    const color = THEME_COLORS[resolvedTheme] || THEME_COLORS.light;
    const meta = document.querySelector('meta[name="theme-color"]');

    if (meta) {
      meta.setAttribute('content', color);
    } else {
      // Create meta tag if it doesn't exist
      const newMeta = document.createElement('meta');
      newMeta.name = 'theme-color';
      newMeta.content = color;
      document.head.appendChild(newMeta);
    }
  }, [resolvedTheme]);
}

export default useThemeColor;
