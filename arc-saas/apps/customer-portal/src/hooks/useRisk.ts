/**
 * Risk Analysis Hooks
 * TanStack Query hooks for risk analysis operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getPortfolioRisk,
  getRiskStatistics,
  getHighRiskComponents,
  getComponentRisk,
  getRiskHistory,
  getBomsWithRisk,
  getBomRiskDetail,
  recalculateBomRisk,
  getRiskProfile,
  updateRiskProfile,
  getRiskPresets,
  applyRiskPreset,
  type PortfolioRiskSummary,
  type RiskStatistics,
  type ComponentRiskScore,
  type BomRiskSummaryResponse,
  type RiskProfile,
  type RiskPreset,
} from '@/services/risk.service';
import { useToast } from '@/hooks/useToast';

// =============================================================================
// Query Keys
// =============================================================================

export const riskKeys = {
  all: ['risk'] as const,
  portfolio: () => [...riskKeys.all, 'portfolio'] as const,
  statistics: () => [...riskKeys.all, 'statistics'] as const,
  highRisk: (params?: { minScore?: number; limit?: number }) =>
    [...riskKeys.all, 'high-risk', params] as const,
  component: (componentId: string) => [...riskKeys.all, 'component', componentId] as const,
  history: (componentId: string, limit?: number) =>
    [...riskKeys.all, 'history', componentId, limit] as const,
  boms: (params?: { projectId?: string; healthGrade?: string }) =>
    [...riskKeys.all, 'boms', params] as const,
  bomDetail: (bomId: string) => [...riskKeys.all, 'bom-detail', bomId] as const,
  profile: () => [...riskKeys.all, 'profile'] as const,
  presets: () => [...riskKeys.all, 'presets'] as const,
};

// =============================================================================
// Portfolio & Statistics Hooks
// =============================================================================

/**
 * Hook to fetch portfolio-level risk summary
 */
export function useRiskPortfolio(forceRefresh = false) {
  return useQuery<PortfolioRiskSummary>({
    queryKey: [...riskKeys.portfolio(), forceRefresh],
    queryFn: () => getPortfolioRisk(forceRefresh),
    staleTime: forceRefresh ? 0 : 5 * 60 * 1000, // 5 minutes if not forcing refresh
    retry: 2,
  });
}

/**
 * Hook to fetch risk statistics for the organization
 */
