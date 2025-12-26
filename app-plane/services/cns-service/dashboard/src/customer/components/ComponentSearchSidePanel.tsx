/**
 * ComponentSearchSidePanel Component
 *
 * Sidebar filter panel for Customer Portal Component Search that provides
 * advanced filtering options similar to MyComponentVaultFilterPanel.
 *
 * Features:
 * - Lifecycle Status (Active, NRND, Obsolete, EOL, Unknown)
 * - Quality Score slider with quick select buttons
 * - Enrichment Status (Enriched, Pending, Failed)
 * - Compliance toggles (RoHS, REACH, AEC-Q)
 * - Manufacturer filter (faceted)
 * - Category filter (faceted)
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Checkbox,
  Chip,
  Divider,
  FormControlLabel,
  FormGroup,
  IconButton,
  Paper,
  Slider,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import SearchIcon from '@mui/icons-material/Search';

// Types for filter state
export interface LifecycleFilter {
  active: boolean;
  nrnd: boolean;
  obsolete: boolean;
  eol: boolean;
  unknown: boolean;
}

export interface EnrichmentStatusFilter {
  enriched: boolean;
  pending: boolean;
  failed: boolean;
}

export interface ComplianceFilter {
  rohs: boolean | null; // null = any, true = compliant, false = non-compliant
  reach: boolean | null;
  aecq: boolean | null;
}

export interface ComponentSearchFilters {
  lifecycle: LifecycleFilter;
  qualityScoreMin: number;
  enrichmentStatus: EnrichmentStatusFilter;
  compliance: ComplianceFilter;
  manufacturers: string[];
  categories: string[];
}

export interface ComponentSearchSidePanelProps {
  /** Current filter state */
  filters: ComponentSearchFilters;
  /** Callback when filters change */
  onFiltersChange: (filters: ComponentSearchFilters) => void;
  /** Available manufacturers for faceted filter */
  availableManufacturers?: string[];
  /** Available categories for faceted filter */
  availableCategories?: string[];
  /** Whether the panel is disabled */
  disabled?: boolean;
  /** Width of the sidebar */
  width?: number | string;
}

// Default filter state
export const defaultFilters: ComponentSearchFilters = {
  lifecycle: {
    active: false,
    nrnd: false,
    obsolete: false,
    eol: false,
    unknown: false,
  },
  qualityScoreMin: 0,
  enrichmentStatus: {
    enriched: false,
    pending: false,
    failed: false,
  },
  compliance: {
    rohs: null,
    reach: null,
    aecq: null,
  },
  manufacturers: [],
  categories: [],
};

// Quality score quick select options
const qualityScorePresets = [
  { label: 'Any', value: 0 },
  { label: '70%+', value: 70 },
  { label: '80%+', value: 80 },
  { label: '90%+', value: 90 },
  { label: '95%+', value: 95 },
];

// Lifecycle status options with colors
const lifecycleOptions = [
  { key: 'active', label: 'Active', color: 'success.main' },
  { key: 'nrnd', label: 'NRND', color: 'warning.main' },
  { key: 'obsolete', label: 'Obsolete', color: 'error.main' },
  { key: 'eol', label: 'EOL', color: 'error.light' },
  { key: 'unknown', label: 'Unknown', color: 'text.disabled' },
] as const;

// Enrichment status options with icons
const enrichmentOptions = [
  { key: 'enriched', label: 'Enriched', icon: CheckCircleIcon, color: 'success.main' },
  { key: 'pending', label: 'Pending', icon: WarningIcon, color: 'warning.main' },
  { key: 'failed', label: 'Failed', icon: ErrorIcon, color: 'error.main' },
] as const;

// Compliance options
const complianceOptions = [
  { key: 'rohs', label: 'RoHS', description: 'Restriction of Hazardous Substances' },
  { key: 'reach', label: 'REACH', description: 'Registration, Evaluation, Authorization of Chemicals' },
  { key: 'aecq', label: 'AEC-Q', description: 'Automotive Electronics Council Qualification' },
] as const;

