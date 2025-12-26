/**
 * ParametricSearchPanel Component
 *
 * P1-1: Advanced left-rail filter panel with dynamic facets.
 * Shows facet counts, supports checkbox/chip/range/toggle filters.
 *
 * Features:
 * - Dynamic facet counts from search results
 * - Collapsible accordion sections
 * - Active filter badges
 * - Clear all filters
 * - Category and manufacturer multi-select
 * - Quality score slider
 * - Stock availability toggle
 */

import React, { useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Slider,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Button,
  Switch,
  Badge,
  Skeleton,
  Tooltip,
  TextField,
  InputAdornment,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import ClearAllIcon from '@mui/icons-material/ClearAll';
import SearchIcon from '@mui/icons-material/Search';
import InventoryIcon from '@mui/icons-material/Inventory';
import VerifiedIcon from '@mui/icons-material/Verified';
import type {
  ParametricFilterState,
  SearchFacet,
  FacetValue,
} from '../../hooks/useParametricSearch';

export interface ParametricSearchPanelProps {
  /** Current filter state */
  filters: ParametricFilterState;
  /** Callback when filters change */
  onFilterChange: (filters: Partial<ParametricFilterState>) => void;
  /** Facets from search results */
  facets: SearchFacet[];
  /** Whether search is loading */
  loading?: boolean;
  /** Number of filtered results */
  filteredCount?: number;
  /** Total results before filtering */
  totalCount?: number;
  /** Panel width */
  width?: number;
}

/** Predefined lifecycle statuses */
const LIFECYCLE_STATUSES = ['Active', 'NRND', 'Obsolete', 'EOL', 'Unknown'];

/** Predefined risk levels */
const RISK_LEVELS = ['Low', 'Medium', 'High', 'Critical'];

/** Predefined compliance flags */
const COMPLIANCE_FLAGS = ['RoHS', 'REACH', 'Halogen-Free', 'AEC-Q100', 'AEC-Q200'];

/**
 * Get color for lifecycle status chip
 */
function getLifecycleColor(
  status: string
): 'success' | 'warning' | 'error' | 'default' {
  switch (status) {
    case 'Active':
      return 'success';
    case 'NRND':
      return 'warning';
    case 'Obsolete':
    case 'EOL':
      return 'error';
    default:
      return 'default';
  }
}

/**
 * Get color for risk level chip
 */
function getRiskColor(level: string): 'success' | 'warning' | 'error' | 'default' {
  switch (level) {
    case 'Low':
      return 'success';
    case 'Medium':
      return 'warning';
    case 'High':
    case 'Critical':
      return 'error';
    default:
      return 'default';
  }
}

/**
 * Facet section with checkbox list
 */
function CheckboxFacetSection({
  facet,
  selectedValues,
  onToggle,
  maxVisible = 5,
}: {
  facet: SearchFacet;
  selectedValues: string[];
  onToggle: (value: string) => void;
  maxVisible?: number;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');

  const filteredValues = useMemo(() => {
    if (!searchTerm) return facet.values;
    return facet.values.filter((v) =>
      v.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [facet.values, searchTerm]);

  const visibleValues = expanded
    ? filteredValues
    : filteredValues.slice(0, maxVisible);
  const hasMore = filteredValues.length > maxVisible;

  return (
    <Box>
      {facet.values.length > 10 && (
        <TextField
          size="small"
          placeholder={`Search ${facet.label.toLowerCase()}...`}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" color="disabled" />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 1, width: '100%' }}
        />
      )}
      <FormGroup>
        {visibleValues.map((fv) => (
          <FormControlLabel
            key={fv.value}
            control={
              <Checkbox
                size="small"
                checked={selectedValues.includes(fv.value)}
                onChange={() => onToggle(fv.value)}
              />
            }
            label={
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  width: '100%',
                  alignItems: 'center',
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: 140,
                  }}
                  title={fv.label}
                >
                  {fv.label}
                </Typography>
                <Chip
                  label={fv.count}
                  size="small"
                  sx={{ height: 18, fontSize: '0.7rem', ml: 0.5 }}
                />
              </Box>
            }
            sx={{ mr: 0 }}
          />
        ))}
      </FormGroup>
      {hasMore && (
        <Button
          size="small"
          onClick={() => setExpanded(!expanded)}
          sx={{ mt: 0.5, textTransform: 'none' }}
        >
          {expanded
            ? 'Show less'
            : `Show ${filteredValues.length - maxVisible} more`}
        </Button>
      )}
    </Box>
  );
}

/**
 * Facet section with chips (toggle style)
 */
function ChipFacetSection({
  values,
  selectedValues,
  onToggle,
  getColor,
}: {
  values: FacetValue[];
  selectedValues: string[];
  onToggle: (value: string) => void;
  getColor?: (value: string) => 'success' | 'warning' | 'error' | 'default';
}) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
      {values.map((fv) => {
        const isSelected = selectedValues.includes(fv.value);
        const color = getColor?.(fv.value) || 'default';
        return (
          <Tooltip key={fv.value} title={`${fv.count} components`}>
            <Badge
              badgeContent={fv.count}
              max={999}
              color="primary"
              sx={{
                '& .MuiBadge-badge': {
                  fontSize: '0.65rem',
                  height: 16,
                  minWidth: 16,
                  display: isSelected ? 'flex' : 'none',
                },
              }}
            >
              <Chip
                label={fv.label}
                size="small"
                color={isSelected ? color : 'default'}
                variant={isSelected ? 'filled' : 'outlined'}
                onClick={() => onToggle(fv.value)}
                sx={{ cursor: 'pointer' }}
              />
            </Badge>
          </Tooltip>
        );
      })}
    </Box>
  );
}

