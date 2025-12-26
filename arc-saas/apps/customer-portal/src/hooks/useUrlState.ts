/**
 * URL State Persistence Hook
 * Syncs filter/search state with URL query parameters for shareable links and back/forward navigation
 */

import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

type StateValue = string | number | boolean | string[] | null;

interface UseUrlStateOptions<T> {
  /** Default value when not present in URL */
  defaultValue: T;
  /** Custom serializer for the value */
  serialize?: (value: T) => string;
  /** Custom deserializer for the value */
  deserialize?: (value: string) => T;
}

/**
 * Hook for syncing a single value with URL query params
 */
export function useUrlState<T extends StateValue>(
  key: string,
  options: UseUrlStateOptions<T>
): [T, (value: T) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const { defaultValue, serialize, deserialize } = options;

  // Get current value from URL
  const value = useMemo(() => {
    const param = searchParams.get(key);
    if (param === null) return defaultValue;

    if (deserialize) {
      return deserialize(param);
    }

    // Default deserialization based on type
    if (typeof defaultValue === 'boolean') {
      return (param === 'true') as T;
    }
    if (typeof defaultValue === 'number') {
      const num = Number(param);
      return (isNaN(num) ? defaultValue : num) as T;
    }
    if (Array.isArray(defaultValue)) {
      return (param ? param.split(',') : []) as T;
    }
    return param as T;
  }, [searchParams, key, defaultValue, deserialize]);

  // Set value and update URL
  const setValue = useCallback(
    (newValue: T) => {
      setSearchParams((prev) => {
        const newParams = new URLSearchParams(prev);

        // Remove param if value equals default or is empty
        const isEmpty =
          newValue === defaultValue ||
          newValue === null ||
          newValue === '' ||
          (Array.isArray(newValue) && newValue.length === 0);

        if (isEmpty) {
          newParams.delete(key);
        } else {
          let serialized: string;
          if (serialize) {
            serialized = serialize(newValue);
          } else if (Array.isArray(newValue)) {
            serialized = newValue.join(',');
          } else {
            serialized = String(newValue);
          }
          newParams.set(key, serialized);
        }

        return newParams;
      }, { replace: true });
    },
    [key, defaultValue, serialize, setSearchParams]
  );

  return [value, setValue];
}

/**
 * Hook for managing multiple URL state values at once
 */
export function useUrlStates<T extends Record<string, StateValue>>(
  defaults: T
): [T, (updates: Partial<T>) => void, () => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  // Get all current values
  const values = useMemo(() => {
    const result = { ...defaults } as Record<string, StateValue>;

    for (const key of Object.keys(defaults)) {
      const param = searchParams.get(key);
      if (param === null) continue;

      const defaultVal = (defaults as Record<string, StateValue>)[key];

      if (typeof defaultVal === 'boolean') {
        result[key] = param === 'true';
      } else if (typeof defaultVal === 'number') {
        const num = Number(param);
        if (!isNaN(num)) {
          result[key] = num;
        }
      } else if (Array.isArray(defaultVal)) {
        result[key] = param ? param.split(',') : [];
      } else {
        result[key] = param;
      }
    }

    return result as T;
  }, [searchParams, defaults]);

  // Update multiple values
  const setValues = useCallback(
    (updates: Partial<T>) => {
      setSearchParams((prev) => {
        const newParams = new URLSearchParams(prev);

        for (const [key, value] of Object.entries(updates)) {
          const defaultVal = (defaults as Record<string, StateValue>)[key];
          const isEmpty =
            value === defaultVal ||
            value === null ||
            value === '' ||
            (Array.isArray(value) && value.length === 0);

          if (isEmpty) {
            newParams.delete(key);
          } else if (Array.isArray(value)) {
            newParams.set(key, value.join(','));
          } else {
            newParams.set(key, String(value));
          }
        }

        return newParams;
      }, { replace: true });
    },
    [defaults, setSearchParams]
  );

  // Reset all values to defaults
  const resetValues = useCallback(() => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      for (const key of Object.keys(defaults)) {
        newParams.delete(key);
      }
      return newParams;
    }, { replace: true });
  }, [defaults, setSearchParams]);

  return [values, setValues, resetValues];
}

/**
 * Common filter state for list pages
 */
export interface ListFilterState {
  search: string;
  status: string;
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  [key: string]: StateValue;
}

const DEFAULT_LIST_FILTERS: ListFilterState = {
  search: '',
  status: '',
  page: 1,
  limit: 20,
  sortBy: 'created_at',
  sortOrder: 'desc',
};

/**
 * Pre-configured hook for common list page filtering
 */
export function useListFilters(
  overrides: Partial<ListFilterState> = {}
): [ListFilterState, (updates: Partial<ListFilterState>) => void, () => void] {
  const defaults = { ...DEFAULT_LIST_FILTERS, ...overrides } as ListFilterState;
  return useUrlStates<ListFilterState>(defaults);
}

/**
 * Hook for BOM list specific filters
 */
export interface BomFilterState extends ListFilterState {
  enrichmentStatus: string;
  [key: string]: StateValue;
}

export function useBomFilters(): [
  BomFilterState,
  (updates: Partial<BomFilterState>) => void,
  () => void
] {
  return useUrlStates<BomFilterState>({
    search: '',
    status: '',
    enrichmentStatus: '',
    page: 1,
    limit: 20,
    sortBy: 'created_at',
    sortOrder: 'desc',
  });
}

/**
 * Hook for component catalog specific filters
 */
export interface ComponentFilterState extends ListFilterState {
  manufacturer: string;
  category: string;
  lifecycle: string;
  [key: string]: StateValue;
}

export function useComponentFilters(): [
  ComponentFilterState,
  (updates: Partial<ComponentFilterState>) => void,
  () => void
] {
  return useUrlStates<ComponentFilterState>({
    search: '',
    status: '',
    manufacturer: '',
    category: '',
    lifecycle: '',
    page: 1,
    limit: 20,
    sortBy: 'mpn',
    sortOrder: 'asc',
  });
}

/**
 * Hook for team member list filters
 */
export interface TeamFilterState {
  search: string;
  role: string;
  status: string;
  [key: string]: StateValue;
}

export function useTeamFilters(): [
  TeamFilterState,
  (updates: Partial<TeamFilterState>) => void,
  () => void
] {
  return useUrlStates<TeamFilterState>({
    search: '',
    role: '',
    status: '',
  });
}
