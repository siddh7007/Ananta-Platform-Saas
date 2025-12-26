/**
 * Smart Column Mapper Page - Integration Wrapper
 * Integrates the new AI-powered column mapping into React Admin BOM Upload flow
 * @module pages
 */

import React, { useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useOrganization } from '../contexts/OrganizationContext';
import { SmartColumnMapper } from '../components/bom/SmartColumnMapper';
import { Box, Typography, Button, Paper, CircularProgress, Alert } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

interface LocationState {
  headers: string[];
  sampleRows: Record<string, unknown>[];
  filename: string;
  totalRows: number;
  fileId?: string;
}

/**
 * Smart Column Mapper Page
 *
 * Standalone page for AI-powered column mapping during BOM upload.
 * Receives file data via location state and returns mappings.
 */
export const SmartColumnMapperPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentOrg, isLoading: orgLoading } = useOrganization();

  // Get data from navigation state
  const state = location.state as LocationState | null;
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle mapping confirmation
  const handleConfirm = useCallback(async (mappings: Record<string, string>) => {
    setIsConfirming(true);
    setError(null);

    try {
      // Navigate back to upload flow with confirmed mappings
      navigate('/bom/upload', {
        state: {
          step: 'enrichment',
          mappings,
          filename: state?.filename,
          totalRows: state?.totalRows,
          fileId: state?.fileId,
        },
      });
    } catch (err) {
      console.error('[SmartColumnMapperPage] Error confirming mappings:', err);
      setError(err instanceof Error ? err.message : 'Failed to confirm mappings');
      setIsConfirming(false);
    }
  }, [navigate, state]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    navigate('/bom/upload', {
      state: {
        step: 'upload',
      },
    });
  }, [navigate]);

  // Loading state
  if (orgLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // No file data
  if (!state?.headers || !state?.sampleRows) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning" sx={{ mb: 2 }}>
          No file data found. Please upload a file first.
        </Alert>
        <Button
          variant="contained"
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
        >
          Back to Upload
        </Button>
      </Box>
    );
  }

  // No organization
  if (!currentOrg) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Please select an organization before mapping columns.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
          size="small"
        >
          Back
        </Button>
        <Box>
          <Typography variant="h5" component="h1">
            Map Columns
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {state.filename} - {state.totalRows} rows
          </Typography>
        </Box>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Smart Column Mapper */}
      <Paper sx={{ p: 0, overflow: 'hidden' }}>
        <SmartColumnMapper
          headers={state.headers}
          sampleRows={state.sampleRows}
          tenantId={currentOrg.id}
          currentUserId={currentOrg.id} // Use org ID as placeholder, should be user ID
          onConfirm={handleConfirm}
        />
      </Paper>
    </Box>
  );
};

export default SmartColumnMapperPage;
