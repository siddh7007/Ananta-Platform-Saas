/**
 * CNS Dashboard Shared Components
 *
 * Barrel export for all shared UI primitives
 */

// StatCard
export { StatCard } from './StatCard';
export type { StatCardProps } from './StatCard';

// QualityChip
export { QualityChip, ProductionChip, StagingChip, RejectedChip } from './QualityChip';
export type { QualityChipProps, QualityStatus } from './QualityChip';

// SupplierChip
export { SupplierChip, SupplierChips } from './SupplierChip';
export type { SupplierChipProps, SupplierChipsProps, SupplierName } from './SupplierChip';

// LoadingState
export {
  PageLoading,
  InlineSpinner,
  CardGridLoading,
  TableLoading,
  SectionLoading,
  StatCardsLoading,
} from './LoadingState';
export type {
  PageLoadingProps,
  InlineSpinnerProps,
  CardGridLoadingProps,
  TableLoadingProps,
  SectionLoadingProps,
  StatCardsLoadingProps,
} from './LoadingState';

// FilterToolbar
export { FilterToolbar } from './FilterToolbar';
export type { FilterToolbarProps, FilterConfig, FilterOption, FilterType } from './FilterToolbar';

// EmptyState
export {
  EmptyState,
  NoDataState,
  NoResultsState,
  UploadPromptState,
  ErrorState,
  SuccessState,
} from './EmptyState';
export type { EmptyStateProps, EmptyStateVariant } from './EmptyState';

// PageHeader
export { PageHeader } from './PageHeader';
export type { PageHeaderProps, BreadcrumbItem } from './PageHeader';

// ComponentDetailDialog
export { ComponentDetailDialog } from './ComponentDetailDialog';
export type { ComponentDetail, ComponentDetailDialogProps } from './ComponentDetailDialog';

// ErrorBoundary
export { ErrorBoundary, ModuleErrorBoundary } from './ErrorBoundary';
export type { ErrorBoundaryProps, ModuleErrorBoundaryProps } from './ErrorBoundary';

// LoadingSkeleton
export {
  TableRowSkeleton,
  CardSkeleton,
  DetailsSkeleton,
  QueueRowSkeleton,
  EnrichmentRowSkeleton,
} from './LoadingSkeleton';
export type {
  TableRowSkeletonProps,
  CardSkeletonProps,
  DetailsSkeletonProps,
  QueueRowSkeletonProps,
  EnrichmentRowSkeletonProps,
} from './LoadingSkeleton';
