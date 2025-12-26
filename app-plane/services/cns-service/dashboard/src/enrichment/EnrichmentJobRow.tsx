/**
 * Enrichment Job Row Component
 *
 * Individual row in the enrichment table with expand functionality.
 */

import React, { Fragment, memo } from 'react';
import {
  TableRow,
  TableCell,
  Stack,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Collapse,
  CircularProgress,
} from '@mui/material';
import {
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
  Visibility as ViewIcon,
  OpenInNew as OpenInNewIcon,
  Stop as StopIcon,
  Delete as DeleteIcon,
  Pending as PendingIcon,
} from '@mui/icons-material';
import { BatchProgressBar } from './BatchProgressBar';
import { EnrichmentLineItems, LineItem } from './EnrichmentLineItems';
import { EnrichmentStatusBadge } from '../components/shared';
import { enrichmentStatusColors } from '../theme';

export interface Enrichment {
  bom_id: string;
  bom_name?: string | null;
  bom_filename?: string | null;
  source: 'customer' | 'staff' | 'unknown';
  tenant_id: string;
  project_id?: string;
  status: 'enriching' | 'completed' | 'failed' | 'unknown';
  total_items: number;
  enriched_items: number;
  failed_items: number;
  percent_complete: number;
  started_at: string;
  completed_at?: string;
  workflow_id?: string;
}

export interface EnrichmentJobRowProps {
  enrichment: Enrichment;
  isExpanded: boolean;
  lineItems: LineItem[];
  lineItemsLoading: boolean;
  stoppingId: string | null;
  deletingId: string | null;
  onToggleExpand: (bomId: string) => void;
  onRefreshLineItems: (bomId: string) => void;
  onViewProgress: (enrichment: Enrichment) => void;
  onOpenBomDetail: (bomId: string) => void;
  onNavigateAudit: (bomId: string) => void;
  onStop: (bomId: string) => void;
  onDelete: (bomId: string) => void;
  onViewComponent: (componentId: string) => void;
}

const getSourceChipColor = (source: string): 'secondary' | 'primary' | 'default' => {
  if (source === 'customer') return 'secondary';
  if (source === 'staff') return 'primary';
  return 'default';
};

export const EnrichmentJobRow: React.FC<EnrichmentJobRowProps> = memo(({
  enrichment,
  isExpanded,
  lineItems,
  lineItemsLoading,
  stoppingId,
  deletingId,
  onToggleExpand,
  onRefreshLineItems,
  onViewProgress,
  onOpenBomDetail,
  onNavigateAudit,
  onStop,
  onDelete,
  onViewComponent,
}) => {
  const isStopping = stoppingId === enrichment.bom_id;
  const isDeleting = deletingId === enrichment.bom_id;

  return (
    <Fragment>
      <TableRow hover sx={{ '& > *': { borderBottom: isExpanded ? 'none' : undefined } }}>
        {/* Expand Button */}
        <TableCell padding="checkbox">
          <Tooltip title={isExpanded ? 'Collapse' : 'View Line Items'}>
            <IconButton size="small" onClick={() => onToggleExpand(enrichment.bom_id)} aria-label={isExpanded ? "Collapse line items" : "View line items"}>
              {isExpanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
            </IconButton>
          </Tooltip>
        </TableCell>

        {/* BOM Info */}
        <TableCell>
          <Stack spacing={0.5}>
            <Typography variant="body2" fontWeight={600}>
              {enrichment.bom_name || enrichment.bom_filename || 'Untitled BOM'}
            </Typography>
            <Typography variant="caption" color="text.secondary" fontFamily="monospace">
              {enrichment.bom_id.length > 16
                ? enrichment.bom_id.slice(0, 16) + '...'
                : enrichment.bom_id}
            </Typography>
          </Stack>
        </TableCell>

        {/* Source */}
        <TableCell>
          <Chip
            label={enrichment.source || 'unknown'}
            size="small"
            color={getSourceChipColor(enrichment.source)}
            variant="outlined"
          />
        </TableCell>

        {/* Status */}
        <TableCell align="center">
          <EnrichmentStatusBadge
            status={enrichment.status}
            variant="badge"
            size="small"
          />
        </TableCell>

        {/* Progress */}
        <TableCell align="center" sx={{ minWidth: 120 }}>
          <BatchProgressBar percent={enrichment.percent_complete} status={enrichment.status} />
        </TableCell>

        {/* Items */}
        <TableCell align="center">{enrichment.total_items}</TableCell>

        {/* Enriched */}
        <TableCell align="center">
          <Chip
            label={enrichment.enriched_items}
            size="small"
            sx={{
              bgcolor: 'rgba(34, 197, 94, 0.1)',
              color: enrichmentStatusColors.completed,
            }}
          />
        </TableCell>

        {/* Failed */}
        <TableCell align="center">
          {enrichment.failed_items > 0 ? (
            <Chip
              label={enrichment.failed_items}
              size="small"
              sx={{
                bgcolor: 'rgba(239, 68, 68, 0.1)',
                color: enrichmentStatusColors.failed,
              }}
            />
          ) : (
            '-'
          )}
        </TableCell>

        {/* Started */}
        <TableCell>
          <Typography variant="body2">
            {new Date(enrichment.started_at).toLocaleString()}
          </Typography>
        </TableCell>

        {/* Actions */}
        <TableCell align="center">
          <Stack direction="row" spacing={0.5} justifyContent="center">
            {/* Stop button - only for enriching BOMs */}
            {enrichment.status === 'enriching' && (
              <Tooltip title="Stop Enrichment">
                <span>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => onStop(enrichment.bom_id)}
                    aria-label="Stop enrichment"
                    disabled={isStopping}
                  >
                    {isStopping ? <CircularProgress size={18} /> : <StopIcon fontSize="small" />}
                  </IconButton>
                </span>
              </Tooltip>
            )}

            {/* Delete button */}
            <Tooltip
              title={enrichment.status === 'enriching' ? 'Stop enrichment first' : 'Delete Enrichment'}
            >
              <span>
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => onDelete(enrichment.bom_id)}
                  disabled={isDeleting || enrichment.status === 'enriching'}
                >
                  {isDeleting ? <CircularProgress size={18} /> : <DeleteIcon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>

            <Tooltip title="View Progress">
              <IconButton size="small" color="info" onClick={() => onViewProgress(enrichment)} aria-label="View progress">
                <ViewIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            <Tooltip title="Open BOM Components">
              <IconButton
                size="small"
                color="primary"
                onClick={() => onOpenBomDetail(enrichment.bom_id)}
                aria-label="Open BOM components"
              >
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            <Tooltip title="View Audit Events">
              <IconButton size="small" onClick={() => onNavigateAudit(enrichment.bom_id)} aria-label="View audit events">
                <PendingIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </TableCell>
      </TableRow>

      {/* Expanded Row with Line Items */}
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={10}>
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <EnrichmentLineItems
              items={lineItems}
              loading={lineItemsLoading}
              onRefresh={() => onRefreshLineItems(enrichment.bom_id)}
              onViewComponent={onViewComponent}
            />
          </Collapse>
        </TableCell>
      </TableRow>
    </Fragment>
  );
});

// Display name for debugging
EnrichmentJobRow.displayName = 'EnrichmentJobRow';

export default EnrichmentJobRow;
