/**
 * Metrics Charts Component
 *
 * Displays various performance metrics charts using Recharts
 */

import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  ToggleButtonGroup,
  ToggleButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Service, MetricDataPoint } from '../../../microservices-lib/types';

interface MetricsChartsProps {
  data?: any;
  services?: Service[];
  type?: 'line' | 'area' | 'bar';
  height?: number;
  fullView?: boolean;
}

const COLORS = [
  '#4fc3f7', // blue
  '#4caf50', // green
  '#ff9800', // orange
  '#9c27b0', // purple
  '#f44336', // red
  '#ffeb3b', // yellow
  '#00bcd4', // cyan
  '#e91e63', // pink
];

const MetricsCharts: React.FC<MetricsChartsProps> = ({
  data,
  services = [],
  type = 'line',
  height = 300,
  fullView = false,
}) => {
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('1h');
  const [selectedService, setSelectedService] = useState<string>('all');
  const [chartType, setChartType] = useState<'line' | 'area' | 'bar'>(type);

  // Mock data generator for demonstration
  const generateMockData = (points: number = 20) => {
    const now = Date.now();
    return Array.from({ length: points }, (_, i) => ({
      time: new Date(now - (points - i) * 60000).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      value: Math.floor(Math.random() * 100) + 20,
      requests: Math.floor(Math.random() * 1000) + 100,
      errors: Math.floor(Math.random() * 50),
      responseTime: Math.floor(Math.random() * 200) + 50,
      cpu: Math.floor(Math.random() * 60) + 20,
      memory: Math.floor(Math.random() * 400) + 100,
    }));
  };

  const mockData = data || generateMockData();

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <Paper sx={{ p: 1.5, bgcolor: '#1a1f2e', border: '1px solid #4fc3f7' }}>
          <Typography variant="caption" sx={{ color: '#fff', fontWeight: 600 }}>
            {label}
          </Typography>
          {payload.map((entry: any, index: number) => (
            <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: entry.color,
                }}
              />
              <Typography variant="caption" sx={{ color: '#8b92a7' }}>
                {entry.name}:
              </Typography>
              <Typography variant="caption" sx={{ color: '#fff', fontWeight: 600 }}>
                {entry.value.toLocaleString()}
              </Typography>
            </Box>
          ))}
        </Paper>
      );
    }
    return null;
  };

  const renderChart = (chartData: any[], dataKey: string, name: string, color: string, chartType: string) => {
    const commonProps = {
      data: chartData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 },
    };

    const axisProps = {
      stroke: '#8b92a7',
      style: { fontSize: 12 },
    };

    switch (chartType) {
      case 'area':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart {...commonProps}>
              <defs>
                <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.8} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3e" />
              <XAxis dataKey="time" {...axisProps} />
              <YAxis {...axisProps} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                fillOpacity={1}
                fill={`url(#gradient-${dataKey})`}
                name={name}
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3e" />
              <XAxis dataKey="time" {...axisProps} />
              <YAxis {...axisProps} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey={dataKey} fill={color} name={name} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      default: // line
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3e" />
              <XAxis dataKey="time" {...axisProps} />
              <YAxis {...axisProps} />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                strokeWidth={2}
                dot={false}
                name={name}
              />
            </LineChart>
          </ResponsiveContainer>
        );
    }
  };

  const renderMultiServiceChart = () => {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={mockData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3e" />
          <XAxis dataKey="time" stroke="#8b92a7" style={{ fontSize: 12 }} />
          <YAxis stroke="#8b92a7" style={{ fontSize: 12 }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ color: '#fff' }} />
          {services.slice(0, 6).map((service, index) => (
            <Line
              key={service.id}
              type="monotone"
              dataKey="requests"
              stroke={COLORS[index % COLORS.length]}
              strokeWidth={2}
              dot={false}
              name={service.displayName}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  };

  if (fullView) {
    return (
      <Box>
        {/* Controls */}
        <Paper sx={{ p: 2, mb: 3, bgcolor: '#1a1f2e' }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <ToggleButtonGroup
              value={timeRange}
              exclusive
              onChange={(_, value) => value && setTimeRange(value)}
              size="small"
            >
              <ToggleButton value="1h" sx={{ color: '#fff' }}>1H</ToggleButton>
              <ToggleButton value="6h" sx={{ color: '#fff' }}>6H</ToggleButton>
              <ToggleButton value="24h" sx={{ color: '#fff' }}>24H</ToggleButton>
              <ToggleButton value="7d" sx={{ color: '#fff' }}>7D</ToggleButton>
            </ToggleButtonGroup>

            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel sx={{ color: '#8b92a7' }}>Service</InputLabel>
              <Select
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
                label="Service"
                sx={{ color: '#fff', bgcolor: '#0a0e1a' }}
              >
                <MenuItem value="all">All Services</MenuItem>
                {services.map(service => (
                  <MenuItem key={service.id} value={service.id}>
                    {service.displayName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <ToggleButtonGroup
              value={chartType}
              exclusive
              onChange={(_, value) => value && setChartType(value)}
              size="small"
            >
              <ToggleButton value="line" sx={{ color: '#fff' }}>Line</ToggleButton>
              <ToggleButton value="area" sx={{ color: '#fff' }}>Area</ToggleButton>
              <ToggleButton value="bar" sx={{ color: '#fff' }}>Bar</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Paper>

        {/* Charts Grid */}
        <Grid container spacing={3}>
          {/* Request Rate */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, bgcolor: '#1a1f2e' }}>
              <Typography variant="h6" sx={{ color: '#fff', mb: 2 }}>
                Request Rate
              </Typography>
              {renderChart(mockData, 'requests', 'Requests', '#4fc3f7', chartType)}
            </Paper>
          </Grid>

          {/* Error Rate */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, bgcolor: '#1a1f2e' }}>
              <Typography variant="h6" sx={{ color: '#fff', mb: 2 }}>
                Error Rate
              </Typography>
              {renderChart(mockData, 'errors', 'Errors', '#f44336', chartType)}
            </Paper>
          </Grid>

          {/* Response Time */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, bgcolor: '#1a1f2e' }}>
              <Typography variant="h6" sx={{ color: '#fff', mb: 2 }}>
                Response Time (ms)
              </Typography>
              {renderChart(mockData, 'responseTime', 'Response Time', '#4caf50', chartType)}
            </Paper>
          </Grid>

          {/* CPU Usage */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, bgcolor: '#1a1f2e' }}>
              <Typography variant="h6" sx={{ color: '#fff', mb: 2 }}>
                CPU Usage (%)
              </Typography>
              {renderChart(mockData, 'cpu', 'CPU', '#ff9800', chartType)}
            </Paper>
          </Grid>

          {/* Memory Usage */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, bgcolor: '#1a1f2e' }}>
              <Typography variant="h6" sx={{ color: '#fff', mb: 2 }}>
                Memory Usage (MB)
              </Typography>
              {renderChart(mockData, 'memory', 'Memory', '#9c27b0', chartType)}
            </Paper>
          </Grid>

          {/* Multi-Service Comparison */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, bgcolor: '#1a1f2e' }}>
              <Typography variant="h6" sx={{ color: '#fff', mb: 2 }}>
                Service Comparison
              </Typography>
              {renderMultiServiceChart()}
            </Paper>
          </Grid>
        </Grid>
      </Box>
    );
  }

  // Simple chart for overview
  return renderChart(mockData, 'value', 'Value', COLORS[0], chartType);
};

export default MetricsCharts;
