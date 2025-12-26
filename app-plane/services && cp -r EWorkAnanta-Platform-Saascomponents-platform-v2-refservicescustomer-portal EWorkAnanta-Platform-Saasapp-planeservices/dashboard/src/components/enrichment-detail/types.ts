/**
 * TypeScript interfaces for Component Enrichment Detail
 *
 * Modular type definitions for the enrichment pipeline
 */

// Main enrichment detail response
export interface EnrichmentDetail {
  component: ComponentSummary;
  pipeline: EnrichmentPipeline;
  metadata: EnrichmentMetadata;
}

// Component summary
export interface ComponentSummary {
  mpn: string;
  manufacturer: string | null;
  final_score: number;
  routing: 'production' | 'staging' | 'rejected';
  catalog_id: number | null;
  created_at: string;
}

// Complete enrichment pipeline
export interface EnrichmentPipeline {
  step1_input: InputDataStep;
  step2_catalog: CatalogCheckStep;
  step3_suppliers: SupplierAPIStep;
  step4_ai?: AIEnhancementStep;
  step5_normalization: NormalizationStep;
  step6_quality: QualityScoringStep;
  step7_storage: StorageStep;
}

// Metadata
export interface EnrichmentMetadata {
  total_time_ms: number;
  total_cost_usd: number;
  enrichment_source: string;
  bom_job_id?: string;
  tenant_id?: string;
}

// Step 1: Input Data
export interface InputDataStep {
  source: string;
  data: Record<string, any>;
  timestamp: string;
}

// Step 2: Catalog Check
export interface CatalogCheckStep {
  found: boolean;
  match?: {
    component_id: number;
    confidence: number;
    data: Record<string, any>;
  };
}

// Step 3: Supplier APIs
export interface SupplierAPIStep {
  mouser?: SupplierResponse;
  digikey?: SupplierResponse;
  element14?: SupplierResponse;
  selected: string | null;
  best_confidence: number;
}

export interface SupplierResponse {
  found: boolean;
  confidence: number;
  response_time_ms: number;
  data?: Record<string, any>;
  error?: string;
}

// Step 4: AI Enhancement
export interface AIEnhancementStep {
  enabled: boolean;
  provider: string;
  operations: AIOperation[];
  total_cost_usd: number;
  total_time_ms: number;
}

export interface AIOperation {
  type: 'category_suggestion' | 'spec_extraction' | 'description_enhancement';
  input_prompt: string;
  output: Record<string, any>;
  cost_usd: number;
  processing_time_ms: number;
  confidence?: number;
  reasoning?: string;
}

// Step 5: Normalization
export interface NormalizationStep {
  before: Record<string, any>;
  after: Record<string, any>;
  rules_applied: NormalizationRule[];
  fields_normalized: number;
  issues_fixed: any[];
  processing_time_ms: number;
}

export interface NormalizationRule {
  field: string;
  rule: string;
  before_value: any;
  after_value: any;
}

// Step 6: Quality Scoring
export interface QualityScoringStep {
  total_score: number;
  breakdown: QualityCriterion[];
  routing_decision: 'production' | 'staging' | 'rejected';
  routing_reason: string;
}

export interface QualityCriterion {
  criterion: string;
  points: number;
  passed: boolean;
  message?: string;
}

// Step 7: Storage
export interface StorageStep {
  redis: {
    saved: boolean;
    key: string;
    ttl_days: number;
  };
  postgres: {
    saved: boolean;
    table: string;
    id: number;
  };
}

// For comparison table
export interface FieldComparison {
  field_name: string;
  input_value: any;
  mouser_value?: any;
  digikey_value?: any;
  element14_value?: any;
  ai_value?: any;
  final_value: any;
  selected_source: string;
}
