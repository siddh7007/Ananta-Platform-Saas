import React from 'react';
import {
  Box,
  Typography,
  Chip,
  Stack,
  LinearProgress,
  IconButton,
} from '@mui/material';
import {
  Visibility as ViewIcon,
  GetApp as ExportIcon,
  AutoFixHigh as EnrichIcon,
  MoreVert as MoreIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';
import { SwipeableCard } from './SwipeableCard';
import { TouchTarget } from './TouchTarget';
import { formatDistanceToNow } from 'date-fns';

export interface BOMData {
  id: string;
  name: string;
  totalComponents: number;
  enrichedComponents: number;
  enrichmentPercentage: number;
  riskLevel: 'low' | 'medium' | 'high';
  status: 'draft' | 'enriching' | 'completed' | 'failed';
  updatedAt: Date;
  updatedBy?: string;
}

export interface BOMCardProps {
  data: BOMData;
  onView?: () => void;
  onEnrich?: () => void;
  onExport?: () => void;
  onDelete?: () => void;
  onArchive?: () => void;
  showSwipeActions?: boolean;
}

const riskColors = {
  low: 'success',
  medium: 'warning',
  high: 'error',
} as const;

const statusColors = {
  draft: 'default',
  enriching: 'info',
  completed: 'success',
  failed: 'error',
} as const;

/**
 * BOMCard - Tablet-optimized card for BOM list
 *
 * Displays:
 * - BOM name and risk level
 * - Component count and enrichment progress
 * - Last updated info
 * - Quick action buttons
 * - Optional swipe actions
 *
 * @example
 * <BOMCard
 *   data={bomData}
 *   onView={handleView}
 *   onEnrich={handleEnrich}
 *   showSwipeActions
 * />
 */
export const BOMCard: React.FC<BOMCardProps> = ({
  data,
  onView,
  onEnrich,
  onExport,
  onDelete,
  onArchive,
  showSwipeActions = true,
}) => {
  const cardContent = (
    <Box sx={{ p: 0 }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          mb: 1.5,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="h6"
            sx={{
              fontSize: '1rem',
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {data.name}
          </Typography>
        </Box>

        <Chip
          label={data.riskLevel.toUpperCase()}
          color={riskColors[data.riskLevel]}
          size="small"
          icon={
            data.riskLevel === 'high' ? (
              <WarningIcon fontSize="small" />
            ) : data.riskLevel === 'low' ? (
              <CheckIcon fontSize="small" />
            ) : undefined
          }
          sx={{ ml: 1, flexShrink: 0 }}
        />
      </Box>

      {/* Stats */}
      <Box sx={{ mb: 1.5 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          {data.totalComponents} components • {data.enrichmentPercentage}% enriched
        </Typography>

        <LinearProgress
          variant="determinate"
          value={data.enrichmentPercentage}
          sx={{
            height: 6,
            borderRadius: 3,
            bgcolor: 'action.hover',
            '& .MuiLinearProgress-bar': {
              borderRadius: 3,
            },
          }}
        />
      </Box>

      {/* Status and timestamp */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
        }}
      >
        <Chip
          label={data.status.charAt(0).toUpperCase() + data.status.slice(1)}
          color={statusColors[data.status]}
          size="small"
        />

        <Typography variant="caption" color="text.secondary">
          Updated {formatDistanceToNow(data.updatedAt, { addSuffix: true })}
          {data.updatedBy && ` by ${data.updatedBy}`}
        </Typography>
      </Box>

      {/* Actions */}
      <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
        {onView && (
          <TouchTarget
            onClick={(e) => {
              e.stopPropagation();
              onView();
            }}
            size="md"
            ariaLabel="View BOM"
          >
            <IconButton size="small" color="primary">
              <ViewIcon fontSize="small" />
            </IconButton>
          </TouchTarget>
        )}

        {onEnrich && data.enrichmentPercentage < 100 && (
          <TouchTarget
            onClick={(e) => {
              e.stopPropagation();
              onEnrich();
            }}
            size="md"
            ariaLabel="Enrich BOM"
          >
            <IconButton size="small" color="secondary">
              <EnrichIcon fontSize="small" />
            </IconButton>
          </TouchTarget>
        )}

        {onExport && (
          <TouchTarget
            onClick={(e) => {
              e.stopPropagation();
              onExport();
            }}
            size="md"
            ariaLabel="Export BOM"
          >
            <IconButton size="small">
              <ExportIcon fontSize="small" />
            </IconButton>
          </TouchTarget>
        )}

        <TouchTarget size="md" ariaLabel="More actions">
          <IconButton size="small">
            <MoreIcon fontSize="small" />
          </IconButton>
        </TouchTarget>
      </Stack>
    </Box>
  );

  // With swipe actions
  if (showSwipeActions && (onDelete || onArchive)) {
    return (
      <SwipeableCard
        swipeConfig={{
          leftActions: onDelete
            ? [
                {
                  label: 'Delete',
                  icon: <WarningIcon />,
                  color: '#d32f2f',
                  onAction: onDelete,
                },
              ]
            : undefined,
          rightActions: onArchive
            ? [
                {
                  label: 'Archive',
                  icon: <CheckIcon />,
                  color: '#2e7d32',
                  onAction: onArchive,
                },
              ]
            : undefined,
        }}
        onClick={onView}
      >
        {cardContent}
      </SwipeableCard>
    );
  }

  // Without swipe actions
  return (
    <Box
      onClick={onView}
      sx={{
        p: 2,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        cursor: onView ? 'pointer' : 'default',
        transition: 'all 0.2s',
        '&:hover': onView
          ? {
              boxShadow: 2,
              borderColor: 'primary.main',
            }
          : {},
      }}
    >
      {cardContent}
    </Box>
  );
};

export default BOMCard;
