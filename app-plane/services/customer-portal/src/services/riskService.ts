/**
 * Risk Analysis API Service
 *
 * Provides methods to interact with the CNS Risk Analysis endpoints.
 * Supports multi-level filtering (tenant -> project -> BOM) and configurable risk profiles.
 */

import { CNS_BASE_URL, getAuthHeaders } from './cnsApi';

// =====================
// Risk Profile Types
// =====================

export interface RiskWeights {
  lifecycle: number;
  supply_chain: number;
  compliance: number;
  obsolescence: number;
  single_source: number;
}

export interface RiskThresholds {
  low_max: number;
  medium_max: number;
  high_max: number;
}

export interface BOMHealthThresholds {
  a_grade_max_high_pct: number;
  b_grade_max_high_pct: number;
  c_grade_max_high_pct: number;
  d_grade_max_high_pct: number;
}

export interface CustomRiskFactors {
  factors: Array<{
    name: string;
    weight: number;
    description: string;
  }>;
}

export interface RiskProfile {
  id: string;
  organization_id: string;
  weights: RiskWeights;
  thresholds: RiskThresholds;
  bom_health_thresholds: BOMHealthThresholds;
  custom_factors: CustomRiskFactors | null;
  enable_contextual_scoring: boolean;
  quantity_impact_weight: number;
  lead_time_impact_weight: number;
  criticality_impact_weight: number;
  created_at: string;
  updated_at: string;
}

export interface RiskPreset {
  id: string;
  name: string;
  description: string;
  industry: string;
  weights: RiskWeights;
  thresholds: RiskThresholds;
  bom_health_thresholds: BOMHealthThresholds;
}

// =====================
// BOM Risk Types
// =====================

export interface BOMRiskSummary {
  id: string;
  bom_id: string;
  bom_name: string;
  project_id: string | null;
  project_name: string | null;
  total_line_items: number;
  avg_risk_score: number;
  weighted_risk_score: number;
  risk_distribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  health_grade: 'A' | 'B' | 'C' | 'D' | 'F';
  high_risk_percentage: number;
  critical_risk_percentage: number;
  top_risk_factors: string[];
  calculated_at: string;
}

export interface BOMLineItemRisk {
  id: string;
  line_item_id: string;
  mpn: string;
  manufacturer: string | null;
  quantity: number;
  criticality: 'low' | 'medium' | 'high' | 'critical';
  base_risk_score: number;
  contextual_risk_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  risk_factors: {
    lifecycle: number;
    supply_chain: number;
    compliance: number;
    obsolescence: number;
    single_source: number;
  };
  context_modifiers: {
    quantity_modifier: number;
    lead_time_modifier: number;
    criticality_modifier: number;
  };
  calculated_at: string;
}

export interface ProjectRiskSummary {
  id: string;
  project_id: string;
  project_name: string;
  total_boms: number;
  total_line_items: number;
  avg_bom_health_score: number;
  worst_health_grade: 'A' | 'B' | 'C' | 'D' | 'F';
  risk_distribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  calculated_at: string;
}

// =====================
// Component Risk Types (existing)
// =====================

export interface ComponentRiskScore {
  component_id: string;
  mpn: string | null;
  manufacturer: string | null;
  lifecycle_risk: number;
  supply_chain_risk: number;
  compliance_risk: number;
  obsolescence_risk: number;
  single_source_risk: number;
  total_risk_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  risk_factors: Record<string, any> | null;
  mitigation_suggestions: string | null;
  calculated_at: string | null;
  calculation_method: string;
}

export interface RiskScoreHistory {
  recorded_date: string;
  total_risk_score: number;
  risk_level: string;
  score_change: number;
  lifecycle_risk: number | null;
  supply_chain_risk: number | null;
  compliance_risk: number | null;
  obsolescence_risk: number | null;
  single_source_risk: number | null;
}

export interface PortfolioRiskSummary {
  total_components: number;
  risk_distribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  average_risk_score: number;
  trend: 'improving' | 'stable' | 'worsening';
  high_risk_components: ComponentRiskScore[];
  top_risk_factors: string[];
}

export interface RiskStatistics {
  total_components: number;
  average_risk_score: number;
  risk_distribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  factor_averages: {
    lifecycle: number;
    supply_chain: number;
    compliance: number;
    obsolescence: number;
    single_source: number;
  };
  components_requiring_attention: number;
}

