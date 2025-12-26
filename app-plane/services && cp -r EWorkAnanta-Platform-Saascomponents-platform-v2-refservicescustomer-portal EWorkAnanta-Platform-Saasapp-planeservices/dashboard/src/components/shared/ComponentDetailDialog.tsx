/**
 * Component Detail Dialog
 *
 * Modal showing detailed enriched component data.
 * Uses theme tokens for quality scores and lifecycle status.
 *
 * Shared component used by:
 * - EnrichmentMonitor
 * - QualityQueue
 */

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Grid,
  Typography,
  Chip,
  Divider,
  Stack,
  Link,
  CircularProgress,
} from '@mui/material';
import {
  Memory as MemoryIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  Description as DescriptionIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { getQualityColor, getLifecycleColor } from '../../theme';

export interface ComponentDetail {
  id: string;
  mpn: string;
  manufacturer: string;
  category?: string;
  description?: string;
  datasheet_url?: string;
  image_url?: string;
  lifecycle?: string;
  rohs?: string;
  reach?: string;
  specifications?: Record<string, unknown>;
  parameters?: Record<string, unknown>;
  pricing?: Array<{ quantity: number; price: number; currency?: string }>;
  quality_score?: number;
  enrichment_source?: string;
  last_enriched_at?: string;
  stock_status?: string;
  stock_quantity?: number;
  lead_time_days?: number;
  unit_price?: number;
  currency?: string;
  moq?: number;
  aec_qualified?: boolean;
  halogen_free?: boolean;
}

export interface ComponentDetailDialogProps {
  open: boolean;
  onClose: () => void;
  component: ComponentDetail | null;
  loading: boolean;
}

const QualityScoreChip: React.FC<{ score?: number }> = ({ score }) => {
  if (score == null) {
    return (
      <Typography variant="caption" color="text.secondary">
        -
      </Typography>
    );
  }
  const color = getQualityColor(score);
  return (
    <Chip
      label={Math.round(score)}
      size="small"
      sx={{ bgcolor: color, color: '#fff', fontWeight: 600 }}
    />
  );
};

const LifecycleChip: React.FC<{ status?: string }> = ({ status }) => {
  if (!status) {
    return (
      <Typography variant="caption" color="text.secondary">
        -
      </Typography>
    );
  }
  const color = getLifecycleColor(status);
  return (
    <Chip
      label={status}
      size="small"
      variant="outlined"
      sx={{ borderColor: color, color }}
    />
  );
};

const ComplianceIcon: React.FC<{ value?: boolean }> = ({ value }) => {
  if (value === true) return <CheckIcon fontSize="small" color="success" />;
  if (value === false) return <CancelIcon fontSize="small" color="error" />;
  return (
    <Typography variant="caption" color="text.secondary">
      -
    </Typography>
  );
};

export const ComponentDetailDialog: React.FC<ComponentDetailDialogProps> = ({
  open,
  onClose,
  component,
  loading,
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="component-detail-dialog-title"
    >
      <DialogTitle id="component-detail-dialog-title" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <MemoryIcon color="primary" />
        Component Details
      </DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box display="flex" justifyContent="center" py={4} aria-label="Loading component details">
            <CircularProgress />
          </Box>
        ) : component ? (
          <Grid container spacing={2}>
            {/* Basic Info */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                Basic Information
              </Typography>
              <Divider sx={{ mb: 1 }} />
            </Grid>
            <Grid item xs={6} md={4}>
              <Typography variant="caption" color="text.secondary">
                MPN
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {component.mpn || '-'}
              </Typography>
            </Grid>
            <Grid item xs={6} md={4}>
              <Typography variant="caption" color="text.secondary">
                Manufacturer
              </Typography>
              <Typography variant="body2">{component.manufacturer || '-'}</Typography>
            </Grid>
            <Grid item xs={6} md={4}>
              <Typography variant="caption" color="text.secondary">
                Category
              </Typography>
              <Typography variant="body2">{component.category || '-'}</Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary">
                Description
              </Typography>
              <Typography variant="body2">{component.description || '-'}</Typography>
            </Grid>

            {/* Status & Quality */}
            <Grid item xs={12} sx={{ mt: 1 }}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                Status & Quality
              </Typography>
              <Divider sx={{ mb: 1 }} />
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="caption" color="text.secondary">
                Quality Score
              </Typography>
              <Box>
                <QualityScoreChip score={component.quality_score} />
              </Box>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="caption" color="text.secondary">
                Lifecycle
              </Typography>
              <Box>
                <LifecycleChip status={component.lifecycle} />
              </Box>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="caption" color="text.secondary">
                Source
              </Typography>
              <Typography variant="body2">{component.enrichment_source || '-'}</Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="caption" color="text.secondary">
                Last Enriched
              </Typography>
              <Typography variant="body2">
                {component.last_enriched_at
                  ? new Date(component.last_enriched_at).toLocaleDateString()
                  : '-'}
              </Typography>
            </Grid>

            {/* Compliance */}
            <Grid item xs={12} sx={{ mt: 1 }}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                Compliance
              </Typography>
              <Divider sx={{ mb: 1 }} />
            </Grid>
            <Grid item xs={3}>
              <Typography variant="caption" color="text.secondary">
                RoHS
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <ComplianceIcon
                  value={component.rohs === 'Compliant' || component.rohs === 'Yes'}
                />
                <Typography variant="caption">{component.rohs || '-'}</Typography>
              </Box>
            </Grid>
            <Grid item xs={3}>
              <Typography variant="caption" color="text.secondary">
                REACH
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <ComplianceIcon
                  value={component.reach === 'Compliant' || component.reach === 'Yes'}
                />
                <Typography variant="caption">{component.reach || '-'}</Typography>
              </Box>
            </Grid>
            <Grid item xs={3}>
              <Typography variant="caption" color="text.secondary">
                AEC-Q
              </Typography>
              <Box>
                <ComplianceIcon value={component.aec_qualified} />
              </Box>
            </Grid>
            <Grid item xs={3}>
              <Typography variant="caption" color="text.secondary">
                Halogen Free
              </Typography>
              <Box>
                <ComplianceIcon value={component.halogen_free} />
              </Box>
            </Grid>

            {/* Stock & Pricing */}
            <Grid item xs={12} sx={{ mt: 1 }}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                Stock & Pricing
              </Typography>
              <Divider sx={{ mb: 1 }} />
            </Grid>
            <Grid item xs={4}>
              <Typography variant="caption" color="text.secondary">
                Stock Quantity
              </Typography>
              <Typography variant="body2">
                {component.stock_quantity != null
                  ? component.stock_quantity.toLocaleString()
                  : '-'}
              </Typography>
            </Grid>
            <Grid item xs={4}>
              <Typography variant="caption" color="text.secondary">
                Lead Time
              </Typography>
              <Typography variant="body2">
                {component.lead_time_days != null ? `${component.lead_time_days} days` : '-'}
              </Typography>
            </Grid>
            <Grid item xs={4}>
              <Typography variant="caption" color="text.secondary">
                MOQ
              </Typography>
              <Typography variant="body2">{component.moq || '-'}</Typography>
            </Grid>
            {component.pricing && component.pricing.length > 0 && (
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">
                  Price Breaks
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
                  {component.pricing.slice(0, 5).map((pb, idx) => (
                    <Chip
                      key={idx}
                      label={`${pb.quantity}+ @ ${pb.currency || '$'}${pb.price.toFixed(4)}`}
                      size="small"
                      variant="outlined"
                    />
                  ))}
                  {component.pricing.length > 5 && (
                    <Chip label={`+${component.pricing.length - 5} more`} size="small" />
                  )}
                </Stack>
              </Grid>
            )}

            {/* Parameters */}
            {component.parameters && Object.keys(component.parameters).length > 0 && (
              <>
                <Grid item xs={12} sx={{ mt: 1 }}>
                  <Typography variant="subtitle2" color="primary" gutterBottom>
                    Parameters
                  </Typography>
                  <Divider sx={{ mb: 1 }} />
                </Grid>
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {Object.entries(component.parameters)
                      .slice(0, 12)
                      .map(([key, value]) => (
                        <Chip
                          key={key}
                          label={`${key}: ${String(value)}`}
                          size="small"
                          variant="outlined"
                          sx={{ maxWidth: 200 }}
                        />
                      ))}
                    {Object.keys(component.parameters).length > 12 && (
                      <Chip
                        label={`+${Object.keys(component.parameters).length - 12} more`}
                        size="small"
                      />
                    )}
                  </Box>
                </Grid>
              </>
            )}

            {/* Datasheet Link */}
            {component.datasheet_url && (
              <Grid item xs={12} sx={{ mt: 1 }}>
                <Link
                  href={component.datasheet_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                  aria-label={`View datasheet for ${component.mpn}`}
                >
                  <DescriptionIcon fontSize="small" />
                  View Datasheet
                  <OpenInNewIcon fontSize="small" />
                </Link>
              </Grid>
            )}
          </Grid>
        ) : (
          <Typography color="text.secondary" align="center" py={2}>
            No component details available
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ComponentDetailDialog;
