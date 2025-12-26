/**
 * Risk Profile Settings Page
 *
 * Allows organization admins to configure risk calculation parameters:
 * - Risk factor weights (lifecycle, supply chain, compliance, obsolescence, single source)
 * - Risk level thresholds (low, medium, high, critical)
 * - BOM health grade thresholds
 * - Contextual scoring settings
 * - Industry presets
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Slider,
  Button,
  Alert,
  CircularProgress,
  Divider,
  Switch,
  FormControlLabel,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Tooltip,
  IconButton,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  LinearProgress,
} from '@mui/material';
import { useNotify } from 'react-admin';
import SaveIcon from '@mui/icons-material/Save';
import RestoreIcon from '@mui/icons-material/Restore';
import TuneIcon from '@mui/icons-material/Tune';
import InfoIcon from '@mui/icons-material/Info';
import HistoryIcon from '@mui/icons-material/History';
import BusinessIcon from '@mui/icons-material/Business';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import FlightIcon from '@mui/icons-material/Flight';
import DevicesIcon from '@mui/icons-material/Devices';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import {
  riskApi,
  RiskProfile,
  RiskPreset,
  RiskWeights,
  RiskThresholds,
  BOMHealthThresholds,
} from '../services/riskService';

// Risk factor colors
const FACTOR_COLORS = {
  lifecycle: '#2196f3',
  supply_chain: '#ff9800',
  compliance: '#4caf50',
  obsolescence: '#f44336',
  single_source: '#9c27b0',
};

const FACTOR_LABELS = {
  lifecycle: 'Lifecycle Risk',
  supply_chain: 'Supply Chain Risk',
  compliance: 'Compliance Risk',
  obsolescence: 'Obsolescence Risk',
  single_source: 'Single Source Risk',
};

const FACTOR_DESCRIPTIONS = {
  lifecycle: 'Risk from component end-of-life status (Active, NRND, Obsolete)',
  supply_chain: 'Risk from stock availability and lead time concerns',
  compliance: 'Risk from RoHS, REACH, and other regulatory compliance',
  obsolescence: 'Predicted risk of component becoming obsolete',
  single_source: 'Risk from limited supplier diversity',
};

// Industry preset icons
const PRESET_ICONS: Record<string, React.ReactNode> = {
  automotive: <DirectionsCarIcon />,
  medical: <LocalHospitalIcon />,
  aerospace: <FlightIcon />,
  consumer: <DevicesIcon />,
  industrial: <PrecisionManufacturingIcon />,
  default: <BusinessIcon />,
};

export const RiskProfileSettings: React.FC = () => {
  const notify = useNotify();

  // Loading states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Profile data
  const [profile, setProfile] = useState<RiskProfile | null>(null);
  const [presets, setPresets] = useState<RiskPreset[]>([]);

  // Local edit state (tracks unsaved changes)
  const [weights, setWeights] = useState<RiskWeights>({
    lifecycle: 30,
    supply_chain: 25,
    compliance: 20,
    obsolescence: 15,
    single_source: 10,
  });
  const [thresholds, setThresholds] = useState<RiskThresholds>({
    low_max: 30,
    medium_max: 60,
    high_max: 85,
  });
  const [bomHealthThresholds, setBomHealthThresholds] = useState<BOMHealthThresholds>({
    a_grade_max_high_pct: 5,
    b_grade_max_high_pct: 10,
    c_grade_max_high_pct: 20,
    d_grade_max_high_pct: 35,
  });
  const [enableContextualScoring, setEnableContextualScoring] = useState(true);
  const [quantityImpactWeight, setQuantityImpactWeight] = useState(0.2);
  const [leadTimeImpactWeight, setLeadTimeImpactWeight] = useState(0.15);
  const [criticalityImpactWeight, setCriticalityImpactWeight] = useState(0.3);

  // Dialogs
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showPresetDialog, setShowPresetDialog] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<RiskPreset | null>(null);

  // Track if there are unsaved changes
  const [hasChanges, setHasChanges] = useState(false);

  // Load profile and presets on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [profileData, presetsData] = await Promise.all([
        riskApi.getRiskProfile(),
        riskApi.getRiskPresets(),
      ]);

      setProfile(profileData);
      setPresets(presetsData);

      // Initialize local state from profile
      setWeights(profileData.weights);
      setThresholds(profileData.thresholds);
      setBomHealthThresholds(profileData.bom_health_thresholds);
      setEnableContextualScoring(profileData.enable_contextual_scoring);
      setQuantityImpactWeight(profileData.quantity_impact_weight);
      setLeadTimeImpactWeight(profileData.lead_time_impact_weight);
      setCriticalityImpactWeight(profileData.criticality_impact_weight);
      setHasChanges(false);
    } catch (err: any) {
      console.error('Failed to load risk profile:', err);
      setError(err.message || 'Failed to load risk profile configuration');
    } finally {
      setLoading(false);
    }
  };

  // Calculate total weight
  const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
  const isWeightValid = Math.abs(totalWeight - 100) < 0.01;

  // Handle weight change with validation
  const handleWeightChange = (factor: keyof RiskWeights, value: number) => {
    setWeights(prev => ({ ...prev, [factor]: value }));
    setHasChanges(true);
  };

  // Auto-balance weights to sum to 100
  const autoBalanceWeights = () => {
    const factors = Object.keys(weights) as (keyof RiskWeights)[];
    const currentTotal = Object.values(weights).reduce((sum, w) => sum + w, 0);

    if (currentTotal === 0) {
      // Equal distribution
      const equalWeight = 100 / factors.length;
      const newWeights: RiskWeights = {} as RiskWeights;
      factors.forEach(f => { newWeights[f] = Math.round(equalWeight); });
      setWeights(newWeights);
    } else {
      // Proportional scaling
      const scale = 100 / currentTotal;
      const newWeights: RiskWeights = {} as RiskWeights;
      factors.forEach(f => { newWeights[f] = Math.round(weights[f] * scale); });

      // Adjust for rounding errors
      const newTotal = Object.values(newWeights).reduce((sum, w) => sum + w, 0);
      const diff = 100 - newTotal;
      if (diff !== 0) {
        // Add/subtract difference from largest weight
        const maxFactor = factors.reduce((a, b) => newWeights[a] > newWeights[b] ? a : b);
        newWeights[maxFactor] += diff;
      }
      setWeights(newWeights);
    }
    setHasChanges(true);
  };

  // Handle threshold change
  const handleThresholdChange = (field: keyof RiskThresholds, value: number) => {
    setThresholds(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  // Handle BOM health threshold change
  const handleBomHealthChange = (field: keyof BOMHealthThresholds, value: number) => {
    setBomHealthThresholds(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  // Save profile
  const handleSave = async () => {
    if (!isWeightValid) {
      notify('Weights must sum to 100%. Please adjust your weights.', { type: 'error' });
      return;
    }

    setSaving(true);
    try {
      const updatedProfile = await riskApi.updateRiskProfile({
        weights,
        thresholds,
        bom_health_thresholds: bomHealthThresholds,
        enable_contextual_scoring: enableContextualScoring,
        quantity_impact_weight: quantityImpactWeight,
        lead_time_impact_weight: leadTimeImpactWeight,
        criticality_impact_weight: criticalityImpactWeight,
      });

      setProfile(updatedProfile);
      setHasChanges(false);
      notify('Risk profile saved successfully!', { type: 'success' });
    } catch (err: any) {
      console.error('Failed to save risk profile:', err);
      notify(err.message || 'Failed to save risk profile', { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Reset to defaults
  const handleReset = async () => {
    setShowResetDialog(false);
    setSaving(true);
    try {
      const resetProfile = await riskApi.resetRiskProfile();
      setProfile(resetProfile);
      setWeights(resetProfile.weights);
      setThresholds(resetProfile.thresholds);
      setBomHealthThresholds(resetProfile.bom_health_thresholds);
      setEnableContextualScoring(resetProfile.enable_contextual_scoring);
      setQuantityImpactWeight(resetProfile.quantity_impact_weight);
      setLeadTimeImpactWeight(resetProfile.lead_time_impact_weight);
      setCriticalityImpactWeight(resetProfile.criticality_impact_weight);
      setHasChanges(false);
      notify('Risk profile reset to defaults', { type: 'success' });
    } catch (err: any) {
      console.error('Failed to reset risk profile:', err);
      notify(err.message || 'Failed to reset risk profile', { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Apply preset
  const handleApplyPreset = async () => {
    if (!selectedPreset) return;

    setShowPresetDialog(false);
    setSaving(true);
    try {
      // Pass the industry/preset name (e.g., "automotive", "medical") not the ID
      const updatedProfile = await riskApi.applyRiskPreset(selectedPreset.industry);
      setProfile(updatedProfile);
      setWeights(updatedProfile.weights);
      setThresholds(updatedProfile.thresholds);
      setBomHealthThresholds(updatedProfile.bom_health_thresholds);
      setHasChanges(false);
      notify(`Applied ${selectedPreset.name} preset successfully!`, { type: 'success' });
    } catch (err: any) {
      console.error('Failed to apply preset:', err);
      notify(err.message || 'Failed to apply preset', { type: 'error' });
    } finally {
      setSaving(false);
      setSelectedPreset(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            <TuneIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Risk Profile Settings
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Configure how risk scores are calculated for your organization
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<RestoreIcon />}
            onClick={() => setShowResetDialog(true)}
            disabled={saving}
          >
            Reset to Defaults
          </Button>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving || !hasChanges || !isWeightValid}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {hasChanges && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          You have unsaved changes. Click "Save Changes" to apply them.
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Risk Factor Weights */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" fontWeight={600}>
                  Risk Factor Weights
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    label={`Total: ${totalWeight}%`}
                    color={isWeightValid ? 'success' : 'error'}
                    size="small"
                  />
                  {!isWeightValid && (
                    <Button size="small" onClick={autoBalanceWeights}>
                      Auto-balance
                    </Button>
                  )}
                </Box>
              </Box>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Adjust the importance of each risk factor. Total must equal 100%.
              </Typography>

              {(Object.keys(FACTOR_LABELS) as (keyof RiskWeights)[]).map((factor) => (
                <Box key={factor} sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          bgcolor: FACTOR_COLORS[factor],
                        }}
                      />
                      <Typography variant="body2" fontWeight={500}>
                        {FACTOR_LABELS[factor]}
                      </Typography>
                      <Tooltip title={FACTOR_DESCRIPTIONS[factor]}>
                        <IconButton size="small">
                          <InfoIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    <Typography variant="body2" fontWeight={600}>
                      {weights[factor]}%
                    </Typography>
                  </Box>
                  <Slider
                    value={weights[factor]}
                    onChange={(_, value) => handleWeightChange(factor, value as number)}
                    min={0}
                    max={100}
                    step={1}
                    sx={{
                      color: FACTOR_COLORS[factor],
                      '& .MuiSlider-thumb': {
                        bgcolor: FACTOR_COLORS[factor],
                      },
                    }}
                  />
                </Box>
              ))}

              {/* Visual weight distribution bar */}
              <Box sx={{ mt: 3 }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                  Weight Distribution
                </Typography>
                <Box sx={{ display: 'flex', height: 24, borderRadius: 1, overflow: 'hidden' }}>
                  {(Object.keys(FACTOR_COLORS) as (keyof RiskWeights)[]).map((factor) => (
                    <Tooltip key={factor} title={`${FACTOR_LABELS[factor]}: ${weights[factor]}%`}>
                      <Box
                        sx={{
                          width: `${weights[factor]}%`,
                          bgcolor: FACTOR_COLORS[factor],
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </Tooltip>
                  ))}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Risk Level Thresholds */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Risk Level Thresholds
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Define score ranges for each risk level (0-100 scale).
              </Typography>

              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" fontWeight={500} gutterBottom>
                  Low Risk: 0 - {thresholds.low_max}
                </Typography>
                <Slider
                  value={thresholds.low_max}
                  onChange={(_, value) => handleThresholdChange('low_max', value as number)}
                  min={10}
                  max={50}
                  sx={{ color: '#4caf50' }}
                />
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" fontWeight={500} gutterBottom>
                  Medium Risk: {thresholds.low_max + 1} - {thresholds.medium_max}
                </Typography>
                <Slider
                  value={thresholds.medium_max}
                  onChange={(_, value) => handleThresholdChange('medium_max', value as number)}
                  min={thresholds.low_max + 10}
                  max={80}
                  sx={{ color: '#ff9800' }}
                />
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" fontWeight={500} gutterBottom>
                  High Risk: {thresholds.medium_max + 1} - {thresholds.high_max}
                </Typography>
                <Slider
                  value={thresholds.high_max}
                  onChange={(_, value) => handleThresholdChange('high_max', value as number)}
                  min={thresholds.medium_max + 5}
                  max={95}
                  sx={{ color: '#f44336' }}
                />
              </Box>

              <Box>
                <Typography variant="body2" fontWeight={500} gutterBottom>
                  Critical Risk: {thresholds.high_max + 1} - 100
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={100}
                  sx={{
                    height: 8,
                    borderRadius: 1,
                    bgcolor: 'action.disabledBackground',
                    '& .MuiLinearProgress-bar': { bgcolor: 'secondary.main' },
                  }}
                />
              </Box>

              {/* Visual threshold ranges */}
              <Box sx={{ mt: 4 }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                  Risk Score Ranges
                </Typography>
                <Box sx={{ display: 'flex', height: 32, borderRadius: 1, overflow: 'hidden' }}>
                  <Tooltip title={`Low: 0-${thresholds.low_max}`}>
                    <Box sx={{ width: `${thresholds.low_max}%`, bgcolor: '#4caf50', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography variant="caption" sx={{ color: 'white', fontWeight: 600 }}>Low</Typography>
                    </Box>
                  </Tooltip>
                  <Tooltip title={`Medium: ${thresholds.low_max + 1}-${thresholds.medium_max}`}>
                    <Box sx={{ width: `${thresholds.medium_max - thresholds.low_max}%`, bgcolor: '#ff9800', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography variant="caption" sx={{ color: 'white', fontWeight: 600 }}>Medium</Typography>
                    </Box>
                  </Tooltip>
                  <Tooltip title={`High: ${thresholds.medium_max + 1}-${thresholds.high_max}`}>
                    <Box sx={{ width: `${thresholds.high_max - thresholds.medium_max}%`, bgcolor: '#f44336', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography variant="caption" sx={{ color: 'white', fontWeight: 600 }}>High</Typography>
                    </Box>
                  </Tooltip>
                  <Tooltip title={`Critical: ${thresholds.high_max + 1}-100`}>
                    <Box sx={{ width: `${100 - thresholds.high_max}%`, bgcolor: '#9c27b0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography variant="caption" sx={{ color: 'white', fontWeight: 600 }}>Critical</Typography>
                    </Box>
                  </Tooltip>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* BOM Health Grade Thresholds */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                BOM Health Grade Thresholds
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Define maximum percentage of high+critical risk components for each grade.
              </Typography>

              {[
                { key: 'a_grade_max_high_pct' as const, label: 'A Grade', color: '#4caf50' },
                { key: 'b_grade_max_high_pct' as const, label: 'B Grade', color: '#8bc34a' },
                { key: 'c_grade_max_high_pct' as const, label: 'C Grade', color: '#ff9800' },
                { key: 'd_grade_max_high_pct' as const, label: 'D Grade', color: '#f44336' },
              ].map(({ key, label, color }) => (
                <Box key={key} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label={label.split(' ')[0]}
                        size="small"
                        sx={{ bgcolor: color, color: 'white', fontWeight: 600 }}
                      />
                      <Typography variant="body2">
                        Max {bomHealthThresholds[key]}% high-risk components
                      </Typography>
                    </Box>
                  </Box>
                  <Slider
                    value={bomHealthThresholds[key]}
                    onChange={(_, value) => handleBomHealthChange(key, value as number)}
                    min={0}
                    max={50}
                    sx={{ color }}
                  />
                </Box>
              ))}

              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="caption">
                  Grade F is assigned when high-risk percentage exceeds D grade threshold.
                </Typography>
              </Alert>
            </CardContent>
          </Card>
        </Grid>

        {/* Contextual Scoring Settings */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Contextual Scoring
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Adjust risk scores based on BOM line item context (quantity, lead time, criticality).
              </Typography>

              <FormControlLabel
                control={
                  <Switch
                    checked={enableContextualScoring}
                    onChange={(e) => {
                      setEnableContextualScoring(e.target.checked);
                      setHasChanges(true);
                    }}
                  />
                }
                label="Enable Contextual Scoring"
                sx={{ mb: 2 }}
              />

              {enableContextualScoring && (
                <>
                  <Divider sx={{ my: 2 }} />

                  <Box sx={{ mb: 3 }}>
                    <Typography variant="body2" fontWeight={500} gutterBottom>
                      Quantity Impact Weight: {(quantityImpactWeight * 100).toFixed(0)}%
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                      Higher quantities increase contextual risk
                    </Typography>
                    <Slider
                      value={quantityImpactWeight}
                      onChange={(_, value) => {
                        setQuantityImpactWeight(value as number);
                        setHasChanges(true);
                      }}
                      min={0}
                      max={0.5}
                      step={0.05}
                    />
                  </Box>

                  <Box sx={{ mb: 3 }}>
                    <Typography variant="body2" fontWeight={500} gutterBottom>
                      Lead Time Impact Weight: {(leadTimeImpactWeight * 100).toFixed(0)}%
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                      Longer lead times increase contextual risk
                    </Typography>
                    <Slider
                      value={leadTimeImpactWeight}
                      onChange={(_, value) => {
                        setLeadTimeImpactWeight(value as number);
                        setHasChanges(true);
                      }}
                      min={0}
                      max={0.5}
                      step={0.05}
                    />
                  </Box>

                  <Box>
                    <Typography variant="body2" fontWeight={500} gutterBottom>
                      Criticality Impact Weight: {(criticalityImpactWeight * 100).toFixed(0)}%
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                      Critical components get higher risk weighting
                    </Typography>
                    <Slider
                      value={criticalityImpactWeight}
                      onChange={(_, value) => {
                        setCriticalityImpactWeight(value as number);
                        setHasChanges(true);
                      }}
                      min={0}
                      max={0.5}
                      step={0.05}
                    />
                  </Box>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Industry Presets */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Industry Presets
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Apply pre-configured settings optimized for specific industries.
              </Typography>

              <Grid container spacing={2}>
                {presets.map((preset) => (
                  <Grid item xs={12} sm={6} md={4} lg={2.4} key={preset.id}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        '&:hover': {
                          borderColor: 'primary.main',
                          bgcolor: 'primary.50',
                        },
                      }}
                      onClick={() => {
                        setSelectedPreset(preset);
                        setShowPresetDialog(true);
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Box sx={{ color: 'primary.main' }}>
                          {PRESET_ICONS[preset.industry] || PRESET_ICONS.default}
                        </Box>
                        <Typography variant="subtitle2" fontWeight={600}>
                          {preset.name}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {preset.description}
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Reset Confirmation Dialog */}
      <Dialog open={showResetDialog} onClose={() => setShowResetDialog(false)}>
        <DialogTitle>Reset to Defaults?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will reset all risk profile settings to their default values. This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowResetDialog(false)}>Cancel</Button>
          <Button onClick={handleReset} color="error" variant="contained">
            Reset
          </Button>
        </DialogActions>
      </Dialog>

      {/* Apply Preset Dialog */}
      <Dialog open={showPresetDialog} onClose={() => setShowPresetDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Apply {selectedPreset?.name}?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            This will update your risk profile with settings optimized for the {selectedPreset?.industry} industry.
          </DialogContentText>

          {selectedPreset && (
            <Box sx={{ bgcolor: 'background.paper', p: 2, borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Preset Configuration:
              </Typography>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Lifecycle Weight</Typography>
                  <Typography variant="body2">{selectedPreset.weights.lifecycle}%</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Supply Chain Weight</Typography>
                  <Typography variant="body2">{selectedPreset.weights.supply_chain}%</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Compliance Weight</Typography>
                  <Typography variant="body2">{selectedPreset.weights.compliance}%</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Obsolescence Weight</Typography>
                  <Typography variant="body2">{selectedPreset.weights.obsolescence}%</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Single Source Weight</Typography>
                  <Typography variant="body2">{selectedPreset.weights.single_source}%</Typography>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPresetDialog(false)}>Cancel</Button>
          <Button onClick={handleApplyPreset} color="primary" variant="contained">
            Apply Preset
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RiskProfileSettings;
