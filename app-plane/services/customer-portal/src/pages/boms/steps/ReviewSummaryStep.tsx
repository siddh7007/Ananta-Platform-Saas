import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  AlertTitle,
  Chip,
  CircularProgress,
  Divider,
  Grid,
} from '@mui/material';
import {
  FileText,
  Info,
  AlertTriangle,
  Upload,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';

/**
 * ReviewSummaryStep Component
 *
 * Final review step before BOM upload showing:
 * - File information
 * - BOM metadata (name, description)
 * - Line item count
 * - Enrichment settings
 * - Project context (if applicable)
 * - Validation warnings
 * - Error alerts
 */

interface ReviewSummaryStepProps {
  file: File | null;
  bomName: string;
  bomDescription: string;
  preview: { totalRows: number } | null;
  mapping: {
    mpn?: string;
    manufacturer?: string;
    quantity?: string;
    description?: string;
  };
  autoEnrich: boolean;
  enrichmentLevel: 'basic' | 'standard' | 'comprehensive';
  validationWarnings: string[];
  error: string | null;
  isUploading: boolean;
  onBack: () => void;
  onUpload: () => Promise<void>;
}

const ENRICHMENT_LEVEL_LABELS: Record<'basic' | 'standard' | 'comprehensive', string> = {
  basic: 'Basic',
  standard: 'Standard',
  comprehensive: 'Comprehensive',
};

const ENRICHMENT_LEVEL_COLORS: Record<'basic' | 'standard' | 'comprehensive', 'default' | 'primary' | 'secondary'> = {
  basic: 'default',
  standard: 'primary',
  comprehensive: 'secondary',
};

export const ReviewSummaryStep: React.FC<ReviewSummaryStepProps> = ({
  file,
  bomName,
  bomDescription,
  preview,
  mapping,
  autoEnrich,
  enrichmentLevel,
  validationWarnings,
  error,
  isUploading,
  onBack,
  onUpload,
}) => {
  // Get project info from localStorage
  const currentProjectId = localStorage.getItem('current_project_id');
  const currentProjectName = localStorage.getItem('current_project_name');

  return (
    <Box sx={{ width: '100%', maxWidth: '800px', mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckCircle2 size={28} />
          Review & Upload
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Please review the summary below before uploading your BOM
        </Typography>
      </Box>

      {/* Upload Summary Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FileText size={20} />
            Upload Summary
          </Typography>

          <Divider sx={{ my: 2 }} />

          {/* Summary Grid */}
          <Grid container spacing={2}>
            {/* File Name */}
            <Grid item xs={12} sm={4}>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                File Name
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {file?.name || 'N/A'}
              </Typography>
            </Grid>

            {/* BOM Name */}
            <Grid item xs={12} sm={4}>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                BOM Name
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {bomName || 'Untitled BOM'}
              </Typography>
            </Grid>

            {/* Line Items */}
            <Grid item xs={12} sm={4}>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                Line Items
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {preview?.totalRows || 0}
              </Typography>
            </Grid>

            {/* Description */}
            {bomDescription && (
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                  Description
                </Typography>
                <Typography variant="body2">
                  {bomDescription}
                </Typography>
              </Grid>
            )}

            {/* Enrichment Setting */}
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                Enrichment
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {autoEnrich ? (
                  <>
                    <Chip
                      label={ENRICHMENT_LEVEL_LABELS[enrichmentLevel]}
                      color={ENRICHMENT_LEVEL_COLORS[enrichmentLevel]}
                      size="small"
                    />
                    <Typography variant="body2" color="text.secondary">
                      Auto-enrichment enabled
                    </Typography>
                  </>
                ) : (
                  <Chip label="Disabled" size="small" color="default" />
                )}
              </Box>
            </Grid>

            {/* Column Mapping Summary */}
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                Mapped Columns
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {mapping.mpn && (
                  <Chip label={`MPN: ${mapping.mpn}`} size="small" variant="outlined" />
                )}
                {mapping.manufacturer && (
                  <Chip label={`Manufacturer: ${mapping.manufacturer}`} size="small" variant="outlined" />
                )}
                {mapping.quantity && (
                  <Chip label={`Quantity: ${mapping.quantity}`} size="small" variant="outlined" />
                )}
                {mapping.description && (
                  <Chip label={`Description: ${mapping.description}`} size="small" variant="outlined" />
                )}
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Project Context Banner */}
      {currentProjectId && currentProjectName && (
        <Alert severity="info" icon={<Info size={20} />} sx={{ mb: 3 }}>
          <AlertTitle>Project Context</AlertTitle>
          This BOM will be uploaded to project: <strong>{currentProjectName}</strong>
        </Alert>
      )}

      {/* Validation Warnings */}
      {validationWarnings.length > 0 && (
        <Alert severity="warning" icon={<AlertTriangle size={20} />} sx={{ mb: 3 }}>
          <AlertTitle>Validation Warnings</AlertTitle>
          <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2 }}>
            {validationWarnings.map((warning, index) => (
              <li key={index}>
                <Typography variant="body2">{warning}</Typography>
              </li>
            ))}
          </Box>
        </Alert>
      )}

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <AlertTitle>Error</AlertTitle>
          {error}
        </Alert>
      )}

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
        <Button
          variant="outlined"
          startIcon={<ArrowLeft size={20} />}
          onClick={onBack}
          disabled={isUploading}
        >
          Back
        </Button>

        <Button
          variant="contained"
          color="primary"
          startIcon={isUploading ? <CircularProgress size={20} color="inherit" /> : <Upload size={20} />}
          onClick={onUpload}
          disabled={isUploading || !file || !bomName}
        >
          {isUploading ? 'Uploading...' : 'Upload BOM'}
        </Button>
      </Box>
    </Box>
  );
};
