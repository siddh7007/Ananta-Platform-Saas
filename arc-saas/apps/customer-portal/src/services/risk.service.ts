import { cnsApi, assertTenantContext } from '@/lib/axios';
import type { BomRiskAnalysis } from '@/types/risk';
import type { RiskLevel } from '@/types/bom';

/**
 * Risk Analysis Service
 * Handles BOM risk analysis operations via CNS Service API
 */

// =============================================================================
// API Response Types (aligned with CNS /api/risk endpoints)
// =============================================================================

export interface ComponentRiskScore {
  component_id: string;
  mpn?: string;
  manufacturer?: string;
  lifecycle_risk: number;
  supply_chain_risk: number;
  compliance_risk: number;
  obsolescence_risk: number;
  single_source_risk: number;
  total_risk_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  risk_factors?: Record<string, unknown>;
  mitigation_suggestions?: string;
  calculated_at?: string;
  calculation_method?: string;
}

export interface PortfolioRiskSummary {
  total_components: number;
  risk_distribution: Record<string, number>;
  average_risk_score: number;
  trend: 'improving' | 'stable' | 'worsening';
  high_risk_components: ComponentRiskScore[];
  top_risk_factors: string[];
}

export interface BomRiskSummaryResponse {
  bom_id: string;
  bom_name?: string;
  project_id?: string;
  project_name?: string;
  total_line_items: number;
  low_risk_count: number;
  medium_risk_count: number;
  high_risk_count: number;
  critical_risk_count: number;
  average_risk_score: number;
  weighted_risk_score: number;
  health_grade: string;
  score_trend: string;
  // Category-specific counts (from CNS risk calculator)
  lifecycle_risk_count?: number;
  supply_chain_risk_count?: number;
  compliance_risk_count?: number;
  obsolescence_risk_count?: number;
  single_source_risk_count?: number;
  top_risk_components: Array<{
    line_item_id: string;
    mpn?: string;
    manufacturer?: string;
    risk_score: number;
    risk_level: string;
  }>;
}

export interface BomLineItemRiskResponse {
  line_item_id: string;
  mpn?: string;
  manufacturer?: string;
  quantity: number;
  base_risk_score: number;
  contextual_risk_score: number;
  risk_level: string;
  user_criticality_level: number;
  quantity_modifier: number;
  lead_time_modifier: number;
  criticality_modifier: number;
  // Category flags for breakdown
  has_lifecycle_risk?: boolean;
  has_supply_chain_risk?: boolean;
  has_compliance_risk?: boolean;
  lifecycle_status?: string;
}

/**
 * Paginated response for BOM line items with risk
 */
