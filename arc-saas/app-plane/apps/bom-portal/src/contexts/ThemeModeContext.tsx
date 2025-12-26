/**
 * Theme Mode Context
 *
 * Provides app-wide theme switching for react-admin apps.
 * Supports: light, light-dim, dark-soft, dark modes.
 *
 * Usage:
 *   const { mode, setMode, theme } = useThemeMode();
 *   setMode('dark');
 *
 * Pass theme to react-admin Admin component:
 *   <Admin theme={theme} ...>
 */

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { createTheme, ThemeProvider as MuiThemeProvider, Theme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// Theme mode types
export type ThemeMode = 'light' | 'light-dim' | 'dark-soft' | 'dark';

// Storage key for persisting theme preference
const THEME_STORAGE_KEY = 'app_theme';

// Context interface
interface ThemeModeContextType {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleDarkMode: () => void;
  isDark: boolean;
  theme: Theme;  // MUI theme object for react-admin
}

// Create context
const ThemeModeContext = createContext<ThemeModeContextType | undefined>(undefined);

// Base theme tokens (from theme/index.ts)
const baseThemeOptions = {
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    button: {
      textTransform: 'none' as const,
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none' as const,
          fontWeight: 600,
        },
      },
      defaultProps: {
        disableElevation: true,
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
  },
};

/**
 * Create theme for each mode
 */
function createModeTheme(mode: ThemeMode): Theme {
  switch (mode) {
    case 'dark':
      return createTheme({
        ...baseThemeOptions,
        palette: {
          mode: 'dark',
          primary: {
            main: '#60a5fa', // blue-400 (lighter for dark bg)
            light: '#93c5fd',
            dark: '#3b82f6',
          },
          secondary: {
            main: '#a78bfa', // purple-400
            light: '#c4b5fd',
            dark: '#8b5cf6',
          },
          background: {
            default: '#121212',
            paper: '#1e1e1e',
          },
          text: {
            primary: '#ffffff',
            secondary: '#a1a1aa',
          },
          divider: '#3f3f46',
          success: { main: '#4ade80' },
          warning: { main: '#fbbf24' },
          error: { main: '#f87171' },
          info: { main: '#60a5fa' },
        },
      });

    case 'dark-soft':
      return createTheme({
        ...baseThemeOptions,
        palette: {
          mode: 'dark',
          primary: {
            main: '#60a5fa',
            light: '#93c5fd',
            dark: '#3b82f6',
          },
          secondary: {
            main: '#a78bfa',
            light: '#c4b5fd',
            dark: '#8b5cf6',
          },
          background: {
            default: '#2d3748', // slate-700
            paper: '#3d4a5c',
          },
          text: {
            primary: '#e2e8f0',
            secondary: '#a0aec0',
          },
          divider: '#4a5568',
          success: { main: '#48bb78' },
          warning: { main: '#ed8936' },
          error: { main: '#fc8181' },
          info: { main: '#63b3ed' },
        },
      });

    case 'light-dim':
      return createTheme({
        ...baseThemeOptions,
        palette: {
          mode: 'light',
          primary: {
            main: '#3b82f6',
            light: '#60a5fa',
            dark: '#2563eb',
          },
          secondary: {
            main: '#8b5cf6',
            light: '#a78bfa',
            dark: '#7c3aed',
          },
          background: {
            default: '#f0ede6', // warm off-white
            paper: '#faf8f5',
          },
          text: {
            primary: '#2d3748',
            secondary: '#4a5568',
          },
          divider: '#d4cfc5',
          success: { main: '#22c55e' },
          warning: { main: '#f59e0b' },
          error: { main: '#ef4444' },
          info: { main: '#3b82f6' },
        },
      });

    case 'light':
    default:
      return createTheme({
        ...baseThemeOptions,
        palette: {
          mode: 'light',
          primary: {
            main: '#3b82f6',
            light: '#60a5fa',
            dark: '#2563eb',
          },
          secondary: {
            main: '#8b5cf6',
            light: '#a78bfa',
            dark: '#7c3aed',
          },
          background: {
            default: '#f9fafb',
            paper: '#ffffff',
          },
          text: {
            primary: '#111827',
            secondary: '#6b7280',
          },
          divider: '#e5e7eb',
          success: { main: '#22c55e' },
          warning: { main: '#f59e0b' },
          error: { main: '#ef4444' },
          info: { main: '#3b82f6' },
        },
      });
  }
}

/**
 * Theme Mode Provider
 */
interface ThemeModeProviderProps {
  children: ReactNode;
  defaultMode?: ThemeMode;
}

export function ThemeModeProvider({ children, defaultMode = 'light' }: ThemeModeProviderProps) {
  // Initialize from localStorage or default
  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
      if (saved && ['light', 'light-dim', 'dark-soft', 'dark'].includes(saved)) {
        return saved;
      }
    }
    return defaultMode;
  });

  // Create memoized theme
  const theme = useMemo(() => createModeTheme(mode), [mode]);

  // Set mode and persist
  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem(THEME_STORAGE_KEY, newMode);
  };

  // Toggle between light and dark
  const toggleDarkMode = () => {
    const newMode = mode === 'light' || mode === 'light-dim' ? 'dark' : 'light';
    setMode(newMode);
  };

  // Is currently dark mode?
  const isDark = mode === 'dark' || mode === 'dark-soft';

  // Apply CSS variables for non-MUI elements
  useEffect(() => {
    const root = document.documentElement;

    // Set CSS custom properties for non-MUI elements
    root.style.setProperty('--background-default', theme.palette.background.default);
    root.style.setProperty('--background-paper', theme.palette.background.paper);
    root.style.setProperty('--text-primary', theme.palette.text.primary);
    root.style.setProperty('--text-secondary', theme.palette.text.secondary);

    // Set data attribute for CSS selectors
    root.setAttribute('data-theme', mode);

    // Update body for immediate visual feedback
    document.body.style.backgroundColor = theme.palette.background.default;
    document.body.style.color = theme.palette.text.primary;
    document.body.style.transition = 'background-color 0.3s ease, color 0.3s ease';
  }, [mode, theme]);

  const contextValue = useMemo(
    () => ({ mode, setMode, toggleDarkMode, isDark, theme }),
    [mode, isDark, theme]
  );

  // Wrap with MuiThemeProvider so ALL MUI components receive the theme
  // (not just react-admin's internal components)
  return (
    <ThemeModeContext.Provider value={contextValue}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeModeContext.Provider>
  );
}

/**
 * Hook to use theme mode
 */
export function useThemeMode(): ThemeModeContextType {
  const context = useContext(ThemeModeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within a ThemeModeProvider');
  }
  return context;
}

/**
 * Get theme directly (for use outside React components)
 */
export { createModeTheme };

export default ThemeModeProvider;
