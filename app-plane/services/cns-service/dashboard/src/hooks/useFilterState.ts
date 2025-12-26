/**
 * useFilterState Hook
 *
 * Generic filter/search/sort state management with URL synchronization.
 * Maintains filter state in URL search params for shareable links and browser history.
 *
 * Features:
 * - Declarative filter configuration
 * - URL search params synchronization
 * - Debounced search input
 * - Pagination state
 * - Sort state
 * - Type-safe filter values
 *
 * @module hooks/useFilterState
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useDebouncedCallback } from './useDebounce';

// ============================================================
// Types
// ============================================================

/** Supported filter value types */
export type FilterValue = string | number | boolean | string[] | null;

/** Single filter field configuration */
export interface FilterFieldConfig<T extends FilterValue = FilterValue> {
  /** URL param name (defaults to key) */
  param?: string;
  /** Default value when not in URL */
  defaultValue: T;
  /** Parse URL string to typed value */
  parse?: (value: string | null) => T;
  /** Serialize typed value to URL string */
  serialize?: (value: T) => string | null;
  /** Validation function */
  validate?: (value: T) => boolean;
}

/** Filter configuration object */
export type FilterConfig<TFilters extends Record<string, FilterValue>> = {
  [K in keyof TFilters]: FilterFieldConfig<TFilters[K]>;
};

/** Sort direction */
export type SortDirection = 'asc' | 'desc';

/** Sort state */
export interface SortState {
  field: string;
  direction: SortDirection;
}

/** Pagination state */
export interface PaginationState {
  page: number;
  rowsPerPage: number;
}

/** Hook options */
export interface UseFilterStateOptions<TFilters extends Record<string, FilterValue>> {
  /** Filter field configurations */
  filters: FilterConfig<TFilters>;
  /** Initial sort field and direction */
  defaultSort?: SortState;
  /** Default rows per page */
  defaultRowsPerPage?: number;
  /** Available rows per page options */
  rowsPerPageOptions?: number[];
  /** Debounce delay for search input (ms) */
  searchDebounceMs?: number;
  /** Sync state to URL (default: true) */
  syncToUrl?: boolean;
  /** URL param prefix (e.g., 'filter_') */
  paramPrefix?: string;
}

/** Hook return type */
export interface UseFilterStateReturn<TFilters extends Record<string, FilterValue>> {
  // Filter state
  filters: TFilters;
  setFilter: <K extends keyof TFilters>(key: K, value: TFilters[K]) => void;
  setFilters: (updates: Partial<TFilters>) => void;
  resetFilters: () => void;
  hasActiveFilters: boolean;

  // Search state (convenience for common search pattern)
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  debouncedSearchQuery: string;

  // Sort state
  sort: SortState | null;
  setSort: (field: string, direction?: SortDirection) => void;
  toggleSort: (field: string) => void;
  clearSort: () => void;

  // Pagination state
  page: number;
  rowsPerPage: number;
  setPage: (page: number) => void;
  setRowsPerPage: (rowsPerPage: number) => void;
  handleChangePage: (event: unknown, newPage: number) => void;
  handleChangeRowsPerPage: (event: React.ChangeEvent<HTMLInputElement>) => void;

  // URL state
  getUrlParams: () => URLSearchParams;
  setFromUrl: (params: URLSearchParams) => void;

  // Reset all
  resetAll: () => void;
}

// ============================================================
// Default Parsers/Serializers
// ============================================================

/** Parse string to string (identity) */
function parseString(value: string | null): string {
  return value ?? '';
}

/** Parse string to number */
function parseNumber(value: string | null): number {
  if (value === null) return 0;
  const num = parseFloat(value);
  return Number.isFinite(num) ? num : 0;
}

/** Parse string to boolean */
function parseBoolean(value: string | null): boolean {
  return value === 'true' || value === '1';
}

/** Parse comma-separated string to array */
function parseArray(value: string | null): string[] {
  if (!value) return [];
  return value.split(',').filter(Boolean);
}

/** Serialize string (identity) */
function serializeString(value: string): string | null {
  return value || null;
}

/** Serialize number */
function serializeNumber(value: number): string | null {
  return value !== 0 ? String(value) : null;
}

