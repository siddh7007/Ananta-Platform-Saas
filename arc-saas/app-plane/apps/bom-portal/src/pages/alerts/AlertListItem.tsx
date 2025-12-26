/**
 * AlertListItem Component
 *
 * Individual alert item for display in the alert list.
 * Shows alert type, severity, message, and action buttons.
 */

import React from 'react';
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Badge,
  Checkbox,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoIcon from '@mui/icons-material/Info';
import HistoryIcon from '@mui/icons-material/History';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import InventoryIcon from '@mui/icons-material/Inventory';
import GavelIcon from '@mui/icons-material/Gavel';
import ArticleIcon from '@mui/icons-material/Article';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import { alertTypeColors } from '../../theme';
import type { Alert, AlertType, AlertSeverity } from '../../services/alertService';

interface AlertListItemProps {
  alert: Alert;
  onMarkAsRead: (alertId: string) => void;
  onDismiss: (alertId: string) => void;
  selected?: boolean;
  onSelect?: (alertId: string, selected: boolean) => void;
  onClick?: (alert: Alert) => void;
  showCheckbox?: boolean;
}

// Alert type icons and colors
const ALERT_TYPE_CONFIG: Record<AlertType, { icon: React.ReactNode; label: string; color: string }> = {
  LIFECYCLE: { icon: <HistoryIcon />, label: 'Lifecycle', color: alertTypeColors.LIFECYCLE },
  RISK: { icon: <TrendingUpIcon />, label: 'Risk Score', color: alertTypeColors.RISK },
  PRICE: { icon: <AttachMoneyIcon />, label: 'Price Change', color: alertTypeColors.PRICE },
  AVAILABILITY: { icon: <InventoryIcon />, label: 'Availability', color: alertTypeColors.AVAILABILITY },
  COMPLIANCE: { icon: <GavelIcon />, label: 'Compliance', color: alertTypeColors.COMPLIANCE },
  PCN: { icon: <ArticleIcon />, label: 'PCN/PDN', color: alertTypeColors.PCN },
  SUPPLY_CHAIN: { icon: <LocalShippingIcon />, label: 'Supply Chain', color: alertTypeColors.SUPPLY_CHAIN },
};

const SEVERITY_CONFIG: Record<AlertSeverity, { icon: React.ReactNode; color: 'info' | 'warning' | 'error' }> = {
  info: { icon: <InfoIcon />, color: 'info' },
  warning: { icon: <WarningIcon />, color: 'warning' },
  critical: { icon: <ErrorIcon />, color: 'error' },
};

/**
 * Format relative time string
 */
function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function AlertListItem({
  alert,
  onMarkAsRead,
  onDismiss,
  selected = false,
  onSelect,
  onClick,
  showCheckbox = false,
}: AlertListItemProps) {
  const typeConfig = ALERT_TYPE_CONFIG[alert.alert_type];
  const severityConfig = SEVERITY_CONFIG[alert.severity];

  const handleClick = (e: React.MouseEvent) => {
    // Don't trigger click when clicking on checkbox or action buttons
    if ((e.target as HTMLElement).closest('button, input[type="checkbox"]')) {
      return;
    }
    onClick?.(alert);
  };

  return (
    <ListItem
      onClick={handleClick}
      sx={{
        bgcolor: selected ? 'primary.50' : alert.is_read ? 'transparent' : 'action.hover',
        borderLeft: '4px solid',
        borderColor: typeConfig?.color || 'action.disabled',
        mb: 1,
        borderRadius: 1,
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': onClick ? { bgcolor: selected ? 'primary.100' : 'action.selected' } : {},
      }}
    >
      {showCheckbox && (
        <Checkbox
          checked={selected}
          onChange={(e) => onSelect?.(alert.id, e.target.checked)}
          onClick={(e) => e.stopPropagation()}
          size="small"
          sx={{ mr: 1 }}
        />
      )}
      <ListItemIcon>
        <Badge
          color={severityConfig.color}
          variant="dot"
          invisible={alert.is_read}
        >
          {React.cloneElement(typeConfig?.icon as React.ReactElement, {
            sx: { color: typeConfig?.color },
          })}
        </Badge>
      </ListItemIcon>

      <ListItemText
        primary={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body1" fontWeight={alert.is_read ? 400 : 600}>
              {alert.title}
            </Typography>
            <Chip
              label={typeConfig?.label}
              size="small"
              sx={{
                bgcolor: typeConfig?.color,
                color: 'white',
                fontSize: '0.65rem',
                height: 18,
              }}
            />
            <Chip
              label={alert.severity}
              size="small"
              color={severityConfig.color}
              sx={{ fontSize: '0.65rem', height: 18 }}
            />
          </Box>
        }
        secondary={
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {alert.message}
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, mt: 1, alignItems: 'center' }}>
              {alert.mpn && (
                <Typography variant="caption" color="text.secondary">
                  MPN: <strong>{alert.mpn}</strong>
                </Typography>
              )}
              {alert.manufacturer && (
                <Typography variant="caption" color="text.secondary">
                  Mfr: {alert.manufacturer}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary">
                {formatTimeAgo(alert.created_at)}
              </Typography>
            </Box>
          </Box>
        }
      />

      <ListItemSecondaryAction>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {!alert.is_read && (
            <Tooltip title="Mark as read">
              <IconButton
                size="small"
                onClick={() => onMarkAsRead(alert.id)}
              >
                <CheckCircleIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Dismiss">
            <IconButton
              size="small"
              onClick={() => onDismiss(alert.id)}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {alert.component_id && (
            <Tooltip title="View Component">
              <IconButton
                size="small"
                component={RouterLink}
                to={`/components/${alert.component_id}/show`}
              >
                <InfoIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </ListItemSecondaryAction>
    </ListItem>
  );
}

export default AlertListItem;
