/**
 * ⚠️ DISABLED COMPONENT - DO NOT USE ⚠️
 *
 * BOMUploadSimple - TEMPORARILY DISABLED
 *
 * Reason: Uses Django backend on port 27200 which doesn't exist in V2 architecture
 * Backend URL: http://localhost:27200/api (INCORRECT)
 * Correct: Should use CNS service via Traefik (port 27800 or Traefik routing)
 *
 * Status: Kept for reference until BOMUploadWizard and BOMUploadWorkflow
 *         are fully integrated and tested. Safe to remove after consolidation.
 *
 * Replacement: Use BOMUploadWizard or BOMUploadWorkflow instead
 *
 * Date Disabled: 2025-11-09
 * TODO: Remove this file after BOM upload consolidation is complete
 */

import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Card,
  CardContent,
  Typography,
  Box,
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
  Stepper,
  Step,
  StepLabel,
  TextField,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import DescriptionIcon from '@mui/icons-material/Description';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';

const BACKEND_API_URL = 'http://localhost:27200/api'; // ⚠️ WRONG - This backend doesn't exist in V2

interface BOMUploadSimpleProps {
  onUploadComplete?: (bomId: string) => void;
}

/**
 * Simple 2-Step BOM Upload (Works with Backend API)
 *
 * Step 1: Upload File
 * Step 2: Confirm & View Result
 */
