/**
 * Shared Components - Barrel Export
 */

// Error handling
export { ErrorBoundary } from './ErrorBoundary';
export { RouteErrorBoundary, withRouteErrorBoundary } from './RouteErrorBoundary';

// Loading states
export { LoadingSpinner, PageLoading, InlineLoading, LoadingOverlay } from './LoadingSpinner';
export {
  TableSkeleton,
  CardGridSkeleton,
  BomListSkeleton,
  ComponentListSkeleton,
  TeamListSkeleton,
  InvoiceListSkeleton,
  PageSkeleton,
  SettingsSkeleton,
} from './ListSkeletons';

// Search
export { GlobalSearch, GlobalSearchTrigger } from './GlobalSearch';

// Error screens
export { TenantErrorScreen } from './TenantErrorScreen';

// Stats and metrics
export {
  StatCard,
  StatCardGrid,
  BOMCountStat,
  ComponentCountStat,
  RiskScoreStat,
  CostStat,
} from './StatCard';
export type { StatCardProps, StatCardGridProps } from './StatCard';

// Page transitions
export {
  PageTransition,
  usePageTransition,
  PAGE_TRANSITIONS,
  getTransitionClasses,
} from './PageTransition';
export type { AnimationVariant, AnimationDuration, TransitionState, PageTransitionProps } from './PageTransition';

// Empty states
export {
  EmptyState,
  NoResultsState,
  ErrorState,
  NoPermissionState,
  NoBOMsState,
  NoComponentsState,
  NoFilteredResultsState,
} from './EmptyState';
export type {
  EmptyStateProps,
  EmptyStateAction,
  EmptyStateVariant,
  EmptyStateSize,
} from './EmptyState';

// Permission guards
export {
  PermissionGuard,
  AdminOnly,
  OwnerOnly,
  EngineerOnly,
  SuperAdminOnly,
  CanEditBOM,
  CanCreateBOM,
  CanDeleteBOM,
  CanManageTeam,
  CanAccessBilling,
  CanManageSettings,
  withPermission,
} from './PermissionGuard';
export type { PermissionGuardProps } from './PermissionGuard';
