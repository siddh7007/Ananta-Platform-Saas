/**
 * ComparisonTray Component
 *
 * Floating tray showing selected components for side-by-side comparison.
 * Expandable to show full comparison view.
 *
 * P1-2: Updated to support unlimited component comparisons.
 */

import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Chip,
  Button,
  Avatar,
  Collapse,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Divider,
  Slide,
  Alert,
} from '@mui/material';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import CloseIcon from '@mui/icons-material/Close';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import SendIcon from '@mui/icons-material/Send';
import MemoryIcon from '@mui/icons-material/Memory';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import { COMPARISON_CONFIG } from '../../config/comparison';

export interface ComparisonComponent {
  id: string;
  mpn: string;
  manufacturer: string;
  description?: string;
  category?: string;
  quality_score?: number;
  lifecycle_status?: string;
  unit_price?: number;
  stock_quantity?: number;
  lead_time_days?: number;
  rohs_compliant?: boolean;
  image_url?: string;
}

// Sidebar width constant - should match the app's sidebar width
const SIDEBAR_WIDTH = 280;

interface ComparisonTrayProps {
  components: ComparisonComponent[];
  onRemove: (id: string) => void;
  onClear: () => void;
  onSendToVault: (components: ComparisonComponent[]) => void;
  /** Maximum components to display (defaults to unlimited via config) */
  maxComponents?: number;
  /** Override sidebar offset if different from default */
  sidebarWidth?: number;
}

