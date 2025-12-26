/**
 * Component Search Hook
 * CBP-P2-002: Parametric Component Search - Connected to Component Vault (CNS Catalog)
 */

import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { cnsApi, searchWithTimeout, isTimeoutError } from '@/lib/axios';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface SearchFilters {
  // Scope filters (workspace/project/BOM context)
  workspaceId?: string;
  projectId?: string;
  bomId?: string;

  // Core filters
  categories?: string[];
  manufacturers?: string[];
  packages?: string[];

  // Lifecycle & Quality
  lifecycleStatuses?: ('active' | 'nrnd' | 'obsolete' | 'eol' | 'unknown')[];
  qualityScoreMin?: number;
  qualityScoreMax?: number;
  enrichmentStatus?: ('production' | 'staging' | 'rejected' | 'pending')[];

  // Compliance flags
  rohsCompliant?: boolean;
  reachCompliant?: boolean;
  aecQualified?: boolean;
  halogenFree?: boolean;

  // Supply chain
  inStockOnly?: boolean;
  leadTimeDaysMax?: number;
  priceMin?: number;
  priceMax?: number;
  moqMax?: number;

  // Data sources (suppliers)
  dataSources?: string[];

  // Risk
  riskLevels?: ('low' | 'medium' | 'high' | 'critical')[];
  includeRisk?: boolean;

  // Parametric (component-specific)
  capacitanceRange?: [number, number];
  resistanceRange?: [number, number];
  voltageRange?: [number, number];

  // Sort
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SearchFacet {
  value: string;
  label: string;
  count: number;
}

export interface SearchFacets {
  categories?: SearchFacet[];
  manufacturers?: SearchFacet[];
  packages?: SearchFacet[];
  lifecycleStatuses?: SearchFacet[];
  dataSources?: SearchFacet[];
}

export interface RiskInfo {
  total_risk_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical' | 'unknown';
  lifecycle_risk?: number;
  supply_chain_risk?: number;
  compliance_risk?: number;
  cached: boolean;
}

export interface ComponentResult {
  id: string;
  mpn: string;
  manufacturer: string;
  description: string;
  category: string;
  package?: string;

  // Stock & Availability
  inStock: boolean;
  stockQuantity?: number;
  leadTime?: number;

  // Pricing
  minPrice?: number;
  maxPrice?: number;
  currency?: string;
  moq?: number;

  // Lifecycle & Quality
  lifecycle: 'active' | 'nrnd' | 'obsolete' | 'eol' | 'unknown';
  qualityScore: number;
  enrichmentStatus: 'production' | 'staging' | 'rejected' | 'pending';

  // Compliance
  rohsCompliant?: boolean;
  reachCompliant?: boolean;
  aecQualified?: boolean;
  halogenFree?: boolean;

  // Data & Sources
  dataSources: string[];
  datasheetUrl?: string;
  imageUrl?: string;
  lastUpdated: string;

  // Risk (optional)
  risk?: RiskInfo;

  // Specs
  specs?: Record<string, string | number>;
}

export interface SearchResponse {
  results: ComponentResult[];
  totalCount: number;
  facets: SearchFacets;
  riskEnriched: boolean;
}

interface UseComponentSearchOptions {
  query: string;
  searchType?: 'all' | 'mpn' | 'manufacturer' | 'category' | 'description';
  filters: SearchFilters;
  page: number;
  pageSize: number;
  enabled?: boolean;
  /**
   * Organization ID (tenant ID) - required for My Components scoped search.
   * When provided along with workspaceId, uses /catalog/my-components endpoint
   * which queries bom_line_items instead of global component_catalog.
   */
  organizationId?: string | null;
}

// ============================================================================
// API Client Functions
// ============================================================================

// API response type with all extended fields
interface ApiComponentResult {
  mpn: string;
  manufacturer: string;
  category: string;
  description: string;
  quality_score: number;
  enrichment_status: string;
  data_sources: string[];
  last_updated: string;
  risk?: RiskInfo;
  component_id?: string;
  // Extended fields from server
  package?: string;
  subcategory?: string;
  lifecycle_status?: string;
  image_url?: string;
  datasheet_url?: string;
  model_3d_url?: string;
  rohs_compliant?: boolean;
  reach_compliant?: boolean;
  aec_qualified?: boolean;
  halogen_free?: boolean;
  unit_price?: number;
  currency?: string;
  moq?: number;
  lead_time_days?: number;
  stock_status?: string;
  stock_quantity?: number;
  in_stock?: boolean;
  specifications?: Record<string, unknown>;
}

interface ApiSearchResponse {
  results: ApiComponentResult[];
  total: number;
  risk_enriched: boolean;
  facets?: SearchFacets;
}

async function searchComponents(
  options: UseComponentSearchOptions,
  signal?: AbortSignal
): Promise<SearchResponse> {
  const { query, searchType = 'all', filters, page, pageSize, organizationId } = options;

  // Build query parameters - pass filters to server for server-side filtering
  const params = new URLSearchParams();

  // Determine if we should use browse or search endpoint
  const hasValidQuery = query && query.trim().length >= 2;

  // ============================================================================
  // Determine endpoint: My Components (scoped) vs Global Catalog
  // ============================================================================
  // If organizationId AND workspaceId are provided, use /catalog/my-components
  // which queries bom_line_items (user's components) instead of component_catalog
  const isMyComponentsMode = !!organizationId && !!filters.workspaceId;

  if (hasValidQuery) {
    params.set('query', query.trim());
    params.set('search_type', searchType);
  }
  params.set('limit', String(pageSize));
  params.set('offset', String((page - 1) * pageSize));

  // ============================================================================
  // Server-side filters - pass all filters as query parameters
  // ============================================================================

  // For My Components mode, organization_id is REQUIRED
  if (isMyComponentsMode && organizationId) {
    params.set('organization_id', organizationId);
  }

  // Workspace/Project/BOM scope filters
  if (filters.workspaceId && filters.workspaceId !== 'all') {
    params.set('workspace_id', filters.workspaceId);
  }
  if (filters.projectId && filters.projectId !== 'all') {
    params.set('project_id', filters.projectId);
  }
  if (filters.bomId && filters.bomId !== 'all') {
    params.set('bom_id', filters.bomId);
  }

  // Category filter
  if (filters.categories?.length) {
    filters.categories.forEach((cat) => params.append('categories', cat));
  }

  // Manufacturer filter
  if (filters.manufacturers?.length) {
    filters.manufacturers.forEach((mfg) => params.append('manufacturers', mfg));
  }

  // Package filter
  if (filters.packages?.length) {
    filters.packages.forEach((pkg) => params.append('packages', pkg));
  }

  // Lifecycle filter
  if (filters.lifecycleStatuses?.length) {
    filters.lifecycleStatuses.forEach((lc) => params.append('lifecycle_statuses', lc));
  }

  // Compliance filters
  if (filters.rohsCompliant !== undefined) {
    params.set('rohs_compliant', String(filters.rohsCompliant));
  }
  if (filters.reachCompliant !== undefined) {
    params.set('reach_compliant', String(filters.reachCompliant));
  }
  if (filters.aecQualified !== undefined) {
    params.set('aec_qualified', String(filters.aecQualified));
  }
  if (filters.halogenFree !== undefined) {
    params.set('halogen_free', String(filters.halogenFree));
  }

  // Stock filter
  if (filters.inStockOnly) {
    params.set('in_stock_only', 'true');
  }

  // Quality score range
  if (filters.qualityScoreMin !== undefined) {
    params.set('quality_score_min', String(filters.qualityScoreMin));
  }
  if (filters.qualityScoreMax !== undefined) {
    params.set('quality_score_max', String(filters.qualityScoreMax));
  }

  // Price range
  if (filters.priceMin !== undefined) {
    params.set('price_min', String(filters.priceMin));
  }
  if (filters.priceMax !== undefined) {
    params.set('price_max', String(filters.priceMax));
  }

  // Sort
  if (filters.sortBy) {
    params.set('sort_by', filters.sortBy);
  }
  if (filters.sortOrder) {
    params.set('sort_order', filters.sortOrder);
  }

  // Include risk if requested
  if (filters.includeRisk) {
    params.set('include_risk', 'true');
  }

  // Include facets (for filter sidebar)
  params.set('include_facets', 'true');

  try {
    // Determine endpoint based on mode:
    // - My Components mode: /catalog/my-components (queries bom_line_items)
    // - Global Catalog: /browse or /search (queries component_catalog)
    let endpoint: string;
    if (isMyComponentsMode) {
      // My Components page - query user's BOM line items
      endpoint = `/catalog/my-components?${params}`;
      console.log('[useComponentSearch] Using My Components endpoint with scope:', {
        organizationId,
        workspaceId: filters.workspaceId,
        projectId: filters.projectId,
        bomId: filters.bomId,
      });
    } else {
      // Global catalog search
      endpoint = hasValidQuery ? `/catalog/search?${params}` : `/catalog/browse?${params}`;
    }

    // Call CNS Catalog API with shorter search timeout (15s default) and abort signal
    const response = await searchWithTimeout<ApiSearchResponse>(cnsApi, endpoint, { signal });

    // Transform API response to our format with all extended fields
    const results: ComponentResult[] = response.data.results.map((item) => ({
      id: item.component_id || item.mpn,
      mpn: item.mpn,
      manufacturer: item.manufacturer,
      description: item.description,
      category: item.category,
      package: item.package,

      // Stock & Availability (now from server!)
      inStock: item.in_stock ?? (item.stock_quantity ? item.stock_quantity > 0 : false),
      stockQuantity: item.stock_quantity,
      leadTime: item.lead_time_days,

      // Pricing (now from server!)
      minPrice: item.unit_price,
      maxPrice: item.unit_price, // Same for now, price_breaks would need separate handling
      currency: item.currency,
      moq: item.moq,

      // Lifecycle & Quality
      lifecycle: mapLifecycleStatus(item.lifecycle_status || item.enrichment_status),
      qualityScore: item.quality_score,
      enrichmentStatus: item.enrichment_status as ComponentResult['enrichmentStatus'],

      // Compliance (now from server!)
      rohsCompliant: item.rohs_compliant,
      reachCompliant: item.reach_compliant,
      aecQualified: item.aec_qualified,
      halogenFree: item.halogen_free,

      // Data & Sources
      dataSources: item.data_sources,
      datasheetUrl: item.datasheet_url,
      imageUrl: item.image_url,
      lastUpdated: item.last_updated,

      // Risk
      risk: item.risk,

      // Specs
      specs: item.specifications as Record<string, string | number>,
    }));

    // Use facets from server response (server-side aggregation!)
    const facets: SearchFacets = response.data.facets ?? {
      categories: [],
      manufacturers: [],
      packages: [],
      lifecycleStatuses: [],
      dataSources: [],
    };

    return {
      results, // Already paginated by server
      totalCount: response.data.total, // Correct total from server
      facets, // Aggregated by server
      riskEnriched: response.data.risk_enriched,
    };
  } catch (error) {
    // Don't log or rethrow if the request was cancelled
    if (error instanceof Error && error.name === 'CanceledError') {
      throw error; // Let React Query handle the cancellation
    }

    // Enhanced error logging - distinguish timeout from other network errors
    if (isTimeoutError(error)) {
      console.error('[useComponentSearch] Search request timed out - consider optimizing filters or query');
    } else {
      console.error('[useComponentSearch] API call failed:', error);
    }

    // Fallback to mock data in development
    if (import.meta.env.DEV) {
      return getMockResults(query, filters);
    }
    throw error;
  }
}

// Map lifecycle status or enrichment status to lifecycle for display
function mapLifecycleStatus(status: string): ComponentResult['lifecycle'] {
  if (!status) return 'unknown';

  const normalized = status.toLowerCase();

  // Direct lifecycle statuses from database
  if (normalized === 'active') return 'active';
  if (normalized === 'nrnd' || normalized === 'not recommended') return 'nrnd';
  if (normalized === 'obsolete' || normalized === 'eol' || normalized === 'end of life') return 'obsolete';

  // Fallback: map enrichment status to lifecycle
  switch (normalized) {
    case 'production':
      return 'active';
    case 'staging':
      return 'active';
    case 'rejected':
      return 'obsolete';
    default:
      return 'unknown';
  }
}

// LEGACY: Client-side filters - only used for mock data fallback in development
// Server-side filtering is now implemented via query parameters in searchComponents()
function applyClientFilters(results: ComponentResult[], filters: SearchFilters): ComponentResult[] {
  let filtered = [...results];

  // Category filter
  if (filters.categories?.length) {
    filtered = filtered.filter((c) => filters.categories!.includes(c.category));
  }

  // Manufacturer filter
  if (filters.manufacturers?.length) {
    filtered = filtered.filter((c) => filters.manufacturers!.includes(c.manufacturer));
  }

  // Lifecycle filter
  if (filters.lifecycleStatuses?.length) {
    filtered = filtered.filter((c) => filters.lifecycleStatuses!.includes(c.lifecycle));
  }

  // Quality score filter
  if (filters.qualityScoreMin !== undefined) {
    filtered = filtered.filter((c) => c.qualityScore >= filters.qualityScoreMin!);
  }
  if (filters.qualityScoreMax !== undefined) {
    filtered = filtered.filter((c) => c.qualityScore <= filters.qualityScoreMax!);
  }

  // Stock filter
  if (filters.inStockOnly) {
    filtered = filtered.filter((c) => c.inStock);
  }

  // Enrichment status filter
  if (filters.enrichmentStatus?.length) {
    filtered = filtered.filter((c) => filters.enrichmentStatus!.includes(c.enrichmentStatus));
  }

  // Risk level filter
  if (filters.riskLevels?.length && filters.includeRisk) {
    filtered = filtered.filter((c) => c.risk && filters.riskLevels!.includes(c.risk.risk_level as any));
  }

  // Data source filter
  if (filters.dataSources?.length) {
    filtered = filtered.filter((c) =>
      c.dataSources.some((ds) => filters.dataSources!.includes(ds))
    );
  }

  return filtered;
}

// LEGACY: Build facets from search results - only used for mock data fallback
// Server now returns facets via the facets field in the API response
function buildFacets(results: ComponentResult[]): SearchFacets {
  const categoryMap = new Map<string, number>();
  const manufacturerMap = new Map<string, number>();
  const packageMap = new Map<string, number>();
  const lifecycleMap = new Map<string, number>();
  const dataSourceMap = new Map<string, number>();

  results.forEach((c) => {
    // Categories
    if (c.category) {
      categoryMap.set(c.category, (categoryMap.get(c.category) || 0) + 1);
    }

    // Manufacturers
    if (c.manufacturer) {
      manufacturerMap.set(c.manufacturer, (manufacturerMap.get(c.manufacturer) || 0) + 1);
    }

    // Packages
    if (c.package) {
      packageMap.set(c.package, (packageMap.get(c.package) || 0) + 1);
    }

    // Lifecycle
    lifecycleMap.set(c.lifecycle, (lifecycleMap.get(c.lifecycle) || 0) + 1);

    // Data sources
    c.dataSources.forEach((ds) => {
      dataSourceMap.set(ds, (dataSourceMap.get(ds) || 0) + 1);
    });
  });

  const toFacets = (map: Map<string, number>): SearchFacet[] =>
    Array.from(map.entries())
      .map(([value, count]) => ({ value, label: value, count }))
      .sort((a, b) => b.count - a.count);

  return {
    categories: toFacets(categoryMap),
    manufacturers: toFacets(manufacturerMap),
    packages: toFacets(packageMap),
    lifecycleStatuses: toFacets(lifecycleMap),
    dataSources: toFacets(dataSourceMap),
  };
}

// ============================================================================
// Mock Data (Development Fallback)
// ============================================================================

function getMockResults(query: string, filters: SearchFilters): SearchResponse {
  const MOCK_COMPONENTS: ComponentResult[] = [
    {
      id: '1',
      mpn: 'GRM188R71H104KA93D',
      manufacturer: 'Murata',
      description: '0.1µF 50V X7R 0603 Ceramic Capacitor',
      category: 'Capacitors',
      package: '0603',
      inStock: true,
      stockQuantity: 50000,
      lifecycle: 'active',
      qualityScore: 95,
      enrichmentStatus: 'production',
      dataSources: ['mouser', 'digikey'],
      lastUpdated: new Date().toISOString(),
      leadTime: 12,
      minPrice: 0.05,
      maxPrice: 0.08,
      rohsCompliant: true,
      reachCompliant: true,
      specs: { capacitance: 0.1, voltage: 50, tolerance: '10%' },
    },
    {
      id: '2',
      mpn: 'RC0603FR-0710KL',
      manufacturer: 'YAGEO',
      description: '10kΩ 1% 0603 Thick Film Resistor',
      category: 'Resistors',
      package: '0603',
      inStock: true,
      stockQuantity: 100000,
      lifecycle: 'active',
      qualityScore: 92,
      enrichmentStatus: 'production',
      dataSources: ['mouser', 'element14'],
      lastUpdated: new Date().toISOString(),
      leadTime: 8,
      minPrice: 0.01,
      maxPrice: 0.02,
      rohsCompliant: true,
      specs: { resistance: 10000, power: 0.1, tolerance: '1%' },
    },
    {
      id: '3',
      mpn: 'STM32F103C8T6',
      manufacturer: 'STMicroelectronics',
      description: 'ARM Cortex-M3 MCU, 64KB Flash, 72MHz',
      category: 'Integrated Circuits',
      package: 'LQFP-48',
      inStock: true,
      stockQuantity: 5000,
      lifecycle: 'active',
      qualityScore: 98,
      enrichmentStatus: 'production',
      dataSources: ['mouser', 'digikey', 'octopart'],
      lastUpdated: new Date().toISOString(),
      leadTime: 24,
      minPrice: 2.50,
      maxPrice: 4.20,
      rohsCompliant: true,
      reachCompliant: true,
      aecQualified: false,
      specs: { flash: 64, ram: 20, frequency: 72 },
    },
    {
      id: '4',
      mpn: 'LM7805CT',
      manufacturer: 'Texas Instruments',
      description: '5V 1.5A Linear Voltage Regulator',
      category: 'Power Management',
      package: 'TO-220',
      inStock: false,
      stockQuantity: 0,
      lifecycle: 'nrnd',
      qualityScore: 75,
      enrichmentStatus: 'staging',
      dataSources: ['digikey'],
      lastUpdated: new Date().toISOString(),
      leadTime: 52,
      minPrice: 0.45,
      maxPrice: 0.85,
      rohsCompliant: true,
      specs: { voltage: 5, current: 1.5 },
    },
    {
      id: '5',
      mpn: 'BAT54S',
      manufacturer: 'Nexperia',
      description: 'Dual Schottky Barrier Diode',
      category: 'Discrete Semiconductors',
      package: 'SOT-23',
      inStock: true,
      stockQuantity: 25000,
      lifecycle: 'active',
      qualityScore: 88,
      enrichmentStatus: 'production',
      dataSources: ['mouser', 'newark'],
      lastUpdated: new Date().toISOString(),
      leadTime: 10,
      minPrice: 0.08,
      maxPrice: 0.15,
      rohsCompliant: true,
      halogenFree: true,
      specs: { forward_voltage: 0.3, reverse_voltage: 30 },
    },
  ];

  // Apply filters
  let filtered = applyClientFilters(MOCK_COMPONENTS, filters);

  // Filter by query
  if (query) {
    const q = query.toLowerCase();
    filtered = filtered.filter(
      (c) =>
        c.mpn.toLowerCase().includes(q) ||
        c.manufacturer.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
    );
  }

  const facets = buildFacets(MOCK_COMPONENTS);

  return {
    results: filtered,
    totalCount: filtered.length,
    facets,
    riskEnriched: false,
  };
}

// ============================================================================
// Main Hook
// ============================================================================

export function useComponentSearch({
  query,
  searchType = 'all',
  filters,
  page,
  pageSize,
  enabled = true,
  organizationId,
}: UseComponentSearchOptions) {
  const queryKey = useMemo(
    () => ['component-search', query, searchType, JSON.stringify(filters), page, pageSize, organizationId],
    [query, searchType, filters, page, pageSize, organizationId]
  );

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: ({ signal }) => searchComponents({ query, searchType, filters, page, pageSize, organizationId }, signal),
    // Allow searching with any query (empty query searches for all components)
    enabled: enabled,
    staleTime: 30 * 1000,
    placeholderData: (previousData) => previousData,
  });

  return {
    data: data?.results ?? [],
    totalCount: data?.totalCount ?? 0,
    facets: data?.facets ?? {},
    riskEnriched: data?.riskEnriched ?? false,
    isLoading,
    error,
    refetch,
  };
}

export default useComponentSearch;
