'use client';

/**
 * Microservices Monitoring Dashboard
 *
 * Comprehensive monitoring and management interface for all platform microservices
 * Features:
 * - Real-time service health monitoring
 * - API metrics and performance tracking
 * - Service dependency visualization
 * - Logs and alerts
 * - Quick actions for service management
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Grid,
  Typography,
  Paper,
  Tab,
  Tabs,
  Alert,
  Snackbar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
} from '@mui/material';
import { RefreshRounded, NotificationsActive } from '@mui/icons-material';
import ServiceHealthCards from '../../components/microservices-components/components/ServiceHealthCards';
import MetricsCharts from '../../components/microservices-components/components/MetricsCharts';
import ServiceDependencyMap from '../../components/microservices-components/components/ServiceDependencyMap';
import LogsFeed from '../../components/microservices-components/components/LogsFeed';
import AlertCenter from '../../components/microservices-components/components/AlertCenter';
import ServiceDetails from '../../components/microservices-components/components/ServiceDetails';
import { useRealMicroservicesData } from '../../microservices-lib/hooks/useRealMicroservicesData';
import { ServiceStatus } from '../../microservices-lib/types';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div role="tabpanel" hidden={value !== index}>
    {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
  </div>
);

const MicroservicesDashboard: React.FC = () => {
  const [currentTab, setCurrentTab] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(10);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertSeverity, setAlertSeverity] = useState<'success' | 'error' | 'warning' | 'info'>('info');

  const {
    services,
    metrics,
    logs,
    alerts,
    systemHealth,
    loading,
    error,
    refreshData,
  } = useRealMicroservicesData(autoRefresh, refreshInterval);

  useEffect(() => {
    // Check for critical alerts
    const criticalAlerts = alerts.filter(a => a.severity === 'critical' && !a.acknowledged);
    if (criticalAlerts.length > 0) {
      setAlertMessage(`${criticalAlerts.length} critical alert(s) detected!`);
      setAlertSeverity('error');
      setAlertOpen(true);
    }
  }, [alerts]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const handleServiceClick = (serviceId: string) => {
    setSelectedService(serviceId);
  };

  const handleCloseServiceDetails = () => {
    setSelectedService(null);
  };

  const handleServiceAction = async (serviceId: string, action: string) => {
    try {
      const response = await fetch(`/api/microservices/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId }),
      });

      const result = await response.json();

      if (response.ok) {
        setAlertMessage(result.message || `${action} completed for ${serviceId}`);
        setAlertSeverity('success');
      } else {
        setAlertMessage(result.message || `Failed to ${action} ${serviceId}`);
        setAlertSeverity('error');
      }
      setAlertOpen(true);

      // Refresh data after action
      setTimeout(() => refreshData(), 2000);
    } catch (err) {
      setAlertMessage(`Failed to ${action} ${serviceId}: ${err}`);
      setAlertSeverity('error');
      setAlertOpen(true);
    }
  };

  return (
    <Container maxWidth={false} sx={{ py: 4, bgcolor: '#0a0e1a', minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h3" sx={{ color: '#fff', fontWeight: 700, mb: 1 }}>
            Microservices Dashboard
          </Typography>
          <Typography variant="body1" sx={{ color: '#8b92a7' }}>
            System Health: {systemHealth.status} |
            {' '}{systemHealth.healthyServices}/{systemHealth.totalServices} services running |
            {' '}Score: {systemHealth.healthScore}%
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControlLabel
            control={
              <Switch
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                color="primary"
              />
            }
            label={<Typography sx={{ color: '#fff' }}>Auto-refresh</Typography>}
          />

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel sx={{ color: '#8b92a7' }}>Interval</InputLabel>
            <Select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              label="Interval"
              sx={{ color: '#fff', bgcolor: '#1a1f2e' }}
              disabled={!autoRefresh}
            >
              <MenuItem value={10}>10s</MenuItem>
              <MenuItem value={30}>30s</MenuItem>
              <MenuItem value={60}>1min</MenuItem>
            </Select>
          </FormControl>

          <RefreshRounded
            onClick={refreshData}
            sx={{ color: '#4fc3f7', cursor: 'pointer', fontSize: 32 }}
          />
        </Box>
      </Box>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <Paper sx={{ bgcolor: '#1a1f2e', mb: 3 }}>
        <Tabs
          value={currentTab}
          onChange={handleTabChange}
          sx={{
            '& .MuiTab-root': { color: '#8b92a7' },
            '& .Mui-selected': { color: '#4fc3f7' },
            '& .MuiTabs-indicator': { bgcolor: '#4fc3f7' },
          }}
        >
          <Tab label="Overview" />
          <Tab label="Metrics & Charts" />
          <Tab label="Dependencies" />
          <Tab label="Logs" />
          <Tab label="Alerts" />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      <TabPanel value={currentTab} index={0}>
        <Grid container spacing={3}>
          {/* Service Health Cards */}
          <Grid item xs={12}>
            <ServiceHealthCards
              services={services}
              onServiceClick={handleServiceClick}
              loading={loading}
            />
          </Grid>

          {/* Quick Metrics */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, bgcolor: '#1a1f2e' }}>
              <Typography variant="h6" sx={{ color: '#fff', mb: 2 }}>
                Request Rate (Last Hour)
              </Typography>
              <MetricsCharts
                data={metrics.requestRate}
                type="line"
                height={200}
              />
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, bgcolor: '#1a1f2e' }}>
              <Typography variant="h6" sx={{ color: '#fff', mb: 2 }}>
                Error Rate Trend
              </Typography>
              <MetricsCharts
                data={metrics.errorRate}
                type="area"
                height={200}
              />
            </Paper>
          </Grid>

          {/* Recent Logs */}
          <Grid item xs={12}>
            <Paper sx={{ p: 3, bgcolor: '#1a1f2e' }}>
              <Typography variant="h6" sx={{ color: '#fff', mb: 2 }}>
                Recent Activity
              </Typography>
              <LogsFeed logs={logs.slice(0, 10)} compact />
            </Paper>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={currentTab} index={1}>
        <MetricsCharts
          data={metrics}
          services={services}
          fullView
        />
      </TabPanel>

      <TabPanel value={currentTab} index={2}>
        <ServiceDependencyMap services={services} />
      </TabPanel>

      <TabPanel value={currentTab} index={3}>
        <LogsFeed logs={logs} />
      </TabPanel>

      <TabPanel value={currentTab} index={4}>
        <AlertCenter
          alerts={alerts}
          onAcknowledge={(id) => console.log('Acknowledge', id)}
        />
      </TabPanel>

      {/* Service Details Drawer */}
      {selectedService && (
        <ServiceDetails
          service={services.find(s => s.id === selectedService)!}
          open={!!selectedService}
          onClose={handleCloseServiceDetails}
          onAction={handleServiceAction}
        />
      )}

      {/* Alert Snackbar */}
      <Snackbar
        open={alertOpen}
        autoHideDuration={6000}
        onClose={() => setAlertOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert severity={alertSeverity} onClose={() => setAlertOpen(false)}>
          {alertMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default MicroservicesDashboard;
