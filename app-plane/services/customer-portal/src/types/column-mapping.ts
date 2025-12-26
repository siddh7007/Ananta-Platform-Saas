/**
 * Type definitions for Smart Column Mapping with AI Detection
 * @module types/column-mapping
 */

/**
 * Match reason for column suggestion
 */
export type MatchReason =
  | 'exact_match'
  | 'fuzzy_match'
  | 'pattern_match'
  | 'sample_analysis';

/**
 * Alternative mapping suggestion
 */
export interface AlternativeSuggestion {
  target: string;
  confidence: number;
}

/**
 * AI-generated column mapping suggestion
 */
export interface ColumnSuggestion {
  /** Source column name from uploaded file */
  sourceColumn: string;
  /** Suggested target field mapping */
  suggestedTarget: string;
  /** Confidence score 0-100 */
  confidence: number;
  /** Reason for the match */
  matchReason: MatchReason;
  /** Alternative suggestions with confidence scores */
  alternatives: AlternativeSuggestion[];
}

/**
 * Column mapping from pattern to target field
 */
export interface ColumnMapping {
  /** Pattern to match (normalized column name) */
  pattern: string;
  /** Target field name */
  target: string;
}

/**
 * Saved mapping template for reuse
 */
export interface MappingTemplate {
  /** Unique identifier */
  id: string;
  /** User-friendly name */
  name: string;
  /** Optional description */
  description?: string;
  /** Tenant ID for multi-tenancy */
  tenantId: string;
  /** Column mappings in this template */
  mappings: ColumnMapping[];
  /** Number of times template has been used */
  usageCount: number;
  /** Last usage timestamp */
  lastUsed: Date;
  /** User ID who created the template */
  createdBy: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Whether template is shared org-wide (requires admin+) */
  isShared: boolean;
}

/**
 * Request payload for column analysis
 */
export interface ColumnAnalysisRequest {
  /** Column headers from uploaded file */
  headers: string[];
  /** Sample rows of data for pattern analysis */
  sampleRows: Record<string, unknown>[];
  /** Tenant ID for template matching */
  tenantId: string;
}

/**
 * Matched template information
 */
export interface MatchedTemplate {
  /** Template ID */
  id: string;
  /** Template name */
  name: string;
  /** Match score 0-100 */
  matchScore: number;
}

/**
 * Response from column analysis
 */
export interface ColumnAnalysisResponse {
  /** AI-generated suggestions for each column */
  suggestions: ColumnSuggestion[];
  /** Best matching template if found */
  matchedTemplate?: MatchedTemplate;
}

/**
 * Target field option for dropdowns
 */
export interface TargetFieldOption {
  /** Field value/key */
  value: string;
  /** Display label */
  label: string;
}

/**
 * Confidence level categories
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/**
 * Template creation request (without auto-generated fields)
 */
export type CreateMappingTemplateRequest = Omit<
  MappingTemplate,
  'id' | 'createdAt' | 'usageCount' | 'lastUsed'
>;

/**
 * Template update request (partial fields)
 */
export type UpdateMappingTemplateRequest = Partial<
  Pick<MappingTemplate, 'name' | 'description' | 'mappings' | 'isShared'>
>;
