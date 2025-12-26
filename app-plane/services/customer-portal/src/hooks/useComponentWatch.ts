/**
 * Component Watch Hooks
 *
 * Custom hooks for managing component watch functionality.
 * Allows users to watch components and receive alerts for changes.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  alertApi,
  ComponentWatch,
  ComponentWatchCreate,
  AlertType,
} from '../services/alertService';

export type WatchType = 'lifecycle' | 'risk' | 'price' | 'availability' | 'compliance' | 'supply_chain' | 'pcn';

/**
 * Map watch types to ComponentWatch boolean fields
 */
const WATCH_TYPE_FIELDS: Record<WatchType, keyof ComponentWatch> = {
  lifecycle: 'watch_lifecycle',
  risk: 'watch_risk',
  price: 'watch_price',
  availability: 'watch_availability',
  compliance: 'watch_compliance',
  supply_chain: 'watch_supply_chain',
  pcn: 'watch_lifecycle', // PCN alerts are part of lifecycle
};

/**
 * Options for useComponentWatches hook
 */
export interface UseComponentWatchesOptions {
  /** Automatically fetch on mount */
  autoFetch?: boolean;
  /** Component ID to filter by */
  componentId?: string;
}

/**
 * Return type for useComponentWatches hook
 */
export interface UseComponentWatchesReturn {
  watches: ComponentWatch[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  removeWatch: (watchId: string) => Promise<void>;
  removeWatchByComponentId: (componentId: string) => Promise<void>;
}

/**
 * Hook to fetch and manage all component watches for the current user
 */
export function useComponentWatches(
  options: UseComponentWatchesOptions = {}
): UseComponentWatchesReturn {
  const { autoFetch = true, componentId } = options;
  const [watches, setWatches] = useState<ComponentWatch[]>([]);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState<string | null>(null);

  const fetchWatches = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await alertApi.getWatches();

      // Filter by component ID if provided
      const filteredData = componentId
        ? data.filter(w => w.component_id === componentId)
        : data;

      setWatches(filteredData);
    } catch (err: any) {
      console.error('[useComponentWatches] Failed to fetch watches', err);
      setError(err.message || 'Failed to load component watches');
      setWatches([]);
    } finally {
      setLoading(false);
    }
  }, [componentId]);

  useEffect(() => {
    if (autoFetch) {
      fetchWatches();
    }
  }, [autoFetch, fetchWatches]);

  const removeWatch = useCallback(async (watchId: string) => {
    try {
      await alertApi.removeWatch(watchId);
      setWatches(prev => prev.filter(w => w.id !== watchId));
    } catch (err: any) {
      console.error('[useComponentWatches] Failed to remove watch', err);
      throw err;
    }
  }, []);

  const removeWatchByComponentId = useCallback(async (componentId: string) => {
    const watch = watches.find(w => w.component_id === componentId);
    if (watch) {
      await removeWatch(watch.id);
    }
  }, [watches, removeWatch]);

  return {
    watches,
    loading,
    error,
    refetch: fetchWatches,
    removeWatch,
    removeWatchByComponentId,
  };
}

/**
 * Return type for useIsWatched hook
 */
