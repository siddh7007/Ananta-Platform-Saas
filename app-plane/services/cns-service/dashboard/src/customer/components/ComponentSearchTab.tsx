/**
 * ComponentSearchTab Component
 *
 * Tab 2 of the Customer Portal - Component Search scoped by selected tenant/workspace.
 * Provides search, filtering, and detail view for components.
 *
 * Styled to match the Global Catalog (ComponentSearchEnhanced) page with:
 * - Full-width layout stretched left to right
 * - Enhanced ComponentCard with image, compliance badges, stock/price, quality bar
 * - Table view with all columns (Image, MPN, Manufacturer, Category, Description, Compliance, Stock, Price, Quality, Status, Docs, Actions)
 */

import React, { useState, useCallback, useEffect, useMemo, Component } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Drawer,
  Grid,
  IconButton,
  InputAdornment,
  LinearProgress,
  Pagination,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  Link as MuiLink,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ViewListIcon from '@mui/icons-material/ViewList';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CheckIcon from '@mui/icons-material/Check';
import DescriptionIcon from '@mui/icons-material/Description';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PackageIcon from '@mui/icons-material/Inventory';
import ImageIcon from '@mui/icons-material/Image';
import FilterListIcon from '@mui/icons-material/FilterList';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { API_CONFIG, getAuthHeaders } from '../../config/api';
import {
  getQualityScoreChipColor,
  validateChipColor,
  ValidChipColor,
} from '../../theme';

// Module-level initialization log to trace when this module loads
console.log('[ComponentSearchTab] Module loaded at', new Date().toISOString());

// Safe Chip wrapper that validates color and logs issues
function safeChipColor(color: unknown, context: string): ValidChipColor {
  console.log(`[SafeChipColor] Validating: "${color}" in ${context}`);
  if (color === undefined || color === null) {
    console.log(`[SafeChipColor] Empty color in ${context}, using 'default'`);
    return 'default';
  }
  const validated = validateChipColor(color, context);
  if (validated !== color) {
    console.warn(`[SafeChipColor] INVALID color "${color}" in ${context}, using "${validated}"`);
  }
  return validated;
}

// SafeChip component - wraps MUI Chip with automatic color validation
// This catches ALL invalid color props before they reach MUI
interface SafeChipProps extends Omit<React.ComponentProps<typeof Chip>, 'color'> {
  color?: string | ValidChipColor | undefined;
}
function SafeChip({ color, ...props }: SafeChipProps) {
  // Add unique ID for tracing
  const chipId = React.useId();
  console.log(`[SafeChip ${chipId}] Rendering with color="${color}", label="${props.label}"`);

  // Validate color at render time
  const validatedColor = safeChipColor(color, `SafeChip:${props.label || chipId}`);

  return <Chip {...props} color={validatedColor} />;
}
import ProjectBomFilterPanel from './ProjectBomFilterPanel';
import ComponentSearchSidePanel, {
  ComponentSearchFilters,
  defaultFilters,
} from './ComponentSearchSidePanel';

export interface ComponentSearchTabProps {
  tenantId: string | null;
  workspaceId: string | null;
  /** When true, ignores tenant/workspace filters (admin mode) */
  adminModeAllTenants?: boolean;
  /** Optional pre-selected project ID */
  projectId?: string | null;
  /** Optional pre-selected BOM ID */
  bomId?: string | null;
}

// API response format from /catalog/browse and /catalog/search
interface CatalogComponent {
  component_id: string;
  mpn: string;
  manufacturer: string;
  description?: string;
  category?: string;
  package?: string;
  enrichment_status: string;
  quality_score?: number;
  lifecycle_status?: string;
  last_updated?: string;
  // Rich component data fields
  image_url?: string;
  datasheet_url?: string;
  model_3d_url?: string;
  rohs_compliant?: boolean;
  reach_compliant?: boolean;
  aec_qualified?: boolean;
  unit_price?: number;
  stock_status?: string;
  in_stock?: boolean;
  package_type?: string;
}

// Internal component format for display
interface DisplayComponent {
  id: string;
  mpn: string;
  manufacturer: string;
  description?: string;
  category?: string;
  package?: string;
  status: 'production' | 'staging' | 'pending' | 'rejected';
  qualityScore?: number;
  lifecycle?: string;
  createdAt?: string;
  // Rich data
  image_url?: string;
  datasheet_url?: string;
  model_3d_url?: string;
  rohs_compliant?: boolean;
  reach_compliant?: boolean;
  aec_qualified?: boolean;
  unit_price?: number;
  stock_status?: string;
  in_stock?: boolean;
  package_type?: string;
}

// Map API response to internal format
function mapCatalogComponent(item: CatalogComponent): DisplayComponent {
  // Map enrichment_status to simplified status
  let status: DisplayComponent['status'] = 'pending';
  if (item.enrichment_status === 'production' || item.enrichment_status === 'enriched') {
    status = 'production';
  } else if (item.enrichment_status === 'staging') {
    status = 'staging';
  } else if (item.enrichment_status === 'failed' || item.enrichment_status === 'error' || item.enrichment_status === 'rejected') {
    status = 'rejected';
  }

  return {
    id: item.component_id,
    mpn: item.mpn,
    manufacturer: item.manufacturer,
    description: item.description,
    category: item.category,
    package: item.package,
    status,
    qualityScore: item.quality_score,
    lifecycle: item.lifecycle_status,
    createdAt: item.last_updated,
    image_url: item.image_url,
    datasheet_url: item.datasheet_url,
    model_3d_url: item.model_3d_url,
    rohs_compliant: item.rohs_compliant,
    reach_compliant: item.reach_compliant,
    aec_qualified: item.aec_qualified,
    unit_price: item.unit_price,
    stock_status: item.stock_status,
    in_stock: item.in_stock,
    package_type: item.package_type,
  };
}

