/**
 * Unified Admin Dashboard
 *
 * Combines:
 * - System health overview (Docker SDK)
 * - Quick access to all 35+ services
 * - Container statistics
 * - Category-based service grouping
 */

import React, { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Grid,
  Typography,
  Box,
  LinearProgress,
  Chip,
  Button,
  Alert,
  Divider,
  Paper
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Speed as SpeedIcon,
  Memory as MemoryIcon,
  CheckCircle as HealthyIcon,
  Error as UnhealthyIcon,
  PlayArrow as RunningIcon,
  Stop as StoppedIcon,
  Link as LinkIcon
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { services, getServiceStats, categoryMetadata } from '../config/services';
import { fetchHealthSummary } from '../providers/dockerDataProvider';

interface HealthSummary {
  total: number;
  running: number;
  stopped: number;
  healthy: number;
  unhealthy: number;
  operational_percentage: number;
  timestamp: string;
  containers: Array<{
    name: string;
    running: boolean;
    healthy: boolean;
    health: string;
  }>;
}

interface ServiceStats {
  total: number;
  byCategory: Record<string, number>;
}

/**
 * Stat Card Component
 */
const StatCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
}> = ({ title, value, icon, color, subtitle }) => (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography color="text.secondary" variant="caption" sx={{ fontWeight: 600 }}>
            {title}
          </Typography>
          <Typography variant="h3" sx={{ mt: 1, fontWeight: 700, color }}>
            {value}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        <Box
          sx={{
            backgroundColor: `${color}10`, // Lower opacity for cleaner look
            borderRadius: 1, // Sharper corners
            p: 1.5,
            color,
            border: `1px solid ${color}20` // Subtle border
          }}
        >
          {icon}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

/**
 * Health Progress Bar
 */
const HealthBar: React.FC<{ percentage: number }> = ({ percentage }) => {
  const getColor = () => {
    if (percentage === 100) return 'success';
    if (percentage >= 80) return 'info';
    if (percentage >= 50) return 'warning';
    return 'error';
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="body2" color="text.secondary">
          System Health
        </Typography>
        <Typography variant="body2" fontWeight={600}>
          {percentage}%
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={percentage}
        color={getColor()}
        sx={{ height: 8, borderRadius: 1 }}
      />
    </Box>
  );
};

/**
 * Service Category Card
 */
const ServiceCategoryCard: React.FC<{ category: string; count: number }> = ({ category, count }) => {
  const metadata = categoryMetadata[category];

  return (
    <Link to={`/platform-services?filter=${JSON.stringify({ category })}`} style={{ textDecoration: 'none' }}>
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          cursor: 'pointer',
          transition: 'all 0.2s',
          '&:hover': {
            borderColor: 'text.primary',
            backgroundColor: 'action.hover'
          }
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              {metadata.icon} {metadata.label}
            </Typography>
            <Typography variant="h4" fontWeight={700} sx={{ mt: 0.5 }}>
              {count}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '10px' }}>
            services
          </Typography>
        </Box>
      </Paper>
    </Link>
  );
};

/**
 * Quick Access Service Card
 */