/** Serialize boolean */
function serializeBoolean(value: boolean): string | null {
  return value ? 'true' : null;
}

/** Serialize array to comma-separated string */
function serializeArray(value: string[]): string | null {
  return value.length > 0 ? value.join(',') : null;
}

/** Get default parser for value type */
function getDefaultParser<T extends FilterValue>(defaultValue: T): (v: string | null) => T {
  if (typeof defaultValue === 'string') {
    return parseString as (v: string | null) => T;
  }
  if (typeof defaultValue === 'number') {
    return parseNumber as unknown as (v: string | null) => T;
  }
  if (typeof defaultValue === 'boolean') {
    return parseBoolean as unknown as (v: string | null) => T;
  }
  if (Array.isArray(defaultValue)) {
    return parseArray as unknown as (v: string | null) => T;
  }
  return ((v: string | null) => v ?? defaultValue) as (v: string | null) => T;
}

/** Get default serializer for value type */
function getDefaultSerializer<T extends FilterValue>(defaultValue: T): (v: T) => string | null {
  if (typeof defaultValue === 'string') {
    return serializeString as (v: T) => string | null;
  }
  if (typeof defaultValue === 'number') {
    return serializeNumber as unknown as (v: T) => string | null;
  }
  if (typeof defaultValue === 'boolean') {
    return serializeBoolean as unknown as (v: T) => string | null;
  }
  if (Array.isArray(defaultValue)) {
    return serializeArray as unknown as (v: T) => string | null;
  }
  return ((v: T) => (v != null ? String(v) : null)) as (v: T) => string | null;
}

// ============================================================
// Hook Implementation
// ============================================================

const DEFAULT_ROWS_PER_PAGE = 25;
const DEFAULT_SEARCH_DEBOUNCE_MS = 300;

