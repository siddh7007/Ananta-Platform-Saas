/**
 * Unified BOM Upload Component for CNS Dashboard
 *
 * Multi-step wizard with session persistence for BOM uploads.
 * UI design matches CBP's unified upload layout.
 *
 * Layout:
 * ┌──────────────────┬─────────────────────────────────────┐
 * │ Vertical Stepper │ Pipeline Header                     │
 * │                  ├─────────────────────────────────────┤
 * │ 1. Select File   │ Resume Workflow Prompt (optional)   │
 * │ 2. Preview Data  ├─────────────────────────────────────┤
 * │ 3. Map Columns   │ Step Content                        │
 * │ 4. Review        │  - File upload dropzone             │
 * │ 5. Results       │  - Data preview table               │
 * │                  │  - Column mapper                    │
 * │ [Progress Bar]   │  - Review summary                   │
 * └──────────────────┴─────────────────────────────────────┘
 *
 * Features:
 * - 2-column layout: Left sidebar (280px) + Right content
 * - 8-step wizard (file select, preview, mapping, review, upload, process, enrich, results)
 * - Session persistence (survives page refresh, 30-min expiry)
 * - Auto-detection of column mappings
 * - Real-time enrichment progress via SSE
 * - Fixed organization ID for staff context
 */

import React, { useCallback, useReducer, useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  LinearProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  FormControlLabel,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Divider,
  IconButton,
  CircularProgress,
  styled,
  alpha,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DescriptionIcon from '@mui/icons-material/Description';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import RefreshIcon from '@mui/icons-material/Refresh';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SyncIcon from '@mui/icons-material/Sync';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import TableChartIcon from '@mui/icons-material/TableChart';
import SettingsIcon from '@mui/icons-material/Settings';
import RateReviewIcon from '@mui/icons-material/RateReview';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

import { useDropzone } from 'react-dropzone';
import { BOMColumnMapper } from './BOMColumnMapper';
import { VerticalStepper, type WorkflowStep, type StepStatus } from './VerticalStepper';
import {
  parseBOMFile,
  convertToBomColumnMapping,
  type BomColumnMapping,
  type BomFilePreview,
} from '../../utils/bomParser';
import {
  useAutoSaveBomUpload,
  type BomUploadStep,
  type PersistedBomUploadState,
  UPLOAD_STEPS,
} from '../../hooks/useBomUploadPersistence';
import { CNS_API_URL, CNS_STAFF_ORGANIZATION_ID, getAuthHeaders, getAuthHeadersAsync, hasValidAuthToken } from '../../config/api';

// Styled components for the layout
const PageContainer = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  backgroundColor: alpha(theme.palette.grey[100], 0.5),
  padding: theme.spacing(3),
}));

const GridLayout = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: '280px 1fr',
  gap: theme.spacing(3),
  [theme.breakpoints.down('lg')]: {
    gridTemplateColumns: '1fr',
  },
}));

const Sidebar = styled('aside')(({ theme }) => ({
  position: 'sticky',
  top: theme.spacing(3),
  height: `calc(100vh - ${theme.spacing(6)})`,
  [theme.breakpoints.down('lg')]: {
    position: 'static',
    height: 'auto',
  },
}));

const MainContent = styled('main')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3),
}));

const PipelineHeader = styled(Box)(({ theme }) => ({
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.palette.divider}`,
  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.1)} 0%, ${alpha(theme.palette.secondary.light, 0.1)} 100%)`,
  padding: theme.spacing(2),
}));

const ResumePromptCard = styled(Card)(({ theme }) => ({
  borderColor: theme.palette.warning.light,
  backgroundColor: alpha(theme.palette.warning.light, 0.1),
}));

// Full upload state (includes non-persistable File object)
interface BomUploadState {
  currentStep: BomUploadStep;
  file: File | null;
  preview: BomFilePreview | null;
  mapping: BomColumnMapping;
  bomName: string;
  bomDescription: string;
  autoEnrich: boolean;
  priority: 'low' | 'normal' | 'high';
  uploadProgress: number;
  uploadResult: {
    bomId: string;
    name: string;
    lineCount: number;
    status: string;
  } | null;
  error: string | null;
  validationErrors: { message: string; severity: 'error' | 'warning' }[];
}

