import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Grid,
  Switch,
  FormControlLabel,
  TextField,
  Select,
  MenuItem,
  Button,
  Alert,
  LinearProgress,
  Chip,
  FormControl,
  InputLabel,
  Checkbox,
  FormGroup,
  InputAdornment,
  Divider,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import { CNS_API_URL, getAdminAuthHeaders } from './api';

interface EnrichmentConfig {
  id?: number;
  config_name: string;
  is_active: boolean;
  enable_suppliers: boolean;
  preferred_suppliers: string[];
  supplier_min_confidence: number;
  enable_ai: boolean;
  ai_provider: string | null;
  ai_operations: string[];
  ai_min_confidence: number;
  ai_cost_limit_monthly: number | null;
  enable_web_scraping: boolean;
  scraping_sources: string[];
  scraping_timeout_seconds: number;
  quality_reject_threshold: number;
  quality_staging_threshold: number;
  quality_auto_approve_threshold: number;
  enable_enrichment_audit: boolean;
  ai_cost_current_month?: number;
  ai_requests_current_month?: number;
}

const DEFAULT_CONFIG: EnrichmentConfig = {
  config_name: 'default',
  is_active: true,
  enable_suppliers: true,
  preferred_suppliers: ['mouser', 'digikey', 'element14'],
  supplier_min_confidence: 90.0,
  enable_ai: false,
  ai_provider: null,
  ai_operations: ['category', 'specs'],
  ai_min_confidence: 70.0,
  ai_cost_limit_monthly: null,
  enable_web_scraping: false,
  scraping_sources: ['manufacturer', 'datasheet'],
  scraping_timeout_seconds: 10,
  quality_reject_threshold: 70,
  quality_staging_threshold: 94,
  quality_auto_approve_threshold: 95,
  enable_enrichment_audit: true,
};