export function useFilterState<TFilters extends Record<string, FilterValue>>(
  options: UseFilterStateOptions<TFilters>
): UseFilterStateReturn<TFilters> {
  const {
    filters: filterConfig,
    defaultSort = null,
    defaultRowsPerPage = DEFAULT_ROWS_PER_PAGE,
    rowsPerPageOptions = [10, 25, 50, 100],
    searchDebounceMs = DEFAULT_SEARCH_DEBOUNCE_MS,
    syncToUrl = true,
    paramPrefix = '',
  } = options;

  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Track if initial URL sync has been done
  const initializedRef = useRef(false);

  // ============================================================
  // Build Default Values
  // ============================================================

  const defaultFilters = useMemo((): TFilters => {
    const defaults = {} as TFilters;
    for (const key in filterConfig) {
      defaults[key] = filterConfig[key].defaultValue;
    }
    return defaults;
  }, [filterConfig]);

  // ============================================================
  // State
  // ============================================================

  const [filters, setFiltersState] = useState<TFilters>(defaultFilters);
  const [searchQuery, setSearchQueryState] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [sort, setSortState] = useState<SortState | null>(defaultSort);
  const [page, setPageState] = useState(0);
  const [rowsPerPage, setRowsPerPageState] = useState(defaultRowsPerPage);

  // ============================================================
  // Debounced Search
  // ============================================================

  const debouncedSetSearch = useDebouncedCallback((query: string) => {
    setDebouncedSearchQuery(query);
  }, searchDebounceMs);

  const setSearchQuery = useCallback(
    (query: string) => {
      setSearchQueryState(query);
      debouncedSetSearch(query);
      // Reset to first page on search
      setPageState(0);
    },
    [debouncedSetSearch]
  );

  // ============================================================
  // URL Sync Helpers
  // ============================================================

  /** Build URL params from current state */
  const getUrlParams = useCallback((): URLSearchParams => {
    const params = new URLSearchParams();

    // Filters
    for (const key in filterConfig) {
      const config = filterConfig[key];
      const value = filters[key];
      const paramName = `${paramPrefix}${config.param ?? key}`;
      const serialize = config.serialize ?? getDefaultSerializer(config.defaultValue);
      const serialized = serialize(value);

      // Only add if different from default
      if (serialized !== null && value !== config.defaultValue) {
        params.set(paramName, serialized);
      }
    }

    // Search
    if (searchQuery) {
      params.set(`${paramPrefix}q`, searchQuery);
    }

    // Sort
    if (sort && sort !== defaultSort) {
      params.set(`${paramPrefix}sort`, sort.field);
      params.set(`${paramPrefix}dir`, sort.direction);
    }

    // Pagination
    if (page > 0) {
      params.set(`${paramPrefix}page`, String(page));
    }
    if (rowsPerPage !== defaultRowsPerPage) {
      params.set(`${paramPrefix}limit`, String(rowsPerPage));
    }

    return params;
  }, [filters, filterConfig, searchQuery, sort, page, rowsPerPage, paramPrefix, defaultSort, defaultRowsPerPage]);

  /** Parse URL params to state */
  const setFromUrl = useCallback(
    (params: URLSearchParams) => {
      // Filters
      const newFilters = { ...defaultFilters };
      for (const key in filterConfig) {
        const config = filterConfig[key];
        const paramName = `${paramPrefix}${config.param ?? key}`;
        const urlValue = params.get(paramName);
        const parse = config.parse ?? getDefaultParser(config.defaultValue);
        const parsed = parse(urlValue);

        // Validate if validator provided
        if (config.validate && !config.validate(parsed)) {
          newFilters[key] = config.defaultValue;
        } else {
          newFilters[key] = urlValue !== null ? parsed : config.defaultValue;
        }
      }
      setFiltersState(newFilters);

      // Search
      const searchValue = params.get(`${paramPrefix}q`) ?? '';
      setSearchQueryState(searchValue);
      setDebouncedSearchQuery(searchValue);

      // Sort
      const sortField = params.get(`${paramPrefix}sort`);
      const sortDir = params.get(`${paramPrefix}dir`) as SortDirection | null;
      if (sortField) {
        setSortState({
          field: sortField,
          direction: sortDir === 'desc' ? 'desc' : 'asc',
        });
      } else {
        setSortState(defaultSort);
      }

      // Pagination
      const pageParam = params.get(`${paramPrefix}page`);
      const limitParam = params.get(`${paramPrefix}limit`);
      setPageState(pageParam ? parseInt(pageParam, 10) || 0 : 0);
      setRowsPerPageState(limitParam ? parseInt(limitParam, 10) || defaultRowsPerPage : defaultRowsPerPage);
    },
    [filterConfig, paramPrefix, defaultFilters, defaultSort, defaultRowsPerPage]
  );

  // ============================================================
  // URL Sync Effect
  // ============================================================

  // Initialize from URL on mount
  useEffect(() => {
    if (syncToUrl && !initializedRef.current) {
      setFromUrl(searchParams);
      initializedRef.current = true;
    }
  }, [syncToUrl, searchParams, setFromUrl]);

  // Sync state changes to URL
  useEffect(() => {
    if (!syncToUrl || !initializedRef.current) return;

    const newParams = getUrlParams();
    const currentParams = new URLSearchParams(location.search);

    // Only update if params actually changed
    const newStr = newParams.toString();
    const currentStr = currentParams.toString();

    if (newStr !== currentStr) {
      navigate(
        {
          pathname: location.pathname,
          search: newStr ? `?${newStr}` : '',
        },
        { replace: true }
      );
    }
  }, [syncToUrl, filters, searchQuery, sort, page, rowsPerPage, getUrlParams, navigate, location.pathname, location.search]);

  // ============================================================
  // Filter Actions
  // ============================================================

  const setFilter = useCallback(<K extends keyof TFilters>(key: K, value: TFilters[K]) => {
    setFiltersState((prev) => ({ ...prev, [key]: value }));
    // Reset to first page on filter change
    setPageState(0);
  }, []);

  const setFilters = useCallback((updates: Partial<TFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...updates }));
    // Reset to first page on filter change
    setPageState(0);
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState(defaultFilters);
    setPageState(0);
  }, [defaultFilters]);

  const hasActiveFilters = useMemo(() => {
    for (const key in filterConfig) {
      if (filters[key] !== filterConfig[key].defaultValue) {
        return true;
      }
    }
    return searchQuery.length > 0;
  }, [filters, filterConfig, searchQuery]);

  // ============================================================
  // Sort Actions
  // ============================================================

  const setSort = useCallback((field: string, direction: SortDirection = 'asc') => {
    setSortState({ field, direction });
  }, []);

  const toggleSort = useCallback((field: string) => {
    setSortState((prev) => {
      if (prev?.field === field) {
        // Toggle direction or clear if already desc
        return prev.direction === 'asc' ? { field, direction: 'desc' } : null;
      }
      return { field, direction: 'asc' };
    });
  }, []);

  const clearSort = useCallback(() => {
    setSortState(null);
  }, []);

  // ============================================================
  // Pagination Actions
  // ============================================================

  const setPage = useCallback((newPage: number) => {
    setPageState(newPage);
  }, []);

  const setRowsPerPage = useCallback((newRowsPerPage: number) => {
    setRowsPerPageState(newRowsPerPage);
    setPageState(0);
  }, []);

  const handleChangePage = useCallback((_event: unknown, newPage: number) => {
    setPageState(newPage);
  }, []);

  const handleChangeRowsPerPage = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newLimit = parseInt(event.target.value, 10);
    setRowsPerPageState(newLimit);
    setPageState(0);
  }, []);

  // ============================================================
  // Reset All
  // ============================================================

  const resetAll = useCallback(() => {
    setFiltersState(defaultFilters);
    setSearchQueryState('');
    setDebouncedSearchQuery('');
    setSortState(defaultSort);
    setPageState(0);
    setRowsPerPageState(defaultRowsPerPage);
  }, [defaultFilters, defaultSort, defaultRowsPerPage]);

  // ============================================================
  // Return
  // ============================================================

  return {
    // Filter state
    filters,
    setFilter,
    setFilters,
    resetFilters,
    hasActiveFilters,

    // Search state
    searchQuery,
    setSearchQuery,
    debouncedSearchQuery,

    // Sort state
    sort,
    setSort,
    toggleSort,
    clearSort,

    // Pagination state
    page,
    rowsPerPage,
    setPage,
    setRowsPerPage,
    handleChangePage,
    handleChangeRowsPerPage,

    // URL state
    getUrlParams,
    setFromUrl,

    // Reset all
    resetAll,
  };
}

