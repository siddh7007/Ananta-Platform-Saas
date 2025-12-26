/**
 * Staff BOM Workflow Page - Full Featured (Matching Customer Portal)
 *
 * Complete 7-step BOM upload workflow with:
 * - Two-column layout (stepper left, content right)
 * - All sections visible on single page (scroll-based)
 * - Auto-scroll to active sections
 * - Hero metric cards
 * - Queue items with inline column mapper
 * - Enrichment queue with component list
 * - Risk analysis with grade circle
 * - Results summary with 3 hero cards
 * - File download links
 *
 * State and API logic is managed by useBOMWorkflow hook.
 * This component handles UI rendering and scroll behavior.
 */

import React, { useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  AlertTitle,
  Paper,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  LinearProgress,
  CircularProgress,
  Chip,
  Divider,
  IconButton,
  Tooltip,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import TableViewIcon from '@mui/icons-material/TableView';
import MapIcon from '@mui/icons-material/Map';
import SaveIcon from '@mui/icons-material/Save';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import AssessmentIcon from '@mui/icons-material/Assessment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import DescriptionIcon from '@mui/icons-material/Description';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import WarningIcon from '@mui/icons-material/Warning';
import SecurityIcon from '@mui/icons-material/Security';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import NotificationsIcon from '@mui/icons-material/Notifications';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useBOMWorkflow, type WorkflowPhase, type EnrichmentComponent } from '../hooks';
import { getGradeColor } from '../theme/helpers';
import { GradeBadge, RiskIndicator } from '../components/shared';
import { mapRiskScore } from '../mappers';
import { QueueMetricsCard, QueueItemCard } from '../bom/workflow';

// ============================================================
// Workflow Steps Configuration
// ============================================================

const WORKFLOW_STEPS = [
  { label: 'Select Files', description: 'Drop or select BOM files', icon: <CloudUploadIcon /> },
  { label: 'Upload & Parse', description: 'Parsing file structure', icon: <TableViewIcon /> },
  { label: 'Map Columns', description: 'Match columns to fields', icon: <MapIcon /> },
  { label: 'Save BOM', description: 'Creating BOM records', icon: <SaveIcon /> },
  { label: 'Enrich Components', description: 'Fetching supplier data', icon: <AutoFixHighIcon /> },
  { label: 'Risk Analysis', description: 'Calculating risk scores', icon: <SecurityIcon /> },
  { label: 'Complete', description: 'Review results', icon: <AssessmentIcon /> },
];

// ============================================================
// Main Component
// ============================================================

