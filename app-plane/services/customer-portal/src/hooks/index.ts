/**
 * Tablet-Optimized Hooks
 * Custom React hooks for responsive tablet layouts
 */

export { useOrientation, useIsPortrait, useIsLandscape } from './useOrientation';
export type { Orientation, OrientationState } from './useOrientation';

export {
  useTouchDevice,
  useIsTablet,
  useIsMobile,
  useIsDesktop,
} from './useTouchDevice';
export type { TouchDeviceState } from './useTouchDevice';

export {
  useSafeAreaInsets,
  useSafeAreaInsetsCSS,
  useHasSafeAreaInsets,
} from './useSafeAreaInsets';
export type { SafeAreaInsets } from './useSafeAreaInsets';

export { useTabletNavigation } from './useTabletNavigation';
export type { TabletNavigationState } from './useTabletNavigation';

export { useSwipeActions, useSwipeDetection } from './useSwipeActions';
export type {
  SwipeDirection,
  SwipeAction,
  SwipeActionsConfig,
  SwipeState,
  UseSwipeActionsReturn,
} from './useSwipeActions';

// Column Mapping Hooks
export { useColumnSuggestions } from './useColumnSuggestions';
export type {
  UseColumnSuggestionsOptions,
  UseColumnSuggestionsResult,
} from './useColumnSuggestions';

export { useMappingTemplates } from './useMappingTemplates';
export type {
  UseMappingTemplatesOptions,
  UseMappingTemplatesResult,
} from './useMappingTemplates';

// Portfolio Dashboard Hooks
export { usePortfolioMetrics } from './usePortfolioMetrics';
export type {
  UsePortfolioMetricsOptions,
  UsePortfolioMetricsReturn,
} from './usePortfolioMetrics';

export { usePortfolioAlerts } from './usePortfolioAlerts';
export type {
  UsePortfolioAlertsOptions,
  UsePortfolioAlertsReturn,
} from './usePortfolioAlerts';

export { useRecentActivity } from './useRecentActivity';
export type {
  UseRecentActivityOptions,
  UseRecentActivityReturn,
} from './useRecentActivity';

export { usePortfolioExport } from './usePortfolioExport';
export type { UsePortfolioExportReturn } from './usePortfolioExport';

// Team Management Hooks
export { useTeamMembers } from './useTeamMembers';
export type {
  UseTeamMembersOptions,
  UseTeamMembersReturn,
} from './useTeamMembers';

// Component Watch Hooks
export {
  useComponentWatches,
  useIsWatched,
  useAddWatch,
  useRemoveWatch,
  useUpdateWatchTypes,
  getEnabledWatchTypes,
} from './useComponentWatch';
export type {
  WatchType,
  UseComponentWatchesOptions,
  UseComponentWatchesReturn,
  UseIsWatchedReturn,
  UseAddWatchOptions,
  UseAddWatchReturn,
  UseRemoveWatchReturn,
  UseUpdateWatchTypesOptions,
  UseUpdateWatchTypesReturn,
} from './useComponentWatch';
