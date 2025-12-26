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
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Chip,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import DescriptionIcon from '@mui/icons-material/Description';
import { useNavigate } from 'react-router-dom';
import { CNS_API_URL, CNS_STAFF_ORGANIZATION_ID, getAuthHeaders } from '../config/api';

interface UploadResult {
  job_id: string;
  filename: string;
  total_items: number;
  status: string;
  message: string;
}

/**
 * BOM Upload Component
 *
 * Features:
 * - Drag & drop file upload
 * - Supported formats: CSV, Excel (.xlsx, .xls)
 * - Real-time upload progress
 * - Job ID returned for tracking
 * - Auto-redirect to job detail page
 */
export const BOMUpload: React.FC = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Handle file selection
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      validateAndSetFile(selectedFile);
    }
  };

  // Validate file type and size
  const validateAndSetFile = (selectedFile: File) => {
    const allowedExtensions = ['csv', 'xlsx', 'xls', 'txt'];
    const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();

    if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
      setError(`Unsupported file type. Please upload: ${allowedExtensions.join(', ')}`);
      return;
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (selectedFile.size > maxSize) {
      setError('File size exceeds 10MB limit');
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

  // Upload BOM file
  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('organization_id', CNS_STAFF_ORGANIZATION_ID);
      formData.append('source', 'staff_bulk');
      formData.append('priority', 'normal');
      formData.append('start_enrichment', 'false');

      const response = await fetch(`${CNS_API_URL}/boms/upload`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Upload failed');
      }

      const result: UploadResult = await response.json();
      setUploadResult(result);

      // Auto-redirect to job detail page after 2 seconds
      setTimeout(() => {
        navigate(`/bom-jobs/${result.job_id}`);
      }, 2000);
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
        Upload BOM for Enrichment
      </Typography>
      <Typography variant="body1" color="textSecondary" paragraph>
        Upload your Bill of Materials (BOM) in CSV or Excel format for automatic component enrichment.
      </Typography>

      {/* File Upload Area */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
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
                Supported formats: CSV, Excel (.xlsx, .xls) | Max size: 10MB
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

          {/* Selected File Display */}
          {file && (
            <Box mt={2}>
              <Paper variant="outlined" sx={{ p: 2 }}>
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
                  <Box display="flex" gap={1}>
                    <Button
                      variant="outlined"
                      color="secondary"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClear();
                      }}
                      disabled={uploading}
                    >
                      Clear
                    </Button>
                    <Button
                      variant="contained"
                      color="primary"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpload();
                      }}
                      disabled={uploading}
                      startIcon={<CloudUploadIcon />}
                    >
                      {uploading ? 'Uploading...' : 'Upload'}
                    </Button>
                  </Box>
                </Box>
              </Paper>
            </Box>
          )}

          {/* Upload Progress */}
          {uploading && (
            <Box mt={2}>
              <LinearProgress />
              <Typography variant="body2" color="textSecondary" textAlign="center" mt={1}>
                Uploading and parsing BOM file...
              </Typography>
            </Box>
          )}

          {/* Success Message */}
          {uploadResult && (
            <Alert
              severity="success"
              icon={<CheckCircleIcon />}
              sx={{ mt: 2 }}
            >
              <Typography variant="body1" fontWeight={600}>
                Upload Successful!
              </Typography>
              <Typography variant="body2">
                {uploadResult.message}
              </Typography>
              <Box display="flex" gap={1} mt={1}>
                <Chip label={`Job ID: ${uploadResult.job_id.substring(0, 8)}...`} size="small" />
                <Chip label={`${uploadResult.total_items} items`} size="small" color="primary" />
              </Box>
              <Typography variant="caption" color="textSecondary" display="block" mt={1}>
                Redirecting to job detail page...
              </Typography>
            </Alert>
          )}

          {/* Error Message */}
          {error && (
            <Alert severity="error" icon={<ErrorIcon />} sx={{ mt: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* File Requirements */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            📋 BOM File Requirements
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <List>
            <ListItem>
              <ListItemIcon>
                <CheckCircleIcon color="success" />
              </ListItemIcon>
              <ListItemText
                primary="Required Column: MPN"
                secondary="Manufacturer Part Number (e.g., STM32F407VGT6)"
              />
            </ListItem>

            <ListItem>
              <ListItemIcon>
                <CheckCircleIcon color="success" />
              </ListItemIcon>
              <ListItemText
                primary="Optional Columns"
                secondary="Manufacturer, Quantity, Reference Designators, Description"
              />
            </ListItem>

            <ListItem>
              <ListItemIcon>
                <CheckCircleIcon color="success" />
              </ListItemIcon>
              <ListItemText
                primary="Supported Formats"
                secondary="CSV (.csv), Excel (.xlsx, .xls), Text (.txt)"
              />
            </ListItem>

            <ListItem>
              <ListItemIcon>
                <CheckCircleIcon color="success" />
              </ListItemIcon>
              <ListItemText
                primary="Automatic Enrichment"
                secondary="Components are enriched using local catalog, supplier APIs, and optional AI"
              />
            </ListItem>

            <ListItem>
              <ListItemIcon>
                <CheckCircleIcon color="success" />
              </ListItemIcon>
              <ListItemText
                primary="Quality Routing"
                secondary="High quality (≥95%) → Production, Medium (70-94%) → Staging, Low (<70%) → Rejected"
              />
            </ListItem>
          </List>

          <Box mt={2} p={2} bgcolor="info.light" borderRadius={1}>
            <Typography variant="body2" color="info.dark">
              <strong>Example CSV Format:</strong>
              <br />
              MPN,Manufacturer,Quantity,Reference Designators
              <br />
              STM32F407VGT6,STMicroelectronics,10,U1 U2 U3
              <br />
              LM358,Texas Instruments,20,U4 U5
            </Typography>
          </Box>

          <Box mt={2}>
            <Button
              variant="outlined"
              size="small"
              href="/sample-bom.csv"
              download="sample-bom.csv"
            >
              Download Sample BOM File (20 Components)
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};