const StaffBOMWorkflow: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Resume from URL params
  const resumeBomId = searchParams.get('bomId');

  // Use the workflow hook for all state and API logic
  const {
    phase,
    queue,
    queueMetrics,
    enrichingBomId,
    enrichmentState,
    enrichmentMetrics,
    components,
    riskMetrics,
    isStartingEnrichment,
    dragActive,
    activeStep,
    // File operations
    handleDrag,
    handleDrop,
    handleFileSelect,
    // Queue operations
    updateMapping,
    toggleExpand,
    deleteItem,
    downloadFile,
    confirmAndEnrich,
    // Enrichment operations
    startEnrichmentManually,
    // Workflow control
    handleReset,
    setPhase,
  } = useBOMWorkflow({ resumeBomId });

  // Refs for auto-scroll (UI-specific, not in hook)
  const dropzoneRef = useRef<HTMLDivElement>(null);
  const mappingRef = useRef<HTMLDivElement>(null);
  const enrichmentRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const enrichingItemRef = useRef<HTMLLIElement>(null);
  const componentListRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to enriching component (UI behavior)
  useEffect(() => {
    if (enrichingItemRef.current && componentListRef.current) {
      enrichingItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [components.find((c: EnrichmentComponent) => c.status === 'enriching')?.id]);

  // Auto-scroll to sections on phase changes (UI behavior)
  useEffect(() => {
    if (phase === 'enriching' && enrichmentRef.current) {
      setTimeout(() => enrichmentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
    } else if (phase === 'complete' && resultsRef.current) {
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
    }
  }, [phase]);

  // Auto-scroll when queue items enter mapping state (UI behavior)
  useEffect(() => {
    const hasMappingItem = queue.some(q => q.status === 'mapping');
    if (hasMappingItem && mappingRef.current) {
      setTimeout(() => mappingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
    }
  }, [queue]);

  return (
    <Box sx={{ p: 3, maxWidth: 1400, margin: '0 auto' }}>
      {/* Page Header */}
      <Box mb={3}>
        <Typography variant="h4" gutterBottom fontWeight={600}>
          BOM Upload & Enrichment
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Upload BOMs, map columns, enrich from suppliers, and analyze risk - all in one workflow.
        </Typography>
      </Box>

      {/* Two-Column Layout */}
      <Box sx={{ display: 'flex', gap: 3 }}>
        {/* Left: Stepper */}
        <Paper sx={{ width: 280, flexShrink: 0, display: { xs: 'none', md: 'block' }, position: 'sticky', top: 16, alignSelf: 'flex-start' }}>
          <Box sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              WORKFLOW PROGRESS
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <Stepper activeStep={activeStep} orientation="vertical">
              {WORKFLOW_STEPS.map((step, index) => {
                const isComplete = index < activeStep;
                const isActive = index === activeStep;
                const isEnrichStep = index === 4 && phase === 'enriching';

                return (
                  <Step key={step.label} completed={isComplete}>
                    <StepLabel
                      StepIconComponent={() => (
                        <Box
                          sx={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: isComplete ? 'success.main' : isActive ? 'primary.main' : 'grey.300',
                            color: (isComplete || isActive) ? 'white' : 'text.secondary',
                          }}
                        >
                          {isActive && isEnrichStep ? (
                            <CircularProgress size={16} color="inherit" />
                          ) : isComplete ? (
                            <CheckCircleIcon sx={{ fontSize: 18 }} />
                          ) : (
                            React.cloneElement(step.icon as React.ReactElement, { sx: { fontSize: 16 } })
                          )}
                        </Box>
                      )}
                    >
                      <Typography variant="body2" fontWeight={isActive ? 600 : 400}>
                        {step.label}
                      </Typography>
                    </StepLabel>
                    <StepContent>
                      <Typography variant="caption" color="text.secondary">
                        {step.description}
                      </Typography>
                      {/* Enrichment Progress in Stepper */}
                      {isEnrichStep && enrichmentState && (
                        <Box sx={{ mt: 1 }}>
                          <LinearProgress
                            variant="determinate"
                            value={enrichmentState.percent_complete}
                            sx={{ height: 6, borderRadius: 1 }}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {enrichmentState.enriched_items} / {enrichmentState.total_items}
                          </Typography>
                        </Box>
                      )}
                    </StepContent>
                  </Step>
                );
              })}
            </Stepper>
          </Box>
        </Paper>

        {/* Right: Main Content */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Section 1: File Upload */}
          <Box ref={dropzoneRef} sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>Select Files</Typography>

            {/* Dynamic Dropzone - Shows different states based on queue */}
            {queue.length === 0 ? (
              /* Initial state - No files yet */
              <Paper
                sx={{
                  p: 4,
                  border: '2px dashed',
                  borderColor: dragActive ? 'primary.main' : 'grey.300',
                  bgcolor: dragActive ? 'action.hover' : 'background.paper',
                  cursor: 'pointer',
                  textAlign: 'center',
                  mb: 2,
                  '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                }}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
                <Typography variant="h6" gutterBottom>Drop BOM Files Here</Typography>
                <Typography variant="body2" color="text.secondary">or click to browse</Typography>
                <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                  CSV, Excel (.xlsx, .xls), Text (.txt)
                </Typography>
                <input
                  id="file-input"
                  type="file"
                  accept=".csv,.xlsx,.xls,.txt"
                  multiple
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
              </Paper>
            ) : queueMetrics.completed === queue.length && queue.length > 0 ? (
              /* All files completed */
              <Paper
                sx={{
                  p: 3,
                  border: '2px solid',
                  borderColor: 'success.main',
                  bgcolor: 'success.light',
                  mb: 2,
                }}
              >
                <Box display="flex" alignItems="center" gap={2}>
                  <CheckCircleIcon sx={{ fontSize: 48, color: 'success.main' }} />
                  <Box flex={1}>
                    <Typography variant="h6" color="success.main" gutterBottom>
                      Upload Complete!
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {queue.length} file{queue.length !== 1 ? 's' : ''} uploaded successfully • {queue.reduce((sum, q) => sum + (q.totalRows || 0), 0)} total rows
                    </Typography>
                  </Box>
                  <Tooltip title="Add more files">
                    <Button
                      variant="outlined"
                      color="success"
                      size="small"
                      startIcon={<CloudUploadIcon />}
                      onClick={() => document.getElementById('file-input')?.click()}
                    >
                      Add More
                    </Button>
                  </Tooltip>
                </Box>
                <input
                  id="file-input"
                  type="file"
                  accept=".csv,.xlsx,.xls,.txt"
                  multiple
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
              </Paper>
            ) : queueMetrics.processing > 0 ? (
              /* Files being processed */
              <Paper
                sx={{
                  p: 3,
                  border: '2px solid',
                  borderColor: 'primary.main',
                  bgcolor: 'primary.light',
                  mb: 2,
                }}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <Box display="flex" alignItems="center" gap={2}>
                  <CircularProgress size={40} />
                  <Box flex={1}>
                    <Typography variant="h6" color="primary.main" gutterBottom>
                      Processing Files...
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {queueMetrics.processing} file{queueMetrics.processing !== 1 ? 's' : ''} in progress • {queueMetrics.completed} completed
                    </Typography>
                  </Box>
                  <Tooltip title="Drop more files here">
                    <IconButton color="primary" onClick={() => document.getElementById('file-input')?.click()}>
                      <CloudUploadIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
                <input
                  id="file-input"
                  type="file"
                  accept=".csv,.xlsx,.xls,.txt"
                  multiple
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
              </Paper>
            ) : (
              /* Files pending or in mapping state */
              <Paper
                sx={{
                  p: 3,
                  border: '2px dashed',
                  borderColor: dragActive ? 'primary.main' : 'warning.main',
                  bgcolor: dragActive ? 'action.hover' : 'warning.light',
                  cursor: 'pointer',
                  mb: 2,
                  '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                }}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <Box display="flex" alignItems="center" gap={2}>
                  <MapIcon sx={{ fontSize: 48, color: 'warning.main' }} />
                  <Box flex={1}>
                    <Typography variant="h6" color="warning.dark" gutterBottom>
                      Files Ready for Mapping
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {queueMetrics.pending} file{queueMetrics.pending !== 1 ? 's' : ''} awaiting column mapping • Drop more files to add
                    </Typography>
                  </Box>
                </Box>
                <input
                  id="file-input"
                  type="file"
                  accept=".csv,.xlsx,.xls,.txt"
                  multiple
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
              </Paper>
            )}
          </Box>

          {/* Section 2: Upload Queue */}
          {queue.length > 0 && (
            <Box ref={mappingRef} sx={{ mb: 3 }}>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <CloudUploadIcon color="primary" />
                <Typography variant="h6">Upload Queue</Typography>
                <Box flex={1} />
                {/* Status badges */}
                <Chip size="small" icon={<HourglassEmptyIcon />} label={queueMetrics.pending} />
                <Chip size="small" icon={<AutorenewIcon />} label={queueMetrics.processing} color="info" />
                <Chip size="small" icon={<CheckCircleIcon />} label={queueMetrics.completed} color="success" />
              </Box>

              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="subtitle2">Queue Progress</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {queueMetrics.completed} / {queue.length} files
                    </Typography>
                  </Box>

                  {/* Main Progress Bar */}
                  <LinearProgress
                    variant="determinate"
                    value={queue.length > 0 ? (queueMetrics.completed / queue.length) * 100 : 0}
                    sx={{
                      height: 8,
                      borderRadius: 1,
                      mb: 2,
                      bgcolor: 'action.disabledBackground',
                      '& .MuiLinearProgress-bar': {
                        bgcolor: queueMetrics.completed === queue.length && queue.length > 0 ? 'success.main' : 'primary.main',
                      },
                    }}
                  />

                  <QueueMetricsCard metrics={queueMetrics} />
                  {queueMetrics.completed > 0 && queueMetrics.pending === 0 && queueMetrics.processing === 0 && (
                    <Typography variant="caption" color="success.main" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
                      Success Rate: 100%
                    </Typography>
                  )}
                </CardContent>
              </Card>

              {queue.map(item => (
                <React.Fragment key={item.id}>
                  <QueueItemCard
                    item={item}
                    onToggleExpand={() => toggleExpand(item.id)}
                    onMappingChange={(source, target) => updateMapping(item.id, source, target)}
                    onConfirm={() => confirmAndEnrich(item.id)}
                    onDelete={() => deleteItem(item.id)}
                    onDownload={() => downloadFile(item)}
                  />

                  {/* Success info box when mapping is complete */}
                  {item.status === 'mapping' && item.columnMappings?.some(m => m.target === 'mpn') && !item.expanded && (
                    <Alert
                      severity="success"
                      icon={<CheckCircleIcon />}
                      sx={{ mb: 2, bgcolor: 'success.light' }}
                    >
                      <AlertTitle>Ready for Enrichment: {item.file.name}</AlertTitle>
                      <Typography variant="body2">
                        {item.totalRows} components ready for enrichment
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                        <strong>Next Step:</strong> Enrich your BOM to get real-time pricing, availability, and datasheets from suppliers.
                      </Typography>
                      <Box display="flex" gap={1} mt={1}>
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          startIcon={<AutoFixHighIcon />}
                          onClick={() => toggleExpand(item.id)}
                        >
                          Enrich Now
                        </Button>
                        <Button size="small" variant="outlined" onClick={() => downloadFile(item)}>
                          View Upload Details
                        </Button>
                      </Box>
                    </Alert>
                  )}
                </React.Fragment>
              ))}
            </Box>
          )}

          {/* Section 3: Enrichment Queue - Show whenever we have a BOM being/was enriched */}
          {enrichingBomId && (phase === 'enriching' || phase === 'analyzing' || phase === 'complete') && (
            <Box ref={enrichmentRef} sx={{ mb: 3 }}>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <AutoFixHighIcon color="primary" />
                <Typography variant="h6">Enrichment Queue</Typography>
                <Box flex={1} />
                {/* Status badges */}
                <Chip size="small" icon={<HourglassEmptyIcon />} label={enrichmentMetrics.pending} />
                <Chip size="small" icon={<AutorenewIcon />} label={enrichmentMetrics.processing} color="info" />
                <Chip size="small" icon={<CheckCircleIcon />} label={enrichmentMetrics.completed} color="success" />
              </Box>

              <Card variant="outlined" sx={{ border: '2px solid', borderColor: enrichmentState?.status === 'completed' ? 'success.main' : 'primary.main' }}>
                <CardContent>
                  {/* Progress header */}
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="subtitle2">Queue Progress</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {(enrichmentState?.enriched_items || 0) + (enrichmentState?.failed_items || 0)} / {enrichmentState?.total_items || 0} components
                    </Typography>
                  </Box>

                  {/* Main Progress Bar */}
                  <LinearProgress
                    variant="determinate"
                    value={enrichmentState?.percent_complete || 0}
                    sx={{
                      height: 8,
                      borderRadius: 1,
                      mb: 2,
                      bgcolor: 'action.disabledBackground',
                      '& .MuiLinearProgress-bar': {
                        bgcolor: enrichmentState?.status === 'completed' ? 'success.main' : 'primary.main',
                      },
                    }}
                  />

                  {/* Progress metrics */}
                  <QueueMetricsCard metrics={enrichmentMetrics} />

                  {/* Success rate */}
                  {enrichmentState && enrichmentState.total_items > 0 && (
                    <Typography variant="caption" color="success.main" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
                      Success Rate: {((enrichmentState.enriched_items / enrichmentState.total_items) * 100).toFixed(0)}%
                    </Typography>
                  )}

                  <Divider sx={{ my: 2 }} />

                  {/* BOM file info */}
                  <Box display="flex" alignItems="center" gap={2} mb={2}>
                    <DescriptionIcon color="action" />
                    <Box flex={1}>
                      <Typography variant="subtitle2">{queue[0]?.file.name || 'BOM File'}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {enrichmentState?.total_items || 0} components • {enrichmentState?.status === 'completed' ? 'Enrichment Complete' : 'Enriching...'}
                      </Typography>
                    </Box>
                    <Button size="small" variant="outlined" onClick={() => navigate(`/boms/${enrichingBomId}`)}>
                      View Details
                    </Button>
                  </Box>

                  {/* Component Queue */}
                  <Typography variant="subtitle2" gutterBottom>
                    Component Queue ({enrichmentState?.total_items || 0})
                  </Typography>
                  <Paper variant="outlined" ref={componentListRef} sx={{ maxHeight: 300, overflow: 'auto', bgcolor: 'grey.50' }}>
                    <List dense disablePadding>
                      {components.length > 0 ? components.map((comp, idx) => (
                        <ListItem
                          key={comp.id}
                          ref={comp.status === 'enriching' ? enrichingItemRef : undefined}
                          sx={{
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                            bgcolor: comp.status === 'enriching' ? 'primary.light' : 'transparent',
                          }}
                        >
                          <Box sx={{ mr: 2 }}>
                            {comp.status === 'enriched' ? (
                              <CheckCircleIcon color="success" fontSize="small" />
                            ) : comp.status === 'enriching' ? (
                              <CircularProgress size={18} />
                            ) : comp.status === 'failed' || comp.status === 'not_found' ? (
                              <ErrorIcon color="error" fontSize="small" />
                            ) : (
                              <Box sx={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid', borderColor: 'grey.300', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Typography variant="caption" color="text.secondary">{idx + 1}</Typography>
                              </Box>
                            )}
                          </Box>
                          <ListItemText
                            primary={<Typography variant="body2" fontWeight={500}>{comp.mpn}</Typography>}
                            secondary={comp.manufacturer || 'Unknown'}
                          />
                          <Chip
                            size="small"
                            label={comp.status === 'enriched' ? 'Done' : comp.status === 'enriching' ? 'Enriching' : comp.status === 'failed' || comp.status === 'not_found' ? 'Failed' : 'Pending'}
                            color={comp.status === 'enriched' ? 'success' : comp.status === 'enriching' ? 'info' : comp.status === 'failed' || comp.status === 'not_found' ? 'error' : 'default'}
                            sx={{ minWidth: 70 }}
                          />
                        </ListItem>
                      )) : (
                        <ListItem>
                          <ListItemText
                            primary="Loading components..."
                            secondary={`BOM ID: ${enrichingBomId}`}
                          />
                        </ListItem>
                      )}
                    </List>
                  </Paper>

                  {/* Stalled/Not Started Alert - When pending with no progress */}
                  {enrichmentState?.status === 'pending' && enrichmentState?.pending_items > 0 && enrichmentState?.enriched_items === 0 && (
                    <Alert
                      severity="warning"
                      sx={{ mt: 2 }}
                      action={
                        <Button
                          color="inherit"
                          size="small"
                          onClick={startEnrichmentManually}
                          disabled={isStartingEnrichment}
                        >
                          {isStartingEnrichment ? 'Starting...' : 'Start Enrichment'}
                        </Button>
                      }
                    >
                      Enrichment has not started. Click to start the enrichment workflow.
                    </Alert>
                  )}

                  {/* Success message when complete */}
                  {enrichmentState?.status === 'completed' && (
                    <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mt: 2 }}>
                      Successfully enriched {enrichmentState.enriched_items} components.
                    </Alert>
                  )}

                  {/* Action buttons */}
                  <Box display="flex" gap={1} mt={2}>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<VisibilityIcon />}
                      onClick={() => navigate(`/boms/${enrichingBomId}`)}
                    >
                      View BOM Details
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<AnalyticsIcon />}
                      onClick={() => navigate('/risk-dashboard')}
                    >
                      Risk Dashboard
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          )}

          {/* Section 4: Analysis Queue */}
          {(phase === 'analyzing' || phase === 'complete') && (
            <Box sx={{ mb: 3 }}>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <AssessmentIcon color="primary" />
                <Typography variant="h6">Analysis Queue</Typography>
                <Box flex={1} />
                <Chip size="small" label={phase === 'complete' ? 'Complete' : 'Analyzing'} color={phase === 'complete' ? 'success' : 'info'} />
              </Box>

              <Card variant="outlined" sx={{ border: '2px solid', borderColor: phase === 'complete' ? 'success.main' : 'info.main' }}>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="subtitle2">Risk Analysis</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {enrichmentState?.total_items || 0} items analyzed
                    </Typography>
                  </Box>

                  {/* Main Progress Bar */}
                  <LinearProgress
                    variant={phase === 'analyzing' ? 'indeterminate' : 'determinate'}
                    value={phase === 'complete' ? 100 : 0}
                    sx={{
                      height: 8,
                      borderRadius: 1,
                      mb: 2,
                      bgcolor: 'action.disabledBackground',
                      '& .MuiLinearProgress-bar': {
                        bgcolor: phase === 'complete' ? 'success.main' : 'info.main',
                      },
                    }}
                  />

                  {/* Analysis status boxes */}
                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={4}>
                      <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', bgcolor: 'grey.50' }}>
                        <HourglassEmptyIcon color="disabled" />
                        <Typography variant="body2" color="text.secondary">Pending</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={4}>
                      <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', bgcolor: 'grey.50' }}>
                        <AutorenewIcon color="disabled" />
                        <Typography variant="body2" color="text.secondary">Analyzing</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={4}>
                      <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', bgcolor: phase === 'complete' ? 'success.light' : 'grey.50', border: phase === 'complete' ? '2px solid' : '1px solid', borderColor: phase === 'complete' ? 'success.main' : 'divider' }}>
                        <CheckCircleIcon color={phase === 'complete' ? 'success' : 'disabled'} />
                        <Typography variant="body2" color={phase === 'complete' ? 'success.main' : 'text.secondary'}>Complete</Typography>
                      </Paper>
                    </Grid>
                  </Grid>

                  {/* Risk Score - using RiskIndicator component */}
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="body2">Overall Risk Score</Typography>
                    <RiskIndicator
                      value={riskMetrics?.score || 0}
                      variant="chip"
                      size="small"
                      showValue
                    />
                  </Box>

                  <Divider sx={{ my: 2 }} />

                  {/* High Risk Components */}
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <WarningIcon color="warning" fontSize="small" />
                    <Typography variant="subtitle2">High Risk Components</Typography>
                  </Box>
                  {(riskMetrics?.highRiskCount || 0) === 0 ? (
                    <Alert severity="success" icon={<CheckCircleIcon />} sx={{ py: 0.5 }}>
                      No high-risk components detected.
                    </Alert>
                  ) : (
                    <Alert severity="warning" sx={{ py: 0.5 }}>
                      {riskMetrics?.highRiskCount} components require attention
                    </Alert>
                  )}

                  <Box display="flex" gap={1} mt={2}>
                    <Button size="small" variant="contained" startIcon={<AnalyticsIcon />} onClick={() => navigate('/risk-dashboard')}>
                      Risk Dashboard
                    </Button>
                    <Button size="small" variant="outlined" startIcon={<NotificationsIcon />} onClick={() => navigate('/alerts')}>
                      View All Alerts
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          )}

          {/* Section 5: BOM Processing Complete */}
          {phase === 'complete' && (
            <Box ref={resultsRef}>
              <Card sx={{ bgcolor: 'success.light', border: '1px solid', borderColor: 'success.main' }}>
                <CardContent>
                  {/* Header */}
                  <Box display="flex" alignItems="center" gap={2} mb={3}>
                    <CheckCircleIcon sx={{ fontSize: 32, color: 'success.main' }} />
                    <Box>
                      <Typography variant="h5" fontWeight={600} color="success.dark">
                        BOM Processing Complete
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {queue[0]?.file.name || 'BOM File'} • {enrichmentState?.total_items || 0} components analyzed
                      </Typography>
                    </Box>
                  </Box>

                  {/* Three-column summary */}
                  <Grid container spacing={3} sx={{ mb: 3 }}>
                    {/* Risk Analysis Column */}
                    <Grid item xs={12} md={4}>
                      <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                        <Box display="flex" alignItems="center" gap={1} mb={2}>
                          <SecurityIcon color="primary" fontSize="small" />
                          <Typography variant="subtitle2">Risk Analysis</Typography>
                        </Box>
                        <Box display="flex" alignItems="center" gap={2} mb={2}>
                          {/* Grade Circle - using GradeBadge component */}
                          <GradeBadge
                            value={riskMetrics?.grade || 'C'}
                            size="large"
                            score={riskMetrics?.score || 0}
                            tooltip={mapRiskScore(riskMetrics?.score || 0).label}
                          />
                          <Box>
                            <Typography variant="h4" fontWeight={600}>{riskMetrics?.score || 0}</Typography>
                            <Typography variant="caption" color="text.secondary">Risk Score</Typography>
                          </Box>
                        </Box>
                        {/* Risk factor bars */}
                        <Box>
                          <Box display="flex" justifyContent="space-between" mb={0.5}>
                            <Typography variant="caption">Lifecycle</Typography>
                          </Box>
                          <LinearProgress variant="determinate" value={riskMetrics?.lifecycleRisk || 0} sx={{ height: 6, borderRadius: 1, mb: 1 }} />
                          <Box display="flex" justifyContent="space-between" mb={0.5}>
                            <Typography variant="caption">Supply Chain</Typography>
                          </Box>
                          <LinearProgress variant="determinate" value={riskMetrics?.supplyChainRisk || 0} color="warning" sx={{ height: 6, borderRadius: 1, mb: 1 }} />
                          <Box display="flex" justifyContent="space-between" mb={0.5}>
                            <Typography variant="caption">Compliance</Typography>
                          </Box>
                          <LinearProgress variant="determinate" value={riskMetrics?.complianceRisk || 0} color="success" sx={{ height: 6, borderRadius: 1 }} />
                        </Box>
                      </Paper>
                    </Grid>

                    {/* Component Status Column */}
                    <Grid item xs={12} md={4}>
                      <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                        <Box display="flex" alignItems="center" gap={1} mb={2}>
                          <TrendingUpIcon color="primary" fontSize="small" />
                          <Typography variant="subtitle2">Component Status</Typography>
                        </Box>
                        <List dense disablePadding>
                          <ListItem sx={{ px: 0 }}>
                            <CheckCircleIcon color="success" sx={{ mr: 1, fontSize: 18 }} />
                            <ListItemText primary="Production Ready" />
                            <Typography variant="body2" fontWeight={600}>{enrichmentState?.enriched_items || 0}</Typography>
                          </ListItem>
                          <ListItem sx={{ px: 0 }}>
                            <WarningIcon color="warning" sx={{ mr: 1, fontSize: 18 }} />
                            <ListItemText primary="Staging" />
                            <Typography variant="body2" fontWeight={600}>0</Typography>
                          </ListItem>
                          <ListItem sx={{ px: 0 }}>
                            <ErrorIcon color="error" sx={{ mr: 1, fontSize: 18 }} />
                            <ListItemText primary="Needs Review" />
                            <Typography variant="body2" fontWeight={600}>{riskMetrics?.highRiskCount || 0}</Typography>
                          </ListItem>
                          <ListItem sx={{ px: 0 }}>
                            <HourglassEmptyIcon color="disabled" sx={{ mr: 1, fontSize: 18 }} />
                            <ListItemText primary="Not Found" />
                            <Typography variant="body2" fontWeight={600}>{enrichmentState?.not_found_items || 0}</Typography>
                          </ListItem>
                        </List>
                      </Paper>
                    </Grid>

                    {/* Alerts Column */}
                    <Grid item xs={12} md={4}>
                      <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                        <Box display="flex" alignItems="center" gap={1} mb={2}>
                          <NotificationsIcon color="primary" fontSize="small" />
                          <Typography variant="subtitle2">Alerts Generated</Typography>
                        </Box>
                        <Box textAlign="center" py={2}>
                          <Typography variant="h2" fontWeight={700} color="text.primary">
                            {riskMetrics?.alertCount || 0}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {riskMetrics?.highRiskCount || 0} high-risk components
                          </Typography>
                        </Box>
                        {(riskMetrics?.alertCount || 0) === 0 ? (
                          <Alert severity="success" icon={<CheckCircleIcon />} sx={{ py: 0.5 }}>
                            No critical alerts
                          </Alert>
                        ) : (
                          <Alert severity="warning" sx={{ py: 0.5 }}>
                            Review alerts recommended
                          </Alert>
                        )}
                      </Paper>
                    </Grid>
                  </Grid>

                  {/* Quick Actions */}
                  <Divider sx={{ mb: 2 }} />
                  <Typography variant="subtitle2" gutterBottom>Quick Actions</Typography>
                  <Box display="flex" gap={2} flexWrap="wrap">
                    <Button
                      variant="contained"
                      startIcon={<VisibilityIcon />}
                      onClick={() => navigate(`/boms/${enrichingBomId}`)}
                    >
                      View Full BOM Details
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<AnalyticsIcon />}
                      onClick={() => navigate('/risk-dashboard')}
                    >
                      Risk Dashboard
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<NotificationsIcon />}
                      onClick={() => navigate('/alerts')}
                    >
                      Alert Center
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<CloudUploadIcon />}
                      onClick={handleReset}
                    >
                      Upload Another BOM
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default StaffBOMWorkflow;
