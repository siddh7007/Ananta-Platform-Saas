/**
 * Component Detail Dialog
 *
 * Phase 2: Displays full component details from Component Vault
 * including all parameters, specifications, pricing, and compliance info
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  Typography,
  CircularProgress,
  Alert,
  Grid,
  Chip,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Paper,
  Link,
  Stack,
} from '@mui/material';
import {
  OpenInNew as ExternalLinkIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { useNotify } from 'react-admin';
import { getCnsBaseUrl } from '../services/cnsApi';
import { WatchButton } from './WatchButton';

interface ComponentDetail {
  id: number;
  mpn: string;
  manufacturer: string;
  category: string;
  description: string;
  datasheet_url?: string;
  image_url?: string;
  lifecycle?: string;
  rohs?: string;
  reach?: string;
  specifications: Record<string, any>;
  pricing: Array<{ quantity: number; price: number; currency?: string }>;
  quality_score: number;
  enrichment_source?: string;
  last_enriched_at?: string;
  created_at?: string;
  updated_at?: string;
}

interface ComponentDetailDialogProps {
  componentId: number | null;
  open: boolean;
  onClose: () => void;
}

export const ComponentDetailDialog: React.FC<ComponentDetailDialogProps> = ({
  componentId,
  open,
  onClose,
}) => {
  const notify = useNotify();
  const [loading, setLoading] = useState(false);
  const [component, setComponent] = useState<ComponentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && componentId) {
      loadComponentDetails();
    }
  }, [open, componentId]);

  const loadComponentDetails = async () => {
    if (!componentId) return;

    try {
      setLoading(true);
      setError(null);

      const cnsBaseUrl = getCnsBaseUrl();
      const response = await fetch(
        `${cnsBaseUrl}/api/catalog/component/id/${componentId}`
      );

      if (!response.ok) {
        throw new Error(`Failed to load component: ${response.statusText}`);
      }

      const data = await response.json();
      setComponent(data);

      console.log('[Component Detail] Loaded component:', data.mpn);
    } catch (err: any) {
      console.error('[Component Detail] Error loading component:', err);
      setError(err.message);
      notify(`Failed to load component details: ${err.message}`, { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const getLifecycleColor = (lifecycle?: string) => {
    if (!lifecycle) return 'default';
    const lower = lifecycle.toLowerCase();
    if (lower.includes('active') || lower.includes('production')) return 'success';
    if (lower.includes('nrnd') || lower.includes('not recommended')) return 'warning';
    if (lower.includes('obsolete') || lower.includes('discontinued')) return 'error';
    return 'info';
  };

  const getComplianceIcon = (value?: string) => {
    if (!value) return <InfoIcon fontSize="small" color="disabled" />;
    const lower = value.toLowerCase();
    if (lower.includes('yes') || lower.includes('compliant') || lower.includes('true')) {
      return <CheckIcon fontSize="small" color="success" />;
    }
    if (lower.includes('no') || lower.includes('non') || lower.includes('false')) {
      return <CancelIcon fontSize="small" color="error" />;
    }
    return <InfoIcon fontSize="small" color="info" />;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  const renderSpecifications = () => {
    if (!component?.specifications || Object.keys(component.specifications).length === 0) {
      return (
        <Alert severity="info">No specifications available</Alert>
      );
    }

    const specs = component.specifications;

    return (
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableBody>
            {Object.entries(specs).map(([key, value]) => (
              <TableRow key={key}>
                <TableCell component="th" scope="row" sx={{ fontWeight: 500, width: '40%' }}>
                  {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </TableCell>
                <TableCell>
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  const renderPricing = () => {
    if (!component?.pricing || component.pricing.length === 0) {
      return <Typography variant="body2" color="textSecondary">No pricing available</Typography>;
    }

    return (
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableBody>
            {component.pricing.map((priceBreak, idx) => (
              <TableRow key={idx}>
                <TableCell component="th" scope="row">
                  Qty {priceBreak.quantity}+
                </TableCell>
                <TableCell align="right">
                  {priceBreak.currency || '$'}{priceBreak.price.toFixed(4)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '70vh' }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="h6">Component Details</Typography>
            {component && (
              <Typography variant="subtitle2" color="textSecondary">
                {component.mpn} • {component.manufacturer}
              </Typography>
            )}
          </Box>
          {component && (
            <WatchButton
              componentId={String(component.id)}
              mpn={component.mpn}
              manufacturer={component.manufacturer}
              variant="button"
              size="small"
            />
          )}
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={300}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : !component ? (
          <Alert severity="info">No component selected</Alert>
        ) : (
          <Stack spacing={3}>
            {/* Basic Information */}
            <Box>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Basic Information
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary">MPN</Typography>
                  <Typography variant="body1" fontWeight={500}>{component.mpn}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary">Manufacturer</Typography>
                  <Typography variant="body1">{component.manufacturer}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary">Category</Typography>
                  <Typography variant="body1">{component.category || '-'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary">Quality Score</Typography>
                  <Chip
                    label={`${component.quality_score}/100`}
                    color={component.quality_score >= 80 ? 'success' : component.quality_score >= 60 ? 'warning' : 'default'}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="textSecondary">Description</Typography>
                  <Typography variant="body2">{component.description || '-'}</Typography>
                </Grid>
              </Grid>
            </Box>

            <Divider />

            {/* Lifecycle & Compliance */}
            <Box>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Lifecycle & Compliance
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary">Lifecycle Status</Typography>
                  <Box mt={0.5}>
                    <Chip
                      label={component.lifecycle || 'Unknown'}
                      color={getLifecycleColor(component.lifecycle)}
                      size="small"
                    />
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary">Enrichment Source</Typography>
                  <Typography variant="body2">{component.enrichment_source || '-'}</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" color="textSecondary" display="flex" alignItems="center" gap={0.5}>
                    {getComplianceIcon(component.rohs)} RoHS
                  </Typography>
                  <Typography variant="body2">{component.rohs || 'Unknown'}</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" color="textSecondary" display="flex" alignItems="center" gap={0.5}>
                    {getComplianceIcon(component.reach)} REACH
                  </Typography>
                  <Typography variant="body2">{component.reach || 'Unknown'}</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" color="textSecondary">Last Enriched</Typography>
                  <Typography variant="body2">{formatDate(component.last_enriched_at)}</Typography>
                </Grid>
              </Grid>
            </Box>

            <Divider />

            {/* Specifications/Parameters */}
            <Box>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Specifications & Parameters
              </Typography>
              {renderSpecifications()}
            </Box>

            <Divider />

            {/* Pricing */}
            <Box>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Pricing
              </Typography>
              {renderPricing()}
            </Box>

            {/* Links */}
            {(component.datasheet_url || component.image_url) && (
              <>
                <Divider />
                <Box>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    Resources
                  </Typography>
                  <Stack direction="row" spacing={2}>
                    {component.datasheet_url && (
                      <Link
                        href={component.datasheet_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        underline="hover"
                        display="flex"
                        alignItems="center"
                        gap={0.5}
                      >
                        Datasheet <ExternalLinkIcon fontSize="small" />
                      </Link>
                    )}
                    {component.image_url && (
                      <Link
                        href={component.image_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        underline="hover"
                        display="flex"
                        alignItems="center"
                        gap={0.5}
                      >
                        Product Image <ExternalLinkIcon fontSize="small" />
                      </Link>
                    )}
                  </Stack>
                </Box>
              </>
            )}
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};
