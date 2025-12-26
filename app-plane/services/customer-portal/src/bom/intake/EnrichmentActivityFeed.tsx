/**
 * EnrichmentActivityFeed Component
 *
 * Shows a live feed of enrichment and analysis events.
 * Events include: started, progress, component completed/failed, analysis started/completed.
 */

import React from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import type { EnrichmentEvent } from '../../hooks/useEnrichmentQueue';

interface EnrichmentActivityFeedProps {
  events: EnrichmentEvent[];
  maxItems?: number;
  title?: string;
}

/**
 * Get icon and color for event type
 */
function getEventIcon(eventType: string) {
  switch (eventType) {
    case 'enrichment.started':
      return { icon: <PlayArrowIcon />, color: 'primary.main' };
    case 'enrichment.progress':
      return { icon: <AutorenewIcon />, color: 'info.main' };
    case 'enrichment.component.completed':
      return { icon: <CheckCircleIcon />, color: 'success.main' };
    case 'enrichment.component.failed':
      return { icon: <ErrorIcon />, color: 'error.main' };
    case 'enrichment.component.not_found':
      return { icon: <SearchOffIcon />, color: 'warning.main' };
    case 'enrichment.completed':
      return { icon: <DoneAllIcon />, color: 'success.main' };
    case 'enrichment.failed':
      return { icon: <ErrorIcon />, color: 'error.main' };
    case 'risk_analysis_started':
      return { icon: <AnalyticsIcon />, color: 'info.main' };
    case 'risk_analysis_completed':
      return { icon: <AnalyticsIcon />, color: 'success.main' };
    case 'risk_analysis_failed':
      return { icon: <AnalyticsIcon />, color: 'error.main' };
    default:
      return { icon: <AutorenewIcon />, color: 'action.disabled' };
  }
}

/**
 * Get human-readable event label
 */
function getEventLabel(eventType: string): string {
  switch (eventType) {
    case 'enrichment.started':
      return 'Enrichment Started';
    case 'enrichment.progress':
      return 'Progress Update';
    case 'enrichment.component.completed':
      return 'Component Enriched';
    case 'enrichment.component.failed':
      return 'Component Failed';
    case 'enrichment.component.not_found':
      return 'Component Not Found';
    case 'enrichment.completed':
      return 'Enrichment Completed';
    case 'enrichment.failed':
      return 'Enrichment Failed';
    case 'risk_analysis_started':
      return 'Analysis Started';
    case 'risk_analysis_completed':
      return 'Analysis Completed';
    case 'risk_analysis_failed':
      return 'Analysis Failed';
    default:
      return eventType;
  }
}

/**
 * Get event description from payload
 */
function getEventDescription(event: EnrichmentEvent): string {
  const { event_type, payload, state } = event;

  switch (event_type) {
    case 'enrichment.started':
      return `Starting enrichment of ${state?.total_items || 0} components`;
    case 'enrichment.progress':
      return `${state?.enriched_items || 0}/${state?.total_items || 0} enriched (${state?.percent_complete?.toFixed(0) || 0}%)`;
    case 'enrichment.component.completed':
      return payload?.component?.mpn || 'Component enriched';
    case 'enrichment.component.failed':
      return `${payload?.component?.mpn || 'Component'}: ${payload?.error || 'Failed'}`;
    case 'enrichment.component.not_found':
      return `${payload?.component?.mpn || 'Component'} not found in suppliers`;
    case 'enrichment.completed':
      return `Completed: ${state?.enriched_items || 0} enriched, ${state?.failed_items || 0} failed`;
    case 'enrichment.failed':
      return payload?.error || 'Enrichment failed';
    case 'risk_analysis_started':
      return `Analyzing ${payload?.total_items || state?.total_items || 0} components`;
    case 'risk_analysis_completed':
      return `Analysis complete${payload?.risk_score ? ` - Score: ${payload.risk_score}` : ''}`;
    case 'risk_analysis_failed':
      return payload?.error || 'Analysis failed';
    default:
      return '';
  }
}

export function EnrichmentActivityFeed({
  events,
  maxItems = 20,
  title = 'Activity Feed',
}: EnrichmentActivityFeedProps) {
  // Sort events by created_at descending (newest first)
  const sortedEvents = [...events]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, maxItems);

  if (sortedEvents.length === 0) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No activity yet
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
        <Chip label={`${events.length} events`} size="small" variant="outlined" />
      </Box>

      {/* Events List */}
      <List sx={{ maxHeight: 300, overflow: 'auto', py: 0 }}>
        {sortedEvents.map((event, index) => {
          const { icon, color } = getEventIcon(event.event_type);
          const label = getEventLabel(event.event_type);
          const description = getEventDescription(event);
          const time = new Date(event.created_at).toLocaleTimeString();

          return (
            <ListItem
              key={event.event_id || index}
              sx={{
                py: 0.5,
                px: 1.5,
                borderBottom: index < sortedEvents.length - 1 ? '1px solid' : 'none',
                borderColor: 'divider',
              }}
            >
              <ListItemIcon sx={{ minWidth: 32, color }}>
                {React.cloneElement(icon, { sx: { fontSize: 18 } })}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" fontWeight={500}>
                      {label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {time}
                    </Typography>
                  </Box>
                }
                secondary={
                  description && (
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {description}
                    </Typography>
                  )
                }
                sx={{ my: 0 }}
              />
            </ListItem>
          );
        })}
      </List>
    </Box>
  );
}

export default EnrichmentActivityFeed;
