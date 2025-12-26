/**
 * ComponentDetailPage - Single-Scroll Component Information View
 *
 * Redesigned for staff efficiency - ALL data visible on one scrollable page.
 * No tabs - sections are stacked vertically with sticky header navigation.
 *
 * Features:
 * - Sticky header with section navigation
 * - Hero section with image, basic info, quick stats
 * - Specifications section
 * - Compliance & Lifecycle section
 * - Pricing & Availability section
 * - Supplier Data section (collapsible JSON)
 * - Quality & Metadata section
 * - Resources section
 * - Print support with auto-expand
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Button,
  Alert,
  CircularProgress,
  Grid,
  Paper,
  Breadcrumbs,
  AppBar,
  Toolbar,
  LinearProgress,
  Link as MuiLink,
  Tooltip,
  IconButton,
} from '@mui/material';
import { useParams, useNavigate, Link } from 'react-router-dom';

// Icons
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import HomeIcon from '@mui/icons-material/Home';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import RefreshIcon from '@mui/icons-material/Refresh';
import DownloadIcon from '@mui/icons-material/Download';
import PrintIcon from '@mui/icons-material/Print';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import MemoryIcon from '@mui/icons-material/Memory';
import CategoryIcon from '@mui/icons-material/Category';
import InfoIcon from '@mui/icons-material/Info';
import VerifiedIcon from '@mui/icons-material/Verified';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import TimelineIcon from '@mui/icons-material/Timeline';
import LinkIcon from '@mui/icons-material/Link';
import InventoryIcon from '@mui/icons-material/Inventory';
import StorefrontIcon from '@mui/icons-material/Storefront';

// Detail components
import { SectionCard, DataTable, createRow, CollapsibleJsonViewer, ComplianceBadge } from './detail';
import { CNS_API_URL, getAuthHeadersAsync } from '../config/api';

// UUID v4 regex pattern
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Section definitions for navigation
const SECTIONS = [
  { id: 'specifications', label: 'Specs', icon: <InfoIcon fontSize="small" /> },
  { id: 'compliance', label: 'Compliance', icon: <VerifiedIcon fontSize="small" /> },
  { id: 'pricing', label: 'Pricing', icon: <AttachMoneyIcon fontSize="small" /> },
  { id: 'suppliers', label: 'Suppliers', icon: <LocalShippingIcon fontSize="small" /> },
  { id: 'quality', label: 'Quality', icon: <TimelineIcon fontSize="small" /> },
  { id: 'resources', label: 'Resources', icon: <LinkIcon fontSize="small" /> },
];

// Supplier brand colors
const SUPPLIER_COLORS: Record<string, string> = {
  mouser: '#004A99',
  digikey: '#CC0000',
  element14: '#E31837',
  newark: '#E31837',
  arrow: '#F26522',
  avnet: '#F58220',
  tme: '#0066CC',
  lcsc: '#0070C0',
  default: '#666666',
};

// Component detail interface
interface ComponentDetail {
  id: string;
  mpn: string;
  manufacturer: string;
  category: string;
  subcategory?: string;
  category_path?: string;
  product_family?: string;
  product_series?: string;
  description: string;
  datasheet_url?: string;
  image_url?: string;
  model_3d_url?: string;
  package?: string;
  lifecycle: string;
  risk_level?: string;
  rohs: string;
  reach: string;
  aec_qualified?: boolean;
  halogen_free?: boolean;
  eccn_code?: string;
  specifications?: Record<string, any>;
  quality_metadata?: Record<string, any>;
  ai_metadata?: Record<string, any>;
  pricing?: Array<{ quantity: number; price: number }>;
  quality_score: number;
  enrichment_source: string;
  enrichment_count?: number;
  usage_count?: number;
  last_enriched_at?: string;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
  stock_status?: string;
  lead_time_days?: number;
  unit_price?: number;
  currency?: string;
  moq?: number;
  supplier_data?: Record<string, any>;
}

// Helper functions
const getQualityColor = (score: number): string => {
  if (score >= 90) return '#22c55e'; // green
  if (score >= 70) return '#f59e0b'; // amber
  if (score >= 50) return '#f97316'; // orange
  return '#ef4444'; // red
};

const getLifecycleColor = (lifecycle: string): 'success' | 'warning' | 'error' | 'default' => {
  const status = lifecycle?.toLowerCase() || '';
  if (status === 'active' || status === 'production') return 'success';
  if (status === 'eol' || status === 'end of life' || status === 'obsolete') return 'error';
  if (status === 'nrnd' || status === 'not recommended for new designs') return 'warning';
  return 'default';
};

const formatDate = (dateStr: string | undefined): string => {
  if (!dateStr) return 'Unknown';
  return new Date(dateStr).toLocaleString();
};

/**
 * ComponentDetailPage Component
 */
