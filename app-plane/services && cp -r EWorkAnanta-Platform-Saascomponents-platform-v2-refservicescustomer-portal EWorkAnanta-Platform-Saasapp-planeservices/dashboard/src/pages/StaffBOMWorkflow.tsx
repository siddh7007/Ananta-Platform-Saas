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
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Select,
  MenuItem,
  FormControl,
  Chip,
  Divider,
  IconButton,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  Collapse,
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
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import WarningIcon from '@mui/icons-material/Warning';
import SecurityIcon from '@mui/icons-material/Security';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import NotificationsIcon from '@mui/icons-material/Notifications';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { CNS_API_URL, CNS_STAFF_ORGANIZATION_ID, getAdminAuthHeaders } from '../config/api';
import { useEnrichmentPolling } from '../hooks';

// ============================================================
// Types
// ============================================================

type WorkflowPhase = 'upload' | 'enriching' | 'analyzing' | 'complete';

type QueueItemStatus = 'pending' | 'parsing' | 'uploading' | 'mapping' | 'confirming' | 'saving' | 'completed' | 'error';

interface QueueItem {
  id: string;
  file: File;
  status: QueueItemStatus;
  uploadId?: string;
  bomId?: string;
  totalRows?: number;
  detectedColumns?: Record<string, string>;
  unmappedColumns?: string[];
  previewData?: Array<Record<string, unknown>>;
  error?: string;
  columnMappings?: ColumnMapping[];
  expanded?: boolean;
}

interface ColumnMapping {
  source: string;
  target: 'mpn' | 'manufacturer' | 'quantity' | 'reference' | 'description' | 'ignore';
  sampleData?: string[];
}

interface EnrichmentComponent {
  id: string;
  mpn: string;
  manufacturer?: string;
  status: 'pending' | 'enriching' | 'enriched' | 'failed' | 'not_found';
  qualityScore?: number;
  riskScore?: number;
  supplier?: string;
  error?: string;
}

interface RiskMetrics {
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  score: number;
  lifecycleRisk: number;
  supplyChainRisk: number;
  complianceRisk: number;
  highRiskCount: number;
  alertCount: number;
}

