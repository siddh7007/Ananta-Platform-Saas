/**
 * CNS Dashboard Theme Configuration
 *
 * Centralized theme with semantic tokens for:
 * - Quality routing (production, staging, rejected, failed)
 * - Supplier branding (mouser, digikey, element14, octopart)
 * - Enrichment status (pending, processing, completed, failed)
 * - Lifecycle status (active, nrnd, obsolete, eol)
 */

import { createTheme, ThemeOptions } from '@mui/material/styles';

// ============================================================
// Quality Routing Colors
// ============================================================
export const qualityColors = {
  production: '#22c55e',  // Score ≥95% (auto-approved) - green
  staging: '#facc15',     // Score 70-94% (manual review) - yellow
  rejected: '#ef4444',    // Score <70% (rejected) - red
  failed: '#6b7280',      // Enrichment failed - gray
} as const;

// ============================================================
// Supplier Branding Colors
// ============================================================
export const supplierColors = {
  mouser: '#0066cc',      // Mouser blue
  digikey: '#cc0000',     // DigiKey red
  element14: '#ff6600',   // Element14 orange
  octopart: '#00b894',    // Octopart teal
  newark: '#003366',      // Newark dark blue
  arrow: '#f26522',       // Arrow orange
  avnet: '#ed1c24',       // Avnet red
} as const;

// ============================================================
// Enrichment Status Colors
// ============================================================
export const enrichmentStatusColors = {
  pending: '#9ca3af',     // Waiting - gray
  queued: '#a78bfa',      // In queue - purple
  processing: '#3b82f6',  // In progress - blue
  completed: '#22c55e',   // Done - green
  failed: '#ef4444',      // Error - red
  partial: '#f59e0b',     // Partial success - amber
} as const;

// ============================================================
// Lifecycle Status Colors
// ============================================================
export const lifecycleColors = {
  active: '#22c55e',      // Active - green
  nrnd: '#f59e0b',        // Not Recommended for New Designs - amber
  obsolete: '#ef4444',    // Obsolete - red
  eol: '#dc2626',         // End of Life - dark red
  unknown: '#6b7280',     // Unknown - gray
} as const;

// ============================================================
// Job Status Colors
// ============================================================
export const jobStatusColors = {
  created: '#9ca3af',
  uploading: '#a78bfa',
  validating: '#8b5cf6',
  enriching: '#3b82f6',
  completed: '#22c55e',
  failed: '#ef4444',
  cancelled: '#6b7280',
} as const;

// ============================================================
// Data Completeness Colors
// ============================================================
export const completenessColors = {
  excellent: '#22c55e',   // 90-100%
  good: '#84cc16',        // 70-89%
  fair: '#facc15',        // 50-69%
  poor: '#f97316',        // 30-49%
  minimal: '#ef4444',     // 0-29%
} as const;

