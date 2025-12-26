/**
 * CNS Dashboard Theme Helpers
 *
 * Utility functions for mapping business logic status values to theme palette colors.
 * Prevents repetitive switch/if blocks in components.
 *
 * @see THEME_SYSTEM.md for usage examples
 */

import {
  qualityColors,
  supplierColors,
  enrichmentStatusColors,
  lifecycleColors,
  jobStatusColors,
  completenessColors,
  workflowStatusColors,
  riskColors,
  gradeColors,
  alertSeverityColors,
  type QualityStatus,
  type SupplierName,
  type EnrichmentStatus,
  type LifecycleStatus,
  type JobStatus,
  type CompletenessLevel,
  type WorkflowStatus,
  type RiskLevel,
  type Grade,
  type AlertSeverity,
} from './tokens';

// ============================================================
// Quality Routing Helpers
// ============================================================

/**
 * Get quality color based on score
 * @param score - Quality score (0-100)
 * @returns Color hex string
 */
export function getQualityColor(score: number): string {
  if (score >= 95) return qualityColors.production;
  if (score >= 70) return qualityColors.staging;
  if (score > 0) return qualityColors.rejected;
  return qualityColors.failed;
}

/**
 * Get quality status based on score
 * @param score - Quality score (0-100)
 * @returns Quality status key
 */
export function getQualityStatus(score: number): QualityStatus {
  if (score >= 95) return 'production';
  if (score >= 70) return 'staging';
  if (score > 0) return 'rejected';
  return 'failed';
}

// ============================================================
// Completeness Helpers
// ============================================================

/**
 * Get completeness color based on percentage
 * @param percentage - Data completeness percentage (0-100)
 * @returns Color hex string
 */
export function getCompletenessColor(percentage: number): string {
  if (percentage >= 90) return completenessColors.excellent;
  if (percentage >= 70) return completenessColors.good;
  if (percentage >= 50) return completenessColors.fair;
  if (percentage >= 30) return completenessColors.poor;
  return completenessColors.minimal;
}

/**
 * Get completeness level based on percentage
 * @param percentage - Data completeness percentage (0-100)
 * @returns Completeness level key
 */
export function getCompletenessLevel(percentage: number): CompletenessLevel {
  if (percentage >= 90) return 'excellent';
  if (percentage >= 70) return 'good';
  if (percentage >= 50) return 'fair';
  if (percentage >= 30) return 'poor';
  return 'minimal';
}

// ============================================================
// Supplier Helpers
// ============================================================

/**
 * Get supplier color by name (with fuzzy matching)
 * @param supplier - Supplier name (case-insensitive, with aliases)
 * @returns Color hex string (default gray if unknown)
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

// ============================================================
// Lifecycle Helpers
// ============================================================

/**
 * Get lifecycle color by status (with aliases)
 * @param status - Lifecycle status (case-insensitive, with common aliases)
 * @returns Color hex string
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
 * Get lifecycle status key by status string (with aliases)
 * @param status - Lifecycle status string
 * @returns Lifecycle status key
 */
export function getLifecycleStatus(status: string): LifecycleStatus {
  const normalized = status.toLowerCase();
  if (normalized === 'active' || normalized === 'production') return 'active';
  if (normalized === 'nrnd' || normalized.includes('not recommended')) return 'nrnd';
  if (normalized === 'obsolete') return 'obsolete';
  if (normalized === 'eol' || normalized.includes('end of life')) return 'eol';
  return 'unknown';
}

// ============================================================
// Risk Helpers
// ============================================================

/**
 * Get risk level from score
 * @param score - Risk score (0-100)
 * @returns Risk level key
 */
export function getRiskLevel(score: number): RiskLevel {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

/**
 * Get risk color from score
 * @param score - Risk score (0-100)
 * @returns Color hex string
 */
export function getRiskColor(score: number): string {
  const level = getRiskLevel(score);
  return riskColors[level];
}

// ============================================================
// Grade Helpers
// ============================================================

/**
 * Get grade color from letter grade
 * @param grade - Letter grade (A, B, C, D, F)
 * @returns Color hex string (default gray if invalid)
 */
export function getGradeColor(grade: string): string {
  const normalized = grade.toUpperCase() as Grade;
  return gradeColors[normalized] || '#757575';
}

/**
 * Get grade from score (0-100)
 * @param score - Numeric score
 * @returns Letter grade
 */
export function getGradeFromScore(score: number): Grade {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

// ============================================================
// Status Color Getters (Direct Mapping)
// ============================================================

/**
 * Get enrichment status color
 * @param status - Enrichment status key
 * @returns Color hex string (default gray if unknown)
 */
export function getEnrichmentStatusColor(status: string): string {
  const key = status.toLowerCase() as EnrichmentStatus;
  return enrichmentStatusColors[key] || enrichmentStatusColors.pending;
}

/**
 * Get job status color
 * @param status - Job status key
 * @returns Color hex string (default gray if unknown)
 */
export function getJobStatusColor(status: string): string {
  const key = status.toLowerCase() as JobStatus;
  return jobStatusColors[key] || jobStatusColors.created;
}

/**
 * Get workflow status color
 * @param status - Workflow status key
 * @returns Color hex string (default gray if unknown)
 */
export function getWorkflowStatusColor(status: string): string {
  const key = status.toLowerCase().replace(/_/g, '') as keyof typeof workflowStatusColors;
  return workflowStatusColors[key] || workflowStatusColors.pending;
}

/**
 * Get alert severity color
 * @param severity - Alert severity (info, warning, error, success)
 * @returns Color hex string
 */
export function getAlertSeverityColor(severity: string): string {
  const key = severity.toLowerCase() as AlertSeverity;
  return alertSeverityColors[key] || alertSeverityColors.info;
}

// ============================================================
// Alpha Variant Helper
// ============================================================

/**
 * Create alpha variant of a color
 * @param color - Hex color string
 * @param alpha - Alpha value (0-1)
 * @returns rgba color string
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
