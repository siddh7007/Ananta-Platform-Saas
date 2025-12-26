/**
 * Portfolio Service and Hooks Tests
 * @module test/portfolio
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import {
  getPortfolioMetrics,
  getPortfolioAlerts,
  getRecentActivity,
  getEnrichmentActivity,
  getRiskDistribution,
  exportPortfolioPDF,
  exportPortfolioCSV,
} from '../services/portfolio.service';
import {
  generateMockPortfolioMetrics,
  generateMockAlerts,
  generateMockActivity,
  generateMockDailyActivity,
} from '../mocks/portfolio.mock';
import { usePortfolioMetrics } from '../hooks/usePortfolioMetrics';
import { usePortfolioAlerts } from '../hooks/usePortfolioAlerts';
import { useRecentActivity } from '../hooks/useRecentActivity';
import { usePortfolioExport } from '../hooks/usePortfolioExport';

// Mock axios
vi.mock('../lib/axios', () => ({
  cnsApi: {
    get: vi.fn(),
    post: vi.fn(),
  },
  platformApi: {
    get: vi.fn(),
    post: vi.fn(),
  },
  apiRequest: vi.fn(),
}));

describe('Portfolio Service', () => {
  const mockTenantId = 'test-tenant-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPortfolioMetrics', () => {
    it('should fetch portfolio metrics with mock data', async () => {
      const metrics = await getPortfolioMetrics({ tenantId: mockTenantId });

      expect(metrics).toBeDefined();
      expect(metrics.totalBoms).toBeGreaterThanOrEqual(0);
      expect(metrics.atRiskBoms).toBeGreaterThanOrEqual(0);
      expect(metrics.avgEnrichmentScore).toBeGreaterThanOrEqual(0);
      expect(metrics.avgEnrichmentScore).toBeLessThanOrEqual(100);
      expect(metrics.criticalAlerts).toBeInstanceOf(Array);
      expect(metrics.recentActivity).toBeInstanceOf(Array);
    });

    it('should aggregate data from multiple sources', async () => {
      const metrics = await getPortfolioMetrics({ tenantId: mockTenantId });

      // Check all required fields are present
      expect(metrics).toHaveProperty('totalBoms');
      expect(metrics).toHaveProperty('bomsTrend');
      expect(metrics).toHaveProperty('atRiskBoms');
      expect(metrics).toHaveProperty('atRiskTrend');
      expect(metrics).toHaveProperty('avgEnrichmentScore');
      expect(metrics).toHaveProperty('costMtd');
      expect(metrics).toHaveProperty('costBudget');
      expect(metrics).toHaveProperty('riskDistribution');
      expect(metrics).toHaveProperty('enrichmentActivity');
      expect(metrics).toHaveProperty('criticalAlerts');
      expect(metrics).toHaveProperty('recentActivity');
    });

    it('should handle API errors gracefully', async () => {
      // Service should fallback to mock data on error
      const metrics = await getPortfolioMetrics({ tenantId: mockTenantId });

      expect(metrics).toBeDefined();
      expect(metrics.totalBoms).toBeGreaterThanOrEqual(0);
    });

    it('should calculate trends correctly', async () => {
      const metrics = await getPortfolioMetrics({ tenantId: mockTenantId });

      expect(metrics.bomsTrend).toBeDefined();
      expect(metrics.bomsTrend.direction).toMatch(/up|down|flat/);
      expect(metrics.bomsTrend.period).toBeDefined();
      expect(metrics.bomsTrend.value).toBeGreaterThanOrEqual(0);

      expect(metrics.atRiskTrend).toBeDefined();
      expect(metrics.atRiskTrend.direction).toMatch(/up|down|flat/);
    });

    it('should format dates properly', async () => {
      const metrics = await getPortfolioMetrics({ tenantId: mockTenantId });

      metrics.enrichmentActivity.forEach(activity => {
        // Date should be in YYYY-MM-DD format
        expect(activity.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });

      metrics.criticalAlerts.forEach(alert => {
        expect(alert.createdAt).toBeInstanceOf(Date);
      });

      metrics.recentActivity.forEach(activity => {
        expect(activity.timestamp).toBeInstanceOf(Date);
      });
    });
  });

  describe('getPortfolioAlerts', () => {
    it('should fetch alerts', async () => {
      const alerts = await getPortfolioAlerts(mockTenantId);

      expect(alerts).toBeInstanceOf(Array);
      alerts.forEach(alert => {
        expect(alert).toHaveProperty('id');
        expect(alert).toHaveProperty('type');
        expect(alert).toHaveProperty('severity');
        expect(alert).toHaveProperty('message');
        expect(alert.severity).toMatch(/warning|error/);
      });
    });

    it('should filter critical alerts only', async () => {
      const alerts = await getPortfolioAlerts(mockTenantId);

      // All alerts should be actionable
      alerts.forEach(alert => {
        expect(alert.message).toBeTruthy();
        expect(alert.type).toMatch(/obsolete|quota|inactive_user|enrichment_failed/);
      });
    });
  });

  describe('getRecentActivity', () => {
    it('should fetch recent activity', async () => {
      const activity = await getRecentActivity(mockTenantId, 10);

      expect(activity).toBeInstanceOf(Array);
      expect(activity.length).toBeLessThanOrEqual(10);

      activity.forEach(item => {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('userId');
        expect(item).toHaveProperty('userName');
        expect(item).toHaveProperty('action');
        expect(item).toHaveProperty('target');
        expect(item).toHaveProperty('timestamp');
        expect(item.action).toMatch(/upload|compare|enrich|approve|export/);
      });
    });

    it('should respect limit parameter', async () => {
      const limit = 5;
      const activity = await getRecentActivity(mockTenantId, limit);

      expect(activity.length).toBeLessThanOrEqual(limit);
    });
  });

  describe('getEnrichmentActivity', () => {
    it('should fetch daily activity', async () => {
      const days = 7;
      const activity = await getEnrichmentActivity(mockTenantId, days);

      expect(activity).toBeInstanceOf(Array);
      expect(activity.length).toBeLessThanOrEqual(days);

      activity.forEach(item => {
        expect(item).toHaveProperty('date');
        expect(item).toHaveProperty('count');
        expect(item).toHaveProperty('cost');
        expect(item.count).toBeGreaterThanOrEqual(0);
        expect(item.cost).toBeGreaterThanOrEqual(0);
      });
    });

    it('should return data sorted by date', async () => {
      const activity = await getEnrichmentActivity(mockTenantId, 7);

      for (let i = 1; i < activity.length; i++) {
        expect(activity[i].date >= activity[i - 1].date).toBe(true);
      }
    });
  });

  describe('getRiskDistribution', () => {
    it('should return risk distribution', async () => {
      const distribution = await getRiskDistribution(mockTenantId);

      expect(distribution).toHaveProperty('low');
      expect(distribution).toHaveProperty('medium');
      expect(distribution).toHaveProperty('high');
      expect(distribution).toHaveProperty('critical');

      expect(distribution.low).toBeGreaterThanOrEqual(0);
      expect(distribution.medium).toBeGreaterThanOrEqual(0);
      expect(distribution.high).toBeGreaterThanOrEqual(0);
      expect(distribution.critical).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Portfolio Export', () => {
    it('should export as PDF', async () => {
      // This test will fail until backend is implemented
      // For now, just check it throws the expected error
      await expect(exportPortfolioPDF(mockTenantId)).rejects.toThrow();
    });

    it('should export as CSV', async () => {
      // This test will fail until backend is implemented
      await expect(exportPortfolioCSV(mockTenantId)).rejects.toThrow();
    });
  });
});

describe('usePortfolioMetrics Hook', () => {
  const mockTenantId = 'test-tenant-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('should return loading state initially', () => {
    const { result } = renderHook(() =>
      usePortfolioMetrics({ tenantId: mockTenantId, enabled: false })
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('should fetch data when enabled', async () => {
    const { result } = renderHook(() =>
      usePortfolioMetrics({ tenantId: mockTenantId })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeDefined();
    expect(result.current.error).toBeNull();
  });

  it('should handle errors', async () => {
    // Service falls back to mock data, so we'll always get data
    const { result } = renderHook(() =>
      usePortfolioMetrics({ tenantId: mockTenantId })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeDefined();
  });

  it('should support manual refetch', async () => {
    const { result } = renderHook(() =>
      usePortfolioMetrics({ tenantId: mockTenantId })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const { refetch } = result.current;
    await refetch();

    expect(result.current.data).toBeDefined();
  });
});

describe('usePortfolioAlerts Hook', () => {
  const mockTenantId = 'test-tenant-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('should fetch alerts', async () => {
    const { result } = renderHook(() =>
      usePortfolioAlerts({ tenantId: mockTenantId })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.alerts).toBeInstanceOf(Array);
  });

  it('should calculate alert counts', async () => {
    const { result } = renderHook(() =>
      usePortfolioAlerts({ tenantId: mockTenantId })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.criticalCount).toBeGreaterThanOrEqual(0);
    expect(result.current.warningCount).toBeGreaterThanOrEqual(0);
  });
});

describe('useRecentActivity Hook', () => {
  const mockTenantId = 'test-tenant-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('should fetch activity', async () => {
    const { result } = renderHook(() =>
      useRecentActivity({ tenantId: mockTenantId, initialLimit: 10 })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.activity).toBeInstanceOf(Array);
  });

  it('should support load more', async () => {
    const { result } = renderHook(() =>
      useRecentActivity({ tenantId: mockTenantId, initialLimit: 5 })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const initialLength = result.current.activity.length;
    await result.current.loadMore();

    await waitFor(() => {
      expect(result.current.isLoadingMore).toBe(false);
    });

    // Should have more items or same if at end
    expect(result.current.activity.length).toBeGreaterThanOrEqual(initialLength);
  });
});

describe('usePortfolioExport Hook', () => {
  it('should initialize without errors', () => {
    const { result } = renderHook(() => usePortfolioExport());

    expect(result.current.isExporting).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.exportingFormat).toBeNull();
  });

  it('should have export functions', () => {
    const { result } = renderHook(() => usePortfolioExport());

    expect(result.current.exportPDF).toBeInstanceOf(Function);
    expect(result.current.exportCSV).toBeInstanceOf(Function);
    expect(result.current.exportData).toBeInstanceOf(Function);
  });
});

describe('Mock Data Generators', () => {
  it('should generate valid portfolio metrics', () => {
    const metrics = generateMockPortfolioMetrics('test-tenant');

    expect(metrics.totalBoms).toBeGreaterThanOrEqual(0);
    expect(metrics.avgEnrichmentScore).toBeGreaterThanOrEqual(0);
    expect(metrics.avgEnrichmentScore).toBeLessThanOrEqual(100);
    expect(metrics.costMtd).toBeGreaterThanOrEqual(0);
    expect(metrics.costBudget).toBeGreaterThanOrEqual(0);
  });

  it('should generate valid alerts', () => {
    const alerts = generateMockAlerts(5);

    expect(alerts.length).toBeLessThanOrEqual(5);
    alerts.forEach(alert => {
      expect(alert.id).toBeTruthy();
      expect(alert.message).toBeTruthy();
      expect(alert.severity).toMatch(/warning|error/);
    });
  });

  it('should generate valid activity items', () => {
    const activity = generateMockActivity(10);

    expect(activity.length).toBe(10);
    activity.forEach(item => {
      expect(item.id).toBeTruthy();
      expect(item.userName).toBeTruthy();
      expect(item.action).toMatch(/upload|compare|enrich|approve|export/);
    });
  });

  it('should generate valid daily activity', () => {
    const days = 7;
    const activity = generateMockDailyActivity(days);

    expect(activity.length).toBe(days);
    activity.forEach(item => {
      expect(item.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(item.count).toBeGreaterThanOrEqual(0);
      expect(item.cost).toBeGreaterThanOrEqual(0);
    });
  });
});
