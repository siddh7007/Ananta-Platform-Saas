/**
 * Rate Limiting Settings Page
 *
 * Allows CNS admins to configure enrichment rate limiting without restarting services.
 * Changes take effect immediately for new enrichment workflows.
 */

import React, { useState, useEffect } from 'react';
import {
  Typography,
  Switch,
  Slider,
  Button,
  Box,
  Alert,
  AlertTitle,
  Chip,
  FormControlLabel,
  TextField,
  Divider,
  CircularProgress,
  Snackbar,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@mui/material';
import {
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Speed as SpeedIcon,
  Security as SecurityIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { getCnsBaseUrl } from '../services/cnsConfig';
import { getAuthHeaders } from '../config/api';
import { WorkspaceLayout, Panel, GridLayout, StackLayout } from '../layout';
import { PageHeader, ErrorBoundary } from '../components/shared';

const CNS_API_URL = getCnsBaseUrl();

interface RateLimitingConfig {
  id: string;
  delays_enabled: boolean;
  delay_per_component_ms: number;
  delay_per_batch_ms: number;
  batch_size: number;
  updated_at: string;
  updated_by?: string;
}

interface Preset {
  name: string;
  description: string;
  config: {
    delays_enabled: boolean;
    delay_per_component_ms: number;
    delay_per_batch_ms: number;
    batch_size: number;
  };
  estimated_rate_per_minute: string;
  risk_level: string;
  use_case: string;
}

const RateLimitingSettings: React.FC = () => {
  const [config, setConfig] = useState<RateLimitingConfig | null>(null);
  const [originalConfig, setOriginalConfig] = useState<RateLimitingConfig | null>(null);
  const [presets, setPresets] = useState<Record<string, Preset>>({});
  const [selectedPreset, setSelectedPreset] = useState<string>('custom');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Fetch current configuration
  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${CNS_API_URL}/api/enrichment/rate-limiting`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch configuration');
      }

      const data = await response.json();
      setConfig(data);
      setOriginalConfig(data);
    } catch (error) {
      console.error('Error fetching config:', error);
      setSnackbar({
        open: true,
        message: 'Failed to load configuration. Is the migration applied?',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch presets
  const fetchPresets = async () => {
    try {
      const response = await fetch(`${CNS_API_URL}/api/enrichment/rate-limiting/presets`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setPresets(data);
      }
    } catch (error) {
      console.error('Error fetching presets:', error);
    }
  };

  useEffect(() => {
    fetchConfig();
    fetchPresets();
  }, []);

  // Calculate estimated processing rate
  const calculateProcessingRate = (cfg: RateLimitingConfig): number => {
    if (!cfg.delays_enabled) {
      return 200;
    }

    const timePerBatchMs = cfg.batch_size * cfg.delay_per_component_ms + cfg.delay_per_batch_ms;

    if (timePerBatchMs === 0) {
      return 200;
    }

    return Math.floor((60000 / timePerBatchMs) * cfg.batch_size);
  };

  // Save configuration
  const handleSave = async () => {
    if (!config) return;

    try {
      setSaving(true);
      const response = await fetch(`${CNS_API_URL}/api/enrichment/rate-limiting`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(getAuthHeaders() || {}),
        },
        body: JSON.stringify({
          delays_enabled: config.delays_enabled,
          delay_per_component_ms: config.delay_per_component_ms,
          delay_per_batch_ms: config.delay_per_batch_ms,
          batch_size: config.batch_size,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save configuration');
      }

      const updated = await response.json();
      setConfig(updated);
      setOriginalConfig(updated);
      setSnackbar({
        open: true,
        message: 'Configuration saved successfully! Changes will apply to new enrichment workflows.',
        severity: 'success',
      });
    } catch (error) {
      console.error('Error saving config:', error);
      setSnackbar({
        open: true,
        message: 'Failed to save configuration',
        severity: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  // Reset to defaults
  const handleReset = async () => {
    try {
      setSaving(true);
      const response = await fetch(`${CNS_API_URL}/api/enrichment/rate-limiting/reset`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to reset configuration');
      }

      const updated = await response.json();
      setConfig(updated);
      setOriginalConfig(updated);
      setSelectedPreset('balanced');
      setSnackbar({
        open: true,
        message: 'Configuration reset to defaults',
        severity: 'success',
      });
    } catch (error) {
      console.error('Error resetting config:', error);
      setSnackbar({
        open: true,
        message: 'Failed to reset configuration',
        severity: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  // Apply preset
  const handlePresetChange = (presetKey: string) => {
    setSelectedPreset(presetKey);

    if (presetKey === 'custom' || !presets[presetKey] || !config) {
      return;
    }

    const preset = presets[presetKey];
    setConfig({
      ...config,
      ...preset.config,
    });
  };

  // Check if configuration has changed
  const hasChanges =
    config &&
    originalConfig &&
    (config.delays_enabled !== originalConfig.delays_enabled ||
      config.delay_per_component_ms !== originalConfig.delay_per_component_ms ||
      config.delay_per_batch_ms !== originalConfig.delay_per_batch_ms ||
      config.batch_size !== originalConfig.batch_size);

  const header = (
    <PageHeader
      title="Enrichment Rate Limiting Settings"
      description="Configure delays between component processing to prevent API rate limiting errors. Changes take effect immediately for new enrichment workflows."
      onRefresh={fetchConfig}
      refreshing={loading}
    />
  );

  if (loading || !config) {
    return (
      <ErrorBoundary>
        <WorkspaceLayout header={header}>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
            <CircularProgress />
          </Box>
        </WorkspaceLayout>
      </ErrorBoundary>
    );
  }

  const processingRate = calculateProcessingRate(config);
  const riskLevel = !config.delays_enabled ? 'high' : processingRate > 50 ? 'medium' : 'low';

  return (
    <ErrorBoundary>
      <WorkspaceLayout header={header}>
        <StackLayout spacing={3}>
          {/* Current Status Alert */}
          <Alert
            severity={config.delays_enabled ? 'success' : 'warning'}
            icon={config.delays_enabled ? <SecurityIcon /> : <WarningIcon />}
          >
            <AlertTitle>
              {config.delays_enabled ? 'Rate Limiting Enabled' : 'Rate Limiting Disabled'}
            </AlertTitle>
            {config.delays_enabled
              ? `Processing at ~${processingRate} components/minute to prevent API errors`
              : 'Processing at full speed - may cause 429 "Too Many Requests" errors'}
          </Alert>

          {/* Presets Selector */}
          <Panel variant="outlined" padding="medium">
              <Typography variant="h6" gutterBottom>
                Quick Presets
              </Typography>

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Select Preset</InputLabel>
                <Select
                  value={selectedPreset}
                  onChange={(e) => handlePresetChange(e.target.value)}
                  label="Select Preset"
                >
                  <MenuItem value="custom">Custom Configuration</MenuItem>
                  {Object.entries(presets).map(([key, preset]) => (
                    <MenuItem key={key} value={key}>
                      {preset.name} - ~{preset.estimated_rate_per_minute} comp/min
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {selectedPreset !== 'custom' && presets[selectedPreset] && (
                <Alert severity="info">
                  <AlertTitle>{presets[selectedPreset].name}</AlertTitle>
                  {presets[selectedPreset].description}
                  <br />
                  <strong>Use Case:</strong> {presets[selectedPreset].use_case}
                </Alert>
              )}
            </Panel>

          <GridLayout columns={{ xs: 1, md: 3 }} gap={3}>
            {/* Main Configuration */}
            <Box sx={{ gridColumn: { xs: '1', md: '1 / 3' } }}>
              <Panel variant="outlined" padding="medium">
              <Typography variant="h6" gutterBottom>
                Configuration
              </Typography>

              {/* Enable/Disable Switch */}
              <FormControlLabel
                control={
                  <Switch
                    checked={config.delays_enabled}
                    onChange={(e) => {
                      setConfig({ ...config, delays_enabled: e.target.checked });
                      setSelectedPreset('custom');
                    }}
                    color="primary"
                  />
                }
                label="Enable Rate Limiting"
                sx={{ mb: 3 }}
              />

              <Divider sx={{ my: 2 }} />

              {/* Component Delay Slider */}
              <Box sx={{ mb: 4 }}>
                <Typography gutterBottom>
                  Delay Between Components: {config.delay_per_component_ms}ms
                </Typography>
                <Slider
                  value={config.delay_per_component_ms}
                  onChange={(_, value) => {
                    setConfig({ ...config, delay_per_component_ms: value as number });
                    setSelectedPreset('custom');
                  }}
                  min={0}
                  max={3000}
                  step={100}
                  marks={[
                    { value: 0, label: '0ms' },
                    { value: 500, label: '500ms' },
                    { value: 1000, label: '1s' },
                    { value: 2000, label: '2s' },
                    { value: 3000, label: '3s' },
                  ]}
                  disabled={!config.delays_enabled}
                />
                <Typography variant="caption" color="text.secondary">
                  Wait time between processing each component (0ms = no delay)
                </Typography>
              </Box>

              {/* Batch Delay Slider */}
              <Box sx={{ mb: 4 }}>
                <Typography gutterBottom>
                  Delay Between Batches: {config.delay_per_batch_ms}ms
                </Typography>
                <Slider
                  value={config.delay_per_batch_ms}
                  onChange={(_, value) => {
                    setConfig({ ...config, delay_per_batch_ms: value as number });
                    setSelectedPreset('custom');
                  }}
                  min={0}
                  max={5000}
                  step={500}
                  marks={[
                    { value: 0, label: '0ms' },
                    { value: 2000, label: '2s' },
                    { value: 5000, label: '5s' },
                  ]}
                  disabled={!config.delays_enabled}
                />
                <Typography variant="caption" color="text.secondary">
                  Wait time between processing each batch of components
                </Typography>
              </Box>

              {/* Batch Size TextField */}
              <TextField
                label="Batch Size"
                type="number"
                value={config.batch_size}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10);
                  if (value > 0 && value <= 100) {
                    setConfig({ ...config, batch_size: value });
                    setSelectedPreset('custom');
                  }
                }}
                fullWidth
                helperText="Number of components to process in parallel (1-100)"
                inputProps={{ min: 1, max: 100 }}
                sx={{ mb: 2 }}
              />

              {/* Action Buttons */}
              <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleSave}
                  disabled={!hasChanges || saving}
                  startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>

                <Button
                  variant="outlined"
                  onClick={handleReset}
                  disabled={saving}
                  startIcon={<RefreshIcon />}
                >
                  Reset to Defaults
                </Button>

                <Button
                  variant="text"
                  onClick={fetchConfig}
                  disabled={saving}
                  startIcon={<RefreshIcon />}
                >
                  Reload
                </Button>
              </Box>
              </Panel>
            </Box>

            {/* Information Panel */}
            <Box>
              <Panel variant="outlined" padding="medium">
              <Typography variant="h6" gutterBottom>
                Estimated Performance
              </Typography>

              <Box sx={{ mb: 2 }}>
                <Chip
                  label={`~${processingRate} components/min`}
                  color="primary"
                  icon={<SpeedIcon />}
                  sx={{ mb: 1 }}
                />
              </Box>

              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell>Risk Level</TableCell>
                    <TableCell>
                      <Chip
                        label={riskLevel.toUpperCase()}
                        size="small"
                        color={
                          riskLevel === 'high'
                            ? 'error'
                            : riskLevel === 'medium'
                            ? 'warning'
                            : 'success'
                        }
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>10 components</TableCell>
                    <TableCell>~{Math.ceil(600 / processingRate)} min</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>100 components</TableCell>
                    <TableCell>~{Math.ceil(6000 / processingRate)} min</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>500 components</TableCell>
                    <TableCell>~{Math.ceil(30000 / processingRate)} min</TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" gutterBottom>
                Supplier API Limits
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                • Mouser: 100 req/min
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                • DigiKey: 1000 req/day
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                • Element14: 50 req/min
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Typography variant="caption" color="text.secondary">
                Last updated: {new Date(config.updated_at).toLocaleString()}
              </Typography>

              {/* Warnings */}
              {!config.delays_enabled && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  <AlertTitle>Rate Limiting Disabled</AlertTitle>
                  This may cause 429 "Too Many Requests" errors. Use only for testing with mock APIs.
                </Alert>
              )}

              {processingRate > 100 && config.delays_enabled && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  <AlertTitle>High Processing Rate</AlertTitle>
                  Processing faster than Mouser's limit (100/min). May cause errors with multiple concurrent enrichments.
                </Alert>
              )}
              </Panel>
            </Box>
          </GridLayout>

          {/* Help Card */}
          <Panel variant="outlined" padding="medium">
              <Typography variant="h6" gutterBottom>
                ℹ️ How It Works
              </Typography>

              <Typography variant="body2" paragraph>
                Rate limiting prevents API errors by adding configurable delays between component processing.
                The enrichment workflow processes components in batches, with delays between:
              </Typography>

              <Box component="ol" sx={{ pl: 2 }}>
                <li>
                  <Typography variant="body2">
                    <strong>Each component in a batch</strong> - Prevents rapid-fire API calls
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2">
                    <strong>Each batch</strong> - Provides longer pauses to stay within rate limits
                  </Typography>
                </li>
              </Box>

              <Typography variant="body2" sx={{ mt: 2 }}>
                <strong>Example:</strong> With 500ms component delay, 2000ms batch delay, and batch size 10:
              </Typography>
              <Typography variant="body2" component="div" sx={{ pl: 2, fontFamily: 'monospace', fontSize: '0.875rem' }}>
                Batch 1: C1 → 500ms → C2 → 500ms → ... → C10
                <br />
                2000ms pause
                <br />
                Batch 2: C11 → 500ms → C12 → ...
              </Typography>
            </Panel>

          {/* Snackbar */}
          <Snackbar
            open={snackbar.open}
            autoHideDuration={6000}
            onClose={() => setSnackbar({ ...snackbar, open: false })}
          >
            <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
              {snackbar.message}
            </Alert>
          </Snackbar>
        </StackLayout>
      </WorkspaceLayout>
    </ErrorBoundary>
  );
};

export default RateLimitingSettings;
