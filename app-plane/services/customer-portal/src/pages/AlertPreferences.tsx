/**
 * Alert Preferences Page
 *
 * Allows users to configure their alert notification preferences,
 * threshold settings, and component watches.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Switch,
  FormControlLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Button,
  CircularProgress,
  Alert,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Checkbox,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import SaveIcon from '@mui/icons-material/Save';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import NotificationsIcon from '@mui/icons-material/Notifications';
import EmailIcon from '@mui/icons-material/Email';
import VisibilityIcon from '@mui/icons-material/Visibility';
import HistoryIcon from '@mui/icons-material/History';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import InventoryIcon from '@mui/icons-material/Inventory';
import GavelIcon from '@mui/icons-material/Gavel';
import ArticleIcon from '@mui/icons-material/Article';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SettingsIcon from '@mui/icons-material/Settings';
import {
  alertApi,
  AlertType,
  AlertPreferenceWithThresholds,
  AlertPreferenceTypeUpdate,
  AlertTypeConfig,
  ThresholdOption,
  ComponentWatch,
} from '../services/alertService';

// Icon mapping for alert types
const alertTypeIcons: Record<AlertType, React.ReactNode> = {
  LIFECYCLE: <HistoryIcon sx={{ color: '#2196f3' }} />,
  RISK: <TrendingUpIcon sx={{ color: '#ff9800' }} />,
  PRICE: <AttachMoneyIcon sx={{ color: '#4caf50' }} />,
  AVAILABILITY: <InventoryIcon sx={{ color: '#9c27b0' }} />,
  COMPLIANCE: <GavelIcon sx={{ color: '#f44336' }} />,
  PCN: <ArticleIcon sx={{ color: '#607d8b' }} />,
  SUPPLY_CHAIN: <LocalShippingIcon sx={{ color: '#00bcd4' }} />,
};

// Friendly labels for alert types
const alertTypeLabels: Record<AlertType, string> = {
  LIFECYCLE: 'Lifecycle Alerts',
  RISK: 'Risk Score Alerts',
  PRICE: 'Price Change Alerts',
  AVAILABILITY: 'Availability Alerts',
  COMPLIANCE: 'Compliance Alerts',
  PCN: 'PCN/PDN Alerts',
  SUPPLY_CHAIN: 'Supply Chain Alerts',
};

interface ThresholdControlProps {
  option: ThresholdOption;
  value: number | boolean | string;
  onChange: (key: string, value: number | boolean | string) => void;
}

const ThresholdControl: React.FC<ThresholdControlProps> = ({ option, value, onChange }) => {
  const currentValue = value ?? option.default_value;

  if (option.type === 'boolean') {
    return (
      <FormControlLabel
        control={
          <Checkbox
            checked={currentValue as boolean}
            onChange={(e) => onChange(option.key, e.target.checked)}
          />
        }
        label={
          <Box>
            <Typography variant="body2">{option.label}</Typography>
            <Typography variant="caption" color="text.secondary">
              {option.description}
            </Typography>
          </Box>
        }
        sx={{ alignItems: 'flex-start', mb: 1 }}
      />
    );
  }

  if (option.type === 'select' && option.options) {
    return (
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" gutterBottom>{option.label}</Typography>
        <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
          {option.description}
        </Typography>
        <FormControl fullWidth size="small">
          <Select
            value={currentValue as string}
            onChange={(e) => onChange(option.key, e.target.value)}
          >
            {option.options.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
    );
  }

  // Number or percent type - use slider
  const numValue = currentValue as number;
  const min = option.min_value ?? 0;
  const max = option.max_value ?? 100;
  const step = option.type === 'percent' ? 1 : (max - min) > 100 ? 10 : 1;

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="body2" gutterBottom>
        {option.label}: {numValue}{option.unit ? ` ${option.unit}` : ''}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
        {option.description}
      </Typography>
      <Slider
        value={numValue}
        onChange={(_, val) => onChange(option.key, val as number)}
        min={min}
        max={max}
        step={step}
        valueLabelDisplay="auto"
        marks={[
          { value: min, label: `${min}` },
          { value: Math.round((min + max) / 2), label: `${Math.round((min + max) / 2)}` },
          { value: max, label: `${max}` },
        ]}
      />
    </Box>
  );
};

interface AlertTypeCardProps {
  preference: AlertPreferenceWithThresholds;
  thresholdOptions: ThresholdOption[];
  onToggle: (alertType: AlertType, enabled: boolean) => void;
  onThresholdChange: (alertType: AlertType, key: string, value: number | boolean | string) => void;
  onDeliveryChange: (alertType: AlertType, channel: 'in_app' | 'email' | 'webhook', enabled: boolean) => void;
  expanded: boolean;
  onExpand: () => void;
}

const AlertTypeCard: React.FC<AlertTypeCardProps> = ({
  preference,
  thresholdOptions,
  onToggle,
  onThresholdChange,
  onDeliveryChange,
  expanded,
  onExpand,
}) => {
  const alertType = preference.alert_type as AlertType;
  const thresholdConfig = preference.threshold_config || {};

  return (
    <Accordion expanded={expanded} onChange={onExpand}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
          <Switch
            checked={preference.is_active}
            onChange={(e) => {
              e.stopPropagation();
              onToggle(alertType, e.target.checked);
            }}
            onClick={(e) => e.stopPropagation()}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {alertTypeIcons[alertType]}
            <Typography variant="subtitle1">{alertTypeLabels[alertType]}</Typography>
          </Box>
          {preference.is_active && (
            <Box sx={{ display: 'flex', gap: 0.5, ml: 'auto', mr: 2 }}>
              {preference.in_app_enabled && (
                <Chip label="In-App" size="small" color="primary" variant="outlined" />
              )}
              {preference.email_enabled && (
                <Chip label="Email" size="small" color="secondary" variant="outlined" />
              )}
            </Box>
          )}
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {preference.description}
        </Typography>

        <Divider sx={{ my: 2 }} />

        {/* Delivery Channels */}
        <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <EmailIcon fontSize="small" /> Delivery Channels
        </Typography>
        <Box sx={{ display: 'flex', gap: 3, mb: 3 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={preference.in_app_enabled}
                onChange={(e) => onDeliveryChange(alertType, 'in_app', e.target.checked)}
              />
            }
            label="In-App"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={preference.email_enabled}
                onChange={(e) => onDeliveryChange(alertType, 'email', e.target.checked)}
              />
            }
            label="Email"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={preference.webhook_enabled}
                onChange={(e) => onDeliveryChange(alertType, 'webhook', e.target.checked)}
              />
            }
            label="Webhook"
          />
        </Box>

        {/* Threshold Settings */}
        {thresholdOptions.length > 0 && (
          <>
            <Typography variant="subtitle2" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <SettingsIcon fontSize="small" /> Threshold Settings
            </Typography>
            <Box sx={{ pl: 1 }}>
              {thresholdOptions.map((option) => (
                <ThresholdControl
                  key={option.key}
                  option={option}
                  value={thresholdConfig[option.key] ?? option.default_value}
                  onChange={(key, value) => onThresholdChange(alertType, key, value)}
                />
              ))}
            </Box>
          </>
        )}
      </AccordionDetails>
    </Accordion>
  );
};

