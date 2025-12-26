/**
 * Risk Service Tests
 * Tests for risk.service.ts utility functions and API calls
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock axios before importing the service
vi.mock('@/lib/axios', () => ({
  cnsApi: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
  // Mock assertTenantContext to not throw in tests
  assertTenantContext: vi.fn(() => 'test-tenant-id'),
}));

// Mock env
vi.mock('@/config/env', () => ({
  env: {
    api: {
      cns: 'http://localhost:27200',
      platform: 'http://localhost:14000',
      supabase: 'http://localhost:27810',
    },
  },
}));

describe('Risk Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  // =========================================================================
  // Tenant Context Guard Tests
  // =========================================================================

  describe('Tenant Context Enforcement', () => {
    it('should throw error when tenant context is missing for getBomRiskDetail', async () => {
      // Override the mock to throw for this test
      const axiosModule = await import('@/lib/axios');
      vi.mocked(axiosModule.assertTenantContext).mockImplementationOnce(() => {
        throw new Error('Tenant context required: No tenant selected.');
      });

      const { getBomRiskDetail } = await import('@/services/risk.service');

      await expect(getBomRiskDetail('bom-123')).rejects.toThrow(
        'Tenant context required'
      );
    });

    it('should throw error when tenant context is missing for getBomLineItemsWithRisk', async () => {
      const axiosModule = await import('@/lib/axios');
      vi.mocked(axiosModule.assertTenantContext).mockImplementationOnce(() => {
        throw new Error('Tenant context required: No tenant selected.');
      });

      const { getBomLineItemsWithRisk } = await import(
        '@/services/risk.service'
      );

      await expect(getBomLineItemsWithRisk('bom-123')).rejects.toThrow(
        'Tenant context required'
      );
    });

    it('should throw error when tenant context is missing for recalculateBomRisk', async () => {
      const axiosModule = await import('@/lib/axios');
      vi.mocked(axiosModule.assertTenantContext).mockImplementationOnce(() => {
        throw new Error('Tenant context required: No tenant selected.');
      });

      const { recalculateBomRisk } = await import('@/services/risk.service');

      await expect(recalculateBomRisk('bom-123')).rejects.toThrow(
        'Tenant context required'
      );
    });

    it('should throw error when tenant context is missing for runRiskAnalysis', async () => {
      const axiosModule = await import('@/lib/axios');
      vi.mocked(axiosModule.assertTenantContext).mockImplementationOnce(() => {
        throw new Error('Tenant context required: No tenant selected.');
      });

      const { runRiskAnalysis } = await import('@/services/risk.service');

      await expect(runRiskAnalysis({ bomId: 'bom-123' })).rejects.toThrow(
        'Tenant context required'
      );
    });

    it('should throw error when tenant context is missing for getRiskProfile', async () => {
      const axiosModule = await import('@/lib/axios');
      vi.mocked(axiosModule.assertTenantContext).mockImplementationOnce(() => {
        throw new Error('Tenant context required: No tenant selected.');
      });

      const { getRiskProfile } = await import('@/services/risk.service');

      await expect(getRiskProfile()).rejects.toThrow('Tenant context required');
    });

    it('should throw error when tenant context is missing for updateRiskProfile', async () => {
      const axiosModule = await import('@/lib/axios');
      vi.mocked(axiosModule.assertTenantContext).mockImplementationOnce(() => {
        throw new Error('Tenant context required: No tenant selected.');
      });

      const { updateRiskProfile } = await import('@/services/risk.service');

      await expect(
        updateRiskProfile({ lifecycle_weight: 0.5 })
      ).rejects.toThrow('Tenant context required');
    });

    it('should throw error when tenant context is missing for getPortfolioRisk', async () => {
      const axiosModule = await import('@/lib/axios');
      vi.mocked(axiosModule.assertTenantContext).mockImplementationOnce(() => {
        throw new Error('Tenant context required: No tenant selected.');
      });

      const { getPortfolioRisk } = await import('@/services/risk.service');

      await expect(getPortfolioRisk()).rejects.toThrow(
        'Tenant context required'
      );
    });

    it('should throw error when tenant context is missing for getBomsWithRisk', async () => {
      const axiosModule = await import('@/lib/axios');
      vi.mocked(axiosModule.assertTenantContext).mockImplementationOnce(() => {
        throw new Error('Tenant context required: No tenant selected.');
      });

      const { getBomsWithRisk } = await import('@/services/risk.service');

      await expect(getBomsWithRisk()).rejects.toThrow(
        'Tenant context required'
      );
    });

    it('should throw error when tenant context is missing for getRiskStatistics', async () => {
      const axiosModule = await import('@/lib/axios');
      vi.mocked(axiosModule.assertTenantContext).mockImplementationOnce(() => {
        throw new Error('Tenant context required: No tenant selected.');
      });

      const { getRiskStatistics } = await import('@/services/risk.service');

      await expect(getRiskStatistics()).rejects.toThrow(
        'Tenant context required'
      );
    });

    it('should throw error when tenant context is missing for getHighRiskComponents', async () => {
      const axiosModule = await import('@/lib/axios');
      vi.mocked(axiosModule.assertTenantContext).mockImplementationOnce(() => {
        throw new Error('Tenant context required: No tenant selected.');
      });

      const { getHighRiskComponents } = await import('@/services/risk.service');

      await expect(getHighRiskComponents()).rejects.toThrow(
        'Tenant context required'
      );
    });

    it('should throw error when tenant context is missing for getComponentRisk', async () => {
      const axiosModule = await import('@/lib/axios');
      vi.mocked(axiosModule.assertTenantContext).mockImplementationOnce(() => {
        throw new Error('Tenant context required: No tenant selected.');
      });

      const { getComponentRisk } = await import('@/services/risk.service');

      await expect(getComponentRisk('comp-123')).rejects.toThrow(
        'Tenant context required'
      );
    });

    it('should throw error when tenant context is missing for getBatchRiskScores', async () => {
      const axiosModule = await import('@/lib/axios');
      vi.mocked(axiosModule.assertTenantContext).mockImplementationOnce(() => {
        throw new Error('Tenant context required: No tenant selected.');
      });

      const { getBatchRiskScores } = await import('@/services/risk.service');

      await expect(getBatchRiskScores(['comp-1', 'comp-2'])).rejects.toThrow(
        'Tenant context required'
      );
    });

    it('should throw error when tenant context is missing for calculateComponentRisk', async () => {
      const axiosModule = await import('@/lib/axios');
      vi.mocked(axiosModule.assertTenantContext).mockImplementationOnce(() => {
        throw new Error('Tenant context required: No tenant selected.');
      });

      const { calculateComponentRisk } = await import('@/services/risk.service');

      await expect(calculateComponentRisk('comp-123')).rejects.toThrow(
        'Tenant context required'
      );
    });

    it('should throw error when tenant context is missing for getRiskHistory', async () => {
      const axiosModule = await import('@/lib/axios');
      vi.mocked(axiosModule.assertTenantContext).mockImplementationOnce(() => {
        throw new Error('Tenant context required: No tenant selected.');
      });

      const { getRiskHistory } = await import('@/services/risk.service');

      await expect(getRiskHistory('comp-123')).rejects.toThrow(
        'Tenant context required'
      );
    });

    it('should throw error when tenant context is missing for getRiskAnalysisStatus', async () => {
      const axiosModule = await import('@/lib/axios');
      vi.mocked(axiosModule.assertTenantContext).mockImplementationOnce(() => {
        throw new Error('Tenant context required: No tenant selected.');
      });

      const { getRiskAnalysisStatus } = await import('@/services/risk.service');

      await expect(getRiskAnalysisStatus('wf-123')).rejects.toThrow(
        'Tenant context required'
      );
    });

    it('should throw error when tenant context is missing for resetRiskProfile', async () => {
      const axiosModule = await import('@/lib/axios');
      vi.mocked(axiosModule.assertTenantContext).mockImplementationOnce(() => {
        throw new Error('Tenant context required: No tenant selected.');
      });

      const { resetRiskProfile } = await import('@/services/risk.service');

      await expect(resetRiskProfile()).rejects.toThrow(
        'Tenant context required'
      );
    });

    it('should throw error when tenant context is missing for getRiskPresets', async () => {
      const axiosModule = await import('@/lib/axios');
      vi.mocked(axiosModule.assertTenantContext).mockImplementationOnce(() => {
        throw new Error('Tenant context required: No tenant selected.');
      });

      const { getRiskPresets } = await import('@/services/risk.service');

      await expect(getRiskPresets()).rejects.toThrow(
        'Tenant context required'
      );
    });

    it('should throw error when tenant context is missing for applyRiskPreset', async () => {
      const axiosModule = await import('@/lib/axios');
      vi.mocked(axiosModule.assertTenantContext).mockImplementationOnce(() => {
        throw new Error('Tenant context required: No tenant selected.');
      });

      const { applyRiskPreset } = await import('@/services/risk.service');

      await expect(applyRiskPreset('automotive')).rejects.toThrow(
        'Tenant context required'
      );
    });

    it('should throw error when tenant context is missing for getAllHighRiskLineItems', async () => {
      const axiosModule = await import('@/lib/axios');
      vi.mocked(axiosModule.assertTenantContext).mockImplementationOnce(() => {
        throw new Error('Tenant context required: No tenant selected.');
      });

      const { getAllHighRiskLineItems } = await import('@/services/risk.service');

      await expect(getAllHighRiskLineItems('bom-123')).rejects.toThrow(
        'Tenant context required'
      );
    });

    it('should call assertTenantContext before API call', async () => {
      const axiosModule = await import('@/lib/axios');
      const { getBomRiskDetail } = await import('@/services/risk.service');

      // Setup: assertTenantContext succeeds, API call succeeds
      vi.mocked(axiosModule.assertTenantContext).mockReturnValue(
        'test-tenant-id'
      );
      vi.mocked(axiosModule.cnsApi.get).mockResolvedValue({
        data: { bom_id: 'bom-123' },
      });

      await getBomRiskDetail('bom-123');

      // Verify assertTenantContext was called
      expect(axiosModule.assertTenantContext).toHaveBeenCalled();
      // Verify it was called before the API call
      const assertCall = vi.mocked(axiosModule.assertTenantContext).mock
        .invocationCallOrder[0];
      const apiCall = vi.mocked(axiosModule.cnsApi.get).mock
        .invocationCallOrder[0];
      expect(assertCall).toBeLessThan(apiCall);
    });
  });

  // =========================================================================
  // Utility Functions
  // =========================================================================

  describe('normalizeRiskLevel', () => {
    it('should lowercase uppercase risk levels', async () => {
      const { normalizeRiskLevel } = await import('@/services/risk.service');

      expect(normalizeRiskLevel('HIGH')).toBe('high');
      expect(normalizeRiskLevel('CRITICAL')).toBe('critical');
      expect(normalizeRiskLevel('MEDIUM')).toBe('medium');
      expect(normalizeRiskLevel('LOW')).toBe('low');
    });

    it('should handle mixed case risk levels', async () => {
      const { normalizeRiskLevel } = await import('@/services/risk.service');

      expect(normalizeRiskLevel('High')).toBe('high');
      expect(normalizeRiskLevel('CrItIcAl')).toBe('critical');
    });

    it('should trim whitespace', async () => {
      const { normalizeRiskLevel } = await import('@/services/risk.service');

      expect(normalizeRiskLevel('  high  ')).toBe('high');
      expect(normalizeRiskLevel('\tmedium\n')).toBe('medium');
    });

    it('should return "low" for null/undefined', async () => {
      const { normalizeRiskLevel } = await import('@/services/risk.service');

      expect(normalizeRiskLevel(null)).toBe('low');
      expect(normalizeRiskLevel(undefined)).toBe('low');
      expect(normalizeRiskLevel('')).toBe('low');
    });
  });

  describe('isHighRiskLevel', () => {
    it('should return true for "high" (case-insensitive)', async () => {
      const { isHighRiskLevel } = await import('@/services/risk.service');

      expect(isHighRiskLevel('high')).toBe(true);
      expect(isHighRiskLevel('HIGH')).toBe(true);
      expect(isHighRiskLevel('High')).toBe(true);
    });

    it('should return true for "critical" (case-insensitive)', async () => {
      const { isHighRiskLevel } = await import('@/services/risk.service');

      expect(isHighRiskLevel('critical')).toBe(true);
      expect(isHighRiskLevel('CRITICAL')).toBe(true);
      expect(isHighRiskLevel('Critical')).toBe(true);
    });

    it('should return false for "medium" and "low"', async () => {
      const { isHighRiskLevel } = await import('@/services/risk.service');

      expect(isHighRiskLevel('medium')).toBe(false);
      expect(isHighRiskLevel('MEDIUM')).toBe(false);
      expect(isHighRiskLevel('low')).toBe(false);
      expect(isHighRiskLevel('LOW')).toBe(false);
    });

    it('should return false for null/undefined', async () => {
      const { isHighRiskLevel } = await import('@/services/risk.service');

      expect(isHighRiskLevel(null)).toBe(false);
      expect(isHighRiskLevel(undefined)).toBe(false);
    });
  });

  describe('mapRiskLevel', () => {
    it('should map API risk levels to UI RiskLevel', async () => {
      const { mapRiskLevel } = await import('@/services/risk.service');

      expect(mapRiskLevel('low')).toBe('GREEN');
      expect(mapRiskLevel('medium')).toBe('YELLOW');
      expect(mapRiskLevel('high')).toBe('ORANGE');
      expect(mapRiskLevel('critical')).toBe('RED');
    });

    it('should handle uppercase input', async () => {
      const { mapRiskLevel } = await import('@/services/risk.service');

      expect(mapRiskLevel('LOW')).toBe('GREEN');
      expect(mapRiskLevel('HIGH')).toBe('ORANGE');
    });

    it('should default to GREEN for unknown levels', async () => {
      const { mapRiskLevel } = await import('@/services/risk.service');

      expect(mapRiskLevel('unknown')).toBe('GREEN');
      expect(mapRiskLevel('')).toBe('GREEN');
    });
  });

  describe('unmapRiskLevel', () => {
    it('should map UI RiskLevel to API risk levels', async () => {
      const { unmapRiskLevel } = await import('@/services/risk.service');

      expect(unmapRiskLevel('GREEN')).toBe('low');
      expect(unmapRiskLevel('YELLOW')).toBe('medium');
      expect(unmapRiskLevel('ORANGE')).toBe('high');
      expect(unmapRiskLevel('RED')).toBe('critical');
    });
  });

  describe('getHealthGradeDescription', () => {
    it('should return correct descriptions for all grades', async () => {
      const { getHealthGradeDescription } = await import(
        '@/services/risk.service'
      );

      expect(getHealthGradeDescription('A')).toContain('Excellent');
      expect(getHealthGradeDescription('B')).toContain('Good');
      expect(getHealthGradeDescription('C')).toContain('Fair');
      expect(getHealthGradeDescription('D')).toContain('Poor');
      expect(getHealthGradeDescription('F')).toContain('Critical');
      expect(getHealthGradeDescription('N/A')).toContain('Not analyzed');
    });

    it('should return "Unknown" for invalid grades', async () => {
      const { getHealthGradeDescription } = await import(
        '@/services/risk.service'
      );

      expect(getHealthGradeDescription('X')).toBe('Unknown');
      expect(getHealthGradeDescription('')).toBe('Unknown');
    });
  });

  describe('getHealthGradeColor', () => {
    it('should return correct color classes for all grades', async () => {
      const { getHealthGradeColor } = await import('@/services/risk.service');

      expect(getHealthGradeColor('A').text).toContain('green');
      expect(getHealthGradeColor('B').text).toContain('blue');
      expect(getHealthGradeColor('C').text).toContain('yellow');
      expect(getHealthGradeColor('D').text).toContain('orange');
      expect(getHealthGradeColor('F').text).toContain('red');
    });

    it('should return gray for unknown grades', async () => {
      const { getHealthGradeColor } = await import('@/services/risk.service');

      expect(getHealthGradeColor('X').text).toContain('gray');
    });
  });

  // =========================================================================
  // API Functions
  // =========================================================================

  describe('getBomRiskDetail', () => {
    it('should call CNS API with correct BOM ID', async () => {
      const { cnsApi } = await import('@/lib/axios');
      const { getBomRiskDetail } = await import('@/services/risk.service');

      const mockResponse = {
        data: {
          bom_id: 'bom-123',
          total_line_items: 50,
          high_risk_count: 5,
          average_risk_score: 45.5,
          health_grade: 'B',
        },
      };

      vi.mocked(cnsApi.get).mockResolvedValue(mockResponse);

      const result = await getBomRiskDetail('bom-123');

      expect(cnsApi.get).toHaveBeenCalledWith('/risk/boms/bom-123');
      expect(result.bom_id).toBe('bom-123');
      expect(result.high_risk_count).toBe(5);
    });
  });

  describe('getBomLineItemsWithRisk', () => {
    it('should use default limit of 100 and offset of 0', async () => {
      const { cnsApi } = await import('@/lib/axios');
      const { getBomLineItemsWithRisk } = await import(
        '@/services/risk.service'
      );

      const mockResponse = {
        data: {
          data: [],
          total: 0,
          limit: 100,
          offset: 0,
        },
      };

      vi.mocked(cnsApi.get).mockResolvedValue(mockResponse);

      await getBomLineItemsWithRisk('bom-123');

      expect(cnsApi.get).toHaveBeenCalledWith('/risk/boms/bom-123/line-items', {
        params: {
          risk_level: undefined,
          limit: 100,
          offset: 0,
        },
      });
    });

    it('should pass custom limit and offset', async () => {
      const { cnsApi } = await import('@/lib/axios');
      const { getBomLineItemsWithRisk } = await import(
        '@/services/risk.service'
      );

      vi.mocked(cnsApi.get).mockResolvedValue({ data: { data: [], total: 0 } });

      await getBomLineItemsWithRisk('bom-123', {
        limit: 25,
        offset: 50,
        riskLevel: 'high',
      });

      expect(cnsApi.get).toHaveBeenCalledWith('/risk/boms/bom-123/line-items', {
        params: {
          risk_level: 'high',
          limit: 25,
          offset: 50,
        },
      });
    });

    it('should handle legacy array response format', async () => {
      const { cnsApi } = await import('@/lib/axios');
      const { getBomLineItemsWithRisk } = await import(
        '@/services/risk.service'
      );

      // Simulate legacy API that returns plain array
      const mockItems = [
        { line_item_id: '1', risk_level: 'high' },
        { line_item_id: '2', risk_level: 'medium' },
      ];

      vi.mocked(cnsApi.get).mockResolvedValue({ data: mockItems });

      const result = await getBomLineItemsWithRisk('bom-123');

      expect(result.data).toEqual(mockItems);
      expect(result.total).toBe(2);
      expect(result.hasMore).toBe(false);
    });

    it('should handle paginated response format', async () => {
      const { cnsApi } = await import('@/lib/axios');
      const { getBomLineItemsWithRisk } = await import(
        '@/services/risk.service'
      );

      const mockResponse = {
        data: [{ line_item_id: '1' }],
        total: 100,
        limit: 25,
        offset: 0,
      };

      vi.mocked(cnsApi.get).mockResolvedValue({ data: mockResponse });

      const result = await getBomLineItemsWithRisk('bom-123', { limit: 25 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(100);
      expect(result.hasMore).toBe(true);
    });

    it('should calculate hasMore correctly', async () => {
      const { cnsApi } = await import('@/lib/axios');
      const { getBomLineItemsWithRisk } = await import(
        '@/services/risk.service'
      );

      // Test when there are more items
      vi.mocked(cnsApi.get).mockResolvedValue({
        data: {
          data: Array(25).fill({ line_item_id: '1' }),
          total: 100,
          limit: 25,
          offset: 0,
        },
      });

      let result = await getBomLineItemsWithRisk('bom-123');
      expect(result.hasMore).toBe(true);

      // Test when we've reached the end
      vi.mocked(cnsApi.get).mockResolvedValue({
        data: {
          data: Array(10).fill({ line_item_id: '1' }),
          total: 100,
          limit: 25,
          offset: 90,
        },
      });

      result = await getBomLineItemsWithRisk('bom-123', { offset: 90 });
      expect(result.hasMore).toBe(false);
    });

    it('should handle API response with "items" field instead of "data"', async () => {
      const { cnsApi } = await import('@/lib/axios');
      const { getBomLineItemsWithRisk } = await import(
        '@/services/risk.service'
      );

      // API returns items in "items" field (alternative format)
      vi.mocked(cnsApi.get).mockResolvedValue({
        data: {
          items: Array(25).fill({ line_item_id: '1' }),
          count: 100, // Alternative to "total"
          limit: 25,
          offset: 0,
        },
      });

      const result = await getBomLineItemsWithRisk('bom-123');

      expect(result.data).toHaveLength(25);
      expect(result.total).toBe(100);
      expect(result.hasMore).toBe(true); // 0 + 25 < 100
    });

    it('should set hasMore to false on final page when items.length < limit', async () => {
      const { cnsApi } = await import('@/lib/axios');
      const { getBomLineItemsWithRisk } = await import(
        '@/services/risk.service'
      );

      // Final page: offset=75, only 5 items returned, total=80
      vi.mocked(cnsApi.get).mockResolvedValue({
        data: {
          items: Array(5).fill({ line_item_id: '1' }),
          total: 80,
          limit: 25,
          offset: 75,
        },
      });

      const result = await getBomLineItemsWithRisk('bom-123', { offset: 75 });

      expect(result.data).toHaveLength(5);
      expect(result.hasMore).toBe(false); // 75 + 5 = 80, not < 80
    });

    it('should handle empty response gracefully', async () => {
      const { cnsApi } = await import('@/lib/axios');
      const { getBomLineItemsWithRisk } = await import(
        '@/services/risk.service'
      );

      vi.mocked(cnsApi.get).mockResolvedValue({
        data: {
          data: [],
          total: 0,
          limit: 25,
          offset: 0,
        },
      });

      const result = await getBomLineItemsWithRisk('bom-123');

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false); // 0 + 0 = 0, not < 0
    });
  });

  describe('getAllHighRiskLineItems', () => {
    it('should fetch all pages of high-risk items', async () => {
      const { cnsApi } = await import('@/lib/axios');
      const { getAllHighRiskLineItems } = await import(
        '@/services/risk.service'
      );

      // First call returns items with hasMore=true
      vi.mocked(cnsApi.get)
        .mockResolvedValueOnce({
          data: {
            data: Array(100).fill({ line_item_id: '1', risk_level: 'high' }),
            total: 150,
            limit: 100,
            offset: 0,
          },
        })
        // Second call returns remaining items
        .mockResolvedValueOnce({
          data: {
            data: Array(50).fill({ line_item_id: '2', risk_level: 'high' }),
            total: 150,
            limit: 100,
            offset: 100,
          },
        });

      const result = await getAllHighRiskLineItems('bom-123', 'high');

      expect(result).toHaveLength(150);
      expect(cnsApi.get).toHaveBeenCalledTimes(2);
    });

    it('should stop when no more items', async () => {
      const { cnsApi } = await import('@/lib/axios');
      const { getAllHighRiskLineItems } = await import(
        '@/services/risk.service'
      );

      vi.mocked(cnsApi.get).mockResolvedValueOnce({
        data: {
          data: [{ line_item_id: '1' }],
          total: 1,
          limit: 100,
          offset: 0,
        },
      });

      const result = await getAllHighRiskLineItems('bom-123');

      expect(result).toHaveLength(1);
      expect(cnsApi.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('recalculateBomRisk', () => {
    it('should call POST endpoint with correct BOM ID', async () => {
      const { cnsApi } = await import('@/lib/axios');
      const { recalculateBomRisk } = await import('@/services/risk.service');

      vi.mocked(cnsApi.post).mockResolvedValue({
        data: {
          status: 'success',
          bom_id: 'bom-123',
          total_line_items: 50,
          average_risk_score: 35.0,
          health_grade: 'B',
        },
      });

      const result = await recalculateBomRisk('bom-123');

      expect(cnsApi.post).toHaveBeenCalledWith('/risk/recalculate/bom/bom-123');
      expect(result.status).toBe('success');
    });
  });

  describe('runRiskAnalysis', () => {
    it('should call analyze endpoint with BOM ID', async () => {
      const { cnsApi } = await import('@/lib/axios');
      const { runRiskAnalysis } = await import('@/services/risk.service');

      vi.mocked(cnsApi.post).mockResolvedValue({
        data: {
          status: 'started',
          workflow_id: 'wf-123',
          message: 'Risk analysis started',
        },
      });

      const result = await runRiskAnalysis({ bomId: 'bom-123' });

      expect(cnsApi.post).toHaveBeenCalledWith('/risk/analyze', {
        bom_id: 'bom-123',
        force_recalculate: false,
      });
      expect(result.status).toBe('started');
    });

    it('should pass force_recalculate flag', async () => {
      const { cnsApi } = await import('@/lib/axios');
      const { runRiskAnalysis } = await import('@/services/risk.service');

      vi.mocked(cnsApi.post).mockResolvedValue({
        data: { status: 'started' },
      });

      await runRiskAnalysis({ bomId: 'bom-123', forceRecalculate: true });

      expect(cnsApi.post).toHaveBeenCalledWith('/risk/analyze', {
        bom_id: 'bom-123',
        force_recalculate: true,
      });
    });
  });

  describe('updateLineItemCriticality', () => {
    it('should call PUT endpoint with correct parameters', async () => {
      const { cnsApi } = await import('@/lib/axios');
      const { updateLineItemCriticality } = await import(
        '@/services/risk.service'
      );

      vi.mocked(cnsApi.put).mockResolvedValue({
        data: {
          status: 'updated',
          line_item_id: 'item-1',
          criticality_level: 5,
          new_contextual_score: 72.5,
        },
      });

      const result = await updateLineItemCriticality('bom-123', 'item-1', 5);

      expect(cnsApi.put).toHaveBeenCalledWith(
        '/risk/boms/bom-123/line-items/item-1/criticality',
        { criticality_level: 5 }
      );
      expect(result.criticality_level).toBe(5);
    });
  });

  // =========================================================================
  // Transform Functions
  // =========================================================================

  describe('transformToBomRiskAnalysis', () => {
    it('should transform API response to UI format', async () => {
      const { transformToBomRiskAnalysis } = await import(
        '@/services/risk.service'
      );

      const apiResponse = {
        bom_id: 'bom-123',
        bom_name: 'Test BOM',
        total_line_items: 100,
        low_risk_count: 50,
        medium_risk_count: 30,
        high_risk_count: 15,
        critical_risk_count: 5,
        average_risk_score: 42.5,
        weighted_risk_score: 45.0,
        health_grade: 'C',
        score_trend: 'stable',
        top_risk_components: [
          {
            line_item_id: 'item-1',
            mpn: 'MPN123',
            manufacturer: 'Acme',
            risk_score: 85,
            risk_level: 'critical',
          },
        ],
      };

      const result = transformToBomRiskAnalysis(apiResponse);

      expect(result.bomId).toBe('bom-123');
      expect(result.bomName).toBe('Test BOM');
      expect(result.overallRiskScore).toBe(43); // Rounded
      expect(result.overallRiskLevel).toBe('RED'); // Has critical items
      expect(result.summary?.totalLines).toBe(100);
      expect(result.summary?.greenCount).toBe(50);
      expect(result.summary?.redCount).toBe(5);
      expect(result.criticalItems).toHaveLength(1);
      expect(result.criticalItems?.[0].mpn).toBe('MPN123');
    });

    it('should determine risk level based on counts', async () => {
      const { transformToBomRiskAnalysis } = await import(
        '@/services/risk.service'
      );

      // No critical or high risk
      const lowRiskResponse = {
        bom_id: 'bom-1',
        total_line_items: 10,
        low_risk_count: 10,
        medium_risk_count: 0,
        high_risk_count: 0,
        critical_risk_count: 0,
        average_risk_score: 10,
        weighted_risk_score: 10,
        health_grade: 'A',
        score_trend: 'stable',
        top_risk_components: [],
      };

      expect(transformToBomRiskAnalysis(lowRiskResponse).overallRiskLevel).toBe(
        'GREEN'
      );

      // Has medium risk only
      const mediumRiskResponse = {
        ...lowRiskResponse,
        medium_risk_count: 5,
        low_risk_count: 5,
      };
      expect(
        transformToBomRiskAnalysis(mediumRiskResponse).overallRiskLevel
      ).toBe('YELLOW');

      // Has high risk
      const highRiskResponse = {
        ...lowRiskResponse,
        high_risk_count: 2,
      };
      expect(transformToBomRiskAnalysis(highRiskResponse).overallRiskLevel).toBe(
        'ORANGE'
      );
    });
  });
});

// =============================================================================
// Tenant Context Guard Tests (override global mock)
// =============================================================================

describe('Tenant Context Guards (integration)', () => {
  // These tests verify that service functions actually call assertTenantContext
  // and propagate its error. We override the global mock to throw.

  beforeEach(async () => {
    vi.clearAllMocks();
  });

  describe('getAllHighRiskLineItems missing-tenant behavior', () => {
    it('should throw error when assertTenantContext throws', async () => {
      // Override the global mock to throw for this specific test
      const axiosModule = await import('@/lib/axios');
      vi.mocked(axiosModule.assertTenantContext).mockImplementationOnce(() => {
        throw new Error('Tenant context required: No tenant selected.');
      });

      const { getAllHighRiskLineItems } = await import(
        '@/services/risk.service'
      );

      await expect(getAllHighRiskLineItems('bom-123', 'high')).rejects.toThrow(
        /tenant context required/i
      );
    });

    it('should succeed when tenant context is valid', async () => {
      const axiosModule = await import('@/lib/axios');
      // Restore the mock to return a valid tenant ID
      vi.mocked(axiosModule.assertTenantContext).mockReturnValue(
        'test-tenant-id'
      );

      vi.mocked(axiosModule.cnsApi.get).mockResolvedValue({
        data: {
          data: [{ line_item_id: '1', risk_level: 'high' }],
          total: 1,
          limit: 100,
          offset: 0,
        },
      });

      const { getAllHighRiskLineItems } = await import(
        '@/services/risk.service'
      );

      const result = await getAllHighRiskLineItems('bom-123', 'high');
      expect(result).toHaveLength(1);
      // Verify assertTenantContext was called
      expect(axiosModule.assertTenantContext).toHaveBeenCalled();
    });
  });

  describe('getBomRiskDetail missing-tenant behavior', () => {
    it('should throw error when assertTenantContext throws', async () => {
      const axiosModule = await import('@/lib/axios');
      vi.mocked(axiosModule.assertTenantContext).mockImplementationOnce(() => {
        throw new Error('Tenant context required: No tenant selected.');
      });

      const { getBomRiskDetail } = await import('@/services/risk.service');

      await expect(getBomRiskDetail('bom-123')).rejects.toThrow(
        /tenant context required/i
      );
    });
  });

  describe('getBomLineItemsWithRisk missing-tenant behavior', () => {
    it('should throw error when assertTenantContext throws', async () => {
      const axiosModule = await import('@/lib/axios');
      vi.mocked(axiosModule.assertTenantContext).mockImplementationOnce(() => {
        throw new Error('Tenant context required: No tenant selected.');
      });

      const { getBomLineItemsWithRisk } = await import(
        '@/services/risk.service'
      );

      await expect(getBomLineItemsWithRisk('bom-123')).rejects.toThrow(
        /tenant context required/i
      );
    });
  });

  describe('recalculateBomRisk missing-tenant behavior', () => {
    it('should throw error when assertTenantContext throws', async () => {
      const axiosModule = await import('@/lib/axios');
      vi.mocked(axiosModule.assertTenantContext).mockImplementationOnce(() => {
        throw new Error('Tenant context required: No tenant selected.');
      });

      const { recalculateBomRisk } = await import('@/services/risk.service');

      await expect(recalculateBomRisk('bom-123')).rejects.toThrow(
        /tenant context required/i
      );
    });
  });

  describe('runRiskAnalysis missing-tenant behavior', () => {
    it('should throw error when assertTenantContext throws', async () => {
      const axiosModule = await import('@/lib/axios');
      vi.mocked(axiosModule.assertTenantContext).mockImplementationOnce(() => {
        throw new Error('Tenant context required: No tenant selected.');
      });

      const { runRiskAnalysis } = await import('@/services/risk.service');

      await expect(runRiskAnalysis({ bomId: 'bom-123' })).rejects.toThrow(
        /tenant context required/i
      );
    });
  });

  describe('updateLineItemCriticality missing-tenant behavior', () => {
    it('should throw error when assertTenantContext throws', async () => {
      const axiosModule = await import('@/lib/axios');
      vi.mocked(axiosModule.assertTenantContext).mockImplementationOnce(() => {
        throw new Error('Tenant context required: No tenant selected.');
      });

      const { updateLineItemCriticality } = await import(
        '@/services/risk.service'
      );

      await expect(
        updateLineItemCriticality('bom-123', 'item-1', 5)
      ).rejects.toThrow(/tenant context required/i);
    });
  });
});
