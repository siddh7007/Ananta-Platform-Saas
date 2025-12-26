/**
 * Risk Analysis types for BOM risk assessment
 * Aligned with CNS service API contracts
 */

import type { LifecycleRisk, RiskLevel, BomLineItem } from './bom';

// Re-export types for convenience
export type { RiskLevel, LifecycleRisk };

/**
 * Overall BOM risk analysis summary
 */
export interface BomRiskAnalysis {
  bomId: string;
  bomName: string;
  analyzedAt: string;

  // Overall risk score (0-100, higher = more risk)
  overallRiskScore: number;
  overallRiskLevel: RiskLevel;

  // Summary counts
  summary: RiskSummary;

  // Breakdown by category
  lifecycleRisks: LifecycleRiskBreakdown;
  supplyChainRisks: SupplyChainRiskBreakdown;
  pricingRisks: PricingRiskBreakdown;

  // High-risk items requiring attention
  criticalItems: RiskItem[];

  // Recommendations
  recommendations: RiskRecommendation[];
}

/**
 * Risk summary counts
 */
export interface RiskSummary {
  totalLines: number;
  analyzedLines: number;

  // Risk level counts
  greenCount: number;
  yellowCount: number;
  orangeCount: number;
  redCount: number;

  // Specific risk counts
  obsoleteCount: number;
  eolCount: number;        // End of Life
  nrndCount: number;       // Not Recommended for New Designs
  activeCount: number;
  unknownLifecycleCount: number;

  // Supply chain
  singleSourceCount: number;
  noStockCount: number;
  longLeadTimeCount: number;  // > 12 weeks

  // Coverage
  lifecycleCoverage: number;  // % of lines with lifecycle data
  pricingCoverage: number;    // % of lines with pricing data
}

/**
 * Lifecycle risk breakdown
 */
export interface LifecycleRiskBreakdown {
  obsolete: RiskLineItemGroup;
  endOfLife: RiskLineItemGroup;
  nrnd: RiskLineItemGroup;
  active: RiskLineItemGroup;
  unknown: RiskLineItemGroup;
}

/**
 * Supply chain risk breakdown
 */
export interface SupplyChainRiskBreakdown {
  singleSource: RiskLineItemGroup;
  limitedStock: RiskLineItemGroup;  // < 100 units across all suppliers
  noStock: RiskLineItemGroup;
  longLeadTime: RiskLineItemGroup;  // > 12 weeks
}

/**
 * Pricing risk breakdown
 */
export interface PricingRiskBreakdown {
  noPricing: RiskLineItemGroup;
  priceIncrease: RiskLineItemGroup;    // > 20% vs historical
  highVariance: RiskLineItemGroup;      // > 30% variance across suppliers
}

/**
 * Group of line items with a specific risk
 */
export interface RiskLineItemGroup {
  count: number;
  percentage: number;
  totalQuantity: number;
  items: RiskItem[];
}

/**
 * Individual risk item (line item with risk details)
 */
export interface RiskItem {
  lineItemId: string;
  lineNumber: number;
  mpn: string;
  manufacturer: string;
  description?: string;
  quantity: number;

  // Risk assessment
  riskLevel: RiskLevel;
  riskScore: number;  // 0-100
  riskFactors: RiskFactor[];

  // Lifecycle info
  lifecycleStatus?: LifecycleStatus;
  lifecycleRisk?: LifecycleRisk;
  lastLifecycleUpdate?: string;
  estimatedEolDate?: string;

  // Supply chain info
  supplierCount: number;
  totalStock: number;
  averageLeadTime?: number;  // in weeks
  isSingleSource: boolean;

  // Pricing info
  lowestPrice?: number;
  highestPrice?: number;
  averagePrice?: number;
  currency: string;

  // Alternates available
  alternatesCount: number;
  hasDropInReplacement: boolean;
}

/**
 * Individual risk factor
 */
export interface RiskFactor {
  type: RiskFactorType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact?: string;
}

/**
 * Risk factor types
 */
export type RiskFactorType =
  | 'obsolete'
  | 'end_of_life'
  | 'nrnd'
  | 'single_source'
  | 'no_stock'
  | 'limited_stock'
  | 'long_lead_time'
  | 'no_pricing'
  | 'price_volatility'
  | 'no_alternates'
  | 'high_quantity_at_risk';

/**
 * Component lifecycle status
 */
export type LifecycleStatus =
  | 'active'
  | 'nrnd'           // Not Recommended for New Designs
  | 'eol'            // End of Life announced
  | 'obsolete'       // No longer manufactured
  | 'unknown';

/**
 * Risk recommendation
 */
export interface RiskRecommendation {
  id: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'lifecycle' | 'supply_chain' | 'pricing' | 'general';
  title: string;
  description: string;
  affectedItems: number;
  suggestedAction?: string;
  alternatesMpn?: string[];
}

/**
 * Risk filter options for UI
 */
export interface RiskFilterOptions {
  riskLevels: RiskLevel[];
  lifecycleStatuses: LifecycleStatus[];
  showOnlySingleSource: boolean;
  showOnlyNoStock: boolean;
  showOnlyLongLeadTime: boolean;
  minRiskScore?: number;
}

/**
 * Risk sort options
 */
