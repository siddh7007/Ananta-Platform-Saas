/**
 * useComponentWatch Hook
 * Convenience hook for managing component watch state
 */

import { useMemo, useCallback } from 'react';
import { useWatchedComponents, useWatchComponent, useUnwatchComponent } from './useAlerts';
import type { AlertType, ComponentWatch } from '@/types/alert';

export interface UseComponentWatchOptions {
  componentId: string;
}

export interface UseComponentWatchResult {
  /** Whether the component is currently being watched */
  isWatched: boolean;
  /** The watch record if exists */
  watch: ComponentWatch | undefined;
  /** List of alert types being watched */
  watchTypes: AlertType[];
  /** Whether data is loading */
  isLoading: boolean;
  /** Whether a mutation is in progress */
  isMutating: boolean;
  /** Add component to watch list */
  addWatch: (types?: AlertType[]) => Promise<void>;
  /** Remove component from watch list */
  removeWatch: () => Promise<void>;
  /** Toggle watch state */
  toggleWatch: (types?: AlertType[]) => Promise<void>;
}

const DEFAULT_WATCH_TYPES: AlertType[] = [
  'LIFECYCLE',
  'RISK',
  'PRICE',
  'AVAILABILITY',
];

/**
 * Hook to manage watch state for a specific component
 */
export function useComponentWatch({
  componentId,
}: UseComponentWatchOptions): UseComponentWatchResult {
  const { data: watches = [], isLoading } = useWatchedComponents();
  const watchMutation = useWatchComponent();
  const unwatchMutation = useUnwatchComponent();

  // Find existing watch for this component
  const watch = useMemo(
    () => watches.find((w) => w.componentId === componentId),
    [watches, componentId]
  );

  const isWatched = !!watch;
  const watchTypes = watch?.watchTypes ?? [];
  const isMutating = watchMutation.isPending || unwatchMutation.isPending;

  const addWatch = useCallback(
    async (types: AlertType[] = DEFAULT_WATCH_TYPES) => {
      if (isWatched) return;
      await watchMutation.mutateAsync({
        componentId,
        watchTypes: types,
      });
    },
    [componentId, isWatched, watchMutation]
  );

  const removeWatch = useCallback(async () => {
    if (!watch) return;
    await unwatchMutation.mutateAsync(watch.id);
  }, [watch, unwatchMutation]);

  const toggleWatch = useCallback(
    async (types: AlertType[] = DEFAULT_WATCH_TYPES) => {
      if (isWatched) {
        await removeWatch();
      } else {
        await addWatch(types);
      }
    },
    [isWatched, addWatch, removeWatch]
  );

  return {
    isWatched,
    watch,
    watchTypes,
    isLoading,
    isMutating,
    addWatch,
    removeWatch,
    toggleWatch,
  };
}

/**
 * Hook to check if multiple components are watched
 */
export function useComponentsWatchStatus(componentIds: string[]) {
  const { data: watches = [], isLoading } = useWatchedComponents();

  const watchedIds = useMemo(() => {
    const idSet = new Set(componentIds);
    return watches
      .filter((w) => idSet.has(w.componentId))
      .reduce((acc, w) => {
        acc[w.componentId] = w;
        return acc;
      }, {} as Record<string, ComponentWatch>);
  }, [watches, componentIds]);

  return {
    watchedIds,
    isLoading,
    isWatched: (id: string) => !!watchedIds[id],
    getWatch: (id: string) => watchedIds[id],
  };
}

export default useComponentWatch;
