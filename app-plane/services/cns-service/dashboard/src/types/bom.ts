/**
 * BOM (Bill of Materials) Types
 */

// ============================================================================
// BOM Types
// ============================================================================

/**
 * BOM status values
 */
export type BOMStatus = 'pending' | 'enriching' | 'completed' | 'failed' | 'partial';

/**
 * BOM source values
 */
export type BOMSource = 'customer' | 'staff' | 'staff_bulk' | 'api';

/**
 * BOM record
 */
export interface BOM {
  id: string;
  name?: string;
  filename?: string;
  description?: string;
  organization_id: string;
  project_id?: string;
  workspace_id?: string;
  source: BOMSource;
  status: BOMStatus;
  total_items: number;
  enriched_items: number;
  failed_items: number;
  pending_items: number;
  percent_complete: number;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  workflow_id?: string;
  created_by?: string;
  metadata?: Record<string, unknown>;
}

/**
 * BOM line item enrichment status
 */
export type LineItemEnrichmentStatus = 'pending' | 'enriching' | 'enriched' | 'failed' | 'skipped';

/**
 * BOM line item record
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
  enrichment_status: LineItemEnrichmentStatus;
  component_id?: string;
  enrichment_error?: string;
  enrichment_source?: string;
  quality_score?: number;
  created_at: string;
  updated_at: string;
  enriched_at?: string;
  // Enriched data fields
  category?: string;
  datasheet_url?: string;
  image_url?: string;
  lifecycle_status?: string;
  rohs_compliant?: boolean;
  reach_compliant?: boolean;
  stock_quantity?: number;
  unit_price?: number;
  currency?: string;
  lead_time_days?: number;
  moq?: number;
  parameters?: Record<string, unknown>;
  specifications?: Record<string, unknown>;
}

/**
 * BOM upload request
 */
export interface BOMUploadRequest {
  file: File;
  name?: string;
  description?: string;
  organization_id: string;
  project_id?: string;
  workspace_id?: string;
  source: BOMSource;
  auto_enrich?: boolean;
}

/**
 * BOM upload response
 */
export interface BOMUploadResponse {
  bom_id: string;
  job_id?: string;
  workflow_id?: string;
  total_items: number;
  message: string;
}

/**
 * BOM workflow event (SSE)
 */
export interface BOMWorkflowEvent {
  type: 'progress' | 'complete' | 'error' | 'item_update';
  bom_id: string;
  workflow_id?: string;
  progress?: {
    total: number;
    enriched: number;
    failed: number;
    percent: number;
  };
  item?: Partial<BOMLineItem>;
  error?: string;
  timestamp: string;
}

/**
 * BOM enrichment statistics
 */
export interface BOMEnrichmentStats {
  total_boms: number;
  active_enrichments: number;
  completed_today: number;
  total_items_enriched: number;
  avg_enrichment_time_ms?: number;
  success_rate?: number;
}

// ============================================================================
// Bulk Upload Types
// ============================================================================

/**
 * Bulk upload job status
 */
export type BulkUploadStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Bulk upload job record
 */
export interface BulkUploadJob {
  id: string;
  upload_id: string;
  filename: string;
  status: BulkUploadStatus;
  total_items: number;
  processed_items: number;
  failed_items: number;
  percent_complete: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}