interface QueueMetrics {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

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

const TARGET_FIELDS = [
  { value: 'mpn', label: 'Part Number (MPN)', required: true },
  { value: 'manufacturer', label: 'Manufacturer' },
  { value: 'quantity', label: 'Quantity' },
  { value: 'reference', label: 'Reference Designator' },
  { value: 'description', label: 'Description' },
  { value: 'ignore', label: '-- Ignore --' },
];

// ============================================================
// Helper Functions
// ============================================================

function getActiveStep(phase: WorkflowPhase, queueStatus: QueueItemStatus | null): number {
  if (phase === 'complete') return 6;
  if (phase === 'analyzing') return 5;
  if (phase === 'enriching') return 4;

  switch (queueStatus) {
    case 'pending': return 0;
    case 'parsing':
    case 'uploading': return 1;
    case 'mapping': return 2;
    case 'confirming':
    case 'saving': return 3;
    case 'completed': return 4;
    case 'error': return -1;
    default: return 0;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getGradeColor(grade: string): string {
  switch (grade) {
    case 'A': return '#4caf50';
    case 'B': return '#8bc34a';
    case 'C': return '#ff9800';
    case 'D': return '#f44336';
    case 'F': return '#9c27b0';
    default: return '#9e9e9e';
  }
}

function normalizeField(field: string): ColumnMapping['target'] | null {
  const normalized = field.toLowerCase().replace(/[_\s-]/g, '');
  if (['partnumber', 'mpn', 'pn', 'partno', 'mfpn'].includes(normalized)) return 'mpn';
  if (['manufacturer', 'mfr', 'mfg', 'vendor', 'make'].includes(normalized)) return 'manufacturer';
  if (['quantity', 'qty', 'count', 'amount'].includes(normalized)) return 'quantity';
  if (['reference', 'refdes', 'designator', 'ref'].includes(normalized)) return 'reference';
  if (['description', 'desc', 'name', 'partdesc'].includes(normalized)) return 'description';
  return null;
}

function getStatusProgress(status: QueueItemStatus): number {
  switch (status) {
    case 'pending': return 0;
    case 'parsing': return 25;
    case 'uploading': return 50;
    case 'mapping': return 60;
    case 'confirming': return 75;
    case 'saving': return 90;
    case 'completed': return 100;
    case 'error': return 0;
    default: return 0;
  }
}

// ============================================================
// Sub-Components
// ============================================================

// Hero Metrics Card
const MetricsCard: React.FC<{ metrics: QueueMetrics }> = ({ metrics }) => (
  <Paper sx={{ p: 2, mb: 2 }}>
    <Grid container spacing={2}>
      <Grid item xs={3}>
        <Box textAlign="center">
          <HourglassEmptyIcon sx={{ color: 'text.secondary', fontSize: 28 }} />
          <Typography variant="h5" fontWeight={600}>{metrics.pending}</Typography>
          <Typography variant="caption" color="text.secondary">Pending</Typography>
        </Box>
      </Grid>
      <Grid item xs={3}>
        <Box textAlign="center">
          <AutorenewIcon sx={{ color: 'primary.main', fontSize: 28 }} />
          <Typography variant="h5" fontWeight={600} color="primary.main">{metrics.processing}</Typography>
          <Typography variant="caption" color="text.secondary">Processing</Typography>
        </Box>
      </Grid>
      <Grid item xs={3}>
        <Box textAlign="center">
          <CheckCircleIcon sx={{ color: 'success.main', fontSize: 28 }} />
          <Typography variant="h5" fontWeight={600} color="success.main">{metrics.completed}</Typography>
          <Typography variant="caption" color="text.secondary">Completed</Typography>
        </Box>
      </Grid>
      <Grid item xs={3}>
        <Box textAlign="center">
          <ErrorIcon sx={{ color: 'error.main', fontSize: 28 }} />
          <Typography variant="h5" fontWeight={600} color="error.main">{metrics.failed}</Typography>
          <Typography variant="caption" color="text.secondary">Failed</Typography>
        </Box>
      </Grid>
    </Grid>
  </Paper>
);

// Queue Item Component
const QueueItemCard: React.FC<{
  item: QueueItem;
  onToggleExpand: () => void;
  onMappingChange: (source: string, target: string) => void;
  onConfirm: () => void;
  onDelete: () => void;
  onDownload: () => void;
}> = ({ item, onToggleExpand, onMappingChange, onConfirm, onDelete, onDownload }) => {
  const getStatusChip = () => {
    const statusConfig: Record<QueueItemStatus, { color: 'default' | 'primary' | 'success' | 'error' | 'warning'; label: string }> = {
      pending: { color: 'default', label: 'Pending' },
      parsing: { color: 'primary', label: 'Parsing...' },
      uploading: { color: 'primary', label: 'Uploading...' },
      mapping: { color: 'warning', label: 'Map Columns' },
      confirming: { color: 'primary', label: 'Confirming...' },
      saving: { color: 'primary', label: 'Saving...' },
      completed: { color: 'success', label: 'Ready' },
      error: { color: 'error', label: 'Error' },
    };
    const config = statusConfig[item.status];
    return <Chip size="small" label={config.label} color={config.color} />;
  };

  const isProcessing = ['parsing', 'uploading', 'confirming', 'saving'].includes(item.status);
  const hasMpnMapping = item.columnMappings?.some(m => m.target === 'mpn');

  return (
    <Paper variant="outlined" sx={{ mb: 2, overflow: 'hidden' }}>
      {/* Header */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          cursor: item.status === 'mapping' ? 'pointer' : 'default',
          '&:hover': item.status === 'mapping' ? { bgcolor: 'action.hover' } : {},
        }}
        onClick={item.status === 'mapping' ? onToggleExpand : undefined}
      >
        <DescriptionIcon color="action" />
        <Box flex={1}>
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="subtitle1" fontWeight={600}>{item.file.name}</Typography>
            {item.totalRows && (
              <Chip size="small" label={`${item.totalRows} rows`} variant="outlined" />
            )}
          </Box>
          <Typography variant="caption" color="text.secondary">
            {formatFileSize(item.file.size)}
          </Typography>
        </Box>
        {getStatusChip()}
        <Box display="flex" gap={0.5}>
          <Tooltip title="Download">
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDownload(); }}>
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {item.status === 'pending' && (
            <Tooltip title="Remove">
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {item.status === 'mapping' && (
            <IconButton size="small">
              {item.expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          )}
        </Box>
      </Box>

      {/* Progress Bar - persist after completion */}
      {(isProcessing || item.status === 'completed') && (
        <LinearProgress
          variant="determinate"
          value={item.status === 'completed' ? 100 : getStatusProgress(item.status)}
          color={item.status === 'completed' ? 'success' : 'primary'}
          sx={{ height: 4 }}
        />
      )}

      {/* Error Message */}
      {item.status === 'error' && item.error && (
        <Alert severity="error" sx={{ mx: 2, mb: 2 }}>
          {item.error}
        </Alert>
      )}

      {/* Column Mapping Section */}
      <Collapse in={item.status === 'mapping' && item.expanded}>
        <Divider />
        <Box sx={{ p: 2, bgcolor: 'grey.50' }}>
          <Typography variant="subtitle2" gutterBottom>Column Mappings</Typography>

          {!hasMpnMapping && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Part Number (MPN) mapping is required
            </Alert>
          )}

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>File Column</strong></TableCell>
                  <TableCell><strong>Sample Data</strong></TableCell>
                  <TableCell><strong>Maps To</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {item.columnMappings?.map((mapping, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{mapping.source}</TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                        {mapping.sampleData?.slice(0, 2).join(', ') || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <FormControl size="small" fullWidth>
                        <Select
                          value={mapping.target}
                          onChange={(e) => onMappingChange(mapping.source, e.target.value)}
                        >
                          {TARGET_FIELDS.map(f => (
                            <MenuItem key={f.value} value={f.value}>
                              {f.label} {f.required && '*'}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={mapping.target === 'ignore' ? 'Ignored' : 'Mapped'}
                        color={mapping.target === 'ignore' ? 'default' : 'success'}
                        variant="outlined"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Box display="flex" justifyContent="flex-end" mt={2}>
            <Button
              variant="contained"
              color="success"
              onClick={onConfirm}
              disabled={!hasMpnMapping}
              startIcon={<PlayArrowIcon />}
            >
              Confirm & Start Enrichment
            </Button>
          </Box>
        </Box>
      </Collapse>
    </Paper>
  );
};


// ============================================================
// Main Component
// ============================================================

const StaffBOMWorkflow: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Refs for auto-scroll
  const dropzoneRef = useRef<HTMLDivElement>(null);
  const mappingRef = useRef<HTMLDivElement>(null);
  const enrichmentRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const enrichingItemRef = useRef<HTMLLIElement>(null);
  const componentListRef = useRef<HTMLDivElement>(null);

  // State
  const [phase, setPhase] = useState<WorkflowPhase>('upload');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [enrichingBomId, setEnrichingBomId] = useState<string | null>(null);
  const [components, setComponents] = useState<EnrichmentComponent[]>([]);
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null);
  const [_riskLoading, setRiskLoading] = useState(false);
  const [isStartingEnrichment, setIsStartingEnrichment] = useState(false);

  // Resume from URL params
  const resumeBomId = searchParams.get('bomId');
  useEffect(() => {
    if (resumeBomId) {
      setEnrichingBomId(resumeBomId);
      setPhase('enriching');
    }
  }, [resumeBomId]);

  // Enrichment polling - keep enabled through analyzing/complete phases to show final state
  const { state: enrichmentState } = useEnrichmentPolling({
    bomId: enrichingBomId || '',
    enabled: !!enrichingBomId && (phase === 'enriching' || phase === 'analyzing' || phase === 'complete'),
    pollInterval: 2000,
  });

  // Auto-advance phases based on enrichment state
  useEffect(() => {
    if (enrichmentState?.status === 'completed' && phase === 'enriching') {
      setPhase('analyzing');
      runRiskAnalysis();
    }
  }, [enrichmentState?.status, phase]);

  // Auto-scroll to enriching component
  useEffect(() => {
    if (enrichingItemRef.current && componentListRef.current) {
      enrichingItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [components.find(c => c.status === 'enriching')?.id]);

  // Calculate queue metrics
  const queueMetrics: QueueMetrics = useMemo(() => ({
    pending: queue.filter(q => q.status === 'pending').length,
    processing: queue.filter(q => ['parsing', 'uploading', 'mapping', 'confirming', 'saving'].includes(q.status)).length,
    completed: queue.filter(q => q.status === 'completed').length,
    failed: queue.filter(q => q.status === 'error').length,
  }), [queue]);

  // Get current status for stepper
  const currentQueueStatus = queue.length > 0 ? queue[0].status : null;
  const activeStep = getActiveStep(phase, currentQueueStatus);

  // ============================================================
  // File Handling
  // ============================================================

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    files.forEach(addFileToQueue);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(addFileToQueue);
    e.target.value = '';
  };

  const addFileToQueue = (file: File) => {
    const allowedExtensions = ['csv', 'xlsx', 'xls', 'txt'];
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (!ext || !allowedExtensions.includes(ext)) {
      return; // Skip invalid files
    }

    const newItem: QueueItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      status: 'pending',
      expanded: false,
    };

    setQueue(prev => [...prev, newItem]);

    // Auto-start parsing - pass file directly to avoid stale state issues
    setTimeout(() => parseFile(newItem.id, file), 100);
  };

  // ============================================================
  // API Calls
  // ============================================================

  const parseFile = async (itemId: string, file: File) => {
    setQueue(prev => prev.map(q => q.id === itemId ? { ...q, status: 'parsing' } : q));

    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('source', 'staff');

      const response = await fetch(`${CNS_API_URL}/bom/upload`, {
        method: 'POST',
        headers: getAdminAuthHeaders(),
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Parse failed');
      }

      const result = await response.json();

      // Build column mappings with sample data
      const mappings: ColumnMapping[] = [];

      if (result.detected_columns) {
        Object.entries(result.detected_columns).forEach(([field, sourceCol]) => {
          if (sourceCol) {
            const normalizedField = normalizeField(field);
            const samples = result.preview_data?.slice(0, 3).map((row: Record<string, unknown>) => String(row[sourceCol as string] || '')) || [];
            mappings.push({
              source: sourceCol as string,
              target: normalizedField || 'ignore',
              sampleData: samples,
            });
          }
        });
      }

      if (result.unmapped_columns) {
        result.unmapped_columns.forEach((col: string) => {
          const samples = result.preview_data?.slice(0, 3).map((row: Record<string, unknown>) => String(row[col] || '')) || [];
          mappings.push({ source: col, target: 'ignore', sampleData: samples });
        });
      }

      setQueue(prev => prev.map(q => q.id === itemId ? {
        ...q,
        status: 'mapping',
        totalRows: result.total_items,
        detectedColumns: result.detected_columns,
        unmappedColumns: result.unmapped_columns,
        previewData: result.preview_data,
        columnMappings: mappings,
        expanded: true,
      } : q));

      // Auto-scroll to mapping section
      setTimeout(() => mappingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);

    } catch (err) {
      setQueue(prev => prev.map(q => q.id === itemId ? {
        ...q,
        status: 'error',
        error: err instanceof Error ? err.message : 'Parse failed',
      } : q));
    }
  };

  const confirmAndEnrich = async (itemId: string) => {
    const item = queue.find(q => q.id === itemId);
    if (!item?.file || !item.columnMappings) return;

    setQueue(prev => prev.map(q => q.id === itemId ? { ...q, status: 'saving' } : q));

    try {
      const formData = new FormData();
      formData.append('file', item.file);
      formData.append('bom_name', `BOM Upload - ${item.file.name}`);
      formData.append('organization_id', CNS_STAFF_ORGANIZATION_ID);
      formData.append('source', 'staff_bulk');
      formData.append('priority', 'normal');
      formData.append('start_enrichment', 'true');
      formData.append('uploaded_by', localStorage.getItem('username') || 'cns-dashboard');

      // Column mappings: {canonical: csv_column}
      const mappingsObj: Record<string, string> = {};
      item.columnMappings.forEach(m => {
        if (m.target !== 'ignore') {
          mappingsObj[m.target] = m.source;
        }
      });
      formData.append('column_mappings', JSON.stringify(mappingsObj));

      const response = await fetch(`${CNS_API_URL}/boms/upload`, {
        method: 'POST',
        headers: getAdminAuthHeaders(),
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Upload failed');
      }

      const result = await response.json();
      const bomId = result.bom_id;

      setQueue(prev => prev.map(q => q.id === itemId ? {
        ...q,
        status: 'completed',
        bomId,
        expanded: false,
      } : q));

      // Start enrichment phase
      setEnrichingBomId(bomId);
      setPhase('enriching');

      // Initialize components list from line items
      if (result.line_items) {
        setComponents(result.line_items.map((li: { id: string; mpn: string; manufacturer?: string }) => ({
          id: li.id,
          mpn: li.mpn,
          manufacturer: li.manufacturer,
          status: 'pending',
        })));
      }

      // Auto-scroll to enrichment section
      setTimeout(() => enrichmentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);

    } catch (err) {
      setQueue(prev => prev.map(q => q.id === itemId ? {
        ...q,
        status: 'error',
        error: err instanceof Error ? err.message : 'Upload failed',
      } : q));
    }
  };

  // Start enrichment manually for BOMs that haven't been enriched yet
  const startEnrichmentManually = async () => {
    if (!enrichingBomId) return;

    setIsStartingEnrichment(true);
    try {
      // First, get the BOM's organization_id from the status endpoint
      const statusResponse = await fetch(`${CNS_API_URL}/boms/${enrichingBomId}/enrichment/status`, {
        headers: getAdminAuthHeaders(),
      });

      // Extract organization_id from BOM - fallback to CNS staff org if not found
      let organizationId = CNS_STAFF_ORGANIZATION_ID;
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        // The status endpoint may include the BOM's organization_id
        if (statusData.organization_id) {
          organizationId = statusData.organization_id;
        }
      }

      // Log if fallback is needed (organization_id not in status response)
      if (organizationId === CNS_STAFF_ORGANIZATION_ID) {
        console.warn('[StaffBOMWorkflow] organization_id not found in status response, using staff org fallback');
      }

      console.log(`[StaffBOMWorkflow] Starting enrichment for BOM ${enrichingBomId} with org ${organizationId}`);

      const response = await fetch(`${CNS_API_URL}/boms/${enrichingBomId}/enrichment/start`, {
        method: 'POST',
        headers: {
          ...getAdminAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organization_id: organizationId,
          priority: 7,
        }),
      });

      if (response.status === 409) {
        console.log('[StaffBOMWorkflow] Enrichment already in progress');
      } else if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to start enrichment');
      } else {
        console.log('[StaffBOMWorkflow] Enrichment started successfully');
      }
    } catch (err) {
      console.error('[StaffBOMWorkflow] Error starting enrichment:', err);
    } finally {
      setIsStartingEnrichment(false);
    }
  };

  const runRiskAnalysis = async () => {
    if (!enrichingBomId) return;

    setRiskLoading(true);

    try {
      const response = await fetch(`${CNS_API_URL}/risk/boms/${enrichingBomId}`, {
        headers: { ...getAdminAuthHeaders(), 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        setRiskMetrics({
          grade: data.risk_grade || 'C',
          score: data.risk_score || 50,
          lifecycleRisk: data.lifecycle_risk || 30,
          supplyChainRisk: data.supply_chain_risk || 40,
          complianceRisk: data.compliance_risk || 20,
          highRiskCount: data.high_risk_count || 0,
          alertCount: data.alert_count || 0,
        });
      }
    } catch (err) {
      console.error('Risk analysis failed:', err);
    } finally {
      setRiskLoading(false);
      setPhase('complete');
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
    }
  };

  // ============================================================
  // Queue Actions
  // ============================================================

  const updateMapping = (itemId: string, source: string, target: string) => {
    setQueue(prev => prev.map(q => {
      if (q.id !== itemId) return q;
      return {
        ...q,
        columnMappings: q.columnMappings?.map(m =>
          m.source === source ? { ...m, target: target as ColumnMapping['target'] } : m
        ),
      };
    }));
  };

  const toggleExpand = (itemId: string) => {
    setQueue(prev => prev.map(q =>
      q.id === itemId ? { ...q, expanded: !q.expanded } : q
    ));
  };

  const deleteItem = (itemId: string) => {
    setQueue(prev => prev.filter(q => q.id !== itemId));
  };

  const downloadFile = (item: QueueItem) => {
    const url = URL.createObjectURL(item.file);
    const link = document.createElement('a');
    link.href = url;
    link.download = item.file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setPhase('upload');
    setQueue([]);
    setEnrichingBomId(null);
    setComponents([]);
    setRiskMetrics(null);
  };

  // ============================================================
  // Render
  // ============================================================

  const enrichmentMetrics = useMemo(() => ({
    pending: enrichmentState?.pending_items || 0,
    processing: 1, // Current enriching
    completed: enrichmentState?.enriched_items || 0,
    failed: (enrichmentState?.failed_items || 0) + (enrichmentState?.not_found_items || 0),
  }), [enrichmentState]);

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
                  bgcolor: 'success.50',
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
                  bgcolor: 'primary.50',
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
                  bgcolor: dragActive ? 'action.hover' : 'warning.50',
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

                  <MetricsCard metrics={queueMetrics} />
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
                      sx={{ mb: 2, bgcolor: 'success.50' }}
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
                          onClick={() => {
                            setQueue(prev => prev.map(q => q.id === item.id ? { ...q, expanded: true } : q));
                          }}
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
                  <MetricsCard metrics={enrichmentMetrics} />

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
                            bgcolor: comp.status === 'enriching' ? 'primary.50' : 'transparent',
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
                      <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', bgcolor: phase === 'complete' ? 'success.50' : 'grey.50', border: phase === 'complete' ? '2px solid' : '1px solid', borderColor: phase === 'complete' ? 'success.main' : 'divider' }}>
                        <CheckCircleIcon color={phase === 'complete' ? 'success' : 'disabled'} />
                        <Typography variant="body2" color={phase === 'complete' ? 'success.main' : 'text.secondary'}>Complete</Typography>
                      </Paper>
                    </Grid>
                  </Grid>

                  {/* Risk Score */}
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="body2">Overall Risk Score</Typography>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="h5" fontWeight={600} color={getGradeColor(riskMetrics?.grade || 'C')}>
                        {riskMetrics?.score || 0}
                      </Typography>
                      <Chip
                        size="small"
                        label={(riskMetrics?.score || 0) < 40 ? 'Low Risk' : (riskMetrics?.score || 0) < 70 ? 'Medium Risk' : 'High Risk'}
                        color={(riskMetrics?.score || 0) < 40 ? 'success' : (riskMetrics?.score || 0) < 70 ? 'warning' : 'error'}
                      />
                    </Box>
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
              <Card sx={{ bgcolor: 'success.50', border: '1px solid', borderColor: 'success.main' }}>
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
                          {/* Grade Circle */}
                          <Box
                            sx={{
                              width: 60,
                              height: 60,
                              borderRadius: '50%',
                              bgcolor: getGradeColor(riskMetrics?.grade || 'C'),
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Typography variant="h4" fontWeight={700} color="white">
                              {riskMetrics?.grade || 'C'}
                            </Typography>
                          </Box>
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