const initialState: BomUploadState = {
  currentStep: 'select_file',
  file: null,
  preview: null,
  mapping: { mpn: '' },
  bomName: '',
  bomDescription: '',
  autoEnrich: true,
  priority: 'normal',
  uploadProgress: 0,
  uploadResult: null,
  error: null,
  validationErrors: [],
};

type Action =
  | { type: 'SET_STEP'; step: BomUploadStep }
  | { type: 'SET_FILE'; file: File; preview: BomFilePreview; mapping: BomColumnMapping; name: string }
  | { type: 'SET_MAPPING'; mapping: BomColumnMapping }
  | { type: 'SET_BOM_NAME'; name: string }
  | { type: 'SET_BOM_DESCRIPTION'; description: string }
  | { type: 'SET_AUTO_ENRICH'; autoEnrich: boolean }
  | { type: 'SET_PRIORITY'; priority: 'low' | 'normal' | 'high' }
  | { type: 'SET_UPLOAD_PROGRESS'; progress: number }
  | { type: 'SET_UPLOAD_RESULT'; result: BomUploadState['uploadResult'] }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_VALIDATION_ERRORS'; errors: { message: string; severity: 'error' | 'warning' }[] }
  | { type: 'RESTORE'; state: PersistedBomUploadState; preview: BomFilePreview | null }
  | { type: 'RESET' };

function reducer(state: BomUploadState, action: Action): BomUploadState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, currentStep: action.step };
    case 'SET_FILE':
      return {
        ...state,
        file: action.file,
        preview: action.preview,
        mapping: action.mapping,
        bomName: action.name,
        error: null,
      };
    case 'SET_MAPPING':
      return { ...state, mapping: action.mapping };
    case 'SET_BOM_NAME':
      return { ...state, bomName: action.name };
    case 'SET_BOM_DESCRIPTION':
      return { ...state, bomDescription: action.description };
    case 'SET_AUTO_ENRICH':
      return { ...state, autoEnrich: action.autoEnrich };
    case 'SET_PRIORITY':
      return { ...state, priority: action.priority };
    case 'SET_UPLOAD_PROGRESS':
      return { ...state, uploadProgress: action.progress };
    case 'SET_UPLOAD_RESULT':
      return { ...state, uploadResult: action.result };
    case 'SET_ERROR':
      return { ...state, error: action.error };
    case 'SET_VALIDATION_ERRORS':
      return { ...state, validationErrors: action.errors };
    case 'RESTORE':
      return {
        ...state,
        currentStep: action.state.currentStep,
        mapping: action.state.mapping,
        bomName: action.state.bomName,
        bomDescription: action.state.bomDescription,
        autoEnrich: action.state.autoEnrich,
        priority: action.state.priority,
        preview: action.preview,
        uploadResult: action.state.uploadResult || null,
        file: null, // Cannot restore File object
      };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

// Step icons for the stepper
const stepIcons: Record<BomUploadStep, React.ReactNode> = {
  select_file: <CloudUploadIcon />,
  preview_data: <TableChartIcon />,
  map_columns: <SettingsIcon />,
  review_summary: <RateReviewIcon />,
  uploading: <CloudUploadIcon />,
  processing: <SyncIcon />,
  enriching: <AutoAwesomeIcon />,
  results: <DoneAllIcon />,
};

