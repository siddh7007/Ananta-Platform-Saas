import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Alert,
  LinearProgress,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stepper,
  Step,
  StepLabel,
  Chip,
  TextField,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import DescriptionIcon from '@mui/icons-material/Description';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PendingIcon from '@mui/icons-material/Pending';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../providers/supabaseDataProvider';
import { cnsApi } from '../services/cnsApi';

interface ColumnMapping {
  source: string;
  target: 'mpn' | 'manufacturer' | 'quantity' | 'reference' | 'description' | 'ignore';
}

interface BOMUploadResponse {
  job_id: string;
  filename: string;
  total_items: number;
  status: string;
  detected_columns: Record<string, string>;
  unmapped_columns: string[];
  file_type: string;
  encoding_used: string;
  preview_data: Array<{
    mpn: string;
    manufacturer?: string;
    quantity?: number;
    reference_designator?: string;
    description?: string;
  }>;
  message: string;
}

type FileUploadStatus = 'pending' | 'uploading' | 'mapping' | 'confirming' | 'completed' | 'error';

interface FileQueueItem {
  file: File;
  status: FileUploadStatus;
  uploadResponse?: BOMUploadResponse;
  columnMappings?: ColumnMapping[];
  error?: string;
  jobId?: string;
}

interface BOMUploadWizardProps {
  /** Tenant (organization) ID for multi-tenancy */
  tenantId?: string;
  /** Project ID for multi-tenancy */
  projectId?: string;
  /** Source type: 'customer' or 'staff' */
  source?: 'customer' | 'staff';
  /** Callback when upload completes */
  onUploadComplete?: (jobId: string) => void;
}

/**
 * BOM Upload Wizard with 3-Step Workflow (V1-Style)
 *
 * Step 1: Upload File
 * Step 2: Review Column Mappings
 * Step 3: Preview Data & Confirm
 *
 * Features:
 * - Multi-format support (CSV, Excel, TXT)
 * - Backend auto-detection with user review
 * - Multi-tenancy support
 * - Reusable for customer portal and CNS dashboard
 */
