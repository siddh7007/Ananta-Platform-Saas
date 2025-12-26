import React from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Grid,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import { PipelineStep, PipelineStepContent } from './PipelineStep';
import { NormalizationStep as NormalizationStepType } from '../types';

interface NormalizationStepComponentProps {
  data: NormalizationStepType;
}

/**
 * NormalizationStep - Before/After Normalization Display
 *
 * Shows:
 * - Input data (raw vendor format)
 * - Normalized data (standardized format)
 * - Fields changed
 * - Normalization rules applied
 * - Data quality improvements
 *
 * Highlights which fields were normalized and how
 */
export const NormalizationStepComponent: React.FC<NormalizationStepComponentProps> = ({ data }) => {
  const { before, after, rules_applied, fields_normalized, issues_fixed } = data;

  // Determine status based on normalization success
  const status: 'success' | 'error' | 'info' | 'skipped' = fields_normalized > 0 ? 'success' : 'info';
  const summary = `${fields_normalized} fields normalized | ${issues_fixed.length} issues fixed | ${rules_applied.length} rules applied`;

  const sections = [
    {
      title: '📊 Normalization Summary',
      content: (
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="primary.main" fontWeight={600}>
                {fields_normalized}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Fields Normalized
              </Typography>
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="success.main" fontWeight={600}>
                {issues_fixed.length}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Issues Fixed
              </Typography>
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="info.main" fontWeight={600}>
                {rules_applied.length}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Rules Applied
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      ),
    },
    {
      title: '🔧 Normalization Rules Applied',
      content: (
        <Box>
          {rules_applied.length > 0 ? (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {rules_applied.map((rule, index) => (
                <Chip key={index} label={rule.rule || String(rule)} variant="outlined" color="primary" size="small" />
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="textSecondary">
              No normalization rules required
            </Typography>
          )}
        </Box>
      ),
    },
    {
      title: '✅ Issues Fixed',
      content: (
        <Box>
          {issues_fixed.length > 0 ? (
            <Box>
              {issues_fixed.map((issue: any, index: number) => (
                <Box key={index} display="flex" alignItems="center" sx={{ mb: 1 }}>
                  <CheckCircleIcon sx={{ color: 'success.main', mr: 1, fontSize: 18 }} />
                  <Typography variant="body2">{issue}</Typography>
                </Box>
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="textSecondary">
              No issues to fix
            </Typography>
          )}
        </Box>
      ),
    },
    {
      title: '🔄 Before vs After Comparison',
      content: <NormalizationComparisonTable before={before} after={after} />,
    },
  ];

  return (
    <PipelineStep
      stepNumber={5}
      title="Data Normalization"
      status={status}
      summary={summary}
      defaultExpanded={fields_normalized > 0}
      metadata={{
        time_ms: data.processing_time_ms,
      }}
    >
      <PipelineStepContent sections={sections} />
    </PipelineStep>
  );
};

/**
 * NormalizationComparisonTable - Side-by-side Before/After View
 */
interface NormalizationComparisonTableProps {
  before: Record<string, any>;
  after: Record<string, any>;
}

const NormalizationComparisonTable: React.FC<NormalizationComparisonTableProps> = ({ before, after }) => {
  // Get all unique fields
  const allFields = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));

  // Filter to only show fields that changed
  const changedFields = allFields.filter(field => {
    const beforeVal = formatValue(before[field]);
    const afterVal = formatValue(after[field]);
    return beforeVal !== afterVal;
  });

  // Determine if field was changed/added/removed
  const getChangeType = (field: string) => {
    const beforeVal = before[field];
    const afterVal = after[field];

    if (beforeVal === undefined && afterVal !== undefined) return 'added';
    if (beforeVal !== undefined && afterVal === undefined) return 'removed';
    if (beforeVal !== afterVal) return 'changed';
    return 'unchanged';
  };

  // Format value for display
  function formatValue(value: any): string {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  // Truncate long values
  const truncate = (value: string, maxLen: number = 50): string => {
    if (value.length <= maxLen) return value;
    return value.substring(0, maxLen) + '...';
  };

  return (
    <Box>
      <Typography variant="body2" color="textSecondary" paragraph>
        {changedFields.length > 0
          ? `${changedFields.length} fields were normalized or transformed:`
          : 'No fields were changed during normalization'}
      </Typography>

      {changedFields.length > 0 && (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.100' }}>
                <TableCell sx={{ fontWeight: 600, width: '25%' }}>Field</TableCell>
                <TableCell sx={{ fontWeight: 600, width: '35%' }}>Before (Raw)</TableCell>
                <TableCell sx={{ fontWeight: 600, width: '35%' }}>After (Normalized)</TableCell>
                <TableCell sx={{ fontWeight: 600, width: '5%' }}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {changedFields.map((field) => {
                const changeType = getChangeType(field);
                const beforeVal = formatValue(before[field]);
                const afterVal = formatValue(after[field]);

                return (
                  <TableRow key={field} hover>
                    <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>
                      {field.replace(/_/g, ' ')}
                    </TableCell>
                    <TableCell
                      sx={{
                        color: changeType === 'removed' ? 'text.disabled' : 'text.primary',
                        fontFamily: 'monospace',
                        fontSize: '0.875rem',
                      }}
                    >
                      {truncate(beforeVal)}
                    </TableCell>
                    <TableCell
                      sx={{
                        bgcolor: changeType === 'added' ? 'success.light' : changeType === 'changed' ? 'info.light' : undefined,
                        fontFamily: 'monospace',
                        fontSize: '0.875rem',
                        fontWeight: changeType === 'changed' ? 600 : undefined,
                      }}
                    >
                      {truncate(afterVal)}
                    </TableCell>
                    <TableCell>
                      {changeType === 'added' && <Chip label="Added" size="small" color="success" />}
                      {changeType === 'changed' && <CheckCircleIcon sx={{ color: 'success.main', fontSize: 20 }} />}
                      {changeType === 'removed' && <WarningIcon sx={{ color: 'warning.main', fontSize: 20 }} />}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Show count of unchanged fields */}
      {allFields.length > changedFields.length && (
        <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
          {allFields.length - changedFields.length} fields remained unchanged
        </Typography>
      )}
    </Box>
  );
};
