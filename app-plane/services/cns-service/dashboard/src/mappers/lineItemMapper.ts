/**
 * Line Item Mapper
 *
 * Transforms raw BOM line item data into normalized display objects.
 * Handles field normalization, missing data, and display formatting.
 *
 * IMPORTANT: Updated to use BOMLineItem from types/index.ts for database schema consistency.
 * RawLineItem remains for backward compatibility with various API response formats.
 *
 * @module mappers/lineItemMapper
 */

import { mapQualityScore, mapCompleteness, type QualityDisplay, type CompletenessDisplay } from './riskGradeMapper';
import { mapEnrichmentStatus, type EnrichmentStatusDisplay } from './enrichmentStatusMapper';
import { getSupplierColor, getLifecycleColor, getLifecycleStatus, type LifecycleStatus } from '../theme';
import type { BOMLineItem, MatchMethod, RiskLevel } from '../types';

// ============================================================
// Types
// ============================================================

/**
 * Raw line item data from various API responses.
 *
 * This interface handles legacy and alternative field names for backward compatibility.
 * For database schema types, see BOMLineItem in types/index.ts.
 */
export interface RawLineItem {
  // Primary fields
  id?: string;
  bom_id?: string;
  line_number?: number;
  reference_designator?: string;

  // MPN variations (handle both database and legacy formats)
  mpn?: string;
  manufacturer_part_number?: string;
  part_number?: string;

  // Manufacturer variations
  manufacturer?: string;
  manufacturer_name?: string;

  // Basic fields
  description?: string;
  quantity?: number;
  qty?: number;

  // Component linking
  component_id?: string;

  // Matching fields (from database schema)
  match_confidence?: number;
  match_method?: MatchMethod;

  // Pricing variations
  unit_price?: number;
  price?: number;
  extended_price?: number;
  pricing?: Record<string, unknown>;

  // Technical fields
  category?: string;
  package?: string;
  package_type?: string;
  specifications?: Record<string, unknown>;
  datasheet_url?: string;

  // Lifecycle variations
  lifecycle_status?: string;
  lifecycle?: string;

  // Compliance
  compliance_status?: Record<string, unknown>;

  // Quality fields
  quality_score?: number;
  data_completeness?: number;
  completeness?: number;
  risk_level?: RiskLevel;

  // Enrichment status variations
  enrichment_status?: string;
  status?: string;
  enriched_mpn?: string;
  enriched_manufacturer?: string;
  enrichment_error?: string;

  // Timestamps
  enriched_at?: string;
  last_enriched_at?: string;
  created_at?: string;
  updated_at?: string;

  // Sources
  sources_used?: string[];
  supplier_sources?: string[];

  // Metadata
  metadata?: Record<string, unknown>;
  enrichment_data?: Record<string, unknown>;

  // Storage fields (from database schema)
  redis_component_key?: string;
  component_storage?: string;
}

export interface LineItemDisplay {
  id: string;
  lineNumber: number;
  mpn: string;
  manufacturer: string;
  description: string;
  quantity: number;
  unitPrice: number | null;
  category: string | null;
  packageType: string | null;
  lifecycleStatus: LifecycleStatus;
  lifecycleColor: string;
  qualityDisplay: QualityDisplay;
  completenessDisplay: CompletenessDisplay;
  enrichmentDisplay: EnrichmentStatusDisplay;
  enrichedAt: Date | null;
  supplierSources: Array<{ name: string; color: string }>;
  hasEnrichmentData: boolean;
  rawData: RawLineItem;
}

// ============================================================
// Field Normalization
// ============================================================

/**
 * Extract MPN from various field formats
 */
function extractMPN(item: RawLineItem): string {
  return item.mpn ?? item.manufacturer_part_number ?? item.part_number ?? 'Unknown';
}

/**
 * Extract manufacturer from various field formats
 */
function extractManufacturer(item: RawLineItem): string {
  return item.manufacturer ?? item.manufacturer_name ?? 'Unknown';
}

/**
 * Extract quantity from various field formats
 */
function extractQuantity(item: RawLineItem): number {
  const qty = item.quantity ?? item.qty ?? 0;
  return typeof qty === 'number' ? qty : parseInt(String(qty), 10) || 0;
}

/**
 * Extract unit price from various field formats
 */
function extractUnitPrice(item: RawLineItem): number | null {
  const price = item.unit_price ?? item.price;
  if (price === undefined || price === null) return null;
  return typeof price === 'number' ? price : parseFloat(String(price)) || null;
}

/**
 * Extract package type from various field formats
 */
function extractPackageType(item: RawLineItem): string | null {
  return item.package ?? item.package_type ?? null;
}

/**
 * Extract lifecycle status from various field formats
 */
function extractLifecycle(item: RawLineItem): string {
  return item.lifecycle_status ?? item.lifecycle ?? 'unknown';
}

/**
 * Extract enrichment date from various field formats
 */