// ============================================================
// Convenience Hook for Common Patterns
// ============================================================

/** Simple filter state without URL sync (for dialogs/modals) */
export function useLocalFilterState<TFilters extends Record<string, FilterValue>>(
  options: Omit<UseFilterStateOptions<TFilters>, 'syncToUrl'>
): UseFilterStateReturn<TFilters> {
  return useFilterState({ ...options, syncToUrl: false });
}

// ============================================================
// Pre-built Filter Configs
// ============================================================

/** Status filter config (common pattern) */
export function createStatusFilterConfig<T extends string>(
  options: T[],
  defaultValue: T = options[0]
): FilterFieldConfig<T> {
  return {
    defaultValue,
    validate: (value) => options.includes(value),
  };
}

/** Date range filter config */
export interface DateRange {
  start: string | null;
  end: string | null;
}

export function createDateRangeFilterConfig(defaultValue: DateRange = { start: null, end: null }): FilterFieldConfig<DateRange> {
  return {
    defaultValue,
    parse: (value) => {
      if (!value) return defaultValue;
      try {
        return JSON.parse(value) as DateRange;
      } catch {
        return defaultValue;
      }
    },
    serialize: (value) => {
      if (!value.start && !value.end) return null;
      return JSON.stringify(value);
    },
  };
}

/** Numeric range filter config */
export interface NumericRange {
  min: number | null;
  max: number | null;
}

export function createNumericRangeFilterConfig(defaultValue: NumericRange = { min: null, max: null }): FilterFieldConfig<NumericRange> {
  return {
    defaultValue,
    parse: (value) => {
      if (!value) return defaultValue;
      const [minStr, maxStr] = value.split('-');
      return {
        min: minStr ? parseFloat(minStr) : null,
        max: maxStr ? parseFloat(maxStr) : null,
      };
    },
    serialize: (value) => {
      if (value.min === null && value.max === null) return null;
      return `${value.min ?? ''}-${value.max ?? ''}`;
    },
  };
}
