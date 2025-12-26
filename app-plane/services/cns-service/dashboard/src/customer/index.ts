/**
 * CNS Dashboard Customer Module
 *
 * Barrel export for customer data components.
 */

// Main Views
export { default as CustomerBOMs } from './CustomerBOMs';
export { default as CustomerCatalog } from './CustomerCatalog';
export { default as CustomerEnrichment } from './CustomerEnrichment';
export { default as CustomerUploadsList } from './CustomerUploadsList';

// NEW: Unified Customer Portal (Wave 4)
export { default as CustomerPortalPage } from './CustomerPortalPage';

// NEW: Customer Portal Components
export { default as TenantWorkspaceFilter } from './components/TenantWorkspaceFilter';
export type { TenantWorkspaceFilterProps } from './components/TenantWorkspaceFilter';

export { default as WorkflowStatsCards } from './components/WorkflowStatsCards';
export type { WorkflowStats, WorkflowStatsCardsProps } from './components/WorkflowStatsCards';

export { default as BOMWorkflowCard } from './components/BOMWorkflowCard';
export type { BOMWorkflow, BOMWorkflowCardProps } from './components/BOMWorkflowCard';

export { default as RiskAnalysisCard } from './components/RiskAnalysisCard';
export type { RiskAnalysis, RiskAnalysisCardProps } from './components/RiskAnalysisCard';

export { default as ComponentSearchTab } from './components/ComponentSearchTab';
export type { ComponentSearchTabProps } from './components/ComponentSearchTab';

export { default as RiskAlertsTab } from './components/RiskAlertsTab';
export type { RiskAlertsTabProps, RiskAlert, RiskSummary } from './components/RiskAlertsTab';

// NEW: CBP-Style Queue Components
export { default as QueueProgressGrid } from './components/QueueProgressGrid';
export type { QueueProgressStats, QueueProgressGridProps } from './components/QueueProgressGrid';

export { default as ContextLinks, BOMContextLinks } from './components/ContextLinks';
export type { ContextLink, ContextLinksProps, BOMContextLinksProps } from './components/ContextLinks';

// Shared Components
export { CustomerDataStats } from './CustomerDataStats';
export type { CustomerDataStatsData, CustomerDataStatsProps } from './CustomerDataStats';

export { BOMStatusChip } from './BOMStatusChip';
export type { BOMStatus, BOMStatusChipProps } from './BOMStatusChip';
