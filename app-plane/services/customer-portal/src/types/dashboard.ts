/**
 * Portfolio Dashboard Data Types
 * @module types/dashboard
 */

export interface PortfolioMetrics {
  totalBoms: number;
  bomsTrend: TrendData;
  atRiskBoms: number;
  atRiskTrend: TrendData;
  avgEnrichmentScore: number;
  costMtd: number;
  costBudget: number;
  riskDistribution: RiskDistribution;
  enrichmentActivity: DailyActivity[];
  criticalAlerts: Alert[];
  recentActivity: ActivityItem[];
}

export interface TrendData {
  value: number;
  direction: 'up' | 'down' | 'flat';
  period: string;
}

export interface RiskDistribution {
  low: number;
  medium: number;
  high: number;
  critical: number;
}

export interface DailyActivity {
  date: string;
  count: number;
  cost: number;
}

export type AlertType = 'obsolete' | 'quota' | 'inactive_user' | 'enrichment_failed';
export type AlertSeverity = 'warning' | 'error';

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  actionUrl?: string;
  createdAt: Date;
}

export type ActivityAction = 'upload' | 'compare' | 'enrich' | 'approve' | 'export';

export interface ActivityItem {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  action: ActivityAction;
  target: string;
  timestamp: Date;
}

export interface DashboardFilters {
  dateRange?: {
    start: Date;
    end: Date;
  };
  selectedRisks?: ('low' | 'medium' | 'high' | 'critical')[];
}

export type ExportFormat = 'pdf' | 'csv';

export interface ExportOptions {
  format: ExportFormat;
  includeCharts: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
}
