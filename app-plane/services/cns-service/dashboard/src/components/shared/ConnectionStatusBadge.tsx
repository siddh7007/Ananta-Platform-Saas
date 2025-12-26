/**
 * ConnectionStatusBadge - Live connection status indicator
 *
 * Shows real-time connection status with pulsing animation when live.
 * Displays "Last updated" timestamp when disconnected.
 */
import React from 'react';
import { Box, Chip, Tooltip, Typography } from '@mui/material';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

/**
 * Format a date as relative time (e.g., "2 minutes ago")
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return 'just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  }
}

export interface ConnectionStatusBadgeProps {
  /** Whether the connection is active and healthy */
  isConnected: boolean;
  /** Number of consecutive failures (optional, for tooltip details) */
  failureCount?: number;
  /** Timestamp of last successful update (optional) */
  lastUpdate?: Date | null;
  /** Whether data is actively being polled (shows pulsing animation) */
  isPolling?: boolean;
  /** Custom label (default: "Live" / "Connection Lost") */
  label?: string;
  /** Size variant */
  size?: 'small' | 'medium';
}

export const ConnectionStatusBadge: React.FC<ConnectionStatusBadgeProps> = ({
  isConnected,
  failureCount = 0,
  lastUpdate,
  isPolling = false,
  label,
  size = 'small',
}) => {
  // Determine label
  const displayLabel = label || (isConnected ? 'Live' : 'Connection Lost');

  // Determine color
  const color = isConnected ? 'success' : 'error';

  // Build tooltip content
  const tooltipContent = (
    <Box>
      <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
        {isConnected ? 'Live Connection' : 'Connection Lost'}
      </Typography>
      {!isConnected && failureCount > 0 && (
        <Typography variant="caption" display="block">
          Failed {failureCount} consecutive attempts
        </Typography>
      )}
      {lastUpdate && (
        <Typography variant="caption" display="block">
          Last updated: {formatRelativeTime(lastUpdate)}
        </Typography>
      )}
      {isConnected && isPolling && (
        <Typography variant="caption" display="block">
          Polling for updates...
        </Typography>
      )}
    </Box>
  );

  // Pulsing animation for live indicator
  const pulseAnimation = isConnected && isPolling
    ? {
        '@keyframes pulse': {
          '0%': {
            opacity: 1,
          },
          '50%': {
            opacity: 0.5,
          },
          '100%': {
            opacity: 1,
          },
        },
        animation: 'pulse 2s ease-in-out infinite',
      }
    : {};

  return (
    <Tooltip title={tooltipContent} arrow placement="bottom">
      <Chip
        icon={
          isConnected ? (
            <FiberManualRecordIcon
              sx={{
                fontSize: size === 'small' ? 12 : 16,
                ...pulseAnimation,
              }}
            />
          ) : (
            <ErrorOutlineIcon
              sx={{
                fontSize: size === 'small' ? 14 : 18,
              }}
            />
          )
        }
        label={displayLabel}
        color={color}
        size={size}
        variant="outlined"
        sx={{
          fontWeight: 600,
          cursor: 'help',
          '& .MuiChip-icon': {
            marginLeft: size === 'small' ? '4px' : '6px',
          },
        }}
        aria-live="polite"
        aria-label={`Connection status: ${isConnected ? 'connected' : 'disconnected'}`}
      />
    </Tooltip>
  );
};

export default ConnectionStatusBadge;
