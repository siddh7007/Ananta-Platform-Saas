/**
 * Hooks - Barrel Export
 */

// Toast notifications
export { useToast, toast, toastSuccess, toastError, toastWarning, toastInfo } from './useToast';

// BOM parsing
export { useBomParser } from './useBomParser';

// Mutations
export {
  useMutation,
  useDeleteMutation,
  useCreateMutation,
  useUpdateMutation,
  useMutationStates,
} from './useMutation';

// URL state persistence
export {
  useUrlState,
  useUrlStates,
  useListFilters,
  useBomFilters,
  useComponentFilters,
  useTeamFilters,
} from './useUrlState';

// Types
export type {
  ListFilterState,
  BomFilterState,
  ComponentFilterState,
  TeamFilterState,
} from './useUrlState';

// Accessibility & Keyboard Navigation (CBP-P1-003)
export { useFocusTrap } from './useFocusTrap';
export { useKeyboardNavigation } from './useKeyboardNavigation';
export { useRovingTabIndex } from './useRovingTabIndex';

// Secure Logout (CBP-P1-005)
export { useSecureLogout } from './useSecureLogout';

// Swipe Gestures (CBP-P3-003)
export { useSwipeGesture } from './useSwipeGesture';
export type { SwipeGestureConfig, SwipeState } from './useSwipeGesture';

// Media Queries (CBP-P3-002)
export {
  useMediaQuery,
  useIsTabletPortrait,
  useIsMobile,
  useIsTablet,
  useIsDesktop,
} from './useMediaQuery';

// Optimized Query Hooks with Caching (CBP-P3-006)
export {
  useBomList,
  useBomDetail,
  useCreateBom,
  useUpdateBom,
  useDeleteBom,
  useComponentSearch,
  useComponentDetail,
  useCurrentUser,
  useUpdateUserProfile,
  usePrefetchBomDetail,
  useInvalidateBoms,
  useInvalidateComponents,
} from './useQueryHooks';
export type {
  Bom,
  BomListResponse,
  BomDetail,
  BomLineItem,
  ComponentSearchResult,
  ComponentSearchResponse,
  UserProfile,
} from './useQueryHooks';

// Permission Checks (RBAC)
export { usePermissions } from './usePermissions';
export type { UsePermissionsResult } from './usePermissions';

// Column Mapping Templates
export {
  useColumnMappingTemplates,
  useSaveTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  useSetDefaultTemplate,
  useApplyTemplate,
  useAutoLoadTemplate,
} from './useColumnMappingTemplates';

// Risk Analysis Hooks
export {
  riskKeys,
  useRiskPortfolio,
  useRiskStatistics,
  useHighRiskComponents,
  useComponentRisk,
  useRiskHistory,
  useBomsWithRisk,
  useBomRiskDetail,
  useRecalculateBomRisk,
  useRiskProfile,
  useUpdateRiskProfile,
  useRiskPresets,
  useApplyRiskPreset,
  useRiskDashboard,
  useRiskTrend,
} from './useRisk';

// Alert Hooks
export {
  alertQueryKeys,
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
} from './useAlerts';

// Component Watch Hook (convenience wrapper)
export { useComponentWatch, useComponentsWatchStatus } from './useComponentWatch';
export type { UseComponentWatchOptions, UseComponentWatchResult } from './useComponentWatch';

// Enrichment Progress (SSE-based - aligns with CNS Service backend)
export { useEnrichmentSSE } from './useEnrichmentSSE';
export type {
  EnrichmentProgressState,
  EnrichmentEvent,
  SSEConnectionStatus,
} from './useEnrichmentSSE';

// Enrichment Progress (WebSocket-based - alternative implementation)
export { useEnrichmentProgress } from './useEnrichmentProgress';

// Project Hooks (for sidebar navigation)
export {
  useProjects,
  useProject,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  useInvalidateProjects,
} from './useProjects';
export type {
  ProjectWithUploads,
  ProjectListResponse,
  ProjectListFilters,
} from './useProjects';

// Processing Jobs (workflow management - list view)
export { useProcessingJobs } from './useProcessingJobs';
export type {
  ProcessingJob,
  ProcessingJobAPI,
  JobStatus,
  UseProcessingJobsOptions,
  UseProcessingJobsResult,
} from './useProcessingJobs';

// Processing Status (single BOM workflow tracking with SSE)
export { useProcessingStatus } from './useProcessingStatus';
export type {
  ProcessingStatusAPI,
  ProcessingStageInfoAPI,
  UseProcessingStatusOptions,
  UseProcessingStatusResult,
} from './useProcessingStatus';

// Workspace Management
export { useWorkspaces } from './useWorkspaces';

// BOM Upload Persistence
export { useBomUploadPersistence } from './useBomUploadPersistence';

// S3-Based Workflow State Persistence
export { useWorkflowStatePersistence } from './useWorkflowStatePersistence';
export type {
  BomQueueItem as S3BomQueueItem,
  ActiveWorkflow,
  WorkflowState,
  SaveWorkflowStateRequest,
} from './useWorkflowStatePersistence';

// Component Search
export { useComponentSearch as useComponentSearchHook } from './useComponentSearch';

// Bulk Selection
export { useBulkSelection } from './useBulkSelection';

// Debounce Hook
export { useDebounce } from './useDebounce';

// Breadcrumbs Navigation
export { useBreadcrumbs, useCollapsedBreadcrumbs } from './useBreadcrumbs';
export type { BreadcrumbItem } from './useBreadcrumbs';

// Unified BOM Upload and Processing Hooks (Temporal Workflow Integration)
export { useWorkflowStatus } from './useWorkflowStatus';
export { useProcessingQueue } from './useProcessingQueue';
export { useBomUploadStatus } from './useBomUploadStatus';

// Types for Unified BOM Upload Hooks
export type {
  UseWorkflowStatusOptions,
  UseWorkflowStatusReturn,
} from './useWorkflowStatus';
export type {
  UseProcessingQueueOptions,
  UseProcessingQueueReturn,
} from './useProcessingQueue';
export type {
  UseBomUploadStatusOptions,
  UseBomUploadStatusReturn,
  BomProcessingPhase,
} from './useBomUploadStatus';


// Keyboard Shortcuts (Command Palette)
export {
  useKeyboardShortcuts,
  useKeyboardShortcut,
  formatShortcut,
  COMMON_SHORTCUTS,
} from './useKeyboardShortcuts';
export type { ShortcutConfig } from './useKeyboardShortcuts';