export const UnifiedBOMUpload: React.FC = () => {
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(reducer, initialState);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const [restoredState, setRestoredState] = useState<PersistedBomUploadState | null>(null);
  const enrichmentPollRef = useRef<NodeJS.Timeout | null>(null);
  const stateRef = useRef(state); // Ref to access latest state in polling callback
  stateRef.current = state; // Keep ref updated

  const {
    currentStep,
    file,
    preview,
    mapping,
    bomName,
    bomDescription,
    autoEnrich,
    priority,
    uploadProgress,
    uploadResult,
    error,
    validationErrors,
  } = state;

  // Session persistence
  const handleRestore = useCallback((savedState: PersistedBomUploadState, savedPreview: BomFilePreview | null) => {
    dispatch({ type: 'RESTORE', state: savedState, preview: savedPreview });
    if (savedState.fileName && savedState.currentStep !== 'select_file') {
      setShowRestorePrompt(true);
      setRestoredState(savedState);
    }
  }, []);

  const { clearState: clearPersistedState } = useAutoSaveBomUpload(
    {
      currentStep,
      mapping,
      bomName,
      bomDescription,
      autoEnrich,
      priority,
      file,
      preview,
      uploadResult,
    },
    handleRestore
  );

  // File drop handler
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    if (!selectedFile) return;

    // Validate file size (max 10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      dispatch({ type: 'SET_ERROR', error: 'File size exceeds 10MB limit' });
      return;
    }

    setIsProcessing(true);
    dispatch({ type: 'SET_ERROR', error: null });

    try {
      const parsed = await parseBOMFile(selectedFile);

      // Convert detected mappings to BomColumnMapping
      const autoMapping = convertToBomColumnMapping(parsed.detected_mappings);

      // Generate default name from filename
      const defaultName = selectedFile.name.replace(/\.[^/.]+$/, '');

      // Create preview structure
      const filePreview: BomFilePreview = {
        headers: parsed.columns,
        rows: parsed.rows.slice(0, 100).map(row =>
          parsed.columns.map(col => String(row[col] || ''))
        ),
        totalRows: parsed.total_rows,
        detectedMappings: parsed.detected_mappings,
      };

      dispatch({
        type: 'SET_FILE',
        file: selectedFile,
        preview: filePreview,
        mapping: autoMapping,
        name: defaultName,
      });
      dispatch({ type: 'SET_STEP', step: 'preview_data' });
      setShowRestorePrompt(false);
      setRestoredState(null);
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        error: err instanceof Error ? err.message : 'Failed to parse file',
      });
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/plain': ['.txt'],
    },
    multiple: false,
    disabled: isProcessing,
  });

  // Step navigation
  const stepOrder: BomUploadStep[] = [
    'select_file', 'preview_data', 'map_columns', 'review_summary',
    'uploading', 'processing', 'enriching', 'results'
  ];

  const currentStepIndex = stepOrder.indexOf(currentStep);

  const goNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < stepOrder.length) {
      dispatch({ type: 'SET_STEP', step: stepOrder[nextIndex] });
    }
  };

  const goBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      dispatch({ type: 'SET_STEP', step: stepOrder[prevIndex] });
    }
  };

  // Validate before proceeding
  const validateMapping = (): boolean => {
    const errors: { message: string; severity: 'error' | 'warning' }[] = [];

    if (!mapping.mpn) {
      errors.push({ message: 'MPN column is required for enrichment', severity: 'error' });
    }

    if (!mapping.manufacturer) {
      errors.push({ message: 'Manufacturer mapping is recommended for better matching', severity: 'warning' });
    }

    dispatch({ type: 'SET_VALIDATION_ERRORS', errors });
    return !errors.some(e => e.severity === 'error');
  };

  // Upload BOM with timeout, auth validation, and proper error handling
  const handleUpload = async () => {
    // Pre-flight validation
    if (!file || !bomName) {
      dispatch({ type: 'SET_ERROR', error: 'Please provide a file and BOM name' });
      return;
    }

    if (!mapping.mpn) {
      dispatch({ type: 'SET_ERROR', error: 'MPN column mapping is required' });
      return;
    }

    // Check authentication before proceeding
    if (!hasValidAuthToken()) {
      dispatch({ type: 'SET_ERROR', error: 'Authentication required. Please log in and try again.' });
      return;
    }

    dispatch({ type: 'SET_STEP', step: 'uploading' });
    dispatch({ type: 'SET_UPLOAD_PROGRESS', progress: 0 });
    setIsProcessing(true);

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('organization_id', CNS_STAFF_ORGANIZATION_ID);
      formData.append('name', bomName);
      formData.append('description', bomDescription);
      formData.append('source', 'staff_bulk');
      formData.append('priority', priority);
      formData.append('start_enrichment', autoEnrich ? 'true' : 'false');

      // Add column mapping
      formData.append('column_mapping', JSON.stringify(mapping));

      const response = await fetch(`${CNS_API_URL}/boms/upload`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = 'Upload failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.message || `Upload failed (${response.status})`;
        } catch {
          errorMessage = `Upload failed with status ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();

      // Validate response structure
      const bomId = result.bom_id || result.job_id;
      if (!bomId) {
        throw new Error('Invalid server response: missing BOM ID');
      }

      dispatch({
        type: 'SET_UPLOAD_RESULT',
        result: {
          bomId,
          name: bomName,
          lineCount: result.component_count || result.total_items || result.line_count || 0,
          status: result.status || 'uploaded',
        },
      });

      dispatch({ type: 'SET_UPLOAD_PROGRESS', progress: 100 });

      // Move to processing/enriching step
      if (autoEnrich) {
        dispatch({ type: 'SET_STEP', step: 'processing' });
        startEnrichmentPolling(bomId);
      } else {
        dispatch({ type: 'SET_STEP', step: 'results' });
        setIsProcessing(false);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      let errorMessage = 'Upload failed';

      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          errorMessage = 'Upload timed out. Please try again or use a smaller file.';
        } else if (err.message.includes('NetworkError') || err.message.includes('Failed to fetch')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else {
          errorMessage = err.message;
        }
      }

      dispatch({ type: 'SET_ERROR', error: errorMessage });
      dispatch({ type: 'SET_STEP', step: 'review_summary' });
      setIsProcessing(false);
    }
  };

  // Poll for enrichment status
  const startEnrichmentPolling = (bomId: string) => {
    dispatch({ type: 'SET_STEP', step: 'enriching' });
    let authRetryCount = 0;
    const MAX_AUTH_RETRIES = 3;

    const poll = async () => {
      try {
        // Use async auth headers to ensure token refresh
        const headers = await getAuthHeadersAsync();

        const response = await fetch(
          `${CNS_API_URL}/boms/${bomId}/enrichment/status`,
          { headers }
        );

        // Handle authentication errors
        if (response.status === 401) {
          authRetryCount++;
          console.warn(`[Enrichment Poll] Auth failed (attempt ${authRetryCount}/${MAX_AUTH_RETRIES})`);

          if (authRetryCount >= MAX_AUTH_RETRIES) {
            // Stop polling and show error
            if (enrichmentPollRef.current) {
              clearInterval(enrichmentPollRef.current);
              enrichmentPollRef.current = null;
            }
            dispatch({ type: 'SET_ERROR', error: 'Session expired. Please refresh the page and login again.' });
            dispatch({ type: 'SET_STEP', step: 'results' });
            setIsProcessing(false);
          }
          return;
        }

        // Reset auth retry count on success
        authRetryCount = 0;

        if (!response.ok) {
          throw new Error('Failed to fetch enrichment status');
        }

        const status = await response.json();
        console.log('[Enrichment Poll] Status response:', status);

        // API returns progress.percent_complete (not progress_percent)
        const progress = status.progress?.percent_complete || status.progress_percent || 0;
        console.log(`[Enrichment Poll] Progress: ${progress}%, Status: ${status.status}`);
        dispatch({ type: 'SET_UPLOAD_PROGRESS', progress });

        // Update upload result with real line count from progress response
        const totalItems = status.progress?.total_items;
        if (totalItems && totalItems > 0) {
          const currentState = stateRef.current;
          dispatch({
            type: 'SET_UPLOAD_RESULT',
            result: {
              bomId,
              name: currentState.bomName || bomName,
              lineCount: totalItems,
              status: status.status || 'enriching',
            },
          });
        }

        if (status.status === 'completed' || status.status === 'complete' || status.status === 'enriched' || progress >= 100) {
          dispatch({ type: 'SET_STEP', step: 'results' });
          setIsProcessing(false);
          if (enrichmentPollRef.current) {
            clearInterval(enrichmentPollRef.current);
            enrichmentPollRef.current = null;
          }
        } else if (status.status === 'failed') {
          dispatch({ type: 'SET_ERROR', error: 'Enrichment failed' });
          dispatch({ type: 'SET_STEP', step: 'results' });
          setIsProcessing(false);
          if (enrichmentPollRef.current) {
            clearInterval(enrichmentPollRef.current);
            enrichmentPollRef.current = null;
          }
        }
      } catch (err) {
        console.error('Enrichment poll error:', err);
      }
    };

    // Poll every 3 seconds
    enrichmentPollRef.current = setInterval(poll, 3000);
    poll(); // Initial poll
  };

  // Cleanup polling on unmount or step change
  useEffect(() => {
    return () => {
      if (enrichmentPollRef.current) {
        clearInterval(enrichmentPollRef.current);
        enrichmentPollRef.current = null;
      }
    };
  }, []);

  // Clear polling when navigating away from enriching step
  useEffect(() => {
    if (currentStep !== 'enriching' && currentStep !== 'processing') {
      if (enrichmentPollRef.current) {
        clearInterval(enrichmentPollRef.current);
        enrichmentPollRef.current = null;
      }
    }
  }, [currentStep]);

  // Handle reset
  const handleReset = () => {
    dispatch({ type: 'RESET' });
    clearPersistedState();
    if (enrichmentPollRef.current) {
      clearInterval(enrichmentPollRef.current);
      enrichmentPollRef.current = null;
    }
  };

  // Handle dismiss restore
  const handleDismissRestore = () => {
    setShowRestorePrompt(false);
    setRestoredState(null);
    clearPersistedState();
    dispatch({ type: 'RESET' });
  };

  // Handle step click from vertical stepper
  const handleStepClick = useCallback((stepId: BomUploadStep) => {
    // Only allow navigation to previous steps, not forward
    const targetIndex = stepOrder.indexOf(stepId);
    if (targetIndex < currentStepIndex && targetIndex >= 0) {
      dispatch({ type: 'SET_STEP', step: stepId });
    }
  }, [currentStepIndex]);

  // Build workflow steps with dynamic status for vertical stepper
  const workflowSteps = useMemo((): WorkflowStep[] => {
    const getStepStatus = (stepId: BomUploadStep): StepStatus => {
      if (error && stepId !== 'select_file') return 'error';

      const stepIndex = stepOrder.indexOf(stepId);

      if (stepId === currentStep) {
        return 'active';
      }
      if (stepIndex < currentStepIndex) {
        return 'complete';
      }
      return 'pending';
    };

    // Visible steps for the sidebar (exclude intermediate processing steps)
    const visibleStepConfigs: { id: BomUploadStep; title: string; description: string }[] = [
      { id: 'select_file', title: 'Select File', description: file ? file.name : 'Choose BOM file to upload' },
      { id: 'preview_data', title: 'Preview Data', description: preview ? `${preview.totalRows} rows detected` : 'Review parsed data' },
      { id: 'map_columns', title: 'Map Columns', description: mapping.mpn ? `MPN: ${mapping.mpn}` : 'Configure field mappings' },
      { id: 'review_summary', title: 'Review & Configure', description: 'Confirm settings and upload' },
      { id: 'results', title: 'Results', description: uploadResult ? 'Upload complete' : 'View results' },
    ];

    return visibleStepConfigs.map((config) => ({
      id: config.id,
      title: config.title,
      description: config.description,
      icon: stepIcons[config.id],
      status: getStepStatus(config.id),
    }));
  }, [currentStep, currentStepIndex, file, preview, mapping, uploadResult, error]);

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 'select_file':
        return renderSelectFile();
      case 'preview_data':
        return renderPreviewData();
      case 'map_columns':
        return renderMapColumns();
      case 'review_summary':
        return renderReviewSummary();
      case 'uploading':
      case 'processing':
      case 'enriching':
        return renderProcessing();
      case 'results':
        return renderResults();
      default:
        return null;
    }
  };

  // Step 1: Select File
  const renderSelectFile = () => (
    <Card>
      <CardContent sx={{ p: 4 }}>
        <Box sx={{ maxWidth: 600, mx: 'auto' }}>
          {/* Restore prompt */}
          {showRestorePrompt && restoredState?.fileName && (
            <Alert
              severity="info"
              icon={<RefreshIcon />}
              action={
                <Button color="inherit" size="small" onClick={handleDismissRestore}>
                  Start Fresh
                </Button>
              }
              sx={{ mb: 3 }}
            >
              <Typography variant="subtitle2">Resume Previous Upload</Typography>
              <Typography variant="body2">
                You have an incomplete upload session for <strong>{restoredState.fileName}</strong>.
                Re-upload the same file to continue.
              </Typography>
            </Alert>
          )}

          <Box textAlign="center" mb={3}>
            <CloudUploadIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              Upload Your BOM
            </Typography>
            <Typography color="textSecondary">
              Drag and drop your BOM file or click to browse
            </Typography>
          </Box>

          <Paper
            {...getRootProps()}
            sx={{
              p: 6,
              border: '2px dashed',
              borderColor: isDragActive ? 'primary.main' : 'grey.300',
              bgcolor: isDragActive ? 'action.hover' : 'background.paper',
              cursor: isProcessing ? 'wait' : 'pointer',
              transition: 'all 0.2s',
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: 'action.hover',
              },
            }}
          >
            <input {...getInputProps()} />
            <Box textAlign="center">
              {isProcessing ? (
                <>
                  <CircularProgress size={48} sx={{ mb: 2 }} />
                  <Typography>Parsing file...</Typography>
                </>
              ) : (
                <>
                  <DescriptionIcon sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
                  <Typography variant="body1" gutterBottom>
                    <strong>CSV</strong>, <strong>XLS</strong>, <strong>XLSX</strong>
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    Maximum file size: 10MB
                  </Typography>
                </>
              )}
            </Box>
          </Paper>

          {error && (
            <Alert severity="error" sx={{ mt: 3 }} onClose={() => dispatch({ type: 'SET_ERROR', error: null })}>
              {error}
            </Alert>
          )}
        </Box>
      </CardContent>
    </Card>
  );

  // Step 2: Preview Data
  const renderPreviewData = () => (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
          <Box display="flex" alignItems="center" gap={2}>
            <Paper sx={{ p: 1.5, bgcolor: 'primary.light' }}>
              <DescriptionIcon sx={{ color: 'primary.contrastText' }} />
            </Paper>
            <Box>
              <Typography fontWeight={600}>{file?.name}</Typography>
              <Typography variant="body2" color="textSecondary">
                {preview?.totalRows.toLocaleString()} rows detected
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={handleReset} title="Remove file">
            <CloseIcon />
          </IconButton>
        </Box>

        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <TableChartIcon color="action" />
          <Typography variant="subtitle1" fontWeight={600}>
            Data Preview
          </Typography>
          <Chip label="First 10 rows" size="small" />
        </Box>

        <TableContainer component={Paper} variant="outlined" sx={{ mb: 3, maxHeight: 400 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.100' }}>
                <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.100' }}>#</TableCell>
                {preview?.headers.map((h, i) => (
                  <TableCell key={i} sx={{ fontWeight: 600, bgcolor: 'grey.100' }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {preview?.rows.slice(0, 10).map((row, i) => (
                <TableRow key={i} hover>
                  <TableCell sx={{ color: 'text.secondary' }}>{i + 1}</TableCell>
                  {row.map((cell, j) => (
                    <TableCell key={j}>
                      {cell || <Typography color="grey.400">-</Typography>}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Box display="flex" justifyContent="space-between">
          <Button startIcon={<ArrowBackIcon />} onClick={goBack}>
            Back
          </Button>
          <Button variant="contained" endIcon={<ArrowForwardIcon />} onClick={goNext}>
            Continue
          </Button>
        </Box>
      </CardContent>
    </Card>
  );

  // Step 3: Map Columns
  const renderMapColumns = () => (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <BOMColumnMapper
          mapping={mapping}
          preview={preview}
          onMappingChange={(newMapping) => dispatch({ type: 'SET_MAPPING', mapping: newMapping })}
          validationErrors={validationErrors}
        />

        <Box display="flex" justifyContent="space-between" mt={4}>
          <Button startIcon={<ArrowBackIcon />} onClick={goBack}>
            Back
          </Button>
          <Button
            variant="contained"
            endIcon={<ArrowForwardIcon />}
            onClick={() => {
              if (validateMapping()) goNext();
            }}
            disabled={!mapping.mpn}
          >
            Continue
          </Button>
        </Box>
      </CardContent>
    </Card>
  );

  // Step 4: Review Summary
  const renderReviewSummary = () => (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ maxWidth: 600, mx: 'auto' }}>
          <Box display="flex" alignItems="center" gap={1} mb={3}>
            <RateReviewIcon color="primary" />
            <Typography variant="h6">Review & Configure</Typography>
          </Box>

          <Box component="form" sx={{ '& > *': { mb: 3 } }}>
            <TextField
              label="BOM Name"
              value={bomName}
              onChange={(e) => dispatch({ type: 'SET_BOM_NAME', name: e.target.value })}
              fullWidth
              required
              placeholder="Enter BOM name"
            />

            <TextField
              label="Description"
              value={bomDescription}
              onChange={(e) => dispatch({ type: 'SET_BOM_DESCRIPTION', description: e.target.value })}
              fullWidth
              multiline
              rows={3}
              placeholder="Optional description"
            />

            <Paper variant="outlined" sx={{ p: 2 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={autoEnrich}
                    onChange={(e) => dispatch({ type: 'SET_AUTO_ENRICH', autoEnrich: e.target.checked })}
                  />
                }
                label={
                  <Box>
                    <Typography fontWeight={500}>Auto-enrich components</Typography>
                    <Typography variant="body2" color="textSecondary">
                      Automatically match and fetch data after upload
                    </Typography>
                  </Box>
                }
              />

              {autoEnrich && (
                <FormControl fullWidth size="small" sx={{ mt: 2 }}>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={priority}
                    onChange={(e) => dispatch({ type: 'SET_PRIORITY', priority: e.target.value as 'low' | 'normal' | 'high' })}
                    label="Priority"
                  >
                    <MenuItem value="low">Low</MenuItem>
                    <MenuItem value="normal">Normal</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                  </Select>
                </FormControl>
              )}
            </Paper>

            <Divider />

            {/* Summary */}
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>Upload Summary</Typography>
              <Box component="dl" sx={{ m: 0, '& dt': { fontWeight: 500, color: 'text.secondary' }, '& dd': { mb: 1 } }}>
                <Typography component="dt" variant="body2">File</Typography>
                <Typography component="dd">{file?.name}</Typography>

                <Typography component="dt" variant="body2">Rows</Typography>
                <Typography component="dd">{preview?.totalRows.toLocaleString()}</Typography>

                <Typography component="dt" variant="body2">MPN Column</Typography>
                <Typography component="dd">{mapping.mpn}</Typography>

                <Typography component="dt" variant="body2">Organization</Typography>
                <Typography component="dd">
                  <Chip label="CNS Staff" size="small" color="primary" variant="outlined" />
                </Typography>
              </Box>
            </Paper>

            {error && (
              <Alert severity="error" onClose={() => dispatch({ type: 'SET_ERROR', error: null })}>
                {error}
              </Alert>
            )}
          </Box>

          <Box display="flex" justifyContent="space-between">
            <Button startIcon={<ArrowBackIcon />} onClick={goBack}>
              Back
            </Button>
            <Button
              variant="contained"
              color="primary"
              startIcon={<CloudUploadIcon />}
              onClick={handleUpload}
              disabled={!bomName || isProcessing}
            >
              {autoEnrich ? 'Upload & Enrich' : 'Upload BOM'}
            </Button>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  // Processing/Enriching step
  const renderProcessing = () => (
    <Card>
      <CardContent sx={{ p: 4 }}>
        <Box sx={{ maxWidth: 500, mx: 'auto', textAlign: 'center' }}>
          <CircularProgress size={64} sx={{ mb: 3 }} />

          <Typography variant="h6" gutterBottom>
            {currentStep === 'uploading' && 'Uploading BOM...'}
            {currentStep === 'processing' && 'Processing BOM...'}
            {currentStep === 'enriching' && 'Enriching Components...'}
          </Typography>

          <Typography color="textSecondary" paragraph>
            {currentStep === 'uploading' && 'Sending your file to the server'}
            {currentStep === 'processing' && 'Parsing and validating BOM data'}
            {currentStep === 'enriching' && 'Matching components and fetching enrichment data'}
          </Typography>

          <Box sx={{ mt: 3, px: 4 }}>
            <LinearProgress
              variant="determinate"
              value={uploadProgress}
              sx={{ height: 8, borderRadius: 4 }}
            />
            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
              {uploadProgress.toFixed(0)}% complete
            </Typography>
          </Box>

          {uploadResult && (
            <Paper variant="outlined" sx={{ mt: 3, p: 2, textAlign: 'left' }}>
              <Typography variant="subtitle2" gutterBottom>Upload Details</Typography>
              <Typography variant="body2">BOM ID: {uploadResult.bomId.substring(0, 8)}...</Typography>
              <Typography variant="body2">Items: {uploadResult.lineCount}</Typography>
            </Paper>
          )}
        </Box>
      </CardContent>
    </Card>
  );

  // Results step
  const renderResults = () => (
    <Card>
      <CardContent sx={{ p: 4 }}>
        <Box sx={{ maxWidth: 600, mx: 'auto' }}>
          <Box textAlign="center" mb={4}>
            {error ? (
              <ErrorIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
            ) : (
              <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            )}
            <Typography variant="h5" gutterBottom>
              {error ? 'Upload Completed with Errors' : 'Upload Complete!'}
            </Typography>
            <Typography color="textSecondary">
              {error || 'Your BOM has been successfully uploaded and processed.'}
            </Typography>
          </Box>

          {uploadResult && (
            <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>{uploadResult.name}</Typography>
              <Divider sx={{ my: 2 }} />
              <Box display="grid" gridTemplateColumns="repeat(2, 1fr)" gap={2}>
                <Box>
                  <Typography variant="body2" color="textSecondary">BOM ID</Typography>
                  <Typography>{uploadResult.bomId.substring(0, 12)}...</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="textSecondary">Line Items</Typography>
                  <Typography>{uploadResult.lineCount}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="textSecondary">Status</Typography>
                  <Chip
                    label={uploadResult.status}
                    color={uploadResult.status === 'enriched' ? 'success' : 'default'}
                    size="small"
                  />
                </Box>
                <Box>
                  <Typography variant="body2" color="textSecondary">Enrichment</Typography>
                  <Chip
                    label={autoEnrich ? 'Completed' : 'Not Requested'}
                    color={autoEnrich ? 'success' : 'default'}
                    size="small"
                  />
                </Box>
              </Box>
            </Paper>
          )}

          <Box display="flex" justifyContent="center" gap={2}>
            <Button
              variant="outlined"
              onClick={handleReset}
              startIcon={<RefreshIcon />}
            >
              Upload Another
            </Button>
            <Button
              variant="contained"
              onClick={() => navigate(`/bom-jobs/${uploadResult?.bomId}`)}
            >
              View Details
            </Button>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <PageContainer>
      <GridLayout>
        {/* Left Sidebar - Vertical Stepper */}
        <Sidebar>
          <Card sx={{ height: '100%', overflow: 'auto' }}>
            <VerticalStepper
              currentStepId={currentStep}
              steps={workflowSteps}
              onStepClick={handleStepClick}
              allowNavigateBack={true}
              autoScroll={true}
            />
          </Card>
        </Sidebar>

        {/* Right Content Area */}
        <MainContent>
          {/* Pipeline Header */}
          <PipelineHeader>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="body2" fontWeight={600} color="primary.main">
                Unified Pipeline:
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Upload → Parse → Map → Enrich all on one page.
              </Typography>
            </Box>
          </PipelineHeader>

          {/* Resume Workflow Prompt */}
          {showRestorePrompt && restoredState && (
            <ResumePromptCard>
              <CardContent>
                <Box display="flex" alignItems="flex-start" gap={2}>
                  <Box
                    sx={{
                      p: 1,
                      borderRadius: 1,
                      bgcolor: 'warning.light',
                      color: 'warning.dark',
                    }}
                  >
                    <AccessTimeIcon />
                  </Box>
                  <Box flex={1}>
                    <Typography variant="subtitle1" fontWeight={600} color="warning.dark">
                      Resume Previous Workflow?
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      You have an in-progress BOM workflow: <strong>{restoredState.bomName}</strong>
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Last step: {restoredState.currentStep.replace(/_/g, ' ')}
                    </Typography>
                    <Box display="flex" gap={1.5} mt={2}>
                      <Button
                        size="small"
                        variant="contained"
                        color="warning"
                        startIcon={<RefreshIcon />}
                        onClick={() => {
                          if (restoredState) {
                            dispatch({ type: 'RESTORE', state: restoredState, preview: null });
                          }
                          setShowRestorePrompt(false);
                        }}
                      >
                        Resume Workflow
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={handleDismissRestore}
                      >
                        Start Fresh
                      </Button>
                    </Box>
                  </Box>
                </Box>
              </CardContent>
            </ResumePromptCard>
          )}

          {/* Step Content */}
          {renderStepContent()}
        </MainContent>
      </GridLayout>
    </PageContainer>
  );
};

export default UnifiedBOMUpload;
