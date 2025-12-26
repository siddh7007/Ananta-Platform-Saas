import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Box,
  Chip,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { EnrichmentPipeline } from './types';

interface DataComparisonTableProps {
  pipeline: EnrichmentPipeline;
}

/**
 * DataComparisonTable - Multi-Source Data Comparison
 *
 * Shows how data from different sources was merged:
 * - Input (raw BOM data)
 * - Mouser
 * - DigiKey
 * - Element14
 * - AI Enhancement
 * - Final Normalized Value
 *
 * Highlights which source was selected for each field
 */
export const DataComparisonTable: React.FC<DataComparisonTableProps> = ({ pipeline }) => {
  // Extract data from pipeline
  const input = pipeline.step1_input.data;
  const mouser = pipeline.step3_suppliers.mouser?.data;
  const digikey = pipeline.step3_suppliers.digikey?.data;
  const element14 = pipeline.step3_suppliers.element14?.data;
  const aiData: Record<string, any> = pipeline.step4_ai?.operations.reduce((acc, op) => {
    return { ...acc, ...op.output };
  }, {} as Record<string, any>) || {};
  const normalized = pipeline.step5_normalization.after;

  // Define fields to compare
  const fields = [
    'mpn',
    'manufacturer',
    'category',
    'description',
    'datasheet_url',
    'pricing',
    'stock',
    'lifecycle_status',
    'rohs_status',
  ];

  // Determine which source was used for final value
  const getSelectedSource = (field: string): string => {
    const finalValue = normalized[field];
    if (!finalValue) return '-';

    // Check each source
    if (digikey?.[field] === finalValue) return 'DigiKey';
    if (mouser?.[field] === finalValue) return 'Mouser';
    if (element14?.[field] === finalValue) return 'Element14';
    if (aiData?.[field] === finalValue) return 'AI';
    if (input[field] === finalValue) return 'Input';

    return 'Normalized';
  };

  // Format cell value
  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  // Truncate long values
  const truncate = (value: string, maxLen: number = 30): string => {
    if (value.length <= maxLen) return value;
    return value.substring(0, maxLen) + '...';
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        📊 Data Source Comparison
      </Typography>
      <Typography variant="body2" color="textSecondary" paragraph>
        Compare data from all sources. Green checkmark indicates selected source.
      </Typography>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.100' }}>
              <TableCell sx={{ fontWeight: 600, width: '15%' }}>Field</TableCell>
              <TableCell sx={{ fontWeight: 600, width: '12%' }}>Input</TableCell>
              <TableCell sx={{ fontWeight: 600, width: '12%' }}>Mouser</TableCell>
              <TableCell sx={{ fontWeight: 600, width: '12%' }}>DigiKey</TableCell>
              <TableCell sx={{ fontWeight: 600, width: '12%' }}>Element14</TableCell>
              <TableCell sx={{ fontWeight: 600, width: '12%' }}>AI</TableCell>
              <TableCell sx={{ fontWeight: 600, width: '15%' }}>Final ✓</TableCell>
              <TableCell sx={{ fontWeight: 600, width: '10%' }}>Source</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {fields.map((field) => {
              const selectedSource = getSelectedSource(field);
              const finalValue = formatValue(normalized[field]);

              return (
                <TableRow key={field} hover>
                  <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>
                    {field.replace(/_/g, ' ')}
                  </TableCell>
                  <TableCell sx={{ bgcolor: selectedSource === 'Input' ? 'success.light' : undefined }}>
                    {truncate(formatValue(input[field]))}
                    {selectedSource === 'Input' && <CheckCircleIcon sx={{ fontSize: 16, ml: 0.5, color: 'success.main' }} />}
                  </TableCell>
                  <TableCell sx={{ bgcolor: selectedSource === 'Mouser' ? 'success.light' : undefined }}>
                    {truncate(formatValue(mouser?.[field]))}
                    {selectedSource === 'Mouser' && <CheckCircleIcon sx={{ fontSize: 16, ml: 0.5, color: 'success.main' }} />}
                  </TableCell>
                  <TableCell sx={{ bgcolor: selectedSource === 'DigiKey' ? 'success.light' : undefined }}>
                    {truncate(formatValue(digikey?.[field]))}
                    {selectedSource === 'DigiKey' && <CheckCircleIcon sx={{ fontSize: 16, ml: 0.5, color: 'success.main' }} />}
                  </TableCell>
                  <TableCell sx={{ bgcolor: selectedSource === 'Element14' ? 'success.light' : undefined }}>
                    {truncate(formatValue(element14?.[field]))}
                    {selectedSource === 'Element14' && <CheckCircleIcon sx={{ fontSize: 16, ml: 0.5, color: 'success.main' }} />}
                  </TableCell>
                  <TableCell sx={{ bgcolor: selectedSource === 'AI' ? 'success.light' : undefined }}>
                    {truncate(formatValue((aiData as any)?.[field]))}
                    {selectedSource === 'AI' && <CheckCircleIcon sx={{ fontSize: 16, ml: 0.5, color: 'success.main' }} />}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, bgcolor: 'primary.light' }}>
                    {truncate(finalValue)}
                  </TableCell>
                  <TableCell>
                    <Chip label={selectedSource} size="small" color="primary" variant="outlined" />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};
