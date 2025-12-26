import { createTheme, ThemeOptions } from '@mui/material/styles';

/**
 * Cyberpunk / Glassmorphism Theme
 * 
 * Characteristics:
 * - Dark Mode Only: Deep blue/black background (#0f172a)
 * - Translucency: Glass effect cards
 * - Neon Accents: Cyan (#06b6d4) and Magenta (#d946ef)
 * - Typography: Monospace + Geometric Sans
 */

const cyberpunkPalette = {
  mode: 'dark' as const,
  primary: {
    main: '#06b6d4', // Cyan
    light: '#67e8f9',
    dark: '#0891b2',
    contrastText: '#000000',
  },
  secondary: {
    main: '#d946ef', // Magenta
    light: '#f0abfc',
    dark: '#c026d3',
    contrastText: '#ffffff',
  },
  background: {
    default: '#0f172a', // Deep blue/black
    paper: 'rgba(30, 41, 59, 0.7)', // Semi-transparent slate
  },
  text: {
    primary: '#f8fafc', // Slate 50
    secondary: '#94a3b8', // Slate 400
  },
  divider: 'rgba(148, 163, 184, 0.1)',
  success: {
    main: '#10b981', // Emerald 500
    contrastText: '#ffffff',
  },
  warning: {
    main: '#f59e0b', // Amber 500
    contrastText: '#000000',
  },
  error: {
    main: '#ef4444', // Red 500
    contrastText: '#ffffff',
  },
  info: {
    main: '#3b82f6', // Blue 500
    contrastText: '#ffffff',
  },
};

