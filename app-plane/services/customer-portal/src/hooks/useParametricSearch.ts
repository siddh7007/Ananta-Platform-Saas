/**
 * useParametricSearch Hook
 *
 * P1-1: Hook for managing parametric search with dynamic facets.
 * Provides search, filter, and facet state management with debouncing.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { ComponentFilterState } from '../pages/discovery/ComponentFilters';

/** Search type options */
export type SearchType = 'mpn' | 'manufacturer' | 'category' | 'description';

/** Component search result */
export interface ComponentSearchResult {
  id?: string;
  mpn: string;
  manufacturer: string;
  category: string;
  description: string;
  quality_score: number;
  enrichment_status: 'production' | 'staging' | 'rejected' | 'pending';
  data_sources: string[];
  last_updated: string;
  lifecycle_status?: string;
  unit_price?: number;
  stock_quantity?: number;
  lead_time_days?: number;
  rohs_compliant?: boolean;
  reach_compliant?: boolean;
  aec_qualified?: boolean;
  halogen_free?: boolean;
  image_url?: string;
  supplier?: string;
  risk_level?: 'Low' | 'Medium' | 'High' | 'Critical';
}

/** Facet value with count */
export interface FacetValue {
  value: string;
  label: string;
  count: number;
}

/** Search facet */
export interface SearchFacet {
  name: string;
  label: string;
  type: 'checkbox' | 'chip' | 'range' | 'toggle';
  values: FacetValue[];
}

/** Extended filter state with additional parametric fields */
export interface ParametricFilterState extends ComponentFilterState {
  stockAvailable: boolean;
  inProduction: boolean;
  qualityScoreMin: number;
  leadTimeDaysMax: number | null;
  categories: string[];
  manufacturers: string[];
}

/** Default parametric filter state */
export const DEFAULT_PARAMETRIC_FILTERS: ParametricFilterState = {
  suppliers: [],
  lifecycleStatuses: [],
  complianceFlags: [],
  priceRange: [0, 1000],
  riskLevels: [],
  stockAvailable: false,
  inProduction: false,
  qualityScoreMin: 0,
  leadTimeDaysMax: null,
  categories: [],
  manufacturers: [],
};

/** Search state */
export interface ParametricSearchState {
  query: string;
  searchType: SearchType;
  filters: ParametricFilterState;
  results: ComponentSearchResult[];
  filteredResults: ComponentSearchResult[];
  facets: SearchFacet[];
  loading: boolean;
  error: string | null;
  total: number;
  hasSearched: boolean;
}

/** Search actions */
export interface ParametricSearchActions {
  setQuery: (query: string) => void;
  setSearchType: (type: SearchType) => void;
  search: () => Promise<void>;
  applyFilters: (filters: Partial<ParametricFilterState>) => void;
  clearFilters: () => void;
  resetSearch: () => void;
}

export interface UseParametricSearchOptions {
  /** Initial query */
  initialQuery?: string;
  /** Initial search type */
  initialSearchType?: SearchType;
  /** Debounce delay for filter changes (ms) */
  debounceMs?: number;
  /** Auto-search on filter change */
  autoSearchOnFilterChange?: boolean;
  /** Search function (injectable for testing) */
  searchFn?: (params: {
    query: string;
    search_type: SearchType;
    limit: number;
  }) => Promise<{ results: ComponentSearchResult[]; total: number }>;
}

/**
 * Calculate facets from search results
 */