export interface UseIsWatchedReturn {
  isWatched: boolean;
  watch: ComponentWatch | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to check if a specific component is being watched
 */
export function useIsWatched(componentId: string | undefined): UseIsWatchedReturn {
  const { watches, loading, error } = useComponentWatches({
    autoFetch: !!componentId,
    componentId,
  });

  const watch = componentId ? watches.find(w => w.component_id === componentId) || null : null;
  const isWatched = watch !== null;

  return {
    isWatched,
    watch,
    loading,
    error,
  };
}

/**
 * Options for useAddWatch hook
 */
export interface UseAddWatchOptions {
  /** Callback on success */
  onSuccess?: (watch: ComponentWatch) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

/**
 * Return type for useAddWatch hook
 */
export interface UseAddWatchReturn {
  addWatch: (componentId: string, watchTypes: WatchType[]) => Promise<ComponentWatch>;
  adding: boolean;
  error: string | null;
}

/**
 * Hook to add a component watch
 */
export function useAddWatch(options: UseAddWatchOptions = {}): UseAddWatchReturn {
  const { onSuccess, onError } = options;
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addWatch = useCallback(async (
    componentId: string,
    watchTypes: WatchType[]
  ): Promise<ComponentWatch> => {
    try {
      setAdding(true);
      setError(null);

      // Create watch payload with selected types enabled
      const payload: ComponentWatchCreate = {
        component_id: componentId,
        watch_lifecycle: watchTypes.includes('lifecycle') || watchTypes.includes('pcn'),
        watch_risk: watchTypes.includes('risk'),
        watch_price: watchTypes.includes('price'),
        watch_availability: watchTypes.includes('availability'),
        watch_compliance: watchTypes.includes('compliance'),
        watch_supply_chain: watchTypes.includes('supply_chain'),
      };

      const watch = await alertApi.addWatch(payload);
      onSuccess?.(watch);
      return watch;
    } catch (err: any) {
      console.error('[useAddWatch] Failed to add watch', err);
      const error = new Error(err.message || 'Failed to add component watch');
      setError(error.message);
      onError?.(error);
      throw error;
    } finally {
      setAdding(false);
    }
  }, [onSuccess, onError]);

  return {
    addWatch,
    adding,
    error,
  };
}

/**
 * Return type for useRemoveWatch hook
 */
export interface UseRemoveWatchReturn {
  removeWatch: (watchId: string) => Promise<void>;
  removing: boolean;
  error: string | null;
}

/**
 * Hook to remove a component watch
 */
export function useRemoveWatch(options: UseAddWatchOptions = {}): UseRemoveWatchReturn {
  const { onSuccess, onError } = options;
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const removeWatch = useCallback(async (watchId: string) => {
    try {
      setRemoving(true);
      setError(null);
      await alertApi.removeWatch(watchId);
      onSuccess?.(undefined as any); // ComponentWatch not returned on delete
    } catch (err: any) {
      console.error('[useRemoveWatch] Failed to remove watch', err);
      const error = new Error(err.message || 'Failed to remove component watch');
      setError(error.message);
      onError?.(error);
      throw error;
    } finally {
      setRemoving(false);
    }
  }, [onSuccess, onError]);

  return {
    removeWatch,
    removing,
    error,
  };
}

/**
 * Options for useUpdateWatchTypes hook
 */
export interface UseUpdateWatchTypesOptions {
  /** Callback on success */
  onSuccess?: (watch: ComponentWatch) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

/**
 * Return type for useUpdateWatchTypes hook
 */
export interface UseUpdateWatchTypesReturn {
  updateWatchTypes: (watchId: string, componentId: string, watchTypes: WatchType[]) => Promise<ComponentWatch>;
  updating: boolean;
  error: string | null;
}

/**
 * Hook to update watch types for a component
 * (Since the API doesn't have an update endpoint, we remove and re-add)
 */
export function useUpdateWatchTypes(
  options: UseUpdateWatchTypesOptions = {}
): UseUpdateWatchTypesReturn {
  const { onSuccess, onError } = options;
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateWatchTypes = useCallback(async (
    watchId: string,
    componentId: string,
    watchTypes: WatchType[]
  ): Promise<ComponentWatch> => {
    try {
      setUpdating(true);
      setError(null);

      // Remove old watch
      await alertApi.removeWatch(watchId);

      // Create new watch with updated types
      const payload: ComponentWatchCreate = {
        component_id: componentId,
        watch_lifecycle: watchTypes.includes('lifecycle') || watchTypes.includes('pcn'),
        watch_risk: watchTypes.includes('risk'),
        watch_price: watchTypes.includes('price'),
        watch_availability: watchTypes.includes('availability'),
        watch_compliance: watchTypes.includes('compliance'),
        watch_supply_chain: watchTypes.includes('supply_chain'),
      };

      const watch = await alertApi.addWatch(payload);
      onSuccess?.(watch);
      return watch;
    } catch (err: any) {
      console.error('[useUpdateWatchTypes] Failed to update watch types', err);
      const error = new Error(err.message || 'Failed to update watch types');
      setError(error.message);
      onError?.(error);
      throw error;
    } finally {
      setUpdating(false);
    }
  }, [onSuccess, onError]);

  return {
    updateWatchTypes,
    updating,
    error,
  };
}

/**
 * Utility to get enabled watch types from a ComponentWatch
 */
export function getEnabledWatchTypes(watch: ComponentWatch): WatchType[] {
  const types: WatchType[] = [];

  if (watch.watch_lifecycle) types.push('lifecycle');
  if (watch.watch_risk) types.push('risk');
  if (watch.watch_price) types.push('price');
  if (watch.watch_availability) types.push('availability');
  if (watch.watch_compliance) types.push('compliance');
  if (watch.watch_supply_chain) types.push('supply_chain');

  return types;
}
