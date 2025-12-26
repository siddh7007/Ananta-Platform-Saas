/**
 * Customer Portal Theme Configuration
 *
 * Centralized design tokens for consistent styling across the application.
 * Extends MUI theme with semantic palettes for risk, alerts, grades, and status.
 *
 * @see PROMPT_CLAUDE.md for token documentation and hex mapping
 */

import { createTheme, ThemeOptions } from '@mui/material/styles';

// =============================================================================
// SEMANTIC COLOR TOKENS
// =============================================================================

/**
 * Risk Level Colors
 * Used for component and BOM risk indicators throughout the app.
 */
export const riskColors = {
  low: '#4caf50',       // Green - healthy/safe components
  medium: '#ff9800',    // Orange - attention needed
  high: '#f44336',      // Red - significant risk
  critical: '#9c27b0',  // Purple - urgent action required
} as const;

/**
 * Risk Factor Colors
 * Used for displaying individual risk factor scores in breakdowns.
 */
export const riskFactorColors = {
  lifecycle: '#2196f3',      // Blue - EOL/lifecycle status
  supply_chain: '#ff9800',   // Orange - availability/lead times
  compliance: '#4caf50',     // Green - regulatory compliance
  obsolescence: '#f44336',   // Red - obsolescence prediction
  single_source: '#9c27b0',  // Purple - supplier diversity
} as const;

/**
 * BOM Health Grade Colors
 * Letter grade system for BOM health scoring.
 */
export const gradeColors = {
  A: '#4caf50',   // Excellent - Green
  B: '#8bc34a',   // Good - Light Green
  C: '#ff9800',   // Fair - Orange
  D: '#f44336',   // Poor - Red
  F: '#9c27b0',   // Critical - Purple
} as const;

/**
 * Alert Type Colors
 * Colors for different alert categories.
 */
export const alertTypeColors = {
  LIFECYCLE: '#2196f3',     // Blue - component lifecycle changes
  RISK: '#ff9800',          // Orange - risk score changes
  PRICE: '#4caf50',         // Green - price changes
  AVAILABILITY: '#9c27b0',  // Purple - stock/availability
  COMPLIANCE: '#f44336',    // Red - regulatory compliance
  PCN: '#607d8b',           // Blue-grey - PCN/PDN notices
  SUPPLY_CHAIN: '#795548',  // Brown - supply chain disruptions
} as const;

/**
 * Alert Severity Colors
 * Maps to MUI palette colors for severity indicators.
 */
export const alertSeverityColors = {
  info: '#2196f3',      // Blue
  warning: '#ff9800',   // Orange
  critical: '#f44336',  // Red
} as const;

/**
 * Project Type Colors
 * Visual differentiation for project categories.
 */
export const projectTypeColors = {
  development: '#2196F3',   // Blue
  production: '#4CAF50',    // Green
  maintenance: '#FFC107',   // Yellow
  archived: '#9E9E9E',      // Gray
  other: '#757575',         // Dark Gray
} as const;

/**
 * Project Status Colors
 * Status indicator colors for project states.
 */
export const projectStatusColors = {
  active: '#4CAF50',        // Green
  on_hold: '#FFC107',       // Yellow
  archived: '#9E9E9E',      // Gray
  completed: '#2196F3',     // Blue
  in_progress: '#FF9800',   // Orange
} as const;

/**
 * Workflow Status Colors
 * Used for BOM upload, enrichment, and job status indicators.
 */
export const workflowStatusColors = {
  pending: '#9E9E9E',       // Gray
  processing: '#2196F3',    // Blue
  completed: '#4CAF50',     // Green
  failed: '#f44336',        // Red
  cancelled: '#757575',     // Dark Gray
  mapping_pending: '#FFC107', // Yellow
} as const;

/**
 * Quality Score Colors
 * For component data quality indicators.
 */
export const qualityColors = {
  excellent: '#4caf50',  // 90-100
  good: '#8bc34a',       // 70-89
  fair: '#ff9800',       // 50-69
  poor: '#f44336',       // 0-49
} as const;

// =============================================================================
// TYPOGRAPHY SCALE
// =============================================================================

/**
 * Typography scale with semantic naming for consistent text styling.
 */
