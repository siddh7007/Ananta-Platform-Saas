/**
 * Alert Hooks
 * Custom hooks for alert data fetching and mutations
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import {
  getAlerts,
  getAlertStats,
  getAlert,
  markAlertAsRead,
  markAlertsAsRead,
  markAllAlertsAsRead,
  dismissAlert,
  dismissAlerts,
  acknowledgeAlert,
  snoozeAlert,
  getAlertPreferences,
  updateAlertPreferences,
  getWatchedComponents,
  watchComponent,
  unwatchComponent,
} from '@/services/alert.service';
import type {
  Alert,
  AlertStats,
  AlertPreferences,
  ComponentWatch,
  AlertFilters,
  AlertListResponse,
} from '@/types/alert';
import { apiLogger } from '@/lib/logger';

/**
 * Query keys for alert-related queries
 */
export const alertQueryKeys = {
  all: ['alerts'] as const,
  lists: () => [...alertQueryKeys.all, 'list'] as const,
  list: (filters?: AlertFilters) => [...alertQueryKeys.lists(), filters] as const,
  stats: () => [...alertQueryKeys.all, 'stats'] as const,
  detail: (id: string) => [...alertQueryKeys.all, 'detail', id] as const,
  preferences: () => [...alertQueryKeys.all, 'preferences'] as const,
  watches: () => [...alertQueryKeys.all, 'watches'] as const,
};

/**
 * Stale times for different alert data
 */
const STALE_TIMES = {
  ALERT_LIST: 1 * 60 * 1000,      // 1 minute - alerts update frequently
  ALERT_STATS: 2 * 60 * 1000,      // 2 minutes
  ALERT_DETAIL: 5 * 60 * 1000,     // 5 minutes
  PREFERENCES: 10 * 60 * 1000,     // 10 minutes
  WATCHES: 5 * 60 * 1000,          // 5 minutes
};

// ============================================
// Query Hooks
// ============================================

/**
 * Hook to fetch alerts list with filters
 */
export function useAlerts(
  filters?: AlertFilters,
  options?: Omit<UseQueryOptions<AlertListResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery<AlertListResponse>({
    queryKey: alertQueryKeys.list(filters),
    queryFn: () => getAlerts(filters),
    staleTime: STALE_TIMES.ALERT_LIST,
    placeholderData: (previousData) => previousData,
    ...options,
  });
}

/**
 * Hook to fetch alert statistics
 */
export function useAlertStats(
  options?: Omit<UseQueryOptions<AlertStats>, 'queryKey' | 'queryFn'>
) {
  return useQuery<AlertStats>({
    queryKey: alertQueryKeys.stats(),
    queryFn: getAlertStats,
    staleTime: STALE_TIMES.ALERT_STATS,
    ...options,
  });
}

/**
 * Hook to fetch a single alert
 */
export function useAlert(
  id: string,
  options?: Omit<UseQueryOptions<Alert>, 'queryKey' | 'queryFn'>
) {
  return useQuery<Alert>({
    queryKey: alertQueryKeys.detail(id),
    queryFn: () => getAlert(id),
    staleTime: STALE_TIMES.ALERT_DETAIL,
    enabled: !!id,
    ...options,
  });
}

/**
 * Hook to fetch alert preferences
 */
export function useAlertPreferences(
  options?: Omit<UseQueryOptions<AlertPreferences>, 'queryKey' | 'queryFn'>
) {
  return useQuery<AlertPreferences>({
    queryKey: alertQueryKeys.preferences(),
    queryFn: getAlertPreferences,
    staleTime: STALE_TIMES.PREFERENCES,
    ...options,
  });
}

/**
 * Hook to fetch watched components
 */
export function useWatchedComponents(
  options?: Omit<UseQueryOptions<ComponentWatch[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery<ComponentWatch[]>({
    queryKey: alertQueryKeys.watches(),
    queryFn: getWatchedComponents,
    staleTime: STALE_TIMES.WATCHES,
    ...options,
  });
}

// ============================================
// Mutation Hooks
// ============================================

/**
 * Hook to mark an alert as read
 */
export function useMarkAlertAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markAlertAsRead,
    onMutate: async (alertId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: alertQueryKeys.all });

      // Optimistically update the alert in cache
      const listQueries = queryClient.getQueriesData<AlertListResponse>({
        queryKey: alertQueryKeys.lists(),
      });

      const previousData: Array<[readonly unknown[], AlertListResponse | undefined]> = [];

      listQueries.forEach(([queryKey, data]) => {
        if (data) {
          previousData.push([queryKey, data]);
          const updatedData = {
            ...data,
            data: data.data.map((alert) =>
              alert.id === alertId
                ? { ...alert, status: 'read' as const, readAt: new Date().toISOString() }
                : alert
            ),
          };
          queryClient.setQueryData(queryKey, updatedData);
        }
      });

      // Update stats optimistically
      const statsKey = alertQueryKeys.stats();
      const previousStats = queryClient.getQueryData<AlertStats>(statsKey);
      if (previousStats && previousStats.unread > 0) {
        queryClient.setQueryData<AlertStats>(statsKey, {
          ...previousStats,
          unread: previousStats.unread - 1,
        });
      }

      return { previousData, previousStats };
    },
    onError: (_err, _alertId, context) => {
      // Rollback optimistic updates
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousStats) {
        queryClient.setQueryData(alertQueryKeys.stats(), context.previousStats);
      }
      apiLogger.error('Failed to mark alert as read');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: alertQueryKeys.all });
    },
  });
}

