import React, { useState } from 'react';
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
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import DescriptionIcon from '@mui/icons-material/Description';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
import { getCnsApiUrl, getAuthHeaders } from '../services/cnsConfig';

const CNS_API_URL = getCnsApiUrl();

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

interface BOMUploadWizardProps {
  /** Organization ID for multi-tenancy */
  organizationId?: number;
  /** Project ID for multi-tenancy */
  projectId?: number;
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
  organizationId = 100,
  projectId = 1001,
  source = 'customer',
  onUploadComplete,
}) => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const steps = ['Upload File', 'Review Mappings', 'Preview & Confirm'];

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
  const [success, setSuccess] = useState(false);

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
    const allowedExtensions = ['csv', 'xlsx', 'xls', 'txt'];
    const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();

    if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
      setError(`Unsupported file type. Please upload: ${allowedExtensions.join(', ')}`);
      return;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (selectedFile.size > maxSize) {
      setError('File size exceeds 10MB limit');
      return;
    }

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
      setError('Please select a file first');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('organization_id', organizationId.toString());
      formData.append('project_id', projectId.toString());
      formData.append('source', source);

      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${CNS_API_URL}/bom/upload`, {
        method: 'POST',
        headers: authHeaders,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Upload failed');
      }

      const result: BOMUploadResponse = await response.json();
      setUploadResponse(result);

      // Build initial column mappings from detected columns
      const mappings: ColumnMapping[] = [];

      // Add detected columns
      Object.entries(result.detected_columns).forEach(([field, sourceColumn]) => {
        if (sourceColumn) {
          mappings.push({
            source: sourceColumn,
            target: field as ColumnMapping['target'],
          });
        }
      });

      // Add unmapped columns as 'ignore'
      result.unmapped_columns.forEach((col) => {
        mappings.push({
          source: col,
          target: 'ignore',
        });
      });

      setColumnMappings(mappings);
      setActiveStep(1); // Move to Step 2
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
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
    const hasMPN = columnMappings.some((m) => m.target === 'mpn');
    if (!hasMPN) {
      setError('At least one column must be mapped to "Part Number (MPN)"');
      return false;
    }
    return true;
  };

  const handlePreview = () => {
    if (!validateMappings()) return;
    setError(null);
    setActiveStep(2); // Move to Step 3
  };

  // ============================================================
  // Step 3: Preview & Confirm
  // ============================================================

  const handleConfirm = async () => {
    if (!uploadResponse) return;

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

      const confirmAuthHeaders = await getAuthHeaders();
      const response = await fetch(
        `${CNS_API_URL}/bom/jobs/${uploadResponse.job_id}/confirm`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...confirmAuthHeaders },
          body: JSON.stringify({ column_mappings: confirmedMappings }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Confirmation failed');
      }

      setSuccess(true);

      // Callback or redirect
      setTimeout(() => {
        if (onUploadComplete) {
          onUploadComplete(uploadResponse.job_id);
        } else {
          navigate(`/bom-jobs/${uploadResponse.job_id}`);
        }
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Confirmation failed');
    } finally {
      setConfirming(false);
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
                  {(file.size / 1024).toFixed(2)} KB
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

  const renderStep2 = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Review Column Mappings
      </Typography>
      <Typography variant="body2" color="textSecondary" paragraph>
        Auto-detected column mappings are shown below. Review and adjust if needed.
      </Typography>

      {uploadResponse && (
        <Box mb={3}>
          <Alert severity="info" icon={<CheckCircleIcon />}>
            <Typography variant="body2">
              <strong>File:</strong> {uploadResponse.filename} ({uploadResponse.file_type.toUpperCase()})
              <br />
              <strong>Total Items:</strong> {uploadResponse.total_items}
              <br />
              <strong>Encoding:</strong> {uploadResponse.encoding_used}
            </Typography>
          </Alert>
        </Box>
      )}

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

  const renderStep3 = () => {
    const previewData = uploadResponse?.preview_data || [];
    const mpnCol = columnMappings.find((m) => m.target === 'mpn')?.source;
    const mfrCol = columnMappings.find((m) => m.target === 'manufacturer')?.source;
    const qtyCol = columnMappings.find((m) => m.target === 'quantity')?.source;
    const refCol = columnMappings.find((m) => m.target === 'reference')?.source;
    const descCol = columnMappings.find((m) => m.target === 'description')?.source;

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

        {success && (
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