const QuickServiceCard: React.FC<{ service: typeof services[0] }> = ({ service }) => {
  const openService = () => {
    if (service.url.startsWith('http')) {
      window.open(service.url, '_blank', 'noopener');
    }
  };

  return (
    <Card
      variant="outlined"
      sx={{
        cursor: service.url.startsWith('http') ? 'pointer' : 'default',
        transition: 'all 0.2s',
        '&:hover': service.url.startsWith('http') ? {
          borderColor: 'text.primary',
          backgroundColor: 'action.hover'
        } : {}
      }}
      onClick={openService}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
          <Typography sx={{ fontSize: '32px', mr: 1.5 }}>{service.icon}</Typography>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" fontWeight={600}>
              {service.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              {service.description}
            </Typography>
          </Box>
        </Box>
        {(service.port || service.proxyUrl) && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {service.port && (
              <Chip
                label={`:${service.port}`}
                size="small"
                variant="outlined"
                sx={{ fontFamily: 'monospace', fontSize: '10px' }}
              />
            )}
            {service.proxyUrl && (
              <Chip
                label="Gateway"
                size="small"
                variant="outlined"
                sx={{ fontSize: '10px' }}
                onClick={(event) => {
                  event.stopPropagation();
                  window.open(service.proxyUrl!, '_blank', 'noopener');
                }}
                icon={<LinkIcon fontSize="inherit" />}
              />
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * Main Admin Dashboard Component
 */
export const AdminDashboard: React.FC = () => {
  const [healthSummary, setHealthSummary] = useState<HealthSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const serviceStats: ServiceStats = getServiceStats();

  // Fetch Docker health summary using dockerDataProvider
  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const data = await fetchHealthSummary();
        setHealthSummary(data);
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch health data');
      } finally {
        setLoading(false);
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const healthPercentage = healthSummary
    ? Math.round(healthSummary.operational_percentage)
    : 0;

  // Get featured services (core + new customer portal)
  const featuredServices = services.filter(s =>
    s.enabled && ['dashboard', 'customer-portal', 'backend', 'supabase-studio', 'grafana', 'n8n', 'wiki', 'portainer'].includes(s.id)
  );

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          <DashboardIcon sx={{ fontSize: 32, verticalAlign: 'middle', mr: 1 }} />
          Unified Admin Dashboard
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Complete platform monitoring and management • {serviceStats.total} services • {healthSummary?.total || 0} containers
        </Typography>
      </Box>

      {error && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Docker health monitoring unavailable: {error}
        </Alert>
      )}

      {/* System Overview Stats */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Platform Services"
            value={serviceStats.total}
            icon={<DashboardIcon />}
            color="#3b82f6"
            subtitle="Active services"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Running Containers"
            value={healthSummary?.running || 0}
            icon={<RunningIcon />}
            color="#22c55e"
            subtitle={`${healthSummary?.stopped || 0} stopped`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Healthy Services"
            value={healthSummary?.healthy || 0}
            icon={<HealthyIcon />}
            color="#10b981"
            subtitle={`${healthSummary?.unhealthy || 0} unhealthy`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="System Health"
            value={`${healthPercentage}%`}
            icon={<SpeedIcon />}
            color={healthPercentage === 100 ? '#22c55e' : healthPercentage >= 80 ? '#3b82f6' : '#ef4444'}
            subtitle="Operational"
          />
        </Grid>
      </Grid>

      {/* Health Progress Bar */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <HealthBar percentage={healthPercentage} />
          {healthSummary && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
              Last updated: {new Date(healthSummary.timestamp).toLocaleTimeString()}
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Service Categories */}
      <Card sx={{ mb: 4 }}>
        <CardHeader
          title="Service Categories"
          subheader="Click to filter services by category"
        />
        <CardContent>
          <Grid container spacing={2}>
            {Object.entries(serviceStats.byCategory).map(([category, count]) => (
              <Grid item xs={6} sm={4} md={3} lg={2} key={category}>
                <ServiceCategoryCard category={category} count={count} />
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      <Divider sx={{ my: 4 }} />

      {/* Quick Access - Featured Services */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" fontWeight={600} gutterBottom>
          Quick Access
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 2 }}>
          Featured services and admin UIs
        </Typography>
        <Grid container spacing={2}>
          {featuredServices.map((service) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={service.id}>
              <QuickServiceCard service={service} />
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Quick Links */}
      <Card>
        <CardHeader title="Management Tools" />
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                component={Link}
                to="/containers"
                fullWidth
                variant="outlined"
                sx={{ py: 2 }}
              >
                🐳 Container Management
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                component={Link}
                to="/platform-services"
                fullWidth
                variant="outlined"
                sx={{ py: 2 }}
              >
                🚀 All Services
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};
