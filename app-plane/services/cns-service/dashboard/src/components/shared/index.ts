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

// GradeBadge
export { GradeBadge, GradeA, GradeB, GradeC, GradeD, GradeF } from './GradeBadge';
export type { GradeBadgeProps, Grade } from './GradeBadge';

// RiskIndicator
export {
  RiskIndicator,
  LowRisk,
  MediumRisk,
  HighRisk,
  CriticalRisk,
} from './RiskIndicator';
export type { RiskIndicatorProps, RiskLevel } from './RiskIndicator';

// StatusBadge
export {
  StatusBadge,
  EnrichmentStatusBadge,
  JobStatusBadge,
  WorkflowStatusBadge,
  LifecycleStatusBadge,
} from './StatusBadge';
export type { StatusBadgeProps, StatusType } from './StatusBadge';

// VirtualizedTable
export { VirtualizedTable } from './VirtualizedTable';
export type { VirtualizedTableProps, VirtualizedTableColumn } from './VirtualizedTable';

// ProtectedRoute (RBAC)
export { ProtectedRoute, useHasRole, withRoleProtection } from '../ProtectedRoute';
export type { default as ProtectedRouteProps } from '../ProtectedRoute';

// SafeChip - MUI Chip wrapper with automatic color validation
export { SafeChip, VALID_CHIP_COLORS, isValidChipColor, validateChipColor } from './SafeChip';
export type { SafeChipProps, ValidChipColor } from './SafeChip';