export const BOMUploadSimple: React.FC<BOMUploadSimpleProps> = ({
  onUploadComplete,
}) => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const steps = ['Upload File', 'Confirmation'];

  // Step 1: File Upload (supports multiple)
  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [bomName, setBomName] = useState('');
  const [description, setDescription] = useState('');

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<any | null>(null);
  const [mergeFiles, setMergeFiles] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const list = event.target.files;
    if (!list || list.length === 0) return;
    const added: File[] = [];
    for (let i = 0; i < list.length; i++) {
      const f = list.item(i)!;
      if (validateAndSetFile(f, false)) added.push(f);
    }
    if (added.length) setFiles(prev => [...prev, ...added]);
  };

  const validateAndSetFile = (selectedFile: File, commit: boolean = true) => {
    const allowedExtensions = ['csv', 'xlsx', 'xls'];
    const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();

    if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
      setError(`Unsupported file type. Please upload: ${allowedExtensions.join(', ')}`);
      return false;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (selectedFile.size > maxSize) {
      setError('File size exceeds 10MB limit');
      return false;
    }
    if (commit) {
      setFiles(prev => [...prev, selectedFile]);
      setBomName(selectedFile.name.replace(/\.[^/.]+$/, ''));
      setError(null);
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
    const list = e.dataTransfer.files;
    if (!list || list.length === 0) return;
    const added: File[] = [];
    for (let i = 0; i < list.length; i++) {
      const f = list.item(i)!;
      if (validateAndSetFile(f, false)) added.push(f);
    }
    if (added.length) setFiles(prev => [...prev, ...added]);
  };

  const handleUpload = async () => {
    if (!files.length) {
      setError('Please select at least one file');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const token = localStorage.getItem('auth_token');
      const tenantId = localStorage.getItem('tenant_id') || 'a1111111-1111-1111-1111-111111111111';
      const batchResults: any[] = [];

      // Guard: when not merging, only CSV/XLSX/XLS are supported server-side
      if (!mergeFiles) {
        const bad = files.find(f => !/\.(csv|xlsx|xls)$/i.test(f.name));
        if (bad) {
          throw new Error('When uploading separately, only CSV/XLSX/XLS are supported. Enable "Merge" to combine TXT/TSV or convert to CSV.');
        }
      }

      if (mergeFiles) {
        // Merge only supports CSV files in client for now
        const csvFiles = files.filter(f => f.name.toLowerCase().endsWith('.csv'));
        if (csvFiles.length !== files.length) {
          throw new Error('Merge currently supports CSV files only. Please uncheck merge or upload CSVs.');
        }

        const merged = await mergeCsvFiles(csvFiles);
        const formData = new FormData();
        const mergedName = bomName.trim() || `merged-bom-${Date.now()}`;
        formData.append('file', merged);
        formData.append('name', mergedName);
        formData.append('description', description);

        const response = await fetch(`${BACKEND_API_URL}/boms/upload/`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Tenant-ID': tenantId,
          },
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Upload failed');
        }

        const result = await response.json();
        setUploadResult(result);
        setActiveStep(1);
        return;
      } else {
        for (const f of files) {
          const formData = new FormData();
          formData.append('file', f);
          formData.append('name', f.name.replace(/\.[^/.]+$/, ''));
          formData.append('description', description);

          const response = await fetch(`${BACKEND_API_URL}/boms/upload/`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'X-Tenant-ID': tenantId,
            },
            body: formData,
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Upload failed');
          }

          const result = await response.json();
          batchResults.push(result);
        }
        setUploadResult({ batch: true, items: batchResults });
        setActiveStep(1);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Merge CSVs: combine rows by part number and sum quantities
  async function mergeCsvFiles(filesToMerge: File[]): Promise<Blob> {
    // Merge CSV/XLSX/XLS/TXT using SheetJS to a single CSV
    const totals: Record<string, number> = {};
    for (const f of filesToMerge) {
      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      let wb: XLSX.WorkBook;
      if (ext === 'xlsx' || ext === 'xls') {
        const ab = await f.arrayBuffer();
        wb = XLSX.read(ab, { type: 'array' });
      } else {
        const text = await f.text();
        wb = XLSX.read(text, { type: 'string' });
      }
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
      for (const row of rows) {
        const map: Record<string, string> = {};
        Object.keys(row).forEach(k => (map[k.toString().trim().toLowerCase()] = row[k]));
        const pn = (map['part number'] || map['manufacturer_part_number'] || map['mpn'] || map['pn'] || '').toString().trim().toUpperCase();
        const qtyRaw = (map['quantity'] || map['qty'] || map['count'] || '0').toString();
        const qty = parseInt(qtyRaw.replace(/[^0-9-]/g, ''), 10) || 0;
        if (!pn) continue;
        totals[pn] = (totals[pn] || 0) + qty;
      }
    }
    const out: string[] = [];
    out.push(['manufacturer_part_number', 'quantity'].join(','));
    Object.entries(totals).forEach(([pn, qty]) => out.push(`${pn},${qty}`));
    return new Blob([out.join('\n')], { type: 'text/csv' });
  }

  // (helpers removed; SheetJS handles CSV/Excel parsing)

  const handleReset = () => {
    setFiles([]);
    setBomName('');
    setDescription('');
    setUploadResult(null);
    setError(null);
    setActiveStep(0);
  };

  const handleViewBOM = () => {
    if (uploadResult?.id) {
      if (onUploadComplete) {
        onUploadComplete(uploadResult.id);
      } else {
        navigate(`/boms/${uploadResult.id}/show`);
      }
    }
  };

  const renderStep1 = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Upload BOM File
      </Typography>
      <Typography variant="body2" color="textSecondary" paragraph>
        Upload your Bill of Materials in CSV or Excel format.
      </Typography>

      {/* Drag & Drop Area (multiple) */}
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
        onClick={() => document.getElementById('file-input-simple')?.click()}
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
            Supported: CSV, Excel (.xlsx, .xls), Text (.txt, .tsv) | Max: 10MB
          </Typography>

          <input
            id="file-input-simple"
            type="file"
            accept=".csv,.xlsx,.xls,.txt,.tsv"
            multiple
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </Box>
      </Paper>

      {/* Selected Files */}
      {files.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          {files.map((f, idx) => (
            <Box key={idx} display="flex" alignItems="center" justifyContent="space-between" sx={{ py: 0.5 }}>
              <Box display="flex" alignItems="center">
                <DescriptionIcon sx={{ mr: 2, color: 'success.main' }} />
                <Box>
                  <Typography variant="body1" fontWeight={600}>
                    {f.name}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {(f.size / 1024).toFixed(2)} KB
                  </Typography>
                </Box>
              </Box>
              <Button
                variant="outlined"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  setFiles(prev => prev.filter((_, i) => i !== idx));
                }}
              >
                Remove
              </Button>
            </Box>
          ))}
          <Box textAlign="right" mt={1}>
            <Button variant="text" size="small" onClick={() => setFiles([])}>Clear All</Button>
          </Box>
        </Paper>
      )}

      {/* BOM Details */}
      <Box mb={2}>
        <FormControlLabel
          control={<Checkbox checked={mergeFiles} onChange={(_, v) => setMergeFiles(v)} />}
          label="Merge selected files into a single BOM (CSV only)"
        />
        <TextField
          fullWidth
          label={mergeFiles ? 'Merged BOM Name' : 'BOM Name (for single upload)'}
          value={bomName}
          onChange={(e) => setBomName(e.target.value)}
          disabled={!mergeFiles && files.length !== 1}
          sx={{ mb: 2 }}
        />
        <TextField
          fullWidth
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          multiline
          rows={3}
          disabled={!files.length}
        />
      </Box>

      {uploading && (
        <Box mb={2}>
          <LinearProgress />
          <Typography variant="body2" color="textSecondary" textAlign="center" mt={1}>
            Uploading BOM...
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
          onClick={handleUpload}
          disabled={!files.length || (!mergeFiles && files.length === 1 && !bomName.trim()) || uploading}
          endIcon={<ArrowForwardIcon />}
        >
          Upload BOM
        </Button>
      </Box>
    </Box>
  );

  const renderStep2 = () => (
    <Box>
      <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 3 }}>
        <Typography variant="h6" fontWeight={600} gutterBottom>
          BOM Uploaded Successfully!
        </Typography>
        <Typography variant="body2">
          Your BOM has been uploaded and is ready for enrichment.
        </Typography>
      </Alert>

      {uploadResult && (
        <TableContainer component={Paper} sx={{ mb: 3 }}>
          <Table size="small">
            <TableBody>
              <TableRow>
                <TableCell><strong>BOM Name</strong></TableCell>
                <TableCell>{uploadResult.name}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell><strong>Status</strong></TableCell>
                <TableCell>{uploadResult.status}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell><strong>Component Count</strong></TableCell>
                <TableCell>{uploadResult.component_count}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell><strong>BOM ID</strong></TableCell>
                <TableCell>{uploadResult.id}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Box display="flex" justifyContent="space-between">
        <Button onClick={handleReset} variant="outlined">
          Upload Another BOM
        </Button>
        <Button variant="contained" onClick={handleViewBOM} endIcon={<ArrowForwardIcon />}>
          View BOM Details
        </Button>
      </Box>
    </Box>
  );

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
      </CardContent>
    </Card>
  );
};
