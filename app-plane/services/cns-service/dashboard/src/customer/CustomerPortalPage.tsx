/**
 * CustomerPortalPage Component
 *
 * Main unified page for the Customer Portal that orchestrates:
 * - Tenant/Workspace filters at the top
 * - 3 tabs: BOM Jobs | Component Search | Risk & Alerts
 * - Data scoped by selected tenant/workspace
 *
 * This replaces the previous separate routes for CustomerBOMs, CustomerCatalog,
 * and CustomerEnrichment with a single cohesive experience.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  CircularProgress,
  Divider,
  Pagination,
  Paper,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import { API_CONFIG, getAuthHeaders } from '../config/api';

// Import all Customer Portal components
import TenantWorkspaceFilter from './components/TenantWorkspaceFilter';
import WorkflowStatsCards, { WorkflowStats } from './components/WorkflowStatsCards';
import BOMWorkflowCard, { BOMWorkflow, BOMStatus } from './components/BOMWorkflowCard';
import ComponentSearchTab from './components/ComponentSearchTab';
import RiskAlertsTab from './components/RiskAlertsTab';

// Tab panel component
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`customer-portal-tabpanel-${index}`}
      aria-labelledby={`customer-portal-tab-${index}`}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `customer-portal-tab-${index}`,
    'aria-controls': `customer-portal-tabpanel-${index}`,
  };
}

// Constants for URL hash sync
const TAB_HASHES = ['boms', 'components', 'risks'] as const;
type TabHash = (typeof TAB_HASHES)[number];

// Local storage keys
const STORAGE_KEYS = {
  TENANT_ID: 'cns_portal_tenant_id',
  WORKSPACE_ID: 'cns_portal_workspace_id',
  ADMIN_MODE: 'cns_portal_admin_mode',
};

export default function CustomerPortalPage() {
  // React Router search params hook for query param tab selection
  const [searchParams, setSearchParams] = useSearchParams();

  // Filter state
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEYS.TENANT_ID);
  });

  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEYS.WORKSPACE_ID);
  });

  const [adminModeAllTenants, setAdminModeAllTenants] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEYS.ADMIN_MODE) === 'true';
  });

  // Tab state - initialize from query param or default to 0
  const [activeTab, setActiveTab] = useState(() => {
    const tabParam = searchParams.get('tab') as TabHash | null;
    if (tabParam && TAB_HASHES.includes(tabParam as TabHash)) {
      return TAB_HASHES.indexOf(tabParam as TabHash);
    }
    return 0;
  });

  // BOM Jobs tab state
  const [workflows, setWorkflows] = useState<BOMWorkflow[]>([]);
  const [workflowStats, setWorkflowStats] = useState<WorkflowStats | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [workflowsLoading, setWorkflowsLoading] = useState(false);
  const [workflowPage, setWorkflowPage] = useState(1);
  const [totalWorkflows, setTotalWorkflows] = useState(0);
  const workflowLimit = 10;
  const totalWorkflowPages = Math.ceil(totalWorkflows / workflowLimit);

  // Sync tab from URL query param on mount and changes
  useEffect(() => {
    const tabParam = searchParams.get('tab') as TabHash | null;
    if (tabParam && TAB_HASHES.includes(tabParam as TabHash)) {
      const tabIndex = TAB_HASHES.indexOf(tabParam as TabHash);
      if (tabIndex !== activeTab) {
        setActiveTab(tabIndex);
      }
    }
  }, [searchParams, activeTab]);

  // Handle tab change - update query param
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    setSearchParams({ tab: TAB_HASHES[newValue] });
  };

  // Handle tenant change
  const handleTenantChange = useCallback((tenantId: string | null) => {
    setSelectedTenantId(tenantId);
    if (tenantId) {
      localStorage.setItem(STORAGE_KEYS.TENANT_ID, tenantId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.TENANT_ID);
    }
    // Clear workspace when tenant changes
    setSelectedWorkspaceId(null);
    localStorage.removeItem(STORAGE_KEYS.WORKSPACE_ID);
    // Reset workflow page
    setWorkflowPage(1);
  }, []);

  // Handle workspace change
  const handleWorkspaceChange = useCallback((workspaceId: string | null) => {
    setSelectedWorkspaceId(workspaceId);
    if (workspaceId) {
      localStorage.setItem(STORAGE_KEYS.WORKSPACE_ID, workspaceId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.WORKSPACE_ID);
    }
    // Reset workflow page
    setWorkflowPage(1);
  }, []);

  // Handle admin mode change
  const handleAdminModeChange = useCallback((enabled: boolean) => {
    setAdminModeAllTenants(enabled);
    localStorage.setItem(STORAGE_KEYS.ADMIN_MODE, enabled ? 'true' : 'false');
    // Reset workflow page
    setWorkflowPage(1);
  }, []);

  // Error state for workflows
  const [workflowError, setWorkflowError] = useState<string | null>(null);

  // Fetch BOM workflows from real API
  const fetchWorkflows = useCallback(async () => {
    setWorkflowsLoading(true);
    setWorkflowError(null);
    try {
      const url = new URL(`${API_CONFIG.BASE_URL}/admin/boms`, window.location.origin);

      // Add filters (unless admin mode is bypassing tenant filter)
      if (!adminModeAllTenants && selectedTenantId) {
        url.searchParams.set('organization_id', selectedTenantId);
        if (selectedWorkspaceId) {
          url.searchParams.set('workspace_id', selectedWorkspaceId);
        }
      }

      // Status filter
      if (statusFilter && statusFilter !== 'total') {
        url.searchParams.set('status', statusFilter);
      }

      url.searchParams.set('page', String(workflowPage));
      url.searchParams.set('limit', String(workflowLimit));

      const response = await fetch(url.toString(), {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorMsg = `Failed to fetch workflows: ${response.status} ${response.statusText}`;
        console.error(errorMsg);
        setWorkflowError(errorMsg);
        setWorkflows([]);
        setTotalWorkflows(0);
        calculateStats([]);
        return;
      }

      const data = await response.json();
      const items: BOMWorkflow[] = (Array.isArray(data) ? data : data.data || []).map(
        (bom: any) => mapBomToWorkflow(bom)
      );

      setWorkflows(items);
      setTotalWorkflows(data.total || items.length);
      calculateStats(items);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Network error fetching workflows';
      console.error('Error fetching workflows:', errorMsg);
      setWorkflowError(errorMsg);
      setWorkflows([]);
      setTotalWorkflows(0);
      calculateStats([]);
    } finally {
      setWorkflowsLoading(false);
    }
  }, [selectedTenantId, selectedWorkspaceId, adminModeAllTenants, statusFilter, workflowPage]);

  // Map BOM API response to BOMWorkflow interface
  const mapBomToWorkflow = (bom: any): BOMWorkflow => {
    return {
      id: bom.id,
      name: bom.name || bom.file_name || 'Untitled BOM',
      status: mapBomStatus(bom.status || bom.processing_status),
      progress: bom.progress || calculateProgress(bom),
      tenantId: bom.organization_id || bom.tenant_id || '',
      tenantName: bom.organization_name || bom.tenant_name || 'Unknown',
      workspaceId: bom.workspace_id || '',
      workspaceName: bom.workspace_name || 'Default',
      componentCount: bom.total_line_items || bom.component_count || 0,
      createdAt: bom.created_at || bom.createdAt || new Date().toISOString(),
      updatedAt: bom.updated_at || bom.updatedAt || new Date().toISOString(),
      fileName: bom.file_name,
      fileSize: bom.file_size,
      enrichmentStats: bom.enrichment_stats
        ? {
            total: bom.enrichment_stats.total || 0,
            enriched: bom.enrichment_stats.enriched || 0,
            failed: bom.enrichment_stats.failed || 0,
            pending: bom.enrichment_stats.pending || 0,
            avgQuality: bom.enrichment_stats.avg_quality || 0,
          }
        : undefined,
      riskAnalysis: bom.risk_analysis
        ? {
            grade: bom.risk_analysis.grade || 'C',
            score: bom.risk_analysis.score || 70,
            lifecycle: bom.risk_analysis.lifecycle || {
              eolCount: 0,
              nrndCount: 0,
              obsoleteCount: 0,
            },
            supplyChain: bom.risk_analysis.supply_chain || {
              singleSourceCount: 0,
              limitedAvailability: 0,
            },
            compliance: bom.risk_analysis.compliance || {
              rohsIssues: 0,
              reachIssues: 0,
              otherIssues: 0,
            },
          }
        : undefined,
    };
  };

  // Map API status to BOMStatus type
  const mapBomStatus = (status: string): BOMStatus => {
    const statusMap: Record<string, BOMStatus> = {
      pending: 'pending',
      uploading: 'uploading',
      parsing: 'parsing',
      mapping: 'mapping',
      saving: 'saving',
      enriching: 'enriching',
      analyzing: 'analyzing',
      completed: 'completed',
      failed: 'failed',
      // Alternative status names
      processing: 'enriching',
      complete: 'completed',
      error: 'failed',
    };
    return statusMap[status?.toLowerCase()] || 'pending';
  };

  // Calculate progress based on status
  const calculateProgress = (bom: any): number => {
    if (bom.progress) return bom.progress;
    const statusProgress: Record<string, number> = {
      pending: 0,
      uploading: 15,
      parsing: 30,
      mapping: 45,
      saving: 60,
      enriching: 75,
      analyzing: 90,
      completed: 100,
      failed: 0,
    };
    return statusProgress[bom.status?.toLowerCase()] || 0;
  };

  // Calculate workflow stats from workflows
  const calculateStats = (items: BOMWorkflow[]) => {
    const stats: WorkflowStats = {
      total: items.length,
      enriching: items.filter((w) => ['uploading', 'parsing', 'mapping', 'saving', 'enriching', 'analyzing'].includes(w.status)).length,
      completed: items.filter((w) => w.status === 'completed').length,
      failed: items.filter((w) => w.status === 'failed').length,
    };
    setWorkflowStats(stats);
  };


  // Fetch workflows when filters change
  useEffect(() => {
    if (activeTab === 0) {
      fetchWorkflows();
    }
  }, [fetchWorkflows, activeTab]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    if (activeTab === 0) {
      fetchWorkflows();
    }
    // Other tabs will refresh via their internal effects
  }, [activeTab, fetchWorkflows]);

  // Handle workflow card actions
  const handleWorkflowAction = useCallback(
    async (workflowId: string, action: 'pause' | 'resume' | 'view' | 'export' | 'delete') => {
      console.log(`Workflow action: ${action} on ${workflowId}`);

      switch (action) {
        case 'view':
          // TODO: Navigate to workflow detail page
          window.location.href = `/customer/boms/${workflowId}`;
          break;
        case 'export':
          // TODO: Implement CSV export
          break;
        case 'pause':
        case 'resume':
          // TODO: Implement workflow control
          break;
        case 'delete':
          // TODO: Implement delete with confirmation
          break;
      }
    },
    []
  );

  // Handle status filter click
  const handleStatusFilterClick = useCallback((status: string | null) => {
    setStatusFilter(status);
    setWorkflowPage(1);
  }, []);

  return (
    <Box sx={{ p: 3 }}>
      {/* Full Width Header Section */}
      <Box>
        {/* Page Header */}
        <Box display="flex" alignItems="center" gap={2} mb={3}>
          <BusinessIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Box>
            <Typography variant="h4" fontWeight={600}>
              Customer Portal
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage BOMs, components, and risk analysis across tenants
            </Typography>
          </Box>
        </Box>

        {/* Tenant/Workspace Filter Bar */}
        <TenantWorkspaceFilter
          selectedTenantId={selectedTenantId}
          selectedWorkspaceId={selectedWorkspaceId}
          onTenantChange={handleTenantChange}
          onWorkspaceChange={handleWorkspaceChange}
          adminModeAllTenants={adminModeAllTenants}
          onAdminModeChange={handleAdminModeChange}
          onRefresh={handleRefresh}
        />

        <Divider sx={{ my: 3 }} />

        {/* Tabs */}
        <Paper sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            aria-label="Customer portal tabs"
            sx={{
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 500,
                minHeight: 48,
              },
            }}
          >
            <Tab label="BOM Upload Jobs" {...a11yProps(0)} />
            <Tab label="Component Search" {...a11yProps(1)} />
            <Tab label="Risk & Alerts" {...a11yProps(2)} />
          </Tabs>
        </Paper>
      </Box>

      {/* Tab 0: BOM Jobs - Full Width */}
      <TabPanel value={activeTab} index={0}>
        {/* Workflow Stats Cards */}
        <WorkflowStatsCards
          stats={workflowStats}
          selectedStatus={statusFilter}
          onStatusClick={handleStatusFilterClick}
          loading={workflowsLoading}
        />

        {/* Error Display */}
        {workflowError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {workflowError}
          </Alert>
        )}

        {/* Workflow Cards */}
        {workflowsLoading && workflows.length === 0 ? (
          <Box display="flex" justifyContent="center" py={6}>
            <CircularProgress />
          </Box>
        ) : workflows.length === 0 && !workflowError ? (
          <Box textAlign="center" py={6}>
            <Typography variant="h6" color="text.secondary">
              No BOM workflows found
            </Typography>
            <Typography variant="body2" color="text.disabled">
              {selectedTenantId
                ? 'Upload a BOM to get started'
                : 'Select a tenant to view their workflows'}
            </Typography>
          </Box>
        ) : workflows.length === 0 && workflowError ? (
          <Box textAlign="center" py={6}>
            <Typography variant="h6" color="text.secondary">
              Unable to load workflows
            </Typography>
            <Typography variant="body2" color="text.disabled">
              Please check your connection and try again
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {workflows.map((workflow) => (
              <BOMWorkflowCard
                key={workflow.id}
                workflow={workflow}
                expanded={expandedCardId === workflow.id}
                onToggleExpand={() =>
                  setExpandedCardId(expandedCardId === workflow.id ? null : workflow.id)
                }
                onAction={(action) => handleWorkflowAction(workflow.id, action)}
              />
            ))}
          </Box>
        )}

        {/* Pagination */}
        {totalWorkflowPages > 1 && (
          <Box display="flex" justifyContent="space-between" alignItems="center" mt={3}>
            <Typography variant="caption" color="text.secondary">
              Showing {(workflowPage - 1) * workflowLimit + 1}-
              {Math.min(workflowPage * workflowLimit, totalWorkflows)} of {totalWorkflows} workflows
            </Typography>
            <Pagination
              count={totalWorkflowPages}
              page={workflowPage}
              onChange={(_, p) => setWorkflowPage(p)}
              color="primary"
              size="small"
            />
          </Box>
        )}
      </TabPanel>

      {/* Tab 1: Component Search */}
      <TabPanel value={activeTab} index={1}>
        <ComponentSearchTab
          tenantId={selectedTenantId}
          workspaceId={selectedWorkspaceId}
          adminModeAllTenants={adminModeAllTenants}
        />
      </TabPanel>

      {/* Tab 2: Risk & Alerts - Full Width */}
      <TabPanel value={activeTab} index={2}>
        <RiskAlertsTab
          tenantId={selectedTenantId}
          workspaceId={selectedWorkspaceId}
          adminModeAllTenants={adminModeAllTenants}
        />
      </TabPanel>
    </Box>
  );
}
