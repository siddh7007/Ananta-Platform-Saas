/**
 * BOM Column Mapper Component for CNS Dashboard
 *
 * Allows users to map file columns to BOM fields with auto-detection.
 * Adapted from CBP implementation for Material-UI.
 */

import React from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  Grid,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import type { BomColumnMapping, BomFilePreview } from '../../utils/bomParser';

interface ColumnConfig {
  key: keyof BomColumnMapping;
  label: string;
  required: boolean;
  description?: string;
}

const COLUMN_CONFIGS: ColumnConfig[] = [
  { key: 'mpn', label: 'MPN / Part Number', required: true, description: 'Manufacturer Part Number - required for enrichment' },
  { key: 'manufacturer', label: 'Manufacturer', required: false, description: 'Component manufacturer name' },
  { key: 'quantity', label: 'Quantity', required: false, description: 'Number of components needed' },
  { key: 'description', label: 'Description', required: false, description: 'Component description' },
  { key: 'referenceDesignator', label: 'Reference Designator', required: false, description: 'Board reference (e.g., U1, R1, C1)' },
  { key: 'footprint', label: 'Footprint / Package', required: false, description: 'Physical package type' },
];

interface BOMColumnMapperProps {
  mapping: BomColumnMapping;
  preview: BomFilePreview | null;
  onMappingChange: (mapping: BomColumnMapping) => void;
  validationErrors?: { message: string; severity: 'error' | 'warning' }[];
}

export const BOMColumnMapper: React.FC<BOMColumnMapperProps> = ({
  mapping,
  preview,
  onMappingChange,
  validationErrors = [],
}) => {
  const headers = preview?.headers || [];
  const previewRows = preview?.rows.slice(0, 5) || [];

  // Handle mapping change for a specific field
  const handleMappingChange = (key: keyof BomColumnMapping, value: string) => {
    onMappingChange({
      ...mapping,
      [key]: value || undefined,
    });
  };

  // Get value from a row based on column mapping
  const getMappedValue = (row: string[], columnName: string | undefined): string => {
    if (!columnName) return '-';
    const index = headers.indexOf(columnName);
    if (index === -1) return '-';
    return row[index] || '-';
  };

  // Check if a column is already used
  const isColumnUsed = (column: string, excludeKey: string): boolean => {
    return Object.entries(mapping).some(
      ([key, value]) => key !== excludeKey && value === column
    );
  };

  // Calculate mapping completeness
  const requiredMapped = COLUMN_CONFIGS.filter(c => c.required).every(
    c => mapping[c.key]
  );
  const optionalMapped = COLUMN_CONFIGS.filter(c => !c.required && mapping[c.key]).length;
  const totalOptional = COLUMN_CONFIGS.filter(c => !c.required).length;

  return (
    <Box>
      {/* Header */}
      <Box display="flex" alignItems="center" gap={1} mb={2}>
        <SettingsIcon color="primary" />
        <Typography variant="h6">Map Your Columns</Typography>
      </Box>
      <Typography variant="body2" color="textSecondary" paragraph>
        Match your file columns to BOM fields. We've auto-detected some mappings based on column names.
      </Typography>

      {/* Mapping Status */}
      <Box display="flex" gap={1} mb={3}>
        <Chip
          icon={requiredMapped ? <CheckCircleIcon /> : <WarningIcon />}
          label={requiredMapped ? 'Required fields mapped' : 'MPN column required'}
          color={requiredMapped ? 'success' : 'warning'}
          size="small"
        />
        <Chip
          label={`${optionalMapped}/${totalOptional} optional fields mapped`}
          color="default"
          size="small"
          variant="outlined"
        />
      </Box>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Box mb={3}>
          {validationErrors.map((err, i) => (
            <Alert
              key={i}
              severity={err.severity}
              sx={{ mb: 1 }}
            >
              {err.message}
            </Alert>
          ))}
        </Box>
      )}

      {/* Column Mapping Grid */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {COLUMN_CONFIGS.map((config) => (
          <Grid item xs={12} sm={6} md={4} key={config.key}>
            <FormControl fullWidth size="small" error={config.required && !mapping[config.key]}>
              <InputLabel>
                {config.label}
                {config.required && ' *'}
              </InputLabel>
              <Select
                value={mapping[config.key] || ''}
                onChange={(e) => handleMappingChange(config.key, e.target.value)}
                label={`${config.label}${config.required ? ' *' : ''}`}
              >
                <MenuItem value="">
                  <em>Select column...</em>
                </MenuItem>
                {headers.map((header) => (
                  <MenuItem
                    key={header}
                    value={header}
                    disabled={isColumnUsed(header, config.key)}
                  >
                    {header}
                    {isColumnUsed(header, config.key) && ' (already used)'}
                  </MenuItem>
                ))}
              </Select>
              {config.description && (
                <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5 }}>
                  {config.description}
                </Typography>
              )}
            </FormControl>
          </Grid>
        ))}
      </Grid>

      {/* Mapped Preview */}
      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
        Mapped Preview
      </Typography>
      <Typography variant="body2" color="textSecondary" paragraph>
        Preview how your data will be mapped (first 5 rows)
      </Typography>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'primary.light' }}>
              <TableCell sx={{ fontWeight: 600, color: 'primary.contrastText' }}>MPN</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Manufacturer</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Qty</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Ref Des</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {previewRows.length > 0 ? (
              previewRows.map((row, i) => (
                <TableRow key={i} hover>
                  <TableCell sx={{ fontWeight: 500 }}>
                    {getMappedValue(row, mapping.mpn)}
                  </TableCell>
                  <TableCell>{getMappedValue(row, mapping.manufacturer)}</TableCell>
                  <TableCell>{getMappedValue(row, mapping.quantity)}</TableCell>
                  <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {getMappedValue(row, mapping.description)}
                  </TableCell>
                  <TableCell>{getMappedValue(row, mapping.referenceDesignator)}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography color="textSecondary">No preview data available</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Unmapped Columns Info */}
      {headers.length > 0 && (
        <Box mt={3}>
          <Typography variant="subtitle2" color="textSecondary" gutterBottom>
            Available columns in your file:
          </Typography>
          <Box display="flex" flexWrap="wrap" gap={1}>
            {headers.map((header) => {
              const isUsed = Object.values(mapping).includes(header);
              return (
                <Chip
                  key={header}
                  label={header}
                  size="small"
                  variant={isUsed ? 'filled' : 'outlined'}
                  color={isUsed ? 'primary' : 'default'}
                />
              );
            })}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default BOMColumnMapper;