export interface BulkCalculationResult {
  total_requested: number;
  successful: number;
  failed: number;
  scores: ComponentRiskScore[];
  errors: Array<{ component_id: string; error: string }>;
}

export interface MitigationAssignmentRequest {
  component_id: string;
  assignee_name: string;
  assignee_email: string;
  due_date?: string | null;
  status: string;
  priority: string;
  notes?: string;
  tags?: string[];
}

class RiskApiService {
  private baseURL: string;
  private fallbackBaseURL: string | null;

  constructor(baseURL: string = CNS_BASE_URL) {
    this.baseURL = baseURL;
    this.fallbackBaseURL = this.resolveFallbackBaseUrl(baseURL);
  }

  private resolveFallbackBaseUrl(primary: string): string | null {
    const explicitFallback = import.meta.env.VITE_CNS_API_FALLBACK_URL;
    if (explicitFallback && explicitFallback !== primary) {
      return explicitFallback;
    }

    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      const isLocalhost = host === 'localhost' || host === '127.0.0.1';
      if (isLocalhost && primary.includes('27800')) {
        return 'http://localhost:27500/cns-api';
      }
    }

    return null;
  }

  private async fetchWithFallback(
    path: string,
    init?: RequestInit,
    useFallback: boolean = true
  ): Promise<Response> {
    const targets = [this.baseURL];
    if (useFallback && this.fallbackBaseURL && this.fallbackBaseURL !== this.baseURL) {
      targets.push(this.fallbackBaseURL);
    }

    let lastError: Error | null = null;

    for (const target of targets) {
      try {
        const response = await fetch(`${target}${path}`, init);
        if (response.ok) {
          return response;
        }

        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        const message = errorData.detail || `Request failed: ${response.statusText}`;

        if (response.status === 404 && target !== targets[targets.length - 1]) {
          console.warn(`[RiskApi] ${message} at ${target}${path}; retrying with fallback...`);
          lastError = new Error(message);
          continue;
        }

        throw new Error(message);
      } catch (error: any) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (target === targets[targets.length - 1]) {
          throw lastError;
        }
        console.warn(`[RiskApi] Request to ${target}${path} failed: ${lastError.message}. Trying fallback...`);
      }
    }

    throw lastError || new Error('Unable to reach CNS risk API');
  }

  private async fetchJson<T>(path: string, init?: RequestInit, options?: { useFallback?: boolean }): Promise<T> {
    const response = await this.fetchWithFallback(path, init, options?.useFallback ?? true);
    return response.json();
  }

  /**
   * Get risk score for a single component
   */
  async getComponentRisk(componentId: string): Promise<ComponentRiskScore> {
    const authHeaders = await getAuthHeaders();
    return this.fetchJson(`/api/risk/component/${componentId}`, {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    });
  }

  /**
   * Get risk scores for multiple components
   */
  async getBatchRiskScores(componentIds: string[]): Promise<ComponentRiskScore[]> {
    const authHeaders = await getAuthHeaders();
    return this.fetchJson(`/api/risk/components`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({ component_ids: componentIds }),
    });
  }

  /**
   * Trigger risk calculation for a component
   */
  async calculateRisk(componentId: string, forceRecalculate: boolean = false): Promise<ComponentRiskScore> {
    const authHeaders = await getAuthHeaders();
    return this.fetchJson(`/api/risk/calculate/${componentId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({ force_recalculate: forceRecalculate }),
    });
  }

  /**
   * Trigger bulk risk calculation for multiple components
   * @param componentIds Array of component IDs (max 50)
   * @param forceRecalculate Force recalculation even if recent score exists
   */
  async calculateBulkRisk(
    componentIds: string[],
    forceRecalculate: boolean = false
  ): Promise<BulkCalculationResult> {
    if (componentIds.length > 50) {
      throw new Error('Maximum 50 components per bulk calculation request');
    }

    const authHeaders = await getAuthHeaders();
    return this.fetchJson(`/api/risk/calculate/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        component_ids: componentIds,
        force_recalculate: forceRecalculate,
      }),
    });
  }

  /**
   * Get portfolio-level risk summary
   * @param forceRefresh Bypass cache and get fresh data
   */
  async getPortfolioRisk(forceRefresh: boolean = false): Promise<PortfolioRiskSummary> {
    const authHeaders = await getAuthHeaders();
    const url = forceRefresh
      ? `/api/risk/portfolio?force_refresh=true`
      : `/api/risk/portfolio`;

    return this.fetchJson(url, {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    });
  }

  /**
   * Get risk score history for a component
   */
  async getRiskHistory(componentId: string, limit: number = 30): Promise<RiskScoreHistory[]> {
    const authHeaders = await getAuthHeaders();
    return this.fetchJson(`/api/risk/history/${componentId}?limit=${limit}`, {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    });
  }

  /**
   * Get high-risk components
   */
  async getHighRiskComponents(minScore: number = 61, limit: number = 50): Promise<ComponentRiskScore[]> {
    const authHeaders = await getAuthHeaders();
    return this.fetchJson(`/api/risk/high-risk?min_score=${minScore}&limit=${limit}`, {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    });
  }

  /**
   * Get aggregate risk statistics
   */
  async getRiskStatistics(): Promise<RiskStatistics> {
    const authHeaders = await getAuthHeaders();
    return this.fetchJson(`/api/risk/stats`, {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    });
  }

  // =====================
  // Risk Profile Methods
  // =====================

  /**
   * Get organization's risk profile configuration
   * Transforms flat API response to nested structure expected by frontend
  */
  async getRiskProfile(): Promise<RiskProfile> {
    const authHeaders = await getAuthHeaders();
    const data = await this.fetchJson<any>(`/api/risk/profile`, {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    });

    // Transform flat API response to nested structure
    return {
      id: data.id || '',
      organization_id: data.organization_id || '',
      weights: {
        lifecycle: data.lifecycle_weight ?? 30,
        supply_chain: data.supply_chain_weight ?? 25,
        compliance: data.compliance_weight ?? 20,
        obsolescence: data.obsolescence_weight ?? 15,
        single_source: data.single_source_weight ?? 10,
      },
      thresholds: {
        low_max: data.low_threshold ?? 30,
        medium_max: data.medium_threshold ?? 60,
        high_max: data.high_threshold ?? 85,
      },
      bom_health_thresholds: {
        a_grade_max_high_pct: data.a_grade_max_high_pct ?? 5,
        b_grade_max_high_pct: data.b_grade_max_high_pct ?? 10,
        c_grade_max_high_pct: data.c_grade_max_high_pct ?? 20,
        d_grade_max_high_pct: data.d_grade_max_high_pct ?? 35,
      },
      custom_factors: data.custom_factors ? { factors: data.custom_factors } : null,
      enable_contextual_scoring: data.enable_contextual_scoring ?? true,
      quantity_impact_weight: data.quantity_weight ?? 0.15,
      lead_time_impact_weight: data.lead_time_weight ?? 0.10,
      criticality_impact_weight: data.criticality_weight ?? 0.20,
      created_at: data.created_at || new Date().toISOString(),
      updated_at: data.updated_at || new Date().toISOString(),
    };
  }

  /**
   * Update organization's risk profile configuration
   * Transforms nested frontend structure to flat API format
   */
  async updateRiskProfile(profile: Partial<{
    weights: Partial<RiskWeights>;
    thresholds: Partial<RiskThresholds>;
    bom_health_thresholds: Partial<BOMHealthThresholds>;
    custom_factors: CustomRiskFactors | null;
    enable_contextual_scoring: boolean;
    quantity_impact_weight: number;
    lead_time_impact_weight: number;
    criticality_impact_weight: number;
  }>): Promise<RiskProfile> {
    const authHeaders = await getAuthHeaders();

    // Transform nested structure to flat API format
    const flatProfile: Record<string, unknown> = {};

    if (profile.weights) {
      if (profile.weights.lifecycle !== undefined) flatProfile.lifecycle_weight = profile.weights.lifecycle;
      if (profile.weights.supply_chain !== undefined) flatProfile.supply_chain_weight = profile.weights.supply_chain;
      if (profile.weights.compliance !== undefined) flatProfile.compliance_weight = profile.weights.compliance;
      if (profile.weights.obsolescence !== undefined) flatProfile.obsolescence_weight = profile.weights.obsolescence;
      if (profile.weights.single_source !== undefined) flatProfile.single_source_weight = profile.weights.single_source;
    }

    if (profile.thresholds) {
      if (profile.thresholds.low_max !== undefined) flatProfile.low_threshold = profile.thresholds.low_max;
      if (profile.thresholds.medium_max !== undefined) flatProfile.medium_threshold = profile.thresholds.medium_max;
      if (profile.thresholds.high_max !== undefined) flatProfile.high_threshold = profile.thresholds.high_max;
    }

    if (profile.bom_health_thresholds) {
      if (profile.bom_health_thresholds.a_grade_max_high_pct !== undefined)
        flatProfile.a_grade_max_high_pct = profile.bom_health_thresholds.a_grade_max_high_pct;
      if (profile.bom_health_thresholds.b_grade_max_high_pct !== undefined)
        flatProfile.b_grade_max_high_pct = profile.bom_health_thresholds.b_grade_max_high_pct;
      if (profile.bom_health_thresholds.c_grade_max_high_pct !== undefined)
        flatProfile.c_grade_max_high_pct = profile.bom_health_thresholds.c_grade_max_high_pct;
      if (profile.bom_health_thresholds.d_grade_max_high_pct !== undefined)
        flatProfile.d_grade_max_high_pct = profile.bom_health_thresholds.d_grade_max_high_pct;
    }

    if (profile.enable_contextual_scoring !== undefined)
      flatProfile.enable_contextual_scoring = profile.enable_contextual_scoring;
    if (profile.quantity_impact_weight !== undefined)
      flatProfile.quantity_weight = profile.quantity_impact_weight;
    if (profile.lead_time_impact_weight !== undefined)
      flatProfile.lead_time_weight = profile.lead_time_impact_weight;
    if (profile.criticality_impact_weight !== undefined)
      flatProfile.criticality_weight = profile.criticality_impact_weight;

    await this.fetchWithFallback(
      `/api/risk/profile`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(flatProfile),
      }
    );

    // Use getRiskProfile to get properly transformed response
    return this.getRiskProfile();
  }

  /**
   * Reset risk profile to defaults
   */
  async resetRiskProfile(): Promise<RiskProfile> {
    const authHeaders = await getAuthHeaders();
    await this.fetchWithFallback(
      `/api/risk/profile/reset`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
      }
    );

    // Fetch the reset profile with proper transformation
    return this.getRiskProfile();
  }

  /**
   * Get available industry presets
   * Transforms flat API response to nested structure expected by frontend
   */
  async getRiskPresets(): Promise<RiskPreset[]> {
    const authHeaders = await getAuthHeaders();
    const data = await this.fetchJson<any[]>(`/api/risk/profile/presets`, {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    });
    console.log('[RiskService] getRiskPresets raw response:', data);

    // Transform flat API response to nested structure
    const result = (data || []).map((preset: Record<string, unknown>) => ({
      id: preset.id as string || '',
      name: preset.display_name as string || preset.name as string || '',
      description: preset.description as string || '',
      industry: preset.name as string || 'default',
      weights: {
        lifecycle: (preset.lifecycle_weight as number) ?? 30,
        supply_chain: (preset.supply_chain_weight as number) ?? 25,
        compliance: (preset.compliance_weight as number) ?? 20,
        obsolescence: (preset.obsolescence_weight as number) ?? 15,
        single_source: (preset.single_source_weight as number) ?? 10,
      },
      thresholds: {
        low_max: (preset.low_threshold as number) ?? 30,
        medium_max: (preset.medium_threshold as number) ?? 60,
        high_max: (preset.high_threshold as number) ?? 85,
      },
      bom_health_thresholds: {
        a_grade_max_high_pct: (preset.a_grade_max_high_pct as number) ?? 5,
        b_grade_max_high_pct: (preset.b_grade_max_high_pct as number) ?? 10,
        c_grade_max_high_pct: (preset.c_grade_max_high_pct as number) ?? 20,
        d_grade_max_high_pct: (preset.d_grade_max_high_pct as number) ?? 35,
      },
    }));

    console.log('[RiskService] getRiskPresets transformed result:', result);
    return result;
  }

  /**
   * Apply an industry preset to the organization's risk profile
   * @param presetName - The preset name (e.g., "automotive", "medical", "aerospace")
   */
  async applyRiskPreset(presetName: string): Promise<RiskProfile> {
    const authHeaders = await getAuthHeaders();
    await this.fetchWithFallback(
      `/api/risk/profile/apply-preset`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({ preset_name: presetName }),
      }
    );

    // Fetch the updated profile with proper transformation
    return this.getRiskProfile();
  }

  // =====================
  // BOM Risk Methods
  // =====================

  /**
   * Get all BOMs with risk summaries
   */
  async getBOMRiskSummaries(filters?: {
    project_id?: string;
    health_grade?: string;
    min_risk_score?: number;
  }): Promise<BOMRiskSummary[]> {
    const authHeaders = await getAuthHeaders();
    const params = new URLSearchParams();
    if (filters?.project_id) params.set('project_id', filters.project_id);
    if (filters?.health_grade) params.set('health_grade', filters.health_grade);
    if (filters?.min_risk_score) params.set('min_risk_score', filters.min_risk_score.toString());

    const url = `/api/risk/boms${params.toString() ? `?${params}` : ''}`;
    return this.fetchJson(url, {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    });
  }

  /**
   * Get risk summary for a specific BOM
   */
  async getBOMRiskDetail(bomId: string): Promise<BOMRiskSummary> {
    const authHeaders = await getAuthHeaders();
    return this.fetchJson(`/api/risk/boms/${bomId}`, {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    });
  }

  /**
   * Get line item risk scores for a BOM
   */
  async getBOMLineItemRisks(bomId: string, filters?: {
    risk_level?: string;
    criticality?: string;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }): Promise<BOMLineItemRisk[]> {
    const authHeaders = await getAuthHeaders();
    const params = new URLSearchParams();
    if (filters?.risk_level) params.set('risk_level', filters.risk_level);
    if (filters?.criticality) params.set('criticality', filters.criticality);
    if (filters?.sort_by) params.set('sort_by', filters.sort_by);
    if (filters?.sort_order) params.set('sort_order', filters.sort_order);

    const url = `/api/risk/boms/${bomId}/line-items${params.toString() ? `?${params}` : ''}`;
    return this.fetchJson(url, {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    });
  }

  /**
   * Update criticality for a line item
   */
  async updateLineItemCriticality(bomId: string, lineItemId: string, criticality: 'low' | 'medium' | 'high' | 'critical'): Promise<BOMLineItemRisk> {
    const authHeaders = await getAuthHeaders();
    return this.fetchJson(`/api/risk/boms/${bomId}/line-items/${lineItemId}/criticality`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({ criticality }),
    });
  }

  /**
   * Recalculate risk scores for a BOM
   */
  async recalculateBOMRisk(bomId: string): Promise<BOMRiskSummary> {
    const authHeaders = await getAuthHeaders();
    return this.fetchJson(`/api/risk/recalculate/bom/${bomId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    });
  }

  // =====================
  // Project Risk Methods
  // =====================

  /**
   * Get all projects with risk summaries
   */
  async getProjectRiskSummaries(): Promise<ProjectRiskSummary[]> {
    const authHeaders = await getAuthHeaders();
    return this.fetchJson(`/api/risk/projects`, {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    });
  }

  // =====================
  // Risk Analysis Workflow
  // =====================

  /**
   * Trigger BOM risk analysis workflow
   * @param bomId - Optional specific BOM ID. If not provided, analyzes all BOMs.
   * @param forceRecalculate - Recalculate even if scores exist
   */
  async runRiskAnalysis(bomId?: string, forceRecalculate: boolean = false): Promise<{
    status: string;
    workflow_id: string;
    organization_id: string;
    bom_id: string | null;
    message: string;
  }> {
    const authHeaders = await getAuthHeaders();
    return this.fetchJson(`/api/risk/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        bom_id: bomId || null,
        force_recalculate: forceRecalculate,
      }),
    });
  }

  /**
   * Get status of a risk analysis workflow
   */
  async getRiskAnalysisStatus(workflowId: string): Promise<{
    workflow_id: string;
    status: string;
    temporal_status: string;
    result: any;
  }> {
    const authHeaders = await getAuthHeaders();
    return this.fetchJson(`/api/risk/analyze/${workflowId}/status`, {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    });
  }

  /**
   * Create or update a mitigation assignment for a component
   */
  async createMitigationAssignment(payload: MitigationAssignmentRequest): Promise<{ id: string }> {
    const authHeaders = await getAuthHeaders();
    const body = {
      component_id: payload.component_id,
      assignee_name: payload.assignee_name,
      assignee_email: payload.assignee_email,
      due_date: payload.due_date,
      status: payload.status,
      priority: payload.priority,
      notes: payload.notes,
      tags: payload.tags,
    };

    return this.fetchJson(`/api/risk/mitigations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify(body),
    });
  }
}

// Export singleton instance
export const riskApi = new RiskApiService();

// Export class for testing
export { RiskApiService };
