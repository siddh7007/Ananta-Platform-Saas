/**
 * usePortfolioRiskTrend Hook Tests
 *
 * P1-6: Tests for portfolio risk trend data hook.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { usePortfolioRiskTrend } from './usePortfolioRiskTrend';
import { riskApi } from '../services/riskService';

// Mock the riskApi
vi.mock('../services/riskService', () => ({
  riskApi: {
    getPortfolioRisk: vi.fn(),
    getRiskHistory: vi.fn(),
  },
}));

const mockPortfolioSummary = {
  total_components: 150,
  risk_distribution: {
    low: 80,
    medium: 40,
    high: 20,
    critical: 10,
  },
  average_risk_score: 45,
  trend: 'improving' as const,
  high_risk_components: [
    {
      component_id: '1',
      mpn: 'TEST-001',
      manufacturer: 'TestCorp',
      total_risk_score: 75,
      risk_level: 'high' as const,
      lifecycle_risk: 80,
      supply_chain_risk: 70,
      compliance_risk: 60,
      obsolescence_risk: 50,
      single_source_risk: 85,
      risk_factors: null,
      mitigation_suggestions: null,
      calculated_at: null,
      calculation_method: 'default',
    },
  ],
  top_risk_factors: ['lifecycle', 'supply_chain'],
};

describe('usePortfolioRiskTrend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns initial state when fetchOnMount is false', () => {
    const { result } = renderHook(() =>
      usePortfolioRiskTrend({ fetchOnMount: false })
    );

    expect(result.current.data).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.summary).toBeNull();
  });

  it('fetches data on mount when fetchOnMount is true', async () => {
    (riskApi.getPortfolioRisk as ReturnType<typeof vi.fn>).mockResolvedValue(mockPortfolioSummary);

    const { result } = renderHook(() =>
      usePortfolioRiskTrend({ fetchOnMount: true, days: 7 })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data.length).toBe(7);
  });

  it('provides refresh function', async () => {
    (riskApi.getPortfolioRisk as ReturnType<typeof vi.fn>).mockResolvedValue(mockPortfolioSummary);

    const { result } = renderHook(() =>
      usePortfolioRiskTrend({ fetchOnMount: false })
    );

    expect(typeof result.current.refresh).toBe('function');

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.data.length).toBeGreaterThan(0);
  });

  it('handles API errors gracefully with fallback data', async () => {
    // When API fails, hook uses Promise.allSettled which doesn't throw
    // Instead it falls back to mock data with null summary
    (riskApi.getPortfolioRisk as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() =>
      usePortfolioRiskTrend({ fetchOnMount: true })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Summary should be null when API fails
    expect(result.current.summary).toBeNull();
    // But data should still be populated with mock fallback
    expect(result.current.data.length).toBeGreaterThan(0);
  });

  it('updates summary from portfolio API', async () => {
    (riskApi.getPortfolioRisk as ReturnType<typeof vi.fn>).mockResolvedValue(mockPortfolioSummary);

    const { result } = renderHook(() =>
      usePortfolioRiskTrend({ fetchOnMount: true })
    );

    await waitFor(() => {
      expect(result.current.summary).not.toBeNull();
    });

    expect(result.current.summary?.total_components).toBe(150);
    expect(result.current.summary?.average_risk_score).toBe(45);
  });

  it('respects days option for data generation', async () => {
    (riskApi.getPortfolioRisk as ReturnType<typeof vi.fn>).mockResolvedValue(mockPortfolioSummary);

    const { result } = renderHook(() =>
      usePortfolioRiskTrend({ fetchOnMount: true, days: 7 })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data.length).toBe(7);
  });

  it('updates latest data point with real portfolio data', async () => {
    (riskApi.getPortfolioRisk as ReturnType<typeof vi.fn>).mockResolvedValue(mockPortfolioSummary);

    const { result } = renderHook(() =>
      usePortfolioRiskTrend({ fetchOnMount: true, days: 7 })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const lastPoint = result.current.data[result.current.data.length - 1];
    expect(lastPoint.avgRiskScore).toBe(45);
    expect(lastPoint.totalComponents).toBe(150);
    expect(lastPoint.distribution).toEqual(mockPortfolioSummary.risk_distribution);
  });

  it('generates trend data with correct structure', async () => {
    (riskApi.getPortfolioRisk as ReturnType<typeof vi.fn>).mockResolvedValue(mockPortfolioSummary);

    const { result } = renderHook(() =>
      usePortfolioRiskTrend({ fetchOnMount: true, days: 7 })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const point = result.current.data[0];

    expect(point).toHaveProperty('date');
    expect(point).toHaveProperty('label');
    expect(point).toHaveProperty('avgRiskScore');
    expect(point).toHaveProperty('distribution');
    expect(point).toHaveProperty('factors');
    expect(point).toHaveProperty('totalComponents');
    expect(point).toHaveProperty('attentionRequired');

    expect(point.distribution).toHaveProperty('low');
    expect(point.distribution).toHaveProperty('medium');
    expect(point.distribution).toHaveProperty('high');
    expect(point.distribution).toHaveProperty('critical');

    expect(point.factors).toHaveProperty('lifecycle');
    expect(point.factors).toHaveProperty('supply_chain');
    expect(point.factors).toHaveProperty('compliance');
    expect(point.factors).toHaveProperty('obsolescence');
    expect(point.factors).toHaveProperty('single_source');
  });

  it('updates summary when API recovers after failure', async () => {
    (riskApi.getPortfolioRisk as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(mockPortfolioSummary);

    const { result } = renderHook(() =>
      usePortfolioRiskTrend({ fetchOnMount: true })
    );

    // First call fails, summary should be null
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.summary).toBeNull();

    // Refresh should succeed and update summary
    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.summary).not.toBeNull();
    expect(result.current.summary?.total_components).toBe(150);
  });

  it('generates labels correctly for different periods', async () => {
    (riskApi.getPortfolioRisk as ReturnType<typeof vi.fn>).mockResolvedValue(mockPortfolioSummary);

    const { result } = renderHook(() =>
      usePortfolioRiskTrend({ fetchOnMount: true, days: 7 })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const lastPoint = result.current.data[result.current.data.length - 1];
    expect(lastPoint.label).toBe('Today');
  });

  it('sets loading true during fetch', async () => {
    let resolvePromise: ((value: typeof mockPortfolioSummary) => void) | null = null;
    (riskApi.getPortfolioRisk as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise((resolve) => { resolvePromise = resolve; })
    );

    const { result } = renderHook(() =>
      usePortfolioRiskTrend({ fetchOnMount: true })
    );

    // Should be loading immediately
    expect(result.current.loading).toBe(true);

    // Resolve the promise
    await act(async () => {
      resolvePromise?.(mockPortfolioSummary);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });
});

describe('usePortfolioRiskTrend polling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not poll when interval is 0', async () => {
    (riskApi.getPortfolioRisk as ReturnType<typeof vi.fn>).mockResolvedValue(mockPortfolioSummary);

    renderHook(() =>
      usePortfolioRiskTrend({ fetchOnMount: false, pollingInterval: 0 })
    );

    await act(async () => {
      vi.advanceTimersByTime(10000);
    });

    // Should not be called at all (fetchOnMount is false)
    expect(riskApi.getPortfolioRisk).not.toHaveBeenCalled();
  });
});