export const EnrichmentConfigPage: React.FC = () => {
  const [config, setConfig] = useState<EnrichmentConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Load active configuration on mount
  useEffect(() => {
    loadActiveConfig();
  }, []);

  const loadActiveConfig = async () => {
    setLoading(true);
    setError(null);

    try {
      const authHeaders = getAdminAuthHeaders();
      const response = await fetch(`${CNS_API_URL}/enrichment-config/config/active`, {
        headers: authHeaders ? new Headers(authHeaders) : undefined,
      });

      if (!response.ok) {
        // No active config, use defaults
        if (response.status === 404) {
          setConfig(DEFAULT_CONFIG);
          return;
        }
        throw new Error('Failed to load configuration');
      }

      const data = await response.json();
      setConfig(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const method = config.id ? 'PATCH' : 'POST';
      const url = config.id
        ? `${CNS_API_URL}/enrichment-config/config/${config.id}`
        : `${CNS_API_URL}/enrichment-config/config/`;

      const authHeaders = getAdminAuthHeaders();
      const headers = new Headers(authHeaders || {});
      headers.set('Content-Type', 'application/json');

      const response = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error('Failed to save configuration');
      }

      const savedConfig = await response.json();
      setConfig(savedConfig);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    loadActiveConfig();
    setSuccess(false);
    setError(null);
  };

  const budgetUsagePercent = config.ai_cost_limit_monthly
    ? ((config.ai_cost_current_month || 0) / config.ai_cost_limit_monthly) * 100
    : 0;

  const budgetColor =
    budgetUsagePercent >= 100 ? 'error' :
    budgetUsagePercent >= 80 ? 'warning' :
    'success';

  if (loading) {
    return (
      <Box p={3}>
        <Typography variant="h4" gutterBottom>Loading configuration...</Typography>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        Enrichment Configuration
      </Typography>
      <Typography variant="body2" color="textSecondary" paragraph>
        Configure AI enhancement, web scraping, and quality thresholds for component enrichment.
      </Typography>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Configuration saved successfully!
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Tier 2: Supplier APIs */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                🔌 Tier 2: Supplier APIs
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <FormControlLabel
                control={
                  <Switch
                    checked={config.enable_suppliers}
                    onChange={(e) => setConfig({ ...config, enable_suppliers: e.target.checked })}
                  />
                }
                label="Enable Supplier APIs (Mouser, DigiKey, Element14)"
              />

              {config.enable_suppliers && (
                <Box mt={2}>
                  <Typography variant="body2" gutterBottom>
                    Preferred Suppliers Order:
                  </Typography>
                  <FormGroup row>
                    {['mouser', 'digikey', 'element14'].map((supplier) => (
                      <FormControlLabel
                        key={supplier}
                        control={
                          <Checkbox
                            checked={config.preferred_suppliers.includes(supplier)}
                            onChange={(e) => {
                              const updated = e.target.checked
                                ? [...config.preferred_suppliers, supplier]
                                : config.preferred_suppliers.filter(s => s !== supplier);
                              setConfig({ ...config, preferred_suppliers: updated });
                            }}
                          />
                        }
                        label={supplier.charAt(0).toUpperCase() + supplier.slice(1)}
                      />
                    ))}
                  </FormGroup>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Tier 3: AI Enhancement */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <SmartToyIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">
                  Tier 3: AI Enhancement (Optional)
                </Typography>
                <Chip
                  label={config.enable_ai ? 'ENABLED' : 'DISABLED'}
                  color={config.enable_ai ? 'success' : 'default'}
                  size="small"
                  sx={{ ml: 2 }}
                />
              </Box>
              <Divider sx={{ mb: 2 }} />

              <FormControlLabel
                control={
                  <Switch
                    checked={config.enable_ai}
                    onChange={(e) => setConfig({ ...config, enable_ai: e.target.checked })}
                  />
                }
                label="Enable AI Enhancement"
              />

              {config.enable_ai && (
                <Box mt={2}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth>
                        <InputLabel>AI Provider</InputLabel>
                        <Select
                          value={config.ai_provider || ''}
                          onChange={(e) => setConfig({ ...config, ai_provider: e.target.value })}
                          label="AI Provider"
                        >
                          <MenuItem value="ollama">
                            Ollama (Free, Local)
                          </MenuItem>
                          <MenuItem value="openai">
                            OpenAI GPT-4 (Paid API)
                          </MenuItem>
                          <MenuItem value="claude">
                            Anthropic Claude (Paid API)
                          </MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>

                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Monthly Budget Limit"
                        type="number"
                        value={config.ai_cost_limit_monthly || ''}
                        onChange={(e) => setConfig({
                          ...config,
                          ai_cost_limit_monthly: e.target.value ? parseFloat(e.target.value) : null
                        })}
                        InputProps={{
                          startAdornment: <InputAdornment position="start">$</InputAdornment>,
                        }}
                        helperText="Leave empty for unlimited"
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <Typography variant="body2" gutterBottom>
                        AI Operations:
                      </Typography>
                      <FormGroup row>
                        {['category', 'specs', 'description'].map((op) => (
                          <FormControlLabel
                            key={op}
                            control={
                              <Checkbox
                                checked={config.ai_operations.includes(op)}
                                onChange={(e) => {
                                  const updated = e.target.checked
                                    ? [...config.ai_operations, op]
                                    : config.ai_operations.filter(o => o !== op);
                                  setConfig({ ...config, ai_operations: updated });
                                }}
                              />
                            }
                            label={op.charAt(0).toUpperCase() + op.slice(1)}
                          />
                        ))}
                      </FormGroup>
                    </Grid>

                    {config.ai_cost_limit_monthly && (
                      <Grid item xs={12}>
                        <Box>
                          <Box display="flex" justifyContent="space-between" mb={1}>
                            <Typography variant="body2">
                              Budget Usage
                            </Typography>
                            <Typography variant="body2" color={budgetColor}>
                              ${config.ai_cost_current_month?.toFixed(2) || '0.00'} / $
                              {config.ai_cost_limit_monthly?.toFixed(2)}
                            </Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(budgetUsagePercent, 100)}
                            color={budgetColor}
                          />
                          <Typography variant="caption" color="textSecondary" mt={1}>
                            {config.ai_requests_current_month || 0} AI requests this month
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                  </Grid>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Tier 4: Web Scraping */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <TravelExploreIcon sx={{ mr: 1, color: 'warning.main' }} />
                <Typography variant="h6">
                  Tier 4: Web Scraping (Optional)
                </Typography>
                <Chip
                  label={config.enable_web_scraping ? 'ENABLED' : 'DISABLED'}
                  color={config.enable_web_scraping ? 'warning' : 'default'}
                  size="small"
                  sx={{ ml: 2 }}
                />
              </Box>
              <Divider sx={{ mb: 2 }} />

              <FormControlLabel
                control={
                  <Switch
                    checked={config.enable_web_scraping}
                    onChange={(e) => setConfig({ ...config, enable_web_scraping: e.target.checked })}
                  />
                }
                label="Enable Web Scraping Fallback"
              />

              {config.enable_web_scraping && (
                <Box mt={2}>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <Typography variant="body2" gutterBottom>
                        Scraping Sources:
                      </Typography>
                      <FormGroup row>
                        {['manufacturer', 'datasheet'].map((source) => (
                          <FormControlLabel
                            key={source}
                            control={
                              <Checkbox
                                checked={config.scraping_sources.includes(source)}
                                onChange={(e) => {
                                  const updated = e.target.checked
                                    ? [...config.scraping_sources, source]
                                    : config.scraping_sources.filter(s => s !== source);
                                  setConfig({ ...config, scraping_sources: updated });
                                }}
                              />
                            }
                            label={source.charAt(0).toUpperCase() + source.slice(1)}
                          />
                        ))}
                      </FormGroup>
                    </Grid>

                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Timeout (seconds)"
                        type="number"
                        value={config.scraping_timeout_seconds}
                        onChange={(e) => setConfig({
                          ...config,
                          scraping_timeout_seconds: parseInt(e.target.value)
                        })}
                        inputProps={{ min: 1, max: 60 }}
                      />
                    </Grid>
                  </Grid>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Quality Thresholds */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                ⚖️ Quality Routing Thresholds
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Reject Threshold"
                    type="number"
                    value={config.quality_reject_threshold}
                    onChange={(e) => setConfig({
                      ...config,
                      quality_reject_threshold: parseInt(e.target.value)
                    })}
                    inputProps={{ min: 0, max: 100 }}
                    helperText="< threshold = rejected"
                  />
                </Grid>

                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Staging Threshold"
                    type="number"
                    value={config.quality_staging_threshold}
                    onChange={(e) => setConfig({
                      ...config,
                      quality_staging_threshold: parseInt(e.target.value)
                    })}
                    inputProps={{ min: 0, max: 100 }}
                    helperText="Manual review"
                  />
                </Grid>

                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Auto-Approve Threshold"
                    type="number"
                    value={config.quality_auto_approve_threshold}
                    onChange={(e) => setConfig({
                      ...config,
                      quality_auto_approve_threshold: parseInt(e.target.value)
                    })}
                    inputProps={{ min: 0, max: 100 }}
                    helperText="≥ threshold = production"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Enrichment Audit Trail */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                📊 Enrichment Audit Trail
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <FormControlLabel
                control={
                  <Switch
                    checked={config.enable_enrichment_audit}
                    onChange={(e) => setConfig({ ...config, enable_enrichment_audit: e.target.checked })}
                    color="primary"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body1" fontWeight={600}>
                      Enable Audit Trail (CSV/S3)
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Save enrichment data to CSV files in MinIO for debugging and quality validation
                    </Typography>
                  </Box>
                }
              />

              {config.enable_enrichment_audit && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  <Typography variant="body2" fontWeight={600} gutterBottom>
                    Audit trail includes:
                  </Typography>
                  <ul style={{ margin: 0, paddingLeft: '20px' }}>
                    <li>
                      <Typography variant="body2">
                        <strong>BOM Original</strong> - Original upload data before enrichment
                      </Typography>
                    </li>
                    <li>
                      <Typography variant="body2">
                        <strong>Vendor Responses</strong> - Raw API responses from Mouser, DigiKey, Element14
                      </Typography>
                    </li>
                    <li>
                      <Typography variant="body2">
                        <strong>Normalized Data</strong> - Data after normalization (prices, parameters, categories)
                      </Typography>
                    </li>
                    <li>
                      <Typography variant="body2">
                        <strong>Quality Summary</strong> - Quality scores, routing decisions, and changes made
                      </Typography>
                    </li>
                  </ul>
                  <Typography variant="caption" color="textSecondary" display="block" sx={{ mt: 1 }}>
                    Files stored in MinIO: enrichment-audit/&#123;job_id&#125;/&#123;filename&#125;.csv
                  </Typography>
                </Alert>
              )}

              {!config.enable_enrichment_audit && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    Audit trail is disabled. You will not be able to debug normalization issues or compare vendor data quality.
                  </Typography>
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Action Buttons */}
        <Grid item xs={12}>
          <Box display="flex" gap={2}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </Button>

            <Button
              variant="outlined"
              color="secondary"
              size="large"
              startIcon={<CancelIcon />}
              onClick={handleReset}
              disabled={saving}
            >
              Reset
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};
