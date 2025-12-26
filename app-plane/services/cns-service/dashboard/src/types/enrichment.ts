/**
 * Enrichment Pipeline Types
 */

// ============================================================================
// Pipeline Step Types
// ============================================================================

/**
 * Pipeline step status
 */
export type PipelineStepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

/**
 * Pipeline step name
 */
export type PipelineStepName =
  | 'normalization'
  | 'supplier_api'
  | 'ai_enhancement'
  | 'quality_check'
  | 'catalog_storage';

/**
 * Pipeline step result
 */
export interface PipelineStepResult {
  step: PipelineStepName;
  status: PipelineStepStatus;
  duration_ms?: number;
  error?: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

/**
 * Complete enrichment pipeline result
 */
export interface EnrichmentPipelineResult {
  component_id?: string;
  mpn: string;
  manufacturer: string;
  status: 'success' | 'partial' | 'failed';
  steps: PipelineStepResult[];
  quality_score?: number;
  enrichment_source?: string;
  total_duration_ms?: number;
  started_at: string;
  completed_at?: string;
}

// ============================================================================
// Supplier API Types
// ============================================================================

/**
 * Supplier API response status
 */
export type SupplierAPIStatus = 'success' | 'not_found' | 'rate_limited' | 'error';

/**
 * Supplier API response
 */
export interface SupplierAPIResponse {
  supplier: string;
  status: SupplierAPIStatus;
  data?: Record<string, unknown>;
  error?: string;
  duration_ms?: number;
  cached?: boolean;
}

/**
 * Aggregated supplier responses
 */
export interface AggregatedSupplierData {
  mpn: string;
  manufacturer: string;
  responses: SupplierAPIResponse[];
  best_source?: string;
  merged_data?: Record<string, unknown>;
}

// ============================================================================
// Normalization Types
// ============================================================================

/**
 * Normalized component data
 */
export interface NormalizedComponentData {
  mpn: string;
  manufacturer: string;
  category?: string;
  description?: string;
  confidence_score?: number;
  normalized_fields: string[];
  original_input?: Record<string, unknown>;
}

// ============================================================================
// AI Enhancement Types
// ============================================================================

/**
 * AI enhancement result
 */
export interface AIEnhancementResult {
  enhanced_fields: string[];
  confidence_scores: Record<string, number>;
  suggested_category?: string;
  description_quality?: number;
  data: Record<string, unknown>;
}

// ============================================================================
// Enrichment Event Types
// ============================================================================

/**
 * Enrichment progress event (SSE)
 */
export interface EnrichmentProgressEvent {
  type: 'step_start' | 'step_complete' | 'step_error' | 'complete' | 'error';
  item_id: string;
  bom_id: string;
  mpn: string;
  step?: PipelineStepName;
  status?: PipelineStepStatus;
  progress?: {
    current: number;
    total: number;
    percent: number;
  };
  error?: string;
  timestamp: string;
}

/**
 * Enrichment monitor filter
 */
export interface EnrichmentMonitorFilter {
  status?: string[];
  source?: string[];
  date_from?: string;
  date_to?: string;
  organization_id?: string;
  project_id?: string;
  search?: string;
}

/**
 * Enrichment record for monitoring
 */
export interface EnrichmentRecord {
  id: string;
  bom_id: string;
  bom_name?: string;
  mpn: string;
  manufacturer: string;
  status: string;
  quality_score?: number;
  enrichment_source?: string;
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  error?: string;
}