export const typographyScale = {
  // Page headers
  pageTitle: {
    fontSize: '2rem',       // 32px
    fontWeight: 700,
    lineHeight: 1.2,
  },
  sectionTitle: {
    fontSize: '1.5rem',     // 24px
    fontWeight: 600,
    lineHeight: 1.3,
  },
  cardTitle: {
    fontSize: '1.125rem',   // 18px
    fontWeight: 600,
    lineHeight: 1.4,
  },

  // Metrics and stats
  metricValue: {
    fontSize: '2rem',       // 32px
    fontWeight: 700,
    lineHeight: 1,
  },
  metricLabel: {
    fontSize: '0.75rem',    // 12px
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },

  // Body text
  bodyLarge: {
    fontSize: '1rem',       // 16px
    fontWeight: 400,
    lineHeight: 1.5,
  },
  bodyMedium: {
    fontSize: '0.875rem',   // 14px
    fontWeight: 400,
    lineHeight: 1.5,
  },
  bodySmall: {
    fontSize: '0.75rem',    // 12px
    fontWeight: 400,
    lineHeight: 1.4,
  },

  // Labels and captions
  label: {
    fontSize: '0.75rem',    // 12px
    fontWeight: 500,
    lineHeight: 1.4,
  },
  caption: {
    fontSize: '0.6875rem',  // 11px
    fontWeight: 400,
    lineHeight: 1.4,
  },

  // Chips and badges
  chipLabel: {
    fontSize: '0.6875rem',  // 11px
    fontWeight: 600,
  },
  badgeLabel: {
    fontSize: '0.625rem',   // 10px
    fontWeight: 700,
  },
} as const;

// =============================================================================
// SPACING SCALE
// =============================================================================

/**
 * Semantic spacing scale (in theme spacing units, 1 unit = 8px)
 */
export const spacingScale = {
  // Component internals
  xxs: 0.5,   // 4px  - tight spacing within components
  xs: 1,      // 8px  - default internal padding
  sm: 1.5,   // 12px - comfortable internal spacing
  md: 2,      // 16px - section spacing
  lg: 3,      // 24px - card padding
  xl: 4,      // 32px - section gaps
  xxl: 6,     // 48px - page section spacing
} as const;

/**
 * Layout spacing for page structure
 */
export const layoutSpacing = {
  pagePadding: 3,       // 24px - page content padding
  sectionGap: 3,        // 24px - gap between page sections
  cardGap: 2,           // 16px - gap between cards in grid
  gridGap: 3,           // 24px - gap in grid layouts
} as const;

// =============================================================================
// BORDER RADIUS SCALE
// =============================================================================

export const borderRadiusScale = {
  xs: 4,      // Small elements (chips, badges)
  sm: 8,      // Buttons, inputs
  md: 12,     // Cards, dialogs
  lg: 16,     // Large containers
  xl: 24,     // Hero sections
  full: 9999, // Circular elements
} as const;

// =============================================================================
// SHADOW SCALE
// =============================================================================

export const shadowScale = {
  xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  sm: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
} as const;

// =============================================================================
// MUI THEME CONFIGURATION
// =============================================================================

const themeOptions: ThemeOptions = {
  palette: {
    primary: {
      main: '#3b82f6',      // blue-500
      light: '#60a5fa',     // blue-400
      dark: '#2563eb',      // blue-600
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#8b5cf6',      // purple-500
      light: '#a78bfa',     // purple-400
      dark: '#7c3aed',      // purple-600
      contrastText: '#ffffff',
    },
    success: {
      main: '#22c55e',      // green-500
      light: '#4ade80',     // green-400
      dark: '#16a34a',      // green-600
      contrastText: '#ffffff',
    },
    warning: {
      main: '#f59e0b',      // amber-500 (slightly adjusted from yellow)
      light: '#fbbf24',     // amber-400
      dark: '#d97706',      // amber-600
      contrastText: '#ffffff',
    },
    error: {
      main: '#ef4444',      // red-500
      light: '#f87171',     // red-400
      dark: '#dc2626',      // red-600
      contrastText: '#ffffff',
    },
    info: {
      main: '#3b82f6',      // blue-500
      light: '#60a5fa',     // blue-400
      dark: '#2563eb',      // blue-600
      contrastText: '#ffffff',
    },
    grey: {
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db',
      400: '#9ca3af',
      500: '#6b7280',
      600: '#4b5563',
      700: '#374151',
      800: '#1f2937',
      900: '#111827',
    },
    background: {
      default: '#f9fafb',   // grey-50
      paper: '#ffffff',
    },
    text: {
      primary: '#111827',   // grey-900
      secondary: '#6b7280', // grey-500
      disabled: '#9ca3af',  // grey-400
    },
    divider: '#e5e7eb',     // grey-200
  },
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
    h1: {
      fontSize: '2.5rem',
      fontWeight: 700,
      lineHeight: 1.2,
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 700,
      lineHeight: 1.25,
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 600,
      lineHeight: 1.3,
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 600,
      lineHeight: 1.35,
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h6: {
      fontSize: '1.125rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    subtitle1: {
      fontSize: '1rem',
      fontWeight: 500,
      lineHeight: 1.5,
    },
    subtitle2: {
      fontSize: '0.875rem',
      fontWeight: 500,
      lineHeight: 1.5,
    },
    body1: {
      fontSize: '1rem',
      fontWeight: 400,
      lineHeight: 1.5,
    },
    body2: {
      fontSize: '0.875rem',
      fontWeight: 400,
      lineHeight: 1.5,
    },
    caption: {
      fontSize: '0.75rem',
      fontWeight: 400,
      lineHeight: 1.4,
    },
    overline: {
      fontSize: '0.6875rem',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      lineHeight: 1.4,
    },
    button: {
      fontSize: '0.875rem',
      fontWeight: 600,
      textTransform: 'none',
    },
  },
  shape: {
    borderRadius: borderRadiusScale.sm,
  },
  spacing: 8, // Base spacing unit
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: borderRadiusScale.sm,
          textTransform: 'none',
          fontWeight: 600,
          padding: '8px 16px',
        },
        sizeSmall: {
          padding: '4px 12px',
          fontSize: '0.8125rem',
        },
        sizeLarge: {
          padding: '12px 24px',
          fontSize: '1rem',
        },
      },
      defaultProps: {
        disableElevation: true,
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: borderRadiusScale.md,
          boxShadow: shadowScale.sm,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none', // Remove default gradient
        },
        rounded: {
          borderRadius: borderRadiusScale.md,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
        },
        sizeSmall: {
          fontSize: '0.6875rem',
          height: 20,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 600,
          backgroundColor: '#f9fafb',
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          minHeight: 48,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: borderRadiusScale.sm,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: borderRadiusScale.md,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          fontSize: '0.75rem',
          borderRadius: borderRadiusScale.xs,
        },
      },
    },
  },
};