export const AlertPreferencesPage: React.FC = () => {
  const [preferences, setPreferences] = useState<AlertPreferenceWithThresholds[]>([]);
  const [thresholdConfigs, setThresholdConfigs] = useState<AlertTypeConfig[]>([]);
  const [watches, setWatches] = useState<ComponentWatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedType, setExpandedType] = useState<AlertType | null>(null);
  const [addWatchOpen, setAddWatchOpen] = useState(false);
  const [newWatchComponentId, setNewWatchComponentId] = useState('');

  // Track pending changes per alert type
  const [pendingChanges, setPendingChanges] = useState<Record<string, {
    is_active?: boolean;
    in_app_enabled?: boolean;
    email_enabled?: boolean;
    webhook_enabled?: boolean;
    threshold_config?: Record<string, number | boolean | string>;
  }>>({});

  const loadData = async () => {
    try {
      setError(null);
      const [prefsData, configsData, watchesData] = await Promise.all([
        alertApi.getPreferencesWithThresholds(),
        alertApi.getThresholdOptions(),
        alertApi.getWatches(),
      ]);
      setPreferences(prefsData);
      setThresholdConfigs(configsData);
      setWatches(watchesData);
    } catch (err: any) {
      setError(err.message || 'Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const hasChanges = Object.keys(pendingChanges).length > 0;

  const handleToggle = (alertType: AlertType, enabled: boolean) => {
    setPendingChanges(prev => ({
      ...prev,
      [alertType]: { ...prev[alertType], is_active: enabled },
    }));
    // Update local state for immediate UI feedback
    setPreferences(prev => prev.map(p =>
      p.alert_type === alertType ? { ...p, is_active: enabled } : p
    ));
  };

  const handleDeliveryChange = (
    alertType: AlertType,
    channel: 'in_app' | 'email' | 'webhook',
    enabled: boolean
  ) => {
    const key = `${channel}_enabled` as 'in_app_enabled' | 'email_enabled' | 'webhook_enabled';
    setPendingChanges(prev => ({
      ...prev,
      [alertType]: { ...prev[alertType], [key]: enabled },
    }));
    // Update local state
    setPreferences(prev => prev.map(p =>
      p.alert_type === alertType ? { ...p, [key]: enabled } : p
    ));
  };

  const handleThresholdChange = (
    alertType: AlertType,
    key: string,
    value: number | boolean | string
  ) => {
    setPendingChanges(prev => {
      const existing = prev[alertType] || {};
      const existingThresholds = existing.threshold_config || {};
      return {
        ...prev,
        [alertType]: {
          ...existing,
          threshold_config: { ...existingThresholds, [key]: value },
        },
      };
    });
    // Update local state
    setPreferences(prev => prev.map(p => {
      if (p.alert_type !== alertType) return p;
      return {
        ...p,
        threshold_config: { ...(p.threshold_config || {}), [key]: value },
      };
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      // Save changes for each alert type that has pending changes
      const savePromises = Object.entries(pendingChanges).map(async ([alertType, changes]) => {
        // If there are threshold changes, use the dedicated endpoint
        if (changes.threshold_config) {
          // Merge with existing threshold config
          const existingPref = preferences.find(p => p.alert_type === alertType);
          const mergedConfig = {
            ...(existingPref?.threshold_config || {}),
            ...changes.threshold_config,
          };
          await alertApi.updateThresholds(alertType as AlertType, mergedConfig);
        }

        // For other changes (is_active, delivery channels), use the per-type preferences endpoint
        const { threshold_config, ...otherChanges } = changes;
        if (Object.keys(otherChanges).length > 0) {
          const update: AlertPreferenceTypeUpdate = {
            alert_type: alertType as AlertType,
            ...otherChanges,
          };
          await alertApi.updateAlertTypePreference(update);
        }
      });

      await Promise.all(savePromises);

      setPendingChanges({});
      setSuccess('Preferences saved successfully');
      setTimeout(() => setSuccess(null), 3000);

      // Reload to get fresh data
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveWatch = async (watchId: string) => {
    try {
      await alertApi.removeWatch(watchId);
      setWatches(watches.filter(w => w.id !== watchId));
      setSuccess('Component watch removed');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAddWatch = async () => {
    if (!newWatchComponentId.trim()) return;

    try {
      const newWatch = await alertApi.addWatch({
        component_id: newWatchComponentId.trim(),
        watch_lifecycle: true,
        watch_risk: true,
        watch_price: true,
        watch_availability: true,
        watch_compliance: true,
        watch_supply_chain: true,
      });
      setWatches([...watches, newWatch]);
      setNewWatchComponentId('');
      setAddWatchOpen(false);
      setSuccess('Component watch added');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Get threshold options for each alert type from configs
  const getThresholdOptions = (alertType: string): ThresholdOption[] => {
    const config = thresholdConfigs.find(c => c.alert_type === alertType);
    return config?.thresholds || [];
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            component={RouterLink}
            to="/alerts"
            startIcon={<ArrowBackIcon />}
            variant="text"
          >
            Back to Alerts
          </Button>
          <Box>
            <Typography variant="h4">
              Alert Preferences
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Configure your notification settings and thresholds
            </Typography>
          </Box>
        </Box>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
          onClick={handleSave}
          disabled={!hasChanges || saving}
        >
          Save Changes
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Alert Types with Thresholds */}
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <NotificationsIcon color="primary" />
                <Typography variant="h6">
                  Alert Types & Thresholds
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Configure which alerts you receive and customize trigger thresholds
              </Typography>

              {preferences.map((pref) => (
                <AlertTypeCard
                  key={pref.alert_type}
                  preference={pref}
                  thresholdOptions={getThresholdOptions(pref.alert_type)}
                  onToggle={handleToggle}
                  onThresholdChange={handleThresholdChange}
                  onDeliveryChange={handleDeliveryChange}
                  expanded={expandedType === pref.alert_type}
                  onExpand={() => setExpandedType(
                    expandedType === pref.alert_type ? null : pref.alert_type as AlertType
                  )}
                />
              ))}
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Settings Sidebar */}
        <Grid item xs={12} lg={4}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Reference
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Typography variant="subtitle2" gutterBottom>
                Alert Types Overview
              </Typography>
              <Box sx={{ mb: 2 }}>
                {preferences.map((pref) => (
                  <Box
                    key={pref.alert_type}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      py: 0.5,
                      opacity: pref.is_active ? 1 : 0.5,
                    }}
                  >
                    {alertTypeIcons[pref.alert_type as AlertType]}
                    <Typography variant="body2">
                      {alertTypeLabels[pref.alert_type as AlertType]}
                    </Typography>
                    <Chip
                      label={pref.is_active ? 'Active' : 'Off'}
                      size="small"
                      color={pref.is_active ? 'success' : 'default'}
                      sx={{ ml: 'auto', height: 20 }}
                    />
                  </Box>
                ))}
              </Box>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" gutterBottom>
                Tip
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Click on each alert type to expand and configure detailed threshold settings.
                Changes are saved when you click "Save Changes".
              </Typography>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Active Channels
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="body2">In-App Notifications</Typography>
                  <Chip
                    label={preferences.filter(p => p.in_app_enabled).length}
                    size="small"
                    color="primary"
                  />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Email Alerts</Typography>
                  <Chip
                    label={preferences.filter(p => p.email_enabled).length}
                    size="small"
                    color="secondary"
                  />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Webhook Integrations</Typography>
                  <Chip
                    label={preferences.filter(p => p.webhook_enabled).length}
                    size="small"
                  />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Component Watches */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <VisibilityIcon color="primary" />
                  <Typography variant="h6">
                    Component Watch List
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={() => setAddWatchOpen(true)}
                  >
                    Add Component
                  </Button>
                  <Button
                    component={RouterLink}
                    to="/alerts/watched"
                    variant="text"
                  >
                    View All
                  </Button>
                </Box>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Get personalized alerts for specific components you're tracking
              </Typography>

              {watches.length > 0 ? (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>MPN</TableCell>
                        <TableCell>Manufacturer</TableCell>
                        <TableCell>Watch Settings</TableCell>
                        <TableCell>Notes</TableCell>
                        <TableCell>Added</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {watches.map((watch) => (
                        <TableRow key={watch.id} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight={500}>
                              {watch.mpn || watch.component_id}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {watch.manufacturer || '-'}
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                              {watch.watch_lifecycle && <Chip label="Lifecycle" size="small" sx={{ height: 20 }} />}
                              {watch.watch_risk && <Chip label="Risk" size="small" sx={{ height: 20 }} />}
                              {watch.watch_price && <Chip label="Price" size="small" sx={{ height: 20 }} />}
                              {watch.watch_availability && <Chip label="Stock" size="small" sx={{ height: 20 }} />}
                              {watch.watch_compliance && <Chip label="Compliance" size="small" sx={{ height: 20 }} />}
                              {watch.watch_supply_chain && <Chip label="Supply Chain" size="small" sx={{ height: 20 }} />}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" color="text.secondary">
                              {watch.notes || '-'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption">
                              {new Date(watch.created_at).toLocaleDateString()}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Tooltip title="Remove Watch">
                              <IconButton
                                size="small"
                                onClick={() => handleRemoveWatch(watch.id)}
                                color="error"
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <VisibilityIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                  <Typography variant="body1" color="text.secondary">
                    No components being watched
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Add components to receive personalized alerts
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Add Watch Dialog */}
      <Dialog open={addWatchOpen} onClose={() => setAddWatchOpen(false)}>
        <DialogTitle>Add Component to Watch List</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enter the component ID to start receiving alerts for it.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="Component ID"
            value={newWatchComponentId}
            onChange={(e) => setNewWatchComponentId(e.target.value)}
            placeholder="Enter component UUID"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddWatchOpen(false)}>Cancel</Button>
          <Button
            onClick={handleAddWatch}
            variant="contained"
            disabled={!newWatchComponentId.trim()}
          >
            Add Watch
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AlertPreferencesPage;
