/**
 * CNS Dashboard Shared Types
 *
 * Centralized type definitions used across the dashboard.
 *
 * IMPORTANT: These types align with database schemas in:
 * - Supabase DB (boms, bom_line_items)
 * - Components-V2 DB (component_catalog, manufacturers)
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
 * Enriched component with full data from component_catalog table.
 *
 * Database: components_v2.component_catalog
 * Columns: 38 total (id, manufacturer_part_number, manufacturer, ...)
 */
export interface EnrichedComponent extends ComponentBase {
  // Basic Info
  datasheet_url?: string;
  image_url?: string;
  model_3d_url?: string;

  // Taxonomy
  subcategory?: string;
  category_path?: string;
  product_family?: string;
  product_series?: string;

  // Physical
  package?: string;

  // Lifecycle & Compliance
  lifecycle?: string;
  lifecycle_status?: string;
  rohs?: string;
  rohs_compliant?: boolean;
  reach?: string;
  reach_compliant?: boolean;
  halogen_free?: boolean;
  aec_qualified?: boolean;
  eccn_code?: string;

  // Technical
  specifications?: Record<string, unknown>;
  parameters?: Record<string, unknown>;

  // Pricing & Availability
  pricing?: PriceBreak[];
  price_breaks?: Record<string, unknown>;
  unit_price?: number;
  currency?: string;
  moq?: number;
  lead_time_days?: number;
  stock_status?: string;
  stock_quantity?: number;

  // Quality & Enrichment Metadata
  quality_score?: number;
  quality_metadata?: Record<string, unknown>;
  enrichment_source?: string;
  last_enriched_at?: string;
  enrichment_count?: number;
  enrichment_metadata?: Record<string, unknown>;
  supplier_data?: Record<string, unknown>;
  ai_metadata?: Record<string, unknown>;

  // Risk Assessment
  risk_level?: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';

  // Usage Statistics
  usage_count?: number;
  last_used_at?: string;

  // Timestamps
  created_at?: string;
  updated_at?: string;
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
// Enrichment Status Types
// ============================================================================

/**
 * Database enrichment status values (from bom_line_items.enrichment_status).
 *
 * These are the actual string values stored in the database.
 */
export type DBEnrichmentStatus =
  | 'pending'
  | 'queued'
  | 'processing'
  | 'enriched'
  | 'failed'
  | 'requires_approval';

/**
 * Frontend display enrichment status values.
 *
 * These are normalized values used in the UI for consistency.
 * Use mapDBStatusToDisplay() to convert from database values.
 */
export type EnrichmentStatus =
  | 'pending'
  | 'enriching'
  | 'completed'
  | 'failed'
  | 'unknown';

/**
 * Map database enrichment status to frontend display status.
 *
 * @param dbStatus - Raw status from database
 * @returns Normalized status for UI display
 */
export function mapDBStatusToDisplay(dbStatus: DBEnrichmentStatus | string): EnrichmentStatus {
  const normalized = dbStatus?.toLowerCase() ?? 'pending';

  switch (normalized) {
    case 'queued':
    case 'pending':
      return 'pending';
    case 'processing':
      return 'enriching';
    case 'enriched':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'requires_approval':
      return 'pending';
    default:
      return 'unknown';
  }
}

/**
 * Enrichment source values.
 */
export type EnrichmentSource = 'customer' | 'staff' | 'unknown';

// ============================================================================
// BOM Status Types
// ============================================================================

/**
 * Overall BOM lifecycle status (from boms.status).
 *
 * Tracks the general state of the BOM throughout its lifecycle.
 */
export type BOMStatus =
  | 'draft'
  | 'pending'
  | 'analyzing'
  | 'completed'
  | 'failed'
  | 'processing'
  | 'archived';

/**
 * BOM enrichment workflow state (from boms.enrichment_status).
 *
 * Tracks the enrichment process separately from overall BOM status.
 */
export type BOMEnrichmentStatus =
  | 'pending'
  | 'queued'
  | 'processing'
  | 'enriched'
  | 'failed'
  | 'requires_approval';

/**
 * Match method used for component matching.
 */
export type MatchMethod = 'exact' | 'fuzzy' | 'manual' | 'unmatched';

/**
 * Risk level classification.
 */
export type RiskLevel = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';

// ============================================================================
// BOM Types
// ============================================================================

/**
 * BOM header data from boms table.
 *
 * Database: postgres.boms
 * Columns: 29 total
 */
export interface BOM {
  id: string;
  organization_id: string;
  project_id?: string;
  name: string;
  version?: string;
  description?: string;
  metadata?: Record<string, unknown>;

  // Status & Workflow
  grade?: string;
  status: BOMStatus;
  enrichment_status: BOMEnrichmentStatus;
  enrichment_priority?: number;
  enrichment_quality_score?: number;
  temporal_workflow_id?: string;

  // Metrics
  component_count?: number;
  total_cost?: number;
  high_risk_count?: number;
  medium_risk_count?: number;
  low_risk_count?: number;
  enrichment_match_rate?: number;
  enrichment_avg_confidence?: number;

  // Source & Files
  source?: string;
  raw_file_s3_key?: string;
  parsed_file_s3_key?: string;
  priority?: string;
  enrichment_progress?: Record<string, unknown>;

  // Timestamps
  analyzed_at?: string;
  created_by_id?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * BOM enrichment summary data for dashboard display.
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
 * BOM line item data from bom_line_items table.
 *
 * Database: postgres.bom_line_items
 * Columns: 29 total (id, bom_id, line_number, ...)
 */
export interface BOMLineItem {
  // Primary Fields
  id: string;
  bom_id: string;
  line_number: number;
  reference_designator?: string;
  manufacturer_part_number: string;
  manufacturer?: string;
  description?: string;
  quantity: number;

  // Component Linking
  component_id?: string;
  redis_component_key?: string;
  component_storage?: string;

  // Matching Metadata
  match_confidence?: number;        // DECIMAL(5,2) - 0.00 to 100.00
  match_method?: MatchMethod;

  // Enrichment Status & Results
  enrichment_status: DBEnrichmentStatus | EnrichmentStatus;
  enriched_mpn?: string;
  enriched_manufacturer?: string;
  specifications?: Record<string, unknown>;
  datasheet_url?: string;
  lifecycle_status?: string;
  compliance_status?: Record<string, unknown>;

  // Pricing
  pricing?: Record<string, unknown>;
  unit_price?: number;              // DECIMAL
  extended_price?: number;          // DECIMAL

  // Risk & Quality
  risk_level?: RiskLevel;

  // Metadata & Errors
  metadata?: Record<string, unknown>;
  enrichment_error?: string;

  // Timestamps
  enriched_at?: string;             // timestamp with time zone
  created_at?: string;              // timestamp with time zone
  updated_at?: string;              // timestamp with time zone
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

// ============================================================================
// Re-export all types from submodules
// ============================================================================

export * from './api';
export * from './auth';

export * from './bom';
export * from './enrichment';
