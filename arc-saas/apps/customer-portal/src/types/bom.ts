/**
 * BOM (Bill of Materials) types for the customer portal
 * Aligned with CNS service API contracts
 */

export interface Bom {
  id: string;
  name: string;
  description?: string;
  fileName?: string;
  fileUrl?: string;
  status: BomStatus;
  lineCount: number;
  enrichedCount: number;

  // Scoping - tenant and optional project/workspace
  organizationId: string;
  tenantId?: string;
  projectId?: string;
  workspaceId?: string;

  // Audit
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;

  // Enrichment metadata
  lastEnrichedAt?: string;
  enrichmentSource?: string;

  // Temporal workflow tracking
  temporalWorkflowId?: string;
  enrichmentProgress?: {
    totalItems: number;
    enrichedItems: number;
    failedItems: number;
    pendingItems: number;
    percentComplete: number;
  };
}

/**
 * BOM status values - aligned with CNS API (migration 087)
 * Backend may return UPPERCASE; UI normalizes to lowercase
 */
export type BomStatus =
  | 'pending'
  | 'analyzing'
  | 'processing'
  | 'enriching'
  | 'mapping_pending'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * BOM enrichment status - from boms.enrichment_status column (migration 008)
 */
export type BomEnrichmentStatus =
  | 'pending'
  | 'queued'
  | 'processing'
  | 'enriched'
  | 'failed'
  | 'requires_approval';

/**
 * Normalize status to lowercase for UI consistency
 */
export function normalizeBomStatus(status: string): BomStatus {
  const normalized = status.toLowerCase();
  // Map legacy/alternate values
  if (normalized === 'draft') return 'pending';
  if (normalized === 'archived') return 'cancelled';
  return normalized as BomStatus;
}

export interface BomLineItem {
  id: string;
  bomId: string;
  lineNumber: number;
  mpn: string;
  manufacturer?: string;
  description?: string;
  quantity: number;
  designator?: string;
  referenceDesignator?: string;
  footprint?: string;

  // Enrichment data
  enrichmentStatus: EnrichmentStatus;
  enrichedAt?: string;
  matchedComponentId?: string;
  matchConfidence?: number;

  // Matched component data
  componentData?: MatchedComponent;

  // Pricing data with defaults
  pricing?: PricingInfo[];

  // Alternates
  alternates?: AlternateComponent[];

  // Risk flags
  lifecycleRisk?: LifecycleRisk;
  riskLevel?: RiskLevel;
  obsolete?: boolean;
  singleSource?: boolean;

  // User notes (customer-specific)
  notes?: string;
}

export interface MatchedComponent {
  id: string;
  mpn?: string;
  manufacturer_part_number?: string;
  manufacturer?: string;
  description?: string;
  category?: string;
  subcategory?: string;
  lifecycle_status?: string;
  lifecycleStatus?: string;  // camelCase alias
  datasheet_url?: string;
  datasheetUrl?: string;     // camelCase alias
  image_url?: string;
  imageUrl?: string;         // camelCase alias
  risk_level?: string;
  riskLevel?: string;        // camelCase alias
  rohs_compliant?: boolean;
  rohsCompliant?: boolean;   // camelCase alias
  reach_compliant?: boolean;
  reachCompliant?: boolean;  // camelCase alias
  aec_qualified?: boolean;
  aecQualified?: boolean;    // camelCase alias
  unit_price?: number;
  unitPrice?: number;        // camelCase alias
  currency?: string;
  moq?: number;
  lead_time_days?: number;
  leadTimeDays?: number;     // camelCase alias
  stock_status?: string;
  stockStatus?: string;      // camelCase alias
  quality_score?: number;
  qualityScore?: number;     // camelCase alias
  enrichment_source?: string;
  enrichmentSource?: string; // camelCase alias
}

export interface PricingInfo {
  supplier: string;
  sku?: string;
  unitPrice: number;
  currency: string;
  stock: number;
  leadTime?: string;
  moq?: number;
  url?: string;
}

export interface AlternateComponent {
  mpn: string;
  manufacturer: string;
  matchScore: number;
  matchType: 'exact' | 'functional' | 'form_fit' | 'suggested';
  componentId?: string;
}

/**
 * Line item enrichment status - aligned with CNS API (migration 008)
 */
export type EnrichmentStatus =
  | 'pending'
  | 'matched'
  | 'enriched'
  | 'no_match'
  | 'error';