export const BOMUploadWizard: React.FC<BOMUploadWizardProps> = ({
  tenantId,
  projectId,
  source = 'customer',
  onUploadComplete,
}) => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const steps = ['Upload Files', 'Processing Queue', 'Results Summary'];

  const resolvedTenantId = tenantId || 'a1111111-1111-1111-1111-111111111111';
  const initialProjectId = projectId || null;

  // Multi-file queue state
  const [fileQueue, setFileQueue] = useState<FileQueueItem[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string | null>(initialProjectId);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedJobIds, setCompletedJobIds] = useState<string[]>([]);
  const [mergeFiles, setMergeFiles] = useState(false);
  const [bulkUploadToCatalog, setBulkUploadToCatalog] = useState(false);
  const [pauseForMapping, setPauseForMapping] = useState(false);
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);

  // Load projects for dropdown
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setProjectsLoading(true);
        const { data, error } = await supabase
          .from('projects')
          .select('id, name')
          .eq('tenant_id', resolvedTenantId)
          .order('created_at', { ascending: false });
        if (!mounted) return;
        if (error) {
          setProjects([]);
        } else {
          setProjects(data || []);
        }
      } finally {
        if (mounted) setProjectsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [resolvedTenantId]);

  // ============================================================
  // Step 1: File Upload - Multiple Files
  // ============================================================

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const added: FileQueueItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files.item(i)!;
      if (validateFile(f)) {
        added.push({
          file: f,
          status: 'pending',
        });
      }
    }
    if (added.length) {
      setFileQueue((prev) => [...prev, ...added]);
      setError(null);
    }
  };

  const validateFile = (file: File): boolean => {
    const allowedExtensions = ['csv', 'xlsx', 'xls', 'txt', 'tsv'];
    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
      setError(`Unsupported file type: ${file.name}. Please upload: ${allowedExtensions.join(', ')}`);
      return false;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setError(`File ${file.name} exceeds 10MB limit`);
      return false;
    }

    return true;
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const added: FileQueueItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files.item(i)!;
      if (validateFile(f)) {
        added.push({
          file: f,
          status: 'pending',
        });
      }
    }
    if (added.length) {
      setFileQueue((prev) => [...prev, ...added]);
      setError(null);
    }
  };

  const removeFileFromQueue = (index: number) => {
    setFileQueue((prev) => prev.filter((_, i) => i !== index));
  };

  // ============================================================
  // Column Mapping Helpers
  // ============================================================

  // Update mapping for a specific queue item
  const updateQueueItemMapping = (queueIndex: number, sourceColumn: string, target: ColumnMapping['target']) => {
    setFileQueue((prev) =>
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
  const validateMappings = (item: FileQueueItem): { valid: boolean; error?: string } => {
    if (!item.columnMappings) {
      return { valid: false, error: 'No column mappings found' };
    }
    const hasMPN = item.columnMappings.some((m) => m.target === 'mpn');
    if (!hasMPN) {
      return { valid: false, error: 'At least one column must be mapped to "Part Number (MPN)"' };
    }
    return { valid: true };
  };

  // Confirm mappings for a specific queue item
  const confirmMappingsForItem = async (queueIndex: number) => {
    const item = fileQueue[queueIndex];
    if (!item || !item.uploadResponse || !item.columnMappings) return;

    // Validate mappings
    const validation = validateMappings(item);
    if (!validation.valid) {
      setError(validation.error || 'Invalid mappings');
      return;
    }

    try {
      // Mark as confirming
      setFileQueue((prev) =>
        prev.map((it, idx) => (idx === queueIndex ? { ...it, status: 'confirming' } : it))
      );

      // Build confirmed mappings
      const confirmedMappings: Record<string, string> = {};
      item.columnMappings
        .filter((m) => m.target !== 'ignore')
        .forEach((m) => (confirmedMappings[m.target] = m.source));

      // Confirm mapping using CNS API client
      await cnsApi.confirmMapping(item.uploadResponse.job_id, confirmedMappings);

      // Mark as completed
      setFileQueue((prev) =>
        prev.map((it, idx) =>
          idx === queueIndex ? { ...it, status: 'completed', jobId: item.uploadResponse!.job_id } : it
        )
      );
      setCompletedJobIds((prev) => [...prev, item.uploadResponse!.job_id]);
      setError(null);
    } catch (err) {
      setFileQueue((prev) =>
        prev.map((it, idx) =>
          idx === queueIndex
            ? { ...it, status: 'error', error: err instanceof Error ? err.message : 'Confirmation failed' }
            : it
        )
      );
    }
  };

  // ============================================================
  // Step 2: Auto-Process Queue
  // ============================================================

  const processFileQueue = async () => {
    if (fileQueue.length === 0) {
      setError('Please select at least one file');
      return;
    }

    setIsProcessing(true);
    setActiveStep(1); // Move to processing step
    setError(null);

    // BULK UPLOAD TO CENTRAL CATALOG: If bulk upload checkbox is enabled
    if (bulkUploadToCatalog && fileQueue.length >= 1) {
      try {
        // Mark all files as uploading
        setFileQueue((prev) =>
          prev.map((item) => ({ ...item, status: 'uploading' }))
        );

        // Call bulk upload endpoint (saves to central catalog)
        const result = await cnsApi.bulkUpload(
          fileQueue.map((item) => item.file),
          'sum_quantity', // Default merge strategy (sum quantities)
          resolvedTenantId,
          resolvedTenantId, // organization_id
          selectedProject || undefined,
          undefined, // name (auto-generated)
          undefined, // description
          true // save to central catalog
        );

        // Mark all files as confirming
        setFileQueue((prev) =>
          prev.map((item) => ({
            ...item,
            status: 'confirming',
            uploadResponse: result,
          }))
        );

        // Auto-confirm mappings
        const mappings: ColumnMapping[] = [];
        Object.entries(result.detected_columns).forEach(([field, sourceColumn]) => {
          if (sourceColumn) mappings.push({ source: sourceColumn, target: field as ColumnMapping['target'] });
        });
        result.unmapped_columns.forEach((col) => mappings.push({ source: col, target: 'ignore' }));

        const confirmedMappings: Record<string, string> = {};
        mappings.filter((m) => m.target !== 'ignore').forEach((m) => (confirmedMappings[m.target] = m.source));

        // Confirm mapping for bulk upload job
        await cnsApi.confirmMapping(result.job_id, confirmedMappings);

        // Mark all files as completed with same job_id
        setFileQueue((prev) =>
          prev.map((item) => ({
            ...item,
            status: 'completed',
            jobId: result.job_id,
            columnMappings: mappings,
          }))
        );
        setCompletedJobIds([result.job_id]);
      } catch (err) {
        // Mark all files as error
        setFileQueue((prev) =>
          prev.map((item) => ({
            ...item,
            status: 'error',
            error: err instanceof Error ? err.message : 'Bulk upload failed',
          }))
        );
      }

      setIsProcessing(false);
      setActiveStep(2);
      return;
    }

    // MERGE WORKFLOW: If merge is enabled and multiple files selected
    if (mergeFiles && fileQueue.length >= 2) {
      try {
        // Mark all files as uploading
        setFileQueue((prev) =>
          prev.map((item) => ({ ...item, status: 'uploading' }))
        );

        // Call merge endpoint with all files
        const result = await cnsApi.mergeBOM(
          fileQueue.map((item) => item.file),
          'sum_quantity', // Default merge strategy (sum quantities)
          resolvedTenantId,
          resolvedTenantId, // organization_id
          selectedProject || undefined
        );

        // Mark all files as confirming
        setFileQueue((prev) =>
          prev.map((item) => ({
            ...item,
            status: 'confirming',
            uploadResponse: result,
          }))
        );

        // Auto-confirm mappings (merge endpoint handles this internally)
        const mappings: ColumnMapping[] = [];
        Object.entries(result.detected_columns).forEach(([field, sourceColumn]) => {
          if (sourceColumn) mappings.push({ source: sourceColumn, target: field as ColumnMapping['target'] });
        });
        result.unmapped_columns.forEach((col) => mappings.push({ source: col, target: 'ignore' }));

        const confirmedMappings: Record<string, string> = {};
        mappings.filter((m) => m.target !== 'ignore').forEach((m) => (confirmedMappings[m.target] = m.source));

        // Confirm mapping for merged job
        await cnsApi.confirmMapping(result.job_id, confirmedMappings);

        // Mark all files as completed with same job_id
        setFileQueue((prev) =>
          prev.map((item) => ({
            ...item,
            status: 'completed',
            jobId: result.job_id,
            columnMappings: mappings,
          }))
        );
        setCompletedJobIds([result.job_id]);
      } catch (err) {
        // Mark all files as error
        setFileQueue((prev) =>
          prev.map((item) => ({
            ...item,
            status: 'error',
            error: err instanceof Error ? err.message : 'Merge failed',
          }))
        );
      }

      setIsProcessing(false);
      setActiveStep(2);
      return;
    }

    // INDIVIDUAL WORKFLOW: Process files sequentially (only pending)
    for (let i = 0; i < fileQueue.length; i++) {
      const queueItem = fileQueue[i];
      if (queueItem.status !== 'pending') continue;

      try {
        // Update status to uploading
        setFileQueue((prev) =>
          prev.map((item, idx) => (idx === i ? { ...item, status: 'uploading' } : item))
        );

        // Upload file
        // Upload BOM using CNS API client (routes through Traefik)
        const result = await cnsApi.uploadBOM(
          [queueItem.file],
          resolvedTenantId,
          resolvedTenantId, // organization_id
          selectedProject || undefined
        );
        const mappings: ColumnMapping[] = [];
        Object.entries(result.detected_columns).forEach(([field, sourceColumn]) => {
          if (sourceColumn) mappings.push({ source: sourceColumn, target: field as ColumnMapping['target'] });
        });
        result.unmapped_columns.forEach((col) => mappings.push({ source: col, target: 'ignore' }));
        if (pauseForMapping) {
          setFileQueue((prev) =>
            prev.map((item, idx) =>
              idx === i
                ? { ...item, status: 'mapping', uploadResponse: result, columnMappings: mappings }
                : item
            )
          );
        } else {
          setFileQueue((prev) =>
            prev.map((item, idx) =>
              idx === i
                ? { ...item, status: 'confirming', uploadResponse: result, columnMappings: mappings }
                : item
            )
          );

          const confirmedMappings: Record<string, string> = {};
          mappings.filter((m) => m.target !== 'ignore').forEach((m) => (confirmedMappings[m.target] = m.source));

          // Confirm mapping using CNS API client
          await cnsApi.confirmMapping(result.job_id, confirmedMappings);

          setFileQueue((prev) =>
            prev.map((item, idx) => (idx === i ? { ...item, status: 'completed', jobId: result.job_id } : item))
          );
          setCompletedJobIds((prev) => [...prev, result.job_id]);
        }
      } catch (err) {
        // Update status to error
        setFileQueue((prev) =>
          prev.map((item, idx) =>
            idx === i
              ? {
                  ...item,
                  status: 'error',
                  error: err instanceof Error ? err.message : 'Processing failed',
                }
              : item
          )
        );
      }
    }

    // All files processed, move to results
    setIsProcessing(false);
    setActiveStep(2);
  };

  // ============================================================
  // Helper Functions
  // ============================================================

  const handleReset = () => {
    setFileQueue([]);
    setError(null);
    setSelectedProject(initialProjectId);
    setActiveStep(0);
    setIsProcessing(false);
    setCompletedJobIds([]);
  };

  const getStatusIcon = (status: FileUploadStatus) => {
    switch (status) {
      case 'pending':
        return <PendingIcon sx={{ color: 'grey.500' }} />;
      case 'uploading':
        return <CircularProgress size={24} />;
      case 'mapping':
      case 'confirming':
        return <HourglassEmptyIcon sx={{ color: 'info.main' }} />;
      case 'completed':
        return <CheckCircleIcon sx={{ color: 'success.main' }} />;
      case 'error':
        return <ErrorIcon sx={{ color: 'error.main' }} />;
      default:
        return <DescriptionIcon />;
    }
  };

  const getStatusLabel = (status: FileUploadStatus): string => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'uploading':
        return 'Uploading...';
      case 'mapping':
        return 'Mapping Columns...';
      case 'confirming':
        return 'Confirming...';
      case 'completed':
        return 'Completed';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  };

  // ============================================================
  // Column Mapping Editor Component
  // ============================================================

  const renderMappingEditor = (item: FileQueueItem, queueIndex: number) => {
    if (!item.columnMappings || !item.uploadResponse) return null;

    return (
      <Card sx={{ mt: 2, mb: 2, border: '2px solid', borderColor: 'primary.main' }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
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
                            updateQueueItemMapping(queueIndex, mapping.source, e.target.value as ColumnMapping['target'])
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

          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="caption" color="textSecondary">
              {item.columnMappings.filter((m) => m.target !== 'ignore').length} column(s) mapped •{' '}
              {item.columnMappings.filter((m) => m.target === 'ignore').length} ignored
            </Typography>
            <Button
              variant="contained"
              color="primary"
              onClick={() => confirmMappingsForItem(queueIndex)}
              startIcon={<CheckCircleIcon />}
            >
              Confirm Mappings & Process
            </Button>
          </Box>
        </CardContent>
      </Card>
    );
  };

  // ============================================================
  // Render Step Content
  // ============================================================

  const renderStep1 = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Upload BOM Files
      </Typography>
      <Typography variant="body2" color="textSecondary" paragraph>
        Upload multiple BOMs in CSV, Excel, TXT or TSV format. Files will be processed automatically.
      </Typography>

      {/* Drag & Drop Area (Multiple) */}
      <Paper
        sx={{
          p: 4,
          border: '2px dashed',
          borderColor: dragActive ? 'primary.main' : 'grey.300',
          bgcolor: dragActive ? 'action.hover' : 'background.paper',
          transition: 'all 0.2s',
          cursor: 'pointer',
          mb: 3,
          '&:hover': {
            borderColor: 'primary.main',
            bgcolor: 'action.hover',
          },
        }}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input-wizard')?.click()}
      >
        <Box textAlign="center">
          <CloudUploadIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Drag & Drop BOM Files Here
          </Typography>
          <Typography variant="body2" color="textSecondary" paragraph>
            or click to browse (multiple files supported)
          </Typography>
          <Typography variant="caption" color="textSecondary">
            Supported: CSV, Excel (.xlsx, .xls), Text (.txt, .tsv) | Max: 10MB per file
          </Typography>

          <input
            id="file-input-wizard"
            type="file"
            accept=".csv,.xlsx,.xls,.txt,.tsv"
            multiple
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </Box>
      </Paper>

      {/* File Queue */}
      {fileQueue.length > 0 && (
        <Paper variant="outlined" sx={{ mb: 2 }}>
          <List dense>
            {fileQueue.map((item, index) => (
              <ListItem
                key={index}
                secondaryAction={
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => removeFileFromQueue(index)}
                    disabled={isProcessing}
                  >
                    Remove
                  </Button>
                }
              >
                <ListItemIcon>
                  <DescriptionIcon sx={{ color: 'success.main' }} />
                </ListItemIcon>
                <ListItemText
                  primary={item.file.name}
                  secondary={`${(item.file.size / 1024).toFixed(2)} KB`}
                />
              </ListItem>
            ))}
          </List>
          <Box p={2} display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="body2" color="textSecondary">
              {fileQueue.length} file(s) selected
            </Typography>
            <Button variant="text" size="small" onClick={() => setFileQueue([])} disabled={isProcessing}>
              Clear All
            </Button>
          </Box>
        </Paper>
      )}

      {error && (
        <Alert severity="error" icon={<ErrorIcon />} sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box mb={2}>
        <FormControl fullWidth disabled={isProcessing || projectsLoading}>
          <InputLabel id="project-select-label">Project (optional)</InputLabel>
          <Select
            labelId="project-select-label"
            label="Project (optional)"
            value={selectedProject ?? ''}
            onChange={(e) => setSelectedProject(e.target.value ? String(e.target.value) : null)}
          >
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {projects.map((p) => (
              <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        <Box display="flex" flexDirection="column" gap={2}>
          <Typography variant="body2">
            All uploads will be associated with tenant ID <strong>{resolvedTenantId}</strong>
            {selectedProject ? ` and project ID ${selectedProject}.` : '.'}
          </Typography>
          <Box display="flex" flexDirection="column" gap={1}>
            <Box display="flex" alignItems="center" gap={1}>
              <input
                type="checkbox"
                id="bulk-upload-catalog"
                checked={bulkUploadToCatalog}
                onChange={(e) => {
                  setBulkUploadToCatalog(e.target.checked);
                  if (e.target.checked) setMergeFiles(false); // Disable merge if bulk upload enabled
                }}
                disabled={isProcessing}
              />
              <label htmlFor="bulk-upload-catalog">
                <strong>Bulk Upload to Central Catalog</strong> (merge files & save to shared component database)
              </label>
            </Box>
            <Box display="flex" alignItems="center" gap={1}>
              <input
                type="checkbox"
                id="merge-files"
                checked={mergeFiles}
                onChange={(e) => {
                  setMergeFiles(e.target.checked);
                  if (e.target.checked) setBulkUploadToCatalog(false); // Disable bulk upload if merge enabled
                }}
                disabled={isProcessing || bulkUploadToCatalog}
              />
              <label htmlFor="merge-files">Merge selected files into a single BOM</label>
            </Box>
            <Box display="flex" alignItems="center" gap={1}>
              <input
                type="checkbox"
                id="pause-mapping"
                checked={pauseForMapping}
                onChange={(e) => setPauseForMapping(e.target.checked)}
                disabled={isProcessing || bulkUploadToCatalog}
              />
              <label htmlFor="pause-mapping">Pause for manual mapping</label>
            </Box>
          </Box>
        </Box>
      </Alert>

      <Box display="flex" justifyContent="flex-end">
        <Button
          variant="contained"
          onClick={processFileQueue}
          disabled={fileQueue.length === 0 || isProcessing}
          endIcon={<ArrowForwardIcon />}
        >
          Process {fileQueue.length} File{fileQueue.length !== 1 ? 's' : ''}
        </Button>
      </Box>
    </Box>
  );

  const renderStep2 = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Processing Queue
      </Typography>
      <Typography variant="body2" color="textSecondary" paragraph>
        Files are being processed automatically. Each file will be uploaded, mapped, and confirmed.
      </Typography>

      {/* Overall Progress */}
      <Box mb={3}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="body2">
            Processing {fileQueue.filter((f) => f.status === 'completed').length} of {fileQueue.length} files
          </Typography>
          <Typography variant="caption" color="textSecondary">
            {fileQueue.filter((f) => f.status === 'error').length} error(s)
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={(fileQueue.filter((f) => f.status === 'completed').length / fileQueue.length) * 100}
        />
      </Box>

      {/* File Queue with Status */}
      <Paper variant="outlined">
        <List dense>
          {fileQueue.map((item, index) => (
            <React.Fragment key={index}>
              <ListItem>
                <ListItemIcon>{getStatusIcon(item.status)}</ListItemIcon>
                <ListItemText
                  primary={item.file.name}
                  secondary={
                    <>
                      {getStatusLabel(item.status)}
                      {item.error && ` - ${item.error}`}
                      {item.uploadResponse && ` (${item.uploadResponse.total_items} items)`}
                    </>
                  }
                />
                {item.status === 'completed' && item.jobId && (
                  <Chip label={`Job: ${item.jobId.substring(0, 8)}...`} size="small" color="success" />
                )}
              </ListItem>
              {/* Show mapping editor for files in 'mapping' status */}
              {pauseForMapping && item.status === 'mapping' && (
                <Box px={2} pb={2}>
                  {renderMappingEditor(item, index)}
                </Box>
              )}
            </React.Fragment>
          ))}
        </List>
      </Paper>

      {error && (
        <Alert severity="error" icon={<ErrorIcon />} sx={{ mt: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {!isProcessing && fileQueue.some((f) => f.status === 'error') && (
        <Box mt={2} display="flex" justifyContent="flex-end">
          <Button
            variant="outlined"
            onClick={() => {
              setFileQueue((prev) => prev.map((it) => (it.status === 'error' ? { ...it, status: 'pending', error: undefined } : it)));
              processFileQueue();
            }}
          >
            Retry Failed
          </Button>
        </Box>
      )}

      {isProcessing && (
        <Box mt={2}>
          <Alert severity="info">
            <Typography variant="body2">
              Processing in progress... Please do not close this window.
            </Typography>
          </Alert>
        </Box>
      )}
    </Box>
  );

  const renderStep3 = () => {
    const completedFiles = fileQueue.filter((f) => f.status === 'completed');
    const errorFiles = fileQueue.filter((f) => f.status === 'error');
    const totalItems = completedFiles.reduce(
      (sum, f) => sum + (f.uploadResponse?.total_items || 0),
      0
    );

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Processing Complete
        </Typography>
        <Typography variant="body2" color="textSecondary" paragraph>
          Summary of batch upload results.
        </Typography>

        {/* Summary Cards */}
        <Box display="grid" gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap={2} mb={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" color="success.main">
              {completedFiles.length}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Successful
            </Typography>
          </Paper>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" color="error.main">
              {errorFiles.length}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Failed
            </Typography>
          </Paper>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" color="primary.main">
              {totalItems}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Total Items
            </Typography>
          </Paper>
        </Box>

        {/* Success Alert */}
        {completedFiles.length > 0 && (
          <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 2 }}>
            <Typography variant="body1" fontWeight={600}>
              {bulkUploadToCatalog && completedFiles.length >= 1
                ? `${completedFiles.length} file${completedFiles.length !== 1 ? 's' : ''} bulk uploaded to central catalog successfully!`
                : mergeFiles && completedFiles.length > 1
                ? `${completedFiles.length} files merged and processed successfully!`
                : `${completedFiles.length} BOM${completedFiles.length !== 1 ? 's' : ''} processed successfully!`}
            </Typography>
            <Typography variant="body2">
              {bulkUploadToCatalog && completedFiles.length >= 1
                ? `1 bulk upload job created from ${completedFiles.length} file${completedFiles.length !== 1 ? 's' : ''} (${totalItems} components saved to central catalog for reuse).`
                : mergeFiles && completedFiles.length > 1
                ? `1 merged job created from ${completedFiles.length} files (${totalItems} total items).`
                : `${completedJobIds.length} job${completedJobIds.length !== 1 ? 's' : ''} created and started.`}
            </Typography>
          </Alert>
        )}

        {/* Error Alert */}
        {errorFiles.length > 0 && (
          <Alert severity="error" icon={<ErrorIcon />} sx={{ mb: 2 }}>
            <Typography variant="body1" fontWeight={600}>
              {errorFiles.length} file{errorFiles.length !== 1 ? 's' : ''} failed to process
            </Typography>
            <Typography variant="body2">See details below.</Typography>
          </Alert>
        )}

        {/* Results Table */}
        <TableContainer component={Paper} sx={{ mb: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Status</TableCell>
                <TableCell>File Name</TableCell>
                <TableCell>Items</TableCell>
                <TableCell>Job ID</TableCell>
                <TableCell>Details</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {fileQueue.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>{getStatusIcon(item.status)}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
                      {item.file.name}
                    </Typography>
                  </TableCell>
                  <TableCell>{item.uploadResponse?.total_items || '-'}</TableCell>
                  <TableCell>
                    {item.jobId ? (
                      <Chip label={item.jobId.substring(0, 8) + '...'} size="small" />
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    {item.status === 'completed' && item.jobId && (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => navigate(`/cns-jobs/${item.jobId}`)}
                      >
                        View Progress
                      </Button>
                    )}
                    {item.status === 'error' && (
                      <Typography variant="caption" color="error.main">
                        {item.error}
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Action Buttons */}
        <Box display="flex" justifyContent="space-between" gap={2}>
          <Button onClick={handleReset} variant="outlined" startIcon={<CloudUploadIcon />}>
            Upload More BOMs
          </Button>
          {completedJobIds.length > 0 && (
            <Button
              variant="contained"
              onClick={() => {
                // Navigate to first job's progress page
                if (completedJobIds[0]) {
                  navigate(`/cns-jobs/${completedJobIds[0]}`);
                } else if (onUploadComplete) {
                  onUploadComplete(completedJobIds[0]);
                }
              }}
              endIcon={<ArrowForwardIcon />}
            >
              {completedJobIds.length === 1 ? 'View Job Progress' : 'View First Job'}
            </Button>
          )}
        </Box>
      </Box>
    );
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          Multi-File BOM Upload
        </Typography>
        <Typography variant="body2" color="textSecondary" paragraph>
          Upload multiple BOM files for automatic processing and enrichment
        </Typography>

        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {activeStep === 0 && renderStep1()}
        {activeStep === 1 && renderStep2()}
        {activeStep === 2 && renderStep3()}
      </CardContent>
    </Card>
  );
};
