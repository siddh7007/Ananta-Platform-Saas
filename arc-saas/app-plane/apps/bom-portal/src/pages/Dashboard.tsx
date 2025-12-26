import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, Grid, Button, Box, Typography, Chip, CircularProgress, LinearProgress, Divider, Paper } from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useGetList } from 'react-admin';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import ListAltIcon from '@mui/icons-material/ListAlt';
import MemoryIcon from '@mui/icons-material/Memory';
import NotificationsIcon from '@mui/icons-material/Notifications';
import FolderIcon from '@mui/icons-material/Folder';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SpeedIcon from '@mui/icons-material/Speed';
import { ProjectSwitcher } from '../components/ProjectSwitcher';
import { useDropzone } from 'react-dropzone';
import { OnboardingChecklist } from '../components/shared';
import { analytics } from '../services/analytics';
import { setPendingUploadFiles } from '../bom/uploadQueueStore';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  // Current project state (persisted in localStorage)
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(() => {
    return localStorage.getItem('current_project_id');
  });

  // Load active projects
  const { data: projects, isLoading: projectsLoading } = useGetList('projects', {
    pagination: { page: 1, perPage: 10 },
    sort: { field: 'updated_at', order: 'DESC' },
  });

  // Auto-select first project if none selected
  useEffect(() => {
    if (projects && projects.length > 0 && !currentProjectId) {
      const firstProject = projects[0];
      console.log('[Dashboard] Auto-selecting first project:', firstProject.name, firstProject.id);
      setCurrentProjectId(firstProject.id);
      localStorage.setItem('current_project_id', firstProject.id);
      localStorage.setItem('project_id', firstProject.id); // For BOM upload compatibility
    }
  }, [projects, currentProjectId]);

  // Get current project data
  const currentProject = projects?.find((p: any) => p.id === currentProjectId);

  // Load BOMs filtered by current project
  const { data: boms, isLoading: bomsLoading } = useGetList('boms', {
    pagination: { page: 1, perPage: 10 },
    sort: { field: 'created_at', order: 'DESC' },
    filter: currentProjectId ? { project_id: currentProjectId } : {},
  });

  // Load recent BOM uploads
  const { data: recentUploads, isLoading: uploadsLoading } = useGetList('bom_uploads', {
    pagination: { page: 1, perPage: 5 },
    sort: { field: 'created_at', order: 'DESC' },
    filter: currentProjectId ? { project_id: currentProjectId } : {},
  });

  // Load BOM metrics (filtered by current project)
  const { total: totalBOMsCount = 0 } = useGetList('boms', {
    pagination: { page: 1, perPage: 1 },
    filter: currentProjectId ? { project_id: currentProjectId } : {},
  });

  const organizationId =
    typeof window !== 'undefined' ? localStorage.getItem('organization_id') : null;

  const activeEnrichmentFilter: Record<string, any> = { status: 'processing' };
  if (organizationId) {
    activeEnrichmentFilter.organization_id = organizationId;
  }
  if (currentProjectId) {
    activeEnrichmentFilter.project_id = currentProjectId;
  }

  const { total: activeEnrichmentsCount = 0 } = useGetList('bom_uploads', {
    pagination: { page: 1, perPage: 1 },
    filter: activeEnrichmentFilter,
  });

  // Count of all components via bom_line_items (scoped to org/project)
  const componentCountFilter: Record<string, string> = {};
  if (currentProjectId) {
    componentCountFilter.project_id = currentProjectId;
  } else {
    componentCountFilter.project_id = 'all';
  }
  const { total: totalComponentsCount = 0 } = useGetList('bom_line_items', {
    pagination: { page: 1, perPage: 1 },
    filter: componentCountFilter,
  });

  const { total: activeAlertsCount = 0 } = useGetList('alerts', {
    pagination: { page: 1, perPage: 1 },
    filter: { is_read: false },
  });

  // Debug logging
  useEffect(() => {
    console.log('[Dashboard] Current state:', {
      projectsCount: projects?.length || 0,
      currentProjectId,
      currentProjectName: currentProject?.name,
      bomsCount: boms?.length || 0,
    });
  }, [projects, currentProjectId, currentProject, boms]);

  // Handle project change
  const handleProjectChange = (projectId: string) => {
    const project = projects?.find((p: any) => p.id === projectId);
    console.log('[Dashboard] Project switched to:', project?.name, projectId);
    setCurrentProjectId(projectId);
    localStorage.setItem('current_project_id', projectId);
    localStorage.setItem('project_id', projectId); // For BOM upload compatibility
    analytics.trackProjectSwitched(projectId);
  };

  // Track page view on mount
  useEffect(() => {
    analytics.trackPageView('Dashboard', '/');
  }, []);

  // Calculate project progress
  const projectProgress = currentProject
    ? currentProject.total_boms > 0
      ? ((currentProject.completed_boms || 0) / currentProject.total_boms) * 100
      : 0
    : 0;

  // Helper functions for upload status display with user-friendly labels
  const getUploadStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon sx={{ fontSize: 18, color: 'info.main' }} />; // Changed to info (ready to enrich)
      case 'error':
      case 'failed':
        return <ErrorIcon sx={{ fontSize: 18, color: 'error.main' }} />;
      case 'processing':
        return <HourglassEmptyIcon sx={{ fontSize: 18, color: 'primary.main' }} />; // Enriching
      case 'mapping_pending':
        return <HourglassEmptyIcon sx={{ fontSize: 18, color: 'warning.main' }} />; // Needs review
      default:
        return <AccessTimeIcon sx={{ fontSize: 18, color: 'info.main' }} />;
    }
  };

  const getUploadStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'info'; // Ready to enrich
      case 'error':
      case 'failed': return 'error';
      case 'processing': return 'primary'; // Enriching
      case 'mapping_pending': return 'warning'; // Needs review
      default: return 'default';
    }
  };

  const getUploadStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Ready to Enrich';
      case 'error': return 'Failed - Retry';
      case 'failed': return 'Failed - Retry';
      case 'processing': return 'Enriching';
      case 'mapping_pending': return 'Review Mapping';
      case 'pending': return 'Pending';
      default: return status;
    }
  };

  const getBOMStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Complete';
      case 'analyzing': return 'Enriching';
      case 'draft': return 'Draft';
      case 'processing': return 'Enriching';
      case 'failed': return 'Failed';
      default: return status;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    if (!dateString) return 'Unknown';

    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Unknown';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  // Quick upload dropzone
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      // Hand off the actual File objects to the upload workflow
      setPendingUploadFiles(acceptedFiles);
      // Navigate to upload page
      navigate('/bom/upload');
    }
  }, [navigate]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    multiple: true,
    noClick: false,
  });

  return (
    <Box sx={{ p: 3 }}>
      {/* Header with Project Switcher */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Dashboard
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <ProjectSwitcher
            projects={projects || []}
            currentProjectId={currentProjectId}
            onProjectChange={handleProjectChange}
            loading={projectsLoading}
          />
          <Button
            component={RouterLink}
            to="/projects/create"
            variant="outlined"
            startIcon={<AddIcon />}
            size="small"
          >
            New Project
          </Button>
        </Box>
      </Box>

      {/* Onboarding Checklist */}
      <OnboardingChecklist
        dismissible
        showTrialBanner={false}
      />

      {/* Key Metrics Summary */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: 'primary.50', borderLeft: '4px solid', borderColor: 'primary.main' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    {currentProjectId ? 'PROJECT BOMS' : 'TOTAL BOMS'}
                  </Typography>
                  <Typography variant="h4" fontWeight={700} color="primary.main">
                    {totalBOMsCount}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {currentProjectId ? currentProject?.name || 'In this project' : 'Across all projects'}
                  </Typography>
                </Box>
                <ListAltIcon sx={{ fontSize: 48, color: 'primary.main', opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: 'warning.50', borderLeft: '4px solid', borderColor: 'warning.main' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    ACTIVE ENRICHMENTS
                  </Typography>
                  <Typography variant="h4" fontWeight={700} color="warning.main">
                    {activeEnrichmentsCount}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Processing now
                  </Typography>
                </Box>
                <SpeedIcon sx={{ fontSize: 48, color: 'warning.main', opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: 'success.50', borderLeft: '4px solid', borderColor: 'success.main' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    TOTAL COMPONENTS
                  </Typography>
                  <Typography variant="h4" fontWeight={700} color="success.main">
                    {totalComponentsCount}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    In catalog
                  </Typography>
                </Box>
                <MemoryIcon sx={{ fontSize: 48, color: 'success.main', opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: 'error.50', borderLeft: '4px solid', borderColor: 'error.main' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    ACTIVE ALERTS
                  </Typography>
                  <Typography variant="h4" fontWeight={700} color="error.main">
                    {activeAlertsCount}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Require attention
                  </Typography>
                </Box>
                <NotificationsIcon sx={{ fontSize: 48, color: 'error.main', opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Current Project Banner */}
      {currentProject && (
        <Card sx={{ mb: 3, bgcolor: 'primary.main', color: 'white' }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ opacity: 0.9 }}>
                  Current Project
                </Typography>
                <Typography variant="h5" fontWeight={600} gutterBottom>
                  {currentProject.name}
                </Typography>
                {currentProject.description && (
                  <Typography variant="body2" sx={{ opacity: 0.9, mb: 2 }}>
                    {currentProject.description}
                  </Typography>
                )}
                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                  <Chip
                    label={`${currentProject.total_boms || 0} BOMs`}
                    size="small"
                    sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
                  />
                  <Chip
                    label={`${currentProject.total_components || 0} Components`}
                    size="small"
                    sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
                  />
                  <Chip
                    label={currentProject.status}
                    size="small"
                    sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', textTransform: 'capitalize' }}
                  />
                </Box>
                {currentProject.total_boms > 0 && (
                  <Box sx={{ mt: 2, maxWidth: 300 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" sx={{ opacity: 0.9 }}>
                        Progress
                      </Typography>
                      <Typography variant="caption" fontWeight={600}>
                        {currentProject.completed_boms || 0}/{currentProject.total_boms} Complete ({projectProgress.toFixed(0)}%)
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={projectProgress}
                      sx={{
                        height: 6,
                        borderRadius: 3,
                        bgcolor: 'rgba(255,255,255,0.2)',
                        '& .MuiLinearProgress-bar': {
                          bgcolor: 'white',
                        },
                      }}
                    />
                  </Box>
                )}
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  component={RouterLink}
                  to="/bom/upload"
                  variant="contained"
                  color="secondary"
                  startIcon={<UploadFileIcon />}
                  sx={{ whiteSpace: 'nowrap' }}
                >
                  Upload BOM
                </Button>
                <Button
                  component={RouterLink}
                  to="/boms"
                  variant="outlined"
                  sx={{ color: 'white', borderColor: 'white', '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' } }}
                  startIcon={<ListAltIcon />}
                >
                  Edit BOMs
                </Button>
                <Button
                  component={RouterLink}
                  to={`/projects/${currentProject.id}/show`}
                  variant="outlined"
                  sx={{ color: 'white', borderColor: 'white', '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' } }}
                >
                  View Details
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Quick Upload Zone - Prominent Primary Action */}
      {currentProject && (
        <Card sx={{ mb: 3, border: '2px dashed', borderColor: 'primary.main', bgcolor: 'primary.50' }}>
          <CardContent>
            <Box
              {...getRootProps()}
              sx={{
                textAlign: 'center',
                py: 3,
                cursor: 'pointer',
                transition: 'all 0.2s',
                borderRadius: 2,
                bgcolor: isDragActive ? 'primary.100' : 'transparent',
                '&:hover': {
                  bgcolor: 'primary.100',
                },
              }}
            >
              <input {...getInputProps()} />
              <CloudUploadIcon
                sx={{
                  fontSize: 48,
                  color: 'primary.main',
                  mb: 1,
                }}
              />
              <Typography variant="h6" gutterBottom color="primary.main">
                {isDragActive ? '📂 Drop files here...' : '📤 Upload Your BOM'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Drag & drop files here, or click to browse
              </Typography>
              <Typography variant="caption" color="text.secondary">
                CSV, Excel (.xlsx, .xls) • Auto-enrichment enabled
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Button
                  component={RouterLink}
                  to="/bom/upload"
                  variant="contained"
                  color="primary"
                  startIcon={<UploadFileIcon />}
                  onClick={(e) => e.stopPropagation()}
                >
                  Browse Files
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* No Project Selected State */}
      {!currentProject && !projectsLoading && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <FolderIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                No Active Projects
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Create your first project to start uploading BOMs and managing components.
              </Typography>
              <Button
                component={RouterLink}
                to="/projects/create"
                variant="contained"
                startIcon={<AddIcon />}
              >
                Create Your First Project
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      <Grid container spacing={3}>
        {/* Project BOMs */}
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Project BOMs
                </Typography>
                <Button
                  component={RouterLink}
                  to="/boms"
                  size="small"
                  startIcon={<ListAltIcon />}
                >
                  View All
                </Button>
              </Box>

              {bomsLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                  <CircularProgress />
                </Box>
              ) : boms && boms.length > 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {boms.slice(0, 5).map((bom: any) => (
                    <Card key={bom.id} variant="outlined">
                      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box>
                            <Typography variant="body1" fontWeight={500}>
                              {bom.name}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                              <Chip label={`${bom.component_count || 0} components`} size="small" variant="outlined" />
                              {bom.status && (
                                <Chip
                                  label={getBOMStatusLabel(bom.status)}
                                  size="small"
                                  color={
                                    bom.status === 'completed' ? 'success' :
                                    bom.status === 'analyzing' || bom.status === 'processing' ? 'primary' :
                                    bom.status === 'failed' ? 'error' :
                                    'default'
                                  }
                                />
                              )}
                            </Box>
                          </Box>
                          <Button
                            component={RouterLink}
                            to={`/boms/${bom.id}/show`}
                            size="small"
                          >
                            View
                          </Button>
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <ListAltIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    No BOMs in this project yet
                  </Typography>
                  <Button
                    component={RouterLink}
                    to="/bom/upload"
                    variant="contained"
                    size="small"
                    startIcon={<UploadFileIcon />}
                    sx={{ mt: 1 }}
                  >
                    Upload First BOM
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12} lg={4}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Button
                  component={RouterLink}
                  to="/bom/upload"
                  variant="contained"
                  startIcon={<UploadFileIcon />}
                  fullWidth
                >
                  Upload BOM
                </Button>
                <Divider sx={{ my: 0.5 }} />
                <Button
                  component={RouterLink}
                  to="/projects"
                  variant="outlined"
                  startIcon={<FolderIcon />}
                >
                  All Projects
                </Button>
                <Button
                  component={RouterLink}
                  to="/bom_jobs"
                  variant="outlined"
                  startIcon={<ListAltIcon />}
                >
                  BOM Jobs
                </Button>
                <Button
                  component={RouterLink}
                  to="/components"
                  variant="outlined"
                  startIcon={<MemoryIcon />}
                >
                  Components
                </Button>
                <Button
                  component={RouterLink}
                  to="/alerts"
                  variant="outlined"
                  startIcon={<NotificationsIcon />}
                >
                  Alerts
                </Button>
              </Box>
            </CardContent>
          </Card>

          {/* Recent Uploads */}
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Recent Uploads
                </Typography>
                <Button
                  component={RouterLink}
                  to="/bom_uploads"
                  size="small"
                >
                  View All
                </Button>
              </Box>

              {uploadsLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : recentUploads && recentUploads.length > 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {recentUploads.map((upload: any) => (
                    <Card key={upload.id} variant="outlined" sx={{ bgcolor: 'background.default' }}>
                      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                        <Box sx={{ display: 'flex', alignItems: 'start', gap: 1 }}>
                          <Box sx={{ mt: 0.25 }}>
                            {getUploadStatusIcon(upload.status)}
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography
                              variant="body2"
                              fontWeight={500}
                              sx={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {upload.filename}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                              <Chip
                                label={getUploadStatusLabel(upload.status)}
                                size="small"
                                color={getUploadStatusColor(upload.status) as any}
                                sx={{ height: 18, fontSize: '0.7rem' }}
                              />
                              {upload.total_rows && (
                                <Chip
                                  label={`${upload.total_rows} rows`}
                                  size="small"
                                  variant="outlined"
                                  sx={{ height: 18, fontSize: '0.7rem' }}
                                />
                              )}
                              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: '18px', ml: 0.5 }}>
                                {formatTimeAgo(upload.created_at)}
                              </Typography>
                            </Box>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              ) : (
                <Box sx={{ textAlign: 'center', py: 3 }}>
                  <UploadFileIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1, opacity: 0.5 }} />
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    No uploads yet
                  </Typography>
                  <Button
                    component={RouterLink}
                    to="/bom/upload"
                    variant="text"
                    size="small"
                    startIcon={<UploadFileIcon />}
                    sx={{ mt: 1 }}
                  >
                    Upload First BOM
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
