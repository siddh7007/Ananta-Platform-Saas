/**
 * Risk Dashboard Page
 *
 * Displays multi-level risk analysis with filtering by project and BOM.
 * Shows BOM health grades, risk distribution, and high-risk components.
 *
 * Refactored to use modular components from ./risk/
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Badge,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useGetList, useNotify } from 'react-admin';
import RefreshIcon from '@mui/icons-material/Refresh';
import WarningIcon from '@mui/icons-material/Warning';
import SecurityIcon from '@mui/icons-material/Security';
import TuneIcon from '@mui/icons-material/Tune';
import FolderIcon from '@mui/icons-material/Folder';
import ListAltIcon from '@mui/icons-material/ListAlt';
import { gradeColors as GRADE_COLORS } from '../theme';
import { PageLoading, FilterToolbar } from '../components/shared';
import {
  PortfolioOverview,
  ProjectRiskOverview,
  BomRiskOverview,
  HighRiskTable,
  MitigationDrawer,
  TimelineComparison,
} from './risk';
import type { MitigationFormData } from './risk';
import {
  riskApi,
  PortfolioRiskSummary,
  RiskStatistics,
  ComponentRiskScore,
  BOMRiskSummary,
  ProjectRiskSummary,
} from '../services/riskService';

// View tab type
type ViewTab = 'portfolio' | 'projects' | 'boms';

export const RiskDashboard: React.FC = () => {
  const notify = useNotify();
  // View state
  const [viewTab, setViewTab] = useState<ViewTab>('portfolio');

  // Filter state
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedHealthGrade, setSelectedHealthGrade] = useState<string>('all');

  // Data state
  const [portfolioRisk, setPortfolioRisk] = useState<PortfolioRiskSummary | null>(null);
  const [riskStats, setRiskStats] = useState<RiskStatistics | null>(null);
  const [highRiskComponents, setHighRiskComponents] = useState<ComponentRiskScore[]>([]);
  const [bomRiskSummaries, setBomRiskSummaries] = useState<BOMRiskSummary[]>([]);
  const [projectRiskSummaries, setProjectRiskSummaries] = useState<ProjectRiskSummary[]>([]);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeSuccess, setAnalyzeSuccess] = useState<string | null>(null);

  // Mitigation drawer state
  const [mitigationDrawerOpen, setMitigationDrawerOpen] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<ComponentRiskScore | null>(null);

  // Get projects from Supabase
  const { data: projects = [] } = useGetList('projects', {
    pagination: { page: 1, perPage: 100 },
    sort: { field: 'name', order: 'ASC' },
  });

  // Load all data
  const loadData = useCallback(async () => {
    try {
      setError(null);

      // Load portfolio risk data
      const [portfolio, stats, highRisk] = await Promise.all([
        riskApi.getPortfolioRisk(),
        riskApi.getRiskStatistics(),
        riskApi.getHighRiskComponents(61, 10),
      ]);
      setPortfolioRisk(portfolio);
      setRiskStats(stats);
      setHighRiskComponents(highRisk);

      // Load BOM and project risk summaries
      try {
        const [boms, projectSummaries] = await Promise.all([
          riskApi.getBOMRiskSummaries({
            project_id: selectedProjectId !== 'all' ? selectedProjectId : undefined,
            health_grade: selectedHealthGrade !== 'all' ? selectedHealthGrade : undefined,
          }),
          riskApi.getProjectRiskSummaries(),
        ]);
        setBomRiskSummaries(boms);
        setProjectRiskSummaries(projectSummaries);
      } catch (bomErr: unknown) {
        console.warn('BOM risk data not available:', (bomErr as Error).message);
        setBomRiskSummaries([]);
        setProjectRiskSummaries([]);
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load risk data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedProjectId, selectedHealthGrade]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load BOM data when filters change
  const loadBOMData = useCallback(async () => {
    try {
      const boms = await riskApi.getBOMRiskSummaries({
        project_id: selectedProjectId !== 'all' ? selectedProjectId : undefined,
        health_grade: selectedHealthGrade !== 'all' ? selectedHealthGrade : undefined,
      });
      setBomRiskSummaries(boms);
    } catch (err: unknown) {
      console.warn('Failed to load BOM risk data:', (err as Error).message);
    }
  }, [selectedProjectId, selectedHealthGrade]);

  useEffect(() => {
    if (!loading) {
      loadBOMData();
    }
  }, [loading, loadBOMData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleRunAnalysis = async (forceRecalculate: boolean = false) => {
    setAnalyzing(true);
    setAnalyzeSuccess(null);
    setError(null);

    try {
      const result = await riskApi.runRiskAnalysis(undefined, forceRecalculate);
      setAnalyzeSuccess(result.message);

      setTimeout(() => {
        handleRefresh();
        setAnalyzeSuccess(null);
      }, 3000);
    } catch (err: unknown) {
      setError(`Risk analysis failed: ${(err as Error).message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  // Handle project selection from ProjectRiskOverview
  const handleProjectSelect = (projectId: string) => {
    setSelectedProjectId(projectId);
    setViewTab('boms');
  };

  // Handle health grade change from BomRiskOverview
  const handleHealthGradeChange = (grade: string) => {
    setSelectedHealthGrade(grade);
  };

  // Handle mitigation assignment
  const handleAssignMitigation = (componentId: string) => {
    const component = highRiskComponents.find(c => c.component_id === componentId);
    if (component) {
      setSelectedComponent(component);
      setMitigationDrawerOpen(true);
    }
  };

  // Save mitigation
  const handleSaveMitigation = async (data: MitigationFormData) => {
    if (!data.assignee) {
      notify('Please assign an owner before saving.', { type: 'warning' });
      return;
    }

    try {
      await riskApi.createMitigationAssignment({
        component_id: data.componentId,
        assignee_name: data.assignee.name,
        assignee_email: data.assignee.email,
        due_date: data.dueDate ? data.dueDate.toISOString() : null,
        status: data.status,
        priority: data.priority,
        notes: data.notes,
        tags: data.tags,
      });
      notify('Mitigation assigned successfully', { type: 'success' });
      setMitigationDrawerOpen(false);
      setSelectedComponent(null);
    } catch (err: any) {
      console.error('Failed to save mitigation:', err);
      notify(err?.message || 'Failed to save mitigation', { type: 'error' });
      throw err;
    }
  };

  // Clear filters
  const handleClearFilters = () => {
    setSelectedProjectId('all');
    setSelectedHealthGrade('all');
  };

  // Filter configuration for BOM view
  const bomFilters = [
    {
      key: 'project',
      label: 'Project',
      type: 'select' as const,
      options: projects.map((p: { id: string; name: string }) => ({
        value: p.id,
        label: p.name,
      })),
      minWidth: 200,
    },
    {
      key: 'grade',
      label: 'Health Grade',
      type: 'select' as const,
      options: ['A', 'B', 'C', 'D', 'F'].map(g => ({
        value: g,
        label: `Grade ${g}`,
      })),
      minWidth: 150,
    },
  ];

  if (loading) {
    return <PageLoading message="Loading risk data..." />;
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Risk Analysis Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Monitor component and BOM risk across your organization
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<TuneIcon />}
            component={RouterLink}
            to="/risk/settings"
          >
            Risk Settings
          </Button>
          <Button
            variant="outlined"
            startIcon={refreshing ? <CircularProgress size={16} /> : <RefreshIcon />}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={analyzing ? <CircularProgress size={16} color="inherit" /> : <SecurityIcon />}
            onClick={() => handleRunAnalysis(false)}
            disabled={analyzing || refreshing}
            sx={{ minWidth: 160 }}
          >
            {analyzing ? 'Analyzing...' : 'Run Analysis'}
          </Button>
          <Button
            component={RouterLink}
            to="/alerts"
            variant="contained"
            color="warning"
            startIcon={<WarningIcon />}
          >
            View Alerts
          </Button>
        </Box>
      </Box>

      {/* View Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs
          value={viewTab}
          onChange={(_, value) => setViewTab(value)}
          aria-label="Risk dashboard views"
        >
          <Tab
            value="portfolio"
            label="Portfolio Overview"
            icon={<SecurityIcon />}
            iconPosition="start"
          />
          <Tab
            value="projects"
            label={
              <Badge badgeContent={projectRiskSummaries.length} color="primary">
                Projects
              </Badge>
            }
            icon={<FolderIcon />}
            iconPosition="start"
          />
          <Tab
            value="boms"
            label={
              <Badge badgeContent={bomRiskSummaries.length} color="primary">
                BOMs
              </Badge>
            }
            icon={<ListAltIcon />}
            iconPosition="start"
          />
        </Tabs>
      </Box>

      {/* BOM Filters (visible in BOM tab) */}
      {viewTab === 'boms' && (
        <FilterToolbar
          filters={bomFilters}
          values={{
            project: selectedProjectId === 'all' ? '' : selectedProjectId,
            grade: selectedHealthGrade === 'all' ? '' : selectedHealthGrade,
          }}
          onChange={(key, value) => {
            if (key === 'project') setSelectedProjectId(value || 'all');
            if (key === 'grade') setSelectedHealthGrade(value || 'all');
          }}
          onClear={handleClearFilters}
          onRefresh={handleRefresh}
          refreshing={refreshing}
        />
      )}

      {/* Status Messages */}
      {analyzeSuccess && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setAnalyzeSuccess(null)}>
          {analyzeSuccess}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* =============== PORTFOLIO VIEW =============== */}
      {viewTab === 'portfolio' && (
        <>
          <PortfolioOverview
            portfolioRisk={portfolioRisk}
            riskStats={riskStats}
          />

          {/* Timeline Comparison */}
          <Grid container spacing={3} sx={{ mt: 0, mb: 3 }}>
            <Grid item xs={12}>
              <TimelineComparison
                currentScore={portfolioRisk?.average_risk_score}
              />
            </Grid>
          </Grid>

          {/* High Risk Components Table */}
          <HighRiskTable
            components={highRiskComponents}
            onAssignMitigation={handleAssignMitigation}
          />
        </>
      )}

      {/* =============== PROJECTS VIEW =============== */}
      {viewTab === 'projects' && (
        <ProjectRiskOverview
          projectRiskSummaries={projectRiskSummaries}
          onProjectSelect={handleProjectSelect}
        />
      )}

      {/* =============== BOMs VIEW =============== */}
      {viewTab === 'boms' && (
        <BomRiskOverview
          bomRiskSummaries={bomRiskSummaries}
          selectedHealthGrade={selectedHealthGrade}
          selectedProjectId={selectedProjectId}
          onHealthGradeChange={handleHealthGradeChange}
        />
      )}

      {/* Mitigation Drawer */}
      <MitigationDrawer
        open={mitigationDrawerOpen}
        onClose={() => setMitigationDrawerOpen(false)}
        component={selectedComponent}
        onSave={handleSaveMitigation}
      />
    </Box>
  );
};

export default RiskDashboard;