export interface PaginatedBomLineItemsRisk {
  data: BomLineItemRiskResponse[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface RiskStatistics {
  total_components: number;
  average_risk_score: number;
  risk_distribution: Record<string, number>;
  factor_averages: {
    lifecycle: number;
    supply_chain: number;
    compliance: number;
    obsolescence: number;
    single_source: number;
  };
  components_requiring_attention: number;
}

export interface RiskAnalysisWorkflowResponse {
  status: 'started' | 'running' | 'completed' | 'failed';
  workflow_id: string;
  organization_id: string;
  bom_id?: string;
  message: string;
}

export interface RiskReportExportRequest {
  bomId: string;
  format: 'csv' | 'pdf' | 'json';
  includeLineItems?: boolean;
  includeRecommendations?: boolean;
}

// =============================================================================
// Risk Analysis Functions
// =============================================================================

/**
 * Get portfolio-level risk summary for the organization
 */
export async function getPortfolioRisk(
  forceRefresh = false
): Promise<PortfolioRiskSummary> {
  // Ensure tenant context for multi-tenant isolation
  assertTenantContext();
  const response = await cnsApi.get('/risk/portfolio', {
    params: { force_refresh: forceRefresh },
  });
  return response.data;
}

/**
 * Get risk statistics for the organization
 */
export async function getRiskStatistics(): Promise<RiskStatistics> {
  // Ensure tenant context for multi-tenant isolation
  assertTenantContext();
  const response = await cnsApi.get('/risk/stats');
  return response.data;
}

/**
 * Get high-risk components
 */
export async function getHighRiskComponents(params?: {
  minScore?: number;
  limit?: number;
}): Promise<ComponentRiskScore[]> {
  // Ensure tenant context for multi-tenant isolation
  assertTenantContext();
  const response = await cnsApi.get('/risk/high-risk', {
    params: {
      min_score: params?.minScore ?? 61,
      limit: params?.limit ?? 50,
    },
  });
  return response.data;
}

/**
 * Get risk score for a single component
 */
export async function getComponentRisk(
  componentId: string,
  bypassCache = false
): Promise<ComponentRiskScore> {
  // Ensure tenant context for multi-tenant isolation
  assertTenantContext();
  const response = await cnsApi.get(`/risk/component/${componentId}`, {
    params: { bypass_cache: bypassCache },
  });
  return response.data;
}

/**
 * Get risk scores for multiple components
 */
export async function getBatchRiskScores(
  componentIds: string[]
): Promise<ComponentRiskScore[]> {
  // Ensure tenant context for multi-tenant isolation
  assertTenantContext();
  const response = await cnsApi.post('/risk/components', {
    component_ids: componentIds,
  });
  return response.data;
}

/**
 * Trigger risk calculation for a component
 */
export async function calculateComponentRisk(
  componentId: string,
  forceRecalculate = false
): Promise<ComponentRiskScore> {
  // Ensure tenant context for multi-tenant isolation
  assertTenantContext();
  const response = await cnsApi.post(`/risk/calculate/${componentId}`, {
    force_recalculate: forceRecalculate,
  });
  return response.data;
}

/**
 * Get risk history for a component
 */
export async function getRiskHistory(
  componentId: string,
  limit = 30
): Promise<
  Array<{
    recorded_date: string;
    total_risk_score: number;
    risk_level: string;
    score_change: number;
    lifecycle_risk?: number;
    supply_chain_risk?: number;
    compliance_risk?: number;
    obsolescence_risk?: number;
    single_source_risk?: number;
  }>
> {
  // Ensure tenant context for multi-tenant isolation
  assertTenantContext();
  const response = await cnsApi.get(`/risk/history/${componentId}`, {
    params: { limit },
  });
  return response.data;
}

// =============================================================================
// BOM Risk Analysis Functions
// =============================================================================

/**
 * Get all BOMs with their risk summaries
 */
export async function getBomsWithRisk(params?: {
  projectId?: string;
  healthGrade?: string;
  limit?: number;
  offset?: number;
}): Promise<BomRiskSummaryResponse[]> {
  // Ensure tenant context for multi-tenant isolation
  assertTenantContext();
  const response = await cnsApi.get('/risk/boms', {
    params: {
      project_id: params?.projectId,
      health_grade: params?.healthGrade,
      limit: params?.limit ?? 50,
      offset: params?.offset ?? 0,
    },
  });
  return response.data;
}

/**
 * Get detailed risk summary for a single BOM
 */
export async function getBomRiskDetail(
  bomId: string
): Promise<BomRiskSummaryResponse> {
  // Ensure tenant context for multi-tenant isolation
  assertTenantContext();
  const response = await cnsApi.get(`/risk/boms/${bomId}`);
  return response.data;
}

/**
 * Get BOM line items with their risk scores (paginated)
 */
export async function getBomLineItemsWithRisk(
  bomId: string,
  params?: {
    riskLevel?: string;
    limit?: number;
    offset?: number;
  }
): Promise<PaginatedBomLineItemsRisk> {
  // Ensure tenant context for multi-tenant isolation
  assertTenantContext();

  const limit = params?.limit ?? 100;
  const offset = params?.offset ?? 0;

  const response = await cnsApi.get(`/risk/boms/${bomId}/line_items`, {
    params: {
      risk_level: params?.riskLevel,
      limit,
      offset,
    },
  });

  // Handle both array response and paginated response from API
  const data = response.data;
  if (Array.isArray(data)) {
    // Legacy array response - convert to paginated format
    return {
      data,
      total: data.length,
      limit,
      offset,
      hasMore: false, // Unknown with legacy format
    };
  }

  // Proper paginated response
  // Extract items from either data.data or data.items (API may use either)
  const items = data.data ?? data.items ?? [];
  const totalCount = data.total ?? data.count ?? 0;
  const currentOffset = data.offset ?? offset;

  return {
    data: items,
    total: totalCount,
    limit: data.limit ?? limit,
    offset: currentOffset,
    // hasMore: true if (offset + returned items) < total
    hasMore: currentOffset + items.length < totalCount,
  };
}

/**
 * Get all high-risk BOM line items (fetches all pages)
 * Use this for comprehensive risk analysis views
 */
export async function getAllHighRiskLineItems(
  bomId: string,
  minRiskLevel: 'high' | 'critical' = 'high'
): Promise<BomLineItemRiskResponse[]> {
  // Ensure tenant context for multi-tenant isolation
  // Note: getBomLineItemsWithRisk also checks, but we validate upfront to fail fast
  assertTenantContext();

  const allItems: BomLineItemRiskResponse[] = [];
  let offset = 0;
  const limit = 100;
  let hasMore = true;

  while (hasMore) {
    const result = await getBomLineItemsWithRisk(bomId, {
      riskLevel: minRiskLevel,
      limit,
      offset,
    });

    allItems.push(...result.data);
    hasMore = result.hasMore;
    offset += limit;

    // Safety limit to prevent infinite loops
    if (offset > 10000) break;
  }

  return allItems;
}

/**
 * Get ALL BOM line items with risk (fetches all pages)
 * Use this for comprehensive exports to ensure no data is truncated
 */
export async function getAllBomLineItemsWithRisk(
  bomId: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<BomLineItemRiskResponse[]> {
  assertTenantContext();

  const allItems: BomLineItemRiskResponse[] = [];
  let offset = 0;
  const limit = 100;
  let hasMore = true;
  let total = 0;

  while (hasMore) {
    const result = await getBomLineItemsWithRisk(bomId, { limit, offset });

    allItems.push(...result.data);
    hasMore = result.hasMore;
    total = result.total;
    offset += limit;

    // Report progress if callback provided
    if (onProgress) {
      onProgress(allItems.length, total);
    }

    // Safety limit to prevent infinite loops
    if (offset > 10000) break;
  }

  return allItems;
}

/**
 * Update criticality level for a BOM line item
 */
export async function updateLineItemCriticality(
  bomId: string,
  lineItemId: string,
  criticalityLevel: number
): Promise<{
  status: string;
  line_item_id: string;
  criticality_level: number;
  new_contextual_score: number;
}> {
  // Ensure tenant context for multi-tenant isolation
  assertTenantContext();
  const response = await cnsApi.put(
    `/risk/boms/${bomId}/line_items/${lineItemId}/criticality`,
    { criticality_level: criticalityLevel }
  );
  return response.data;
}

/**
 * Trigger recalculation of risk scores for a BOM
 */
export async function recalculateBomRisk(bomId: string): Promise<{
  status: string;
  bom_id: string;
  total_line_items: number;
  average_risk_score: number;
  health_grade: string;
  risk_distribution: Record<string, number>;
}> {
  // Ensure tenant context for multi-tenant isolation
  assertTenantContext();
  const response = await cnsApi.post(`/risk/recalculate/bom/${bomId}`);
  return response.data;
}

/**
 * Trigger BOM risk analysis workflow
 */
export async function runRiskAnalysis(params?: {
  bomId?: string;
  forceRecalculate?: boolean;
}): Promise<RiskAnalysisWorkflowResponse> {
  // Ensure tenant context for multi-tenant isolation
  assertTenantContext();
  const response = await cnsApi.post('/risk/analyze', {
    bom_id: params?.bomId,
    force_recalculate: params?.forceRecalculate ?? false,
  });
  return response.data;
}

/**
 * Get status of a risk analysis workflow
 */
export async function getRiskAnalysisStatus(workflowId: string): Promise<{
  workflow_id: string;
  status: string;
  temporal_status: string;
  result?: unknown;
}> {
  // Ensure tenant context for multi-tenant isolation
  assertTenantContext();
  const response = await cnsApi.get(`/risk/analyze/${workflowId}/status`);
  return response.data;
}

/**
 * Export risk report for a BOM
 * Returns a Blob that can be downloaded by the browser
 */
export async function exportRiskReport(
  request: RiskReportExportRequest
): Promise<Blob> {
  // Ensure tenant context for multi-tenant isolation
  assertTenantContext();
  const response = await cnsApi.get(`/risk/boms/${request.bomId}/export`, {
    params: {
      format: request.format,
      include_line_items: request.includeLineItems ?? true,
      include_recommendations: request.includeRecommendations ?? true,
    },
    responseType: 'blob',
  });
  return response.data;
}

/**
 * Generate risk report client-side (for when API export is unavailable)
 * Creates CSV/JSON export from loaded risk data
 */
export function generateRiskReportClientSide(
  summary: BomRiskSummaryResponse,
  lineItems: BomLineItemRiskResponse[],
  format: 'csv' | 'json'
): Blob {
  if (format === 'json') {
    const reportData = {
      report_generated_at: new Date().toISOString(),
      bom_id: summary.bom_id,
      bom_name: summary.bom_name,
      health_grade: summary.health_grade,
      average_risk_score: summary.average_risk_score,
      risk_distribution: {
        low: summary.low_risk_count,
        medium: summary.medium_risk_count,
        high: summary.high_risk_count,
        critical: summary.critical_risk_count,
        total: summary.total_line_items,
      },
      top_risk_components: summary.top_risk_components,
      line_items: lineItems.map((item) => ({
        line_item_id: item.line_item_id,
        mpn: item.mpn,
        manufacturer: item.manufacturer,
        quantity: item.quantity,
        base_risk_score: item.base_risk_score,
        contextual_risk_score: item.contextual_risk_score,
        risk_level: item.risk_level,
        criticality_level: item.user_criticality_level,
        lifecycle_status: item.lifecycle_status,
        has_lifecycle_risk: item.has_lifecycle_risk,
        has_supply_chain_risk: item.has_supply_chain_risk,
        has_compliance_risk: item.has_compliance_risk,
      })),
    };
    return new Blob([JSON.stringify(reportData, null, 2)], {
      type: 'application/json',
    });
  }

  // CSV format
  const csvRows: string[] = [];

  // Summary section
  csvRows.push('# Risk Report Summary');
  csvRows.push(`Report Generated,${new Date().toISOString()}`);
  csvRows.push(`BOM ID,${summary.bom_id}`);
  csvRows.push(`BOM Name,${summary.bom_name || 'Untitled'}`);
  csvRows.push(`Health Grade,${summary.health_grade}`);
  csvRows.push(`Average Risk Score,${summary.average_risk_score.toFixed(2)}`);
  csvRows.push(`Total Components,${summary.total_line_items}`);
  csvRows.push(`Low Risk Count,${summary.low_risk_count}`);
  csvRows.push(`Medium Risk Count,${summary.medium_risk_count}`);
  csvRows.push(`High Risk Count,${summary.high_risk_count}`);
  csvRows.push(`Critical Risk Count,${summary.critical_risk_count}`);
  csvRows.push('');

  // Line items section
  csvRows.push('# Component Risk Details');
  csvRows.push(
    'Line Item ID,MPN,Manufacturer,Quantity,Base Score,Context Score,Risk Level,Criticality,Lifecycle Status,Has Lifecycle Risk,Has Supply Chain Risk,Has Compliance Risk'
  );

  for (const item of lineItems) {
    const row = [
      item.line_item_id,
      `"${(item.mpn || '').replace(/"/g, '""')}"`,
      `"${(item.manufacturer || '').replace(/"/g, '""')}"`,
      item.quantity,
      item.base_risk_score,
      item.contextual_risk_score,
      item.risk_level,
      item.user_criticality_level,
      item.lifecycle_status || '',
      item.has_lifecycle_risk ? 'Yes' : 'No',
      item.has_supply_chain_risk ? 'Yes' : 'No',
      item.has_compliance_risk ? 'Yes' : 'No',
    ].join(',');
    csvRows.push(row);
  }

  return new Blob([csvRows.join('\n')], { type: 'text/csv' });
}

// =============================================================================
// Risk Profile Functions
// =============================================================================

export interface RiskProfile {
  id?: string;
  organization_id: string;
  lifecycle_weight: number;
  supply_chain_weight: number;
  compliance_weight: number;
  obsolescence_weight: number;
  single_source_weight: number;
  low_threshold: number;
  medium_threshold: number;
  high_threshold: number;
  quantity_weight: number;
  lead_time_weight: number;
  criticality_weight: number;
  preset_name: string;
  custom_factors: unknown[];
}

export interface RiskPreset {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  lifecycle_weight: number;
  supply_chain_weight: number;
  compliance_weight: number;
  obsolescence_weight: number;
  single_source_weight: number;
  low_threshold: number;
  medium_threshold: number;
  high_threshold: number;
}

/**
 * Get organization's risk profile
 */
export async function getRiskProfile(): Promise<RiskProfile> {
  // Ensure tenant context for multi-tenant isolation
  assertTenantContext();
  const response = await cnsApi.get('/risk/profile');
  return response.data;
}

/**
 * Update organization's risk profile
 */
export async function updateRiskProfile(
  updates: Partial<Omit<RiskProfile, 'id' | 'organization_id'>>
): Promise<RiskProfile> {
  // Ensure tenant context for multi-tenant isolation
  assertTenantContext();
  const response = await cnsApi.put('/risk/profile', updates);
  return response.data;
}

/**
 * Reset risk profile to defaults
 */
export async function resetRiskProfile(): Promise<RiskProfile> {
  // Ensure tenant context for multi-tenant isolation
  assertTenantContext();
  const response = await cnsApi.post('/risk/profile/reset');
  return response.data;
}

/**
 * Get available industry presets
 */
export async function getRiskPresets(): Promise<RiskPreset[]> {
  // Ensure tenant context for multi-tenant isolation
  assertTenantContext();
  const response = await cnsApi.get('/risk/profile/presets');
  return response.data;
}

/**
 * Apply an industry preset to the risk profile
 */
export async function applyRiskPreset(
  presetName: string
): Promise<RiskProfile> {
  // Ensure tenant context for multi-tenant isolation
  assertTenantContext();
  const response = await cnsApi.post('/risk/profile/apply-preset', {
    preset_name: presetName,
  });
  return response.data;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Normalize risk level string to lowercase for comparison
 * Handles uppercase, lowercase, and mixed case from API
 */
export function normalizeRiskLevel(level: string | undefined | null): string {
  if (!level) return 'low';
  return level.toLowerCase().trim();
}

/**
 * Check if a risk level is "high" or "critical" (case-insensitive)
 */
export function isHighRiskLevel(level: string | undefined | null): boolean {
  const normalized = normalizeRiskLevel(level);
  return normalized === 'high' || normalized === 'critical';
}

/**
 * Map CNS API risk level to UI RiskLevel type
 */
export function mapRiskLevel(level: string): RiskLevel {
  const map: Record<string, RiskLevel> = {
    low: 'GREEN',
    medium: 'YELLOW',
    high: 'ORANGE',
    critical: 'RED',
  };
  return map[normalizeRiskLevel(level)] ?? 'GREEN';
}

/**
 * Map UI RiskLevel to CNS API risk level
 */
export function unmapRiskLevel(level: RiskLevel): string {
  const map: Record<RiskLevel, string> = {
    GREEN: 'low',
    YELLOW: 'medium',
    ORANGE: 'high',
    RED: 'critical',
  };
  return map[level];
}

/**
 * Get health grade description
 */
export function getHealthGradeDescription(grade: string): string {
  const descriptions: Record<string, string> = {
    A: 'Excellent - Low risk across all components',
    B: 'Good - Minor risk areas to monitor',
    C: 'Fair - Some components require attention',
    D: 'Poor - Multiple high-risk components',
    F: 'Critical - Immediate action required',
    'N/A': 'Not analyzed yet',
  };
  return descriptions[grade] ?? 'Unknown';
}

/**
 * Get health grade color
 */
export function getHealthGradeColor(grade: string): {
  text: string;
  bg: string;
  border: string;
} {
  const colors: Record<string, { text: string; bg: string; border: string }> = {
    A: { text: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
    B: { text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
    C: { text: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200' },
    D: { text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
    F: { text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
  };
  return colors[grade] ?? { text: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-200' };
}

/**
 * Transform BomRiskSummaryResponse to BomRiskAnalysis for UI
 */
export function transformToBomRiskAnalysis(
  response: BomRiskSummaryResponse
): Partial<BomRiskAnalysis> {
  return {
    bomId: response.bom_id,
    bomName: response.bom_name ?? 'Untitled BOM',
    analyzedAt: new Date().toISOString(),
    overallRiskScore: Math.round(response.average_risk_score),
    overallRiskLevel: mapRiskLevel(
      response.critical_risk_count > 0
        ? 'critical'
        : response.high_risk_count > 0
          ? 'high'
          : response.medium_risk_count > 0
            ? 'medium'
            : 'low'
    ),
    summary: {
      totalLines: response.total_line_items,
      analyzedLines: response.total_line_items,
      greenCount: response.low_risk_count,
      yellowCount: response.medium_risk_count,
      orangeCount: response.high_risk_count,
      redCount: response.critical_risk_count,
      obsoleteCount: 0, // Would need additional data
      eolCount: 0,
      nrndCount: 0,
      activeCount: 0,
      unknownLifecycleCount: 0,
      singleSourceCount: 0,
      noStockCount: 0,
      longLeadTimeCount: 0,
      lifecycleCoverage: 100,
      pricingCoverage: 0,
    },
    criticalItems: response.top_risk_components.map((item) => ({
      lineItemId: item.line_item_id,
      lineNumber: 0,
      mpn: item.mpn ?? '',
      manufacturer: item.manufacturer ?? 'Unknown',
      quantity: 0,
      riskLevel: mapRiskLevel(item.risk_level),
      riskScore: item.risk_score,
      riskFactors: [],
      supplierCount: 0,
      totalStock: 0,
      isSingleSource: false,
      alternatesCount: 0,
      hasDropInReplacement: false,
      currency: 'USD',
    })),
    recommendations: [],
  };
}

export default {
  // Portfolio
  getPortfolioRisk,
  getRiskStatistics,
  getHighRiskComponents,
  // Component
  getComponentRisk,
  getBatchRiskScores,
  calculateComponentRisk,
  getRiskHistory,
  // BOM
  getBomsWithRisk,
  getBomRiskDetail,
  getBomLineItemsWithRisk,
  getAllBomLineItemsWithRisk,
  getAllHighRiskLineItems,
  updateLineItemCriticality,
  recalculateBomRisk,
  runRiskAnalysis,
  getRiskAnalysisStatus,
  // Export
  exportRiskReport,
  generateRiskReportClientSide,
  // Profile
  getRiskProfile,
  updateRiskProfile,
  resetRiskProfile,
  getRiskPresets,
  applyRiskPreset,
  // Utilities
  normalizeRiskLevel,
  isHighRiskLevel,
  mapRiskLevel,
  unmapRiskLevel,
  getHealthGradeDescription,
  getHealthGradeColor,
  transformToBomRiskAnalysis,
};
