/**
 * Theme Context Provider
 *
 * Provides theme variant selection and persistence for the CNS Dashboard.
 * Supports 4 theme variants: light, dark, midLight, midDark
 *
 * Usage:
 *   const { currentTheme, themeVariant, setThemeVariant } = useThemeContext();
 *
 *   // Use in components
 *   <ThemeProvider theme={currentTheme}>
 *     <App />
 *   </ThemeProvider>
 */

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { Theme } from '@mui/material/styles';
import { ThemeVariant, themes } from '../theme';

interface ThemeContextType {
  themeVariant: ThemeVariant;
  setThemeVariant: (variant: ThemeVariant) => void;
  currentTheme: Theme;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'cns_dashboard_theme_variant';
const DEFAULT_THEME: ThemeVariant = 'light';

/**
 * Get initial theme variant from localStorage or default
 * Handles SSR, private browsing mode, and storage restrictions gracefully
 */
const getInitialThemeVariant = (): ThemeVariant => {
  if (typeof window === 'undefined') {
    return DEFAULT_THEME;
  }

  // Try to get stored preference (may fail in private browsing)
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (stored === 'light' || stored === 'dark' || stored === 'midLight' || stored === 'midDark')) {
      return stored as ThemeVariant;
    }
  } catch (error) {
    console.warn('[ThemeContext] localStorage unavailable, using default theme');
  }

  // Check system preference for dark mode
  try {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  } catch (error) {
    console.warn('[ThemeContext] matchMedia unavailable');
  }

  return DEFAULT_THEME;
};

export const ThemeContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeVariant, setThemeVariantState] = useState<ThemeVariant>(getInitialThemeVariant);

  // Persist theme variant to localStorage when it changes
  const setThemeVariant = useCallback((variant: ThemeVariant) => {
    setThemeVariantState(variant);
    try {
      localStorage.setItem(STORAGE_KEY, variant);
    } catch (error) {
      console.warn('[ThemeContext] Failed to persist theme to localStorage');
    }
  }, []);

  // Memoize current theme to avoid unnecessary re-renders
  const currentTheme = useMemo(() => themes[themeVariant], [themeVariant]);

  const value = useMemo(
    () => ({
      themeVariant,
      setThemeVariant,
      currentTheme,
    }),
    [themeVariant, setThemeVariant, currentTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useThemeContext = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within a ThemeContextProvider');
  }
  return context;
};
