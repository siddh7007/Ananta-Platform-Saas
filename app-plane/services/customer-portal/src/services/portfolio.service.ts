/**
 * Portfolio Dashboard Service
 * @module services/portfolio
 *
 * Provides API integration for portfolio metrics, alerts, and activity.
 * Aggregates data from multiple sources (CNS, Platform, Supabase).
 */

import { cnsApi, platformApi, apiRequest } from '../lib/axios';
import {
  PortfolioMetrics,
  TrendData,
  RiskDistribution,
  DailyActivity,
  Alert,
  ActivityItem,
  ActivityAction,
  AlertType,
} from '../types/dashboard';
import {
  generateMockPortfolioMetrics,
  generateMockAlerts,
  generateMockActivity,
  generateMockDailyActivity,
  simulateApiDelay,
} from '../mocks/portfolio.mock';

// Feature flag for mock data (set to false when backend is ready)
const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_PORTFOLIO === 'true';

// Allow mock fallback on errors in development only
const ALLOW_MOCK_FALLBACK = import.meta.env.DEV && import.meta.env.VITE_ALLOW_MOCK_FALLBACK !== 'false';

// Track if we're using mock data so UI can show indicator
export let isUsingMockData = USE_MOCK_DATA;

export interface PortfolioServiceOptions {
  tenantId: string;
  startDate?: Date;
  endDate?: Date;
}

interface BomData {
  id: string;
  name: string;
  status: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  enrichmentScore?: number;
  obsoletePercentage?: number;
  createdAt: string;
  updatedAt: string;
}

interface UserData {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  lastLogin: string;
  role: string;
}

interface SubscriptionData {
  id: string;
  plan: string;
  status: string;
  quotaUsed: number;
  quotaLimit: number;
  usageMtd: number;
  monthlyBudget: number;
}

interface EnrichmentEvent {
  id: string;
  bomId: string;
  userId: string;
  action: string;
  status: string;
  cost: number;
  createdAt: string;
}

/**
 * Calculate trend direction and percentage change
 */
function calculateTrend(current: number, previous: number, period: string = 'week'): TrendData {
  const change = current - previous;
  const percentChange = previous > 0 ? Math.abs((change / previous) * 100) : 0;

  let direction: 'up' | 'down' | 'flat';
  if (Math.abs(change) < 2) {
    direction = 'flat';
  } else {
    direction = change > 0 ? 'up' : 'down';
  }

  return {
    value: Math.round(percentChange),
    direction,
    period,
  };
}

/**
 * Calculate average enrichment score from BOMs
 */
function calculateAvgScore(boms: BomData[]): number {
  if (boms.length === 0) return 0;

  const total = boms.reduce((sum, bom) => sum + (bom.enrichmentScore || 0), 0);
  return Math.round((total / boms.length) * 10) / 10;
}

/**
 * Group enrichment events by date
 */