export function ParametricSearchPanel({
  filters,
  onFilterChange,
  facets,
  loading = false,
  filteredCount,
  totalCount,
  width = 300,
}: ParametricSearchPanelProps) {
  // Calculate active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.suppliers.length) count++;
    if (filters.lifecycleStatuses.length) count++;
    if (filters.complianceFlags.length) count++;
    if (filters.riskLevels.length) count++;
    if (filters.priceRange[0] > 0 || filters.priceRange[1] < 1000) count++;
    if (filters.stockAvailable) count++;
    if (filters.inProduction) count++;
    if (filters.qualityScoreMin > 0) count++;
    if (filters.leadTimeDaysMax !== null) count++;
    if (filters.categories.length) count++;
    if (filters.manufacturers.length) count++;
    return count;
  }, [filters]);

  // Get facet by name
  const getFacet = useCallback(
    (name: string): SearchFacet | undefined =>
      facets.find((f) => f.name === name),
    [facets]
  );

  // Toggle handlers
  const handleArrayToggle = useCallback(
    (field: keyof ParametricFilterState, value: string) => {
      const current = filters[field] as string[];
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      onFilterChange({ [field]: updated });
    },
    [filters, onFilterChange]
  );

  const handleClearAll = useCallback(() => {
    onFilterChange({
      suppliers: [],
      lifecycleStatuses: [],
      complianceFlags: [],
      priceRange: [0, 1000],
      riskLevels: [],
      stockAvailable: false,
      inProduction: false,
      qualityScoreMin: 0,
      leadTimeDaysMax: null,
      categories: [],
      manufacturers: [],
    });
  }, [onFilterChange]);

  // Manufacturer facet data
  const manufacturerFacet = getFacet('manufacturers');
  const categoryFacet = getFacet('categories');
  const supplierFacet = getFacet('suppliers');
  const lifecycleFacet = getFacet('lifecycleStatuses');
  const riskFacet = getFacet('riskLevels');
  const complianceFacet = getFacet('complianceFlags');

  return (
    <Box
      sx={{
        width,
        flexShrink: 0,
        borderRight: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        height: '100%',
        overflow: 'auto',
      }}
      role="complementary"
      aria-label="Search filters"
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: 1,
          borderColor: 'divider',
          position: 'sticky',
          top: 0,
          bgcolor: 'background.paper',
          zIndex: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FilterAltIcon color="primary" />
          <Typography variant="subtitle1" fontWeight={600}>
            Filters
          </Typography>
          {activeFilterCount > 0 && (
            <Chip
              label={activeFilterCount}
              size="small"
              color="primary"
              aria-label={`${activeFilterCount} active filters`}
            />
          )}
        </Box>
        {activeFilterCount > 0 && (
          <Button
            size="small"
            startIcon={<ClearAllIcon />}
            onClick={handleClearAll}
            aria-label="Clear all filters"
          >
            Clear
          </Button>
        )}
      </Box>

      {/* Results count */}
      {filteredCount !== undefined && totalCount !== undefined && (
        <Box sx={{ px: 2, py: 1, bgcolor: 'action.hover' }}>
          <Typography variant="body2" color="text.secondary">
            Showing{' '}
            <strong>
              {filteredCount} of {totalCount}
            </strong>{' '}
            components
          </Typography>
        </Box>
      )}

      {/* Quick toggles */}
      <Box sx={{ px: 2, py: 1.5 }}>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={filters.stockAvailable}
              onChange={(e) =>
                onFilterChange({ stockAvailable: e.target.checked })
              }
            />
          }
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <InventoryIcon fontSize="small" color="action" />
              <Typography variant="body2">In Stock Only</Typography>
            </Box>
          }
        />
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={filters.inProduction}
              onChange={(e) =>
                onFilterChange({ inProduction: e.target.checked })
              }
            />
          }
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <VerifiedIcon fontSize="small" color="action" />
              <Typography variant="body2">Active Parts Only</Typography>
            </Box>
          }
        />
      </Box>

      <Divider />

      {/* Manufacturer Filter */}
      {loading ? (
        <Box sx={{ p: 2 }}>
          <Skeleton variant="text" width={100} />
          <Skeleton variant="rectangular" height={120} sx={{ mt: 1 }} />
        </Box>
      ) : manufacturerFacet && manufacturerFacet.values.length > 0 ? (
        <>
          <Accordion defaultExpanded disableGutters elevation={0}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="body2" fontWeight={600}>
                Manufacturer
              </Typography>
              {filters.manufacturers.length > 0 && (
                <Chip
                  label={filters.manufacturers.length}
                  size="small"
                  color="primary"
                  sx={{ ml: 1, height: 20 }}
                />
              )}
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              <CheckboxFacetSection
                facet={manufacturerFacet}
                selectedValues={filters.manufacturers}
                onToggle={(v) => handleArrayToggle('manufacturers', v)}
              />
            </AccordionDetails>
          </Accordion>
          <Divider />
        </>
      ) : null}

      {/* Category Filter */}
      {categoryFacet && categoryFacet.values.length > 0 && (
        <>
          <Accordion disableGutters elevation={0}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="body2" fontWeight={600}>
                Category
              </Typography>
              {filters.categories.length > 0 && (
                <Chip
                  label={filters.categories.length}
                  size="small"
                  color="primary"
                  sx={{ ml: 1, height: 20 }}
                />
              )}
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              <CheckboxFacetSection
                facet={categoryFacet}
                selectedValues={filters.categories}
                onToggle={(v) => handleArrayToggle('categories', v)}
              />
            </AccordionDetails>
          </Accordion>
          <Divider />
        </>
      )}

      {/* Supplier Filter */}
      {supplierFacet && supplierFacet.values.length > 0 && (
        <>
          <Accordion disableGutters elevation={0}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="body2" fontWeight={600}>
                Supplier
              </Typography>
              {filters.suppliers.length > 0 && (
                <Chip
                  label={filters.suppliers.length}
                  size="small"
                  color="primary"
                  sx={{ ml: 1, height: 20 }}
                />
              )}
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              <CheckboxFacetSection
                facet={supplierFacet}
                selectedValues={filters.suppliers}
                onToggle={(v) => handleArrayToggle('suppliers', v)}
              />
            </AccordionDetails>
          </Accordion>
          <Divider />
        </>
      )}

      {/* Lifecycle Status Filter */}
      <Accordion defaultExpanded disableGutters elevation={0}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="body2" fontWeight={600}>
            Lifecycle Status
          </Typography>
          {filters.lifecycleStatuses.length > 0 && (
            <Chip
              label={filters.lifecycleStatuses.length}
              size="small"
              color="primary"
              sx={{ ml: 1, height: 20 }}
            />
          )}
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0 }}>
          <ChipFacetSection
            values={
              lifecycleFacet?.values ||
              LIFECYCLE_STATUSES.map((s) => ({ value: s, label: s, count: 0 }))
            }
            selectedValues={filters.lifecycleStatuses}
            onToggle={(v) => handleArrayToggle('lifecycleStatuses', v)}
            getColor={getLifecycleColor}
          />
        </AccordionDetails>
      </Accordion>

      <Divider />

      {/* Risk Level Filter */}
      <Accordion disableGutters elevation={0}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="body2" fontWeight={600}>
            Risk Level
          </Typography>
          {filters.riskLevels.length > 0 && (
            <Chip
              label={filters.riskLevels.length}
              size="small"
              color="primary"
              sx={{ ml: 1, height: 20 }}
            />
          )}
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0 }}>
          <ChipFacetSection
            values={
              riskFacet?.values ||
              RISK_LEVELS.map((l) => ({ value: l, label: l, count: 0 }))
            }
            selectedValues={filters.riskLevels}
            onToggle={(v) => handleArrayToggle('riskLevels', v)}
            getColor={getRiskColor}
          />
        </AccordionDetails>
      </Accordion>

      <Divider />

      {/* Compliance Filter */}
      <Accordion disableGutters elevation={0}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="body2" fontWeight={600}>
            Compliance
          </Typography>
          {filters.complianceFlags.length > 0 && (
            <Chip
              label={filters.complianceFlags.length}
              size="small"
              color="primary"
              sx={{ ml: 1, height: 20 }}
            />
          )}
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0 }}>
          <FormGroup>
            {(complianceFacet?.values || COMPLIANCE_FLAGS.map((f) => ({ value: f, label: f, count: 0 }))).map(
              (fv) => (
                <FormControlLabel
                  key={fv.value}
                  control={
                    <Checkbox
                      size="small"
                      checked={filters.complianceFlags.includes(fv.value)}
                      onChange={() =>
                        handleArrayToggle('complianceFlags', fv.value)
                      }
                    />
                  }
                  label={
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        width: '100%',
                        alignItems: 'center',
                      }}
                    >
                      <Typography variant="body2">{fv.label}</Typography>
                      {fv.count > 0 && (
                        <Chip
                          label={fv.count}
                          size="small"
                          sx={{ height: 18, fontSize: '0.7rem', ml: 0.5 }}
                        />
                      )}
                    </Box>
                  }
                  sx={{ mr: 0 }}
                />
              )
            )}
          </FormGroup>
        </AccordionDetails>
      </Accordion>

      <Divider />

      {/* Quality Score Filter */}
      <Accordion disableGutters elevation={0}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="body2" fontWeight={600}>
            Quality Score
          </Typography>
          {filters.qualityScoreMin > 0 && (
            <Chip
              label={`≥${filters.qualityScoreMin}%`}
              size="small"
              color="primary"
              sx={{ ml: 1, height: 20 }}
            />
          )}
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ px: 1 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Minimum quality score
            </Typography>
            <Slider
              value={filters.qualityScoreMin}
              onChange={(_, value) =>
                onFilterChange({ qualityScoreMin: value as number })
              }
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => `${value}%`}
              min={0}
              max={100}
              step={5}
              marks={[
                { value: 0, label: '0%' },
                { value: 50, label: '50%' },
                { value: 100, label: '100%' },
              ]}
            />
          </Box>
        </AccordionDetails>
      </Accordion>

      <Divider />

      {/* Price Range Filter */}
      <Accordion disableGutters elevation={0}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="body2" fontWeight={600}>
            Price Range
          </Typography>
          {(filters.priceRange[0] > 0 || filters.priceRange[1] < 1000) && (
            <Chip
              label={`$${filters.priceRange[0]}-$${filters.priceRange[1]}`}
              size="small"
              color="primary"
              sx={{ ml: 1, height: 20 }}
            />
          )}
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ px: 1 }}>
            <Slider
              value={filters.priceRange}
              onChange={(_, value) =>
                onFilterChange({ priceRange: value as [number, number] })
              }
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => `$${value}`}
              min={0}
              max={1000}
              step={10}
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="caption" color="text.secondary">
                ${filters.priceRange[0]}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                ${filters.priceRange[1]}
              </Typography>
            </Box>
          </Box>
        </AccordionDetails>
      </Accordion>

      <Divider />

      {/* Lead Time Filter */}
      <Accordion disableGutters elevation={0}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="body2" fontWeight={600}>
            Lead Time
          </Typography>
          {filters.leadTimeDaysMax !== null && (
            <Chip
              label={`≤${filters.leadTimeDaysMax} days`}
              size="small"
              color="primary"
              sx={{ ml: 1, height: 20 }}
            />
          )}
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ px: 1 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Maximum lead time (days)
            </Typography>
            <Slider
              value={filters.leadTimeDaysMax ?? 90}
              onChange={(_, value) =>
                onFilterChange({ leadTimeDaysMax: value as number })
              }
              valueLabelDisplay="auto"
              valueLabelFormat={(value) =>
                value === 90 ? 'Any' : `${value} days`
              }
              min={0}
              max={90}
              step={5}
              marks={[
                { value: 0, label: '0' },
                { value: 30, label: '30' },
                { value: 60, label: '60' },
                { value: 90, label: 'Any' },
              ]}
            />
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}

export default ParametricSearchPanel;
