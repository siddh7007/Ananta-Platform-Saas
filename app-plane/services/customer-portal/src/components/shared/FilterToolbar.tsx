/**
 * FilterToolbar Component
 *
 * Unified filter bar for consistent filtering across pages.
 * Supports select dropdowns, search input, date range, and action buttons.
 *
 * Features:
 * - Multiple filter types (select, search, date range)
 * - Responsive layout
 * - Clear all filters action
 * - Optional refresh and export buttons
 */

import React from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  IconButton,
  Tooltip,
  InputAdornment,
  Chip,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import ClearIcon from '@mui/icons-material/Clear';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FilterListIcon from '@mui/icons-material/FilterList';
import { spacingScale } from '../../theme';

// Filter option type
export interface FilterOption {
  value: string;
  label: string;
}

// Individual filter configuration
export interface FilterConfig {
  /** Unique key for this filter */
  key: string;
  /** Display label */
  label: string;
  /** Filter type */
  type: 'select' | 'search' | 'date';
  /** Options for select filters */
  options?: FilterOption[];
  /** Placeholder text */
  placeholder?: string;
  /** Minimum width */
  minWidth?: number;
}

// Filter values type
export type FilterValues = Record<string, string>;

export interface FilterToolbarProps {
  /** Filter configurations */
  filters: FilterConfig[];
  /** Current filter values */
  values: FilterValues;
  /** Handler when filter values change */
  onChange: (key: string, value: string) => void;
  /** Handler to clear all filters */
  onClear?: () => void;
  /** Handler for refresh action */
  onRefresh?: () => void;
  /** Handler for export action */
  onExport?: () => void;
  /** Whether refresh is in progress */
  refreshing?: boolean;
  /** Show active filter count badge */
  showActiveCount?: boolean;
  /** Compact mode (less padding) */
  compact?: boolean;
}

/**
 * Count active (non-empty) filters
 */
function countActiveFilters(values: FilterValues): number {
  return Object.values(values).filter((v) => v && v !== '').length;
}

/**
 * FilterToolbar Component
 */
export function FilterToolbar({
  filters,
  values,
  onChange,
  onClear,
  onRefresh,
  onExport,
  refreshing = false,
  showActiveCount = true,
  compact = false,
}: FilterToolbarProps) {
  const activeCount = countActiveFilters(values);
  const padding = compact ? spacingScale.xs : spacingScale.md;

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 2,
        py: padding,
      }}
    >
      {/* Filter icon with count */}
      {showActiveCount && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <FilterListIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
          {activeCount > 0 && (
            <Chip
              label={activeCount}
              size="small"
              color="primary"
              sx={{ height: 20, fontSize: '0.75rem' }}
            />
          )}
        </Box>
      )}

      {/* Render filters */}
      {filters.map((filter) => {
        const value = values[filter.key] || '';

        if (filter.type === 'search') {
          return (
            <TextField
              key={filter.key}
              size="small"
              placeholder={filter.placeholder || `Search ${filter.label}...`}
              value={value}
              onChange={(e) => onChange(filter.key, e.target.value)}
              sx={{ minWidth: filter.minWidth || 200 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                  </InputAdornment>
                ),
                endAdornment: value ? (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => onChange(filter.key, '')}
                      edge="end"
                    >
                      <ClearIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
            />
          );
        }

        if (filter.type === 'select' && filter.options) {
          return (
            <FormControl
              key={filter.key}
              size="small"
              sx={{ minWidth: filter.minWidth || 120 }}
            >
              <InputLabel>{filter.label}</InputLabel>
              <Select
                value={value}
                label={filter.label}
                onChange={(e) => onChange(filter.key, e.target.value as string)}
              >
                <MenuItem value="">
                  <em>All</em>
                </MenuItem>
                {filter.options.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          );
        }

        if (filter.type === 'date') {
          return (
            <TextField
              key={filter.key}
              type="date"
              size="small"
              label={filter.label}
              value={value}
              onChange={(e) => onChange(filter.key, e.target.value)}
              sx={{ minWidth: filter.minWidth || 150 }}
              InputLabelProps={{ shrink: true }}
            />
          );
        }

        return null;
      })}

      {/* Spacer */}
      <Box sx={{ flexGrow: 1 }} />

      {/* Action buttons */}
      <Box sx={{ display: 'flex', gap: 1 }}>
        {/* Clear filters */}
        {onClear && activeCount > 0 && (
          <Button
            size="small"
            variant="text"
            startIcon={<ClearIcon />}
            onClick={onClear}
          >
            Clear
          </Button>
        )}

        {/* Refresh */}
        {onRefresh && (
          <Tooltip title="Refresh">
            <IconButton
              size="small"
              onClick={onRefresh}
              disabled={refreshing}
            >
              <RefreshIcon
                sx={{
                  animation: refreshing ? 'spin 1s linear infinite' : 'none',
                  '@keyframes spin': {
                    from: { transform: 'rotate(0deg)' },
                    to: { transform: 'rotate(360deg)' },
                  },
                }}
              />
            </IconButton>
          </Tooltip>
        )}

        {/* Export */}
        {onExport && (
          <Tooltip title="Export">
            <IconButton size="small" onClick={onExport}>
              <FileDownloadIcon />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
}

export default FilterToolbar;