// ============================================================
// Typography Scale
// ============================================================
export const typographyScale = {
  pageTitle: {
    fontSize: '1.75rem',
    fontWeight: 700,
    lineHeight: 1.2,
  },
  sectionTitle: {
    fontSize: '1.25rem',
    fontWeight: 600,
    lineHeight: 1.3,
  },
  cardTitle: {
    fontSize: '1rem',
    fontWeight: 600,
    lineHeight: 1.4,
  },
  metricValue: {
    fontSize: '2rem',
    fontWeight: 700,
    lineHeight: 1.1,
  },
  metricLabel: {
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  tableHeader: {
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.03em',
  },
  chipLabel: {
    fontSize: '0.6875rem',
    fontWeight: 600,
  },
} as const;

// ============================================================
// Spacing Scale
// ============================================================
export const spacingScale = {
  xxs: 0.5,   // 4px
  xs: 1,      // 8px
  sm: 1.5,    // 12px
  md: 2,      // 16px
  lg: 3,      // 24px
  xl: 4,      // 32px
  xxl: 6,     // 48px
} as const;

// ============================================================
// Helper Functions
// ============================================================

/**
 * Get quality color based on score
 */
export function getQualityColor(score: number): string {
  if (score >= 95) return qualityColors.production;
  if (score >= 70) return qualityColors.staging;
  if (score > 0) return qualityColors.rejected;
  return qualityColors.failed;
}

/**
 * Get quality status based on score
 */
export function getQualityStatus(score: number): 'production' | 'staging' | 'rejected' | 'failed' {
  if (score >= 95) return 'production';
  if (score >= 70) return 'staging';
  if (score > 0) return 'rejected';
  return 'failed';
}

/**
 * Get completeness color based on percentage
 */
export function getCompletenessColor(percentage: number): string {
  if (percentage >= 90) return completenessColors.excellent;
  if (percentage >= 70) return completenessColors.good;
  if (percentage >= 50) return completenessColors.fair;
  if (percentage >= 30) return completenessColors.poor;
  return completenessColors.minimal;
}

/**
 * Get supplier color by name
 */
export function getSupplierColor(supplier: string): string {
  const normalized = supplier.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (normalized.includes('mouser')) return supplierColors.mouser;
  if (normalized.includes('digikey') || normalized.includes('digi-key')) return supplierColors.digikey;
  if (normalized.includes('element14') || normalized.includes('farnell')) return supplierColors.element14;
  if (normalized.includes('octopart')) return supplierColors.octopart;
  if (normalized.includes('newark')) return supplierColors.newark;
  if (normalized.includes('arrow')) return supplierColors.arrow;
  if (normalized.includes('avnet')) return supplierColors.avnet;
  return '#6b7280'; // Default gray
}

/**
 * Get lifecycle color by status
 */
export function getLifecycleColor(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === 'active' || normalized === 'production') return lifecycleColors.active;
  if (normalized === 'nrnd' || normalized.includes('not recommended')) return lifecycleColors.nrnd;
  if (normalized === 'obsolete') return lifecycleColors.obsolete;
  if (normalized === 'eol' || normalized.includes('end of life')) return lifecycleColors.eol;
  return lifecycleColors.unknown;
}

/**
 * Create alpha variant of a color
 */
export function withAlpha(color: string, alpha: number): string {
  // Handle hex colors
  if (color.startsWith('#')) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

// ============================================================
// MUI Theme Extension
// ============================================================

const themeOptions: ThemeOptions = {
  palette: {
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
    success: {
      main: '#22c55e',
      light: '#4ade80',
      dark: '#16a34a',
    },
    warning: {
      main: '#facc15',
      light: '#fde047',
      dark: '#eab308',
    },
    error: {
      main: '#ef4444',
      light: '#f87171',
      dark: '#dc2626',
    },
    info: {
      main: '#3b82f6',
      light: '#60a5fa',
      dark: '#2563eb',
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
      default: '#f9fafb',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      'Arial',
      'sans-serif',
    ].join(','),
    h1: typographyScale.pageTitle,
    h2: typographyScale.sectionTitle,
    h3: typographyScale.cardTitle,
    h4: {
      fontSize: '1.5rem',
      fontWeight: 600,
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 600,
    },
    h6: {
      fontSize: '1rem',
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
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
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
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            fontWeight: 600,
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
            backgroundColor: '#f9fafb',
          },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          height: 8,
        },
      },
    },
  },
};

export const theme = createTheme(themeOptions);

export default theme;

// ============================================================
// Workflow Status Colors (for BOM upload workflow stepper)
// ============================================================
export const workflowStatusColors = {
  pending: '#9E9E9E',       // Gray
  processing: '#2196F3',    // Blue
  completed: '#4CAF50',     // Green
  failed: '#f44336',        // Red
  cancelled: '#757575',     // Dark Gray
  mapping_pending: '#FFC107', // Yellow
} as const;

// ============================================================
// Risk Colors (for risk scoring)
// ============================================================
export const riskColors = {
  low: '#4caf50',       // Green - healthy/safe components
  medium: '#ff9800',    // Orange - attention needed
  high: '#f44336',      // Red - significant risk
  critical: '#9c27b0',  // Purple - urgent action required
} as const;

// ============================================================
// Grade Colors (for BOM health grades)
// ============================================================
export const gradeColors = {
  A: '#4caf50',   // Excellent - Green
  B: '#8bc34a',   // Good - Light Green
  C: '#ff9800',   // Fair - Orange
  D: '#f44336',   // Poor - Red
  F: '#9c27b0',   // Critical - Purple
} as const;

/**
 * Get risk level from score (0-100)
 */
export function getRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}
