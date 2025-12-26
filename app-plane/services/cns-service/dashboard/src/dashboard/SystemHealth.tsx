/**
 * SystemHealth - Service status, Temporal queue depth, Redis health
 */
import React from 'react';
import { Card, CardContent, Typography, Box, List, ListItem, ListItemIcon, ListItemText } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import StorageIcon from '@mui/icons-material/Storage';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import MemoryIcon from '@mui/icons-material/Memory';
import DataObjectIcon from '@mui/icons-material/DataObject';
import { enrichmentStatusColors, alertSeverityColors } from '../theme';

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  details?: string;
}

export interface SystemHealthProps {
  services?: ServiceHealth[];
  loading?: boolean;
}

const defaultServices: ServiceHealth[] = [
  { name: 'CNS API', status: 'healthy', details: 'Port 27800' },
  { name: 'Temporal', status: 'healthy', details: 'Port 7233' },
  { name: 'Redis', status: 'healthy', details: 'Port 6379' },
  { name: 'PostgreSQL', status: 'healthy', details: 'Port 5432' },
];

const serviceIcons: Record<string, React.ReactNode> = {
  'CNS API': <DataObjectIcon />,
  'Temporal': <CloudQueueIcon />,
  'Redis': <MemoryIcon />,
  'PostgreSQL': <StorageIcon />,
};

const statusConfig: Record<string, { icon: React.ReactNode; color: string }> = {
  healthy: { icon: <CheckCircleIcon fontSize="small" />, color: enrichmentStatusColors.completed },
  degraded: { icon: <WarningIcon fontSize="small" />, color: alertSeverityColors.warning },
  down: { icon: <ErrorIcon fontSize="small" />, color: alertSeverityColors.error },
};

export const SystemHealth: React.FC<SystemHealthProps> = ({
  services = defaultServices,
}) => {
  return (
    <Card elevation={2} sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
          System Health
        </Typography>
        <List dense disablePadding>
          {services.map((service, index) => {
            const config = statusConfig[service.status];
            return (
              <ListItem
                key={index}
                disableGutters
                sx={{ py: 0.75 }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: 'action.active' }}>
                  {serviceIcons[service.name] || <StorageIcon />}
                </ListItemIcon>
                <ListItemText
                  primary={service.name}
                  secondary={service.details}
                  primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
                <Box sx={{ color: config.color, display: 'flex', alignItems: 'center' }}>
                  {config.icon}
                </Box>
              </ListItem>
            );
          })}
        </List>
      </CardContent>
    </Card>
  );
};

export default SystemHealth;