export const ComponentDetailPage: React.FC = () => {
  const { mpn, id } = useParams<{ mpn?: string; id?: string }>();
  const navigate = useNavigate();

  const [component, setComponent] = useState<ComponentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>('specifications');
  const [printMode, setPrintMode] = useState(false);

  // Section refs for intersection observer
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  // Determine which ID to use
  const componentIdentifier = id || mpn;
  const isUuidLookup = componentIdentifier ? UUID_REGEX.test(componentIdentifier) : false;

  // Load component data
  const loadComponentDetail = useCallback(async () => {
    if (!componentIdentifier) return;

    setLoading(true);
    setError(null);

    try {
      const endpoint = isUuidLookup
        ? `${CNS_API_URL}/catalog/component/id/${componentIdentifier}`
        : `${CNS_API_URL}/catalog/component/${componentIdentifier}`;

      const headers = await getAuthHeadersAsync();
      const response = await fetch(endpoint, { headers });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to load component details');
      }

      const data: ComponentDetail = await response.json();
      setComponent(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load component details');
    } finally {
      setLoading(false);
    }
  }, [componentIdentifier, isUuidLookup]);

  useEffect(() => {
    loadComponentDetail();
  }, [loadComponentDetail]);

  // Intersection observer for active section tracking
  useEffect(() => {
    if (!component) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      {
        rootMargin: '-100px 0px -50% 0px',
        threshold: 0,
      }
    );

    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [component]);

  // Scroll to section
  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Export JSON
  const handleExport = () => {
    if (!component) return;
    const json = JSON.stringify(component, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${component.mpn}_component_detail.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Print handler
  const handlePrint = () => {
    setPrintMode(true);
    setTimeout(() => {
      window.print();
      setPrintMode(false);
    }, 100);
  };

  // Loading state
  if (loading) {
    return (
      <Box p={3} display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="body1" sx={{ ml: 2 }}>Loading component details...</Typography>
      </Box>
    );
  }

  // Error state
  if (error || !component) {
    return (
      <Box p={3}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error || 'Component not found'}
        </Alert>
        <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
          Go Back
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 4 }}>
      {/* Sticky Header */}
      <AppBar
        position="sticky"
        color="default"
        elevation={1}
        sx={{
          top: 0,
          zIndex: 1100,
          bgcolor: 'background.paper',
          borderBottom: '1px solid',
          borderColor: 'divider',
          '@media print': { display: 'none' },
        }}
      >
        <Toolbar sx={{ gap: 2, flexWrap: 'wrap', py: 1 }}>
          {/* Back button and title */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 200 }}>
            <IconButton size="small" onClick={() => navigate(-1)}>
              <ArrowBackIcon />
            </IconButton>
            <Box sx={{ overflow: 'hidden' }}>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                sx={{ fontSize: '0.7rem', lineHeight: 1 }}
              >
                {component.manufacturer}
              </Typography>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {component.mpn}
              </Typography>
            </Box>
          </Box>

          {/* Section navigation chips */}
          <Box
            sx={{
              display: 'flex',
              gap: 0.5,
              flex: 1,
              overflowX: 'auto',
              '&::-webkit-scrollbar': { display: 'none' },
            }}
          >
            {SECTIONS.map(({ id, label, icon }) => (
              <Chip
                key={id}
                label={label}
                icon={icon}
                size="small"
                onClick={() => scrollToSection(id)}
                variant={activeSection === id ? 'filled' : 'outlined'}
                color={activeSection === id ? 'primary' : 'default'}
                sx={{
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  height: 28,
                  '& .MuiChip-icon': { fontSize: '0.9rem' },
                }}
              />
            ))}
          </Box>

          {/* Action buttons */}
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="Export JSON">
              <IconButton size="small" onClick={handleExport}>
                <DownloadIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Print">
              <IconButton size="small" onClick={handlePrint}>
                <PrintIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Refresh">
              <IconButton size="small" onClick={loadComponentDetail}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Print Header (only visible in print) */}
      <Box
        sx={{
          display: 'none',
          '@media print': {
            display: 'block',
            p: 2,
            borderBottom: '2px solid #333',
            mb: 2,
          },
        }}
      >
        <Typography variant="h5" fontWeight={600}>
          {component.mpn}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {component.manufacturer} | Printed: {new Date().toLocaleString()} | ID: {component.id}
        </Typography>
      </Box>

      {/* Main Content */}
      <Box sx={{ p: 3 }}>
        {/* Breadcrumbs */}
        <Breadcrumbs
          separator={<NavigateNextIcon fontSize="small" />}
          sx={{ mb: 2, '@media print': { display: 'none' } }}
        >
          <MuiLink component={Link} to="/" underline="hover" color="inherit" sx={{ display: 'flex', alignItems: 'center' }}>
            <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            Dashboard
          </MuiLink>
          <MuiLink component={Link} to="/component-search" underline="hover" color="inherit">
            Component Search
          </MuiLink>
          <Typography color="text.primary">{component.mpn}</Typography>
        </Breadcrumbs>

        {/* ========================================= */}
        {/* HERO SECTION */}
        {/* ========================================= */}
        <Card sx={{ mb: 3, '@media print': { boxShadow: 'none', border: '1px solid #ccc' } }}>
          <CardContent sx={{ p: 3 }}>
            <Grid container spacing={3}>
              {/* Component Image */}
              <Grid item xs={12} sm={4} md={3}>
                <Box
                  sx={{
                    width: '100%',
                    height: 180,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'grey.100',
                    borderRadius: 2,
                    overflow: 'hidden',
                    '@media print': { height: 120 },
                  }}
                >
                  {component.image_url ? (
                    <img
                      src={component.image_url}
                      alt={component.mpn}
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <MemoryIcon sx={{ fontSize: 64, color: 'grey.400' }} />
                  )}
                </Box>
              </Grid>

              {/* Basic Info */}
              <Grid item xs={12} sm={8} md={5}>
                <Typography variant="overline" color="text.secondary">
                  {component.manufacturer}
                </Typography>
                <Typography variant="h4" fontWeight={600} gutterBottom>
                  {component.mpn}
                </Typography>
                <Typography variant="body1" color="text.secondary" paragraph>
                  {component.description}
                </Typography>

                <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
                  <Chip icon={<CategoryIcon />} label={component.category} variant="outlined" size="small" />
                  {component.subcategory && (
                    <Chip label={component.subcategory} size="small" variant="outlined" />
                  )}
                  {component.package && (
                    <Chip label={component.package} size="small" variant="outlined" />
                  )}
                </Box>

                {/* Quick Action Buttons */}
                <Box display="flex" gap={1} flexWrap="wrap" sx={{ '@media print': { display: 'none' } }}>
                  {component.datasheet_url && (
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<PictureAsPdfIcon />}
                      href={component.datasheet_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Datasheet
                    </Button>
                  )}
                  {component.model_3d_url && (
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<ViewInArIcon />}
                      href={component.model_3d_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      3D Model
                    </Button>
                  )}
                </Box>
              </Grid>

              {/* Quick Stats */}
              <Grid item xs={12} md={4}>
                <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom fontWeight={600}>
                    Quick Stats
                  </Typography>

                  {/* Quality Score */}
                  <Box mb={2}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                      <Typography variant="body2">Quality Score</Typography>
                      <Typography
                        variant="body2"
                        fontWeight={700}
                        sx={{ color: getQualityColor(component.quality_score || 0) }}
                      >
                        {component.quality_score?.toFixed(0) || 0}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={component.quality_score || 0}
                      sx={{
                        height: 8,
                        borderRadius: 1,
                        bgcolor: 'grey.200',
                        '& .MuiLinearProgress-bar': {
                          bgcolor: getQualityColor(component.quality_score || 0),
                          borderRadius: 1,
                        },
                      }}
                    />
                  </Box>

                  {/* Lifecycle */}
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                    <Typography variant="body2">Lifecycle</Typography>
                    <Chip
                      label={component.lifecycle || 'Unknown'}
                      color={getLifecycleColor(component.lifecycle)}
                      size="small"
                    />
                  </Box>

                  {/* Stock Status */}
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                    <Typography variant="body2">Stock</Typography>
                    <Typography variant="body2" fontWeight={500}>
                      {component.stock_status || 'Unknown'}
                    </Typography>
                  </Box>

                  {/* Lead Time */}
                  {component.lead_time_days && (
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                      <Typography variant="body2">Lead Time</Typography>
                      <Typography variant="body2" fontWeight={500}>
                        {component.lead_time_days} days
                      </Typography>
                    </Box>
                  )}

                  {/* Unit Price */}
                  {component.unit_price && (
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2">Unit Price</Typography>
                      <Typography variant="body2" fontWeight={700} fontSize="1.1rem">
                        {component.currency || '$'}{component.unit_price.toFixed(2)}
                      </Typography>
                    </Box>
                  )}
                </Paper>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* ========================================= */}
        {/* SPECIFICATIONS SECTION */}
        {/* ========================================= */}
        <SectionCard
          id="specifications"
          title="Specifications"
          icon={<InfoIcon />}
          printMode={printMode}
        >
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Technical Specifications
              </Typography>
              {component.specifications && Object.keys(component.specifications).length > 0 ? (
                <DataTable
                  data={Object.entries(component.specifications).map(([key, value]) => ({
                    label: key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
                    value: typeof value === 'object' ? JSON.stringify(value) : String(value),
                  }))}
                />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No specifications available
                </Typography>
              )}
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Product Classification
              </Typography>
              <DataTable
                data={[
                  createRow('Category', component.category),
                  createRow('Subcategory', component.subcategory),
                  createRow('Category Path', component.category_path),
                  createRow('Product Family', component.product_family),
                  createRow('Product Series', component.product_series),
                  createRow('Package', component.package),
                ]}
              />
            </Grid>
          </Grid>
        </SectionCard>

        {/* ========================================= */}
        {/* COMPLIANCE & LIFECYCLE SECTION */}
        {/* ========================================= */}
        <SectionCard
          id="compliance"
          title="Compliance & Lifecycle"
          icon={<VerifiedIcon />}
          printMode={printMode}
        >
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Environmental Compliance
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="body2">RoHS Compliance</Typography>
                  <ComplianceBadge status={component.rohs} label={component.rohs || 'Unknown'} />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="body2">REACH Compliance</Typography>
                  <ComplianceBadge status={component.reach} label={component.reach || 'Unknown'} />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Halogen Free</Typography>
                  <ComplianceBadge
                    status={component.halogen_free}
                    label={component.halogen_free === true ? 'Yes' : component.halogen_free === false ? 'No' : 'Unknown'}
                  />
                </Box>
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Industry Qualifications
              </Typography>
              <DataTable
                data={[
                  {
                    label: 'AEC-Q Qualified (Automotive)',
                    value: <ComplianceBadge
                      status={component.aec_qualified}
                      label={component.aec_qualified === true ? 'Yes' : component.aec_qualified === false ? 'No' : 'Unknown'}
                    />,
                  },
                  createRow('ECCN Code', component.eccn_code),
                  {
                    label: 'Lifecycle Status',
                    value: (
                      <Chip
                        label={component.lifecycle || 'Unknown'}
                        color={getLifecycleColor(component.lifecycle)}
                        size="small"
                      />
                    ),
                  },
                  createRow('Risk Level', component.risk_level),
                ]}
              />
            </Grid>
          </Grid>
        </SectionCard>

        {/* ========================================= */}
        {/* PRICING & AVAILABILITY SECTION */}
        {/* ========================================= */}
        <SectionCard
          id="pricing"
          title="Pricing & Availability"
          icon={<AttachMoneyIcon />}
          printMode={printMode}
        >
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Current Pricing
              </Typography>
              <DataTable
                data={[
                  {
                    label: 'Unit Price',
                    value: component.unit_price
                      ? `${component.currency || 'USD'} ${component.unit_price.toFixed(2)}`
                      : 'Not available',
                  },
                  createRow('Currency', component.currency),
                  createRow('MOQ', component.moq?.toString()),
                ]}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Stock & Availability
              </Typography>
              <DataTable
                data={[
                  {
                    label: 'Stock Status',
                    value: (
                      <Chip
                        label={component.stock_status || 'Unknown'}
                        color={component.stock_status === 'In Stock' ? 'success' : 'default'}
                        size="small"
                      />
                    ),
                  },
                  {
                    label: 'Lead Time',
                    value: component.lead_time_days
                      ? `${component.lead_time_days} days`
                      : 'Not specified',
                  },
                ]}
              />
            </Grid>

            {/* Price Breaks */}
            {component.pricing && component.pricing.length > 0 && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  Price Breaks
                </Typography>
                <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0 }}>
                    {component.pricing.map((pb, idx) => (
                      <Box
                        key={idx}
                        sx={{
                          flex: '1 1 auto',
                          minWidth: 100,
                          p: 1.5,
                          textAlign: 'center',
                          borderRight: idx < component.pricing!.length - 1 ? '1px solid' : 'none',
                          borderColor: 'divider',
                        }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          {pb.quantity}+ units
                        </Typography>
                        <Typography variant="body1" fontWeight={600}>
                          ${pb.price?.toFixed(4) || 'N/A'}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Paper>
              </Grid>
            )}
          </Grid>
        </SectionCard>

        {/* ========================================= */}
        {/* SUPPLIER DATA SECTION */}
        {/* ========================================= */}
        <SectionCard
          id="suppliers"
          title="Supplier Data"
          icon={<LocalShippingIcon />}
          subtitle={
            component.supplier_data
              ? `${Object.keys(component.supplier_data).length} supplier(s)`
              : 'No supplier data'
          }
          printMode={printMode}
        >
          {component.supplier_data && Object.keys(component.supplier_data).length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {Object.entries(component.supplier_data).map(([supplier, data]) => (
                <CollapsibleJsonViewer
                  key={supplier}
                  title={supplier.charAt(0).toUpperCase() + supplier.slice(1)}
                  data={data as Record<string, any>}
                  icon={<StorefrontIcon fontSize="small" />}
                  brandColor={SUPPLIER_COLORS[supplier.toLowerCase()] || SUPPLIER_COLORS.default}
                  maxHeight={250}
                  printMode={printMode}
                />
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No supplier data available
            </Typography>
          )}
        </SectionCard>

        {/* ========================================= */}
        {/* QUALITY & METADATA SECTION */}
        {/* ========================================= */}
        <SectionCard
          id="quality"
          title="Quality & Metadata"
          icon={<TimelineIcon />}
          printMode={printMode}
        >
          <Grid container spacing={3}>
            {/* Quality Score Visualization */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Quality Score
              </Typography>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Box
                    sx={{
                      width: 64,
                      height: 64,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: `${getQualityColor(component.quality_score || 0)}20`,
                      border: '3px solid',
                      borderColor: getQualityColor(component.quality_score || 0),
                    }}
                  >
                    <Typography
                      variant="h5"
                      fontWeight={700}
                      sx={{ color: getQualityColor(component.quality_score || 0) }}
                    >
                      {component.quality_score?.toFixed(0) || 0}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Quality Score
                    </Typography>
                    <Typography variant="body1" fontWeight={500}>
                      {component.quality_score >= 90 ? 'Excellent' :
                        component.quality_score >= 70 ? 'Good' :
                          component.quality_score >= 50 ? 'Fair' : 'Needs Improvement'}
                    </Typography>
                  </Box>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={component.quality_score || 0}
                  sx={{
                    height: 10,
                    borderRadius: 1,
                    bgcolor: 'grey.200',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: getQualityColor(component.quality_score || 0),
                      borderRadius: 1,
                    },
                  }}
                />
              </Paper>
            </Grid>

            {/* Enrichment Info */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Enrichment Info
              </Typography>
              <DataTable
                paper
                data={[
                  { label: 'Component ID', value: component.id, monospace: true },
                  createRow('Enrichment Source', component.enrichment_source),
                  createRow('Enrichment Count', component.enrichment_count?.toString()),
                  createRow('Usage Count', component.usage_count?.toString()),
                ]}
              />
            </Grid>

            {/* Timestamps */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Timestamps
              </Typography>
              <DataTable
                paper
                data={[
                  { label: 'Created', value: formatDate(component.created_at) },
                  { label: 'Updated', value: formatDate(component.updated_at) },
                  { label: 'Last Enriched', value: formatDate(component.last_enriched_at), show: !!component.last_enriched_at },
                  { label: 'Last Used', value: formatDate(component.last_used_at), show: !!component.last_used_at },
                ]}
              />
            </Grid>

            {/* Quality Metadata JSON */}
            {component.quality_metadata && Object.keys(component.quality_metadata).length > 0 && (
              <Grid item xs={12} md={6}>
                <CollapsibleJsonViewer
                  title="Quality Metadata"
                  data={component.quality_metadata}
                  maxHeight={200}
                  printMode={printMode}
                />
              </Grid>
            )}

            {/* AI Metadata JSON */}
            {component.ai_metadata && Object.keys(component.ai_metadata).length > 0 && (
              <Grid item xs={12} md={6}>
                <CollapsibleJsonViewer
                  title="AI Metadata"
                  data={component.ai_metadata}
                  maxHeight={200}
                  printMode={printMode}
                />
              </Grid>
            )}
          </Grid>
        </SectionCard>

        {/* ========================================= */}
        {/* RESOURCES SECTION */}
        {/* ========================================= */}
        <SectionCard
          id="resources"
          title="Resources"
          icon={<LinkIcon />}
          printMode={printMode}
        >
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {component.datasheet_url && (
              <Button
                variant="contained"
                startIcon={<PictureAsPdfIcon />}
                href={component.datasheet_url}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ '@media print': { display: 'none' } }}
              >
                View Datasheet
              </Button>
            )}
            {component.model_3d_url && (
              <Button
                variant="outlined"
                startIcon={<ViewInArIcon />}
                href={component.model_3d_url}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ '@media print': { display: 'none' } }}
              >
                View 3D Model
              </Button>
            )}
            <Button
              variant="outlined"
              component={Link}
              to={`/components/${component.mpn}/detail`}
              startIcon={<TimelineIcon />}
              sx={{ '@media print': { display: 'none' } }}
            >
              View Enrichment Pipeline
            </Button>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleExport}
              sx={{ '@media print': { display: 'none' } }}
            >
              Export JSON
            </Button>
          </Box>

          {/* Print-only resource list */}
          <Box sx={{ display: 'none', '@media print': { display: 'block', mt: 2 } }}>
            <Typography variant="body2">
              <strong>Datasheet:</strong> {component.datasheet_url || 'Not available'}
            </Typography>
            <Typography variant="body2">
              <strong>3D Model:</strong> {component.model_3d_url || 'Not available'}
            </Typography>
          </Box>
        </SectionCard>
      </Box>
    </Box>
  );
};

export default ComponentDetailPage;
