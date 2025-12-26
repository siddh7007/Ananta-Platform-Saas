/**
 * Service Health Cards Component
 *
 * Displays grid of service health status cards with key metrics
 */

import React from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  LinearProgress,
  CircularProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  CheckCircle,
  Error,
  Warning,
  PowerSettingsNew,
  Speed,
  Memory,
  Router,
  Schedule,
  TrendingUp,
} from '@mui/icons-material';
import { Service, ServiceStatus } from '../../../microservices-lib/types';

interface ServiceHealthCardsProps {
  services: Service[];
  onServiceClick: (serviceId: string) => void;
  loading?: boolean;
}

const getStatusColor = (status: ServiceStatus): string => {
  switch (status) {
    case 'running': return '#4caf50'; // green
    case 'degraded': return '#ff9800'; // yellow/orange
    case 'stopped': return '#9e9e9e'; // gray
    case 'error': return '#f44336'; // red
    default: return '#9e9e9e';
  }
};

const getStatusIcon = (status: ServiceStatus) => {
  switch (status) {
    case 'running': return <CheckCircle sx={{ color: '#4caf50' }} />;
    case 'degraded': return <Warning sx={{ color: '#ff9800' }} />;
    case 'stopped': return <PowerSettingsNew sx={{ color: '#9e9e9e' }} />;
    case 'error': return <Error sx={{ color: '#f44336' }} />;
    default: return <PowerSettingsNew sx={{ color: '#9e9e9e' }} />;
  }
};

const formatUptime = (uptime: number): string => {
  return `${uptime.toFixed(1)}%`;
};

const formatResponseTime = (ms: number): string => {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
};

const formatMemory = (mb: number): string => {
  return mb < 1024 ? `${mb.toFixed(0)}MB` : `${(mb / 1024).toFixed(2)}GB`;
};

const ServiceHealthCards: React.FC<ServiceHealthCardsProps> = ({
  services,
  onServiceClick,
  loading = false,
}) => {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Grid container spacing={3}>
      {services.map((service) => (
        <Grid item xs={12} sm={6} md={4} lg={3} key={service.id}>
          <Card
            sx={{
              bgcolor: '#1a1f2e',
              border: `2px solid ${getStatusColor(service.status)}`,
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: `0 8px 24px ${getStatusColor(service.status)}40`,
              },
            }}
            onClick={() => onServiceClick(service.id)}
          >
            <CardContent>
              {/* Header */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Box>
                  <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600, mb: 0.5 }}>
                    {service.displayName}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#8b92a7' }}>
                    v{service.version}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {getStatusIcon(service.status)}
                  <Chip
                    label={service.environment}
                    size="small"
                    sx={{
                      bgcolor: service.environment === 'prod' ? '#f4433620' : '#4fc3f720',
                      color: service.environment === 'prod' ? '#f44336' : '#4fc3f7',
                      fontWeight: 600,
                      fontSize: '0.7rem',
                    }}
                  />
                </Box>
              </Box>

              {/* Status */}
              <Box sx={{ mb: 2 }}>
                <Typography
                  variant="body2"
                  sx={{
                    color: getStatusColor(service.status),
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    fontSize: '0.75rem',
                    mb: 1,
                  }}
                >
                  {service.status}
                </Typography>
                <Typography variant="caption" sx={{ color: '#8b92a7' }}>
                  Port: {service.port} | {service.endpoint}
                </Typography>
              </Box>

              {/* Metrics */}
              <Box sx={{ mb: 2 }}>
                {/* Uptime */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Schedule sx={{ fontSize: 16, color: '#8b92a7' }} />
                    <Typography variant="caption" sx={{ color: '#8b92a7' }}>
                      Uptime
                    </Typography>
                  </Box>
                  <Typography variant="caption" sx={{ color: '#4caf50', fontWeight: 600 }}>
                    {formatUptime(service.uptime)}
                  </Typography>
                </Box>

                {/* Response Time */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Speed sx={{ fontSize: 16, color: '#8b92a7' }} />
                    <Typography variant="caption" sx={{ color: '#8b92a7' }}>
                      Response
                    </Typography>
                  </Box>
                  <Typography variant="caption" sx={{ color: '#4fc3f7', fontWeight: 600 }}>
                    {formatResponseTime(service.responseTime)}
                  </Typography>
                </Box>

                {/* Requests */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <TrendingUp sx={{ fontSize: 16, color: '#8b92a7' }} />
                    <Typography variant="caption" sx={{ color: '#8b92a7' }}>
                      Req/hr
                    </Typography>
                  </Box>
                  <Typography variant="caption" sx={{ color: '#fff', fontWeight: 600 }}>
                    {service.requestsLastHour.toLocaleString()}
                  </Typography>
                </Box>
              </Box>

              {/* Resource Usage */}
              <Box sx={{ mb: 2 }}>
                {/* CPU */}
                <Box sx={{ mb: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" sx={{ color: '#8b92a7', fontSize: '0.7rem' }}>
                      CPU
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#fff', fontSize: '0.7rem', fontWeight: 600 }}>
                      {service.cpuUsage.toFixed(1)}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={service.cpuUsage}
                    sx={{
                      height: 4,
                      borderRadius: 2,
                      bgcolor: '#0a0e1a',
                      '& .MuiLinearProgress-bar': {
                        bgcolor: service.cpuUsage > 80 ? '#f44336' : service.cpuUsage > 60 ? '#ff9800' : '#4fc3f7',
                      },
                    }}
                  />
                </Box>

                {/* Memory */}
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" sx={{ color: '#8b92a7', fontSize: '0.7rem' }}>
                      Memory
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#fff', fontSize: '0.7rem', fontWeight: 600 }}>
                      {formatMemory(service.memoryUsage)}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={(service.memoryUsage / 2048) * 100} // Assuming 2GB max
                    sx={{
                      height: 4,
                      borderRadius: 2,
                      bgcolor: '#0a0e1a',
                      '& .MuiLinearProgress-bar': {
                        bgcolor: '#9c27b0',
                      },
                    }}
                  />
                </Box>
              </Box>

              {/* Success Rate */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" sx={{ color: '#8b92a7' }}>
                  Success Rate
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: service.successRate > 95 ? '#4caf50' : service.successRate > 90 ? '#ff9800' : '#f44336',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                  }}
                >
                  {service.successRate.toFixed(1)}%
                </Typography>
              </Box>

              {/* Active Connections Indicator */}
              {service.activeConnections > 0 && (
                <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid #2a2f3e' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Router sx={{ fontSize: 14, color: '#4fc3f7' }} />
                    <Typography variant="caption" sx={{ color: '#4fc3f7' }}>
                      {service.activeConnections} active
                      {service.queuedRequests > 0 && ` | ${service.queuedRequests} queued`}
                    </Typography>
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};

export default ServiceHealthCards;
