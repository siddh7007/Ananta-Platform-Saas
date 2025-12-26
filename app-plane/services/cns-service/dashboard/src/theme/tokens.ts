/**
 * CNS Dashboard Theme Tokens
 *
 * Centralized semantic color palettes for consistent styling across the dashboard.
 * These tokens are used in chips, tables, cards, and status indicators.
 *
 * @see THEME_SYSTEM.md for token documentation and usage guide
 */

// ============================================================
// Quality Routing Colors (Production/Staging/Rejected/Failed)
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

// ============================================================
// Alert Severity Colors
// ============================================================
export const alertSeverityColors = {
  info: '#2196f3',      // Blue
  warning: '#ff9800',   // Orange
  error: '#f44336',     // Red
  success: '#4caf50',   // Green
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
// Type Exports for TypeScript
// ============================================================

export type QualityStatus = keyof typeof qualityColors;
export type SupplierName = keyof typeof supplierColors;
export type EnrichmentStatus = keyof typeof enrichmentStatusColors;
export type LifecycleStatus = keyof typeof lifecycleColors;
export type JobStatus = keyof typeof jobStatusColors;
export type CompletenessLevel = keyof typeof completenessColors;
export type WorkflowStatus = keyof typeof workflowStatusColors;
export type RiskLevel = keyof typeof riskColors;
export type Grade = keyof typeof gradeColors;
export type AlertSeverity = keyof typeof alertSeverityColors;
