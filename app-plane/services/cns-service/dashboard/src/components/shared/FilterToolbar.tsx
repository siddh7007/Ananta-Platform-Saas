/**
 * FilterToolbar - Unified filter bar with search, select, and date filters
 */
import React from 'react';
import {
  Box,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  IconButton,
  Tooltip,
  InputAdornment,
  Button,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import ClearIcon from '@mui/icons-material/Clear';
import FilterListIcon from '@mui/icons-material/FilterList';

export type FilterType = 'search' | 'select' | 'multi-select' | 'date-range';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterConfig {
  key: string;
  type: FilterType;
  label: string;
  placeholder?: string;
  options?: FilterOption[];
  width?: number | string;
}

export interface FilterToolbarProps {
  filters: FilterConfig[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  onClear?: () => void;
  onRefresh?: () => void;
  loading?: boolean;
  showActiveCount?: boolean;
}

export const FilterToolbar: React.FC<FilterToolbarProps> = ({
  filters,
  values,
  onChange,
  onClear,
  onRefresh,
  loading = false,
  showActiveCount = true,
}) => {
  const activeFilterCount = Object.entries(values).filter(
    ([, value]) => value !== '' && value !== null && value !== undefined &&
    (Array.isArray(value) ? value.length > 0 : true)
  ).length;

  const renderFilter = (filter: FilterConfig) => {
    const value = values[filter.key];

    switch (filter.type) {
      case 'search':
        return (
          <TextField
            key={filter.key}
            size="small"
            placeholder={filter.placeholder || `Search ${filter.label}...`}
            value={value || ''}
            onChange={(e) => onChange(filter.key, e.target.value)}
            sx={{ width: filter.width || 220 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
              endAdornment: value ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => onChange(filter.key, '')}>
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
          />
        );

      case 'select':
        return (
          <FormControl key={filter.key} size="small" sx={{ minWidth: filter.width || 150 }}>
            <InputLabel>{filter.label}</InputLabel>
            <Select
              value={value || ''}
              label={filter.label}
              onChange={(e) => onChange(filter.key, e.target.value)}
            >
              <MenuItem value="">
                <em>All</em>
              </MenuItem>
              {filter.options?.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );

      case 'multi-select':
        return (
          <FormControl key={filter.key} size="small" sx={{ minWidth: filter.width || 180 }}>
            <InputLabel>{filter.label}</InputLabel>
            <Select
              multiple
              value={Array.isArray(value) ? value : []}
              label={filter.label}
              onChange={(e) => onChange(filter.key, e.target.value)}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {(selected as string[]).map((v) => (
                    <Chip
                      key={v}
                      label={filter.options?.find((o) => o.value === v)?.label || v}
                      size="small"
                    />
                  ))}
                </Box>
              )}
            >
              {filter.options?.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );

      default:
        return null;
    }
  };

  return (
    <Box
      display="flex"
      alignItems="center"
      gap={2}
      flexWrap="wrap"
      sx={{ mb: 2 }}
    >
      {filters.map(renderFilter)}

      <Box display="flex" alignItems="center" gap={1} ml="auto">
        {showActiveCount && activeFilterCount > 0 && (
          <Chip
            icon={<FilterListIcon />}
            label={`${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''}`}
            size="small"
            color="primary"
            variant="outlined"
          />
        )}

        {onClear && activeFilterCount > 0 && (
          <Button
            size="small"
            startIcon={<ClearIcon />}
            onClick={onClear}
            sx={{ textTransform: 'none' }}
          >
            Clear
          </Button>
        )}

        {onRefresh && (
          <Tooltip title="Refresh data">
            <IconButton onClick={onRefresh} disabled={loading} size="small">
              <RefreshIcon
                sx={{
                  animation: loading ? 'spin 1s linear infinite' : 'none',
                  '@keyframes spin': {
                    '0%': { transform: 'rotate(0deg)' },
                    '100%': { transform: 'rotate(360deg)' },
                  },
                }}
              />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
};

export default FilterToolbar;
