/**
 * Alert Center Component
 *
 * Displays and manages system alerts
 */

import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
} from '@mui/material';
import {
  ExpandMore,
  CheckCircle,
  NotificationsActive,
  Error,
  Warning,
  Info,
} from '@mui/icons-material';
import { Alert, AlertSeverity } from '../../../microservices-lib/types';

interface AlertCenterProps {
  alerts: Alert[];
  onAcknowledge: (alertId: string) => void;
}

const getSeverityColor = (severity: AlertSeverity): string => {
  switch (severity) {
    case 'info': return '#4fc3f7';
    case 'warning': return '#ff9800';
    case 'error': return '#f44336';
    case 'critical': return '#d32f2f';
    default: return '#9e9e9e';
  }
};

const getSeverityIcon = (severity: AlertSeverity) => {
  switch (severity) {
    case 'info': return <Info />;
    case 'warning': return <Warning />;
    case 'error': return <Error />;
    case 'critical': return <NotificationsActive />;
    default: return <Info />;
  }
};

const AlertCenter: React.FC<AlertCenterProps> = ({ alerts, onAcknowledge }) => {
  const unacknowledgedAlerts = alerts.filter(a => !a.acknowledged);
  const acknowledgedAlerts = alerts.filter(a => a.acknowledged);

  const renderAlert = (alert: Alert) => (
    <Accordion
      key={alert.id}
      sx={{
        bgcolor: '#1a1f2e',
        borderLeft: `4px solid ${getSeverityColor(alert.severity)}`,
        mb: 1,
        '&:before': { display: 'none' },
      }}
    >
      <AccordionSummary expandIcon={<ExpandMore sx={{ color: '#fff' }} />}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
          <Box sx={{ color: getSeverityColor(alert.severity) }}>
            {getSeverityIcon(alert.severity)}
          </Box>

          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 600 }}>
              {alert.title}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
              <Chip
                label={alert.serviceName}
                size="small"
                sx={{ bgcolor: '#4fc3f720', color: '#4fc3f7', fontSize: '0.7rem' }}
              />
              <Chip
                label={alert.severity}
                size="small"
                sx={{
                  bgcolor: `${getSeverityColor(alert.severity)}20`,
                  color: getSeverityColor(alert.severity),
                  fontSize: '0.7rem',
                  fontWeight: 600,
                }}
              />
              <Typography variant="caption" sx={{ color: '#8b92a7', alignSelf: 'center' }}>
                {new Date(alert.timestamp).toLocaleString()}
              </Typography>
            </Box>
          </Box>

          {!alert.acknowledged && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<CheckCircle />}
              onClick={(e) => {
                e.stopPropagation();
                onAcknowledge(alert.id);
              }}
              sx={{
                color: '#4caf50',
                borderColor: '#4caf50',
                '&:hover': { bgcolor: '#4caf5020', borderColor: '#4caf50' },
              }}
            >
              Acknowledge
            </Button>
          )}
        </Box>
      </AccordionSummary>

      <AccordionDetails sx={{ bgcolor: '#0a0e1a' }}>
        <Typography variant="body2" sx={{ color: '#fff', mb: 2 }}>
          {alert.message}
        </Typography>

        {alert.acknowledged && (
          <Box sx={{ pt: 2, borderTop: '1px solid #2a2f3e' }}>
            <Typography variant="caption" sx={{ color: '#8b92a7' }}>
              Acknowledged by {alert.acknowledgedBy} at {new Date(alert.acknowledgedAt!).toLocaleString()}
            </Typography>
          </Box>
        )}
      </AccordionDetails>
    </Accordion>
  );

  return (
    <Box>
      {/* Summary */}
      <Paper sx={{ p: 3, mb: 3, bgcolor: '#1a1f2e' }}>
        <Typography variant="h6" sx={{ color: '#fff', mb: 2 }}>
          Alert Summary
        </Typography>
        <Box sx={{ display: 'flex', gap: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ color: '#f44336', fontWeight: 700 }}>
              {unacknowledgedAlerts.filter(a => a.severity === 'critical').length}
            </Typography>
            <Typography variant="caption" sx={{ color: '#8b92a7' }}>
              Critical
            </Typography>
          </Box>
          <Box>
            <Typography variant="h4" sx={{ color: '#ff9800', fontWeight: 700 }}>
              {unacknowledgedAlerts.filter(a => a.severity === 'error').length}
            </Typography>
            <Typography variant="caption" sx={{ color: '#8b92a7' }}>
              Errors
            </Typography>
          </Box>
          <Box>
            <Typography variant="h4" sx={{ color: '#4fc3f7', fontWeight: 700 }}>
              {unacknowledgedAlerts.filter(a => a.severity === 'warning').length}
            </Typography>
            <Typography variant="caption" sx={{ color: '#8b92a7' }}>
              Warnings
            </Typography>
          </Box>
          <Box>
            <Typography variant="h4" sx={{ color: '#8b92a7', fontWeight: 700 }}>
              {acknowledgedAlerts.length}
            </Typography>
            <Typography variant="caption" sx={{ color: '#8b92a7' }}>
              Acknowledged
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Active Alerts */}
      <Typography variant="h6" sx={{ color: '#fff', mb: 2 }}>
        Active Alerts ({unacknowledgedAlerts.length})
      </Typography>
      {unacknowledgedAlerts.length === 0 ? (
        <Paper sx={{ p: 4, bgcolor: '#1a1f2e', textAlign: 'center' }}>
          <CheckCircle sx={{ fontSize: 48, color: '#4caf50', mb: 2 }} />
          <Typography variant="h6" sx={{ color: '#4caf50' }}>
            No Active Alerts
          </Typography>
          <Typography variant="body2" sx={{ color: '#8b92a7', mt: 1 }}>
            All systems operating normally
          </Typography>
        </Paper>
      ) : (
        unacknowledgedAlerts.map(alert => renderAlert(alert))
      )}

      {/* Acknowledged Alerts */}
      {acknowledgedAlerts.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" sx={{ color: '#fff', mb: 2 }}>
            Acknowledged Alerts ({acknowledgedAlerts.length})
          </Typography>
          {acknowledgedAlerts.slice(0, 10).map(alert => renderAlert(alert))}
        </Box>
      )}
    </Box>
  );
};

export default AlertCenter;