function extractEnrichedAt(item: RawLineItem): Date | null {
  const dateStr = item.enriched_at ?? item.last_enriched_at;
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Extract supplier sources from various field formats
 */
function extractSupplierSources(item: RawLineItem): string[] {
  return item.sources_used ?? item.supplier_sources ?? [];
}

// ============================================================
// Main Mapper
// ============================================================

/**
 * Map a raw line item to a display object
 */
export function mapLineItem(item: RawLineItem, index?: number): LineItemDisplay {
  const mpn = extractMPN(item);
  const manufacturer = extractManufacturer(item);
  const lifecycle = extractLifecycle(item);
  const supplierSources = extractSupplierSources(item);
  const enrichmentStatus = item.enrichment_status ?? item.status ?? 'pending';
  const qualityScore = item.quality_score ?? 0;
  const completeness = item.data_completeness ?? item.completeness ?? 0;

  return {
    id: item.id ?? `line-${index ?? 0}`,
    lineNumber: item.line_number ?? (index ?? 0) + 1,
    mpn,
    manufacturer,
    description: item.description ?? '',
    quantity: extractQuantity(item),
    unitPrice: extractUnitPrice(item),
    category: item.category ?? null,
    packageType: extractPackageType(item),
    lifecycleStatus: getLifecycleStatus(lifecycle),
    lifecycleColor: getLifecycleColor(lifecycle),
    qualityDisplay: mapQualityScore(qualityScore),
    completenessDisplay: mapCompleteness(completeness),
    enrichmentDisplay: mapEnrichmentStatus(enrichmentStatus),
    enrichedAt: extractEnrichedAt(item),
    supplierSources: supplierSources.map((name) => ({
      name,
      color: getSupplierColor(name),
    })),
    hasEnrichmentData: Boolean(item.enrichment_data && Object.keys(item.enrichment_data).length > 0),
    rawData: item,
  };
}

/**
 * Map an array of raw line items to display objects
 */
export function mapLineItems(items: RawLineItem[]): LineItemDisplay[] {
  return items.map((item, index) => mapLineItem(item, index));
}

// ============================================================
// Filtering Helpers
// ============================================================

/**
 * Filter line items by enrichment status
 */
export function filterByEnrichmentStatus(
  items: LineItemDisplay[],
  status: 'all' | 'enriched' | 'pending' | 'failed'
): LineItemDisplay[] {
  if (status === 'all') return items;

  return items.filter((item) => {
    switch (status) {
      case 'enriched':
        return item.enrichmentDisplay.isComplete;
      case 'pending':
        return !item.enrichmentDisplay.isComplete && !item.enrichmentDisplay.isFailed;
      case 'failed':
        return item.enrichmentDisplay.isFailed;
      default:
        return true;
    }
  });
}

/**
 * Filter line items by quality routing
 */
export function filterByQualityRoute(
  items: LineItemDisplay[],
  route: 'all' | 'production' | 'staging' | 'review'
): LineItemDisplay[] {
  if (route === 'all') return items;
  return items.filter((item) => item.qualityDisplay.route === route);
}

/**
 * Filter line items by lifecycle status
 */
export function filterByLifecycle(
  items: LineItemDisplay[],
  lifecycle: 'all' | LifecycleStatus
): LineItemDisplay[] {
  if (lifecycle === 'all') return items;
  return items.filter((item) => item.lifecycleStatus === lifecycle);
}

// ============================================================
// Aggregation Helpers
// ============================================================

export interface LineItemsAggregate {
  total: number;
  enriched: number;
  pending: number;
  failed: number;
  productionReady: number;
  needsReview: number;
  averageQuality: number;
  averageCompleteness: number;
  byLifecycle: Record<LifecycleStatus, number>;
  bySupplier: Record<string, number>;
}

/**
 * Calculate aggregate statistics for line items
 */
export function aggregateLineItems(items: LineItemDisplay[]): LineItemsAggregate {
  const byLifecycle: Record<LifecycleStatus, number> = {
    active: 0,
    nrnd: 0,
    obsolete: 0,
    eol: 0,
    unknown: 0,
  };

  const bySupplier: Record<string, number> = {};

  let enriched = 0;
  let pending = 0;
  let failed = 0;
  let productionReady = 0;
  let needsReview = 0;
  let totalQuality = 0;
  let totalCompleteness = 0;

  for (const item of items) {
    // Enrichment status
    if (item.enrichmentDisplay.isComplete) enriched++;
    else if (item.enrichmentDisplay.isFailed) failed++;
    else pending++;

    // Quality routing
    if (item.qualityDisplay.route === 'production') productionReady++;
    else if (item.qualityDisplay.route === 'staging' || item.qualityDisplay.route === 'review') {
      needsReview++;
    }

    // Scores
    totalQuality += item.qualityDisplay.score;
    totalCompleteness += item.completenessDisplay.percentage;

    // Lifecycle
    byLifecycle[item.lifecycleStatus]++;

    // Suppliers
    for (const source of item.supplierSources) {
      bySupplier[source.name] = (bySupplier[source.name] ?? 0) + 1;
    }
  }

  return {
    total: items.length,
    enriched,
    pending,
    failed,
    productionReady,
    needsReview,
    averageQuality: items.length > 0 ? Math.round(totalQuality / items.length) : 0,
    averageCompleteness: items.length > 0 ? Math.round(totalCompleteness / items.length) : 0,
    byLifecycle,
    bySupplier,
  };
}