export type RiskSortField =
  | 'riskScore'
  | 'lineNumber'
  | 'quantity'
  | 'supplierCount'
  | 'leadTime'
  | 'price';

export type RiskSortOrder = 'asc' | 'desc';

/**
 * Risk level display helpers
 */
export const RISK_LEVEL_CONFIG: Record<RiskLevel, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
}> = {
  GREEN: {
    label: 'Low Risk',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    description: 'Component is active with good availability',
  },
  YELLOW: {
    label: 'Medium Risk',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    description: 'Some concerns - monitor for changes',
  },
  ORANGE: {
    label: 'High Risk',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    description: 'Significant risk - action recommended',
  },
  RED: {
    label: 'Critical Risk',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    description: 'Immediate action required',
  },
};

/**
 * Lifecycle status display helpers
 */
export const LIFECYCLE_STATUS_CONFIG: Record<LifecycleStatus, {
  label: string;
  color: string;
  bgColor: string;
  icon: string;
}> = {
  active: {
    label: 'Active',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    icon: 'check-circle',
  },
  nrnd: {
    label: 'NRND',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
    icon: 'alert-triangle',
  },
  eol: {
    label: 'End of Life',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
    icon: 'clock',
  },
  obsolete: {
    label: 'Obsolete',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    icon: 'x-circle',
  },
  unknown: {
    label: 'Unknown',
    color: 'text-gray-500',
    bgColor: 'bg-gray-100',
    icon: 'help-circle',
  },
};

/**
 * Calculate overall risk score from risk factors
 */
export function calculateRiskScore(factors: RiskFactor[]): number {
  if (factors.length === 0) return 0;

  const severityWeights: Record<string, number> = {
    low: 10,
    medium: 30,
    high: 60,
    critical: 100,
  };

  const maxScore = factors.reduce((sum, factor) => {
    return sum + (severityWeights[factor.severity] || 0);
  }, 0);

  // Normalize to 0-100, capped at 100
  return Math.min(100, Math.round(maxScore / factors.length));
}

/**
 * Get risk level from score
 */
export function getRiskLevelFromScore(score: number): RiskLevel {
  if (score >= 75) return 'RED';
  if (score >= 50) return 'ORANGE';
  if (score >= 25) return 'YELLOW';
  return 'GREEN';
}

/**
 * Map BomLineItem to RiskItem for display
 */
export function mapLineItemToRiskItem(lineItem: BomLineItem): Partial<RiskItem> {
  const riskFactors: RiskFactor[] = [];

  // Check lifecycle risks
  if (lineItem.obsolete) {
    riskFactors.push({
      type: 'obsolete',
      severity: 'critical',
      description: 'Component is obsolete',
      impact: 'No longer manufactured - find alternative',
    });
  }

  if (lineItem.singleSource) {
    riskFactors.push({
      type: 'single_source',
      severity: 'high',
      description: 'Only one supplier available',
      impact: 'Supply disruption risk',
    });
  }

  // Check pricing availability
  if (!lineItem.pricing || lineItem.pricing.length === 0) {
    riskFactors.push({
      type: 'no_pricing',
      severity: 'medium',
      description: 'No pricing data available',
    });
  }

  // Check stock
  const totalStock = lineItem.pricing?.reduce((sum, p) => sum + p.stock, 0) ?? 0;
  if (totalStock === 0 && lineItem.pricing && lineItem.pricing.length > 0) {
    riskFactors.push({
      type: 'no_stock',
      severity: 'high',
      description: 'No stock available across suppliers',
    });
  } else if (totalStock < lineItem.quantity) {
    riskFactors.push({
      type: 'limited_stock',
      severity: 'medium',
      description: `Insufficient stock (${totalStock} available, ${lineItem.quantity} needed)`,
    });
  }

  // Check alternates
  if (!lineItem.alternates || lineItem.alternates.length === 0) {
    if (riskFactors.some(f => f.severity === 'critical' || f.severity === 'high')) {
      riskFactors.push({
        type: 'no_alternates',
        severity: 'medium',
        description: 'No alternate components identified',
      });
    }
  }

  const riskScore = calculateRiskScore(riskFactors);

  return {
    lineItemId: lineItem.id,
    lineNumber: lineItem.lineNumber,
    mpn: lineItem.mpn,
    manufacturer: lineItem.manufacturer || 'Unknown',
    description: lineItem.description,
    quantity: lineItem.quantity,
    riskLevel: lineItem.riskLevel || getRiskLevelFromScore(riskScore),
    riskScore,
    riskFactors,
    supplierCount: lineItem.pricing?.length ?? 0,
    totalStock,
    isSingleSource: lineItem.singleSource ?? false,
    alternatesCount: lineItem.alternates?.length ?? 0,
    hasDropInReplacement: lineItem.alternates?.some(a => a.matchType === 'exact') ?? false,
    currency: lineItem.pricing?.[0]?.currency ?? 'USD',
    lowestPrice: lineItem.pricing?.length
      ? Math.min(...lineItem.pricing.map(p => p.unitPrice))
      : undefined,
    highestPrice: lineItem.pricing?.length
      ? Math.max(...lineItem.pricing.map(p => p.unitPrice))
      : undefined,
  };
}
