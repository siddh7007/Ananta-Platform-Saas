/**
 * EnrichmentQueueItem Component
 *
 * Individual component item in the enrichment queue.
 * Shows MPN, manufacturer, status, and enrichment details.
 */

import React from 'react';
import {
  Box,
  ListItem,
  ListItemText,
  Typography,
  Chip,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import StarIcon from '@mui/icons-material/Star';
import type { EnrichmentQueueComponent, ComponentEnrichmentStatus } from '../../hooks/useEnrichmentQueue';

/**
 * Safely format a timestamp to local time string
 */
function formatTime(timestamp: string | undefined): string {
  if (!timestamp) return '';
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      console.warn('[EnrichmentQueueItem] Invalid timestamp:', timestamp);
      return '';
    }
    return date.toLocaleTimeString();
  } catch (err) {
    console.warn('[EnrichmentQueueItem] Error formatting timestamp:', timestamp, err);
    return '';
  }
}

interface EnrichmentQueueItemProps {
  component: EnrichmentQueueComponent;
  index: number;
  showQualityScore?: boolean;
}

/**
 * Get status icon for component
 */
function getStatusIcon(status: ComponentEnrichmentStatus) {
  switch (status) {
    case 'pending':
      return <HourglassEmptyIcon sx={{ fontSize: 16, color: 'action.disabled' }} />;
    case 'enriching':
      return (
        <CircularProgress
          size={16}
          thickness={4}
          sx={{ color: 'primary.main' }}
        />
      );
    case 'enriched':
      return <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} />;
    case 'failed':
      return <ErrorIcon sx={{ fontSize: 16, color: 'error.main' }} />;
    case 'not_found':
      return <SearchOffIcon sx={{ fontSize: 16, color: 'warning.main' }} />;
    default:
      return <HourglassEmptyIcon sx={{ fontSize: 16, color: 'action.disabled' }} />;
  }
}

/**
 * Get status color for chip
 */
function getStatusColor(status: ComponentEnrichmentStatus): 'default' | 'primary' | 'success' | 'error' | 'warning' {
  switch (status) {
    case 'enriching':
      return 'primary';
    case 'enriched':
      return 'success';
    case 'failed':
      return 'error';
    case 'not_found':
      return 'warning';
    default:
      return 'default';
  }
}

/**
 * Get status text
 */
function getStatusText(status: ComponentEnrichmentStatus): string {
  switch (status) {
    case 'pending':
      return 'Waiting...';
    case 'enriching':
      return 'Enriching...';
    case 'enriched':
      return 'Enriched';
    case 'failed':
      return 'Failed';
    case 'not_found':
      return 'Not Found';
    default:
      return 'Unknown';
  }
}

/**
 * Get quality score color
 */
function getQualityColor(score: number | undefined): string {
  if (!score) return 'action.disabled';
  if (score >= 80) return 'success.main';
  if (score >= 60) return 'warning.main';
  return 'error.main';
}

export function EnrichmentQueueItem({
  component,
  index,
  showQualityScore = true,
}: EnrichmentQueueItemProps) {
  const { mpn, manufacturer, status, qualityScore, supplier, errorMessage, enrichedAt } = component;

  return (
    <ListItem
      sx={{
        py: 0.5,
        px: 1.5,
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: status === 'enriching' ? 'action.selected' : 'transparent',
        transition: 'background-color 0.2s',
        '&:hover': {
          bgcolor: 'action.hover',
        },
      }}
    >
      {/* Index/Status Icon */}
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: status === 'pending' ? 'action.hover' : 'transparent',
          mr: 1.5,
        }}
      >
        {status === 'pending' ? (
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            {index + 1}
          </Typography>
        ) : (
          getStatusIcon(status)
        )}
      </Box>

      {/* Component Info */}
      <ListItemText
        primary={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 200 }}>
              {mpn}
            </Typography>
            {manufacturer && (
              <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 150 }}>
                {manufacturer}
              </Typography>
            )}
          </Box>
        }
        secondary={
          status === 'enriched' && supplier ? (
            <Typography variant="caption" color="text.secondary">
              via {supplier}
              {enrichedAt && formatTime(enrichedAt) && ` at ${formatTime(enrichedAt)}`}
            </Typography>
          ) : status === 'failed' && errorMessage ? (
            <Typography variant="caption" color="error.main">
              {errorMessage}
            </Typography>
          ) : null
        }
        sx={{ my: 0 }}
      />

      {/* Quality Score */}
      {showQualityScore && status === 'enriched' && qualityScore !== undefined && (
        <Tooltip title={`Quality Score: ${qualityScore}%`}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              mr: 1,
            }}
          >
            <StarIcon sx={{ fontSize: 14, color: getQualityColor(qualityScore) }} />
            <Typography
              variant="caption"
              fontWeight={600}
              color={getQualityColor(qualityScore)}
            >
              {qualityScore}
            </Typography>
          </Box>
        </Tooltip>
      )}

      {/* Status Chip */}
      <Chip
        label={getStatusText(status)}
        color={getStatusColor(status)}
        size="small"
        variant={status === 'pending' ? 'outlined' : 'filled'}
        sx={{ minWidth: 80, fontSize: '0.7rem' }}
      />
    </ListItem>
  );
}