// Create and export the theme
export const theme = createTheme(themeOptions);

// =============================================================================
// TYPE AUGMENTATION
// =============================================================================

// Extend MUI theme types to include custom tokens
declare module '@mui/material/styles' {
  interface Theme {
    customTokens: {
      risk: typeof riskColors;
      riskFactor: typeof riskFactorColors;
      grade: typeof gradeColors;
      alertType: typeof alertTypeColors;
      alertSeverity: typeof alertSeverityColors;
      projectType: typeof projectTypeColors;
      projectStatus: typeof projectStatusColors;
      workflowStatus: typeof workflowStatusColors;
      quality: typeof qualityColors;
    };
  }
  interface ThemeOptions {
    customTokens?: {
      risk?: typeof riskColors;
      riskFactor?: typeof riskFactorColors;
      grade?: typeof gradeColors;
      alertType?: typeof alertTypeColors;
      alertSeverity?: typeof alertSeverityColors;
      projectType?: typeof projectTypeColors;
      projectStatus?: typeof projectStatusColors;
      workflowStatus?: typeof workflowStatusColors;
      quality?: typeof qualityColors;
    };
  }
}

// Add custom tokens to theme
export const themeWithTokens = createTheme({
  ...themeOptions,
  customTokens: {
    risk: riskColors,
    riskFactor: riskFactorColors,
    grade: gradeColors,
    alertType: alertTypeColors,
    alertSeverity: alertSeverityColors,
    projectType: projectTypeColors,
    projectStatus: projectStatusColors,
    workflowStatus: workflowStatusColors,
    quality: qualityColors,
  },
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get risk level color from score
 */
export function getRiskColor(score: number): string {
  if (score >= 85) return riskColors.critical;
  if (score >= 60) return riskColors.high;
  if (score >= 30) return riskColors.medium;
  return riskColors.low;
}

/**
 * Get risk level name from score
 */
export function getRiskLevel(score: number): keyof typeof riskColors {
  if (score >= 85) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

/**
 * Get grade color from letter grade
 */
export function getGradeColor(grade: string): string {
  return gradeColors[grade as keyof typeof gradeColors] || '#757575';
}

/**
 * Get quality color from score
 */
export function getQualityColor(score: number): string {
  if (score >= 90) return qualityColors.excellent;
  if (score >= 70) return qualityColors.good;
  if (score >= 50) return qualityColors.fair;
  return qualityColors.poor;
}

/**
 * Get workflow status color
 */
export function getWorkflowStatusColor(status: string): string {
  return workflowStatusColors[status as keyof typeof workflowStatusColors] || '#9E9E9E';
}

/**
 * Generate alpha variant of a color
 */
export function withAlpha(color: string, alpha: number): string {
  // Convert hex to rgba
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Default export
export default themeWithTokens;
