/**
 * Shared Components
 *
 * Reusable UI primitives built with MUI and theme tokens.
 * Import from '@/components/shared' for consistent usage.
 */

// MetricCard - Dashboard stats display
export { MetricCard } from './MetricCard';
export type { MetricCardProps, MetricColorKey, TrendDirection } from './MetricCard';

// StatusChip - Semantic status badges
export {
  StatusChip,
  RiskChip,
  GradeChip,
  WorkflowChip,
  AlertTypeChip,
  SeverityChip,
} from './StatusChip';
export type {
  StatusChipProps,
  StatusType,
  RiskLevel,
  Grade,
  WorkflowStatus,
  AlertType,
  AlertSeverity,
} from './StatusChip';

// LoadingState - Loading indicators
export {
  LoadingState,
  PageLoading,
  CardGridLoading,
  TableLoading,
  InlineSpinner,
} from './LoadingState';
export type { LoadingStateProps, LoadingVariant } from './LoadingState';

// FilterToolbar - Unified filter bar
export { FilterToolbar } from './FilterToolbar';
export type {
  FilterToolbarProps,
  FilterConfig,
  FilterOption,
  FilterValues,
} from './FilterToolbar';

// NextActionDrawer - Action panel drawer
export { NextActionDrawer } from './NextActionDrawer';
export type { NextActionDrawerProps } from './NextActionDrawer';

// ConfirmCascadeDialog - Destructive action confirmation
export { ConfirmCascadeDialog } from './ConfirmCascadeDialog';
export type {
  ConfirmCascadeDialogProps,
  CascadeDependency,
} from './ConfirmCascadeDialog';

// OnboardingChecklist - Dashboard getting started widget
export { OnboardingChecklist } from './OnboardingChecklist';
export type { OnboardingChecklistProps } from './OnboardingChecklist';

// ContextualBanner - Dismissible guidance banners
export {
  ContextualBanner,
  FeatureBanner,
  TipBanner,
  WarningBanner,
  SuccessBanner,
  BomUploadTipBanner,
  SearchGuideBanner,
  RiskDashboardIntroBanner,
  AlertConfigBanner,
  TrialExpirationBanner,
  MfaRecommendationBanner,
} from './ContextualBanner';
export type { ContextualBannerProps, BannerVariant } from './ContextualBanner';
