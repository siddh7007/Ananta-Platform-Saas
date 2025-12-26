/**
 * Component Search Page
 * CBP-P2-002: Parametric Component Search UI
 * Global search connected to Component Vault (CNS Catalog)
 */

import { useState, useCallback } from 'react';
import { useNavigation } from '@refinedev/core';
import { Search, Grid, List, SlidersHorizontal, Database } from 'lucide-react';
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
import { useDebounce } from '@/hooks/useDebounce';
import { useComponentSearch, type SearchFilters, type ComponentResult } from '@/hooks/useComponentSearch';
import { FilterPanel } from './components/FilterPanel';
import { SearchResults } from './components/SearchResults';

const SEARCH_TYPE_OPTIONS = [
  { value: 'all', label: 'All Fields', placeholder: 'Search across all fields (MPN, manufacturer, category, description)' },
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

export function ComponentSearchPage() {
  const { push } = useNavigation();
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<SearchType>('all');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [page, setPage] = useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const debouncedQuery = useDebounce(query, 300);

  const {
    data: results,
    isLoading,
    totalCount,
    facets,
    riskEnriched,
  } = useComponentSearch({
    query: debouncedQuery,
    searchType,
    filters,
    page,
    pageSize: 50,
  });

  const currentSearchOption = SEARCH_TYPE_OPTIONS.find((opt) => opt.value === searchType) || SEARCH_TYPE_OPTIONS[0];

  const handleFilterChange = useCallback((key: string, value: unknown) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1); // Reset to first page on filter change
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

  // Navigate to component detail page
  const handleViewDetails = useCallback((componentResult: ComponentResult) => {
    push(`/components/${componentResult.id}`);
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

  const activeFilterCount = Object.values(filters).filter(
    (v) => v !== undefined && v !== null && (Array.isArray(v) ? v.length > 0 : true)
  ).length;

  const currentSort = filters.sortBy
    ? `${filters.sortBy}_${filters.sortOrder || 'asc'}`
    : 'relevance';

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Desktop Filter Sidebar */}
      <aside className="hidden lg:block w-72 border-r bg-card overflow-y-auto">
        <FilterPanel
          facets={facets}
          filters={filters}
          onChange={handleFilterChange}
          onClear={handleClearFilters}
        />
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-4">
          {/* Search Header */}
          <div className="flex items-center gap-4">
            {/* Mobile Filter Toggle */}
            <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="lg:hidden">
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
                <FilterPanel
                  facets={facets}
                  filters={filters}
                  onChange={handleFilterChange}
                  onClear={handleClearFilters}
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
                  aria-label="Search components"
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
                  'Searching Component Vault...'
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
                    Component Vault
                  </Badge>
                  {riskEnriched && (
                    <Badge variant="secondary" className="text-xs">
                      Risk Data
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

export default ComponentSearchPage;
