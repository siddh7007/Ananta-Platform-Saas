/**
 * Enrichment Line Items Component
 *
 * Expandable table showing line items for a BOM enrichment.
 */

import React from 'react';
import {
  Box,
  Stack,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Timeline as TimelineIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  HourglassEmpty as PendingIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { enrichmentStatusColors } from '../theme';

export interface LineItem {
  id: string;
  bom_id: string;
  line_number: number;
  manufacturer_part_number?: string;
  manufacturer?: string;
  quantity: number;
  reference_designator?: string;
  description?: string;
  enrichment_status: string;
  component_id?: string | null;
  enrichment_error?: string | null;
}

export interface LineItemStats {
  total: number;
  completed: number;
  failed: number;
  pending: number;
}

export interface EnrichmentLineItemsProps {
  items: LineItem[];
  loading: boolean;
  onRefresh: () => void;
  onViewComponent: (componentId: string) => void;
}

const lineItemStatusIcon = (status: string) => {
  switch (status.toLowerCase()) {
    case 'completed':
      return <CheckIcon fontSize="small" sx={{ color: enrichmentStatusColors.completed }} />;
    case 'failed':
      return <ErrorIcon fontSize="small" sx={{ color: enrichmentStatusColors.failed }} />;
    case 'enriching':
      return <CircularProgress size={16} />;
    default:
      return <PendingIcon fontSize="small" color="disabled" />;
  }
};

const getRowBgColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'completed':
      return 'rgba(34, 197, 94, 0.08)';
    case 'failed':
      return 'rgba(239, 68, 68, 0.08)';
    default:
      return 'inherit';
  }
};

export const EnrichmentLineItems: React.FC<EnrichmentLineItemsProps> = ({
  items,
  loading,
  onRefresh,
  onViewComponent,
}) => {
  const stats: LineItemStats = {
    total: items.length,
    completed: items.filter((i) => i.enrichment_status === 'completed').length,
    failed: items.filter((i) => i.enrichment_status === 'failed').length,
    pending: items.filter((i) => i.enrichment_status === 'pending').length,
  };

  return (
    <Box sx={{ margin: 2 }}>
      <Stack direction="row" spacing={2} alignItems="center" mb={1} flexWrap="wrap">
        <TimelineIcon color="primary" />
        <Typography variant="subtitle1" fontWeight={600}>
          Line Items
        </Typography>
        <Tooltip title="Refresh line items">
          <IconButton size="small" onClick={onRefresh} disabled={loading}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        {!loading && items.length > 0 && (
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip label={`Total: ${stats.total}`} size="small" />
            <Chip
              label={`Completed: ${stats.completed}`}
              size="small"
              sx={{
                bgcolor: 'rgba(34, 197, 94, 0.1)',
                color: enrichmentStatusColors.completed,
              }}
            />
            {stats.failed > 0 && (
              <Chip
                label={`Failed: ${stats.failed}`}
                size="small"
                sx={{
                  bgcolor: 'rgba(239, 68, 68, 0.1)',
                  color: enrichmentStatusColors.failed,
                }}
              />
            )}
            {stats.pending > 0 && (
              <Chip label={`Pending: ${stats.pending}`} size="small" variant="outlined" />
            )}
          </Stack>
        )}
      </Stack>

      {loading ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
          <CircularProgress size={20} />
          <Typography variant="body2">Loading line items...</Typography>
        </Box>
      ) : items.length === 0 ? (
        <Alert severity="info" sx={{ mt: 1 }}>
          No line items found for this BOM.
        </Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 350 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell width={60}>
                  <strong>#</strong>
                </TableCell>
                <TableCell>
                  <strong>MPN</strong>
                </TableCell>
                <TableCell>
                  <strong>Manufacturer</strong>
                </TableCell>
                <TableCell align="center">
                  <strong>Qty</strong>
                </TableCell>
                <TableCell>
                  <strong>Ref Des</strong>
                </TableCell>
                <TableCell align="center">
                  <strong>Status</strong>
                </TableCell>
                <TableCell>
                  <strong>Error</strong>
                </TableCell>
                <TableCell align="center" width={60}>
                  <strong>Actions</strong>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow
                  key={item.id}
                  hover
                  sx={{
                    bgcolor: getRowBgColor(item.enrichment_status),
                    '&:hover': {
                      bgcolor:
                        item.enrichment_status === 'completed'
                          ? 'rgba(34, 197, 94, 0.15)'
                          : item.enrichment_status === 'failed'
                          ? 'rgba(239, 68, 68, 0.15)'
                          : undefined,
                    },
                  }}
                >
                  <TableCell>{item.line_number}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace" fontWeight={500}>
                      {item.manufacturer_part_number || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>{item.manufacturer || '-'}</TableCell>
                  <TableCell align="center">{item.quantity}</TableCell>
                  <TableCell>
                    <Typography variant="caption" fontFamily="monospace">
                      {item.reference_designator || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
                      {lineItemStatusIcon(item.enrichment_status)}
                      <Typography variant="caption" textTransform="capitalize">
                        {item.enrichment_status}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    {item.enrichment_error ? (
                      <Tooltip title={item.enrichment_error}>
                        <Typography
                          variant="caption"
                          color="error"
                          noWrap
                          sx={{ maxWidth: 200, display: 'block' }}
                        >
                          {item.enrichment_error.length > 40
                            ? item.enrichment_error.slice(0, 40) + '...'
                            : item.enrichment_error}
                        </Typography>
                      </Tooltip>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {item.component_id && item.enrichment_status === 'completed' && (
                      <Tooltip title="View Component Details">
                        <IconButton size="small" onClick={() => onViewComponent(item.component_id!)}>
                          <InfoIcon fontSize="small" color="info" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default EnrichmentLineItems;