// BOM Line Item format from /boms/{id}/line_items API
interface BomLineItem {
  id: string;
  bom_id: string;
  line_number?: number;
  manufacturer_part_number?: string;
  manufacturer?: string;
  quantity?: number;
  reference_designator?: string;
  description?: string;
  enrichment_status?: string;
  component_id?: string;
  enrichment_error?: string;
  lifecycle_status?: string;
  match_confidence?: number;
  component_storage?: string;
  redis_component_key?: string;
  // Direct enrichment fields from bom_line_items table
  category?: string;
  subcategory?: string;
  datasheet_url?: string;
  unit_price?: number;
  risk_level?: string;
  compliance_status?: {
    rohs?: boolean;         // Key used in enrichment
    rohs_compliant?: boolean; // Alternative key
    reach?: boolean;        // Key used in enrichment
    reach_compliant?: boolean; // Alternative key
    aec?: boolean;          // Key used in enrichment
    aec_qualified?: boolean;  // Alternative key
    [key: string]: unknown;
  };
  specifications?: Record<string, unknown>;
  // Pricing can be an array (from enrichment) or object
  pricing?: Array<{
    unit_price?: number;
    currency?: string;
    quantity?: number;
  }> | {
    unit_price?: number;
    currency?: string;
    moq?: number;
    stock_quantity?: number;
    stock_status?: string;
    [key: string]: unknown;
  };
  metadata?: Record<string, unknown>;
  enriched_at?: string;
  // Nested component data from Component Vault (fallback/additional)
  component_data?: {
    id?: string;
    manufacturer_part_number?: string;
    manufacturer?: string;
    category?: string;
    subcategory?: string;
    description?: string;
    datasheet_url?: string;
    image_url?: string;
    lifecycle_status?: string;
    risk_level?: string;
    rohs_compliant?: boolean;
    reach_compliant?: boolean;
    aec_qualified?: boolean;
    unit_price?: number;
    currency?: string;
    moq?: number;
    lead_time_days?: number;
    stock_status?: string;
    quality_score?: number;
    enrichment_source?: string;
  };
  created_at?: string;
  updated_at?: string;
}

/**
 * Maps BOM line item (from /boms/{id}/line_items API) to DisplayComponent format
 * Priority: Direct fields from bom_line_items > component_data from Component Vault
 */
function mapBomLineItem(item: BomLineItem): DisplayComponent {
  const cd = item.component_data;
  const cs = item.compliance_status;
  const pr = item.pricing;

  // Map enrichment_status to simplified status
  let status: DisplayComponent['status'] = 'pending';
  const enrichmentStatus = item.enrichment_status?.toLowerCase();
  if (enrichmentStatus === 'production' || enrichmentStatus === 'enriched') {
    status = 'production';
  } else if (enrichmentStatus === 'staging') {
    status = 'staging';
  } else if (enrichmentStatus === 'failed' || enrichmentStatus === 'error' || enrichmentStatus === 'rejected') {
    status = 'rejected';
  }

  // Extract unit price: direct field > pricing array (first entry with qty=1) > pricing object > component_data
  let unitPrice = item.unit_price ?? cd?.unit_price;
  if (!unitPrice && pr) {
    if (Array.isArray(pr)) {
      // Pricing is an array - find qty=1 price or use first entry
      const qtyOnePrice = pr.find(p => p.quantity === 1);
      unitPrice = qtyOnePrice?.unit_price ?? pr[0]?.unit_price;
    } else {
      // Pricing is an object
      unitPrice = pr.unit_price;
    }
  }

  // Extract stock status: pricing object > component_data (arrays don't have stock_status)
  let stockStatus: string | undefined;
  if (pr && !Array.isArray(pr)) {
    stockStatus = pr.stock_status;
  }
  stockStatus = stockStatus ?? cd?.stock_status;

  // Extract compliance: handle both naming conventions (rohs vs rohs_compliant)
  const rohsCompliant = cs?.rohs ?? cs?.rohs_compliant ?? cd?.rohs_compliant;
  const reachCompliant = cs?.reach ?? cs?.reach_compliant ?? cd?.reach_compliant;
  const aecQualified = cs?.aec ?? cs?.aec_qualified ?? cd?.aec_qualified;

  // Check stock from pricing array or object
  let stockQuantity: number | undefined;
  if (pr && !Array.isArray(pr)) {
    stockQuantity = pr.stock_quantity;
  }

  return {
    // Use component_id if available, otherwise use line item id
    id: item.component_id || item.id,
    // MPN from line item
    mpn: item.manufacturer_part_number || cd?.manufacturer_part_number || '',
    manufacturer: item.manufacturer || cd?.manufacturer || '',
    // Description: direct field > component_data
    description: item.description || cd?.description,
    // Category: direct field > component_data
    category: item.category || cd?.category,
    package: item.subcategory || cd?.subcategory,
    status,
    // Quality score from component_data (not stored directly in bom_line_items)
    qualityScore: cd?.quality_score,
    // Lifecycle: direct field > component_data
    lifecycle: item.lifecycle_status || cd?.lifecycle_status,
    createdAt: item.enriched_at || item.updated_at || item.created_at,
    // Rich data: direct fields > component_data
    image_url: cd?.image_url, // Only in component_data
    datasheet_url: item.datasheet_url || cd?.datasheet_url,
    model_3d_url: undefined, // Not available in BOM line item response
    rohs_compliant: rohsCompliant,
    reach_compliant: reachCompliant,
    aec_qualified: aecQualified,
    unit_price: unitPrice,
    stock_status: stockStatus,
    in_stock: stockStatus === 'in_stock' || stockStatus === 'In Stock' || (stockQuantity !== undefined && stockQuantity > 0),
    package_type: item.subcategory || cd?.subcategory,
  };
}

type StatusFilter = 'all' | 'production' | 'staging' | 'pending' | 'rejected';
type ViewMode = 'table' | 'tiles';

// Status chip configurations with type-safe colors
const STATUS_CHIPS: { key: StatusFilter; label: string; color: ValidChipColor }[] = [
  { key: 'all', label: 'All', color: 'default' },
  { key: 'production', label: 'Production', color: 'success' },
  { key: 'staging', label: 'Staging', color: 'warning' },
  { key: 'pending', label: 'Pending', color: 'info' },
  { key: 'rejected', label: 'Rejected', color: 'error' },
];

/**
 * Get status config with validation and logging
 */