function formatEnrichmentActivity(events: EnrichmentEvent[], days: number = 7): DailyActivity[] {
  const activityMap = new Map<string, { count: number; cost: number }>();
  const today = new Date();

  // Initialize all dates with zero values
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateKey = date.toISOString().split('T')[0];
    activityMap.set(dateKey, { count: 0, cost: 0 });
  }

  // Aggregate events by date
  events.forEach(event => {
    const dateKey = event.createdAt.split('T')[0];
    const existing = activityMap.get(dateKey);
    if (existing) {
      existing.count++;
      existing.cost += event.cost || 0;
    }
  });

  // Convert to array and sort by date
  return Array.from(activityMap.entries())
    .map(([date, data]) => ({
      date,
      count: data.count,
      cost: Math.round(data.cost * 100) / 100,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Format enrichment events as recent activity
 */
function formatRecentActivity(events: EnrichmentEvent[], users: UserData[], limit: number = 10): ActivityItem[] {
  const userMap = new Map(users.map(u => [u.id, u]));

  return events
    .slice(0, limit)
    .map(event => {
      const user = userMap.get(event.userId);
      const action = mapEventAction(event.action);

      return {
        id: event.id,
        userId: event.userId,
        userName: user?.name || 'Unknown User',
        userAvatar: user?.avatar,
        action,
        target: event.bomId,
        timestamp: new Date(event.createdAt),
      };
    });
}

/**
 * Map event action to activity action type
 */
function mapEventAction(action: string): ActivityAction {
  const actionMap: Record<string, ActivityAction> = {
    upload: 'upload',
    create: 'upload',
    compare: 'compare',
    enrich: 'enrich',
    approve: 'approve',
    export: 'export',
  };

  return actionMap[action.toLowerCase()] || 'enrich';
}

/**
 * Generate alerts from aggregated data
 */
function generateAlerts(boms: BomData[], users: UserData[], subscription: SubscriptionData): Alert[] {
  const alerts: Alert[] = [];

  // Obsolete components alert
  const obsoleteBoms = boms.filter(b => (b.obsoletePercentage || 0) > 10);
  if (obsoleteBoms.length > 0) {
    alerts.push({
      id: crypto.randomUUID(),
      type: 'obsolete',
      severity: obsoleteBoms.length > 5 ? 'error' : 'warning',
      message: `${obsoleteBoms.length} BOMs have >10% obsolete components`,
      actionUrl: '/boms?filter=obsolete',
      createdAt: new Date(),
    });
  }

  // Quota alert
  if (subscription.quotaLimit > 0) {
    const quotaUsed = subscription.quotaUsed / subscription.quotaLimit;
    if (quotaUsed > 0.85) {
      alerts.push({
        id: crypto.randomUUID(),
        type: 'quota',
        severity: quotaUsed > 0.95 ? 'error' : 'warning',
        message: `Enrichment quota at ${Math.round(quotaUsed * 100)}%`,
        actionUrl: '/settings/billing',
        createdAt: new Date(),
      });
    }
  }

  // Inactive users alert
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const inactiveUsers = users.filter(u => new Date(u.lastLogin) < twoWeeksAgo);
  if (inactiveUsers.length > 0) {
    alerts.push({
      id: crypto.randomUUID(),
      type: 'inactive_user',
      severity: 'warning',
      message: `${inactiveUsers.length} team members haven't logged in for 14+ days`,
      actionUrl: '/settings/team',
      createdAt: new Date(),
    });
  }

  // Failed enrichment alert
  const failedBoms = boms.filter(b => b.status === 'failed');
  if (failedBoms.length > 0) {
    alerts.push({
      id: crypto.randomUUID(),
      type: 'enrichment_failed',
      severity: 'error',
      message: `${failedBoms.length} BOMs failed to enrich`,
      actionUrl: '/boms?status=failed',
      createdAt: new Date(),
    });
  }

  return alerts;
}

/**
 * Get portfolio metrics (aggregated from multiple sources)
 */
export async function getPortfolioMetrics(options: PortfolioServiceOptions): Promise<PortfolioMetrics> {
  const { tenantId, startDate, endDate } = options;

  // Use mock data if enabled
  if (USE_MOCK_DATA) {
    await simulateApiDelay();
    return generateMockPortfolioMetrics(tenantId);
  }

  try {
    // Fetch data from multiple sources in parallel
    const [bomsResponse, usersResponse, subscriptionResponse, enrichmentEventsResponse] = await Promise.all([
      cnsApi.get<BomData[]>('/api/cns/boms', {
        params: { organization_id: tenantId },
      }),
      platformApi.get<UserData[]>('/api/users', {
        params: { tenantId },
      }),
      platformApi.get<SubscriptionData>('/api/subscriptions/current', {
        params: { tenantId },
      }),
      cnsApi.get<EnrichmentEvent[]>('/api/cns/enrichment-events', {
        params: {
          organization_id: tenantId,
          start_date: startDate?.toISOString(),
          end_date: endDate?.toISOString(),
          limit: 100,
        },
      }),
    ]);

    const boms = bomsResponse.data;
    const users = usersResponse.data;
    const subscription = subscriptionResponse.data;
    const enrichmentEvents = enrichmentEventsResponse.data;

    // Calculate aggregated metrics
    const totalBoms = boms.length;
    const atRiskBoms = boms.filter(b => ['high', 'critical'].includes(b.riskLevel)).length;

    // Calculate trends (compare with 7 days ago)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentBoms = boms.filter(b => new Date(b.createdAt) > weekAgo);
    const previousTotalBoms = totalBoms - recentBoms.length;
    const previousAtRiskBoms = atRiskBoms - recentBoms.filter(b => ['high', 'critical'].includes(b.riskLevel)).length;

    // Risk distribution
    const riskDistribution: RiskDistribution = boms.reduce(
      (acc, bom) => {
        acc[bom.riskLevel] = (acc[bom.riskLevel] || 0) + 1;
        return acc;
      },
      { low: 0, medium: 0, high: 0, critical: 0 } as RiskDistribution
    );

    return {
      totalBoms,
      bomsTrend: calculateTrend(totalBoms, previousTotalBoms, 'week'),
      atRiskBoms,
      atRiskTrend: calculateTrend(atRiskBoms, previousAtRiskBoms, 'week'),
      avgEnrichmentScore: calculateAvgScore(boms),
      costMtd: subscription.usageMtd || 0,
      costBudget: subscription.monthlyBudget || 0,
      riskDistribution,
      enrichmentActivity: formatEnrichmentActivity(enrichmentEvents, 7),
      criticalAlerts: generateAlerts(boms, users, subscription),
      recentActivity: formatRecentActivity(enrichmentEvents, users, 8),
    };
  } catch (error) {
    console.error('[Portfolio Service] Error fetching metrics:', error);

    // In development, allow falling back to mock data
    if (ALLOW_MOCK_FALLBACK) {
      console.warn('[Portfolio Service] Falling back to mock data (DEV mode only)');
      isUsingMockData = true;
      return generateMockPortfolioMetrics(tenantId);
    }

    // In production, throw the error so the UI can handle it properly
    throw error instanceof Error
      ? error
      : new Error('Failed to fetch portfolio metrics');
  }
}

/**
 * Get portfolio alerts (critical issues requiring attention)
 */
export async function getPortfolioAlerts(tenantId: string): Promise<Alert[]> {
  if (USE_MOCK_DATA) {
    await simulateApiDelay(100, 300);
    return generateMockAlerts(3);
  }

  try {
    // Fetch latest data
    const [bomsResponse, usersResponse, subscriptionResponse] = await Promise.all([
      cnsApi.get<BomData[]>('/api/cns/boms', {
        params: { organization_id: tenantId },
      }),
      platformApi.get<UserData[]>('/api/users', {
        params: { tenantId },
      }),
      platformApi.get<SubscriptionData>('/api/subscriptions/current', {
        params: { tenantId },
      }),
    ]);

    return generateAlerts(
      bomsResponse.data,
      usersResponse.data,
      subscriptionResponse.data
    );
  } catch (error) {
    console.error('[Portfolio Service] Error fetching alerts:', error);

    if (ALLOW_MOCK_FALLBACK) {
      console.warn('[Portfolio Service] Falling back to mock alerts (DEV mode only)');
      return generateMockAlerts(3);
    }

    throw error instanceof Error
      ? error
      : new Error('Failed to fetch portfolio alerts');
  }
}

/**
 * Get recent activity (latest user actions)
 */
export async function getRecentActivity(tenantId: string, limit: number = 10): Promise<ActivityItem[]> {
  if (USE_MOCK_DATA) {
    await simulateApiDelay(100, 300);
    return generateMockActivity(limit);
  }

  try {
    const [enrichmentEventsResponse, usersResponse] = await Promise.all([
      cnsApi.get<EnrichmentEvent[]>('/api/cns/enrichment-events', {
        params: {
          organization_id: tenantId,
          limit,
          sort: '-created_at',
        },
      }),
      platformApi.get<UserData[]>('/api/users', {
        params: { tenantId },
      }),
    ]);

    return formatRecentActivity(enrichmentEventsResponse.data, usersResponse.data, limit);
  } catch (error) {
    console.error('[Portfolio Service] Error fetching recent activity:', error);

    if (ALLOW_MOCK_FALLBACK) {
      console.warn('[Portfolio Service] Falling back to mock activity (DEV mode only)');
      return generateMockActivity(limit);
    }

    throw error instanceof Error
      ? error
      : new Error('Failed to fetch recent activity');
  }
}

/**
 * Get enrichment activity (daily aggregated data)
 */
export async function getEnrichmentActivity(tenantId: string, days: number = 7): Promise<DailyActivity[]> {
  if (USE_MOCK_DATA) {
    await simulateApiDelay(100, 300);
    return generateMockDailyActivity(days);
  }

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const response = await cnsApi.get<EnrichmentEvent[]>('/api/cns/enrichment-events', {
      params: {
        organization_id: tenantId,
        start_date: startDate.toISOString(),
      },
    });

    return formatEnrichmentActivity(response.data, days);
  } catch (error) {
    console.error('[Portfolio Service] Error fetching enrichment activity:', error);

    if (ALLOW_MOCK_FALLBACK) {
      console.warn('[Portfolio Service] Falling back to mock daily activity (DEV mode only)');
      return generateMockDailyActivity(days);
    }

    throw error instanceof Error
      ? error
      : new Error('Failed to fetch enrichment activity');
  }
}

/**
 * Get risk distribution across all BOMs
 */
export async function getRiskDistribution(tenantId: string): Promise<RiskDistribution> {
  if (USE_MOCK_DATA) {
    await simulateApiDelay(100, 300);
    return {
      low: 45,
      medium: 32,
      high: 18,
      critical: 5,
    };
  }

  try {
    const response = await cnsApi.get<BomData[]>('/api/cns/boms', {
      params: { organization_id: tenantId },
    });

    return response.data.reduce(
      (acc, bom) => {
        acc[bom.riskLevel] = (acc[bom.riskLevel] || 0) + 1;
        return acc;
      },
      { low: 0, medium: 0, high: 0, critical: 0 } as RiskDistribution
    );
  } catch (error) {
    console.error('[Portfolio Service] Error fetching risk distribution:', error);

    if (ALLOW_MOCK_FALLBACK) {
      console.warn('[Portfolio Service] Falling back to empty risk distribution (DEV mode only)');
      return { low: 0, medium: 0, high: 0, critical: 0 };
    }

    throw error instanceof Error
      ? error
      : new Error('Failed to fetch risk distribution');
  }
}

/**
 * Export portfolio data as PDF
 */
export async function exportPortfolioPDF(tenantId: string): Promise<Blob> {
  try {
    const response = await platformApi.post(
      '/api/portfolio/export',
      { format: 'pdf' },
      {
        params: { tenantId },
        responseType: 'blob',
      }
    );

    return response.data;
  } catch (error) {
    console.error('[Portfolio Service] Error exporting PDF:', error);
    throw new Error('Failed to export portfolio as PDF');
  }
}

/**
 * Export portfolio data as CSV
 */
export async function exportPortfolioCSV(tenantId: string): Promise<Blob> {
  try {
    const response = await platformApi.post(
      '/api/portfolio/export',
      { format: 'csv' },
      {
        params: { tenantId },
        responseType: 'blob',
      }
    );

    return response.data;
  } catch (error) {
    console.error('[Portfolio Service] Error exporting CSV:', error);
    throw new Error('Failed to export portfolio as CSV');
  }
}
