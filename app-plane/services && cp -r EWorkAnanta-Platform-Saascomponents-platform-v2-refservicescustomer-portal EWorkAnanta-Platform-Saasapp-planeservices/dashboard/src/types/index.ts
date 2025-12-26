/**
 * CNS Dashboard Shared Types
 *
 * Centralized type definitions used across the dashboard.
 */

// ============================================================================
// Component Types
// ============================================================================

/**
 * Base component data structure from enrichment.
 */
export interface ComponentBase {
  id: string;
  mpn: string;
  manufacturer: string;
  category?: string;
  description?: string;
}

/**
 * Enriched component with full data.
 */
export interface EnrichedComponent extends ComponentBase {
  datasheet_url?: string;
  image_url?: string;
  lifecycle?: string;
  rohs?: string;
  reach?: string;
  specifications?: Record<string, unknown>;
  parameters?: Record<string, unknown>;
  pricing?: PriceBreak[];
  quality_score?: number;
  enrichment_source?: string;
  last_enriched_at?: string;
  stock_status?: string;
  stock_quantity?: number;
  lead_time_days?: number;
  unit_price?: number;
  currency?: string;
  moq?: number;
  aec_qualified?: boolean;
  halogen_free?: boolean;
}

/**
 * Price break structure.
 */
export interface PriceBreak {
  quantity: number;
  price: number;
  currency?: string;
}

// ============================================================================
// Enrichment Types
// ============================================================================

/**
 * Enrichment status values.
 */
export type EnrichmentStatus = 'pending' | 'enriching' | 'completed' | 'failed' | 'unknown';

/**
 * Enrichment source values.
 */
export type EnrichmentSource = 'customer' | 'staff' | 'unknown';

/**
 * BOM enrichment summary data.
 */
export interface EnrichmentSummary {
  bom_id: string;
  bom_name?: string | null;
  bom_filename?: string | null;
  source: EnrichmentSource;
  tenant_id: string;
  project_id?: string;
  status: EnrichmentStatus;
  total_items: number;
  enriched_items: number;
  failed_items: number;
  percent_complete: number;
  started_at: string;
  completed_at?: string;
  workflow_id?: string;
}

/**
 * BOM line item data.
 */
export interface BOMLineItem {
  id: string;
  bom_id: string;
  line_number: number;
  manufacturer_part_number: string;
  manufacturer?: string;
  quantity: number;
  reference_designator?: string;
  description?: string;
  enrichment_status: EnrichmentStatus;
  component_id?: string;
  enrichment_error?: string;
}

// ============================================================================
// Quality Queue Types
// ============================================================================

/**
 * Quality status for component review.
 */
export type QualityStatus = 'production' | 'staging' | 'rejected';

/**
 * Quality queue filter values.
 */
export type QualityQueueFilter = 'staging' | 'rejected' | 'all';

/**
 * Quality queue item data.
 */
export interface QualityQueueItem {
  id: string;
  mpn: string;
  manufacturer: string;
  category: string;
  quality_score: number;
  flagged_reason: string;
  data_completeness: number;
  sources_used: string[];
  submitted_at: string;
  job_id?: string;
}

/**
 * Quality queue stats summary.
 */
export interface QualityQueueStats {
  total: number;
  staging_count: number;
  rejected_count: number;
  approved_today?: number;
  rejected_today?: number;
}

// ============================================================================
// Supplier Types
// ============================================================================

/**
 * Supported supplier names.
 */
export type SupplierName = 'mouser' | 'digikey' | 'element14' | 'lcsc' | 'octopart' | 'unknown';

/**
 * Supplier API configuration.
 */
export interface SupplierConfig {
  name: SupplierName;
  enabled: boolean;
  api_key?: string;
  client_id?: string;
  client_secret?: string;
  rate_limit?: number;
}

// ============================================================================
// API Types
// ============================================================================

/**
 * Paginated API response.
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  has_more?: boolean;
}

/**
 * API error response.
 */
export interface ApiErrorResponse {
  detail?: string;
  message?: string;
  code?: string;
  error_code?: string;
}

// ============================================================================
// Auth Types
// ============================================================================

/**
 * User role values.
 */
export type UserRole = 'admin' | 'engineer' | 'analyst' | 'viewer';

/**
 * Authenticated user info.
 */
export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  organization_id?: string;
  tenant_id?: string;
}

// ============================================================================
// UI Types
// ============================================================================

/**
 * Sort direction.
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Sort configuration.
 */
export interface SortConfig {
  field: string;
  direction: SortDirection;
}

/**
 * Filter configuration.
 */
export interface FilterConfig {
  field: string;
  value: string | number | boolean | null;
  operator?: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains';
}