function getStatusConfig(status: string | undefined | null): { label: string; color: ValidChipColor } {
  console.debug('[ComponentSearchTab] getStatusConfig called with:', status);

  const configs: Record<string, { label: string; color: ValidChipColor }> = {
    production: { label: 'Production', color: 'success' },
    staging: { label: 'Staging', color: 'warning' },
    rejected: { label: 'Rejected', color: 'error' },
    pending: { label: 'Pending', color: 'default' },
    enriched: { label: 'Production', color: 'success' },
    failed: { label: 'Failed', color: 'error' },
    error: { label: 'Error', color: 'error' },
  };

  // Safely normalize and check status
  if (status) {
    const normalized = status.toLowerCase().trim();
    if (normalized in configs) {
      return configs[normalized];
    }
    // Log unknown status values for debugging
    console.warn(`[ComponentSearchTab] Unknown status value: "${status}". Using default.`);
  }

  return configs.pending;
}

/**
 * Get quality color for progress bar (hex colors for sx styling)
 */
function getQualityColor(score: number | undefined): string {
  if (score === undefined) {
    console.debug('[ComponentSearchTab] getQualityColor: score undefined, using grey');
    return '#6b7280';
  }
  if (score >= 80) return '#4caf50'; // green
  if (score >= 60) return '#ff9800'; // orange
  if (score >= 40) return '#ff5722'; // deep orange
  return '#f44336'; // red
}

/**
 * Get quality chip color with validation
 */
function getQualityChipColor(score: number | undefined | null): ValidChipColor {
  const color = getQualityScoreChipColor(score, 'ComponentSearchTab quality chip');
  console.debug('[ComponentSearchTab] getQualityChipColor:', { score, color });
  return color;
}

