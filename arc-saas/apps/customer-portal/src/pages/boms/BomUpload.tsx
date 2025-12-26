import { useState, useCallback, useReducer, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import {
  Upload,
  FileText,
  X,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Table,
  Settings,
  Eye,
  Sparkles,
  AlertTriangle,
  FolderOpen,
  RotateCcw,
  FileCheck,
  Activity,
  BarChart3,
  XCircle,
  Clock,
  FileBarChart,
  Check,
  Pause,
  Play,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { uploadBom } from '@/services/bom.service';
import { parseBOMFile, validateMappings, type ColumnMapping } from '@/utils/bomParser';
import { useTenant } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/useToast';
import { useAutoLoadTemplate } from '@/hooks/useColumnMappingTemplates';
import { useAutoSaveBomUpload, type PersistedBomUploadState } from '@/hooks/useBomUploadPersistence';
import { useEnrichmentSSE } from '@/hooks/useEnrichmentSSE';
import { useProcessingStatus } from '@/hooks/useProcessingStatus';
import { ColumnMappingTemplateSelector } from '@/components/bom/ColumnMappingTemplateSelector';
import { EnrichmentProgress } from '@/components/bom/EnrichmentProgress';
import {
  ProcessingQueueView,
  type ProcessingStage,
  type StageInfo,
} from '@/components/bom/ProcessingQueueView';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  BomUploadStep,
  BomUploadState,
  BomColumnMapping,
  BomFilePreview,
  UPLOAD_STEPS,
  ValidationError,
} from '@/types/bom';

// Initial state
const initialState: BomUploadState = {
  currentStep: 'select_file',
  file: null,
  preview: null,
  mapping: { mpn: '' },
  bomName: '',
  bomDescription: '',
  projectId: undefined,
  autoEnrich: true,
  enrichmentLevel: 'standard',
  uploadProgress: 0,
  uploadResult: null,
  error: null,
  validationErrors: [],
};

// Field validation errors
interface FieldErrors {
  bomName?: string;
  mapping?: string;
  [key: string]: string | undefined;
}

// Actions
type Action =
  | { type: 'SET_STEP'; step: BomUploadStep }
  | { type: 'SET_FILE'; file: File; preview: BomFilePreview; mapping: BomColumnMapping; name: string }
  | { type: 'SET_MAPPING'; mapping: BomColumnMapping }
  | { type: 'SET_BOM_NAME'; name: string }
  | { type: 'SET_BOM_DESCRIPTION'; description: string }
  | { type: 'SET_PROJECT_ID'; projectId: string | undefined }
  | { type: 'SET_AUTO_ENRICH'; autoEnrich: boolean }
  | { type: 'SET_ENRICHMENT_LEVEL'; level: 'basic' | 'standard' | 'comprehensive' }
  | { type: 'SET_UPLOAD_PROGRESS'; progress: number }
  | { type: 'SET_UPLOAD_RESULT'; result: BomUploadState['uploadResult'] }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_VALIDATION_ERRORS'; errors: ValidationError[] }
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
    case 'SET_PROJECT_ID':
      return { ...state, projectId: action.projectId };
    case 'SET_AUTO_ENRICH':
      return { ...state, autoEnrich: action.autoEnrich };
    case 'SET_ENRICHMENT_LEVEL':
      return { ...state, enrichmentLevel: action.level };
    case 'SET_UPLOAD_PROGRESS':
      return { ...state, uploadProgress: action.progress };
    case 'SET_UPLOAD_RESULT':
      return { ...state, uploadResult: action.result };
    case 'SET_ERROR':
      return { ...state, error: action.error };
    case 'SET_VALIDATION_ERRORS':
      return { ...state, validationErrors: action.errors };
    case 'RESTORE':
      // Restore from persisted state (note: file object cannot be restored)
      return {
        ...state,
        currentStep: action.state.currentStep,
        mapping: action.state.mapping,
        bomName: action.state.bomName,
        bomDescription: action.state.bomDescription,
        projectId: action.state.projectId,
        autoEnrich: action.state.autoEnrich,
        enrichmentLevel: action.state.enrichmentLevel,
        preview: action.preview,
        // File cannot be restored from sessionStorage - will need re-upload if page was refreshed
        file: null,
      };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

export function BomUploadPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  // Tenant context for future multi-tenant BOM isolation
  useTenant();
  const [state, dispatch] = useReducer(reducer, initialState);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  // Parsed column mappings for BOM field detection
  const [, setParsedMappings] = useState<ColumnMapping[]>([]);

  // Project context from localStorage (following old CBP pattern)
  const [currentProject, setCurrentProject] = useState<{ id: string; name: string } | null>(null);
  const [isLoadingProject, setIsLoadingProject] = useState(true);

  // SSE enrichment progress tracking (only active when we have a bomId and are enriching)
  const {
    progress: sseProgress,
    progressPercent,
    isComplete: sseIsComplete,
    isFailed: sseIsFailed,
    error: sseError,
    connectionStatus,
  } = useEnrichmentSSE(
    state.uploadResult?.bomId || '',
    {
      autoConnect: !!state.uploadResult?.bomId && state.currentStep === 'enriching',
      onComplete: () => {
        // Transition to results step when enrichment completes
        dispatch({ type: 'SET_STEP', step: 'results' });
        setIsProcessing(false);
      },
      onError: (error) => {
        dispatch({ type: 'SET_ERROR', error });
        toast({
          title: 'Enrichment Error',
          description: error,
          variant: 'destructive',
        });
      },
    }
  );

  // Workflow-based processing status (Temporal workflow with pause/resume)
  const {
    status: workflowStatus,
    stages: workflowStages,
    currentStage: workflowCurrentStage,
    connectionStatus: workflowConnectionStatus,
    isPaused: workflowIsPaused,
    isComplete: workflowIsComplete,
    isFailed: workflowIsFailed,
    overallProgress: workflowProgress,
    pause: pauseWorkflow,
    resume: resumeWorkflow,
    cancel: cancelWorkflow,
    error: workflowError,
    // Enhanced UI data for Queue Cards
    componentQueue: workflowComponentQueue,
    riskAnalysis: workflowRiskAnalysis,
    componentStatus: workflowComponentStatus,
    alertsCount: workflowAlertsCount,
  } = useProcessingStatus({
    bomId: state.uploadResult?.bomId || '',
    enabled: !!state.uploadResult?.bomId && ['enriching', 'processing'].includes(state.currentStep),
    onComplete: (status) => {
      // Transition to results step when workflow completes
      dispatch({ type: 'SET_STEP', step: 'results' });
      setIsProcessing(false);
      toast({
        title: 'Processing Complete',
        description: `BOM enrichment completed with ${status.enriched_items} items enriched`,
      });
    },
    onError: (error) => {
      dispatch({ type: 'SET_ERROR', error: error.message });
      toast({
        title: 'Processing Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Check for project selection on mount - redirect if not selected (old CBP business logic)
  useEffect(() => {
    const currentProjectId = localStorage.getItem('current_project_id');
    const currentProjectName = localStorage.getItem('current_project_name');

    if (!currentProjectId) {
      toast({
        title: 'No Project Selected',
        description: 'Please select a project before uploading a BOM.',
        variant: 'destructive',
      });
      navigate('/projects');
      return;
    }

    setCurrentProject({
      id: currentProjectId,
      name: currentProjectName || 'Unknown Project',
    });
    dispatch({ type: 'SET_PROJECT_ID', projectId: currentProjectId });
    setIsLoadingProject(false);
  }, [navigate, toast]);

  // Auto-load default template when file is previewed
  useAutoLoadTemplate((templateMapping) => {
    // Only auto-load if we haven't manually set a mapping yet
    if (state.currentStep === 'preview_data' && state.mapping.mpn === '') {
      dispatch({ type: 'SET_MAPPING', mapping: templateMapping });
    }
  });

  const {
    currentStep,
    file,
    preview,
    mapping,
    bomName,
    bomDescription,
    autoEnrich,
    enrichmentLevel,
    uploadProgress,
    uploadResult,
    error,
    validationErrors,
  } = state;

  // State for showing restore prompt when file needs re-upload
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const [restoredState, setRestoredState] = useState<PersistedBomUploadState | null>(null);

  // Handle restoring from persisted state
  const handleRestore = useCallback((savedState: PersistedBomUploadState, savedPreview: BomFilePreview | null) => {
    dispatch({ type: 'RESTORE', state: savedState, preview: savedPreview });
    // If we had a file but can't restore it (File objects can't be serialized),
    // show a prompt to re-upload the same file
    if (savedState.fileName && savedState.currentStep !== 'select_file') {
      setRestoredState(savedState);
      setShowRestorePrompt(true);
    }
  }, []);

  // Auto-save BOM upload state to sessionStorage
  const { clearState: clearPersistedState } = useAutoSaveBomUpload(
    {
      currentStep,
      mapping,
      bomName,
      bomDescription,
      projectId: state.projectId,
      autoEnrich,
      enrichmentLevel,
      file,
      preview,
    },
    handleRestore
  );

  // File drop handler - uses bomParser utility
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    console.log('[BomUpload] onDrop triggered, files:', acceptedFiles.length);
    if (acceptedFiles.length === 0) return;

    const uploadedFile = acceptedFiles[0];
    console.log('[BomUpload] Processing file:', uploadedFile.name, uploadedFile.size, 'bytes');
    dispatch({ type: 'SET_ERROR', error: null });
    setIsProcessing(true);

    try {
      // Use the bomParser utility for robust parsing
      console.log('[BomUpload] Calling parseBOMFile...');
      const parsed = await parseBOMFile(uploadedFile);
      console.log('[BomUpload] parseBOMFile completed successfully');

      // Debug: Log parsed data
      console.log('[BomUpload] Parsed file:', {
        columns: parsed.columns,
        detected_mappings: parsed.detected_mappings,
        totalRows: parsed.total_rows,
      });

      // Store parsed mappings for later use
      setParsedMappings(parsed.detected_mappings);

      // Convert parsed mappings to BomColumnMapping format
      const suggestedMapping: BomColumnMapping = { mpn: '' };
      parsed.detected_mappings.forEach((m) => {
        if (m.target === 'manufacturer_part_number') {
          suggestedMapping.mpn = m.source;
        } else if (m.target !== 'ignore') {
          // Map the target field names
          const fieldMap: Record<string, keyof BomColumnMapping> = {
            manufacturer: 'manufacturer',
            quantity: 'quantity',
            description: 'description',
            reference_designator: 'referenceDesignator',
            footprint: 'footprint',
          };
          const key = fieldMap[m.target];
          if (key) {
            suggestedMapping[key] = m.source;
          }
        }
      });

      // Debug: Log generated mapping
      console.log('[BomUpload] Generated suggestedMapping:', suggestedMapping);

      // Convert rows to preview format
      const previewRows = parsed.rows.map((row) =>
        parsed.columns.map((col) => String(row[col] ?? ''))
      );

      const previewData: BomFilePreview = {
        headers: parsed.columns,
        rows: previewRows,
        totalRows: parsed.total_rows,
        suggestedMapping,
        detectedDelimiter: parsed.detected_delimiter,
        hasHeaderRow: true,
      };

      const defaultName = uploadedFile.name.replace(/\.[^/.]+$/, '');

      dispatch({
        type: 'SET_FILE',
        file: uploadedFile,
        preview: previewData,
        mapping: suggestedMapping,
        name: defaultName,
      });

      // Smooth transition to next step
      setIsTransitioning(true);
      setTimeout(() => {
        dispatch({ type: 'SET_STEP', step: 'preview_data' });
        setIsTransitioning(false);
      }, 300);

      // Dismiss restore prompt when file is uploaded
      setShowRestorePrompt(false);
      setRestoredState(null);

      const delimiterName = parsed.detected_delimiter === '\t' ? 'tab' :
        parsed.detected_delimiter === ';' ? 'semicolon' :
        parsed.detected_delimiter === '|' ? 'pipe' : 'comma';

      toast({
        title: 'File Parsed Successfully',
        description: `${parsed.total_rows} rows, ${parsed.columns.length} columns (${delimiterName}-delimited)`,
      });
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        error: err instanceof Error ? err.message : 'Failed to parse file',
      });
      toast({
        title: 'Parse Error',
        description: err instanceof Error ? err.message : 'Failed to parse file',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  });

  // Validate data using bomParser's validateMappings
  const validateData = useCallback(() => {
    const errors: ValidationError[] = [];

    // Convert current mapping to ColumnMapping format for validation
    const columnMappings: ColumnMapping[] = preview?.headers.map((header) => {
      let target: ColumnMapping['target'] = 'ignore';

      if (header === mapping.mpn) target = 'manufacturer_part_number';
      else if (header === mapping.manufacturer) target = 'manufacturer';
      else if (header === mapping.quantity) target = 'quantity';
      else if (header === mapping.description) target = 'description';
      else if (header === mapping.referenceDesignator) target = 'reference_designator';
      else if (header === mapping.footprint) target = 'footprint';

      return { source: header, target, confidence: 0.9 };
    }) || [];

    // Use bomParser validation
    const validation = validateMappings(columnMappings);

    // Convert validation errors
    validation.errors.forEach((msg) => {
      errors.push({ message: msg, severity: 'error' });
    });
    validation.warnings.forEach((msg) => {
      errors.push({ message: msg, severity: 'warning' });
    });

    // Check for empty MPN values in preview
    if (preview && mapping.mpn) {
      const mpnIndex = preview.headers.indexOf(mapping.mpn);
      if (mpnIndex !== -1) {
        let emptyCount = 0;
        preview.rows.forEach((row) => {
          if (!row[mpnIndex]?.trim()) {
            emptyCount++;
          }
        });
        if (emptyCount > 0) {
          errors.push({
            message: `${emptyCount} row(s) have empty MPN values`,
            severity: 'warning',
          });
        }
      }
    }

    dispatch({ type: 'SET_VALIDATION_ERRORS', errors });
    return errors.filter((e) => e.severity === 'error').length === 0;
  }, [mapping, preview]);

  // Handle upload
  const handleUpload = async () => {
    console.log('[BomUpload] handleUpload called, file:', file?.name, 'size:', file?.size);
    if (!file) {
      console.error('[BomUpload] No file available for upload!');
      toast({
        title: 'Upload Error',
        description: 'No file selected. Please go back and select a file.',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    dispatch({ type: 'SET_STEP', step: 'uploading' });
    dispatch({ type: 'SET_ERROR', error: null });

    // Get project ID from state first, fallback to localStorage for robustness
    // This ensures we capture the project ID even if state wasn't fully hydrated
    const projectIdToUse = currentProject?.id || localStorage.getItem('current_project_id') || undefined;
    console.log('[BomUpload] Project ID for upload:', projectIdToUse, '(state:', currentProject?.id, ', localStorage:', localStorage.getItem('current_project_id'), ')');

    try {
      const result = await uploadBom({
        file,
        name: bomName || file.name,
        description: bomDescription,
        projectId: projectIdToUse,
      });

      dispatch({
        type: 'SET_UPLOAD_RESULT',
        result: {
          bomId: result.bomId,
          name: bomName || file.name,
          lineCount: result.lineCount,
          status: result.status,
        },
      });

      // File upload complete - transition through processing to enriching
      setTimeout(() => {
        dispatch({ type: 'SET_STEP', step: 'processing' });

        // After processing analysis, transition to enriching where SSE takes over
        setTimeout(() => {
          if (autoEnrich) {
            dispatch({ type: 'SET_STEP', step: 'enriching' });
            // SSE hook will connect and monitor progress, then transition to results on completion
          } else {
            // If auto-enrich is disabled, skip directly to results
            dispatch({ type: 'SET_STEP', step: 'results' });
            setIsProcessing(false);
          }
        }, 2000);
      }, 1000);

    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        error: err instanceof Error ? err.message : 'Upload failed',
      });
      dispatch({ type: 'SET_STEP', step: 'review_summary' });
      setIsProcessing(false);
    }
  };

  // Navigation helpers
  const goToStep = (step: BomUploadStep) => {
    dispatch({ type: 'SET_STEP', step });
  };

  const goNext = () => {
    const stepIndex = UPLOAD_STEPS.findIndex((s) => s.key === currentStep);
    if (stepIndex < UPLOAD_STEPS.length - 1) {
      const nextStep = UPLOAD_STEPS[stepIndex + 1].key;
      if (nextStep === 'uploading') {
        handleUpload();
      } else {
        goToStep(nextStep);
      }
    }
  };

  const goBack = () => {
    const stepIndex = UPLOAD_STEPS.findIndex((s) => s.key === currentStep);
    if (stepIndex > 0) {
      goToStep(UPLOAD_STEPS[stepIndex - 1].key);
    }
  };

  // Step indicator
  const renderStepIndicator = () => {
    const currentIndex = UPLOAD_STEPS.findIndex((s) => s.key === currentStep);
    // Hide intermediate processing steps from the indicator
    const visibleSteps = UPLOAD_STEPS.filter((s) =>
      !['uploading', 'processing', 'enriching'].includes(s.key)
    );

    return (
      <div className="mb-8">
        <div className="flex items-center justify-center">
          {visibleSteps.map((step, i) => {
            const isComplete = currentIndex > UPLOAD_STEPS.findIndex((s) => s.key === step.key);
            // Show results as current when in any intermediate step
            const isCurrent = step.key === currentStep ||
              (['uploading', 'processing', 'enriching'].includes(currentStep) && step.key === 'results');

            return (
              <div key={step.key} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium transition-colors',
                      isComplete
                        ? 'bg-green-500 text-white'
                        : isCurrent
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {isComplete ? <CheckCircle className="h-5 w-5" /> : i + 1}
                  </div>
                  <span
                    className={cn(
                      'mt-1 text-xs',
                      isCurrent ? 'font-medium text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {step.label}
                  </span>
                </div>
                {i < visibleSteps.length - 1 && (
                  <div
                    className={cn(
                      'mx-2 h-0.5 w-8 sm:w-16',
                      isComplete ? 'bg-green-500' : 'bg-muted'
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Handle dismissing the restore prompt
  const handleDismissRestore = useCallback(() => {
    setShowRestorePrompt(false);
    setRestoredState(null);
    clearPersistedState();
    dispatch({ type: 'RESET' });
  }, [clearPersistedState]);

  // Step 1: Select File
  const renderSelectFile = () => (
    <div className="mx-auto max-w-xl space-y-6">
      {/* Restore session prompt */}
      {showRestorePrompt && restoredState?.fileName && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-start gap-3">
            <RotateCcw className="mt-0.5 h-5 w-5 text-blue-600 shrink-0" />
            <div className="flex-1">
              <h3 className="font-medium text-blue-900">Resume Previous Upload</h3>
              <p className="mt-1 text-sm text-blue-700">
                You have an incomplete upload session for <strong>{restoredState.fileName}</strong>.
                Re-upload the same file to continue where you left off.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={handleDismissRestore}
                  className="rounded px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-100"
                >
                  Start Fresh
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="text-center">
        <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
        <h2 className="mt-4 text-xl font-semibold">Upload Your BOM</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Drag and drop your BOM file or click to browse
        </p>
      </div>

      <div
        {...getRootProps()}
        className={cn(
          'cursor-pointer rounded-lg border-2 border-dashed p-12 text-center transition-all',
          isDragActive
            ? 'border-primary bg-primary/5 scale-[1.02]'
            : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
        )}
      >
        <input {...getInputProps()} />
        <FileText className="mx-auto h-16 w-16 text-muted-foreground/50" />
        <p className="mt-4 text-sm text-muted-foreground">
          Supports <strong>CSV</strong>, <strong>XLS</strong>, <strong>XLSX</strong>
        </p>
        <p className="mt-1 text-xs text-muted-foreground/75">Maximum file size: 10MB</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );

  // Step 2: Preview Data
  const renderPreviewData = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="font-medium">{file?.name}</p>
            <p className="text-sm text-muted-foreground">
              {preview?.totalRows.toLocaleString()} rows detected
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            dispatch({ type: 'RESET' });
          }}
          className="rounded p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Table className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-medium">Data Preview</h3>
          <span className="text-sm text-muted-foreground">(first 10 rows)</span>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-muted-foreground">
                  #
                </th>
                {preview?.headers.map((h, i) => (
                  <th
                    key={i}
                    className="whitespace-nowrap px-3 py-2 text-left font-medium"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview?.rows.slice(0, 10).map((row, i) => (
                <tr key={i} className="border-t">
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {i + 1}
                  </td>
                  {row.map((cell, j) => (
                    <td key={j} className="whitespace-nowrap px-3 py-2">
                      {cell || <span className="text-muted-foreground/50">-</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <button
          onClick={goBack}
          className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <button
          onClick={goNext}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  // Step 3: Map Columns
  const renderMapColumns = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Map Your Columns</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Match your file columns to BOM fields. We've auto-detected some mappings.
      </p>

      {/* Template Selector */}
      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="space-y-1">
            <h3 className="text-sm font-medium">Column Mapping Templates</h3>
            <p className="text-xs text-muted-foreground">
              Load a saved template or save your current mapping for future use
            </p>
          </div>
        </div>
        <ColumnMappingTemplateSelector
          currentMapping={mapping}
          onMappingChange={(newMapping) =>
            dispatch({ type: 'SET_MAPPING', mapping: newMapping })
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries({
          mpn: { label: 'MPN / Part Number', required: true },
          manufacturer: { label: 'Manufacturer', required: false },
          quantity: { label: 'Quantity', required: false },
          description: { label: 'Description', required: false },
          referenceDesignator: { label: 'Reference Designator', required: false },
          footprint: { label: 'Footprint / Package', required: false },
        }).map(([key, config]) => (
          <div key={key} className="space-y-1">
            <label className="text-sm font-medium">
              {config.label}
              {config.required && <span className="ml-1 text-red-500">*</span>}
            </label>
            <select
              value={(mapping as unknown as Record<string, string | undefined>)[key] || ''}
              onChange={(e) =>
                dispatch({
                  type: 'SET_MAPPING',
                  mapping: { ...mapping, [key]: e.target.value || undefined },
                })
              }
              className={cn(
                'w-full rounded-md border bg-background px-3 py-2 text-sm',
                config.required && !mapping[key as keyof BomColumnMapping]
                  ? 'border-red-300'
                  : ''
              )}
            >
              <option value="">Select column...</option>
              {preview?.headers.map((h, i) => (
                <option key={i} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* Preview with mapping */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Mapped Preview</h4>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-primary/5">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-primary">MPN</th>
                <th className="px-3 py-2 text-left font-medium">Manufacturer</th>
                <th className="px-3 py-2 text-left font-medium">Qty</th>
                <th className="px-3 py-2 text-left font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {preview?.rows.slice(0, 5).map((row, i) => {
                const getVal = (col: string | undefined) =>
                  col ? row[preview.headers.indexOf(col)] || '-' : '-';
                return (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2 font-medium">{getVal(mapping.mpn)}</td>
                    <td className="px-3 py-2">{getVal(mapping.manufacturer)}</td>
                    <td className="px-3 py-2">{getVal(mapping.quantity)}</td>
                    <td className="px-3 py-2 max-w-xs truncate">{getVal(mapping.description)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <button
          onClick={goBack}
          className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <button
          onClick={() => {
            if (validateData()) goNext();
          }}
          disabled={!mapping.mpn}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  // Step 4: Configure Options
  const renderConfigureOptions = () => (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Enrichment Options</h2>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">
            BOM Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={bomName}
            onChange={(e) => dispatch({ type: 'SET_BOM_NAME', name: e.target.value })}
            placeholder="Enter BOM name"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Description</label>
          <textarea
            value={bomDescription}
            onChange={(e) =>
              dispatch({ type: 'SET_BOM_DESCRIPTION', description: e.target.value })
            }
            placeholder="Optional description for this BOM"
            rows={3}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="rounded-lg border p-4">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="autoEnrich"
              checked={autoEnrich}
              onChange={(e) =>
                dispatch({ type: 'SET_AUTO_ENRICH', autoEnrich: e.target.checked })
              }
              className="mt-1 h-4 w-4 rounded border-gray-300"
            />
            <label htmlFor="autoEnrich" className="flex-1">
              <span className="font-medium">Auto-enrich components</span>
              <p className="text-sm text-muted-foreground">
                Automatically match components and fetch data after upload
              </p>
            </label>
          </div>

          {autoEnrich && (
            <div className="mt-4 space-y-2 border-t pt-4">
              <label className="text-sm font-medium">Enrichment Level</label>
              <div className="grid gap-2">
                {[
                  {
                    value: 'basic',
                    label: 'Basic',
                    desc: 'Component matching and basic specs',
                  },
                  {
                    value: 'standard',
                    label: 'Standard',
                    desc: 'Includes lifecycle status and pricing',
                  },
                  {
                    value: 'comprehensive',
                    label: 'Comprehensive',
                    desc: 'Full data including alternates and risk analysis',
                  },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors',
                      enrichmentLevel === opt.value
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/50'
                    )}
                  >
                    <input
                      type="radio"
                      name="enrichmentLevel"
                      value={opt.value}
                      checked={enrichmentLevel === opt.value}
                      onChange={(e) =>
                        dispatch({
                          type: 'SET_ENRICHMENT_LEVEL',
                          level: e.target.value as typeof enrichmentLevel,
                        })
                      }
                      className="h-4 w-4"
                    />
                    <div>
                      <span className="font-medium">{opt.label}</span>
                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <button
          onClick={goBack}
          className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <button
          onClick={goNext}
          disabled={!bomName}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  // Step 5: Review Summary
  const renderReviewSummary = () => (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center gap-2">
        <Eye className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Review & Upload</h2>
      </div>

      <div className="rounded-lg border bg-muted/30">
        <div className="border-b p-4">
          <h3 className="font-medium">Upload Summary</h3>
        </div>
        <dl className="divide-y">
          {currentProject && (
            <div className="flex justify-between p-4 bg-primary/5">
              <dt className="text-muted-foreground">Project</dt>
              <dd className="font-medium text-primary">{currentProject.name}</dd>
            </div>
          )}
          <div className="flex justify-between p-4">
            <dt className="text-muted-foreground">File</dt>
            <dd className="font-medium">{file?.name}</dd>
          </div>
          <div className="flex justify-between p-4">
            <dt className="text-muted-foreground">BOM Name</dt>
            <dd className="font-medium">{bomName}</dd>
          </div>
          <div className="flex justify-between p-4">
            <dt className="text-muted-foreground">Total Rows</dt>
            <dd className="font-medium">{preview?.totalRows.toLocaleString()}</dd>
          </div>
          <div className="flex justify-between p-4">
            <dt className="text-muted-foreground">MPN Column</dt>
            <dd className="font-medium">{mapping.mpn}</dd>
          </div>
          <div className="flex justify-between p-4">
            <dt className="text-muted-foreground">Auto-Enrich</dt>
            <dd>
              {autoEnrich ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  <CheckCircle className="h-3 w-3" />
                  {enrichmentLevel}
                </span>
              ) : (
                <span className="text-muted-foreground">Disabled</span>
              )}
            </dd>
          </div>
        </dl>
      </div>

      {validationErrors.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">Warnings</span>
          </div>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {validationErrors.slice(0, 5).map((err, i) => (
              <li key={i}>
                {err.row && `Row ${err.row}: `}
                {err.message}
              </li>
            ))}
            {validationErrors.length > 5 && (
              <li>...and {validationErrors.length - 5} more</li>
            )}
          </ul>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex justify-between pt-4">
        <button
          onClick={goBack}
          className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <button
          onClick={handleUpload}
          disabled={isProcessing}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Upload BOM
            </>
          )}
        </button>
      </div>
    </div>
  );

  // Step 6: Uploading
  const renderUploading = () => (
    <div className="mx-auto max-w-md text-center">
      <Loader2 className="mx-auto h-16 w-16 animate-spin text-primary" />
      <h3 className="mt-6 text-xl font-semibold">Uploading Your BOM</h3>
      <p className="mt-2 text-muted-foreground">Transferring file to server...</p>
      <div className="mt-6">
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{uploadProgress}% complete</p>
      </div>
    </div>
  );

  // Step 7: Processing
  const renderProcessing = () => (
    <div className="mx-auto max-w-md text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-blue-100">
        <FileCheck className="h-10 w-10 text-blue-600 animate-pulse" />
      </div>
      <h3 className="mt-6 text-xl font-semibold">Analyzing Your BOM File</h3>
      <p className="mt-2 text-muted-foreground">
        Parsing file structure and validating data format...
      </p>
      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">File parsing</span>
          <CheckCircle className="h-4 w-4 text-green-600" />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Data validation</span>
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Preparing enrichment</span>
          <span className="h-4 w-4 rounded-full border-2 border-muted" />
        </div>
      </div>
    </div>
  );

  // Step 8: Enriching - Multi-stage Queue Card View with Workflow Controls
  const renderEnriching = () => {
    // Use workflow stages if available, otherwise fall back to SSE-based stages
    const useWorkflowStages = workflowStages.length > 0;

    // Build stages from workflow status or fall back to SSE progress
    const stages: StageInfo[] = useWorkflowStages
      ? workflowStages
      : [
          {
            stage: 'raw_upload',
            status: 'completed',
            progress: 100,
            message: 'File uploaded to storage',
            details: `${file?.name || 'BOM file'} uploaded successfully`,
            completedAt: new Date(),
          },
          {
            stage: 'parsing',
            status: 'completed',
            progress: 100,
            message: 'File parsed and validated',
            details: `${uploadResult?.lineCount || preview?.rows?.length || 0} line items extracted`,
            completedAt: new Date(),
          },
          {
            stage: 'enrichment',
            status: sseIsComplete ? 'completed' : sseIsFailed ? 'failed' : 'in_progress',
            progress: sseProgress?.percent_complete || progressPercent || 0,
            message: sseError || (sseProgress?.current_item?.mpn
              ? `Processing ${sseProgress.current_item.mpn}`
              : 'Matching components with catalog...'),
            itemsProcessed: sseProgress?.enriched_items || 0,
            totalItems: sseProgress?.total_items || uploadResult?.lineCount || 0,
            startedAt: new Date(),
          },
          {
            stage: 'risk_analysis',
            status: sseIsComplete ? 'in_progress' : 'pending',
            progress: sseIsComplete ? 50 : 0,
            message: sseIsComplete ? 'Analyzing component risks...' : 'Waiting for enrichment',
          },
          {
            stage: 'complete',
            status: 'pending',
            progress: 0,
            message: 'Processing will complete shortly',
          },
        ];

    // Determine current stage
    const currentStage = useWorkflowStages
      ? workflowCurrentStage
      : (sseIsComplete ? 'risk_analysis' : 'enrichment');

    // Handle pause/resume
    const handlePauseResume = async () => {
      try {
        if (workflowIsPaused) {
          await resumeWorkflow();
          toast({
            title: 'Processing Resumed',
            description: 'BOM processing has been resumed',
          });
        } else {
          await pauseWorkflow();
          toast({
            title: 'Processing Paused',
            description: 'BOM processing has been paused. You can resume anytime.',
          });
        }
      } catch (err) {
        toast({
          title: 'Action Failed',
          description: err instanceof Error ? err.message : 'Failed to change processing state',
          variant: 'destructive',
        });
      }
    };

    // Handle cancel
    const handleCancel = async () => {
      try {
        await cancelWorkflow();
        toast({
          title: 'Processing Cancelled',
          description: 'BOM processing has been cancelled',
          variant: 'destructive',
        });
        dispatch({ type: 'SET_STEP', step: 'results' });
        setIsProcessing(false);
      } catch (err) {
        toast({
          title: 'Cancel Failed',
          description: err instanceof Error ? err.message : 'Failed to cancel processing',
          variant: 'destructive',
        });
      }
    };

    return (
      <div className="mx-auto max-w-2xl">
        {/* Workflow Controls - Pause/Resume */}
        {useWorkflowStages && (
          <div className="mb-4 flex items-center justify-between rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">
                {workflowIsPaused ? 'Processing Paused' : 'Processing Active'}
              </span>
              {workflowIsPaused && (
                <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                  Paused
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePauseResume}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  workflowIsPaused
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                )}
              >
                {workflowIsPaused ? (
                  <>
                    <Play className="h-3.5 w-3.5" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="h-3.5 w-3.5" />
                    Pause
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        <ProcessingQueueView
          bomId={uploadResult?.bomId || 'unknown'}
          fileName={file?.name || bomName || 'BOM Upload'}
          stages={stages}
          currentStage={currentStage}
          sseProgress={useWorkflowStages ? undefined : sseProgress}
          connectionStatus={useWorkflowStages ? workflowConnectionStatus : connectionStatus}
          // Enhanced UI props for Queue Card display
          componentQueue={useWorkflowStages ? workflowComponentQueue : undefined}
          riskAnalysis={useWorkflowStages && workflowRiskAnalysis ? workflowRiskAnalysis : undefined}
          componentStatus={useWorkflowStages && workflowComponentStatus ? workflowComponentStatus : undefined}
          alertsCount={useWorkflowStages ? workflowAlertsCount : 0}
          isPaused={useWorkflowStages ? workflowIsPaused : false}
          // Actions
          onPause={useWorkflowStages && workflowStatus?.status === 'running' ? pauseWorkflow : undefined}
          onResume={useWorkflowStages && workflowIsPaused ? resumeWorkflow : undefined}
          onViewDetails={() => uploadResult?.bomId && navigate(`/boms/${uploadResult.bomId}`)}
          onViewBomDetails={() => uploadResult?.bomId && navigate(`/boms/${uploadResult.bomId}`)}
          onViewRiskDashboard={() => uploadResult?.bomId && navigate(`/boms/${uploadResult.bomId}/risk`)}
          onViewAlerts={() => uploadResult?.bomId && navigate(`/boms/${uploadResult.bomId}/alerts`)}
          onUploadAnother={() => {
            dispatch({ type: 'RESET' });
            setIsProcessing(false);
          }}
          onCancel={handleCancel}
        />

        {/* Error display */}
        {(sseError || workflowError) && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <XCircle className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">Processing Error</p>
              <p>{workflowError?.message || sseError}</p>
            </div>
          </div>
        )}

        {/* Workflow status footer */}
        {useWorkflowStages && workflowStatus && (
          <div className="mt-4 rounded-lg border bg-muted/20 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Overall Progress</span>
              <span className="font-medium">{workflowProgress}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  'h-full transition-all duration-500',
                  workflowIsFailed ? 'bg-red-500' : workflowIsComplete ? 'bg-green-500' : 'bg-primary'
                )}
                style={{ width: `${workflowProgress}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>
                {workflowStatus.enriched_items} enriched / {workflowStatus.failed_items} failed
              </span>
              <span>{workflowStatus.total_items} total items</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Step 9: Results - Use workflow status when available
  const renderResults = () => {
    // Prefer workflow status data, fall back to SSE progress
    const enrichedCount = workflowStatus?.enriched_items || sseProgress?.enriched_items || uploadResult?.lineCount || 0;
    const totalCount = workflowStatus?.total_items || sseProgress?.total_items || uploadResult?.lineCount || 0;
    const failedCount = workflowStatus?.failed_items || sseProgress?.failed_items || 0;
    const riskScoredCount = workflowStatus?.risk_scored_items || 0;
    const pendingCount = totalCount - enrichedCount - failedCount;
    const healthGrade = workflowStatus?.health_grade;
    const averageRiskScore = workflowStatus?.average_risk_score;

    // Get grade color based on health grade
    const getGradeColor = (grade?: string) => {
      if (!grade) return 'bg-gray-100 text-gray-600';
      const gradeColors: Record<string, string> = {
        'A': 'bg-green-100 text-green-700',
        'B': 'bg-green-50 text-green-600',
        'C': 'bg-yellow-100 text-yellow-700',
        'D': 'bg-orange-100 text-orange-700',
        'F': 'bg-red-100 text-red-700',
      };
      return gradeColors[grade.toUpperCase()] || 'bg-gray-100 text-gray-600';
    };

    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
            <BarChart3 className="h-10 w-10 text-green-600" />
          </div>
          <h3 className="mt-6 text-xl font-semibold">Processing Complete</h3>
          <p className="mt-2 text-muted-foreground">
            Here's a summary of your BOM enrichment and risk analysis
          </p>
        </div>

        {/* Enrichment Results Grid */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border bg-green-50 p-4 text-center">
            <div className="text-3xl font-bold text-green-600">{enrichedCount}</div>
            <div className="mt-1 text-sm text-muted-foreground">Successfully Enriched</div>
          </div>
          <div className="rounded-lg border bg-yellow-50 p-4 text-center">
            <div className="text-3xl font-bold text-yellow-600">{pendingCount}</div>
            <div className="mt-1 text-sm text-muted-foreground">Manual Mapping Needed</div>
          </div>
          <div className="rounded-lg border bg-red-50 p-4 text-center">
            <div className="text-3xl font-bold text-red-600">{failedCount}</div>
            <div className="mt-1 text-sm text-muted-foreground">Failed Items</div>
          </div>
        </div>

        {/* Risk Analysis Results (only show if available) */}
        {(riskScoredCount > 0 || healthGrade) && (
          <div className="rounded-lg border bg-muted/20 p-4">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-primary" />
              <h4 className="font-medium">Risk Analysis Results</h4>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {healthGrade && (
                <div className="rounded-lg border bg-white p-4 text-center">
                  <div className={cn(
                    "mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl font-bold",
                    getGradeColor(healthGrade)
                  )}>
                    {healthGrade}
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">BOM Health Grade</div>
                </div>
              )}
              {averageRiskScore !== undefined && (
                <div className="rounded-lg border bg-white p-4 text-center">
                  <div className="text-3xl font-bold text-primary">
                    {averageRiskScore.toFixed(1)}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">Avg Risk Score</div>
                </div>
              )}
              <div className="rounded-lg border bg-white p-4 text-center">
                <div className="text-3xl font-bold text-blue-600">{riskScoredCount}</div>
                <div className="mt-1 text-sm text-muted-foreground">Risk Analyzed</div>
              </div>
            </div>
          </div>
        )}

        {/* Progress Summary */}
        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium">Overall Progress</h4>
            <span className="text-sm text-muted-foreground">
              {enrichedCount} / {totalCount} items
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${totalCount > 0 ? (enrichedCount / totalCount) * 100 : 0}%` }}
            />
          </div>
        </div>

        <div className="flex justify-center gap-4 pt-4">
          <button
            onClick={() => navigate('/boms')}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Back to BOMs
          </button>
          {uploadResult && (
            <button
              onClick={() => navigate(`/boms/${uploadResult.bomId}`)}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              View BOM Details
            </button>
          )}
          <button
            onClick={() => {
              clearPersistedState();
              dispatch({ type: 'RESET' });
            }}
            className="rounded-md border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10"
          >
            Upload Another BOM
          </button>
        </div>
      </div>
    );
  };

  // Step 10: Complete
  const renderComplete = () => (
    <div className="mx-auto max-w-md text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
        <CheckCircle className="h-10 w-10 text-green-600" />
      </div>
      <h3 className="mt-6 text-xl font-semibold">Upload Complete!</h3>
      <p className="mt-2 text-muted-foreground">
        Your BOM "{uploadResult?.name}" has been uploaded successfully.
        {autoEnrich && ' Enrichment has been started automatically.'}
      </p>

      <div className="mt-6 rounded-lg border bg-muted/30 p-4 text-left">
        <dl className="space-y-2 text-sm">
          {currentProject && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Project</dt>
              <dd className="font-medium text-primary">{currentProject.name}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Lines Imported</dt>
            <dd className="font-medium">{uploadResult?.lineCount.toLocaleString()}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Status</dt>
            <dd className="font-medium capitalize">{uploadResult?.status}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-8 flex justify-center gap-4">
        <button
          onClick={() => navigate('/boms')}
          className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Back to BOMs
        </button>
        {uploadResult && (
          <button
            onClick={() => navigate(`/boms/${uploadResult.bomId}`)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            View BOM
          </button>
        )}
      </div>
    </div>
  );

  // Render current step
  const renderStep = () => {
    switch (currentStep) {
      case 'select_file':
        return renderSelectFile();
      case 'preview_data':
        return renderPreviewData();
      case 'map_columns':
        return renderMapColumns();
      case 'configure_options':
        return renderConfigureOptions();
      case 'review_summary':
        return renderReviewSummary();
      case 'uploading':
        return renderUploading();
      case 'processing':
        return renderProcessing();
      case 'enriching':
        return renderEnriching();
      case 'results':
        return renderResults();
      case 'complete':
        return renderComplete();
      default:
        return null;
    }
  };

  // Loading state while checking project
  if (isLoadingProject) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading project context...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Upload BOM</h1>
        <p className="text-sm text-muted-foreground">
          Import your bill of materials for enrichment
        </p>
      </div>

      {/* Project Context Banner */}
      {currentProject && (
        <div className="flex items-center justify-between rounded-lg border bg-primary/5 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <FolderOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Uploading to Project</p>
              <p className="text-lg font-semibold text-primary">{currentProject.name}</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/projects')}
            className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
          >
            Change Project
          </button>
        </div>
      )}

      <div className="rounded-lg border bg-card p-6">
        {renderStepIndicator()}
        {renderStep()}
      </div>
    </div>
  );
}

export default BomUploadPage;