/**
 * Legacy enrichment status values for backwards compatibility
 */
export function normalizeEnrichmentStatus(status: string): EnrichmentStatus {
  const normalized = status.toLowerCase();
  if (normalized === 'in_progress') return 'pending';
  if (normalized === 'partial') return 'matched';
  if (normalized === 'not_found') return 'no_match';
  return normalized as EnrichmentStatus;
}

/**
 * Lifecycle risk levels
 */
export type LifecycleRisk = 'none' | 'low' | 'medium' | 'high' | 'critical';

/**
 * BOM line item risk level - aligned with CNS API (migration 017)
 * Represents contextual risk for this BOM (quantity vs availability, lead time, criticality)
 */
export type RiskLevel = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';

export interface BomEnrichmentProgress {
  bomId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress: number;
  totalItems: number;
  processedItems: number;
  matchedItems: number;
  partialItems: number;
  notFoundItems: number;
  errorItems: number;
  startedAt?: string;
  completedAt?: string;
  estimatedTimeRemaining?: number;
  error?: string;
}

export interface BomSummaryStats {
  totalLines: number;
  enrichedLines: number;
  matchedLines: number;
  partialMatches: number;
  notFound: number;
  obsoleteCount: number;
  eolCount: number;
  singleSourceCount: number;
  enrichmentCoverage: number;
  pricingCoverage: number;
}

export interface BomUploadPayload {
  file: File;
  name?: string;
  description?: string;
  projectId?: string;
  autoEnrich?: boolean;
  columnMapping?: BomColumnMapping;
}

export interface BomExportOptions {
  format: 'csv' | 'xlsx' | 'json';
  includeEnrichment: boolean;
  includePricing: boolean;
  includeAlternates: boolean;
}

export interface BomColumnMapping {
  mpn: string;
  manufacturer?: string;
  quantity?: string;
  description?: string;
  designator?: string;
  referenceDesignator?: string;
  footprint?: string;
}

export interface BomFilePreview {
  headers: string[];
  rows: string[][];
  totalRows: number;
  suggestedMapping?: BomColumnMapping;
  detectedDelimiter?: string;
  hasHeaderRow?: boolean;
}

/**
 * 10-Step Upload Flow Types
 */
export type BomUploadStep =
  | 'select_file'
  | 'preview_data'
  | 'map_columns'
  | 'configure_options'
  | 'review_summary'
  | 'uploading'
  | 'processing'    // File parsing/validation
  | 'enriching'     // Component enrichment in progress
  | 'results'       // Enrichment results summary
  | 'complete';

export interface BomUploadState {
  currentStep: BomUploadStep;
  file: File | null;
  preview: BomFilePreview | null;
  mapping: BomColumnMapping;
  bomName: string;
  bomDescription: string;
  projectId?: string;
  autoEnrich: boolean;
  enrichmentLevel: 'basic' | 'standard' | 'comprehensive';
  uploadProgress: number;
  uploadResult: BomUploadResult | null;
  error: string | null;
  validationErrors: ValidationError[];
}

export interface BomUploadResult {
  bomId: string;
  name: string;
  lineCount: number;
  status: BomStatus;
  enrichmentJobId?: string;
}

export interface ValidationError {
  row?: number;
  column?: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Upload step metadata for UI
 */
export const UPLOAD_STEPS: {
  key: BomUploadStep;
  label: string;
  description: string;
}[] = [
  {
    key: 'select_file',
    label: 'Select File',
    description: 'Upload your BOM file',
  },
  {
    key: 'preview_data',
    label: 'Preview',
    description: 'Review your data',
  },
  {
    key: 'map_columns',
    label: 'Map Columns',
    description: 'Configure column mapping',
  },
  {
    key: 'configure_options',
    label: 'Options',
    description: 'Set enrichment options',
  },
  {
    key: 'review_summary',
    label: 'Review',
    description: 'Confirm and upload',
  },
  {
    key: 'uploading',
    label: 'Uploading',
    description: 'Uploading file to server',
  },
  {
    key: 'processing',
    label: 'Processing',
    description: 'Parsing and validating BOM',
  },
  {
    key: 'enriching',
    label: 'Enriching',
    description: 'Enriching components',
  },
  {
    key: 'results',
    label: 'Results',
    description: 'Review enrichment results',
  },
  {
    key: 'complete',
    label: 'Complete',
    description: 'Upload successful',
  },
];
