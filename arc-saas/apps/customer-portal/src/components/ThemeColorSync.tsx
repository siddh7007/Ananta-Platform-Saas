/**
 * ThemeColorSync Component
 *
 * Invisible component that syncs the browser's theme-color meta tag
 * with the current resolved theme from next-themes.
 *
 * Place this inside the ThemeProvider to keep browser chrome in sync.
 */

import { useThemeColor } from '@/hooks/useThemeColor';

export function ThemeColorSync() {
  useThemeColor();
  return null;
}

export default ThemeColorSync;
