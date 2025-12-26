/**
 * ComponentFilters
 *
 * Left-rail filter panel for component discovery.
 * Filters: Supplier, Lifecycle, Compliance, Price Range, Risk Level
 */

import React from 'react';
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
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import ClearAllIcon from '@mui/icons-material/ClearAll';

export interface ComponentFilterState {
  suppliers: string[];
  lifecycleStatuses: string[];
  complianceFlags: string[];
  priceRange: [number, number];
  riskLevels: string[];
}

interface ComponentFiltersProps {
  filters: ComponentFilterState;
  onFilterChange: (filters: ComponentFilterState) => void;
  activeFilterCount: number;
}

const SUPPLIERS = ['Mouser', 'DigiKey', 'Element14', 'Newark', 'Octopart'];
const LIFECYCLE_STATUSES = ['Active', 'NRND', 'Obsolete', 'EOL', 'Unknown'];
const COMPLIANCE_FLAGS = ['RoHS', 'REACH', 'Halogen-Free', 'AEC-Q100', 'AEC-Q200'];
const RISK_LEVELS = ['Low', 'Medium', 'High', 'Critical'];

export function ComponentFilters({
  filters,
  onFilterChange,
  activeFilterCount,
}: ComponentFiltersProps) {
  const handleSupplierToggle = (supplier: string) => {
    const updated = filters.suppliers.includes(supplier)
      ? filters.suppliers.filter((s) => s !== supplier)
      : [...filters.suppliers, supplier];
    onFilterChange({ ...filters, suppliers: updated });
  };

  const handleLifecycleToggle = (status: string) => {
    const updated = filters.lifecycleStatuses.includes(status)
      ? filters.lifecycleStatuses.filter((s) => s !== status)
      : [...filters.lifecycleStatuses, status];
    onFilterChange({ ...filters, lifecycleStatuses: updated });
  };

  const handleComplianceToggle = (flag: string) => {
    const updated = filters.complianceFlags.includes(flag)
      ? filters.complianceFlags.filter((f) => f !== flag)
      : [...filters.complianceFlags, flag];
    onFilterChange({ ...filters, complianceFlags: updated });
  };

  const handleRiskToggle = (level: string) => {
    const updated = filters.riskLevels.includes(level)
      ? filters.riskLevels.filter((l) => l !== level)
      : [...filters.riskLevels, level];
    onFilterChange({ ...filters, riskLevels: updated });
  };

  const handlePriceChange = (_event: Event, newValue: number | number[]) => {
    onFilterChange({ ...filters, priceRange: newValue as [number, number] });
  };

  const handleClearAll = () => {
    onFilterChange({
      suppliers: [],
      lifecycleStatuses: [],
      complianceFlags: [],
      priceRange: [0, 1000],
      riskLevels: [],
    });
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'Low':
        return 'success';
      case 'Medium':
        return 'warning';
      case 'High':
        return 'error';
      case 'Critical':
        return 'error';
      default:
        return 'default';
    }
  };

  const getLifecycleColor = (status: string) => {
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
  };

  return (
    <Box
      sx={{
        width: 280,
        flexShrink: 0,
        borderRight: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        height: '100%',
        overflow: 'auto',
      }}
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
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FilterAltIcon color="primary" />
          <Typography variant="subtitle1" fontWeight={600}>
            Filters
          </Typography>
          {activeFilterCount > 0 && (
            <Chip label={activeFilterCount} size="small" color="primary" />
          )}
        </Box>
        {activeFilterCount > 0 && (
          <Button
            size="small"
            startIcon={<ClearAllIcon />}
            onClick={handleClearAll}
          >
            Clear
          </Button>
        )}
      </Box>

      {/* Supplier Filter */}
      <Accordion defaultExpanded disableGutters elevation={0}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="body2" fontWeight={600}>
            Supplier
          </Typography>
          {filters.suppliers.length > 0 && (
            <Chip
              label={filters.suppliers.length}
              size="small"
              sx={{ ml: 1, height: 20 }}
            />
          )}
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0 }}>
          <FormGroup>
            {SUPPLIERS.map((supplier) => (
              <FormControlLabel
                key={supplier}
                control={
                  <Checkbox
                    size="small"
                    checked={filters.suppliers.includes(supplier)}
                    onChange={() => handleSupplierToggle(supplier)}
                  />
                }
                label={<Typography variant="body2">{supplier}</Typography>}
              />
            ))}
          </FormGroup>
        </AccordionDetails>
      </Accordion>

      <Divider />

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
              sx={{ ml: 1, height: 20 }}
            />
          )}
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {LIFECYCLE_STATUSES.map((status) => (
              <Chip
                key={status}
                label={status}
                size="small"
                color={
                  filters.lifecycleStatuses.includes(status)
                    ? getLifecycleColor(status)
                    : 'default'
                }
                variant={
                  filters.lifecycleStatuses.includes(status)
                    ? 'filled'
                    : 'outlined'
                }
                onClick={() => handleLifecycleToggle(status)}
                sx={{ cursor: 'pointer' }}
              />
            ))}
          </Box>
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
              sx={{ ml: 1, height: 20 }}
            />
          )}
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0 }}>
          <FormGroup>
            {COMPLIANCE_FLAGS.map((flag) => (
              <FormControlLabel
                key={flag}
                control={
                  <Checkbox
                    size="small"
                    checked={filters.complianceFlags.includes(flag)}
                    onChange={() => handleComplianceToggle(flag)}
                  />
                }
                label={<Typography variant="body2">{flag}</Typography>}
              />
            ))}
          </FormGroup>
        </AccordionDetails>
      </Accordion>

      <Divider />

      {/* Price Range Filter */}
      <Accordion disableGutters elevation={0}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="body2" fontWeight={600}>
            Price Range
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ px: 1 }}>
            <Slider
              value={filters.priceRange}
              onChange={handlePriceChange}
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
              sx={{ ml: 1, height: 20 }}
            />
          )}
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {RISK_LEVELS.map((level) => (
              <Chip
                key={level}
                label={level}
                size="small"
                color={
                  filters.riskLevels.includes(level)
                    ? getRiskColor(level)
                    : 'default'
                }
                variant={
                  filters.riskLevels.includes(level) ? 'filled' : 'outlined'
                }
                onClick={() => handleRiskToggle(level)}
                sx={{ cursor: 'pointer' }}
              />
            ))}
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}

export default ComponentFilters;
