/**
 * Risk & Grade Mapper
 *
 * Transforms raw risk scores and quality scores into normalized
 * display objects with colors, labels, and icons.
 *
 * @module mappers/riskGradeMapper
 */

import {
  getRiskLevel,
  getRiskColor,
  getGradeColor,
  getGradeFromScore,
  getQualityStatus,
  getQualityColor,
  getCompletenessLevel,
  getCompletenessColor,
  type RiskLevel,
  type Grade,
  type QualityStatus,
  type CompletenessLevel,
} from '../theme';

// ============================================================
// Types
// ============================================================

export interface RiskDisplay {
  level: RiskLevel;
  label: string;
  color: string;
  score: number;
  severity: 'info' | 'warning' | 'error';
}

export interface GradeDisplay {
  grade: Grade;
  label: string;
  color: string;
  score: number;
  isPass: boolean;
}

export interface QualityDisplay {
  status: QualityStatus;
  label: string;
  color: string;
  score: number;
  route: 'production' | 'staging' | 'review';
}

export interface CompletenessDisplay {
  level: CompletenessLevel;
  label: string;
  color: string;
  percentage: number;
  isComplete: boolean;
}

// ============================================================
// Risk Mapper
// ============================================================

const RISK_LABELS: Record<RiskLevel, string> = {
  low: 'Low Risk',
  medium: 'Medium Risk',
  high: 'High Risk',
  critical: 'Critical Risk',
};

const RISK_SEVERITY: Record<RiskLevel, 'info' | 'warning' | 'error'> = {
  low: 'info',
  medium: 'warning',
  high: 'error',
  critical: 'error',
};

/**
 * Map a risk score (0-100) to a display object
 */
export function mapRiskScore(score: number): RiskDisplay {
  const level = getRiskLevel(score);
  return {
    level,
    label: RISK_LABELS[level],
    color: getRiskColor(score),
    score,
    severity: RISK_SEVERITY[level],
  };
}

/**
 * Map multiple risk metrics into a summary
 */
export interface RiskMetricsSummary {
  overall: RiskDisplay;
  supplyChain: RiskDisplay;
  obsolescence: RiskDisplay;
  compliance: RiskDisplay;
  highestRisk: RiskLevel;
}

export function mapRiskMetrics(metrics: {
  supply_chain_risk?: number;
  obsolescence_risk?: number;
  compliance_risk?: number;
  overall_risk?: number;
}): RiskMetricsSummary {
  const supplyChain = mapRiskScore(metrics.supply_chain_risk ?? 0);
  const obsolescence = mapRiskScore(metrics.obsolescence_risk ?? 0);
  const compliance = mapRiskScore(metrics.compliance_risk ?? 0);
  const overall = mapRiskScore(
    metrics.overall_risk ??
      Math.max(
        metrics.supply_chain_risk ?? 0,
        metrics.obsolescence_risk ?? 0,
        metrics.compliance_risk ?? 0
      )
  );

  // Find highest risk level
  const levels: RiskLevel[] = [supplyChain.level, obsolescence.level, compliance.level];
  const riskOrder: RiskLevel[] = ['low', 'medium', 'high', 'critical'];
  const highestRisk = levels.reduce((highest, current) =>
    riskOrder.indexOf(current) > riskOrder.indexOf(highest) ? current : highest
  );

  return {
    overall,
    supplyChain,
    obsolescence,
    compliance,
    highestRisk,
  };
}

// ============================================================
// Grade Mapper
// ============================================================

const GRADE_LABELS: Record<Grade, string> = {
  A: 'Excellent',
  B: 'Good',
  C: 'Fair',
  D: 'Poor',
  F: 'Fail',
};

/**
 * Map a quality score (0-100) to a letter grade display
 */
export function mapGrade(score: number): GradeDisplay {
  const grade = getGradeFromScore(score);
  return {
    grade,
    label: GRADE_LABELS[grade],
    color: getGradeColor(grade),
    score,
    isPass: score >= 60,
  };
}

/**
 * Map a letter grade string to a display object
 */
export function mapGradeFromLetter(gradeLetter: string, score?: number): GradeDisplay {
  const grade = gradeLetter.toUpperCase() as Grade;
  const validGrades: Grade[] = ['A', 'B', 'C', 'D', 'F'];
  const normalizedGrade = validGrades.includes(grade) ? grade : 'F';

  // Estimate score from grade if not provided
  const estimatedScore = score ?? {
    A: 95,
    B: 85,
    C: 75,
    D: 65,
    F: 50,
  }[normalizedGrade];

  return {
    grade: normalizedGrade,
    label: GRADE_LABELS[normalizedGrade],
    color: getGradeColor(normalizedGrade),
    score: estimatedScore,
    isPass: estimatedScore >= 60,
  };
}

// ============================================================
// Quality Score Mapper
// ============================================================

const QUALITY_LABELS: Record<QualityStatus, string> = {
  production: 'Production Ready',
  staging: 'Needs Review',
  rejected: 'Rejected',
  failed: 'Failed',
};

const QUALITY_ROUTE: Record<QualityStatus, 'production' | 'staging' | 'review'> = {
  production: 'production',
  staging: 'staging',
  rejected: 'review',
  failed: 'review',
};

/**
 * Map a quality score (0-100) to a routing display
 */
export function mapQualityScore(score: number): QualityDisplay {
  const status = getQualityStatus(score);
  return {
    status,
    label: QUALITY_LABELS[status],
    color: getQualityColor(score),
    score,
    route: QUALITY_ROUTE[status],
  };
}

// ============================================================
// Completeness Mapper
// ============================================================

const COMPLETENESS_LABELS: Record<CompletenessLevel, string> = {
  excellent: 'Excellent (90%+)',
  good: 'Good (70-89%)',
  fair: 'Fair (50-69%)',
  poor: 'Poor (30-49%)',
  minimal: 'Minimal (<30%)',
};

/**
 * Map a completeness percentage to a display object
 */
export function mapCompleteness(percentage: number): CompletenessDisplay {
  const level = getCompletenessLevel(percentage);
  return {
    level,
    label: COMPLETENESS_LABELS[level],
    color: getCompletenessColor(percentage),
    percentage,
    isComplete: percentage >= 70,
  };
}

// ============================================================
// Batch Mappers
// ============================================================

/**
 * Map an array of items with quality scores to display objects
 */
export function mapQualityScores<T extends { quality_score?: number }>(
  items: T[]
): Array<T & { qualityDisplay: QualityDisplay }> {
  return items.map((item) => ({
    ...item,
    qualityDisplay: mapQualityScore(item.quality_score ?? 0),
  }));
}

/**
 * Map an array of items with grades to display objects
 */
export function mapGrades<T extends { grade?: string; quality_score?: number }>(
  items: T[]
): Array<T & { gradeDisplay: GradeDisplay }> {
  return items.map((item) => ({
    ...item,
    gradeDisplay: item.grade
      ? mapGradeFromLetter(item.grade, item.quality_score)
      : mapGrade(item.quality_score ?? 0),
  }));
}
