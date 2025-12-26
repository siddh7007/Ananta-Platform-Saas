/**
 * MobileColumnMapper Component
 *
 * P1-5: Mobile-optimized column mapping with accordion layout.
 * Converts table-based mapper to expandable cards for touch devices.
 */

import React, { useState, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  Select,
  MenuItem,
  Divider,
  Paper,
  useMediaQuery,
  useTheme,
  LinearProgress,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import DataObjectIcon from '@mui/icons-material/DataObject';
import type { ColumnMapping } from '../../utils/bomParser';
import { TouchTarget } from './TouchTarget';

// Target field options for mapping
const TARGET_FIELD_OPTIONS = [
  { value: 'ignore', label: 'Ignore', icon: <VisibilityOffIcon fontSize="small" /> },
  { value: 'manufacturer_part_number', label: 'Part Number (MPN)', required: true },
  { value: 'manufacturer', label: 'Manufacturer' },
  { value: 'quantity', label: 'Quantity' },
  { value: 'reference_designator', label: 'Reference Designator' },
  { value: 'description', label: 'Description' },
];

export interface MobileColumnMapperProps {
  /** File name being mapped */
  filename: string;
  /** Total rows in the file */
  totalRows: number;
  /** Current column mappings */
  columnMappings: ColumnMapping[];
  /** Preview data rows */
  previewData: Record<string, unknown>[];
  /** Callback when mapping changes */
  onMappingChange: (sourceColumn: string, targetField: string) => void;
  /** Callback to confirm mappings */
  onConfirm: () => void;
  /** Loading state during confirmation */
  isConfirming?: boolean;
  /** Test ID */
  'data-testid'?: string;
}

interface ColumnCardProps {
  mapping: ColumnMapping;
  sampleValues: (string | number | null)[];
  onTargetChange: (target: string) => void;
  isExpanded: boolean;
  onExpandChange: (expanded: boolean) => void;
  index: number;
}

function ColumnCard({
  mapping,
  sampleValues,
  onTargetChange,
  isExpanded,
  onExpandChange,
  index,
}: ColumnCardProps) {
  const isMapped = mapping.target !== 'ignore';
  const isMPN = mapping.target === 'manufacturer_part_number';

  const getStatusIcon = () => {
    if (isMPN) return <CheckCircleIcon fontSize="small" color="success" />;
    if (isMapped) return <CheckCircleIcon fontSize="small" color="primary" />;
    return <VisibilityOffIcon fontSize="small" color="disabled" />;
  };

  const getStatusColor = (): 'success' | 'primary' | 'default' => {
    if (isMPN) return 'success';
    if (isMapped) return 'primary';
    return 'default';
  };

  const getFieldLabel = (target: string): string => {
    const option = TARGET_FIELD_OPTIONS.find((o) => o.value === target);
    return option?.label || target;
  };

  return (
    <Accordion
      expanded={isExpanded}
      onChange={(_, expanded) => onExpandChange(expanded)}
      sx={{
        mb: 1,
        '&:before': { display: 'none' },
        borderRadius: '12px !important',
        overflow: 'hidden',
        border: '1px solid',
        borderColor: isMPN ? 'success.main' : isMapped ? 'primary.light' : 'divider',
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        aria-controls={`column-${index}-content`}
        id={`column-${index}-header`}
        sx={{
          minHeight: 64,
          '& .MuiAccordionSummary-content': {
            alignItems: 'center',
            gap: 1.5,
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0 }}>
          {getStatusIcon()}
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="subtitle2" fontWeight={600} noWrap>
              {mapping.source}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {isMapped ? `→ ${getFieldLabel(mapping.target)}` : 'Not mapped'}
            </Typography>
          </Box>
          <Chip
            label={isMapped ? 'Mapped' : 'Ignored'}
            size="small"
            color={getStatusColor()}
            variant={isMapped ? 'filled' : 'outlined'}
          />
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0, pb: 2 }}>
        {/* Mapping Selector */}
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
          Maps to:
        </Typography>
        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <Select
            value={mapping.target}
            onChange={(e) => onTargetChange(e.target.value)}
            sx={{ bgcolor: 'background.paper' }}
          >
            {TARGET_FIELD_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {option.value === 'ignore' ? (
                    <em>{option.label}</em>
                  ) : (
                    <>
                      {option.label}
                      {option.required && (
                        <Chip label="Required" size="small" color="error" sx={{ ml: 1, height: 20 }} />
                      )}
                    </>
                  )}
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Sample Data */}
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
          Sample values:
        </Typography>
        <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'grey.50' }}>
          {sampleValues.length > 0 ? (
            sampleValues.slice(0, 3).map((value, i) => (
              <Typography
                key={i}
                variant="body2"
                sx={{
                  py: 0.5,
                  borderBottom: i < sampleValues.length - 1 ? '1px dashed' : 'none',
                  borderColor: 'divider',
                  color: value ? 'text.primary' : 'text.disabled',
                  fontStyle: value ? 'normal' : 'italic',
                }}
              >
                {value !== null && value !== undefined && value !== '' ? String(value) : '(empty)'}
              </Typography>
            ))
          ) : (
            <Typography variant="body2" color="text.disabled" fontStyle="italic">
              No sample data
            </Typography>
          )}
        </Paper>

        {/* Confidence indicator */}
        {mapping.confidence > 0 && (
          <Box sx={{ mt: 1.5 }}>
            <Typography variant="caption" color="text.secondary">
              Auto-detected with {mapping.confidence}% confidence
            </Typography>
          </Box>
        )}
      </AccordionDetails>
    </Accordion>
  );
}

