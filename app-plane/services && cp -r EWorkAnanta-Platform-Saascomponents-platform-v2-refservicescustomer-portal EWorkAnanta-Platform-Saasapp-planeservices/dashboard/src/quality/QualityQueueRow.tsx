/**
 * Quality Queue Row Component
 *
 * Individual row in the quality queue table.
 * Supports selection for batch operations.
 */

import React, { memo } from 'react';
import {
  TableRow,
  TableCell,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Stack,
  Checkbox,
  CircularProgress,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { QualityChip } from '../components/shared';
import { SupplierChips } from '../components/shared';

export interface QueueItem {
  id: string;
  mpn: string;
  manufacturer: string;
  category: string;
  quality_score: number;
  flagged_reason: string;
  data_completeness: number;
  sources_used: string[];
  submitted_at: string;
  job_id?: string;
}

export interface QualityQueueRowProps {
  item: QueueItem;
  isSelected: boolean;
  isProcessing: boolean;
  onSelect: (id: string, selected: boolean) => void;
  onApprove: (id: string) => void;
  onReject: (id: string, mpn: string) => void;
  onViewDetails: (id: string) => void;
}

export const QualityQueueRow: React.FC<QualityQueueRowProps> = memo(({
  item,
  isSelected,
  isProcessing,
  onSelect,
  onApprove,
  onReject,
  onViewDetails,
}) => {
  return (
    <TableRow
      hover
      selected={isSelected}
      sx={{
        '&.Mui-selected': {
          backgroundColor: 'rgba(59, 130, 246, 0.08)',
        },
        '&.Mui-selected:hover': {
          backgroundColor: 'rgba(59, 130, 246, 0.12)',
        },
      }}
    >
      {/* Selection Checkbox */}
      <TableCell padding="checkbox">
        <Checkbox
          checked={isSelected}
          onChange={(e) => onSelect(item.id, e.target.checked)}
          disabled={isProcessing}
        />
      </TableCell>

      {/* MPN */}
      <TableCell>
        <Typography variant="body2" fontWeight={600} fontFamily="monospace">
          {item.mpn}
        </Typography>
      </TableCell>

      {/* Manufacturer */}
      <TableCell>{item.manufacturer}</TableCell>

      {/* Category */}
      <TableCell>
        {item.category ? (
          <Chip label={item.category} size="small" variant="outlined" />
        ) : (
          <Typography variant="caption" color="text.secondary">
            -
          </Typography>
        )}
      </TableCell>

      {/* Quality Score */}
      <TableCell align="center">
        <QualityChip score={item.quality_score} />
      </TableCell>

      {/* Data Completeness */}
      <TableCell align="center">
        <Typography variant="body2">{item.data_completeness}%</Typography>
      </TableCell>

      {/* Flagged Reason */}
      <TableCell>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 200 }} noWrap>
          {item.flagged_reason}
        </Typography>
      </TableCell>

      {/* Sources Used */}
      <TableCell>
        {item.sources_used.length > 0 ? (
          <SupplierChips suppliers={item.sources_used} size="small" max={2} />
        ) : (
          <Typography variant="caption" color="text.secondary">
            -
          </Typography>
        )}
      </TableCell>

      {/* Submitted */}
      <TableCell>
        <Typography variant="caption">
          {new Date(item.submitted_at).toLocaleDateString()}
        </Typography>
      </TableCell>

      {/* Actions */}
      <TableCell align="center">
        <Stack direction="row" spacing={0.5} justifyContent="center">
          <Tooltip title="Approve to Production (A)">
            <span>
              <IconButton
                color="success"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onApprove(item.id);
                }}
                disabled={isProcessing}
              >
                {isProcessing ? <CircularProgress size={18} /> : <CheckIcon fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Reject & Remove (R)">
            <span>
              <IconButton
                color="error"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onReject(item.id, item.mpn);
                }}
                disabled={isProcessing}
              >
                <CancelIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="View Details (V)">
            <IconButton
              color="info"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails(item.id);
              }}
            >
              <ViewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </TableCell>
    </TableRow>
  );
});

// Display name for debugging
QualityQueueRow.displayName = 'QualityQueueRow';

export default QualityQueueRow;