export function useRiskStatistics() {
  return useQuery<RiskStatistics>({
    queryKey: riskKeys.statistics(),
    queryFn: getRiskStatistics,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
}

/**
 * Hook to fetch high-risk components
 */
export function useHighRiskComponents(params?: { minScore?: number; limit?: number }) {
  return useQuery<ComponentRiskScore[]>({
    queryKey: riskKeys.highRisk(params),
    queryFn: () => getHighRiskComponents(params),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}

// =============================================================================
// Component Risk Hooks
// =============================================================================

/**
 * Hook to fetch risk score for a single component
 */
export function useComponentRisk(componentId: string, bypassCache = false) {
  return useQuery<ComponentRiskScore>({
    queryKey: [...riskKeys.component(componentId), bypassCache],
    queryFn: () => getComponentRisk(componentId, bypassCache),
    enabled: !!componentId,
    staleTime: bypassCache ? 0 : 10 * 60 * 1000, // 10 minutes
    retry: 2,
  });
}

/**
 * Hook to fetch risk history for a component
 */
export function useRiskHistory(componentId: string, limit = 30) {
  return useQuery({
    queryKey: riskKeys.history(componentId, limit),
    queryFn: () => getRiskHistory(componentId, limit),
    enabled: !!componentId,
    staleTime: 10 * 60 * 1000,
    retry: 2,
  });
}

// =============================================================================
// BOM Risk Hooks
// =============================================================================

/**
 * Hook to fetch all BOMs with their risk summaries
 */
export function useBomsWithRisk(params?: {
  projectId?: string;
  healthGrade?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery<BomRiskSummaryResponse[]>({
    queryKey: riskKeys.boms(params),
    queryFn: () => getBomsWithRisk(params),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}

/**
 * Hook to fetch detailed risk summary for a single BOM
 */
export function useBomRiskDetail(bomId: string) {
  return useQuery<BomRiskSummaryResponse>({
    queryKey: riskKeys.bomDetail(bomId),
    queryFn: () => getBomRiskDetail(bomId),
    enabled: !!bomId,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}

/**
 * Hook to recalculate BOM risk scores
 */
export function useRecalculateBomRisk() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (bomId: string) => recalculateBomRisk(bomId),
    onSuccess: (data, bomId) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: riskKeys.bomDetail(bomId) });
      queryClient.invalidateQueries({ queryKey: riskKeys.boms() });
      queryClient.invalidateQueries({ queryKey: riskKeys.portfolio() });
      queryClient.invalidateQueries({ queryKey: riskKeys.statistics() });

      toast({
        title: 'Risk Recalculated',
        description: `BOM risk analysis updated. Health grade: ${data.health_grade}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Recalculation Failed',
        description: error.message || 'Failed to recalculate BOM risk scores',
        variant: 'destructive',
      });
    },
  });
}

// =============================================================================
// Risk Profile Hooks
// =============================================================================

/**
 * Hook to fetch organization's risk profile
 */
export function useRiskProfile() {
  return useQuery<RiskProfile>({
    queryKey: riskKeys.profile(),
    queryFn: getRiskProfile,
    staleTime: 10 * 60 * 1000,
    retry: 2,
  });
}

/**
 * Hook to update risk profile
 */
export function useUpdateRiskProfile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (updates: Partial<Omit<RiskProfile, 'id' | 'organization_id'>>) =>
      updateRiskProfile(updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: riskKeys.profile() });
      queryClient.invalidateQueries({ queryKey: riskKeys.portfolio() });

      toast({
        title: 'Risk Profile Updated',
        description: `Risk calculation weights updated to ${data.preset_name} preset`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update risk profile',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to fetch available risk presets
 */
export function useRiskPresets() {
  return useQuery<RiskPreset[]>({
    queryKey: riskKeys.presets(),
    queryFn: getRiskPresets,
    staleTime: 30 * 60 * 1000, // 30 minutes - presets rarely change
    retry: 2,
  });
}

/**
 * Hook to apply a risk preset
 */
export function useApplyRiskPreset() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (presetName: string) => applyRiskPreset(presetName),
    onSuccess: (data, presetName) => {
      queryClient.invalidateQueries({ queryKey: riskKeys.profile() });
      queryClient.invalidateQueries({ queryKey: riskKeys.portfolio() });

      toast({
        title: 'Preset Applied',
        description: `Risk profile updated to ${presetName} industry preset`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Preset Application Failed',
        description: error.message || 'Failed to apply risk preset',
        variant: 'destructive',
      });
    },
  });
}

// =============================================================================
// Computed/Derived Hooks
// =============================================================================

/**
 * Combined hook that provides comprehensive risk dashboard data
 */
export function useRiskDashboard() {
  const portfolio = useRiskPortfolio();
  const statistics = useRiskStatistics();
  const highRisk = useHighRiskComponents({ minScore: 61, limit: 10 });

  return {
    portfolio,
    statistics,
    highRisk,
    isLoading: portfolio.isLoading || statistics.isLoading,
    isError: portfolio.isError || statistics.isError,
    error: portfolio.error || statistics.error,
  };
}

/**
 * Hook to get risk trend data (comparing current vs historical)
 */
export function useRiskTrend(componentId?: string) {
  const history = useRiskHistory(componentId || '', 30);

  if (!componentId || !history.data) {
    return {
      trend: 'stable' as const,
      change: 0,
      data: [],
    };
  }

  const data = history.data;
  if (data.length < 2) {
    return {
      trend: 'stable' as const,
      change: 0,
      data,
    };
  }

  // Calculate trend based on first vs last score
  const firstScore = data[0].total_risk_score;
  const lastScore = data[data.length - 1].total_risk_score;
  const change = lastScore - firstScore;

  let trend: 'improving' | 'stable' | 'worsening' = 'stable';
  if (change < -5) trend = 'improving'; // Score decreased = risk improved
  if (change > 5) trend = 'worsening'; // Score increased = risk worsened

  return {
    trend,
    change,
    data,
  };
}

export default {
  useRiskPortfolio,
  useRiskStatistics,
  useHighRiskComponents,
  useComponentRisk,
  useRiskHistory,
  useBomsWithRisk,
  useBomRiskDetail,
  useRecalculateBomRisk,
  useRiskProfile,
  useUpdateRiskProfile,
  useRiskPresets,
  useApplyRiskPreset,
  useRiskDashboard,
  useRiskTrend,
};