export function ComparisonTray({
  components,
  onRemove,
  onClear,
  onSendToVault,
  maxComponents = COMPARISON_CONFIG.maxComponents,
  sidebarWidth = SIDEBAR_WIDTH,
}: ComparisonTrayProps): React.ReactElement | null {
  const [expanded, setExpanded] = useState(false);

  // P1-2: Show performance warning for large comparisons
  const showPerformanceWarning = components.length >= COMPARISON_CONFIG.performanceWarningThreshold;

  if (components.length === 0) return null;

  const getQualityIcon = (score?: number) => {
    if (!score) return null;
    if (score >= 95) return <CheckCircleIcon fontSize="small" color="success" />;
    if (score >= 70) return <WarningIcon fontSize="small" color="warning" />;
    return <ErrorIcon fontSize="small" color="error" />;
  };

  const getLifecycleColor = (status?: string) => {
    if (!status) return 'default';
    const s = status.toLowerCase();
    if (s === 'active') return 'success';
    if (s === 'nrnd') return 'warning';
    if (s === 'obsolete' || s === 'eol') return 'error';
    return 'default';
  };

  const comparisonRows: Array<{
    label: string;
    key: string;
    format?: (v: unknown) => string;
  }> = [
    { label: 'Manufacturer', key: 'manufacturer' },
    { label: 'Category', key: 'category' },
    { label: 'Quality Score', key: 'quality_score', format: (v) => v != null ? `${v}%` : '-' },
    { label: 'Lifecycle', key: 'lifecycle_status' },
    { label: 'Unit Price', key: 'unit_price', format: (v) => v != null ? `$${(v as number).toFixed(2)}` : '-' },
    { label: 'Stock', key: 'stock_quantity', format: (v) => v != null ? (v as number).toLocaleString() : '-' },
    { label: 'Lead Time', key: 'lead_time_days', format: (v) => v != null ? `${v} days` : '-' },
    { label: 'RoHS', key: 'rohs_compliant', format: (v) => v === true ? 'Yes' : v === false ? 'No' : '-' },
  ];

  return (
    <Slide direction="up" in={components.length > 0} mountOnEnter unmountOnExit>
      <Paper
        elevation={8}
        sx={{
          position: 'fixed',
          bottom: 0,
          left: sidebarWidth,
          right: 0,
          zIndex: 1200,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          overflow: 'hidden',
        }}
      >
        {/* Header Bar */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1.5,
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            cursor: 'pointer',
          }}
          onClick={() => setExpanded(!expanded)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setExpanded(!expanded);
            }
          }}
          tabIndex={0}
          role="button"
          aria-label={`Toggle comparison view, currently ${expanded ? 'expanded' : 'collapsed'}`}
          aria-expanded={expanded}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <CompareArrowsIcon />
            <Typography variant="subtitle1" fontWeight={600}>
              Compare Components
            </Typography>
            <Chip
              label={maxComponents === Infinity ? `${components.length} selected` : `${components.length}/${maxComponents}`}
              size="small"
              sx={{ bgcolor: 'primary.dark', color: 'inherit' }}
            />
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<SendIcon />}
              onClick={(e) => {
                e.stopPropagation();
                onSendToVault(components);
              }}
              sx={{ color: 'inherit', borderColor: 'rgba(255,255,255,0.5)' }}
            >
              Send to Vault
            </Button>
            <Button
              size="small"
              variant="text"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              sx={{ color: 'inherit' }}
            >
              Clear All
            </Button>
            <IconButton
              size="small"
              sx={{ color: 'inherit' }}
              aria-label={expanded ? 'Collapse comparison' : 'Expand comparison'}
              aria-expanded={expanded}
            >
              {expanded ? <ExpandMoreIcon /> : <ExpandLessIcon />}
            </IconButton>
          </Box>
        </Box>

        {/* Collapsed Preview */}
        {!expanded && (
          <Box sx={{ display: 'flex', gap: 1, p: 1.5, bgcolor: 'background.paper', overflowX: 'auto' }}>
            {components.slice(0, COMPARISON_CONFIG.collapsedDisplayLimit).map((comp) => (
              <Chip
                key={comp.id}
                avatar={
                  comp.image_url ? (
                    <Avatar src={comp.image_url} />
                  ) : (
                    <Avatar>
                      <MemoryIcon />
                    </Avatar>
                  )
                }
                label={comp.mpn}
                onDelete={() => onRemove(comp.id)}
                sx={{ maxWidth: 200, flexShrink: 0 }}
              />
            ))}
            {components.length > COMPARISON_CONFIG.collapsedDisplayLimit && (
              <Chip
                label={`+${components.length - COMPARISON_CONFIG.collapsedDisplayLimit} more`}
                variant="outlined"
                onClick={() => setExpanded(true)}
                sx={{ flexShrink: 0, cursor: 'pointer' }}
              />
            )}
          </Box>
        )}

        {/* Expanded Comparison Table */}
        <Collapse in={expanded}>
          {/* P1-2: Performance warning for large comparisons */}
          {showPerformanceWarning && (
            <Alert severity="info" sx={{ m: 1 }}>
              Comparing {components.length} components. Consider filtering to fewer items for better performance.
            </Alert>
          )}
          <Box sx={{ maxHeight: 400, overflow: 'auto', bgcolor: 'background.paper' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell
                    sx={{ fontWeight: 700, bgcolor: 'action.hover', minWidth: 120 }}
                  >
                    Attribute
                  </TableCell>
                  {components.map((comp) => (
                    <TableCell
                      key={comp.id}
                      align="center"
                      sx={{ fontWeight: 700, bgcolor: 'action.hover', minWidth: 180 }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 1,
                        }}
                      >
                        <Avatar
                          src={comp.image_url}
                          sx={{ width: 32, height: 32 }}
                        >
                          <MemoryIcon fontSize="small" />
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>
                            {comp.mpn}
                          </Typography>
                        </Box>
                        <Tooltip title="Remove from comparison">
                          <IconButton
                            size="small"
                            onClick={() => onRemove(comp.id)}
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {comparisonRows.map((row) => (
                  <TableRow key={row.key} hover>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>
                      {row.label}
                    </TableCell>
                    {components.map((comp) => {
                      const value = (comp as any)[row.key];
                      let displayValue = value ?? '-';

                      if (value !== null && value !== undefined && row.format) {
                        displayValue = row.format(value);
                      }

                      // Special rendering for certain fields
                      if (row.key === 'quality_score' && value) {
                        return (
                          <TableCell key={comp.id} align="center">
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 0.5,
                              }}
                            >
                              {getQualityIcon(value)}
                              <Typography variant="body2">{displayValue}</Typography>
                            </Box>
                          </TableCell>
                        );
                      }

                      if (row.key === 'lifecycle_status' && value) {
                        return (
                          <TableCell key={comp.id} align="center">
                            <Chip
                              label={value}
                              size="small"
                              color={getLifecycleColor(value) as any}
                            />
                          </TableCell>
                        );
                      }

                      return (
                        <TableCell key={comp.id} align="center">
                          <Typography variant="body2">{displayValue}</Typography>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </Collapse>
      </Paper>
    </Slide>
  );
}

export default ComparisonTray;