/**
 * Mobile-optimized column mapper with accordion layout
 */
export function MobileColumnMapper({
  filename,
  totalRows,
  columnMappings,
  previewData,
  onMappingChange,
  onConfirm,
  isConfirming = false,
  'data-testid': testId,
}: MobileColumnMapperProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  // Validation
  const validation = useMemo(() => {
    const hasMPN = columnMappings.some((m) => m.target === 'manufacturer_part_number');
    const duplicateTargets = columnMappings
      .filter((m) => m.target !== 'ignore')
      .reduce((acc, m) => {
        acc[m.target] = (acc[m.target] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    const hasDuplicates = Object.values(duplicateTargets).some((count) => count > 1);
    const mappedCount = columnMappings.filter((m) => m.target !== 'ignore').length;
    const ignoredCount = columnMappings.filter((m) => m.target === 'ignore').length;

    return { hasMPN, hasDuplicates, mappedCount, ignoredCount };
  }, [columnMappings]);

  const handleExpandChange = (index: number) => (expanded: boolean) => {
    setExpandedIndex(expanded ? index : null);
  };

  // H1 Fix: Validate type before assertion
  const getSampleValues = React.useCallback(
    (sourceColumn: string): (string | number | null)[] => {
      if (!previewData || !Array.isArray(previewData)) return [];

      return previewData.slice(0, 3).map((row) => {
        if (!row || typeof row !== 'object') return null;

        const value = row[sourceColumn];
        if (value === undefined || value === null || value === '') return null;

        // H1 Fix: Type guard instead of direct assertion
        if (typeof value === 'string' || typeof value === 'number') {
          return value;
        }
        // Convert other types to string representation
        return String(value);
      });
    },
    [previewData]
  );

  // Progress calculation
  const progress = (validation.mappedCount / columnMappings.length) * 100;

  return (
    <Card
      sx={{
        mt: 2,
        mb: 2,
        border: '2px solid',
        borderColor: 'primary.main',
        borderRadius: 3,
      }}
      data-testid={testId}
    >
      <CardContent sx={{ pb: isMobile ? 2 : 3 }}>
        {/* Header */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
            <Box>
              <Typography variant="h6" fontWeight={600}>
                Map Columns
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {filename}
              </Typography>
            </Box>
            <Chip label={`${totalRows.toLocaleString()} rows`} color="primary" size="small" />
          </Box>

          {/* Progress bar */}
          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                Mapping progress
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {validation.mappedCount} of {columnMappings.length} columns mapped
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{ height: 8, borderRadius: 4 }}
            />
          </Box>
        </Box>

        {/* M1 Fix: Validation Alerts with aria-live for screen readers */}
        <Box aria-live="polite" aria-atomic="true">
          {!validation.hasMPN && (
            <Alert
              severity="error"
              icon={<ErrorIcon />}
              sx={{ mb: 2, borderRadius: 2 }}
              role="alert"
            >
              <Typography variant="body2" fontWeight={600}>
                Part Number (MPN) column is required
              </Typography>
            </Alert>
          )}
          {validation.hasDuplicates && (
            <Alert
              severity="warning"
              icon={<WarningIcon />}
              sx={{ mb: 2, borderRadius: 2 }}
              role="alert"
            >
              <Typography variant="body2" fontWeight={600}>
                Multiple columns mapped to same target
              </Typography>
            </Alert>
          )}
        </Box>

        {/* Info */}
        <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
          <Typography variant="body2">
            Tap each column to review and adjust the mapping. Part Number (MPN) is required.
          </Typography>
        </Alert>

        {/* Column Cards */}
        <Box sx={{ mb: 3 }}>
          {columnMappings.map((mapping, index) => (
            <ColumnCard
              key={mapping.source}
              mapping={mapping}
              sampleValues={getSampleValues(mapping.source)}
              onTargetChange={(target) => onMappingChange(mapping.source, target)}
              isExpanded={expandedIndex === index}
              onExpandChange={handleExpandChange(index)}
              index={index}
            />
          ))}
        </Box>

        {/* Footer Stats */}
        <Divider sx={{ mb: 2 }} />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="caption" color="text.secondary">
            {validation.mappedCount} column{validation.mappedCount !== 1 ? 's' : ''} mapped •{' '}
            {validation.ignoredCount} ignored
          </Typography>
        </Box>

        {/* Confirm Button - M3 Fix: Enhanced disabled state styling */}
        <TouchTarget
          onClick={onConfirm}
          variant="filled"
          color={validation.hasMPN && !validation.hasDuplicates ? 'primary' : 'secondary'}
          fullWidth
          disabled={!validation.hasMPN || validation.hasDuplicates || isConfirming}
          aria-label={isConfirming ? 'Processing' : 'Confirm mappings and process'}
          aria-disabled={!validation.hasMPN || validation.hasDuplicates || isConfirming}
          sx={{
            py: 2,
            // M3 Fix: Better disabled state visual feedback
            '&[aria-disabled="true"]': {
              cursor: 'not-allowed',
              bgcolor: 'action.disabledBackground',
              color: 'action.disabled',
            },
          }}
        >
          <CheckCircleIcon />
          <Typography variant="body1" fontWeight={600}>
            {isConfirming ? 'Processing...' : 'Confirm & Process'}
          </Typography>
        </TouchTarget>
      </CardContent>
    </Card>
  );
}

export default MobileColumnMapper;
