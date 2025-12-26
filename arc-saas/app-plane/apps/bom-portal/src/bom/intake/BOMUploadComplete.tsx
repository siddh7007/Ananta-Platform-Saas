/**
 * BOMUploadComplete Component
 *
 * Success state display after BOM upload with enrichment prompt.
 * Shows upload summary, next action buttons, and links to related views.
 */

import React from 'react';
import { Box, Typography, Button, Alert, Divider, Chip } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AssessmentIcon from '@mui/icons-material/Assessment';
import NotificationsIcon from '@mui/icons-material/Notifications';
import InventoryIcon from '@mui/icons-material/Inventory';

interface BOMUploadCompleteProps {
  filename: string;
  totalRows: number;
  uploadId: string;
  bomId?: string;
  /** Whether enrichment has been completed */
  isEnriched?: boolean;
  /** Number of alerts generated (if enriched) */
  alertCount?: number;
  /** Risk score (if enriched) */
  riskScore?: number;
  onStartEnrichment: () => void;
  onSkip: () => void;
  onViewDetails: () => void;
}

export function BOMUploadComplete({
  filename,
  totalRows,
  uploadId,
  bomId,
  isEnriched = false,
  alertCount,
  riskScore,
  onStartEnrichment,
  onSkip,
  onViewDetails,
}: BOMUploadCompleteProps) {
  return (
    <Alert
      severity="success"
      sx={{
        mx: 2,
        mb: 1,
        border: '2px solid',
        borderColor: 'success.main',
        '& .MuiAlert-message': { width: '100%' },
      }}
      icon={<CheckCircleIcon />}
    >
      <Box>
        <Typography variant="body2" fontWeight={600} gutterBottom>
          Upload Complete: {filename}
        </Typography>
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          {totalRows} components ready for enrichment
        </Typography>

        {!isEnriched ? (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: '0.85rem' }}>
              <strong>Next Step:</strong> Enrich your BOM to get real-time pricing, availability, and datasheets from suppliers.
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button
                size="small"
                variant="contained"
                color="primary"
                onClick={onStartEnrichment}
                startIcon={<RocketLaunchIcon />}
              >
                Enrich Now
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={onSkip}
                startIcon={<SkipNextIcon />}
              >
                Skip for Now
              </Button>
              <Button
                size="small"
                variant="text"
                onClick={onViewDetails}
                startIcon={<VisibilityIcon />}
              >
                View Upload Details
              </Button>
            </Box>
          </>
        ) : (
          <>
            {/* Enrichment Complete Summary */}
            <Box
              sx={{
                display: 'flex',
                gap: 2,
                mb: 2,
                flexWrap: 'wrap',
              }}
            >
              {riskScore !== undefined && (
                <Chip
                  icon={<AssessmentIcon />}
                  label={`Risk Score: ${riskScore}`}
                  color={riskScore >= 70 ? 'error' : riskScore >= 40 ? 'warning' : 'success'}
                  size="small"
                  variant="outlined"
                />
              )}
              {alertCount !== undefined && alertCount > 0 && (
                <Chip
                  icon={<NotificationsIcon />}
                  label={`${alertCount} Alert${alertCount !== 1 ? 's' : ''} Generated`}
                  color="warning"
                  size="small"
                  variant="outlined"
                />
              )}
              <Chip
                icon={<InventoryIcon />}
                label={`${totalRows} Components`}
                size="small"
                variant="outlined"
              />
            </Box>

            <Divider sx={{ my: 1.5 }} />

            {/* Quick Links */}
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Quick Links:
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {bomId && (
                <Button
                  size="small"
                  variant="contained"
                  component={RouterLink}
                  to={`/boms/${bomId}/show`}
                  startIcon={<InventoryIcon />}
                >
                  View Enriched BOM
                </Button>
              )}
              <Button
                size="small"
                variant="outlined"
                component={RouterLink}
                to="/risk-dashboard"
                startIcon={<AssessmentIcon />}
              >
                Risk Dashboard
              </Button>
              <Button
                size="small"
                variant="outlined"
                component={RouterLink}
                to="/alerts"
                startIcon={<NotificationsIcon />}
                endIcon={alertCount && alertCount > 0 ? (
                  <Chip label={alertCount} size="small" color="error" sx={{ height: 18, minWidth: 18 }} />
                ) : undefined}
              >
                Alert Center
              </Button>
              <Button
                size="small"
                variant="text"
                onClick={onViewDetails}
                startIcon={<VisibilityIcon />}
              >
                Upload Details
              </Button>
            </Box>
          </>
        )}
      </Box>
    </Alert>
  );
}

export default BOMUploadComplete;
