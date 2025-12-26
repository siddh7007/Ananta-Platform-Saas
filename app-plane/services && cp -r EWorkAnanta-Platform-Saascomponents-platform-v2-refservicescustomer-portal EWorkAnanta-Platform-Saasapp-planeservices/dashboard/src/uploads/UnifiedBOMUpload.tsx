import React, { useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Alert,
  LinearProgress,
  Paper,
  TextField,
  FormControlLabel,
  Checkbox,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import DescriptionIcon from '@mui/icons-material/Description';
import { useNavigate } from 'react-router-dom';
import { CNS_API_URL, getAdminAuthHeaders } from '../config/api';
import { useTenant } from '../contexts/TenantContext';

interface UploadResult {
  bom_id: string;
  upload_id: string;
  filename: string;
  line_count: number;
  status: string;
  workflow_id?: string;
}

/**
 * Unified BOM Upload Component
 *
 * Uses /boms/upload endpoint (NEW unified API)
 * - Permanent Supabase storage
 * - Comprehensive audit trail
 * - Idempotency via file hash
 * - Optional auto-enrichment
 * - Priority support
 */
export const UnifiedBOMUpload: React.FC = () => {
  const navigate = useNavigate();
  const { tenantId } = useTenant();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Form fields
  const [organizationId, setOrganizationId] = useState<string>(tenantId || '');
  const [projectId, setProjectId] = useState<string>('');
  const [priority, setPriority] = useState<'high' | 'normal'>('normal');
  const [startEnrichment, setStartEnrichment] = useState<boolean>(true);

  // Handle file selection
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      validateAndSetFile(selectedFile);
    }
  };

  // Validate file type and size
  const validateAndSetFile = (selectedFile: File) => {
    const allowedExtensions = ['csv'];
    const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();

    if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
      setError(`Unsupported file type. Unified upload supports CSV only (XLSX coming soon)`);
      return;
    }

    // Check file size (max 50MB per API spec)
    const maxSize = 50 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      setError('File size exceeds 50MB limit');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setUploadResult(null);
  };

  // Handle drag events
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  // Handle drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  }, []);

  // Upload BOM file via unified endpoint
  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    if (!organizationId) {
      setError('Organization ID is required');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('organization_id', organizationId);
      formData.append('source', 'staff');
      formData.append('priority', priority);
      formData.append('start_enrichment', String(startEnrichment));

      if (projectId) {
        formData.append('project_id', projectId);
      }

      const headers: Record<string, string> = {};
      const authHeaders = getAdminAuthHeaders();
      if (authHeaders) {
        if (authHeaders instanceof Headers) {
          authHeaders.forEach((value, key) => {
            headers[key] = value;
          });
        } else if (Array.isArray(authHeaders)) {
          authHeaders.forEach(([key, value]) => {
            headers[key] = value;
          });
        } else {
          Object.assign(headers, authHeaders as Record<string, string>);
        }
      }

      const response = await fetch(`${CNS_API_URL}/boms/upload`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Upload failed');
      }

      const result: UploadResult = await response.json();
      setUploadResult(result);

      // Auto-redirect to uploads list after 3 seconds
      setTimeout(() => {
        navigate('/bulk-uploads');
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Clear file selection
  const handleClear = () => {
    setFile(null);
    setError(null);
    setUploadResult(null);
  };

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        BOM Upload (Unified/Database)
      </Typography>
      <Typography variant="body1" color="textSecondary" paragraph>
        Upload BOM to permanent Supabase storage with comprehensive audit trail. This is the NEW unified API endpoint.
      </Typography>

      {/* Info Banner */}
      <Alert severity="info" sx={{ mb: 3 }}>
        <strong>Unified Upload Features:</strong>
        <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20 }}>
          <li>Permanent database storage (Supabase)</li>
          <li>Comprehensive audit trail (raw + parsed snapshots)</li>
          <li>Idempotency protection (file hash deduplication)</li>
          <li>Priority support (high/normal)</li>
          <li>Optional auto-enrichment</li>
          <li>CSV only (XLSX support coming soon)</li>
        </ul>
      </Alert>

      {/* Configuration Form */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Upload Configuration
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
            <TextField
              label="Organization ID"
              value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)}
              fullWidth
              required
              helperText="UUID of the organization (tenant)"
            />

            <TextField
              label="Project ID (Optional)"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              fullWidth
              helperText="UUID of the project (optional)"
            />

            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select
                value={priority}
                label="Priority"
                onChange={(e) => setPriority(e.target.value as 'high' | 'normal')}
              >
                <MenuItem value="normal">Normal</MenuItem>
                <MenuItem value="high">High</MenuItem>
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <Checkbox
                  checked={startEnrichment}
                  onChange={(e) => setStartEnrichment(e.target.checked)}
                />
              }
              label="Start enrichment automatically after upload"
            />
          </Box>

          {/* File Upload Area */}
          <Paper
            sx={{
              p: 4,
              border: '2px dashed',
              borderColor: dragActive ? 'primary.main' : 'grey.300',
              bgcolor: dragActive ? 'action.hover' : 'background.paper',
              transition: 'all 0.2s',
              cursor: 'pointer',
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: 'action.hover',
              },
            }}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => document.getElementById('unified-file-input')?.click()}
          >
            <Box textAlign="center">
              <CloudUploadIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Drag & Drop CSV File Here
              </Typography>
              <Typography variant="body2" color="textSecondary" paragraph>
                or click to browse
              </Typography>
              <Typography variant="caption" color="textSecondary">
                Supported: CSV only | Max size: 50MB | Max rows: 10,000
              </Typography>

              <input
                id="unified-file-input"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </Box>
          </Paper>

          {/* Selected File Display */}
          {file && (
            <Box mt={2} p={2} bgcolor="grey.100" borderRadius={1}>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box display="flex" alignItems="center" gap={1}>
                  <DescriptionIcon color="primary" />
                  <Typography variant="body2">{file.name}</Typography>
                  <Chip
                    label={`${(file.size / 1024).toFixed(1)} KB`}
                    size="small"
                    variant="outlined"
                  />
                </Box>
                <Button size="small" onClick={handleClear} disabled={uploading}>
                  Remove
                </Button>
              </Box>
            </Box>
          )}

          {/* Error Display */}
          {error && (
            <Alert severity="error" icon={<ErrorIcon />} sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}

          {/* Success Display */}
          {uploadResult && (
            <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>Upload Successful!</strong>
              </Typography>
              <Typography variant="caption" component="div" sx={{ mt: 1 }}>
                BOM ID: {uploadResult.bom_id}
              </Typography>
              <Typography variant="caption" component="div">
                Upload ID: {uploadResult.upload_id}
              </Typography>
              <Typography variant="caption" component="div">
                Line Count: {uploadResult.line_count}
              </Typography>
              {uploadResult.workflow_id && (
                <Typography variant="caption" component="div">
                  Workflow ID: {uploadResult.workflow_id}
                </Typography>
              )}
              <Typography variant="caption" component="div" sx={{ mt: 1, fontStyle: 'italic' }}>
                Redirecting to uploads list...
              </Typography>
            </Alert>
          )}

          {/* Upload Progress */}
          {uploading && (
            <Box mt={2}>
              <LinearProgress />
              <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                Uploading to unified endpoint (Supabase)...
              </Typography>
            </Box>
          )}

          {/* Action Buttons */}
          <Box mt={3} display="flex" gap={2}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleUpload}
              disabled={!file || uploading || !organizationId}
              startIcon={<CloudUploadIcon />}
            >
              {uploading ? 'Uploading...' : 'Upload to Database'}
            </Button>
            <Button
              variant="outlined"
              onClick={handleClear}
              disabled={uploading}
            >
              Clear
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};