function calculateFacets(results: ComponentSearchResult[]): SearchFacet[] {
  // H3 Fix: Early return for empty results
  if (!results || results.length === 0) {
    return [];
  }

  const facets: SearchFacet[] = [];

  // Manufacturer facet
  const manufacturerCounts = new Map<string, number>();
  results.forEach((r) => {
    const mfr = r.manufacturer || 'Unknown';
    manufacturerCounts.set(mfr, (manufacturerCounts.get(mfr) || 0) + 1);
  });
  facets.push({
    name: 'manufacturers',
    label: 'Manufacturer',
    type: 'checkbox',
    values: Array.from(manufacturerCounts.entries())
      .map(([value, count]) => ({ value, label: value, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20), // Top 20 manufacturers
  });

  // Category facet
  const categoryCounts = new Map<string, number>();
  results.forEach((r) => {
    const cat = r.category || 'Uncategorized';
    categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
  });
  facets.push({
    name: 'categories',
    label: 'Category',
    type: 'checkbox',
    values: Array.from(categoryCounts.entries())
      .map(([value, count]) => ({ value, label: value, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15),
  });

  // Lifecycle status facet
  const lifecycleCounts = new Map<string, number>();
  results.forEach((r) => {
    const status = r.lifecycle_status || 'Unknown';
    lifecycleCounts.set(status, (lifecycleCounts.get(status) || 0) + 1);
  });
  facets.push({
    name: 'lifecycleStatuses',
    label: 'Lifecycle Status',
    type: 'chip',
    values: Array.from(lifecycleCounts.entries())
      .map(([value, count]) => ({ value, label: value, count }))
      .sort((a, b) => b.count - a.count),
  });

  // Supplier facet - H4 Fix: Deduplicate supplier + data_sources
  const supplierCounts = new Map<string, number>();
  results.forEach((r) => {
    const suppliers = new Set<string>(); // Use Set to deduplicate
    if (r.supplier) suppliers.add(r.supplier);
    r.data_sources?.forEach((source) => suppliers.add(source));

    // Increment count once per unique supplier per component
    suppliers.forEach((supplier) => {
      supplierCounts.set(supplier, (supplierCounts.get(supplier) || 0) + 1);
    });
  });
  if (supplierCounts.size > 0) {
    facets.push({
      name: 'suppliers',
      label: 'Supplier',
      type: 'checkbox',
      values: Array.from(supplierCounts.entries())
        .map(([value, count]) => ({ value, label: value, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
    });
  }

  // Risk level facet
  const riskCounts = new Map<string, number>();
  results.forEach((r) => {
    const risk = r.risk_level || estimateRiskLevel(r);
    riskCounts.set(risk, (riskCounts.get(risk) || 0) + 1);
  });
  facets.push({
    name: 'riskLevels',
    label: 'Risk Level',
    type: 'chip',
    values: ['Low', 'Medium', 'High', 'Critical']
      .filter((level) => riskCounts.has(level))
      .map((level) => ({
        value: level,
        label: level,
        count: riskCounts.get(level) || 0,
      })),
  });

  // Compliance facet
  const complianceCounts: Record<string, number> = {
    RoHS: 0,
    REACH: 0,
    'AEC-Q100': 0,
    'Halogen-Free': 0,
  };
  results.forEach((r) => {
    if (r.rohs_compliant) complianceCounts['RoHS']++;
    if (r.reach_compliant) complianceCounts['REACH']++;
    if (r.aec_qualified) complianceCounts['AEC-Q100']++;
    if (r.halogen_free) complianceCounts['Halogen-Free']++;
  });
  facets.push({
    name: 'complianceFlags',
    label: 'Compliance',
    type: 'checkbox',
    values: Object.entries(complianceCounts)
      .filter(([, count]) => count > 0)
      .map(([value, count]) => ({ value, label: value, count })),
  });

  // Stock availability facet (toggle)
  const inStock = results.filter(
    (r) => r.stock_quantity !== undefined && r.stock_quantity > 0
  ).length;
  if (inStock > 0) {
    facets.push({
      name: 'stockAvailable',
      label: 'In Stock',
      type: 'toggle',
      values: [{ value: 'true', label: `In Stock (${inStock})`, count: inStock }],
    });
  }

  return facets;
}

/**
 * Estimate risk level based on component data
 */
function estimateRiskLevel(component: ComponentSearchResult): string {
  const { lifecycle_status, quality_score, stock_quantity } = component;

  if (lifecycle_status === 'Obsolete' || lifecycle_status === 'EOL') {
    return 'Critical';
  }
  if (lifecycle_status === 'NRND') {
    return 'High';
  }
  if (quality_score !== undefined && quality_score < 50) {
    return 'High';
  }
  if (stock_quantity !== undefined && stock_quantity === 0) {
    return 'Medium';
  }
  if (quality_score !== undefined && quality_score < 70) {
    return 'Medium';
  }
  return 'Low';
}

/**
 * Apply filters to results
 */
function applyFiltersToResults(
  results: ComponentSearchResult[],
  filters: ParametricFilterState
): ComponentSearchResult[] {
  return results.filter((component) => {
    // Lifecycle filter
    if (
      filters.lifecycleStatuses.length > 0 &&
      !filters.lifecycleStatuses.includes(component.lifecycle_status || 'Unknown')
    ) {
      return false;
    }

    // Price filter
    if (component.unit_price !== undefined) {
      if (
        component.unit_price < filters.priceRange[0] ||
        component.unit_price > filters.priceRange[1]
      ) {
        return false;
      }
    }

    // Supplier filter
    if (filters.suppliers.length > 0) {
      const componentSuppliers = [
        component.supplier,
        ...(component.data_sources || []),
      ].filter(Boolean);
      if (!filters.suppliers.some((s) => componentSuppliers.includes(s))) {
        return false;
      }
    }

    // Risk level filter
    if (filters.riskLevels.length > 0) {
      const risk = component.risk_level || estimateRiskLevel(component);
      if (!filters.riskLevels.includes(risk)) {
        return false;
      }
    }

    // Compliance filter
    if (filters.complianceFlags.length > 0) {
      const hasRequired = filters.complianceFlags.every((flag) => {
        switch (flag) {
          case 'RoHS':
            return component.rohs_compliant;
          case 'REACH':
            return component.reach_compliant;
          case 'AEC-Q100':
          case 'AEC-Q200':
            return component.aec_qualified;
          case 'Halogen-Free':
            return component.halogen_free;
          default:
            return true;
        }
      });
      if (!hasRequired) return false;
    }

    // Stock availability filter
    if (
      filters.stockAvailable &&
      (component.stock_quantity === undefined || component.stock_quantity === 0)
    ) {
      return false;
    }

    // In production filter
    if (
      filters.inProduction &&
      component.lifecycle_status !== 'Active'
    ) {
      return false;
    }

    // Quality score filter
    if (
      filters.qualityScoreMin > 0 &&
      (component.quality_score === undefined ||
        component.quality_score < filters.qualityScoreMin)
    ) {
      return false;
    }

    // Lead time filter
    if (
      filters.leadTimeDaysMax !== null &&
      component.lead_time_days !== undefined &&
      component.lead_time_days > filters.leadTimeDaysMax
    ) {
      return false;
    }

    // Category filter
    if (
      filters.categories.length > 0 &&
      !filters.categories.includes(component.category || 'Uncategorized')
    ) {
      return false;
    }

    // Manufacturer filter
    if (
      filters.manufacturers.length > 0 &&
      !filters.manufacturers.includes(component.manufacturer || 'Unknown')
    ) {
      return false;
    }

    return true;
  });
}

/**
 * Hook for managing parametric search with dynamic facets
 */
export function useParametricSearch(
  options: UseParametricSearchOptions = {}
): ParametricSearchState & ParametricSearchActions {
  const {
    initialQuery = '',
    initialSearchType = 'mpn',
    debounceMs = 300,
    autoSearchOnFilterChange = false,
    searchFn,
  } = options;

  // Search state
  const [query, setQuery] = useState(initialQuery);
  const [searchType, setSearchType] = useState<SearchType>(initialSearchType);
  const [results, setResults] = useState<ComponentSearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Filter state
  const [filters, setFilters] = useState<ParametricFilterState>(
    DEFAULT_PARAMETRIC_FILTERS
  );

  // Debounce timer ref
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // C1 Fix: Search ref to avoid stale closure in debounce
  const searchRef = useRef<() => Promise<void>>();

  // Calculate facets from current results
  const facets = useMemo(() => calculateFacets(results), [results]);

  // Apply filters to results
  const filteredResults = useMemo(
    () => applyFiltersToResults(results, filters),
    [results, filters]
  );

  // Search function
  const search = useCallback(async () => {
    if (!query.trim()) {
      setError('Please enter a search term');
      return;
    }

    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      let response: { results: unknown[]; total: number };

      if (searchFn) {
        response = await searchFn({
          query,
          search_type: searchType,
          limit: 100,
        });
      } else {
        // H5 Fix: Separate import error handling
        let cnsClient;
        try {
          const module = await import('../services/cnsApi');
          cnsClient = module.cnsApi;
        } catch (importErr) {
          console.error('[Search] Failed to load CNS API module:', importErr);
          throw new Error('Search service unavailable. Please refresh the page.');
        }

        response = await cnsClient.searchComponentCatalog({
          query,
          search_type: searchType,
          limit: 100,
        });
      }

      // H2 Fix: Validate response structure
      if (!response || typeof response !== 'object') {
        throw new Error('Invalid API response structure');
      }

      const results = Array.isArray(response.results) ? response.results : [];
      const total = typeof response.total === 'number' ? response.total : results.length;

      // Validate each result has required fields
      const validResults = results.filter(
        (r): r is ComponentSearchResult =>
          r !== null &&
          typeof r === 'object' &&
          typeof (r as Record<string, unknown>).mpn === 'string' &&
          typeof (r as Record<string, unknown>).manufacturer === 'string'
      );

      if (validResults.length !== results.length) {
        console.warn(
          `[Search] Filtered ${results.length - validResults.length} invalid results`
        );
      }

      setResults(validResults);
      setTotal(total);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Search failed';
      setError(message);
      setResults([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [query, searchType, searchFn]);

  // C1 Fix: Keep searchRef updated to avoid stale closures
  useEffect(() => {
    searchRef.current = search;
  }, [search]);

  // Apply filters with optional debounce
  // C1 Fix: Use searchRef instead of search to avoid dependency recreation
  const applyFilters = useCallback(
    (newFilters: Partial<ParametricFilterState>) => {
      setFilters((prev) => ({ ...prev, ...newFilters }));

      if (autoSearchOnFilterChange && hasSearched) {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
        debounceRef.current = setTimeout(() => {
          searchRef.current?.();
        }, debounceMs);
      }
    },
    [autoSearchOnFilterChange, hasSearched, debounceMs]
  );

  // Clear filters
  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_PARAMETRIC_FILTERS);
  }, []);

  // Reset entire search
  const resetSearch = useCallback(() => {
    setQuery('');
    setSearchType('mpn');
    setResults([]);
    setTotal(0);
    setError(null);
    setHasSearched(false);
    setFilters(DEFAULT_PARAMETRIC_FILTERS);
  }, []);

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return {
    // State
    query,
    searchType,
    filters,
    results,
    filteredResults,
    facets,
    loading,
    error,
    total,
    hasSearched,
    // Actions
    setQuery,
    setSearchType,
    search,
    applyFilters,
    clearFilters,
    resetSearch,
  };
}

export default useParametricSearch;
