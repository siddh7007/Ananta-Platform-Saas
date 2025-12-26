/**
 * BOM Upload Workflow Component - V2
 *
 * Auto-uses current project from Dashboard
 *
 * Features:
 * - File upload (drag & drop, multi-file)
 * - Auto column mapping with manual review
 * - Multi-file merge or separate upload
 * - Real-time progress tracking
 * - RabbitMQ event publishing
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useNotify, useRefresh, useRedirect } from 'react-admin';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  LinearProgress,
  Alert,
  Chip,
  TextField,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  FormControl,
  Select,
  MenuItem,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormLabel,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Description as FileIcon,
  FolderOpen as ProjectIcon,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { supabase } from '../providers/dataProvider';
import { Events } from '../services/eventPublisher';

interface QueueItem {
  file: File;
  status: 'pending' | 'uploading' | 'mapping' | 'confirming' | 'processing' | 'completed' | 'error';
  jobId?: string;
  error?: string;
  totalItems?: number;
  columnMappings?: Array<{ source: string; target: string }>;
  uploadResponse?: { job_id: string; total_items: number };
}

export const BOMUploadWorkflow: React.FC = () => {
  const notify = useNotify();
  const refresh = useRefresh();
  const redirect = useRedirect();

  // Auto-use current project from Dashboard
  const currentProjectId = localStorage.getItem('current_project_id');
  const tenantId = localStorage.getItem('tenant_id') || 'a1111111-1111-1111-1111-111111111111';

  // State
  const [currentProject, setCurrentProject] = useState<{ id: string; name: string } | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [pauseForMapping, setPauseForMapping] = useState<boolean>(true); // Default ON
  const [isProcessing, setIsProcessing] = useState(false);
  const [multiFileStrategy, setMultiFileStrategy] = useState<'separate' | 'merge'>('separate');
  const [mergedBomName, setMergedBomName] = useState('');

  // Component mount - Log environment
  useEffect(() => {
    console.log('='.repeat(60));
    console.log('[BOM Upload] Component mounted');
    console.log('[BOM Upload] Environment:', {
      CNS_API_URL: import.meta.env.VITE_CNS_API_URL || 'http://localhost:27800',
      SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
      NODE_ENV: import.meta.env.MODE,
    });
    console.log('[BOM Upload] Current Project ID:', currentProjectId);
    console.log('[BOM Upload] Tenant ID:', tenantId);
    console.log('='.repeat(60));
  }, []);

  // Load current project name
  useEffect(() => {
    if (!currentProjectId) {
      console.warn('[BOM Upload] No project selected, redirecting to dashboard');
      notify('No project selected. Please select a project from Dashboard first.', { type: 'warning' });
      redirect('/');
      return;
    }

    const loadProject = async () => {
      console.log(`[BOM Upload] Loading project: ${currentProjectId}`);

      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .eq('id', currentProjectId)
        .maybeSingle();

      if (error || !data) {
        console.error('[BOM Upload] Failed to load project:', error);
        notify('Failed to load current project', { type: 'error' });
        return;
      }

      console.log('[BOM Upload] Project loaded:', data);
      setCurrentProject(data);
    };

    loadProject();
  }, [currentProjectId, notify, redirect]);

  // File dropzone
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newItems: QueueItem[] = acceptedFiles.map(file => ({
      file,
      status: 'pending',
    }));
    setQueue(prev => [...prev, ...newItems]);

    // Auto-generate merged BOM name from first file if not set
    if (acceptedFiles.length > 1 && !mergedBomName) {
      const firstName = acceptedFiles[0].name.replace(/\.[^/.]+$/, '');
      setMergedBomName(`${firstName}_merged`);
    }
  }, [mergedBomName]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    multiple: true,
  });

  // Upload workflow
  const startWorkflow = async () => {
    if (!currentProjectId) {
      notify('No project selected', { type: 'error' });
      return;
    }

    if (queue.length === 0) {
      notify('No files to upload', { type: 'warning' });
      return;
    }

    setIsProcessing(true);

    try {
      const CNS_API_URL = `${import.meta.env.VITE_CNS_API_URL || 'http://localhost:27800'}/api`;

      // Multi-file merge strategy
      if (queue.length > 1 && multiFileStrategy === 'merge') {
        await handleMergeUpload(CNS_API_URL);
      } else {
        // Upload separately
        for (let idx = 0; idx < queue.length; idx++) {
          await uploadSingleFile(idx, CNS_API_URL);
        }
      }

      notify('All files uploaded successfully!', { type: 'success' });
    } catch (error: any) {
      notify(`Upload failed: ${error.message}`, { type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMergeUpload = async (apiUrl: string) => {
    // TODO: Implement server-side merge endpoint
    notify('Multi-file merge not yet implemented on server', { type: 'warning' });

    // For now, fall back to separate uploads
    for (let idx = 0; idx < queue.length; idx++) {
      await uploadSingleFile(idx, apiUrl);
    }
  };

  const uploadSingleFile = async (queueIndex: number, apiUrl: string) => {
    const item = queue[queueIndex];

    console.log(`[BOM Upload] Starting upload for file: ${item.file.name}`);
    console.log(`[BOM Upload] API URL: ${apiUrl}/bom/upload`);
    console.log(`[BOM Upload] Project ID: ${currentProjectId}`);
    console.log(`[BOM Upload] Tenant ID: ${tenantId}`);

    setQueue(prev => prev.map((it, idx) => idx === queueIndex ? { ...it, status: 'uploading' } : it));

    const formData = new FormData();
    formData.append('file', item.file);
    formData.append('project_id', currentProjectId!);
    formData.append('tenant_id', tenantId);

    try {
      console.log(`[BOM Upload] Sending request...`);

      const response = await fetch(`${apiUrl}/bom/upload`, {
        method: 'POST',
        body: formData,
      });

      console.log(`[BOM Upload] Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        // Try to parse error details from response
        let errorMessage = `Upload failed (${response.status})`;
        let errorDetails = '';

        try {
          const errorData = await response.json();
          console.error('[BOM Upload] Error response:', errorData);

          // Parse error message from various formats
          if (errorData.detail) {
            if (typeof errorData.detail === 'string') {
              errorMessage = errorData.detail;
            } else if (Array.isArray(errorData.detail)) {
              // FastAPI validation errors are arrays
              errorMessage = errorData.detail.map((err: any) => {
                if (typeof err === 'string') return err;
                if (err.msg && err.loc) {
                  // FastAPI format: { msg: "...", loc: ["field", ...], type: "..." }
                  return `${err.loc.join('.')}: ${err.msg}`;
                }
                return JSON.stringify(err);
              }).join('\n');
            } else {
              // Object or other type
              errorMessage = JSON.stringify(errorData.detail, null, 2);
            }
          } else if (errorData.error) {
            if (typeof errorData.error === 'string') {
              errorMessage = errorData.error;
            } else {
              errorMessage = JSON.stringify(errorData.error, null, 2);
            }
          } else if (errorData.message) {
            errorMessage = errorData.message;
          }

          // Add any additional error details
          if (errorData.errors) {
            errorDetails = JSON.stringify(errorData.errors);
          }
        } catch (parseError) {
          // If can't parse JSON, try to get text
          try {
            const errorText = await response.text();
            console.error('[BOM Upload] Error text:', errorText);
            if (errorText) {
              errorMessage = `${errorMessage}: ${errorText.substring(0, 200)}`;
            }
          } catch (textError) {
            console.error('[BOM Upload] Could not parse error response');
          }
        }

        const fullError = errorDetails ? `${errorMessage}\n\nDetails: ${errorDetails}` : errorMessage;
        throw new Error(fullError);
      }

      const result = await response.json();
      console.log('[BOM Upload] Upload successful:', result);

      setQueue(prev => prev.map((it, idx) => idx === queueIndex ? {
        ...it,
        status: pauseForMapping ? 'mapping' : 'confirming',
        uploadResponse: result,
        totalItems: result.total_items,
        columnMappings: result.column_mappings || [],
      } : it));

      // Publish RabbitMQ event
      await Events.BOM.uploaded(
        result.job_id,
        currentProjectId!,
        tenantId,
        item.file.name,
        result.total_items
      );

      if (!pauseForMapping) {
        // Auto-confirm mappings
        await confirmDetectedMappings(queueIndex);
      }
    } catch (error: any) {
      console.error(`[BOM Upload] Upload error for ${item.file.name}:`, error);
      const errorMessage = error.message || 'Unknown upload error';

      setQueue(prev => prev.map((it, idx) => idx === queueIndex ? {
        ...it,
        status: 'error',
        error: errorMessage,
      } : it));

      notify(`Upload failed: ${errorMessage}`, { type: 'error' });
    }
  };

  const confirmDetectedMappings = async (queueIndex: number) => {
    const CNS_API_URL = `${import.meta.env.VITE_CNS_API_URL || 'http://localhost:27800'}/api`;
    const item = queue[queueIndex];

    if (!item.uploadResponse) {
      console.error('[BOM Upload] No upload response found for confirmation');
      return;
    }

    console.log(`[BOM Upload] Confirming mappings for job: ${item.uploadResponse.job_id}`);

    // Validate mappings
    const hasMPN = item.columnMappings?.some(m => m.target === 'mpn');
    if (!hasMPN) {
      const errorMsg = 'Part Number (MPN) column is required';
      console.error('[BOM Upload]', errorMsg);
      notify(errorMsg, { type: 'error' });
      return;
    }

    try {
      const confirmed: Record<string, string> = {};
      (item.columnMappings || []).forEach(m => {
        if (m.target !== 'ignore') confirmed[m.target] = m.source;
      });

      console.log('[BOM Upload] Column mappings:', confirmed);

      setQueue(prev => prev.map((it, idx) => idx === queueIndex ? { ...it, status: 'confirming' } : it));

      console.log(`[BOM Upload] Sending confirmation request...`);

      const response = await fetch(`${CNS_API_URL}/bom/jobs/${item.uploadResponse.job_id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ column_mappings: confirmed }),
      });

      console.log(`[BOM Upload] Confirmation response: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        let errorMessage = `Confirmation failed (${response.status})`;
        try {
          const errorData = await response.json();
          console.error('[BOM Upload] Confirmation error:', errorData);

          // Parse error message from various formats
          if (errorData.detail) {
            if (typeof errorData.detail === 'string') {
              errorMessage = errorData.detail;
            } else if (Array.isArray(errorData.detail)) {
              errorMessage = errorData.detail.map((err: any) => {
                if (typeof err === 'string') return err;
                if (err.msg && err.loc) return `${err.loc.join('.')}: ${err.msg}`;
                return JSON.stringify(err);
              }).join('\n');
            } else {
              errorMessage = JSON.stringify(errorData.detail, null, 2);
            }
          } else if (errorData.error) {
            errorMessage = typeof errorData.error === 'string' ? errorData.error : JSON.stringify(errorData.error, null, 2);
          } else if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch (e) {
          const errorText = await response.text();
          console.error('[BOM Upload] Confirmation error text:', errorText);
          if (errorText) errorMessage = `${errorMessage}: ${errorText.substring(0, 200)}`;
        }
        throw new Error(errorMessage);
      }

      console.log('[BOM Upload] Confirmation successful, starting job processing');

      setQueue(prev => prev.map((it, idx) => idx === queueIndex ? {
        ...it,
        status: 'processing',
        jobId: item.uploadResponse!.job_id,
      } : it));

      // Poll for completion
      await pollJobStatus(item.uploadResponse.job_id, queueIndex);

    } catch (error: any) {
      console.error('[BOM Upload] Confirmation error:', error);
      const errorMessage = error.message || 'Unknown confirmation error';

      setQueue(prev => prev.map((it, idx) => idx === queueIndex ? {
        ...it,
        status: 'error',
        error: errorMessage,
      } : it));

      notify(`Confirmation failed: ${errorMessage}`, { type: 'error' });
    }
  };

  const pollJobStatus = async (jobId: string, queueIndex: number) => {
    const CNS_API_URL = `${import.meta.env.VITE_CNS_API_URL || 'http://localhost:27800'}/api`;

    console.log(`[BOM Upload] Starting to poll job status: ${jobId}`);

    for (let i = 0; i < 30; i++) {
      try {
        const response = await fetch(`${CNS_API_URL}/bom/jobs/${jobId}/status`);

        if (!response.ok) {
          console.error(`[BOM Upload] Status poll failed: ${response.status} ${response.statusText}`);
          continue; // Retry
        }

        const status = await response.json();
        console.log(`[BOM Upload] Poll ${i + 1}/30 - Status: ${status.status}`);

        if (status.status === 'completed') {
          console.log('[BOM Upload] Job completed successfully!');
          setQueue(prev => prev.map((it, idx) => idx === queueIndex ? { ...it, status: 'completed' } : it));
          notify('BOM processed successfully!', { type: 'success' });
          return true;
        }

        if (status.status === 'failed') {
          // Parse error message properly
          let errorMsg = 'Job failed';
          if (status.error) {
            if (typeof status.error === 'string') {
              errorMsg = status.error;
            } else if (Array.isArray(status.error)) {
              errorMsg = status.error.map((err: any) => {
                if (typeof err === 'string') return err;
                if (err.msg) return err.msg;
                return JSON.stringify(err);
              }).join('\n');
            } else {
              errorMsg = JSON.stringify(status.error);
            }
          } else if (status.message) {
            errorMsg = status.message;
          }
          console.error('[BOM Upload] Job failed:', errorMsg);
          setQueue(prev => prev.map((it, idx) => idx === queueIndex ? {
            ...it,
            status: 'error',
            error: errorMsg,
          } : it));
          notify(`Job failed: ${errorMsg}`, { type: 'error' });
          return false;
        }
      } catch (pollError: any) {
        console.error(`[BOM Upload] Poll error:`, pollError);
        // Continue polling
      }

      await new Promise(r => setTimeout(r, 2000));
    }

    return false;
  };

  const updateQueueItemMapping = (queueIndex: number, sourceColumn: string, target: string) => {
    setQueue(prev => prev.map((item, idx) => {
      if (idx === queueIndex && item.columnMappings) {
        return {
          ...item,
          columnMappings: item.columnMappings.map(m =>
            m.source === sourceColumn ? { ...m, target } : m
          ),
        };
      }
      return item;
    }));
  };

  const renderMappingEditor = (item: QueueItem, queueIndex: number) => {
    if (!item.columnMappings || !item.uploadResponse) return null;

    return (
      <Card sx={{ mt: 2, mb: 2, border: '2px solid', borderColor: 'primary.main' }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Review Column Mappings: {item.file.name}</Typography>
            <Chip label={`${item.uploadResponse.total_items} items`} color="primary" size="small" />
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
                      <Typography variant="body2" fontWeight={600}>{mapping.source}</Typography>
                    </TableCell>
                    <TableCell>
                      <FormControl size="small" fullWidth sx={{ minWidth: 200 }}>
                        <Select
                          value={mapping.target}
                          onChange={(e) => updateQueueItemMapping(queueIndex, mapping.source, e.target.value)}
                        >
                          <MenuItem value="ignore"><em>Ignore</em></MenuItem>
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
              {item.columnMappings.filter(m => m.target !== 'ignore').length} column(s) mapped •{' '}
              {item.columnMappings.filter(m => m.target === 'ignore').length} ignored
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

  const getStatusColor = (status: QueueItem['status']) => {
    switch (status) {
      case 'completed': return 'success';
      case 'error': return 'error';
      case 'processing': return 'info';
      case 'mapping': return 'warning';
      default: return 'default';
    }
  };

  if (!currentProject) {
    return (
      <Box sx={{ p: 3 }}>
        <Card>
          <CardContent>
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CircularProgress sx={{ mb: 2 }} />
              <Typography variant="body1">Loading project...</Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Upload BOM
      </Typography>

      {/* Current Project Banner */}
      <Alert severity="info" icon={<ProjectIcon />} sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="body1" fontWeight={600}>
              Uploading to: {currentProject.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Files will be associated with this project automatically
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            onClick={() => redirect('/')}
          >
            Change Project
          </Button>
        </Box>
      </Alert>

      {/* File Upload Area */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Step 1: Select Files
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
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: 'action.hover',
              },
            }}
          >
            <input {...getInputProps()} />
            <UploadIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              {isDragActive ? 'Drop files here...' : 'Drag & drop BOM files here'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              or click to browse • Supports CSV, Excel (.xlsx, .xls)
            </Typography>
          </Paper>
        </CardContent>
      </Card>

      {/* Multi-File Strategy */}
      {queue.length > 1 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <FormLabel component="legend">How should multiple files be handled?</FormLabel>
            <RadioGroup
              row
              value={multiFileStrategy}
              onChange={(e) => setMultiFileStrategy(e.target.value as 'separate' | 'merge')}
            >
              <FormControlLabel
                value="separate"
                control={<Radio />}
                label="Create separate BOMs (recommended)"
              />
              <FormControlLabel
                value="merge"
                control={<Radio />}
                label="Merge into single BOM"
              />
            </RadioGroup>

            {multiFileStrategy === 'merge' && (
              <TextField
                label="Merged BOM Name"
                value={mergedBomName}
                onChange={(e) => setMergedBomName(e.target.value)}
                fullWidth
                sx={{ mt: 2 }}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Upload Queue */}
      {queue.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>Upload Queue</Typography>

            <Box sx={{ mb: 2 }}>
              <FormControlLabel
                control={
                  <input
                    type="checkbox"
                    checked={pauseForMapping}
                    onChange={(e) => setPauseForMapping(e.target.checked)}
                    disabled={isProcessing}
                  />
                }
                label="Pause for manual column mapping review"
              />
            </Box>

            <List dense>
              {queue.map((item, idx) => (
                <React.Fragment key={idx}>
                  <ListItem>
                    <FileIcon sx={{ mr: 2 }} />
                    <ListItemText
                      primary={item.file.name}
                      secondary={`${item.status}${item.totalItems ? ` • ${item.totalItems} items` : ''}`}
                    />
                    <Chip label={item.status} color={getStatusColor(item.status)} size="small" />
                    {item.jobId && <Chip size="small" label={item.jobId.substring(0, 8) + '...'} sx={{ ml: 1 }} />}
                  </ListItem>

                  {/* Mapping Editor */}
                  {pauseForMapping && item.status === 'mapping' && (
                    <Box px={2} pb={2}>
                      {renderMappingEditor(item, idx)}
                    </Box>
                  )}

                  {/* Error Display - Improved with details */}
                  {item.error && (
                    <Alert
                      severity="error"
                      sx={{ mx: 2, mb: 1 }}
                      icon={<ErrorIcon />}
                    >
                      <Box>
                        <Typography variant="body2" fontWeight={600} gutterBottom>
                          Upload Failed: {item.file.name}
                        </Typography>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                          {item.error}
                        </Typography>
                        <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            onClick={() => {
                              console.log('[BOM Upload] Full error details:', {
                                file: item.file.name,
                                error: item.error,
                                status: item.status,
                                jobId: item.jobId,
                              });
                              notify('Full error details logged to console (F12)', { type: 'info' });
                            }}
                          >
                            View Console Details
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => {
                              setQueue(prev => prev.map((it, i) =>
                                i === idx ? { ...it, status: 'pending', error: undefined } : it
                              ));
                            }}
                          >
                            Retry
                          </Button>
                        </Box>
                      </Box>
                    </Alert>
                  )}
                </React.Fragment>
              ))}
            </List>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mt: 2 }}>
              <Button
                variant="outlined"
                disabled={isProcessing}
                onClick={() => setQueue([])}
              >
                Clear All
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={startWorkflow}
                disabled={isProcessing || queue.length === 0}
                startIcon={isProcessing ? <CircularProgress size={20} /> : <UploadIcon />}
              >
                {isProcessing ? 'Uploading...' : `Upload ${queue.length} File(s)`}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};