/**
 * Compact version for showing just a few items
 */
interface EnrichmentQueueListProps {
  components: EnrichmentQueueComponent[];
  maxItems?: number;
  showQualityScore?: boolean;
  title?: string;
  /** Enable auto-scroll to enriching item */
  autoScroll?: boolean;
}

export function EnrichmentQueueList({
  components,
  maxItems = 10,
  showQualityScore = true,
  title = 'Component Queue',
  autoScroll = true,
}: EnrichmentQueueListProps) {
  const listContainerRef = React.useRef<HTMLDivElement>(null);
  const enrichingItemRef = React.useRef<HTMLDivElement>(null);

  // Sort: enriching first, then pending, then enriched, then failed
  const sortedComponents = React.useMemo(() => {
    console.debug(`[EnrichmentQueueList] Sorting ${components.length} components`);
    return [...components].sort((a, b) => {
      const order: Record<ComponentEnrichmentStatus, number> = {
        enriching: 0,
        pending: 1,
        enriched: 2,
        failed: 3,
        not_found: 4,
      };
      return (order[a.status] ?? 5) - (order[b.status] ?? 5);
    });
  }, [components]);

  const visibleComponents = sortedComponents.slice(0, maxItems);
  const hiddenCount = Math.max(0, components.length - maxItems);

  // Find the currently enriching component for auto-scroll
  const enrichingIndex = React.useMemo(() =>
    visibleComponents.findIndex(c => c.status === 'enriching'),
    [visibleComponents]
  );

  // Auto-scroll to keep enriching item visible
  React.useEffect(() => {
    if (autoScroll && enrichingItemRef.current && listContainerRef.current) {
      // Scroll the enriching item into view within the container
      enrichingItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
      console.debug('[EnrichmentQueueList] Auto-scrolled to enriching item');
    }
  }, [autoScroll, enrichingIndex]);

  if (components.length === 0) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No components in queue
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 1.5,
          py: 1,
          bgcolor: 'action.hover',
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography variant="body2" fontWeight={600}>
          {title}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {components.length} components
        </Typography>
      </Box>

      {/* List - with ref for auto-scroll */}
      <Box ref={listContainerRef} sx={{ maxHeight: 300, overflow: 'auto' }}>
        {visibleComponents.map((component, index) => (
          <Box
            key={component.id}
            ref={component.status === 'enriching' ? enrichingItemRef : undefined}
            component="div"
          >
            <EnrichmentQueueItem
              component={component}
              index={index}
              showQualityScore={showQualityScore}
            />
          </Box>
        ))}
      </Box>

      {/* Hidden count */}
      {hiddenCount > 0 && (
        <Box
          sx={{
            px: 1.5,
            py: 1,
            bgcolor: 'background.paper',
            borderTop: '1px solid',
            borderColor: 'divider',
            textAlign: 'center',
          }}
        >
          <Typography variant="caption" color="text.secondary">
            +{hiddenCount} more components
          </Typography>
        </Box>
      )}
    </Box>
  );
}

export default EnrichmentQueueItem;
