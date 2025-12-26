import React, { useState, useEffect, useCallback } from 'react';
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import DescriptionIcon from '@mui/icons-material/Description';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
import { CNS_API_URL, getAuthHeaders } from '../config/api';
import { useTenant } from '../contexts/TenantContext';
import {
  validateBOMFileWithDuplicateCheck,
  validateRequiredColumns,
  recordUpload,
  formatFileSize,
  type ColumnMapping as ValidationColumnMapping,
} from '../utils/uploadValidation';
import { EnrichmentQueueCard } from './EnrichmentQueueCard';
import { EnrichmentResultsSummary } from './EnrichmentResultsSummary';
import type { EnrichmentState } from '../hooks';

interface ColumnMapping {
  source: string;
  target: 'mpn' | 'manufacturer' | 'quantity' | 'reference' | 'description' | 'ignore';
}

interface BOMUploadResponse {
  // Database BOM workflow fields (customer uploads)
  job_id?: string;
  detected_columns?: Record<string, string>;
  unmapped_columns?: string[];
  encoding_used?: string;
  preview_data?: Array<{
    mpn: string;
    manufacturer?: string;
    quantity?: number;
    reference_designator?: string;
    description?: string;
  }>;

  // Bulk upload workflow fields (staff uploads via Redis)
  upload_id?: string;
  file_size?: number;
  s3_bucket?: string;
  s3_key?: string;
  s3_url?: string;
  storage_backend?: string;
  data_storage?: string;
  total_rows?: number;
  line_items_saved?: number;
  redis_ttl_hours?: number;
  rabbitmq_event_published?: boolean;

  // Common fields
  filename: string;
  total_items?: number;
  status: string;
  file_type?: string;
  message: string;
}

interface BOMUploadWizardProps {
  /** Organization ID for multi-tenancy (UUID string or legacy number) */
  organizationId?: string | number;
  /** Project ID for multi-tenancy */
  projectId?: number;
  /** Source type: 'customer' or 'staff_bulk' */
  source?: 'customer' | 'staff_bulk';
  /** Callback when upload completes */
  onUploadComplete?: (jobId: string) => void;
  /** Enable inline enrichment progress instead of redirect (default: false) */
  inlineEnrichment?: boolean;
  /** Initial BOM ID for resume functionality */
  resumeBomId?: string;
  /** Initial step for resume functionality */
  resumeStep?: 'upload' | 'enriching' | 'results';
}

/**
 * BOM Upload Wizard with Unified Workflow
 *
 * Standard Flow (3 steps + optional inline enrichment):
 * Step 1: Upload File
 * Step 2: Review Column Mappings
 * Step 3: Preview Data & Confirm
 * Step 4: Enrichment Progress (when inlineEnrichment=true)
 * Step 5: Results Summary (when inlineEnrichment=true)
 *
 * Features:
 * - Multi-format support (CSV, Excel, TXT)
 * - Backend auto-detection with user review
 * - Multi-tenancy support (optional)
 * - Reusable for customer portal and CNS dashboard
 * - Staff uploads (source='staff_bulk'): No organization/project required
 * - Inline enrichment progress (optional, matches Customer Portal UX)
 * - Resume functionality via URL params
 */
