/**
 * Portfolio Dashboard Mock Data Generator
 * @module mocks/portfolio
 *
 * Generates realistic mock data for development and testing.
 */

import {
  PortfolioMetrics,
  TrendData,
  RiskDistribution,
  DailyActivity,
  Alert,
  AlertType,
  AlertSeverity,
  ActivityItem,
  ActivityAction,
} from '../types/dashboard';

/**
 * Generate random integer between min and max (inclusive)
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate random float between min and max
 */
function randomFloat(min: number, max: number, decimals: number = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

/**
 * Pick random item from array
 */
function randomPick<T>(array: T[]): T {
  return array[randomInt(0, array.length - 1)];
}

/**
 * Generate trend data
 */
function generateTrendData(value: number, allowFlat: boolean = true): TrendData {
  const directions: Array<'up' | 'down' | 'flat'> = allowFlat
    ? ['up', 'down', 'flat']
    : ['up', 'down'];

  return {
    value,
    direction: randomPick(directions),
    period: randomPick(['week', 'month', 'quarter']),
  };
}

/**
 * Generate risk distribution
 */
export function generateMockRiskDistribution(): RiskDistribution {
  const total = randomInt(50, 200);
  const critical = randomInt(0, Math.floor(total * 0.1));
  const high = randomInt(0, Math.floor(total * 0.2));
  const medium = randomInt(0, Math.floor(total * 0.3));
  const low = total - critical - high - medium;

  return {
    low: Math.max(0, low),
    medium,
    high,
    critical,
  };
}

/**
 * Generate daily activity data
 */
export function generateMockDailyActivity(days: number = 7): DailyActivity[] {
  const activities: DailyActivity[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    activities.push({
      date: date.toISOString().split('T')[0],
      count: randomInt(5, 50),
      cost: randomFloat(10, 200, 2),
    });
  }

  return activities;
}

/**
 * Generate mock alerts
 */
export function generateMockAlerts(count: number = 3): Alert[] {
  const alertTypes: { type: AlertType; severity: AlertSeverity; messages: string[]; urls: string[] }[] = [
    {
      type: 'obsolete',
      severity: 'warning',
      messages: [
        'BOMs have >10% obsolete components',
        'BOMs contain end-of-life parts',
        'BOMs have discontinued components',
      ],
      urls: ['/boms?filter=obsolete'],
    },
    {
      type: 'quota',
      severity: 'error',
      messages: [
        'Enrichment quota at 95%',
        'Enrichment quota at 87%',
        'API call limit approaching',
      ],
      urls: ['/settings/billing'],
    },
    {
      type: 'inactive_user',
      severity: 'warning',
      messages: [
        'team members haven\'t logged in for 14+ days',
        'users inactive for over 2 weeks',
        'team members pending activation',
      ],
      urls: ['/settings/team'],
    },
    {
      type: 'enrichment_failed',
      severity: 'error',
      messages: [
        'enrichment jobs failed in the last 24 hours',
        'BOMs failed to enrich due to API errors',
        'enrichment retries exhausted',
      ],
      urls: ['/boms?status=failed'],
    },
  ];

  const alerts: Alert[] = [];
  const usedTypes = new Set<string>();

  for (let i = 0; i < count; i++) {
    // Pick a random alert type that hasn't been used
    const availableTypes = alertTypes.filter(t => !usedTypes.has(t.type));
    if (availableTypes.length === 0) break;

    const alertConfig = randomPick(availableTypes);
    usedTypes.add(alertConfig.type);

    const messagePrefix = alertConfig.type === 'obsolete' || alertConfig.type === 'enrichment_failed'
      ? `${randomInt(1, 15)} `
      : alertConfig.type === 'inactive_user'
      ? `${randomInt(2, 10)} `
      : '';

    alerts.push({
      id: crypto.randomUUID(),
      type: alertConfig.type,
      severity: alertConfig.severity,
      message: messagePrefix + randomPick(alertConfig.messages),
      actionUrl: randomPick(alertConfig.urls),
      createdAt: new Date(Date.now() - randomInt(0, 7200000)), // Within last 2 hours
    });
  }

  return alerts;
}

/**
 * Generate mock activity items
 */
export function generateMockActivity(count: number = 10): ActivityItem[] {
  const actions: ActivityAction[] = ['upload', 'compare', 'enrich', 'approve', 'export'];
  const users = [
    { id: '1', name: 'Alice Johnson', avatar: 'https://i.pravatar.cc/150?img=1' },
    { id: '2', name: 'Bob Smith', avatar: 'https://i.pravatar.cc/150?img=2' },
    { id: '3', name: 'Carol Davis', avatar: 'https://i.pravatar.cc/150?img=3' },
    { id: '4', name: 'David Wilson', avatar: 'https://i.pravatar.cc/150?img=4' },
    { id: '5', name: 'Eve Martinez', avatar: 'https://i.pravatar.cc/150?img=5' },
  ];

  const bomNames = [
    'PCB-REV-2024-001',
    'MAINBOARD-V3',
    'SENSOR-MODULE-A',
    'POWER-SUPPLY-12V',
    'CONTROL-BOARD-BETA',
    'LED-DRIVER-V2',
    'INTERFACE-CARD',
    'MEMORY-MODULE-DDR4',
  ];

  const activities: ActivityItem[] = [];

  for (let i = 0; i < count; i++) {
    const user = randomPick(users);
    const action = randomPick(actions);
    const target = randomPick(bomNames);

    // More recent activities at the start
    const hoursAgo = i * randomFloat(0.5, 3);
    const timestamp = new Date(Date.now() - hoursAgo * 3600000);

    activities.push({
      id: crypto.randomUUID(),
      userId: user.id,
      userName: user.name,
      userAvatar: user.avatar,
      action,
      target,
      timestamp,
    });
  }

  return activities;
}

/**
 * Generate complete mock portfolio metrics
 */
export function generateMockPortfolioMetrics(tenantId: string): PortfolioMetrics {
  const totalBoms = randomInt(50, 500);
  const atRiskBoms = randomInt(5, Math.floor(totalBoms * 0.3));
  const avgScore = randomFloat(65, 95, 1);
  const costMtd = randomFloat(500, 5000, 2);
  const costBudget = randomFloat(5000, 10000, 2);

  return {
    totalBoms,
    bomsTrend: generateTrendData(randomInt(5, 20), false),
    atRiskBoms,
    atRiskTrend: generateTrendData(randomInt(1, 10), true),
    avgEnrichmentScore: avgScore,
    costMtd,
    costBudget,
    riskDistribution: generateMockRiskDistribution(),
    enrichmentActivity: generateMockDailyActivity(7),
    criticalAlerts: generateMockAlerts(randomInt(1, 4)),
    recentActivity: generateMockActivity(8),
  };
}

/**
 * Mock API delay simulator
 */
export function simulateApiDelay(minMs: number = 200, maxMs: number = 800): Promise<void> {
  const delay = randomInt(minMs, maxMs);
  return new Promise(resolve => setTimeout(resolve, delay));
}
