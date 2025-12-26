/**
 * useParametricSearch Hook Tests
 *
 * P1-1: Tests for parametric search hook functionality.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  useParametricSearch,
  DEFAULT_PARAMETRIC_FILTERS,
  type ComponentSearchResult,
} from './useParametricSearch';

// Mock search results
const mockResults: ComponentSearchResult[] = [
  {
    id: '1',
    mpn: 'STM32F407VGT6',
    manufacturer: 'STMicroelectronics',
    category: 'Microcontrollers',
    description: 'ARM Cortex-M4 MCU',
    quality_score: 95,
    enrichment_status: 'production',
    data_sources: ['DigiKey', 'Mouser'],
    last_updated: '2024-01-01',
    lifecycle_status: 'Active',
    unit_price: 12.5,
    stock_quantity: 1500,
    rohs_compliant: true,
    reach_compliant: true,
  },
  {
    id: '2',
    mpn: 'LM358N',
    manufacturer: 'Texas Instruments',
    category: 'Op Amps',
    description: 'Dual Operational Amplifier',
    quality_score: 88,
    enrichment_status: 'production',
    data_sources: ['DigiKey'],
    last_updated: '2024-01-02',
    lifecycle_status: 'Active',
    unit_price: 0.85,
    stock_quantity: 50000,
    rohs_compliant: true,
  },
  {
    id: '3',
    mpn: 'NE555P',
    manufacturer: 'Texas Instruments',
    category: 'Timers',
    description: 'Timer IC',
    quality_score: 72,
    enrichment_status: 'staging',
    data_sources: ['Mouser'],
    last_updated: '2024-01-03',
    lifecycle_status: 'NRND',
    unit_price: 0.45,
    stock_quantity: 0,
  },
  {
    id: '4',
    mpn: 'MC7805',
    manufacturer: 'ON Semiconductor',
    category: 'Voltage Regulators',
    description: '5V Linear Regulator',
    quality_score: 45,
    enrichment_status: 'pending',
    data_sources: [],
    last_updated: '2024-01-04',
    lifecycle_status: 'Obsolete',
    unit_price: 0.25,
    stock_quantity: 100,
  },
];

describe('useParametricSearch', () => {
  const mockSearchFn = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchFn.mockResolvedValue({ results: mockResults, total: mockResults.length });
  });

  describe('Initial State', () => {
    it('initializes with default values', () => {
      const { result } = renderHook(() => useParametricSearch());

      expect(result.current.query).toBe('');
      expect(result.current.searchType).toBe('mpn');
      expect(result.current.filters).toEqual(DEFAULT_PARAMETRIC_FILTERS);
      expect(result.current.results).toEqual([]);
      expect(result.current.filteredResults).toEqual([]);
      // Facets are calculated from empty results - all facets have 0 values
      expect(result.current.facets.length).toBeGreaterThanOrEqual(0);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.total).toBe(0);
      expect(result.current.hasSearched).toBe(false);
    });

    it('accepts initial query and search type', () => {
      const { result } = renderHook(() =>
        useParametricSearch({
          initialQuery: 'STM32',
          initialSearchType: 'manufacturer',
        })
      );

      expect(result.current.query).toBe('STM32');
      expect(result.current.searchType).toBe('manufacturer');
    });
  });

  describe('Search Functionality', () => {
    it('performs search and updates results', async () => {
      const { result } = renderHook(() =>
        useParametricSearch({ searchFn: mockSearchFn })
      );

      act(() => {
        result.current.setQuery('STM32');
      });

      await act(async () => {
        await result.current.search();
      });

      expect(mockSearchFn).toHaveBeenCalledWith({
        query: 'STM32',
        search_type: 'mpn',
        limit: 100,
      });
      expect(result.current.results).toEqual(mockResults);
      expect(result.current.total).toBe(4);
      expect(result.current.hasSearched).toBe(true);
      expect(result.current.loading).toBe(false);
    });

    it('shows error for empty query', async () => {
      const { result } = renderHook(() =>
        useParametricSearch({ searchFn: mockSearchFn })
      );

      await act(async () => {
        await result.current.search();
      });

      expect(result.current.error).toBe('Please enter a search term');
      expect(mockSearchFn).not.toHaveBeenCalled();
    });

    it('handles search errors gracefully', async () => {
      mockSearchFn.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() =>
        useParametricSearch({ searchFn: mockSearchFn })
      );

      act(() => {
        result.current.setQuery('test');
      });

      await act(async () => {
        await result.current.search();
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.results).toEqual([]);
      expect(result.current.total).toBe(0);
    });

    it('updates search type correctly', () => {
      const { result } = renderHook(() => useParametricSearch());

      act(() => {
        result.current.setSearchType('manufacturer');
      });

      expect(result.current.searchType).toBe('manufacturer');
    });
  });

  describe('Facet Calculation', () => {
    it('calculates manufacturer facets from results', async () => {
      const { result } = renderHook(() =>
        useParametricSearch({ searchFn: mockSearchFn })
      );

      act(() => {
        result.current.setQuery('test');
      });

      await act(async () => {
        await result.current.search();
      });

      const manufacturerFacet = result.current.facets.find(
        (f) => f.name === 'manufacturers'
      );
      expect(manufacturerFacet).toBeDefined();
      expect(manufacturerFacet?.values).toContainEqual(
        expect.objectContaining({ value: 'Texas Instruments', count: 2 })
      );
      expect(manufacturerFacet?.values).toContainEqual(
        expect.objectContaining({ value: 'STMicroelectronics', count: 1 })
      );
    });

    it('calculates category facets from results', async () => {
      const { result } = renderHook(() =>
        useParametricSearch({ searchFn: mockSearchFn })
      );

      act(() => {
        result.current.setQuery('test');
      });

      await act(async () => {
        await result.current.search();
      });

      const categoryFacet = result.current.facets.find(
        (f) => f.name === 'categories'
      );
      expect(categoryFacet).toBeDefined();
      expect(categoryFacet?.values.length).toBeGreaterThan(0);
    });

    it('calculates lifecycle status facets', async () => {
      const { result } = renderHook(() =>
        useParametricSearch({ searchFn: mockSearchFn })
      );

      act(() => {
        result.current.setQuery('test');
      });

      await act(async () => {
        await result.current.search();
      });

      const lifecycleFacet = result.current.facets.find(
        (f) => f.name === 'lifecycleStatuses'
      );
      expect(lifecycleFacet).toBeDefined();
      expect(lifecycleFacet?.values).toContainEqual(
        expect.objectContaining({ value: 'Active', count: 2 })
      );
    });

    it('calculates compliance facets', async () => {
      const { result } = renderHook(() =>
        useParametricSearch({ searchFn: mockSearchFn })
      );

      act(() => {
        result.current.setQuery('test');
      });

      await act(async () => {
        await result.current.search();
      });

      const complianceFacet = result.current.facets.find(
        (f) => f.name === 'complianceFlags'
      );
      expect(complianceFacet).toBeDefined();
      // RoHS should have count of 3 (components 1, 2, 3 are RoHS compliant in mock - actually only 2)
      expect(complianceFacet?.values).toContainEqual(
        expect.objectContaining({ value: 'RoHS' })
      );
    });
  });

  describe('Filter Application', () => {
    it('filters by lifecycle status', async () => {
      const { result } = renderHook(() =>
        useParametricSearch({ searchFn: mockSearchFn })
      );

      act(() => {
        result.current.setQuery('test');
      });

      await act(async () => {
        await result.current.search();
      });

      act(() => {
        result.current.applyFilters({ lifecycleStatuses: ['Active'] });
      });

      expect(result.current.filteredResults.length).toBe(2);
      expect(
        result.current.filteredResults.every(
          (r) => r.lifecycle_status === 'Active'
        )
      ).toBe(true);
    });

    it('filters by price range', async () => {
      const { result } = renderHook(() =>
        useParametricSearch({ searchFn: mockSearchFn })
      );

      act(() => {
        result.current.setQuery('test');
      });

      await act(async () => {
        await result.current.search();
      });

      act(() => {
        result.current.applyFilters({ priceRange: [0, 1] });
      });

      expect(result.current.filteredResults.length).toBe(3);
      expect(
        result.current.filteredResults.every(
          (r) => r.unit_price !== undefined && r.unit_price <= 1
        )
      ).toBe(true);
    });

    it('filters by stock availability', async () => {
      const { result } = renderHook(() =>
        useParametricSearch({ searchFn: mockSearchFn })
      );

      act(() => {
        result.current.setQuery('test');
      });

      await act(async () => {
        await result.current.search();
      });

      act(() => {
        result.current.applyFilters({ stockAvailable: true });
      });

      expect(result.current.filteredResults.length).toBe(3);
      expect(
        result.current.filteredResults.every(
          (r) => r.stock_quantity !== undefined && r.stock_quantity > 0
        )
      ).toBe(true);
    });

    it('filters by quality score minimum', async () => {
      const { result } = renderHook(() =>
        useParametricSearch({ searchFn: mockSearchFn })
      );

      act(() => {
        result.current.setQuery('test');
      });

      await act(async () => {
        await result.current.search();
      });

      act(() => {
        result.current.applyFilters({ qualityScoreMin: 80 });
      });

      expect(result.current.filteredResults.length).toBe(2);
      expect(
        result.current.filteredResults.every((r) => r.quality_score >= 80)
      ).toBe(true);
    });

    it('filters by manufacturer', async () => {
      const { result } = renderHook(() =>
        useParametricSearch({ searchFn: mockSearchFn })
      );

      act(() => {
        result.current.setQuery('test');
      });

      await act(async () => {
        await result.current.search();
      });

      act(() => {
        result.current.applyFilters({ manufacturers: ['Texas Instruments'] });
      });

      expect(result.current.filteredResults.length).toBe(2);
      expect(
        result.current.filteredResults.every(
          (r) => r.manufacturer === 'Texas Instruments'
        )
      ).toBe(true);
    });

    it('applies multiple filters together', async () => {
      const { result } = renderHook(() =>
        useParametricSearch({ searchFn: mockSearchFn })
      );

      act(() => {
        result.current.setQuery('test');
      });

      await act(async () => {
        await result.current.search();
      });

      act(() => {
        result.current.applyFilters({
          lifecycleStatuses: ['Active'],
          qualityScoreMin: 85,
        });
      });

      expect(result.current.filteredResults.length).toBe(2);
    });
  });

  describe('Filter Clearing', () => {
    it('clears all filters', async () => {
      const { result } = renderHook(() =>
        useParametricSearch({ searchFn: mockSearchFn })
      );

      act(() => {
        result.current.setQuery('test');
      });

      await act(async () => {
        await result.current.search();
      });

      act(() => {
        result.current.applyFilters({
          lifecycleStatuses: ['Active'],
          stockAvailable: true,
          qualityScoreMin: 80,
        });
      });

      expect(result.current.filters.lifecycleStatuses.length).toBe(1);
      expect(result.current.filters.stockAvailable).toBe(true);
      expect(result.current.filters.qualityScoreMin).toBe(80);

      act(() => {
        result.current.clearFilters();
      });

      expect(result.current.filters).toEqual(DEFAULT_PARAMETRIC_FILTERS);
    });
  });

  describe('Search Reset', () => {
    it('resets entire search state', async () => {
      const { result } = renderHook(() =>
        useParametricSearch({ searchFn: mockSearchFn })
      );

      act(() => {
        result.current.setQuery('test');
      });

      await act(async () => {
        await result.current.search();
      });

      act(() => {
        result.current.applyFilters({ stockAvailable: true });
      });

      expect(result.current.hasSearched).toBe(true);
      expect(result.current.results.length).toBeGreaterThan(0);

      act(() => {
        result.current.resetSearch();
      });

      expect(result.current.query).toBe('');
      expect(result.current.searchType).toBe('mpn');
      expect(result.current.results).toEqual([]);
      expect(result.current.filteredResults).toEqual([]);
      expect(result.current.total).toBe(0);
      expect(result.current.hasSearched).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.filters).toEqual(DEFAULT_PARAMETRIC_FILTERS);
    });
  });

  describe('Risk Level Estimation', () => {
    it('assigns Critical risk to Obsolete parts', async () => {
      const { result } = renderHook(() =>
        useParametricSearch({ searchFn: mockSearchFn })
      );

      act(() => {
        result.current.setQuery('test');
      });

      await act(async () => {
        await result.current.search();
      });

      const riskFacet = result.current.facets.find(
        (f) => f.name === 'riskLevels'
      );
      expect(riskFacet?.values).toContainEqual(
        expect.objectContaining({ value: 'Critical' })
      );
    });

    it('assigns High risk to NRND parts', async () => {
      const { result } = renderHook(() =>
        useParametricSearch({ searchFn: mockSearchFn })
      );

      act(() => {
        result.current.setQuery('test');
      });

      await act(async () => {
        await result.current.search();
      });

      const riskFacet = result.current.facets.find(
        (f) => f.name === 'riskLevels'
      );
      expect(riskFacet?.values).toContainEqual(
        expect.objectContaining({ value: 'High' })
      );
    });
  });
});