export const BOMUploadWizard: React.FC<BOMUploadWizardProps> = ({
  organizationId,
  projectId,
  source = 'customer',
  onUploadComplete,
  inlineEnrichment = false,
  resumeBomId,
  resumeStep,
}) => {
  const navigate = useNavigate();
  const {
    tenantId: contextTenantId,
    organizationId: contextOrganizationId,
  } = useTenant(); // Prefer organization context, fall back to legacy tenant id

  // Steps configuration - extended when inline enrichment is enabled
  const baseSteps = ['Upload File', 'Review Mappings', 'Preview & Confirm'];
  const enrichmentSteps = inlineEnrichment
    ? [...baseSteps, 'Enrichment Progress', 'Results']
    : baseSteps;
  const steps = enrichmentSteps;

  const [activeStep, setActiveStep] = useState(0);

  // Step 1: File Upload
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Step 2: Column Mapping
  const [uploadResponse, setUploadResponse] = useState<BOMUploadResponse | null>(null);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);

  // Step 3: Preview & Confirm
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);

  // Step 4 & 5: Inline Enrichment (when enabled)
  const [enrichingBomId, setEnrichingBomId] = useState<string | null>(resumeBomId || null);
  const [enrichingFilename, setEnrichingFilename] = useState<string>('');
  const [enrichedResults, setEnrichedResults] = useState<{
    enriched: number;
    failed: number;
    total: number;
  } | null>(null);

  // Resume functionality - set initial step based on resumeStep prop
  useEffect(() => {
    if (resumeBomId && resumeStep && inlineEnrichment) {
      console.log('[BOMUploadWizard] Resuming:', { resumeBomId, resumeStep });
      setEnrichingBomId(resumeBomId);

      if (resumeStep === 'enriching') {
        setActiveStep(3); // Enrichment Progress step
      } else if (resumeStep === 'results') {
        setActiveStep(4); // Results step
        // TODO: Fetch results from API
      }
    }
  }, [resumeBomId, resumeStep, inlineEnrichment]);

  // Handle enrichment completion
  const handleEnrichmentComplete = useCallback((state: EnrichmentState) => {
    console.log('[BOMUploadWizard] Enrichment completed:', state);
    setEnrichedResults({
      enriched: state.enriched_items,
      failed: state.failed_items,
      total: state.total_items,
    });
    // Move to results step
    setActiveStep(4);
  }, []);

  // Handle enrichment error
  const handleEnrichmentError = useCallback((err: Error) => {
    console.error('[BOMUploadWizard] Enrichment error:', err);
    setError(err.message);
  }, []);

  // Handle starting new upload after completion
  const handleStartNew = useCallback(() => {
    setActiveStep(0);
    setFile(null);
    setUploadResponse(null);
    setColumnMappings([]);
    setSuccess(false);
    setError(null);
    setEnrichingBomId(null);
    setEnrichingFilename('');
    setEnrichedResults(null);
  }, []);

  // Handle going back to upload from enrichment
  const handleCancelEnrichment = useCallback(() => {
    setActiveStep(0);
  }, []);

  // ============================================================
  // Bulk Upload Helper (Staff Uploads - Unified BOM Enrichment)
  // ============================================================

  const startBulkEnrichment = async (bomId: string, organizationIdentifier: string) => {
    console.log('[startBulkEnrichment] 🚀 Starting unified enrichment workflow:', {
      bom_id: bomId,
      organization_id: organizationIdentifier,
      project_id: projectId,
      endpoint: `${CNS_API_URL}/boms/${bomId}/enrichment/start`
    });

    setConfirming(true);
    try {
      const payload = {
        organization_id: organizationIdentifier,
        project_id: projectId?.toString(),
        priority: 7,
        initiated_by: 'cns-dashboard',
      };
      console.log('[startBulkEnrichment] 📤 Request payload:', payload);

      const response = await fetch(`${CNS_API_URL}/boms/${bomId}/enrichment/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(getAuthHeaders() || {}) },
        body: JSON.stringify(payload),
      });

      if (response.status === 409) {
        // Workflow already running – treat as success and go to monitor
        const errorData = await response.json().catch(() => null);
        console.log('[startBulkEnrichment] ⚠️ Workflow already running:', errorData);
        setSuccess(true);
      } else if (response.status === 400) {
        const errorData = await response.json().catch(() => null);
        console.error('[startBulkEnrichment] ❌ Enrichment start failed (400):', errorData);
        if (errorData && typeof errorData === 'object' && errorData.code === 'NO_PENDING_ITEMS') {
          setError('No pending line items. BOM may already be enriched.');
          return;
        }
        throw new Error(errorData?.detail || errorData?.message || 'Failed to start enrichment');
      } else if (!response.ok) {
        console.error('[startBulkEnrichment] ❌ Enrichment start failed:', {
          status: response.status,
          statusText: response.statusText
        });
        const errorData = await response.json().catch(() => null);
        console.error('[startBulkEnrichment] Error details:', errorData);
        throw new Error(errorData?.detail || errorData?.message || 'Failed to start enrichment');
      } else {
        const responseData = await response.json().catch(() => null);
        console.log('[startBulkEnrichment] ✅ Enrichment workflow started (unified):', responseData);
      }
      setSuccess(true);

      // Record successful upload
      if (file) {
        console.log('[startBulkEnrichment] 📝 Recording upload for duplicate detection');
        recordUpload(file);
      }

      // Handle navigation/inline enrichment
      if (inlineEnrichment) {
        // Inline mode: Show enrichment progress in the same wizard
        console.log('[startBulkEnrichment] 📊 Switching to inline enrichment view');
        setEnrichingBomId(bomId);
        setEnrichingFilename(file?.name || 'BOM');
        setActiveStep(3); // Move to Enrichment Progress step
      } else {
        // Redirect mode: Navigate to enrichment monitor
        setTimeout(() => {
          console.log('[startBulkEnrichment] 🔄 Navigating to BOM enrichment view:', bomId);
          if (onUploadComplete) {
            console.log('[startBulkEnrichment] Using onUploadComplete callback');
            onUploadComplete(bomId);
          } else {
            // Navigate to CNS Enrichment Monitor and auto-open this BOM
            navigate('/enrichment-monitor', { state: { bomId } });
          }
        }, 1500);
      }
    } catch (err) {
      console.error('[startBulkEnrichment] ❌ Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start enrichment');
      throw err;
    } finally {
      setConfirming(false);
      console.log('[startBulkEnrichment] Process complete');
    }
  };

  // ============================================================
  // Step 1: File Upload
  // ============================================================

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      validateAndSetFile(selectedFile);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    console.log('[BOMUploadWizard] 📁 Validating file:', {
      filename: selectedFile.name,
      size: `${(selectedFile.size / 1024).toFixed(2)} KB`,
      type: selectedFile.type,
      source: source
    });

    // Run comprehensive validation
    const validation = validateBOMFileWithDuplicateCheck(selectedFile);

    if (!validation.isValid) {
      console.error('[BOMUploadWizard] ❌ File validation failed:', validation.error);
      setError(validation.error || 'File validation failed');
      setWarnings([]);
      return;
    }

    // Set warnings if any
    if (validation.warnings && validation.warnings.length > 0) {
      console.warn('[BOMUploadWizard] ⚠️ File validation warnings:', validation.warnings);
      setWarnings(validation.warnings);
    } else {
      setWarnings([]);
    }

    console.log('[BOMUploadWizard] ✅ File validated successfully');
    setFile(selectedFile);
    setError(null);
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

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleUploadFile = async () => {
    if (!file) {
      console.error('[BOMUploadWizard] ❌ No file selected');
      setError('Please select a file first');
      return;
    }

    console.log('[BOMUploadWizard] 🚀 Starting upload:', {
      filename: file.name,
      source: source,
      organizationId: organizationId,
      projectId: projectId,
      endpoint: `${CNS_API_URL}/bom/upload`
    });

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // ============================================================
      // ALL UPLOADS: 3-Step Wizard (with appropriate storage backend)
      // - Staff uploads → Redis + MinIO
      // - Customer uploads → Database
      // ============================================================
      if (organizationId !== undefined) {
        formData.append('organization_id', organizationId.toString());
        console.log('[BOMUploadWizard] Added organization_id:', organizationId);
      }
      if (projectId !== undefined) {
        formData.append('project_id', projectId.toString());
        console.log('[BOMUploadWizard] Added project_id:', projectId);
      }
      formData.append('source', source);
      console.log('[BOMUploadWizard] Added source:', source);

      console.log('[BOMUploadWizard] 📤 Sending request to:', `${CNS_API_URL}/bom/upload`);
      const response = await fetch(`${CNS_API_URL}/bom/upload`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      });

      if (!response.ok) {
        console.error('[BOMUploadWizard] ❌ Upload request failed:', {
          status: response.status,
          statusText: response.statusText
        });
        const errorData = await response.json();
        console.error('[BOMUploadWizard] Error details:', errorData);
        throw new Error(errorData.detail || 'Upload failed');
      }

      const result: BOMUploadResponse = await response.json();
      console.log('[BOMUploadWizard] ✅ Upload response received:', {
        filename: result.filename,
        total_items: result.total_items,
        job_id: result.job_id,
        upload_id: result.upload_id,
        detected_columns: result.detected_columns,
        file_type: result.file_type
      });
      setUploadResponse(result);

      // Build initial column mappings from detected columns
      const mappings: ColumnMapping[] = [];
      console.log('[BOMUploadWizard] 🔍 Building column mappings...');

      const normalizeDetectedField = (field: string): ColumnMapping['target'] | null => {
        const normalized = field.toLowerCase();
        if (normalized === 'part_number' || normalized === 'mpn') return 'mpn';
        if (normalized === 'manufacturer' || normalized === 'mfr') return 'manufacturer';
        if (normalized === 'quantity' || normalized === 'qty') return 'quantity';
        if (
          normalized === 'reference' ||
          normalized === 'reference_designator' ||
          normalized === 'reference designator'
        ) {
          return 'reference';
        }
        if (normalized === 'description' || normalized === 'desc') return 'description';
        return null;
      };

      // Add detected columns
      if (result.detected_columns) {
        Object.entries(result.detected_columns).forEach(([field, sourceColumn]) => {
          const normalizedField = normalizeDetectedField(field);
          if (sourceColumn && normalizedField) {
            mappings.push({
              source: sourceColumn,
              target: normalizedField,
            });
          }
        });
      }

      // Add unmapped columns as 'ignore'
      if (result.unmapped_columns) {
        result.unmapped_columns.forEach((col) => {
          mappings.push({
            source: col,
            target: 'ignore',
          });
        });
      }

      setColumnMappings(mappings);
      console.log('[BOMUploadWizard] ✅ Column mappings built:', {
        total_mappings: mappings.length,
        detected: mappings.filter(m => m.target !== 'ignore').length,
        unmapped: mappings.filter(m => m.target === 'ignore').length
      });
      console.log('[BOMUploadWizard] 📋 Moving to Step 2 (Review Mappings)');
      setActiveStep(1); // Move to Step 2
    } catch (err) {
      console.error('[BOMUploadWizard] ❌ Upload failed with error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      console.log('[BOMUploadWizard] Upload process complete');
    }
  };

  // ============================================================
  // Step 2: Column Mapping
  // ============================================================

  const updateMapping = (sourceColumn: string, target: ColumnMapping['target']) => {
    setColumnMappings((prev) =>
      prev.map((m) => (m.source === sourceColumn ? { ...m, target } : m))
    );
  };

  const validateMappings = (): boolean => {
    // Use the comprehensive validation from utility
    const validation = validateRequiredColumns(columnMappings as ValidationColumnMapping[]);

    if (!validation.isValid) {
      setError(validation.error || 'Column mapping validation failed');
      setWarnings([]);
      return false;
    }

    // Set warnings if any
    if (validation.warnings && validation.warnings.length > 0) {
      setWarnings(validation.warnings);
    } else {
      setWarnings([]);
    }

    setError(null);
    return true;
  };

  const handlePreview = () => {
    console.log('[BOMUploadWizard] 📋 Validating column mappings for preview...');
    if (!validateMappings()) {
      console.error('[BOMUploadWizard] ❌ Column mapping validation failed');
      return;
    }
    console.log('[BOMUploadWizard] ✅ Column mappings validated successfully');
    console.log('[BOMUploadWizard] 📊 Moving to Step 3 (Preview & Confirm)');
    setError(null);
    setActiveStep(2); // Move to Step 3
  };

  // ============================================================
  // Step 3: Preview & Confirm
  // ============================================================

  const handleConfirm = async () => {
    if (!uploadResponse || !file) {
      console.error('[BOMUploadWizard] ❌ Cannot confirm: missing uploadResponse or file');
      return;
    }

    console.log('[BOMUploadWizard] 🚀 Starting confirmation process...', {
      source: source,
      filename: file.name,
      job_id: uploadResponse.job_id,
      upload_id: uploadResponse.upload_id
    });

    setConfirming(true);
    setError(null);

    try {
      // Build confirmed mapping object for backend
      const confirmedMappings: Record<string, string> = {};
      columnMappings
        .filter((m) => m.target !== 'ignore')
        .forEach((m) => {
          confirmedMappings[m.target] = m.source;
        });

        console.log('[BOMUploadWizard] 📋 Confirmed mappings:', confirmedMappings);

      // STAFF UPLOADS: Use Redis/MinIO storage backend
      if (source === 'staff_bulk') {
        console.log('[BOMUploadWizard] 🔄 STAFF UPLOAD - Using unified workflow with Supabase');
        // Step 1: Upload to /bulk/upload (saves to Redis + MinIO + Supabase)
        const formData = new FormData();
        formData.append('file', file);
        formData.append('column_mappings', JSON.stringify(confirmedMappings));

        // Use organizationId from context (TenantSelector), with fallback to component props.
        // In production we do not want to silently default to a hard-coded organization.
        const resolvedOrganizationId =
          contextOrganizationId ||
          contextTenantId ||
          organizationId?.toString();
        if (!resolvedOrganizationId) {
          console.error('[BOMUploadWizard] ❌ No organization selected for bulk upload');
          setError('No organization selected for this bulk upload. Please select an organization and try again.');
          setConfirming(false);
          return;
        }
        formData.append('organization_id', resolvedOrganizationId);
        console.log(
          '[BOMUploadWizard] 📤 Uploading to bulk endpoint with organization_id:',
          resolvedOrganizationId,
          '(source:',
          contextOrganizationId ? 'context-organization' : contextTenantId ? 'legacy-tenant' : organizationId ? 'prop' : 'unknown',
          ')'
        );

        // Include uploader identity from CNS dashboard auth (localStorage username)
        const uploadedBy = localStorage.getItem('username') || 'cns-dashboard';
        formData.append('uploaded_by', uploadedBy);
        console.log('[BOMUploadWizard] 🧑‍💻 Uploaded by:', uploadedBy);

        if (projectId) {
          formData.append('project_id', projectId.toString());
          console.log('[BOMUploadWizard] Added project_id:', projectId);
        }

        console.log('[BOMUploadWizard] 📤 Sending bulk upload request to:', `${CNS_API_URL}/bulk/upload`);
        const uploadResponse = await fetch(`${CNS_API_URL}/bulk/upload`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: formData,
        });

        if (!uploadResponse.ok) {
          console.error('[BOMUploadWizard] ❌ Bulk upload failed:', {
            status: uploadResponse.status,
            statusText: uploadResponse.statusText
          });
          const errorData = await uploadResponse.json();
          console.error('[BOMUploadWizard] Error details:', errorData);
          throw new Error(errorData.detail || errorData.message || 'Bulk upload failed');
        }

        const result = await uploadResponse.json();
        console.log('[BOMUploadWizard] ✅ Bulk upload response:', {
          upload_id: result.upload_id,
          file_size: result.file_size,
          s3_bucket: result.s3_bucket,
          s3_key: result.s3_key,
          storage_backend: result.storage_backend,
          data_storage: result.data_storage,
          total_rows: result.total_rows,
          line_items_saved: result.line_items_saved
        });

        if (!result.bom_id) {
          console.error('[BOMUploadWizard] ❌ No bom_id in bulk upload response', result);
          throw new Error('Upload failed: No bom_id returned for unified enrichment');
        }

        // Step 2: Start unified enrichment workflow by BOM ID
        console.log('[BOMUploadWizard] 🚀 Starting unified enrichment for bom_id:', result.bom_id);
        await startBulkEnrichment(result.bom_id, resolvedOrganizationId);

        // Record successful upload for duplicate detection
        recordUpload(file);

        // Note: Navigation handled in startBulkEnrichment
        return;
      }

      // CUSTOMER UPLOADS: Use database workflow (existing behavior)
      console.log('[BOMUploadWizard] 👤 CUSTOMER UPLOAD - Using database workflow');
      console.log('[BOMUploadWizard] 📤 Sending confirmation to:', `${CNS_API_URL}/bom/jobs/${uploadResponse.job_id}/confirm`);
      const response = await fetch(
        `${CNS_API_URL}/bom/jobs/${uploadResponse.job_id}/confirm`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(getAuthHeaders() || {}) },
          body: JSON.stringify({ column_mappings: confirmedMappings }),
        }
      );

      if (!response.ok) {
        console.error('[BOMUploadWizard] ❌ Confirmation failed:', {
          status: response.status,
          statusText: response.statusText
        });
        const errorData = await response.json();
        console.error('[BOMUploadWizard] Error details:', errorData);
        throw new Error(errorData.detail || 'Confirmation failed');
      }

      console.log('[BOMUploadWizard] ✅ Confirmation successful');
      setSuccess(true);

      // Record successful upload for duplicate detection
      if (file) {
        recordUpload(file);
      }

      // Callback or redirect
      setTimeout(() => {
        const jobId = uploadResponse.job_id || 'unknown';
        console.log('[BOMUploadWizard] 🔄 Navigating to job:', jobId);
        if (onUploadComplete) {
          console.log('[BOMUploadWizard] Using onUploadComplete callback');
          onUploadComplete(jobId);
        } else {
          console.log('[BOMUploadWizard] Navigating to:', `/bom-jobs/${jobId}`);
          navigate(`/bom-jobs/${jobId}`);
        }
      }, 1500);
    } catch (err) {
      console.error('[BOMUploadWizard] ❌ Confirmation error:', err);
      setError(err instanceof Error ? err.message : 'Confirmation failed');
    } finally {
      setConfirming(false);
      console.log('[BOMUploadWizard] Confirmation process complete');
    }
  };

  const handleBack = () => {
    setError(null);
    setActiveStep((prev) => prev - 1);
  };

  const handleReset = () => {
    setFile(null);
    setUploadResponse(null);
    setColumnMappings([]);
    setError(null);
    setSuccess(false);
    setActiveStep(0);
  };

  // ============================================================
  // Render Step Content
  // ============================================================

  const renderStep1 = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Upload BOM File
      </Typography>
      <Typography variant="body2" color="textSecondary" paragraph>
        Upload your Bill of Materials in CSV, Excel, or TXT format. Columns will be auto-detected.
      </Typography>

      {/* Drag & Drop Area */}
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
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <Box textAlign="center">
          <CloudUploadIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Drag & Drop BOM File Here
          </Typography>
          <Typography variant="body2" color="textSecondary" paragraph>
            or click to browse
          </Typography>
          <Typography variant="caption" color="textSecondary">
            Supported: CSV, Excel (.xlsx, .xls), Text (.txt) | Max: 10MB
          </Typography>

          <input
            id="file-input"
            type="file"
            accept=".csv,.xlsx,.xls,.txt"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </Box>
      </Paper>

      {/* Selected File */}
      {file && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center">
              <DescriptionIcon sx={{ mr: 2, color: 'success.main' }} />
              <Box>
                <Typography variant="body1" fontWeight={600}>
                  {file.name}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  {formatFileSize(file.size)}
                </Typography>
              </Box>
            </Box>
            <Button
              variant="outlined"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
              }}
            >
              Clear
            </Button>
          </Box>
        </Paper>
      )}

      {uploading && (
        <Box mb={2}>
          <LinearProgress />
          <Typography variant="body2" color="textSecondary" textAlign="center" mt={1}>
            Uploading and auto-detecting columns...
          </Typography>
        </Box>
      )}

      {error && (
        <Alert severity="error" icon={<ErrorIcon />} sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {warnings.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setWarnings([])}>
          <Box>
            {warnings.map((warning, index) => (
              <Typography key={index} variant="body2">
                {warning}
              </Typography>
            ))}
          </Box>
        </Alert>
      )}

      <Box display="flex" justifyContent="flex-end">
        <Button
          variant="contained"
          onClick={handleUploadFile}
          disabled={!file || uploading}
          endIcon={<ArrowForwardIcon />}
        >
          Next: Review Mappings
        </Button>
      </Box>
    </Box>
  );

  const renderStep2 = () => {
    // Guard: If upload response is missing or no columns detected, show error state
    if (!uploadResponse || columnMappings.length === 0) {
      return (
        <Box>
          <Typography variant="h6" gutterBottom>
            Review Column Mappings
          </Typography>
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>No column data available.</strong> The file upload may have failed or returned no columns.
              <br />
              Please go back and try uploading the file again.
            </Typography>
          </Alert>
          <Box display="flex" justifyContent="flex-start">
            <Button onClick={handleBack} startIcon={<ArrowBackIcon />}>
              Back to Upload
            </Button>
          </Box>
        </Box>
      );
    }

    return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Review Column Mappings
      </Typography>
      <Typography variant="body2" color="textSecondary" paragraph>
        Auto-detected column mappings are shown below. Review and adjust if needed.
      </Typography>

      <Box mb={3}>
        <Alert severity="info" icon={<CheckCircleIcon />}>
          <Typography variant="body2">
            <strong>File:</strong> {uploadResponse.filename || file?.name || 'Unknown'} ({uploadResponse.file_type?.toUpperCase() || file?.name?.split('.').pop()?.toUpperCase() || 'CSV'})
            <br />
            <strong>Total Items:</strong> {uploadResponse.total_items || columnMappings.length || 0}
            <br />
            <strong>Encoding:</strong> {uploadResponse.encoding_used || 'UTF-8'}
          </Typography>
        </Alert>
      </Box>

      <TableContainer component={Paper} sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>
                <strong>File Column</strong>
              </TableCell>
              <TableCell>
                <strong>Maps To</strong>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {columnMappings.map((mapping, index) => (
              <TableRow key={index}>
                <TableCell>
                  <Typography variant="body2">{mapping.source}</Typography>
                </TableCell>
                <TableCell>
                  <FormControl size="small" fullWidth>
                    <Select
                      value={mapping.target}
                      onChange={(e) => updateMapping(mapping.source, e.target.value as ColumnMapping['target'])}
                    >
                      <MenuItem value="ignore">Ignore</MenuItem>
                      <MenuItem value="mpn">Part Number (MPN)</MenuItem>
                      <MenuItem value="manufacturer">Manufacturer</MenuItem>
                      <MenuItem value="quantity">Quantity</MenuItem>
                      <MenuItem value="reference">Reference Designator</MenuItem>
                      <MenuItem value="description">Description</MenuItem>
                    </Select>
                  </FormControl>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {error && (
        <Alert severity="error" icon={<ErrorIcon />} sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {warnings.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setWarnings([])}>
          <Box>
            {warnings.map((warning, index) => (
              <Typography key={index} variant="body2">
                • {warning}
              </Typography>
            ))}
          </Box>
        </Alert>
      )}

      <Box display="flex" justifyContent="space-between">
        <Button onClick={handleBack} startIcon={<ArrowBackIcon />}>
          Back
        </Button>
        <Button variant="contained" onClick={handlePreview} endIcon={<ArrowForwardIcon />}>
          Preview Data
        </Button>
      </Box>
    </Box>
    );
  };

  const renderStep3 = () => {
    const previewData = uploadResponse?.preview_data || [];

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Preview & Confirm
        </Typography>
        <Typography variant="body2" color="textSecondary" paragraph>
          Preview of first 10 rows. Total {uploadResponse?.total_items} items will be processed.
        </Typography>

        <TableContainer component={Paper} sx={{ mb: 3, maxHeight: 400 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>Part Number</TableCell>
                <TableCell>Manufacturer</TableCell>
                <TableCell>Qty</TableCell>
                <TableCell>Ref Des</TableCell>
                <TableCell>Description</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {previewData.slice(0, 10).map((row, index) => (
                <TableRow key={index}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
                      {row.mpn || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>{row.manufacturer || '-'}</TableCell>
                  <TableCell>{row.quantity || 1}</TableCell>
                  <TableCell>{row.reference_designator || '-'}</TableCell>
                  <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {row.description || '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {error && (
          <Alert severity="error" icon={<ErrorIcon />} sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 2 }}>
            <Typography variant="body1" fontWeight={600}>
              BOM Upload Confirmed!
            </Typography>
            <Typography variant="body2">Processing started. Redirecting to job details...</Typography>
          </Alert>
        )}

        {confirming && (
          <Box mb={2}>
            <LinearProgress />
            <Typography variant="body2" color="textSecondary" textAlign="center" mt={1}>
              Confirming and starting workflow...
            </Typography>
          </Box>
        )}

        <Box display="flex" justifyContent="space-between">
          <Button onClick={handleBack} disabled={confirming || success} startIcon={<ArrowBackIcon />}>
            Back to Mappings
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleConfirm}
            disabled={confirming || success}
            startIcon={<CheckCircleIcon />}
          >
            {confirming ? 'Confirming...' : success ? 'Confirmed!' : 'Confirm & Process'}
          </Button>
        </Box>
      </Box>
    );
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          Upload BOM for Enrichment
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

        {/* Step 4: Inline Enrichment Progress (when enabled) */}
        {inlineEnrichment && activeStep === 3 && enrichingBomId && (
          <EnrichmentQueueCard
            bomId={enrichingBomId}
            filename={enrichingFilename || file?.name || 'BOM'}
            onComplete={handleEnrichmentComplete}
            onError={handleEnrichmentError}
            onCancel={handleCancelEnrichment}
            showControls={true}
          />
        )}

        {/* Step 5: Results Summary (when enabled) */}
        {inlineEnrichment && activeStep === 4 && enrichingBomId && enrichedResults && (
          <EnrichmentResultsSummary
            bomId={enrichingBomId}
            filename={enrichingFilename || file?.name || 'BOM'}
            enrichedCount={enrichedResults.enriched}
            failedCount={enrichedResults.failed}
            totalCount={enrichedResults.total}
            onStartNew={handleStartNew}
            onViewDetails={() => navigate(`/bom-jobs/${enrichingBomId}`)}
          />
        )}

        {/* Show "Upload Another" button when not in inline mode and success */}
        {!inlineEnrichment && success && (
          <Box mt={2} textAlign="center">
            <Button onClick={handleReset} variant="outlined">
              Upload Another BOM
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};
