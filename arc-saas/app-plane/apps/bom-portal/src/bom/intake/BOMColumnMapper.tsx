/**
 * BOMColumnMapper Component
 *
 * Column mapping editor for BOM uploads.
 * Allows users to review and adjust auto-detected column mappings.
 */

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  FormControl,
  Select,
  MenuItem,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import type { ColumnMapping } from '../../utils/bomParser';

// Target field options for mapping
const TARGET_FIELD_OPTIONS = [
  { value: 'ignore', label: 'Ignore' },
  { value: 'manufacturer_part_number', label: 'Part Number (MPN)' },
  { value: 'manufacturer', label: 'Manufacturer' },
  { value: 'quantity', label: 'Quantity' },
  { value: 'reference_designator', label: 'Reference Designator' },
  { value: 'description', label: 'Description' },
];

interface BOMColumnMapperProps {
  filename: string;
  totalRows: number;
  columnMappings: ColumnMapping[];
  previewData: Record<string, unknown>[];
  onMappingChange: (sourceColumn: string, targetField: string) => void;
  onConfirm: () => void;
  isConfirming?: boolean;
}

export function BOMColumnMapper({
  filename,
  totalRows,
  columnMappings,
  previewData,
  onMappingChange,
  onConfirm,
  isConfirming = false,
}: BOMColumnMapperProps) {
  // Validation checks
  const hasMPN = columnMappings.some((m) => m.target === 'manufacturer_part_number');
  const duplicateMappings = columnMappings
    .filter((m) => m.target !== 'ignore')
    .reduce((acc, m) => {
      acc[m.target] = (acc[m.target] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  const hasDuplicates = Object.values(duplicateMappings).some((count) => count > 1);

  // Get mapped columns for preview
  const mappedColumns = columnMappings.filter((m) => m.target !== 'ignore');

  // Get friendly field name
  const getFieldLabel = (target: string): string => {
    const option = TARGET_FIELD_OPTIONS.find((o) => o.value === target);
    if (option) return option.label;
    return target.charAt(0).toUpperCase() + target.slice(1).replace(/_/g, ' ');
  };

  return (
    <Card sx={{ mt: 2, mb: 2, border: '2px solid', borderColor: 'primary.main' }}>
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Review Column Mappings: {filename}</Typography>
          <Chip label={`${totalRows} rows`} color="primary" size="small" />
        </Box>

        {/* Info Alert */}
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>Auto-detected columns:</strong> Review and adjust the mappings below.
            At least one column must be mapped to "Part Number (MPN)".
          </Typography>
        </Alert>

        {/* Validation Warnings */}
        {!hasMPN && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="body2" fontWeight={600}>
              Part Number (MPN) column is required
            </Typography>
          </Alert>
        )}
        {hasDuplicates && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2" fontWeight={600}>
              Multiple columns are mapped to the same target. Please review your mappings.
            </Typography>
          </Alert>
        )}

        {/* Column Mapping Table */}
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                <TableCell><strong>File Column</strong></TableCell>
                <TableCell><strong>Sample Data</strong></TableCell>
                <TableCell><strong>Maps To</strong></TableCell>
                <TableCell><strong>Status</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {columnMappings.map((mapping, idx) => {
                // Get sample values for this column
                const sampleValues = previewData
                  .slice(0, 3)
                  .map((row) => row[mapping.source])
                  .filter((val) => val !== undefined && val !== null && val !== '');

                return (
                  <TableRow key={idx}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {mapping.source}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ maxWidth: 200 }}>
                        {sampleValues.length > 0 ? (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              display: 'block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {sampleValues.slice(0, 2).map(String).join(', ')}...
                          </Typography>
                        ) : (
                          <Typography variant="caption" color="text.disabled" fontStyle="italic">
                            (empty)
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <FormControl size="small" fullWidth sx={{ minWidth: 200 }}>
                        <Select
                          value={mapping.target}
                          onChange={(e) => onMappingChange(mapping.source, e.target.value)}
                        >
                          {TARGET_FIELD_OPTIONS.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.value === 'ignore' ? <em>{option.label}</em> : option.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </TableCell>
                    <TableCell>
                      {mapping.target !== 'ignore' ? (
                        <Chip label="Mapped" size="small" color="success" />
                      ) : (
                        <Chip label="Ignored" size="small" color="default" />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Data Preview Section */}
        {mappedColumns.length > 0 && (
          <>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mt: 3, mb: 1 }}>
              Data Preview (First 5 Rows)
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 2, maxHeight: 400 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ bgcolor: 'action.hover', fontWeight: 600 }}>#</TableCell>
                    {mappedColumns.map((mapping, idx) => (
                      <TableCell key={idx} sx={{ bgcolor: 'action.hover', fontWeight: 600 }}>
                        {getFieldLabel(mapping.target)}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {previewData.slice(0, 5).map((row, rowIdx) => (
                    <TableRow key={rowIdx} hover>
                      <TableCell sx={{ color: 'text.secondary' }}>{rowIdx + 1}</TableCell>
                      {mappedColumns.map((mapping, colIdx) => (
                        <TableCell key={colIdx}>
                          <Typography
                            variant="body2"
                            sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}
                          >
                            {String(row[mapping.source] ?? '-')}
                          </Typography>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {totalRows > 5 && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mb: 2, textAlign: 'center' }}
              >
                Showing 5 of {totalRows} rows
              </Typography>
            )}
          </>
        )}

        {/* Footer Actions */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            {mappedColumns.length} column(s) mapped •{' '}
            {columnMappings.filter((m) => m.target === 'ignore').length} ignored
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={onConfirm}
            startIcon={<CheckCircleIcon />}
            disabled={!hasMPN || hasDuplicates || isConfirming}
          >
            {isConfirming ? 'Processing...' : 'Confirm Mappings & Process'}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}

export default BOMColumnMapper;