/**
 * Hook to mark multiple alerts as read
 */
export function useMarkAlertsAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markAlertsAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: alertQueryKeys.all });
      apiLogger.info('Alerts marked as read');
    },
  });
}

/**
 * Hook to mark all alerts as read
 */
export function useMarkAllAlertsAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markAllAlertsAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: alertQueryKeys.all });
      apiLogger.info('All alerts marked as read');
    },
  });
}

/**
 * Hook to dismiss an alert
 */
export function useDismissAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: dismissAlert,
    onMutate: async (alertId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: alertQueryKeys.all });

      // Remove from cache optimistically
      const listQueries = queryClient.getQueriesData<AlertListResponse>({
        queryKey: alertQueryKeys.lists(),
      });

      const previousData: Array<[readonly unknown[], AlertListResponse | undefined]> = [];

      listQueries.forEach(([queryKey, data]) => {
        if (data) {
          previousData.push([queryKey, data]);
          const updatedData = {
            ...data,
            data: data.data.filter((alert) => alert.id !== alertId),
            total: data.total - 1,
          };
          queryClient.setQueryData(queryKey, updatedData);
        }
      });

      return { previousData };
    },
    onError: (_err, _alertId, context) => {
      // Rollback optimistic updates
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      apiLogger.error('Failed to dismiss alert');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: alertQueryKeys.all });
    },
  });
}

/**
 * Hook to dismiss multiple alerts
 */
export function useDismissAlerts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: dismissAlerts,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: alertQueryKeys.all });
      apiLogger.info('Alerts dismissed');
    },
  });
}

/**
 * Hook to acknowledge an alert (mark as seen but keep visible)
 */
export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: acknowledgeAlert,
    onMutate: async (alertId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: alertQueryKeys.all });

      // Optimistically update the alert in cache
      const listQueries = queryClient.getQueriesData<AlertListResponse>({
        queryKey: alertQueryKeys.lists(),
      });

      const previousData: Array<[readonly unknown[], AlertListResponse | undefined]> = [];

      listQueries.forEach(([queryKey, data]) => {
        if (data) {
          previousData.push([queryKey, data]);
          const updatedData = {
            ...data,
            data: data.data.map((alert) =>
              alert.id === alertId
                ? { ...alert, status: 'acknowledged' as const, acknowledgedAt: new Date().toISOString() }
                : alert
            ),
          };
          queryClient.setQueryData(queryKey, updatedData);
        }
      });

      return { previousData };
    },
    onError: (_err, _alertId, context) => {
      // Rollback optimistic updates
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      apiLogger.error('Failed to acknowledge alert');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: alertQueryKeys.all });
    },
  });
}

/**
 * Hook to snooze an alert for specified number of days
 */
export function useSnoozeAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, days }: { id: string; days: number }) => snoozeAlert(id, days),
    onMutate: async ({ id: alertId, days }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: alertQueryKeys.all });

      // Optimistically update the alert in cache
      const listQueries = queryClient.getQueriesData<AlertListResponse>({
        queryKey: alertQueryKeys.lists(),
      });

      const previousData: Array<[readonly unknown[], AlertListResponse | undefined]> = [];
      const snoozedUntil = new Date();
      snoozedUntil.setDate(snoozedUntil.getDate() + days);

      listQueries.forEach(([queryKey, data]) => {
        if (data) {
          previousData.push([queryKey, data]);
          const updatedData = {
            ...data,
            data: data.data.map((alert) =>
              alert.id === alertId
                ? { ...alert, status: 'snoozed' as const, snoozedUntil: snoozedUntil.toISOString() }
                : alert
            ),
          };
          queryClient.setQueryData(queryKey, updatedData);
        }
      });

      return { previousData };
    },
    onError: (_err, _variables, context) => {
      // Rollback optimistic updates
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      apiLogger.error('Failed to snooze alert');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: alertQueryKeys.all });
    },
  });
}

/**
 * Hook to update alert preferences
 */
export function useUpdateAlertPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateAlertPreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: alertQueryKeys.preferences() });
      apiLogger.info('Alert preferences updated');
    },
  });
}

/**
 * Hook to watch a component
 */
export function useWatchComponent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ componentId, watchTypes }: { componentId: string; watchTypes: string[] }) =>
      watchComponent(componentId, watchTypes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: alertQueryKeys.watches() });
      apiLogger.info('Component added to watch list');
    },
  });
}

/**
 * Hook to unwatch a component
 */
export function useUnwatchComponent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: unwatchComponent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: alertQueryKeys.watches() });
      apiLogger.info('Component removed from watch list');
    },
  });
}

export default {
  useAlerts,
  useAlertStats,
  useAlert,
  useAlertPreferences,
  useWatchedComponents,
  useMarkAlertAsRead,
  useMarkAlertsAsRead,
  useMarkAllAlertsAsRead,
  useDismissAlert,
  useDismissAlerts,
  useAcknowledgeAlert,
  useSnoozeAlert,
  useUpdateAlertPreferences,
  useWatchComponent,
  useUnwatchComponent,
};
