/**
 * Enrichment Results Summary Component
 *
 * Displays the final results of BOM enrichment with statistics,
 * success/failure breakdown, and actions for next steps.
 */

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Paper,
  Divider,
  Chip,
  Stack,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DownloadIcon from '@mui/icons-material/Download';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AddIcon from '@mui/icons-material/Add';
import { useNavigate } from 'react-router-dom';

interface EnrichmentResultsSummaryProps {
  bomId: string;
  filename: string;
  enrichedCount: number;
  failedCount: number;
  totalCount: number;
  onStartNew?: () => void;
  onViewDetails?: () => void;
}

export const EnrichmentResultsSummary: React.FC<EnrichmentResultsSummaryProps> = ({
  bomId,
  filename,
  enrichedCount,
  failedCount,
  totalCount,
  onStartNew,
  onViewDetails,
}) => {
  const navigate = useNavigate();
  const successRate = totalCount > 0 ? Math.round((enrichedCount / totalCount) * 100) : 0;
  const failureRate = totalCount > 0 ? Math.round((failedCount / totalCount) * 100) : 0;

  const handleViewDetails = () => {
    if (onViewDetails) {
      onViewDetails();
    } else {
      navigate(`/bom-jobs/${bomId}`);
    }
  };

  const handleStartNew = () => {
    if (onStartNew) {
      onStartNew();
    }
  };

  const handleDownloadResults = () => {
    // Navigate to download audit CSVs
    window.open(`/api/bulk/audit-csv/${bomId}/normalized_data`, '_blank');
  };

  return (
    <Card elevation={2}>
      <CardContent>
        {/* Header with Success Icon */}
        <Box display="flex" alignItems="center" gap={2} mb={3}>
          <CheckCircleIcon color="success" sx={{ fontSize: 48 }} />
          <Box>
            <Typography variant="h5" fontWeight={600} color="success.main">
              Enrichment Complete!
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {filename}
            </Typography>
          </Box>
        </Box>

        {/* Summary Stats */}
        <Grid container spacing={3} mb={4}>
          <Grid item xs={12} md={4}>
            <Paper
              elevation={0}
              sx={{
                p: 3,
                textAlign: 'center',
                bgcolor: 'success.light',
                border: '1px solid',
                borderColor: 'success.light',
                borderRadius: 2,
              }}
            >
              <Typography variant="h3" color="success.main" fontWeight={700}>
                {enrichedCount}
              </Typography>
              <Typography variant="body1" color="success.dark">
                Components Enriched
              </Typography>
              <Chip
                label={`${successRate}%`}
                color="success"
                size="small"
                sx={{ mt: 1 }}
              />
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper
              elevation={0}
              sx={{
                p: 3,
                textAlign: 'center',
                bgcolor: failedCount > 0 ? 'error.light' : 'grey.50',
                border: '1px solid',
                borderColor: failedCount > 0 ? 'error.light' : 'grey.200',
                borderRadius: 2,
              }}
            >
              <Typography
                variant="h3"
                color={failedCount > 0 ? 'error.main' : 'text.secondary'}
                fontWeight={700}
              >
                {failedCount}
              </Typography>
              <Typography
                variant="body1"
                color={failedCount > 0 ? 'error.dark' : 'text.secondary'}
              >
                Components Failed
              </Typography>
              {failedCount > 0 && (
                <Chip
                  label={`${failureRate}%`}
                  color="error"
                  size="small"
                  sx={{ mt: 1 }}
                />
              )}
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper
              elevation={0}
              sx={{
                p: 3,
                textAlign: 'center',
                bgcolor: 'primary.light',
                border: '1px solid',
                borderColor: 'primary.light',
                borderRadius: 2,
              }}
            >
              <Typography variant="h3" color="primary.main" fontWeight={700}>
                {totalCount}
              </Typography>
              <Typography variant="body1" color="primary.dark">
                Total Components
              </Typography>
              <Chip
                label="Processed"
                color="primary"
                size="small"
                sx={{ mt: 1 }}
              />
            </Paper>
          </Grid>
        </Grid>

        {/* Quality Indicator */}
        <Box mb={4}>
          <Typography variant="subtitle2" color="textSecondary" gutterBottom>
            Enrichment Quality
          </Typography>
          <Box
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: 'grey.200',
              overflow: 'hidden',
              display: 'flex',
            }}
          >
            <Box
              sx={{
                width: `${successRate}%`,
                bgcolor: 'success.main',
                transition: 'width 0.5s ease',
              }}
            />
            <Box
              sx={{
                width: `${failureRate}%`,
                bgcolor: 'error.main',
                transition: 'width 0.5s ease',
              }}
            />
          </Box>
          <Box display="flex" justifyContent="space-between" mt={0.5}>
            <Typography variant="caption" color="success.main">
              {successRate}% Success
            </Typography>
            {failedCount > 0 && (
              <Typography variant="caption" color="error.main">
                {failureRate}% Failed
              </Typography>
            )}
          </Box>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Action Buttons */}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
          <Button
            variant="contained"
            color="primary"
            startIcon={<VisibilityIcon />}
            onClick={handleViewDetails}
            size="large"
          >
            View Details
          </Button>

          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleDownloadResults}
            size="large"
          >
            Download Results
          </Button>

          <Button
            variant="outlined"
            color="secondary"
            startIcon={<AddIcon />}
            onClick={handleStartNew}
            size="large"
          >
            Upload Another BOM
          </Button>
        </Stack>

        {/* BOM ID Reference */}
        <Box mt={4} textAlign="center">
          <Typography variant="caption" color="textSecondary">
            BOM ID: <code>{bomId}</code>
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default EnrichmentResultsSummary;
