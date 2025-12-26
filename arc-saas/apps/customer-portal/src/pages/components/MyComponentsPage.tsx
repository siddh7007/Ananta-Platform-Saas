/**
 * My Components Page
 * CBP-P2-003: User's BOM Components with Global Search UI
 * Same filters, table/card views, and detail navigation as Global Search
 * Scoped to user's workspace BOMs (projects and BOMs)
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigation, useList } from '@refinedev/core';
import { Search, Grid, List, SlidersHorizontal, Database, FolderOpen, FileSpreadsheet, Layers } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Toggle } from '@/components/ui/toggle';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { useDebounce } from '@/hooks/useDebounce';
import { useComponentSearch, type SearchFilters, type ComponentResult } from '@/hooks/useComponentSearch';
import { MyComponentVaultFilterPanel } from './components/MyComponentVaultFilterPanel';
import { SearchResults } from './components/SearchResults';
import { useTenantId } from '@/contexts/TenantContext';
import { useWorkspaceId, useCurrentWorkspace } from '@/contexts/WorkspaceContext';

// ============================================================================
// Constants
// ============================================================================

const SEARCH_TYPE_OPTIONS = [
  { value: 'all', label: 'All Fields', placeholder: 'Search your components (MPN, manufacturer, category, description)' },
  { value: 'mpn', label: 'MPN', placeholder: 'Search by part number (e.g., STM32F103)' },
  { value: 'manufacturer', label: 'Manufacturer', placeholder: 'Search by manufacturer name' },
  { value: 'category', label: 'Category', placeholder: 'Search by category (e.g., Capacitors)' },
  { value: 'description', label: 'Description', placeholder: 'Search component descriptions' },
] as const;

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'mpn_asc', label: 'MPN (A-Z)' },
  { value: 'mpn_desc', label: 'MPN (Z-A)' },
  { value: 'manufacturer_asc', label: 'Manufacturer (A-Z)' },
  { value: 'quality_desc', label: 'Quality (Highest)' },
  { value: 'price_asc', label: 'Price (Low to High)' },
  { value: 'price_desc', label: 'Price (High to Low)' },
  { value: 'leadtime_asc', label: 'Lead Time (Shortest)' },
];

type SearchType = 'all' | 'mpn' | 'manufacturer' | 'category' | 'description';

// ============================================================================
// Types for Projects and BOMs
// ============================================================================

interface Project {
  id: string;
  name: string;
  workspace_id: string;
}

interface BOM {
  id: string;
  name: string;
  project_id: string;
  version?: string;
}

// ============================================================================
// Main Component
// ============================================================================

export function MyComponentsPage() {
  const { push } = useNavigation();
  const tenantId = useTenantId();
  const workspaceId = useWorkspaceId();
  const currentWorkspace = useCurrentWorkspace();

  // Search state
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<SearchType>('all');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [page, setPage] = useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Scope state (project/BOM selection)
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedBomId, setSelectedBomId] = useState<string>('all');

  const debouncedQuery = useDebounce(query, 300);

  // Reset project and BOM selection when workspace changes
  useEffect(() => {
    setSelectedProjectId('all');
    setSelectedBomId('all');
    setPage(1);
  }, [workspaceId]);

  // ============================================================================
  // Fetch Projects and BOMs for Scope Selectors
  // ============================================================================

  // Fetch projects from CNS service - scoped to current workspace
  // NOTE: CNS service expects direct query params (organization_id, workspace_id), not LoopBack filters
  const { data: projectsData, isLoading: projectsLoading } = useList<Project>({
    resource: 'projects',
    dataProviderName: 'cns',
    meta: {
      // Pass query params directly for CNS FastAPI-style API
      queryParams: {
        organization_id: tenantId,
        workspace_id: workspaceId,
      },
    },
    pagination: { pageSize: 100 },
    queryOptions: {
      // Only fetch when we have a workspace selected
      enabled: !!workspaceId && !!tenantId,
    },
  });

  const projects = projectsData?.data ?? [];

  // Fetch BOMs based on selected project - scoped to current workspace
  // NOTE: CNS service expects direct query params (organization_id, workspace_id), not LoopBack filters
  const { data: bomsData, isLoading: bomsLoading } = useList<BOM>({
    resource: 'boms',
    dataProviderName: 'cns',
    meta: {
      // Pass query params directly for CNS FastAPI-style API
      queryParams: {
        organization_id: tenantId,
        workspace_id: workspaceId,
        ...(selectedProjectId !== 'all' ? { project_id: selectedProjectId } : {}),
      },
    },
    pagination: { pageSize: 100 },
    queryOptions: {
      // Only fetch when we have a workspace selected
      enabled: !!workspaceId && !!tenantId,
    },
  });

  const boms = bomsData?.data ?? [];

  // ============================================================================
  // Build filters with scope
  // ============================================================================

  const scopedFilters = useMemo((): SearchFilters => {
    const baseFilters = { ...filters };

    // Add workspace/project/BOM scope to filters
    // Workspace is always passed when available to scope the search
    if (workspaceId) {
      baseFilters.workspaceId = workspaceId;
    }
    if (selectedProjectId !== 'all') {
      baseFilters.projectId = selectedProjectId;
    }
    if (selectedBomId !== 'all') {
      baseFilters.bomId = selectedBomId;
    }

    return baseFilters;
  }, [filters, workspaceId, selectedProjectId, selectedBomId]);

  // ============================================================================
  // Search Hook with Scoped Filters
  // ============================================================================

  const {
    data: results,
    isLoading,
    totalCount,
    facets,
    riskEnriched,
  } = useComponentSearch({
    query: debouncedQuery,
    searchType,
    filters: scopedFilters,
    page,
    pageSize: 50,
    // Pass tenant ID as organization ID - this triggers My Components mode
    // which queries bom_line_items instead of global component_catalog
    organizationId: tenantId,
  });

  const currentSearchOption = SEARCH_TYPE_OPTIONS.find((opt) => opt.value === searchType) || SEARCH_TYPE_OPTIONS[0];

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleProjectChange = useCallback((projectId: string) => {
    setSelectedProjectId(projectId);
    setSelectedBomId('all'); // Reset BOM selection when project changes
    setPage(1);
  }, []);

  const handleBomChange = useCallback((bomId: string) => {
    setSelectedBomId(bomId);
    setPage(1);
  }, []);

  const handleFilterChange = useCallback((key: string, value: unknown) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({});
    setPage(1);
  }, []);

  const handleCompare = useCallback(
    (ids: string[]) => {
      push(`/components/compare?ids=${ids.join(',')}`);
    },
    [push]
  );

  const handleViewDetails = useCallback((componentResult: ComponentResult) => {
    // Add source=my-components to indicate this is a BOM line item, not a catalog component
    push(`/components/${componentResult.id}?source=my-components`);
  }, [push]);

  const handleSortChange = useCallback((value: string) => {
    const [field, order] = value.split('_');
    if (value === 'relevance') {
      setFilters((prev) => {
        const { sortBy, sortOrder, ...rest } = prev;
        return rest;
      });
    } else {
      setFilters((prev) => ({
        ...prev,
        sortBy: field,
        sortOrder: (order as 'asc' | 'desc') || 'asc',
      }));
    }
  }, []);

  // ============================================================================
  // Computed Values
  // ============================================================================

  const activeFilterCount = Object.values(filters).filter(
    (v) => v !== undefined && v !== null && (Array.isArray(v) ? v.length > 0 : true)
  ).length;

  const currentSort = filters.sortBy
    ? `${filters.sortBy}_${filters.sortOrder || 'asc'}`
    : 'relevance';

  const hasScopeSelected = selectedProjectId !== 'all' || selectedBomId !== 'all';

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Desktop Filter Sidebar */}
      <aside className="hidden lg:block w-72 border-r bg-card overflow-y-auto">
        <MyComponentVaultFilterPanel
          facets={facets}
          filters={filters}
          onChange={handleFilterChange}
          onClear={handleClearFilters}
          workspaceName={currentWorkspace?.name}
        />
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-4">
          {/* Page Header */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">My Components</h1>
                {currentWorkspace && (
                  <Badge variant="outline" className="text-xs">
                    <Layers className="h-3 w-3 mr-1" />
                    {currentWorkspace.name}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Browse and search components from your BOMs{currentWorkspace ? ` in ${currentWorkspace.name}` : ''}
              </p>
            </div>
          </div>

          {/* Scope Selectors (Project/BOM) */}
          <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-muted/50 border">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Scope:</span>
            </div>

            {/* Project Selector */}
            <Select value={selectedProjectId} onValueChange={handleProjectChange}>
              <SelectTrigger className="w-[200px]" aria-label="Select project">
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* BOM Selector */}
            <Select value={selectedBomId} onValueChange={handleBomChange}>
              <SelectTrigger className="w-[200px]" aria-label="Select BOM">
                <FileSpreadsheet className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="All BOMs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All BOMs</SelectItem>
                {boms.map((bom) => (
                  <SelectItem key={bom.id} value={bom.id}>
                    {bom.name}{bom.version ? ` (v${bom.version})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasScopeSelected && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedProjectId('all');
                  setSelectedBomId('all');
                  setPage(1);
                }}
              >
                Clear Scope
              </Button>
            )}
          </div>

          <Separator />

          {/* Search Header */}
          <div className="flex items-center gap-4">
            {/* Mobile Filter Toggle */}
            <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="lg:hidden relative">
                  <SlidersHorizontal className="h-4 w-4" />
                  <span className="sr-only">Toggle filters</span>
                  {activeFilterCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 p-0">
                <MyComponentVaultFilterPanel
                  facets={facets}
                  filters={filters}
                  onChange={handleFilterChange}
                  onClear={handleClearFilters}
                  workspaceName={currentWorkspace?.name}
                />
              </SheetContent>
            </Sheet>

            {/* Search Type Selector + Search Input */}
            <div className="flex flex-1 gap-2">
              <Select value={searchType} onValueChange={(v) => setSearchType(v as SearchType)}>
                <SelectTrigger className="w-[140px]" aria-label="Search type">
                  <SelectValue placeholder="Search by..." />
                </SelectTrigger>
                <SelectContent>
                  {SEARCH_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="relative flex-1">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={currentSearchOption.placeholder}
                  className="pl-10"
                  aria-label="Search my components"
                />
              </div>
            </div>

            {/* View Toggle */}
            <div className="flex items-center gap-1 border rounded-md p-1">
              <Toggle
                pressed={viewMode === 'list'}
                onPressedChange={() => setViewMode('list')}
                aria-label="List view"
                className="h-8 w-8 p-0"
              >
                <List className="h-4 w-4" />
              </Toggle>
              <Toggle
                pressed={viewMode === 'grid'}
                onPressedChange={() => setViewMode('grid')}
                aria-label="Grid view"
                className="h-8 w-8 p-0"
              >
                <Grid className="h-4 w-4" />
              </Toggle>
            </div>
          </div>

          {/* Results Count & Sort */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground">
                {isLoading ? (
                  'Searching your components...'
                ) : (
                  <>
                    <span className="font-medium">{totalCount.toLocaleString()}</span> components
                    found
                  </>
                )}
              </p>
              {!isLoading && (
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-xs">
                    <Database className="h-3 w-3 mr-1" />
                    My Components
                  </Badge>
                  {riskEnriched && (
                    <Badge variant="secondary" className="text-xs">
                      Risk Data
                    </Badge>
                  )}
                  {hasScopeSelected && (
                    <Badge variant="secondary" className="text-xs">
                      Filtered
                    </Badge>
                  )}
                </div>
              )}
            </div>
            <Select value={currentSort} onValueChange={handleSortChange}>
              <SelectTrigger className="w-[180px]" aria-label="Sort results">
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Results */}
          <SearchResults
            results={results}
            isLoading={isLoading}
            viewMode={viewMode}
            onCompare={handleCompare}
            onViewDetails={handleViewDetails}
            page={page}
            totalCount={totalCount}
            pageSize={50}
            onPageChange={setPage}
          />
        </div>
      </main>
    </div>
  );
}

export default MyComponentsPage;
