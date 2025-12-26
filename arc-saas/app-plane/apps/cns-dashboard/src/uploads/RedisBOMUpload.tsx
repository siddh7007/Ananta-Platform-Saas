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
  Chip,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import DescriptionIcon from '@mui/icons-material/Description';
import { useNavigate } from 'react-router-dom';
import { CNS_API_URL, getAdminAuthHeaders } from '../config/api';
import { useTenant } from '../contexts/TenantContext';

interface BulkUploadResult {
  upload_id: string;
  bom_id?: string;
  line_count: number;
  status: string;
  message?: string;
}

/**
 * Redis BOM Upload Component
 *
 * Uses /bulk/upload endpoint (REDIS-BASED)
 * - Temporary Redis storage (48hr TTL)
 * - Fast caching layer
 * - Auto-cleanup
 * - Creates Supabase BOM for enrichment
 * - Manual enrichment trigger required
 */
export const RedisBOMUpload: React.FC = () => {
  const navigate = useNavigate();
  const { tenantId } = useTenant();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<BulkUploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Form fields
  const [organizationId, setOrganizationId] = useState<string>(tenantId || '');

  // Handle file selection
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      validateAndSetFile(selectedFile);
    }
  };

  // Validate file type and size
  const validateAndSetFile = (selectedFile: File) => {
    const allowedExtensions = ['csv', 'xlsx', 'xls'];
    const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();

    if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
      setError(`Unsupported file type. Please upload: CSV, XLSX, or XLS`);
      return;
    }

    // Check file size (max 50MB)
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

  // Upload BOM file via Redis/bulk endpoint
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
      formData.append('source', 'cns_bulk');

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

      const response = await fetch(`${CNS_API_URL}/bulk/upload`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Upload failed');
      }

      const result: BulkUploadResult = await response.json();
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
        BOM Upload (Redis/Temporary)
      </Typography>
      <Typography variant="body1" color="textSecondary" paragraph>
        Upload BOM to Redis temporary storage with 48-hour TTL. Fast caching layer for bulk imports.
      </Typography>

      {/* Info Banner */}
      <Alert severity="warning" sx={{ mb: 3 }}>
        <strong>Redis Upload Features:</strong>
        <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20 }}>
          <li>Temporary Redis storage (48-hour TTL)</li>
          <li>Fast caching layer for high-volume imports</li>
          <li>Auto-cleanup after expiration</li>
          <li>Creates Supabase BOM record for enrichment</li>
          <li>Enrichment must be started manually</li>
          <li>CSV, XLSX, XLS supported</li>
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
          </Box>

          {/* File Upload Area */}
          <Paper
            sx={{
              p: 4,
              border: '2px dashed',
              borderColor: dragActive ? 'warning.main' : 'grey.300',
              bgcolor: dragActive ? 'action.hover' : 'background.paper',
              transition: 'all 0.2s',
              cursor: 'pointer',
              '&:hover': {
                borderColor: 'warning.main',
                bgcolor: 'action.hover',
              },
            }}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => document.getElementById('redis-file-input')?.click()}
          >
            <Box textAlign="center">
              <CloudUploadIcon sx={{ fontSize: 64, color: 'warning.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Drag & Drop BOM File Here
              </Typography>
              <Typography variant="body2" color="textSecondary" paragraph>
                or click to browse
              </Typography>
              <Typography variant="caption" color="textSecondary">
                Supported: CSV, XLSX, XLS | Max size: 50MB
              </Typography>

              <input
                id="redis-file-input"
                type="file"
                accept=".csv,.xlsx,.xls"
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
                  <DescriptionIcon color="warning" />
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
                Upload ID: {uploadResult.upload_id}
              </Typography>
              {uploadResult.bom_id && (
                <Typography variant="caption" component="div">
                  BOM ID: {uploadResult.bom_id}
                </Typography>
              )}
              <Typography variant="caption" component="div">
                Line Count: {uploadResult.line_count}
              </Typography>
              <Typography variant="caption" component="div" sx={{ mt: 1, fontStyle: 'italic' }}>
                Data cached in Redis (48hr TTL). Redirecting to uploads list...
              </Typography>
            </Alert>
          )}

          {/* Upload Progress */}
          {uploading && (
            <Box mt={2}>
              <LinearProgress color="warning" />
              <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                Uploading to Redis cache...
              </Typography>
            </Box>
          )}

          {/* Action Buttons */}
          <Box mt={3} display="flex" gap={2}>
            <Button
              variant="contained"
              color="warning"
              onClick={handleUpload}
              disabled={!file || uploading || !organizationId}
              startIcon={<CloudUploadIcon />}
            >
              {uploading ? 'Uploading...' : 'Upload to Redis Cache'}
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

      {/* Additional Info */}
      <Alert severity="info">
        <strong>Next Steps:</strong>
        <Typography variant="body2" sx={{ mt: 1 }}>
          After upload, go to "View All Uploads" to start enrichment manually for this BOM.
        </Typography>
      </Alert>
    </Box>
  );
};
