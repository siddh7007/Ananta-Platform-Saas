/**
 * Service Details Drawer
 *
 * Detailed view of a single service with actions
 */

import React, { useState } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Button,
  Chip,
  Grid,
  Paper,
  Divider,
  List,
  ListItem,
  ListItemText,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import {
  Close,
  RestartAlt,
  PlayArrow,
  Stop,
  BugReport,
  Visibility,
  ContentCopy,
  CheckCircle,
  Schedule,
  Memory,
  Speed,
  TrendingUp,
} from '@mui/icons-material';
import { Service } from '../../../microservices-lib/types';

interface ServiceDetailsProps {
  service: Service;
  open: boolean;
  onClose: () => void;
  onAction: (serviceId: string, action: string) => void;
}

const ServiceDetails: React.FC<ServiceDetailsProps> = ({
  service,
  open,
  onClose,
  onAction,
}) => {
  const [actionDialog, setActionDialog] = useState<string | null>(null);
  const [actionReason, setActionReason] = useState('');

  const handleAction = (action: string) => {
    onAction(service.id, action);
    setActionDialog(null);
    setActionReason('');
  };

  const getStatusColor = () => {
    switch (service.status) {
      case 'running': return '#4caf50';
      case 'degraded': return '#ff9800';
      case 'stopped': return '#9e9e9e';
      case 'error': return '#f44336';
      default: return '#9e9e9e';
    }
  };

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 600 },
            bgcolor: '#0a0e1a',
          },
        }}
      >
        <Box sx={{ p: 3 }}>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
            <Box>
              <Typography variant="h5" sx={{ color: '#fff', fontWeight: 700, mb: 1 }}>
                {service.displayName}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Chip
                  label={service.status}
                  size="small"
                  sx={{
                    bgcolor: `${getStatusColor()}20`,
                    color: getStatusColor(),
                    fontWeight: 600,
                    textTransform: 'uppercase',
                  }}
                />
                <Chip
                  label={service.environment}
                  size="small"
                  sx={{
                    bgcolor: service.environment === 'prod' ? '#f4433620' : '#4fc3f720',
                    color: service.environment === 'prod' ? '#f44336' : '#4fc3f7',
                  }}
                />
                <Chip label={`v${service.version}`} size="small" sx={{ color: '#8b92a7' }} />
              </Box>
            </Box>
            <IconButton onClick={onClose}>
              <Close sx={{ color: '#fff' }} />
            </IconButton>
          </Box>

          {/* Quick Actions */}
          <Paper sx={{ p: 2, mb: 3, bgcolor: '#1a1f2e' }}>
            <Typography variant="subtitle2" sx={{ color: '#fff', mb: 2 }}>
              Quick Actions
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<RestartAlt />}
                onClick={() => setActionDialog('restart')}
                sx={{ color: '#ff9800', borderColor: '#ff9800' }}
              >
                Restart
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={service.status === 'stopped' ? <PlayArrow /> : <Stop />}
                onClick={() => setActionDialog(service.status === 'stopped' ? 'start' : 'stop')}
                sx={{ color: '#4fc3f7', borderColor: '#4fc3f7' }}
              >
                {service.status === 'stopped' ? 'Start' : 'Stop'}
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Visibility />}
                onClick={() => setActionDialog('logs')}
                sx={{ color: '#9c27b0', borderColor: '#9c27b0' }}
              >
                View Logs
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<BugReport />}
                onClick={() => setActionDialog('test')}
                sx={{ color: '#4caf50', borderColor: '#4caf50' }}
              >
                Test Health
              </Button>
            </Box>
          </Paper>

          {/* Service Information */}
          <Paper sx={{ p: 2, mb: 3, bgcolor: '#1a1f2e' }}>
            <Typography variant="subtitle2" sx={{ color: '#fff', mb: 2 }}>
              Service Information
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="caption" sx={{ color: '#8b92a7' }}>Port</Typography>
                <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>
                  {service.port}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" sx={{ color: '#8b92a7' }}>Endpoint</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600, fontSize: '0.75rem' }}>
                    {service.endpoint}
                  </Typography>
                  <IconButton size="small" onClick={() => navigator.clipboard.writeText(service.endpoint)}>
                    <ContentCopy sx={{ fontSize: 14, color: '#8b92a7' }} />
                  </IconButton>
                </Box>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" sx={{ color: '#8b92a7' }}>Docker Container</Typography>
                <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600, fontSize: '0.75rem' }}>
                  {service.dockerContainer}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" sx={{ color: '#8b92a7' }}>Last Deployment</Typography>
                <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600, fontSize: '0.75rem' }}>
                  {new Date(service.lastDeployment).toLocaleDateString()}
                </Typography>
              </Grid>
            </Grid>
          </Paper>

          {/* Health Metrics */}
          <Paper sx={{ p: 2, mb: 3, bgcolor: '#1a1f2e' }}>
            <Typography variant="subtitle2" sx={{ color: '#fff', mb: 2 }}>
              Health Metrics
            </Typography>

            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Schedule sx={{ fontSize: 16, color: '#4caf50' }} />
                  <Typography variant="caption" sx={{ color: '#8b92a7' }}>Uptime</Typography>
                </Box>
                <Typography variant="caption" sx={{ color: '#4caf50', fontWeight: 600 }}>
                  {service.uptime.toFixed(2)}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={service.uptime}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  bgcolor: '#0a0e1a',
                  '& .MuiLinearProgress-bar': { bgcolor: '#4caf50' },
                }}
              />
            </Box>

            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Speed sx={{ fontSize: 16, color: '#4fc3f7' }} />
                  <Typography variant="caption" sx={{ color: '#8b92a7' }}>CPU Usage</Typography>
                </Box>
                <Typography variant="caption" sx={{ color: '#fff', fontWeight: 600 }}>
                  {service.cpuUsage.toFixed(1)}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={service.cpuUsage}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  bgcolor: '#0a0e1a',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: service.cpuUsage > 80 ? '#f44336' : '#4fc3f7',
                  },
                }}
              />
            </Box>

            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Memory sx={{ fontSize: 16, color: '#9c27b0' }} />
                  <Typography variant="caption" sx={{ color: '#8b92a7' }}>Memory Usage</Typography>
                </Box>
                <Typography variant="caption" sx={{ color: '#fff', fontWeight: 600 }}>
                  {service.memoryUsage.toFixed(0)}MB
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={(service.memoryUsage / 2048) * 100}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  bgcolor: '#0a0e1a',
                  '& .MuiLinearProgress-bar': { bgcolor: '#9c27b0' },
                }}
              />
            </Box>

            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={6}>
                <Box sx={{ textAlign: 'center', p: 1, bgcolor: '#0a0e1a', borderRadius: 1 }}>
                  <Typography variant="h6" sx={{ color: '#4fc3f7', fontWeight: 700 }}>
                    {service.responseTime}ms
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#8b92a7' }}>Response Time</Typography>
                </Box>
              </Grid>
              <Grid item xs={6}>
                <Box sx={{ textAlign: 'center', p: 1, bgcolor: '#0a0e1a', borderRadius: 1 }}>
                  <Typography variant="h6" sx={{ color: '#4caf50', fontWeight: 700 }}>
                    {service.successRate.toFixed(1)}%
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#8b92a7' }}>Success Rate</Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>

          {/* API Statistics */}
          <Paper sx={{ p: 2, mb: 3, bgcolor: '#1a1f2e' }}>
            <Typography variant="subtitle2" sx={{ color: '#fff', mb: 2 }}>
              API Statistics
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#0a0e1a', borderRadius: 1 }}>
                  <TrendingUp sx={{ color: '#4fc3f7', fontSize: 32, mb: 1 }} />
                  <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>
                    {service.requestsLastHour.toLocaleString()}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#8b92a7' }}>Requests (1h)</Typography>
                </Box>
              </Grid>
              <Grid item xs={6}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#0a0e1a', borderRadius: 1 }}>
                  <CheckCircle sx={{ color: '#4caf50', fontSize: 32, mb: 1 }} />
                  <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>
                    {service.totalRequests.toLocaleString()}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#8b92a7' }}>Total Requests</Typography>
                </Box>
              </Grid>
            </Grid>

            <Divider sx={{ my: 2, borderColor: '#2a2f3e' }} />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="caption" sx={{ color: '#8b92a7' }}>Active Connections</Typography>
              <Typography variant="caption" sx={{ color: '#fff', fontWeight: 600 }}>
                {service.activeConnections}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="caption" sx={{ color: '#8b92a7' }}>Queued Requests</Typography>
              <Typography variant="caption" sx={{ color: '#ff9800', fontWeight: 600 }}>
                {service.queuedRequests}
              </Typography>
            </Box>
          </Paper>

          {/* Dependencies */}
          {(service.dependencies.length > 0 || service.dependents.length > 0) && (
            <Paper sx={{ p: 2, bgcolor: '#1a1f2e' }}>
              <Typography variant="subtitle2" sx={{ color: '#fff', mb: 2 }}>
                Dependencies
              </Typography>

              {service.dependencies.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" sx={{ color: '#8b92a7', display: 'block', mb: 1 }}>
                    Depends On:
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {service.dependencies.map(dep => (
                      <Chip key={dep} label={dep} size="small" sx={{ bgcolor: '#4fc3f720', color: '#4fc3f7' }} />
                    ))}
                  </Box>
                </Box>
              )}

              {service.dependents.length > 0 && (
                <Box>
                  <Typography variant="caption" sx={{ color: '#8b92a7', display: 'block', mb: 1 }}>
                    Used By:
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {service.dependents.map(dep => (
                      <Chip key={dep} label={dep} size="small" sx={{ bgcolor: '#9c27b020', color: '#9c27b0' }} />
                    ))}
                  </Box>
                </Box>
              )}
            </Paper>
          )}
        </Box>
      </Drawer>

      {/* Action Confirmation Dialog */}
      <Dialog
        open={!!actionDialog}
        onClose={() => setActionDialog(null)}
        PaperProps={{ sx: { bgcolor: '#1a1f2e' } }}
      >
        <DialogTitle sx={{ color: '#fff' }}>
          Confirm {actionDialog?.charAt(0).toUpperCase()}{actionDialog?.slice(1)} Service
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: '#8b92a7', mb: 2 }}>
            Are you sure you want to {actionDialog} {service.displayName}?
          </Typography>
          <TextField
            fullWidth
            label="Reason (optional)"
            multiline
            rows={3}
            value={actionReason}
            onChange={(e) => setActionReason(e.target.value)}
            sx={{
              '& .MuiInputBase-root': { color: '#fff', bgcolor: '#0a0e1a' },
              '& .MuiInputLabel-root': { color: '#8b92a7' },
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActionDialog(null)} sx={{ color: '#8b92a7' }}>
            Cancel
          </Button>
          <Button
            onClick={() => actionDialog && handleAction(actionDialog)}
            variant="contained"
            sx={{
              bgcolor: '#4fc3f7',
              '&:hover': { bgcolor: '#039be5' },
            }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ServiceDetails;
