/**
 * BOM Upload Workflow Component
 *
 * Complete BOM upload interface with:
 * - File upload (drag & drop)
 * - Project selection
 * - Temporal workflow integration
 * - Real-time progress tracking
 * - Status updates during processing
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useNotify, useDataProvider, useRefresh } from 'react-admin';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Stepper,
  Step,
  StepLabel,
  LinearProgress,
  Alert,
  Grid,
  Paper,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  Divider,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Autorenew as ProcessingIcon,
  Description as FileIcon,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { supabase } from '../providers/dataProvider';
import { Events } from '../services/eventPublisher';

interface WorkflowStatus {
  workflow_id: string;
  status: 'pending' | 'parsing' | 'enriching' | 'validating' | 'completing' | 'completed' | 'failed';
  progress: number;
  current_step: string;
  total_components: number;
  processed_components: number;
  errors: string[];
  warnings: string[];
  start_time: string;
  end_time?: string;
}

interface UploadedFile {
  name: string;
  size: number;
  type: string;
  preview?: string;
  raw?: File;
}

type QueueStatus = 'pending' | 'uploading' | 'confirming' | 'processing' | 'completed' | 'error';

interface QueueItem {
  file: File;
  status: QueueStatus;
  jobId?: string;
  error?: string;
  totalItems?: number;
  // For pause-for-mapping flow
  columnMappings?: Array<{ source: string; target: string }>;
  uploadResponse?: { job_id: string; total_items: number };
}

const steps = [
  'Upload File',
  'Select Project',
  'Parse BOM',
  'Enrich Components',
  'Validate Data',
  'Complete'
];

export const BOMUploadWorkflow: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [pauseForMapping, setPauseForMapping] = useState<boolean>(false);
  const tenantId = localStorage.getItem('tenant_id') || 'a1111111-1111-1111-1111-111111111111';
  const defaultProjectId = localStorage.getItem('project_id');
  const [selectedProject, setSelectedProject] = useState<string | null>(defaultProjectId || null);
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadProjects = async () => {
      setProjectsLoading(true);
      setProjectsError(null);

      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (!isMounted) {
        return;
      }

      if (error) {
        setProjectsError(error.message);
        setProjects([]);
      } else {
        setProjects(data || []);
        if (!selectedProject && data && data.length > 0) {
          setSelectedProject(data[0].id);
        }
      }

      setProjectsLoading(false);
    };

    loadProjects();

    return () => {
      isMounted = false;
    };
  }, [tenantId]);
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus | null>(null);
  const [lastJobRecordId, setLastJobRecordId] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

  const notify = useNotify();
  const dataProvider = useDataProvider();
  const refresh = useRefresh();

  /**
   * File drop handler
   */
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) {
      notify('Please upload a valid CSV, Excel, or XML file', { type: 'warning' });
      return;
    }

    const file = acceptedFiles[0];
    setUploadedFile({
      name: file.name,
      size: file.size,
      type: file.type,
      preview: URL.createObjectURL(file),
      raw: file,
    });
    setActiveStep(1);
    notify(`File "${file.name}" uploaded successfully`, { type: 'success' });
  }, [notify]);

  // New: queue-based drop handler (multi-file)
  const handleDropToQueue = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) {
      notify('Please upload a valid CSV, Excel, or XML file', { type: 'warning' });
      return;
    }
    const items: QueueItem[] = acceptedFiles.map((f) => ({ file: f, status: 'pending' }));
    setQueue((prev) => [...prev, ...items]);
    if (!uploadedFile) {
      const f = acceptedFiles[0];
      setUploadedFile({ name: f.name, size: f.size, type: f.type, preview: URL.createObjectURL(f), raw: f });
      setActiveStep(1);
    }
    notify(`${acceptedFiles.length} file(s) added to queue`, { type: 'success' });
  }, [notify, uploadedFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDropToQueue,
    accept: {
      'text/csv': ['.csv', '.tsv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/xml': ['.xml'],
      'text/plain': ['.txt'],
      'text/xml': ['.xml'],
    },
    maxFiles: 50,
    multiple: true,
  });

  /**
   * Start BOM upload workflow
   */
  const startWorkflow = async () => {
    if (queue.length === 0) {
      notify('Please add at least one file', { type: 'warning' });
      return;
    }
    setIsProcessing(true);
    setActiveStep(2);
    const CNS_API_URL = `${import.meta.env.VITE_CNS_API_URL || 'http://localhost:27800'}/api`;
    let userEmail: string | undefined;
    let currentUserId: string | undefined;
    try {
      const { data } = await supabase.auth.getUser();
      userEmail = data?.user?.email || undefined;
      currentUserId = data?.user?.id || undefined;
    } catch {}

    for (let i = 0; i < queue.length; i++) {
      if (queue[i].status !== 'pending') continue;
      const f = queue[i].file;
      try {
        setQueue(prev => prev.map((it, idx) => idx === i ? { ...it, status: 'uploading' } : it));
        const formData = new FormData();
        formData.append('file', f);
        // Tenant context for audit; avoid mismatched numeric fields in CNS (organization_id/project_id are integers there)
        formData.append('tenant_id', tenantId);
        // Do NOT append organization_id/project_id here to avoid type mismatch (Supabase uses UUIDs)
        formData.append('source', 'customer');
        if (userEmail) formData.append('user_email', userEmail);
        const uploadResp = await fetch(`${CNS_API_URL}/bom/upload`, { method: 'POST', body: formData });
        const uploadData = await uploadResp.json();
        if (!uploadResp.ok) throw new Error(uploadData.detail || 'Upload failed');
        const detected = uploadData.detected_columns || {};
        const mappings: Array<{ source: string; target: string }> = [];
        Object.entries(detected).forEach(([field, col]) => { if (col) mappings.push({ source: String(col), target: String(field) }); });

        if (pauseForMapping) {
          // Pause: store mappings and wait for user to confirm
          setQueue(prev => prev.map((it, idx) => idx === i ? { ...it, status: 'mapping', totalItems: uploadData.total_items, uploadResponse: { job_id: uploadData.job_id, total_items: uploadData.total_items }, columnMappings: mappings } : it));
        } else {
          // Auto-confirm
          setQueue(prev => prev.map((it, idx) => idx === i ? { ...it, status: 'confirming', totalItems: uploadData.total_items } : it));
          const confirmed: Record<string, string> = {};
          mappings.forEach(m => { if (m.target !== 'ignore') confirmed[m.target] = m.source; });
          const confirmResp = await fetch(`${CNS_API_URL}/bom/jobs/${uploadData.job_id}/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ column_mappings: confirmed }) });
          if (!confirmResp.ok) { const err = await confirmResp.json(); throw new Error(err.detail || 'Confirmation failed'); }
          setQueue(prev => prev.map((it, idx) => idx === i ? { ...it, status: 'processing', jobId: uploadData.job_id } : it));

          // Publish BOM uploaded event to RabbitMQ
          try {
            await Events.BOM.uploaded(
              uploadData.job_id,
              tenantId,
              currentUserId || userEmail || 'unknown',
              f.name,
              uploadData.total_items
            );
          } catch (eventError) {
            console.warn('Failed to publish BOM uploaded event:', eventError);
          }

          // Resolve Supabase primary key id for job to enable portal show route
          try {
            const { data: jobRow } = await supabase
              .from('bom_jobs')
              .select('id')
              .eq('job_id', uploadData.job_id)
              .maybeSingle();
            if (jobRow?.id) setLastJobRecordId(jobRow.id as number);
          } catch {}

          const ok = await pollJobUntilDone(uploadData.job_id);
          setQueue(prev => prev.map((it, idx) => idx === i ? { ...it, status: ok ? 'completed' : 'error', error: ok ? undefined : 'Timed out' } : it));
        }
      } catch (e: any) {
        setQueue(prev => prev.map((it, idx) => idx === i ? { ...it, status: 'error', error: e?.message || 'Failed' } : it));
      }
    }
    setIsProcessing(false);
    setActiveStep(5);
    refresh();
  };

  const pollJobUntilDone = async (jobId: string): Promise<boolean> => {
    const CNS_API_URL = `${import.meta.env.VITE_CNS_API_URL || 'http://localhost:27800'}/api`;
    for (let i = 0; i < 300; i++) {
      const resp = await fetch(`${CNS_API_URL}/bom/status/${jobId}`);
      const status = await resp.json();
      setWorkflowStatus({
        workflow_id: jobId,
        status: status.status,
        progress: status.progress,
        current_step: status.status === 'processing' ? 'Enriching Components' : status.status,
        total_components: status.total_items,
        processed_components: status.items_processed,
        errors: status.error_message ? [status.error_message] : [],
        warnings: [],
        start_time: status.started_at,
        end_time: status.completed_at,
      });
      if (status.status === 'completed') return true;
      if (status.status === 'failed') return false;
      await new Promise(r => setTimeout(r, 2000));
    }
    return false;
  };

  // Update mapping for a specific queue item
  const updateQueueItemMapping = (queueIndex: number, sourceColumn: string, target: string) => {
    setQueue((prev) =>
      prev.map((item, idx) => {
        if (idx === queueIndex && item.columnMappings) {
          return {
            ...item,
            columnMappings: item.columnMappings.map((m) =>
              m.source === sourceColumn ? { ...m, target } : m
            ),
          };
        }
        return item;
      })
    );
  };

  // Validate mappings for a queue item
  const validateMappings = (item: QueueItem): { valid: boolean; error?: string } => {
    if (!item.columnMappings) {
      return { valid: false, error: 'No column mappings found' };
    }
    const hasMPN = item.columnMappings.some((m) => m.target === 'mpn');
    if (!hasMPN) {
      return { valid: false, error: 'At least one column must be mapped to "Part Number (MPN)"' };
    }
    return { valid: true };
  };

  // Manual Confirm for an item in mapping state
  const confirmDetectedMappings = async (index: number) => {
    const CNS_API_URL = `${import.meta.env.VITE_CNS_API_URL || 'http://localhost:27800'}/api`;
    const item = queue[index];
    if (!item || item.status !== 'mapping' || !item.uploadResponse) return;

    // Validate mappings
    const validation = validateMappings(item);
    if (!validation.valid) {
      notify(validation.error || 'Invalid mappings', { type: 'error' });
      return;
    }

    try {
      const confirmed: Record<string, string> = {};
      (item.columnMappings || []).forEach(m => { if (m.target !== 'ignore') confirmed[m.target] = m.source; });
      setQueue(prev => prev.map((it, idx) => idx === index ? { ...it, status: 'confirming' } : it));
      const resp = await fetch(`${CNS_API_URL}/bom/jobs/${item.uploadResponse.job_id}/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ column_mappings: confirmed }) });
      if (!resp.ok) { const er = await resp.json(); throw new Error(er.detail || 'Confirmation failed'); }
      setQueue(prev => prev.map((it, idx) => idx === index ? { ...it, status: 'processing', jobId: item.uploadResponse!.job_id } : it));
      try {
        const { data: jobRow } = await supabase
          .from('bom_jobs')
          .select('id')
          .eq('job_id', item.uploadResponse!.job_id)
          .maybeSingle();
        if (jobRow?.id) setLastJobRecordId(jobRow.id as number);
      } catch {}
      const ok = await pollJobUntilDone(item.uploadResponse!.job_id);
      setQueue(prev => prev.map((it, idx) => idx === index ? { ...it, status: ok ? 'completed' : 'error', error: ok ? undefined : 'Timed out' } : it));
    } catch (e: any) {
      setQueue(prev => prev.map((it, idx) => idx === index ? { ...it, status: 'error', error: e?.message || 'Failed' } : it));
    }
  };

  /**
   * Poll workflow status
   */
  const startStatusPolling = (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_CNS_API_URL || 'http://localhost:27800'}/api/bom/status/${jobId}`);
        const status = await response.json();
        // Map to local status shape
        setWorkflowStatus({
          workflow_id: jobId,
          status: status.status,
          progress: status.progress,
          current_step: status.status === 'processing' ? 'Enriching Components' : status.status,
          total_components: status.total_items,
          processed_components: status.items_processed,
          errors: status.error_message ? [status.error_message] : [],
          warnings: [],
          start_time: status.started_at,
          end_time: status.completed_at,
        });

        if (status.status === 'processing') setActiveStep(3);
        else if (status.status === 'completed') {
          setActiveStep(5);
          stopStatusPolling();
          setIsProcessing(false);
          notify('BOM upload completed successfully!', { type: 'success' });
          refresh();
        } else if (status.status === 'failed') {
          stopStatusPolling();
          setIsProcessing(false);
          notify('BOM upload workflow failed', { type: 'error' });
        }
      } catch (error) {
        console.error('Error polling workflow status:', error);
      }
    }, 2000); // Poll every 2 seconds

    setPollInterval(interval);
  };

  /**
   * Stop polling
   */
  const stopStatusPolling = () => {
    if (pollInterval) {
      clearInterval(pollInterval);
      setPollInterval(null);
    }
  };

  /**
   * Reset workflow
   */
  const resetWorkflow = () => {
    stopStatusPolling();
    setActiveStep(0);
    setUploadedFile(null);
    setSelectedProject(null);
    setWorkflowStatus(null);
    setIsProcessing(false);
  };

  /**
   * Render mapping editor for a queue item
   */
  const renderMappingEditor = (item: QueueItem, queueIndex: number) => {
    if (!item.columnMappings || !item.uploadResponse) return null;

    return (
      <Card sx={{ mt: 2, mb: 2, border: '2px solid', borderColor: 'primary.main' }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Review Column Mappings: {item.file.name}</Typography>
            <Chip
              label={`${item.uploadResponse.total_items} items`}
              color="primary"
              size="small"
            />
          </Box>

          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Auto-detected columns:</strong> Review and adjust the mappings below.
              At least one column must be mapped to "Part Number (MPN)".
            </Typography>
          </Alert>

          <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.100' }}>
                  <TableCell><strong>File Column</strong></TableCell>
                  <TableCell><strong>Maps To</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {item.columnMappings.map((mapping, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {mapping.source}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <FormControl size="small" fullWidth sx={{ minWidth: 200 }}>
                        <Select
                          value={mapping.target}
                          onChange={(e) =>
                            updateQueueItemMapping(queueIndex, mapping.source, e.target.value)
                          }
                        >
                          <MenuItem value="ignore">
                            <em>Ignore</em>
                          </MenuItem>
                          <MenuItem value="mpn">Part Number (MPN)</MenuItem>
                          <MenuItem value="manufacturer">Manufacturer</MenuItem>
                          <MenuItem value="quantity">Quantity</MenuItem>
                          <MenuItem value="reference">Reference Designator</MenuItem>
                          <MenuItem value="description">Description</MenuItem>
                        </Select>
                      </FormControl>
                    </TableCell>
                    <TableCell>
                      {mapping.target !== 'ignore' ? (
                        <Chip label="Mapped" size="small" color="success" />
                      ) : (
                        <Chip label="Ignored" size="small" color="default" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              {item.columnMappings.filter((m) => m.target !== 'ignore').length} column(s) mapped •{' '}
              {item.columnMappings.filter((m) => m.target === 'ignore').length} ignored
            </Typography>
            <Button
              variant="contained"
              color="primary"
              onClick={() => confirmDetectedMappings(queueIndex)}
              startIcon={<SuccessIcon />}
            >
              Confirm Mappings & Process
            </Button>
          </Box>
        </CardContent>
      </Card>
    );
  };

  /**
   * Get status color
   */
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'parsing':
      case 'enriching':
      case 'validating':
      case 'completing':
        return 'info';
      default:
        return 'default';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom fontWeight={700}>
        <UploadIcon sx={{ fontSize: 32, verticalAlign: 'middle', mr: 1 }} />
        BOM Upload Workflow
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 4 }}>
        Upload your Bill of Materials (BOM) file and track the enrichment process in real-time
      </Typography>

      {/* Stepper */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Stepper activeStep={activeStep} alternativeLabel>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        {/* Left Column - Upload & Configuration */}
        <Grid item xs={12} md={6}>
          {/* File Upload */}
          {activeStep === 0 && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Step 1: Upload BOM File
                </Typography>
                <Paper
                  {...getRootProps()}
                  sx={{
                    p: 4,
                    border: '2px dashed',
                    borderColor: isDragActive ? 'primary.main' : 'grey.300',
                    bgcolor: isDragActive ? 'action.hover' : 'background.paper',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.2s',
                    '&:hover': {
                      borderColor: 'primary.main',
                      bgcolor: 'action.hover',
                    },
                  }}
                >
                  <input {...getInputProps()} />
                  <UploadIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    {isDragActive ? 'Drop the file here' : 'Drag & drop BOM file here'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    or click to browse
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
                    Supported formats: CSV, Excel (.xlsx, .xls), XML
                  </Typography>
                </Paper>
              </CardContent>
            </Card>
          )}

          {/* Project Selection */}
          {activeStep >= 1 && !isProcessing && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Step 2: Select Project
                </Typography>
                <Alert severity="info" sx={{ mb: 2 }}>
                  Choose an existing project to associate with this upload, or select “No Project”.
                </Alert>
                <FormControl fullWidth size="small" disabled={isProcessing || projectsLoading}>
                  <InputLabel id="workflow-project-select-label">Project</InputLabel>
                  <Select
                    labelId="workflow-project-select-label"
                    label="Project"
                    value={selectedProject ?? ''}
                    onChange={(event) => {
                      const value = event.target.value as string;
                      setSelectedProject(value ? value : null);
                    }}
                  >
                    <MenuItem value="">
                      <em>No Project</em>
                    </MenuItem>
                    {projects.map((project) => (
                      <MenuItem key={project.id} value={project.id}>
                        {project.name}
                      </MenuItem>
                    ))}
                  </Select>
        </FormControl>
        {projectsLoading && (
          <Box mt={2}>
            <LinearProgress />
          </Box>
        )}
        {projectsError && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Failed to load projects: {projectsError}
          </Alert>
        )}
        <Box mt={2} display="flex" alignItems="center" gap={1}>
          <input
            type="checkbox"
            id="pause-mapping-workflow"
            checked={pauseForMapping}
            onChange={(e) => setPauseForMapping(e.target.checked)}
            disabled={isProcessing}
          />
          <label htmlFor="pause-mapping-workflow">Pause for manual mapping</label>
        </Box>
      </CardContent>
    </Card>
  )}

          {/* Upload Queue */}
          {queue.length > 0 && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Upload Queue</Typography>
                <List dense>
                  {queue.map((item, idx) => (
                    <React.Fragment key={idx}>
                      <ListItem>
                        <ListItemText
                          primary={item.file.name}
                          secondary={`${item.status}${item.totalItems ? ` • ${item.totalItems} items` : ''}`}
                        />
                        {item.jobId && <Chip size="small" label={item.jobId.substring(0, 8) + '...'} />}
                      </ListItem>
                      {/* Show mapping editor for files in 'mapping' status */}
                      {pauseForMapping && item.status === 'mapping' && (
                        <Box px={2} pb={2}>
                          {renderMappingEditor(item, idx)}
                        </Box>
                      )}
                    </React.Fragment>
                  ))}
                </List>
                <Box display="flex" justifyContent="space-between" gap={1}>
                  {!isProcessing && queue.some(q => q.status === 'error') && (
                    <Button
                      variant="outlined"
                      onClick={() => {
                        setQueue(prev => prev.map(it => it.status === 'error' ? { ...it, status: 'pending', error: undefined } : it));
                        startWorkflow();
                      }}
                    >
                      Retry Failed
                    </Button>
                  )}
                  <Box flex={1} />
                  <Button variant="outlined" disabled={isProcessing} onClick={() => setQueue([])}>Clear All</Button>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={startWorkflow}
                    startIcon={<ProcessingIcon />}
                    disabled={isProcessing || queue.length === 0}
                  >
                    Process {queue.length} File{queue.length !== 1 ? 's' : ''}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          )}
        </Grid>

        {/* Right Column - Progress & Status */}
        <Grid item xs={12} md={6}>
          {/* Workflow Progress */}
          {workflowStatus && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">Workflow Progress</Typography>
                  <Chip
                    label={workflowStatus.status.toUpperCase()}
                    color={getStatusColor(workflowStatus.status) as any}
                    icon={
                      workflowStatus.status === 'completed' ? (
                        <SuccessIcon />
                      ) : workflowStatus.status === 'failed' ? (
                        <ErrorIcon />
                      ) : (
                        <ProcessingIcon />
                      )
                    }
                  />
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {workflowStatus.current_step}
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {workflowStatus.progress}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={workflowStatus.progress}
                    sx={{ height: 10, borderRadius: 5 }}
                  />
                </Box>

                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Total Components
                    </Typography>
                    <Typography variant="h6">
                      {workflowStatus.total_components}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Processed
                    </Typography>
                    <Typography variant="h6">
                      {workflowStatus.processed_components}
                    </Typography>
                  </Grid>
                </Grid>

                {isProcessing && (
                  <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
                    <CircularProgress size={24} sx={{ mr: 2 }} />
                    <Typography variant="body2" color="text.secondary">
                      Processing components...
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          )}

          {/* Errors & Warnings */}
          {workflowStatus && (workflowStatus.errors.length > 0 || workflowStatus.warnings.length > 0) && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Issues Detected
                </Typography>
                <List dense>
                  {workflowStatus.errors.map((error, index) => (
                    <React.Fragment key={`error-${index}`}>
                      <ListItem>
                        <ErrorIcon color="error" sx={{ mr: 1 }} />
                        <ListItemText
                          primary={error}
                          primaryTypographyProps={{ color: 'error' }}
                        />
                      </ListItem>
                      {index < workflowStatus.errors.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                  {workflowStatus.warnings.map((warning, index) => (
                    <React.Fragment key={`warning-${index}`}>
                      <ListItem>
                        <ErrorIcon color="warning" sx={{ mr: 1 }} />
                        <ListItemText
                          primary={warning}
                          primaryTypographyProps={{ color: 'warning.main' }}
                        />
                      </ListItem>
                      {index < workflowStatus.warnings.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              </CardContent>
            </Card>
          )}

          {/* Completion Actions */}
          {workflowStatus?.status === 'completed' && (
            <Card>
              <CardContent>
                <Alert severity="success" sx={{ mb: 2 }}>
                  BOM upload completed successfully!
                </Alert>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Button
                      variant="outlined"
                      fullWidth
                      onClick={resetWorkflow}
                    >
                      Upload Another
                    </Button>
                  </Grid>
                  <Grid item xs={6}>
                    <Button
                      variant="contained"
                      fullWidth
                      href="/boms"
                    >
                      View BOMs
                    </Button>
                  </Grid>
                  {lastJobRecordId && (
                    <Grid item xs={12}>
                      <Button
                        variant="contained"
                        color="secondary"
                        fullWidth
                        href={`/bom_jobs/${lastJobRecordId}/show`}
                      >
                        View Job Details
                      </Button>
                    </Grid>
                  )}
                </Grid>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>
    </Box>
  );
};