// Skeleton for card loading state
function ComponentCardSkeleton() {
  return (
    <Card sx={{ height: '100%' }}>
      <Box sx={{ display: 'flex', p: 2, gap: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Skeleton variant="rectangular" width={100} height={80} sx={{ borderRadius: 1 }} />
        <Box sx={{ flex: 1 }}>
          <Skeleton variant="text" width="70%" height={28} />
          <Skeleton variant="text" width="50%" height={20} />
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <Skeleton variant="rectangular" width={80} height={24} sx={{ borderRadius: 4 }} />
          </Box>
        </Box>
      </Box>
      <CardContent>
        <Skeleton variant="text" width="100%" height={20} />
        <Skeleton variant="text" width="80%" height={20} />
        <Box sx={{ mt: 2 }}>
          <Skeleton variant="rectangular" width="100%" height={6} sx={{ borderRadius: 1 }} />
        </Box>
      </CardContent>
    </Card>
  );
}

// Enhanced Component Card matching ComponentCard.tsx
interface ComponentCardProps {
  component: DisplayComponent;
  onViewDetails: () => void;
  onEnrich?: (e: React.MouseEvent) => void;
  isEnriching?: boolean;
}

function EnhancedComponentCard({ component, onViewDetails, onEnrich, isEnriching }: ComponentCardProps) {
  const statusConfig = getStatusConfig(component.status);

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'box-shadow 0.2s, transform 0.2s',
        '&:hover': {
          boxShadow: 6,
          transform: 'translateY(-2px)',
        },
        cursor: 'pointer',
        position: 'relative',
      }}
      onClick={onViewDetails}
    >
      {/* Status Badge - Top Right */}
      <Box sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}>
        <Chip
          label={statusConfig.label}
          color={safeChipColor(statusConfig.color, 'EnhancedComponentCard status badge')}
          size="small"
          sx={{ fontWeight: 600, fontSize: '0.7rem' }}
        />
      </Box>

      {/* Header Section with Image and Basic Info */}
      <Box
        sx={{
          display: 'flex',
          p: 2,
          gap: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        {/* Component Image */}
        <Box
          sx={{
            flexShrink: 0,
            width: 100,
            height: 80,
            bgcolor: 'grey.100',
            borderRadius: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {component.image_url ? (
            <img
              src={component.image_url}
              alt={component.mpn}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          ) : (
            <PackageIcon sx={{ fontSize: 40, color: 'grey.400' }} />
          )}
        </Box>

        {/* Basic Component Info */}
        <Box sx={{ flex: 1, minWidth: 0, pr: 4 }}>
          <Tooltip title={component.mpn} placement="top">
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                fontSize: '1rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                mb: 0.5,
              }}
            >
              {component.mpn}
            </Typography>
          </Tooltip>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {component.manufacturer}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {component.category && (
              <Chip
                label={component.category}
                size="small"
                sx={{ bgcolor: 'primary.light', color: 'primary.dark', fontSize: '0.7rem' }}
              />
            )}
            {component.package_type && (
              <Chip
                label={component.package_type}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.7rem' }}
              />
            )}
          </Box>
        </Box>
      </Box>

      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: 2, pb: 1 }}>
        {/* Description */}
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            mb: 2,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: 1.5,
            minHeight: '3em',
          }}
        >
          {component.description || 'No description available'}
        </Typography>

        {/* Compliance, Stock, Price Row */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1,
            mb: 2,
            pb: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          {/* Compliance Badges */}
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {component.rohs_compliant && (
              <Chip
                icon={<CheckCircleIcon sx={{ fontSize: '0.9rem !important' }} />}
                label="RoHS"
                size="small"
                sx={{
                  bgcolor: 'success.light',
                  color: 'success.dark',
                  fontSize: '0.65rem',
                  height: 22,
                  '& .MuiChip-icon': { ml: 0.5 },
                }}
              />
            )}
            {component.reach_compliant && (
              <Chip
                icon={<CheckCircleIcon sx={{ fontSize: '0.9rem !important' }} />}
                label="REACH"
                size="small"
                sx={{
                  bgcolor: 'success.light',
                  color: 'success.dark',
                  fontSize: '0.65rem',
                  height: 22,
                  '& .MuiChip-icon': { ml: 0.5 },
                }}
              />
            )}
            {component.aec_qualified && (
              <Chip
                icon={<CheckCircleIcon sx={{ fontSize: '0.9rem !important' }} />}
                label="AEC-Q"
                size="small"
                sx={{
                  bgcolor: 'secondary.light',
                  color: 'secondary.dark',
                  fontSize: '0.65rem',
                  height: 22,
                  '& .MuiChip-icon': { ml: 0.5 },
                }}
              />
            )}
          </Box>

          {/* Stock & Price */}
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            {component.in_stock !== undefined && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: component.in_stock ? 'success.main' : 'error.main',
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 600,
                    color: component.in_stock ? 'success.main' : 'error.main',
                  }}
                >
                  {component.in_stock ? 'In Stock' : 'Out of Stock'}
                </Typography>
              </Box>
            )}
            {component.unit_price != null && (
              <Typography
                variant="body2"
                sx={{ fontWeight: 700, color: 'text.primary', fontSize: '0.95rem' }}
              >
                ${component.unit_price.toFixed(2)}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Quality Bar and Actions Row */}
        <Box sx={{ mt: 'auto' }}>
          {/* Quality Score Bar */}
          {component.qualityScore !== undefined && (
            <Box sx={{ mb: 1.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  Quality Score
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 700,
                    color: getQualityColor(component.qualityScore),
                    fontSize: '0.75rem',
                  }}
                >
                  {component.qualityScore}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={component.qualityScore}
                sx={{
                  height: 6,
                  borderRadius: 1,
                  bgcolor: 'grey.200',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: getQualityColor(component.qualityScore),
                    borderRadius: 1,
                  },
                }}
              />
            </Box>
          )}

          {/* Action Buttons */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            {component.datasheet_url && (
              <Tooltip title="View Datasheet">
                <IconButton
                  size="small"
                  component="a"
                  href={component.datasheet_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  sx={{
                    color: 'text.secondary',
                    '&:hover': { color: 'primary.main', bgcolor: 'primary.light' },
                  }}
                >
                  <DescriptionIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {component.model_3d_url && (
              <Tooltip title="View 3D Model">
                <IconButton
                  size="small"
                  component="a"
                  href={component.model_3d_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  sx={{
                    color: 'text.secondary',
                    '&:hover': { color: 'secondary.main', bgcolor: 'secondary.light' },
                  }}
                >
                  <ViewInArIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {/* Enrich Button */}
            {onEnrich && (
              <Tooltip title="Enrich component with supplier data">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEnrich(e);
                  }}
                  disabled={isEnriching}
                  sx={{
                    color: 'secondary.main',
                    '&:hover': { color: 'secondary.dark', bgcolor: 'secondary.light' },
                  }}
                >
                  {isEnriching ? (
                    <CircularProgress size={18} color="inherit" />
                  ) : (
                    <AutoFixHighIcon fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="View Details">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewDetails();
                }}
                sx={{
                  color: 'text.secondary',
                  '&:hover': { color: 'success.main', bgcolor: 'success.light' },
                }}
              >
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

// Error Boundary for graceful error handling
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

class ComponentSearchTabErrorBoundary extends Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ComponentSearchTab] Error caught by boundary:', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
    this.setState({ errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      const isPaletteError = this.state.error?.message?.includes('palette');

      return (
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          py={8}
          px={2}
        >
          <Alert severity="error" sx={{ mb: 2, maxWidth: 600, width: '100%' }}>
            <Typography variant="h6" gutterBottom>
              {isPaletteError ? 'Theme/Color Error' : 'Something went wrong'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {this.state.error?.message || 'An unexpected error occurred while loading components.'}
            </Typography>
            {isPaletteError && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                This is usually caused by an invalid color value being passed to a MUI component.
                Check browser console for details.
              </Typography>
            )}
            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <Box
                component="pre"
                sx={{
                  mt: 2,
                  p: 1,
                  bgcolor: 'grey.100',
                  borderRadius: 1,
                  fontSize: '0.7rem',
                  overflow: 'auto',
                  maxHeight: 200,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {this.state.errorInfo.componentStack}
              </Box>
            )}
          </Alert>
          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              startIcon={<RefreshIcon />}
              onClick={this.handleRetry}
            >
              Try Again
            </Button>
            <Button
              variant="outlined"
              onClick={() => window.location.reload()}
            >
              Reload Page
            </Button>
          </Stack>
        </Box>
      );
    }

    return this.props.children;
  }
}

// Sidebar width constant
const SIDEBAR_WIDTH = 280;

function ComponentSearchTabInner({
  tenantId,
  workspaceId,
  adminModeAllTenants = false,
  projectId: initialProjectId,
  bomId: initialBomId,
}: ComponentSearchTabProps) {
  // RENDER START LOG - helps trace when component starts rendering
  console.log('[ComponentSearchTabInner] RENDER START', { tenantId, workspaceId, adminModeAllTenants });

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [page, setPage] = useState(1);
  const [components, setComponents] = useState<DisplayComponent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Project/BOM filter state
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(initialProjectId ?? null);
  const [selectedBomId, setSelectedBomId] = useState<string | null>(initialBomId ?? null);
  const [filterPanelCollapsed, setFilterPanelCollapsed] = useState(false);

  // Side panel filter state
  const [sideFilters, setSideFilters] = useState<ComponentSearchFilters>(defaultFilters);
  const [sidebarOpen, setSidebarOpen] = useState(true); // Always open by default, will auto-close on mobile via useEffect

  // Available facets for filters (populated from API response)
  const [availableManufacturers, setAvailableManufacturers] = useState<string[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);

  // Enrichment state
  const [enrichingComponents, setEnrichingComponents] = useState<Set<string>>(new Set());
  const [enrichmentSuccess, setEnrichmentSuccess] = useState<string | null>(null);
  const [enrichmentError, setEnrichmentError] = useState<string | null>(null);

  // Navigation hook for component details
  const navigate = useNavigate();

  const limit = 10;
  const totalPages = Math.ceil(total / limit);

  // Auto-close sidebar on mobile devices
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [isMobile]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPage(1); // Reset to first page on new search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch components with AbortController for request cancellation
  const fetchComponents = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      // Use /catalog/browse for listing, /catalog/search when there's a search query
      // If BOM is selected, use /boms/{id}/line_items endpoint instead
      let endpoint: string;
      let url: URL;

      if (selectedBomId) {
        // Fetch components from BOM line items
        endpoint = `/boms/${selectedBomId}/line_items`;
        url = new URL(`${API_CONFIG.BASE_URL}${endpoint}`, window.location.origin);
        // Add organization_id for tenant scoping
        if (!adminModeAllTenants && tenantId) {
          url.searchParams.set('organization_id', tenantId);
        }
      } else {
        // Standard catalog browse/search
        endpoint = debouncedQuery ? '/catalog/search' : '/catalog/browse';
        url = new URL(`${API_CONFIG.BASE_URL}${endpoint}`, window.location.origin);

        // Add filters (unless admin mode is bypassing tenant filter)
        if (!adminModeAllTenants) {
          if (tenantId) url.searchParams.set('organization_id', tenantId);
          if (workspaceId) url.searchParams.set('workspace_id', workspaceId);
        }

        // Add project filter if selected
        if (selectedProjectId) {
          url.searchParams.set('project_id', selectedProjectId);
        }
      }

      // Add query parameter for /catalog/search endpoint (backend expects 'q', not 'query')
      if (debouncedQuery) url.searchParams.set('q', debouncedQuery);

      // IMPORTANT: When a BOM is selected, skip all status/lifecycle filters
      // to show ALL components in the BOM. These filters are for catalog browsing,
      // not for viewing BOM contents.
      if (!selectedBomId) {
        // Backend expects lifecycle_statuses as array - send as comma-separated for proper parsing
        if (statusFilter !== 'all') {
          // Backend accepts multiple values via repeated params: lifecycle_statuses=production&lifecycle_statuses=staging
          // For single value, just append once
          url.searchParams.append('lifecycle_statuses', statusFilter);
        }

        // Add side panel filters
        // Lifecycle status from sidebar
        const activeLifecycles = Object.entries(sideFilters.lifecycle)
          .filter(([, v]) => v)
          .map(([k]) => k);
        if (activeLifecycles.length > 0) {
          activeLifecycles.forEach((lc) => url.searchParams.append('lifecycle_statuses', lc));
        }

        // Quality score minimum
        if (sideFilters.qualityScoreMin > 0) {
          url.searchParams.set('min_quality_score', String(sideFilters.qualityScoreMin));
        }

        // Enrichment status
        const activeEnrichment = Object.entries(sideFilters.enrichmentStatus)
          .filter(([, v]) => v)
          .map(([k]) => k);
        if (activeEnrichment.length > 0) {
          activeEnrichment.forEach((es) => url.searchParams.append('enrichment_status', es));
        }

        // Compliance filters
        if (sideFilters.compliance.rohs !== null) {
          url.searchParams.set('rohs_compliant', String(sideFilters.compliance.rohs));
        }
        if (sideFilters.compliance.reach !== null) {
          url.searchParams.set('reach_compliant', String(sideFilters.compliance.reach));
        }
        if (sideFilters.compliance.aecq !== null) {
          url.searchParams.set('aec_qualified', String(sideFilters.compliance.aecq));
        }

        // Manufacturer filters
        if (sideFilters.manufacturers.length > 0) {
          sideFilters.manufacturers.forEach((m) => url.searchParams.append('manufacturer', m));
        }

        // Category filters
        if (sideFilters.categories.length > 0) {
          sideFilters.categories.forEach((c) => url.searchParams.append('category', c));
        }
      }

      // API uses offset-based pagination, not page-based
      url.searchParams.set('offset', String((page - 1) * limit));
      url.searchParams.set('limit', String(limit));

      const response = await fetch(url.toString(), {
        headers: getAuthHeaders(),
        signal,
      });

      // Check if request was aborted
      if (signal?.aborted) return;

      if (!response.ok) {
        const errorText = `Failed to fetch components: ${response.status}`;
        console.error(errorText);
        setError(errorText);
        setComponents([]);
        setTotal(0);
        return;
      }

      const data = await response.json();
      // API returns different formats:
      // - /catalog/browse: { results: [...], total: number, facets: {...} }
      // - /boms/{id}/line_items: { items: [...], total: number, page: number, page_size: number }
      const rawItems = Array.isArray(data) ? data : (data.results || data.items || data.data || []);
      // Map API response to internal format - use different mapper for BOM line items
      const items = selectedBomId
        ? rawItems.map(mapBomLineItem)
        : rawItems.map(mapCatalogComponent);
      setComponents(items);
      setTotal(data.total || items.length);
      setError(null);

      // Extract facets for sidebar filters if available
      // API returns facets as: { value: string, label: string, count: number } or { name: string } or string
      if (data.facets) {
        if (data.facets.manufacturers && Array.isArray(data.facets.manufacturers)) {
          setAvailableManufacturers(data.facets.manufacturers.map((f: unknown) => {
            if (typeof f === 'string') return f;
            if (f && typeof f === 'object') {
              const obj = f as Record<string, unknown>;
              // Handle {value, label, count} format from API
              if (typeof obj.value === 'string') return obj.value;
              if (typeof obj.label === 'string') return obj.label;
              if (typeof obj.name === 'string') return obj.name;
            }
            return String(f);
          }));
        }
        if (data.facets.categories && Array.isArray(data.facets.categories)) {
          setAvailableCategories(data.facets.categories.map((f: unknown) => {
            if (typeof f === 'string') return f;
            if (f && typeof f === 'object') {
              const obj = f as Record<string, unknown>;
              // Handle {value, label, count} format from API
              if (typeof obj.value === 'string') return obj.value;
              if (typeof obj.label === 'string') return obj.label;
              if (typeof obj.name === 'string') return obj.name;
            }
            return String(f);
          }));
        }
      }
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') return;

      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch components';
      console.error('Error fetching components:', err);
      setError(errorMessage);
      setComponents([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [tenantId, workspaceId, adminModeAllTenants, debouncedQuery, statusFilter, page, selectedProjectId, selectedBomId, sideFilters]);

  // Refetch when filters change with AbortController cleanup
  useEffect(() => {
    const abortController = new AbortController();
    fetchComponents(abortController.signal);
    return () => abortController.abort();
  }, [fetchComponents]);

  // Handlers
  const handleStatusFilterChange = (status: StatusFilter) => {
    setStatusFilter(status);
    setPage(1);
  };

  const handleViewModeChange = (_: React.MouseEvent, mode: ViewMode | null) => {
    if (mode) setViewMode(mode);
  };

  const handleViewDetails = useCallback((component: DisplayComponent) => {
    // Navigate to full-page component detail view
    navigate(`/component/${encodeURIComponent(component.mpn)}`);
  }, [navigate]);

  // Handle single component enrichment
  const handleEnrichComponent = useCallback(async (component: DisplayComponent, e?: React.MouseEvent) => {
    // Stop event propagation if called from a click handler
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }

    // Already enriching this component
    if (enrichingComponents.has(component.id)) {
      return;
    }

    // Clear previous messages
    setEnrichmentSuccess(null);
    setEnrichmentError(null);

    // Add to enriching set
    setEnrichingComponents(prev => new Set(prev).add(component.id));

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/component/enrich`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mpn: component.mpn,
          manufacturer: component.manufacturer || null,
          organization_id: tenantId || '',
          force_refresh: false,
          enable_suppliers: true,
          enable_ai: false,
          enable_web_scraping: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Enrichment failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('[Enrich] Workflow started:', result);

      setEnrichmentSuccess(`Enrichment started for ${component.mpn}. Workflow ID: ${result.workflow_id}`);

      // Open Temporal UI in new tab if available
      if (result.temporal_ui_url) {
        window.open(result.temporal_ui_url, '_blank', 'noopener,noreferrer');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start enrichment';
      console.error('[Enrich] Error:', err);
      setEnrichmentError(`Failed to enrich ${component.mpn}: ${errorMessage}`);
    } finally {
      // Remove from enriching set
      setEnrichingComponents(prev => {
        const next = new Set(prev);
        next.delete(component.id);
        return next;
      });
    }
  }, [tenantId, enrichingComponents]);

  // Scope indicator
  const scopeText = useMemo(() => {
    if (adminModeAllTenants) return 'All tenants (Admin Mode)';
    if (!tenantId) return 'All tenants';
    const tenantPart = `Tenant: ${tenantId.substring(0, 8)}...`;
    const workspacePart = workspaceId ? ` / Workspace: ${workspaceId.substring(0, 8)}...` : '';
    return tenantPart + workspacePart;
  }, [tenantId, workspaceId, adminModeAllTenants]);

  // Render component image
  const renderComponentImage = (component: DisplayComponent) => {
    if (component.image_url) {
      return (
        <Box
          component="img"
          src={component.image_url}
          alt={`${component.mpn} component image`}
          sx={{
            width: 40,
            height: 40,
            objectFit: 'contain',
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            p: 0.5,
          }}
        />
      );
    }

    return (
      <Box
        sx={{
          width: 40,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'grey.100',
        }}
      >
        <ImageIcon sx={{ fontSize: 20, color: 'grey.400' }} />
      </Box>
    );
  };

  // Render compliance badges
  const renderComplianceBadges = (component: DisplayComponent) => {
    const badges = [];

    if (component.rohs_compliant) {
      badges.push(
        <Chip
          key="rohs"
          label="RoHS"
          size="small"
          color="success"
          icon={<CheckIcon />}
          sx={{ fontSize: '0.7rem' }}
        />
      );
    }

    if (component.reach_compliant) {
      badges.push(
        <Chip
          key="reach"
          label="REACH"
          size="small"
          color="success"
          icon={<CheckIcon />}
          sx={{ fontSize: '0.7rem' }}
        />
      );
    }

    if (component.aec_qualified) {
      badges.push(
        <Chip
          key="aec"
          label="AEC-Q"
          size="small"
          color="success"
          icon={<CheckIcon />}
          sx={{ fontSize: '0.7rem' }}
        />
      );
    }

    return badges.length > 0 ? (
      <Box display="flex" gap={0.5} flexWrap="wrap">
        {badges}
      </Box>
    ) : (
      <Typography variant="caption" color="text.secondary">—</Typography>
    );
  };

  // Render stock status
  const renderStockStatus = (component: DisplayComponent) => {
    if (component.in_stock === undefined && !component.stock_status) {
      return <Typography variant="caption" color="text.secondary">—</Typography>;
    }

    const inStock = component.in_stock ?? (component.stock_status?.toLowerCase().includes('in stock'));

    return (
      <Box display="flex" alignItems="center" gap={0.5}>
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            bgcolor: inStock ? 'success.main' : 'error.main',
          }}
        />
        <Typography variant="caption" color="text.secondary">
          {component.stock_status || (inStock ? 'In Stock' : 'Out of Stock')}
        </Typography>
      </Box>
    );
  };

  // Render pricing
  const renderPricing = (component: DisplayComponent) => {
    if (!component.unit_price) {
      return <Typography variant="caption" color="text.secondary">—</Typography>;
    }

    return (
      <Typography variant="body2" color="primary" fontWeight={600}>
        ${component.unit_price.toFixed(2)}
      </Typography>
    );
  };

  // Handlers for project/BOM filter changes
  const handleProjectChange = useCallback((projectId: string | null) => {
    setSelectedProjectId(projectId);
    setPage(1);
  }, []);

  const handleBomChange = useCallback((bomId: string | null) => {
    setSelectedBomId(bomId);
    setPage(1);
  }, []);

  // Handle sidebar filter changes
  const handleSideFiltersChange = useCallback((filters: ComponentSearchFilters) => {
    setSideFilters(filters);
    setPage(1);
  }, []);

  // Toggle sidebar
  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  // Calculate active sidebar filter count for badge
  const sideFilterCount = useMemo(() => {
    let count = 0;
    if (Object.values(sideFilters.lifecycle).some(Boolean)) count++;
    if (sideFilters.qualityScoreMin > 0) count++;
    if (Object.values(sideFilters.enrichmentStatus).some(Boolean)) count++;
    if (Object.values(sideFilters.compliance).some((v) => v !== null)) count++;
    if (sideFilters.manufacturers.length > 0) count++;
    if (sideFilters.categories.length > 0) count++;
    return count;
  }, [sideFilters]);

  return (
    <Box sx={{ display: 'flex', height: '100%' }}>
      {/* Side Filter Panel - Desktop (hidden when BOM is selected - filters not applicable) */}
      {!isMobile && sidebarOpen && !selectedBomId && (
        <Box
          sx={{
            width: SIDEBAR_WIDTH,
            flexShrink: 0,
            height: 'calc(100vh - 200px)',
            position: 'sticky',
            top: 0,
          }}
        >
          <ComponentSearchSidePanel
            filters={sideFilters}
            onFiltersChange={handleSideFiltersChange}
            availableManufacturers={availableManufacturers}
            availableCategories={availableCategories}
            disabled={false}
            width={SIDEBAR_WIDTH}
          />
        </Box>
      )}

      {/* Side Filter Panel - Mobile Drawer (hidden when BOM is selected) */}
      {isMobile && !selectedBomId && (
        <Drawer
          anchor="left"
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          PaperProps={{
            sx: { width: SIDEBAR_WIDTH },
          }}
        >
          <ComponentSearchSidePanel
            filters={sideFilters}
            onFiltersChange={handleSideFiltersChange}
            availableManufacturers={availableManufacturers}
            availableCategories={availableCategories}
            disabled={false}
            width={SIDEBAR_WIDTH}
          />
        </Drawer>
      )}

      {/* Main Content Area */}
      <Box sx={{ flex: 1, minWidth: 0, pl: sidebarOpen && !isMobile ? 2 : 0 }}>
        {/* Project & BOM Filter Panel */}
        <ProjectBomFilterPanel
          tenantId={tenantId}
          workspaceId={workspaceId}
          selectedProjectId={selectedProjectId}
          selectedBomId={selectedBomId}
          onProjectChange={handleProjectChange}
          onBomChange={handleBomChange}
          collapsed={filterPanelCollapsed}
          onCollapsedChange={setFilterPanelCollapsed}
        />

        {/* Search and Filters - Full width */}
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Box display="flex" gap={2} alignItems="flex-start" flexWrap="wrap">
              {/* Sidebar Toggle Button - Hidden when BOM is selected (filters not applicable) */}
              {!selectedBomId && (
                <Tooltip title={sidebarOpen ? 'Hide filters' : 'Show filters'}>
                  <Button
                    variant={sidebarOpen ? 'contained' : 'outlined'}
                    color="primary"
                    onClick={handleToggleSidebar}
                    startIcon={sidebarOpen ? <MenuOpenIcon /> : <FilterListIcon />}
                    sx={{ minWidth: 120 }}
                  >
                    Filters
                    {sideFilterCount > 0 && (
                      <Chip
                        label={sideFilterCount}
                        size="small"
                        color="error"
                        sx={{ ml: 1, height: 20, minWidth: 20, fontSize: '0.7rem' }}
                      />
                    )}
                  </Button>
                </Tooltip>
              )}

              {/* Search Bar - Takes most space */}
              <Box sx={{ flexGrow: 1, minWidth: 300 }}>
                <TextField
                  fullWidth
                  placeholder="Search MPN, Manufacturer, Description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: loading ? (
                      <InputAdornment position="end">
                        <CircularProgress size={20} />
                      </InputAdornment>
                    ) : null,
                  }}
                />
              </Box>
            </Box>

            {/* Error Display */}
            {error && (
              <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {/* Enrichment Success/Error Alerts */}
            {enrichmentSuccess && (
              <Alert severity="success" sx={{ mt: 2 }} onClose={() => setEnrichmentSuccess(null)}>
                {enrichmentSuccess}
              </Alert>
            )}
            {enrichmentError && (
              <Alert severity="error" sx={{ mt: 2 }} onClose={() => setEnrichmentError(null)}>
                {enrichmentError}
              </Alert>
            )}
          </CardContent>
        </Card>

      {/* Results Toolbar - Full width */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={2}>
        {/* Left side - Status Filters & Count */}
        <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
          {/* Status filter chips - hidden when BOM is selected (not applicable) */}
          {!selectedBomId && (
            <Stack direction="row" spacing={1}>
              {STATUS_CHIPS.map((chip) => (
                <Chip
                  key={chip.key}
                  label={chip.label}
                  color={safeChipColor(statusFilter === chip.key ? chip.color : 'default', `STATUS_CHIPS filter ${chip.key}`)}
                  variant={statusFilter === chip.key ? 'filled' : 'outlined'}
                  onClick={() => handleStatusFilterChange(chip.key)}
                  sx={{ cursor: 'pointer' }}
                />
              ))}
            </Stack>
          )}
          <Chip
            label={`${total} components`}
            color="primary"
            size="small"
          />
        </Box>

        {/* Right side - View Toggle */}
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={handleViewModeChange}
          size="small"
        >
          <ToggleButton value="table">
            <ViewListIcon />
            <Typography variant="caption" ml={1}>TABLE</Typography>
          </ToggleButton>
          <ToggleButton value="tiles">
            <ViewModuleIcon />
            <Typography variant="caption" ml={1}>TILES</Typography>
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Scope Indicator */}
      <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
        Results scoped to: {scopeText}
      </Typography>

      {/* Results - Table View */}
      {viewMode === 'table' && (
        <Card>
          <TableContainer>
            <Table size="small" aria-label="Component search results table">
              <TableHead>
                <TableRow>
                  <TableCell width={60}><strong>IMAGE</strong></TableCell>
                  <TableCell><strong>MPN</strong></TableCell>
                  <TableCell><strong>MANUFACTURER</strong></TableCell>
                  <TableCell><strong>CATEGORY</strong></TableCell>
                  <TableCell><strong>DESCRIPTION</strong></TableCell>
                  <TableCell align="center"><strong>COMPLIANCE</strong></TableCell>
                  <TableCell align="center"><strong>STOCK</strong></TableCell>
                  <TableCell align="center"><strong>PRICE</strong></TableCell>
                  <TableCell align="center"><strong>QUALITY</strong></TableCell>
                  <TableCell align="center"><strong>STATUS</strong></TableCell>
                  <TableCell align="center"><strong>DOCS</strong></TableCell>
                  <TableCell align="center"><strong>ACTIONS</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading
                  ? Array.from({ length: 10 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton variant="rectangular" width={40} height={40} /></TableCell>
                        <TableCell><Skeleton variant="text" width={120} /></TableCell>
                        <TableCell><Skeleton variant="text" width={100} /></TableCell>
                        <TableCell><Skeleton variant="text" width={80} /></TableCell>
                        <TableCell><Skeleton variant="text" width={150} /></TableCell>
                        <TableCell><Skeleton variant="text" width={60} /></TableCell>
                        <TableCell><Skeleton variant="text" width={60} /></TableCell>
                        <TableCell><Skeleton variant="text" width={50} /></TableCell>
                        <TableCell><Skeleton variant="text" width={50} /></TableCell>
                        <TableCell><Skeleton variant="text" width={70} /></TableCell>
                        <TableCell><Skeleton variant="text" width={40} /></TableCell>
                        <TableCell><Skeleton variant="text" width={80} /></TableCell>
                      </TableRow>
                    ))
                  : components.map((component) => (
                      <TableRow
                        key={component.id}
                        hover
                        onClick={() => handleViewDetails(component)}
                        sx={{ cursor: 'pointer' }}
                      >
                        {/* Image */}
                        <TableCell>{renderComponentImage(component)}</TableCell>
                        {/* MPN */}
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {component.mpn}
                          </Typography>
                        </TableCell>
                        {/* Manufacturer */}
                        <TableCell>{component.manufacturer}</TableCell>
                        {/* Category */}
                        <TableCell>
                          {component.category && (
                            <Chip label={component.category} size="small" variant="outlined" />
                          )}
                        </TableCell>
                        {/* Description */}
                        <TableCell>
                          <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                            {component.description}
                          </Typography>
                        </TableCell>
                        {/* Compliance */}
                        <TableCell align="center">
                          {renderComplianceBadges(component)}
                        </TableCell>
                        {/* Stock */}
                        <TableCell align="center">
                          {renderStockStatus(component)}
                        </TableCell>
                        {/* Price */}
                        <TableCell align="center">
                          {renderPricing(component)}
                        </TableCell>
                        {/* Quality */}
                        <TableCell align="center">
                          {component.qualityScore !== undefined ? (
                            <Chip
                              label={`${component.qualityScore}%`}
                              color={safeChipColor(getQualityChipColor(component.qualityScore), 'Table quality score')}
                              size="small"
                            />
                          ) : (
                            <Typography variant="caption" color="text.secondary">—</Typography>
                          )}
                        </TableCell>
                        {/* Status */}
                        <TableCell align="center">
                          <Chip
                            label={getStatusConfig(component.status).label}
                            color={safeChipColor(getStatusConfig(component.status).color, 'Table component status')}
                            size="small"
                          />
                        </TableCell>
                        {/* Docs */}
                        <TableCell align="center">
                          <Box display="flex" gap={0.5} justifyContent="center">
                            {component.datasheet_url && (
                              <Tooltip title="Datasheet">
                                <IconButton
                                  size="small"
                                  href={component.datasheet_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <DescriptionIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {component.model_3d_url && (
                              <Tooltip title="3D Model">
                                <IconButton
                                  size="small"
                                  href={component.model_3d_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ViewInArIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {!component.datasheet_url && !component.model_3d_url && (
                              <Typography variant="caption" color="text.secondary">—</Typography>
                            )}
                          </Box>
                        </TableCell>
                        {/* Actions */}
                        <TableCell align="center">
                          <Box display="flex" gap={1} justifyContent="center" alignItems="center">
                            {/* Enrich Button */}
                            <Tooltip title="Enrich component with supplier data">
                              <IconButton
                                size="small"
                                color="secondary"
                                onClick={(e) => handleEnrichComponent(component, e)}
                                disabled={enrichingComponents.has(component.id)}
                                sx={{
                                  '&:hover': { bgcolor: 'secondary.light' },
                                }}
                              >
                                {enrichingComponents.has(component.id) ? (
                                  <CircularProgress size={18} color="inherit" />
                                ) : (
                                  <AutoFixHighIcon fontSize="small" />
                                )}
                              </IconButton>
                            </Tooltip>
                            {/* View Details Link */}
                            <MuiLink
                              component={Link}
                              to={`/component/${encodeURIComponent(component.mpn)}`}
                              underline="hover"
                              onClick={(e: React.MouseEvent) => e.stopPropagation()}
                            >
                              View
                            </MuiLink>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* Results - Tiles View */}
      {viewMode === 'tiles' && (
        <Grid container spacing={3}>
          {loading
            ? Array.from({ length: 8 }).map((_, i) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={i}>
                  <ComponentCardSkeleton />
                </Grid>
              ))
            : components.map((component) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={component.id}>
                  <EnhancedComponentCard
                    component={component}
                    onViewDetails={() => handleViewDetails(component)}
                    onEnrich={(e) => handleEnrichComponent(component, e)}
                    isEnriching={enrichingComponents.has(component.id)}
                  />
                </Grid>
              ))}
        </Grid>
      )}

      {/* Empty State */}
      {!loading && components.length === 0 && (
        <Card>
          <CardContent>
            <Box textAlign="center" py={6}>
              <SearchIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                No components found
              </Typography>
              <Typography variant="body2" color="text.disabled">
                Try adjusting your search or filters
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Box display="flex" justifyContent="center" mt={3}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, p) => setPage(p)}
            color="primary"
            size="large"
            showFirstButton
            showLastButton
          />
        </Box>
      )}
      </Box>
    </Box>
  );
}

// Export wrapped with Error Boundary
export default function ComponentSearchTab(props: ComponentSearchTabProps) {
  return (
    <ComponentSearchTabErrorBoundary>
      <ComponentSearchTabInner {...props} />
    </ComponentSearchTabErrorBoundary>
  );
}

// Display name for React DevTools
ComponentSearchTab.displayName = 'ComponentSearchTab';