const cyberpunkTypography = {
  fontFamily: [
    'Inter',
    'system-ui',
    'sans-serif',
  ].join(','),
  // Use Monospace for data-heavy elements if possible, or headers
  h1: { fontFamily: '"JetBrains Mono", monospace', fontWeight: 700, letterSpacing: '-0.025em' },
  h2: { fontFamily: '"JetBrains Mono", monospace', fontWeight: 700, letterSpacing: '-0.025em' },
  h3: { fontFamily: '"JetBrains Mono", monospace', fontWeight: 700, letterSpacing: '-0.025em' },
  h4: { fontFamily: '"JetBrains Mono", monospace', fontWeight: 600, letterSpacing: '-0.025em' },
  h5: { fontFamily: '"JetBrains Mono", monospace', fontWeight: 600, letterSpacing: '-0.025em' },
  h6: { fontFamily: '"JetBrains Mono", monospace', fontWeight: 600, letterSpacing: '-0.025em' },
  button: { fontFamily: '"JetBrains Mono", monospace', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
  body1: { fontSize: '0.95rem' },
  body2: { fontSize: '0.875rem' },
};

export const cyberpunkTheme = createTheme({
  palette: cyberpunkPalette,
  typography: cyberpunkTypography,
  shape: {
    borderRadius: 0, // Sharp edges for cyberpunk feel, or slight round
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#0f172a',
          backgroundImage: `radial-gradient(circle at 50% 0%, #1e293b 0%, #0f172a 70%)`,
          minHeight: '100vh',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(6, 182, 212, 0.2)', // Cyan glow border
          boxShadow: 'none',
          color: '#06b6d4',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          backdropFilter: 'blur(12px)',
          borderRight: '1px solid rgba(6, 182, 212, 0.1)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
          transition: 'all 0.3s ease-in-out',
          '&:hover': {
            border: '1px solid rgba(6, 182, 212, 0.5)', // Cyan hover glow
            boxShadow: '0 0 15px rgba(6, 182, 212, 0.2)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
        elevation1: {
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          boxShadow: 'none',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 2,
        },
        contained: {
          backgroundColor: 'rgba(6, 182, 212, 0.1)',
          color: '#06b6d4',
          border: '1px solid rgba(6, 182, 212, 0.5)',
          boxShadow: '0 0 10px rgba(6, 182, 212, 0.1)',
          '&:hover': {
            backgroundColor: 'rgba(6, 182, 212, 0.2)',
            boxShadow: '0 0 20px rgba(6, 182, 212, 0.3)',
            border: '1px solid #06b6d4',
          },
        },
        outlined: {
          borderColor: 'rgba(217, 70, 239, 0.5)', // Magenta border
          color: '#d946ef',
          '&:hover': {
            borderColor: '#d946ef',
            backgroundColor: 'rgba(217, 70, 239, 0.1)',
            boxShadow: '0 0 15px rgba(217, 70, 239, 0.2)',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
          color: '#cbd5e1',
          fontFamily: '"JetBrains Mono", monospace', // Data in monospace
          fontSize: '0.85rem',
        },
        head: {
          fontWeight: 700,
          backgroundColor: 'rgba(15, 23, 42, 0.5)',
          color: '#06b6d4', // Cyan headers
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          fontFamily: '"JetBrains Mono", monospace',
          border: '1px solid transparent',
        },
        filled: {
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
        },
        outlined: {
          borderColor: 'rgba(255, 255, 255, 0.2)',
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          borderRadius: 0,
        },
        bar: {
          backgroundColor: '#06b6d4',
          boxShadow: '0 0 10px #06b6d4',
        },
      },
    },
    MuiListItemIcon: {
      styleOverrides: {
        root: {
          color: '#06b6d4', // Cyan icons
        },
      },
    },
  },
});

/**
 * Linear-Style Minimalist Theme
 * 
 * Characteristics:
 * - High contrast (Black/White)
 * - Micro-borders (1px) instead of shadows
 * - Clean typography (Inter/System)
 * - Professional, data-dense feel
 */

const palette = {
  mode: 'light' as const,
  primary: {
    main: '#000000', // Black
    light: '#333333',
    dark: '#000000',
    contrastText: '#ffffff',
  },
  secondary: {
    main: '#525252', // Neutral Gray
    light: '#737373',
    dark: '#262626',
    contrastText: '#ffffff',
  },
  background: {
    default: '#f9fafb', // Very light gray for app background
    paper: '#ffffff',   // White for cards/panels
  },
  text: {
    primary: '#171717',
    secondary: '#525252',
  },
  divider: '#e5e5e5',
  success: {
    main: '#10b981', // Emerald 500
    light: '#d1fae5',
    contrastText: '#064e3b',
  },
  warning: {
    main: '#f59e0b', // Amber 500
    light: '#fef3c7',
    contrastText: '#78350f',
  },
  error: {
    main: '#ef4444', // Red 500
    light: '#fee2e2',
    contrastText: '#7f1d1d',
  },
  info: {
    main: '#3b82f6', // Blue 500
    light: '#dbeafe',
    contrastText: '#1e3a8a',
  },
};

const typography = {
  fontFamily: [
    'Inter',
    '-apple-system',
    'BlinkMacSystemFont',
    '"Segoe UI"',
    'Roboto',
    '"Helvetica Neue"',
    'Arial',
    'sans-serif',
  ].join(','),
  h1: { fontWeight: 700, letterSpacing: '-0.025em' },
  h2: { fontWeight: 700, letterSpacing: '-0.025em' },
  h3: { fontWeight: 700, letterSpacing: '-0.025em' },
  h4: { fontWeight: 600, letterSpacing: '-0.025em' },
  h5: { fontWeight: 600, letterSpacing: '-0.025em' },
  h6: { fontWeight: 600, letterSpacing: '-0.025em' },
  button: { fontWeight: 600, textTransform: 'none' as const },
};

export const linearTheme = createTheme({
  palette,
  typography,
  shape: {
    borderRadius: 2, // Very subtle rounding
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#f9fafb',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff',
          color: '#171717',
          boxShadow: 'none',
          borderBottom: '1px solid #e5e5e5',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#ffffff',
          borderRight: '1px solid #e5e5e5',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
          border: '1px solid #e5e5e5',
          borderRadius: 4,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
          backgroundImage: 'none', // Remove elevation overlay in dark mode if we switch
        },
        elevation1: {
          boxShadow: 'none',
          border: '1px solid #e5e5e5',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
          borderRadius: 4,
          '&:hover': {
            boxShadow: 'none',
          },
        },
        contained: {
          backgroundColor: '#000000',
          color: '#ffffff',
          '&:hover': {
            backgroundColor: '#333333',
          },
        },
        outlined: {
          borderColor: '#e5e5e5',
          color: '#171717',
          '&:hover': {
            backgroundColor: '#f5f5f5',
            borderColor: '#d4d4d4',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid #e5e5e5',
        },
        head: {
          fontWeight: 600,
          backgroundColor: '#f9fafb',
          color: '#525252',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          fontWeight: 500,
        },
        outlined: {
          borderColor: '#e5e5e5',
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          backgroundColor: '#e5e5e5',
          borderRadius: 2,
        },
      },
    },
  },
});
