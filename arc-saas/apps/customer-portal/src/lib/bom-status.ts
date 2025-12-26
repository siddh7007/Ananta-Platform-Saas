/**
 * BOM Status Mapping
 *
 * Maps BOM-specific status strings to generic status types for UI display.
 * Provides consistent status handling across the application.
 */

import { STATUS_CONFIG, type StatusType } from './status-colors';
import type { BomStatus, EnrichmentStatus } from '@/types/bom';

/**
 * Map BOM status values to generic status types
 */
export const BOM_STATUS_MAP: Record<BomStatus, StatusType> = {
  pending: 'pending',
  analyzing: 'processing',
  processing: 'processing',
  enriching: 'enriching',
  mapping_pending: 'pending',
  completed: 'completed',
  failed: 'failed',
  cancelled: 'cancelled',
};

/**
 * Map enrichment status values to generic status types
 */
export const ENRICHMENT_STATUS_MAP: Record<EnrichmentStatus, StatusType> = {
  pending: 'pending',
  matched: 'completed',
  enriched: 'completed',
  no_match: 'warning',
  error: 'error',
};

/**
 * Get status configuration for a BOM status
 */
export function getBomStatusConfig(bomStatus: BomStatus) {
  const statusType = BOM_STATUS_MAP[bomStatus] || 'pending';
  return STATUS_CONFIG[statusType];
}

/**
 * Get generic status type for a BOM status
 */
export function getBomStatusType(bomStatus: BomStatus): StatusType {
  return BOM_STATUS_MAP[bomStatus] || 'pending';
}

/**
 * Get status configuration for an enrichment status
 */
export function getEnrichmentStatusConfig(enrichmentStatus: EnrichmentStatus) {
  const statusType = ENRICHMENT_STATUS_MAP[enrichmentStatus] || 'pending';
  return STATUS_CONFIG[statusType];
}

/**
 * Get generic status type for an enrichment status
 */
export function getEnrichmentStatusType(enrichmentStatus: EnrichmentStatus): StatusType {
  return ENRICHMENT_STATUS_MAP[enrichmentStatus] || 'pending';
}

/**
 * Get user-friendly label for BOM status
 */
export function getBomStatusLabel(bomStatus: BomStatus): string {
  const labels: Record<BomStatus, string> = {
    pending: 'Pending',
    analyzing: 'Analyzing',
    processing: 'Processing',
    enriching: 'Enriching',
    mapping_pending: 'Mapping Pending',
    completed: 'Completed',
    failed: 'Failed',
    cancelled: 'Cancelled',
  };
  return labels[bomStatus] || bomStatus;
}

/**
 * Get user-friendly label for enrichment status
 */
export function getEnrichmentStatusLabel(enrichmentStatus: EnrichmentStatus): string {
  const labels: Record<EnrichmentStatus, string> = {
    pending: 'Pending',
    matched: 'Matched',
    enriched: 'Enriched',
    no_match: 'No Match',
    error: 'Error',
  };
  return labels[enrichmentStatus] || enrichmentStatus;
}