export default function ComponentSearchSidePanel({
  filters,
  onFiltersChange,
  availableManufacturers = [],
  availableCategories = [],
  disabled = false,
  width = 280,
}: ComponentSearchSidePanelProps) {
  // Expanded accordion panels
  const [expandedPanels, setExpandedPanels] = useState<Set<string>>(
    new Set(['lifecycle', 'quality', 'enrichment', 'compliance'])
  );

  // Search inputs for faceted filters
  const [manufacturerSearch, setManufacturerSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    // Lifecycle
    if (Object.values(filters.lifecycle).some(Boolean)) count++;
    // Quality score
    if (filters.qualityScoreMin > 0) count++;
    // Enrichment status
    if (Object.values(filters.enrichmentStatus).some(Boolean)) count++;
    // Compliance
    if (Object.values(filters.compliance).some((v) => v !== null)) count++;
    // Manufacturers
    if (filters.manufacturers.length > 0) count++;
    // Categories
    if (filters.categories.length > 0) count++;
    return count;
  }, [filters]);

  // Toggle accordion panel
  const handlePanelToggle = useCallback((panel: string) => {
    setExpandedPanels((prev) => {
      const next = new Set(prev);
      if (next.has(panel)) {
        next.delete(panel);
      } else {
        next.add(panel);
      }
      return next;
    });
  }, []);

  // Update lifecycle filter
  const handleLifecycleChange = useCallback(
    (key: keyof LifecycleFilter) => {
      onFiltersChange({
        ...filters,
        lifecycle: {
          ...filters.lifecycle,
          [key]: !filters.lifecycle[key],
        },
      });
    },
    [filters, onFiltersChange]
  );

  // Update quality score
  const handleQualityScoreChange = useCallback(
    (_event: Event, value: number | number[]) => {
      onFiltersChange({
        ...filters,
        qualityScoreMin: value as number,
      });
    },
    [filters, onFiltersChange]
  );

  // Set quality score preset
  const handleQualityPreset = useCallback(
    (value: number) => {
      onFiltersChange({
        ...filters,
        qualityScoreMin: value,
      });
    },
    [filters, onFiltersChange]
  );

  // Update enrichment status
  const handleEnrichmentChange = useCallback(
    (key: keyof EnrichmentStatusFilter) => {
      onFiltersChange({
        ...filters,
        enrichmentStatus: {
          ...filters.enrichmentStatus,
          [key]: !filters.enrichmentStatus[key],
        },
      });
    },
    [filters, onFiltersChange]
  );

  // Update compliance filter (3-state: null -> true -> false -> null)
  const handleComplianceChange = useCallback(
    (key: keyof ComplianceFilter) => {
      const currentValue = filters.compliance[key];
      let newValue: boolean | null;
      if (currentValue === null) {
        newValue = true; // Any -> Compliant
      } else if (currentValue === true) {
        newValue = false; // Compliant -> Non-compliant
      } else {
        newValue = null; // Non-compliant -> Any
      }
      onFiltersChange({
        ...filters,
        compliance: {
          ...filters.compliance,
          [key]: newValue,
        },
      });
    },
    [filters, onFiltersChange]
  );

  // Toggle manufacturer selection
  const handleManufacturerToggle = useCallback(
    (manufacturer: string) => {
      const current = filters.manufacturers;
      const newManufacturers = current.includes(manufacturer)
        ? current.filter((m) => m !== manufacturer)
        : [...current, manufacturer];
      onFiltersChange({
        ...filters,
        manufacturers: newManufacturers,
      });
    },
    [filters, onFiltersChange]
  );

  // Toggle category selection
  const handleCategoryToggle = useCallback(
    (category: string) => {
      const current = filters.categories;
      const newCategories = current.includes(category)
        ? current.filter((c) => c !== category)
        : [...current, category];
      onFiltersChange({
        ...filters,
        categories: newCategories,
      });
    },
    [filters, onFiltersChange]
  );

  // Clear all filters
  const handleClearAll = useCallback(() => {
    onFiltersChange(defaultFilters);
    setManufacturerSearch('');
    setCategorySearch('');
  }, [onFiltersChange]);

  // Filter available manufacturers by search
  const filteredManufacturers = useMemo(() => {
    if (!manufacturerSearch.trim()) return availableManufacturers.slice(0, 20);
    const search = manufacturerSearch.toLowerCase();
    return availableManufacturers
      .filter((m) => m.toLowerCase().includes(search))
      .slice(0, 20);
  }, [availableManufacturers, manufacturerSearch]);

  // Filter available categories by search
  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return availableCategories.slice(0, 20);
    const search = categorySearch.toLowerCase();
    return availableCategories
      .filter((c) => c.toLowerCase().includes(search))
      .slice(0, 20);
  }, [availableCategories, categorySearch]);

  // Get compliance button color - MUI Button accepts: inherit, primary, secondary, success, error, info, warning (NOT 'default')
  const getComplianceColor = (value: boolean | null): 'inherit' | 'success' | 'error' => {
    if (value === true) return 'success';
    if (value === false) return 'error';
    return 'inherit';  // Use 'inherit' instead of 'default' for neutral state
  };

  // Get compliance button label
  const getComplianceLabel = (key: string, value: boolean | null): string => {
    const option = complianceOptions.find((o) => o.key === key);
    if (!option) return key;
    if (value === true) return `${option.label}: Yes`;
    if (value === false) return `${option.label}: No`;
    return option.label;
  };

  return (
    <Paper
      elevation={0}
      sx={{
        width,
        minWidth: width,
        maxWidth: width,
        height: '100%',
        borderRight: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        opacity: disabled ? 0.6 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: 'grey.50',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FilterListIcon color="primary" />
          <Typography variant="subtitle1" fontWeight={600}>
            Filters
          </Typography>
          {activeFilterCount > 0 && (
            <Chip
              label={activeFilterCount}
              size="small"
              color="primary"
              sx={{ height: 20, fontSize: '0.7rem' }}
            />
          )}
        </Box>
        {activeFilterCount > 0 && (
          <Tooltip title="Clear all filters">
            <IconButton size="small" onClick={handleClearAll}>
              <ClearIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Scrollable filter content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
        {/* Lifecycle Status */}
        <Accordion
          expanded={expandedPanels.has('lifecycle')}
          onChange={() => handlePanelToggle('lifecycle')}
          disableGutters
          elevation={0}
          sx={{ '&:before': { display: 'none' } }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2">Lifecycle Status</Typography>
            {Object.values(filters.lifecycle).some(Boolean) && (
              <Chip
                label={Object.values(filters.lifecycle).filter(Boolean).length}
                size="small"
                sx={{ ml: 1, height: 18, fontSize: '0.65rem' }}
              />
            )}
          </AccordionSummary>
          <AccordionDetails>
            <FormGroup>
              {lifecycleOptions.map((option) => (
                <FormControlLabel
                  key={option.key}
                  control={
                    <Checkbox
                      size="small"
                      checked={filters.lifecycle[option.key]}
                      onChange={() => handleLifecycleChange(option.key)}
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: option.color,
                        }}
                      />
                      <Typography variant="body2">{option.label}</Typography>
                    </Box>
                  }
                  sx={{ ml: 0 }}
                />
              ))}
            </FormGroup>
          </AccordionDetails>
        </Accordion>

        <Divider />

        {/* Quality Score */}
        <Accordion
          expanded={expandedPanels.has('quality')}
          onChange={() => handlePanelToggle('quality')}
          disableGutters
          elevation={0}
          sx={{ '&:before': { display: 'none' } }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2">Quality Score</Typography>
            {filters.qualityScoreMin > 0 && (
              <Chip
                label={`${filters.qualityScoreMin}%+`}
                size="small"
                color="primary"
                sx={{ ml: 1, height: 18, fontSize: '0.65rem' }}
              />
            )}
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ px: 1 }}>
              <Slider
                value={filters.qualityScoreMin}
                onChange={handleQualityScoreChange}
                valueLabelDisplay="auto"
                valueLabelFormat={(v) => `${v}%`}
                min={0}
                max={100}
                step={5}
                marks={[
                  { value: 0, label: '0%' },
                  { value: 50, label: '50%' },
                  { value: 100, label: '100%' },
                ]}
                sx={{ mt: 2 }}
              />
              <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 2 }}>
                {qualityScorePresets.map((preset) => (
                  <Button
                    key={preset.value}
                    size="small"
                    variant={filters.qualityScoreMin === preset.value ? 'contained' : 'outlined'}
                    onClick={() => handleQualityPreset(preset.value)}
                    sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: '0.7rem' }}
                  >
                    {preset.label}
                  </Button>
                ))}
              </Stack>
            </Box>
          </AccordionDetails>
        </Accordion>

        <Divider />

        {/* Enrichment Status */}
        <Accordion
          expanded={expandedPanels.has('enrichment')}
          onChange={() => handlePanelToggle('enrichment')}
          disableGutters
          elevation={0}
          sx={{ '&:before': { display: 'none' } }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2">Enrichment Status</Typography>
            {Object.values(filters.enrichmentStatus).some(Boolean) && (
              <Chip
                label={Object.values(filters.enrichmentStatus).filter(Boolean).length}
                size="small"
                sx={{ ml: 1, height: 18, fontSize: '0.65rem' }}
              />
            )}
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={1}>
              {enrichmentOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = filters.enrichmentStatus[option.key];
                return (
                  <Button
                    key={option.key}
                    size="small"
                    variant={isSelected ? 'contained' : 'outlined'}
                    color={isSelected ? 'primary' : 'inherit'}
                    startIcon={<Icon sx={{ color: isSelected ? 'inherit' : option.color }} />}
                    onClick={() => handleEnrichmentChange(option.key)}
                    sx={{
                      justifyContent: 'flex-start',
                      textTransform: 'none',
                    }}
                  >
                    {option.label}
                  </Button>
                );
              })}
            </Stack>
          </AccordionDetails>
        </Accordion>

        <Divider />

        {/* Compliance */}
        <Accordion
          expanded={expandedPanels.has('compliance')}
          onChange={() => handlePanelToggle('compliance')}
          disableGutters
          elevation={0}
          sx={{ '&:before': { display: 'none' } }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2">Compliance</Typography>
            {Object.values(filters.compliance).some((v) => v !== null) && (
              <Chip
                label={Object.values(filters.compliance).filter((v) => v !== null).length}
                size="small"
                sx={{ ml: 1, height: 18, fontSize: '0.65rem' }}
              />
            )}
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={1}>
              {complianceOptions.map((option) => (
                <Tooltip key={option.key} title={option.description} placement="right">
                  <Button
                    size="small"
                    variant="outlined"
                    color={getComplianceColor(filters.compliance[option.key as keyof ComplianceFilter])}
                    onClick={() => handleComplianceChange(option.key as keyof ComplianceFilter)}
                    endIcon={<HelpOutlineIcon sx={{ fontSize: 14 }} />}
                    sx={{
                      justifyContent: 'space-between',
                      textTransform: 'none',
                    }}
                  >
                    {getComplianceLabel(
                      option.key,
                      filters.compliance[option.key as keyof ComplianceFilter]
                    )}
                  </Button>
                </Tooltip>
              ))}
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                Click to cycle: Any → Yes → No → Any
              </Typography>
            </Stack>
          </AccordionDetails>
        </Accordion>

        <Divider />

        {/* Manufacturers */}
        <Accordion
          expanded={expandedPanels.has('manufacturers')}
          onChange={() => handlePanelToggle('manufacturers')}
          disableGutters
          elevation={0}
          sx={{ '&:before': { display: 'none' } }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2">Manufacturers</Typography>
            {filters.manufacturers.length > 0 && (
              <Chip
                label={filters.manufacturers.length}
                size="small"
                sx={{ ml: 1, height: 18, fontSize: '0.65rem' }}
              />
            )}
          </AccordionSummary>
          <AccordionDetails>
            <TextField
              size="small"
              placeholder="Search manufacturers..."
              value={manufacturerSearch}
              onChange={(e) => setManufacturerSearch(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.disabled', fontSize: 18 }} />,
              }}
              fullWidth
              sx={{ mb: 1 }}
            />
            <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
              {filteredManufacturers.length === 0 ? (
                <Typography variant="caption" color="text.disabled">
                  No manufacturers available
                </Typography>
              ) : (
                <FormGroup>
                  {filteredManufacturers.map((manufacturer) => (
                    <FormControlLabel
                      key={manufacturer}
                      control={
                        <Checkbox
                          size="small"
                          checked={filters.manufacturers.includes(manufacturer)}
                          onChange={() => handleManufacturerToggle(manufacturer)}
                        />
                      }
                      label={<Typography variant="body2">{manufacturer}</Typography>}
                      sx={{ ml: 0 }}
                    />
                  ))}
                </FormGroup>
              )}
            </Box>
          </AccordionDetails>
        </Accordion>

        <Divider />

        {/* Categories */}
        <Accordion
          expanded={expandedPanels.has('categories')}
          onChange={() => handlePanelToggle('categories')}
          disableGutters
          elevation={0}
          sx={{ '&:before': { display: 'none' } }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2">Categories</Typography>
            {filters.categories.length > 0 && (
              <Chip
                label={filters.categories.length}
                size="small"
                sx={{ ml: 1, height: 18, fontSize: '0.65rem' }}
              />
            )}
          </AccordionSummary>
          <AccordionDetails>
            <TextField
              size="small"
              placeholder="Search categories..."
              value={categorySearch}
              onChange={(e) => setCategorySearch(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.disabled', fontSize: 18 }} />,
              }}
              fullWidth
              sx={{ mb: 1 }}
            />
            <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
              {filteredCategories.length === 0 ? (
                <Typography variant="caption" color="text.disabled">
                  No categories available
                </Typography>
              ) : (
                <FormGroup>
                  {filteredCategories.map((category) => (
                    <FormControlLabel
                      key={category}
                      control={
                        <Checkbox
                          size="small"
                          checked={filters.categories.includes(category)}
                          onChange={() => handleCategoryToggle(category)}
                        />
                      }
                      label={<Typography variant="body2">{category}</Typography>}
                      sx={{ ml: 0 }}
                    />
                  ))}
                </FormGroup>
              )}
            </Box>
          </AccordionDetails>
        </Accordion>
      </Box>

      {/* Footer with active filter summary */}
      {activeFilterCount > 0 && (
        <Box
          sx={{
            p: 1.5,
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: 'grey.50',
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Active filters: {activeFilterCount}
          </Typography>
          <Button
            size="small"
            variant="outlined"
            color="secondary"
            startIcon={<ClearIcon />}
            onClick={handleClearAll}
            fullWidth
          >
            Clear All Filters
          </Button>
        </Box>
      )}
    </Paper>
  );
}

// Display name for React DevTools
ComponentSearchSidePanel.displayName = 'ComponentSearchSidePanel';
