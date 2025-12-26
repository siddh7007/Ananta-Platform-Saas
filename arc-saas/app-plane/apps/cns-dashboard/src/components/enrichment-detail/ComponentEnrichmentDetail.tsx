import React, { useState, useEffect } from 'react';
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
  Divider,
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import DownloadIcon from '@mui/icons-material/Download';
import EditIcon from '@mui/icons-material/Edit';

import { EnrichmentDetail } from './types';
import { SupplierAPIStepComponent } from './pipeline/SupplierAPIStep';
import { AIEnhancementStepComponent } from './pipeline/AIEnhancementStep';
import { DataComparisonTable } from './DataComparisonTable';
import { CNS_API_URL, getAdminAuthHeaders } from '../../config/api';

/**
 * ComponentEnrichmentDetail - Main Component
 *
 * Shows complete enrichment pipeline for a single component:
 * - Component summary header
 * - Expandable pipeline steps
 * - Data comparison table
 * - Storage information
 * - Actions (re-enrich, edit, export)
 *
 * Modular Architecture:
 * - Each section is a separate, replaceable component
 * - Easy to add new steps or sections
 * - Consistent UI with PipelineStep base
 */
export const ComponentEnrichmentDetail: React.FC = () => {
  const { mpn } = useParams<{ mpn: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<EnrichmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load enrichment detail
  useEffect(() => {
    if (mpn) {
      loadEnrichmentDetail();
    }
  }, [mpn]);

  const loadEnrichmentDetail = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${CNS_API_URL}/components/${mpn}/enrichment-detail`, {
        headers: getAdminAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to load enrichment detail');
      }

      const result: EnrichmentDetail = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load enrichment detail');
    } finally {
      setLoading(false);
    }
  };

  // Export as JSON
  const handleExport = () => {
    if (!data) return;

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${mpn}_enrichment_detail.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Loading state
  if (loading) {
    return (
      <Box p={3} display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  // Error state
  if (error || !data) {
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

  const { component, pipeline, metadata } = data;

  // Get routing color
  const getRoutingColor = (routing: string): 'success' | 'warning' | 'error' => {
    switch (routing) {
      case 'production':
        return 'success';
      case 'staging':
        return 'warning';
      default:
        return 'error';
    }
  };

  return (
    <Box p={3}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Button
            variant="text"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(-1)}
            sx={{ mb: 1 }}
          >
            Back
          </Button>
          <Typography variant="h4" gutterBottom>
            Component Enrichment Detail
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Complete data lineage and enrichment pipeline
          </Typography>
        </Box>
        <Box display="flex" gap={2}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadEnrichmentDetail}>
            Refresh
          </Button>
          <Button variant="outlined" startIcon={<EditIcon />}>
            Edit
          </Button>
          <Button variant="contained" startIcon={<DownloadIcon />} onClick={handleExport}>
            Export JSON
          </Button>
        </Box>
      </Box>

      {/* Component Summary Card */}
      <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                MPN
              </Typography>
              <Typography variant="h5" fontWeight={600}>
                {component.mpn}
              </Typography>
            </Grid>

            <Grid item xs={12} md={3}>
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                Manufacturer
              </Typography>
              <Typography variant="h6">
                {component.manufacturer || 'Unknown'}
              </Typography>
            </Grid>

            <Grid item xs={12} md={2}>
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                Quality Score
              </Typography>
              <Typography variant="h5" fontWeight={600}>
                {component.final_score.toFixed(1)}%
              </Typography>
            </Grid>

            <Grid item xs={12} md={2}>
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                Routing
              </Typography>
              <Chip
                label={component.routing}
                color={getRoutingColor(component.routing)}
                sx={{ mt: 0.5, color: 'white', fontWeight: 600 }}
              />
            </Grid>

            <Grid item xs={12} md={2}>
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                Catalog ID
              </Typography>
              <Typography variant="h6">
                {component.catalog_id ? `#${component.catalog_id}` : 'Not saved'}
              </Typography>
            </Grid>
          </Grid>

          <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.3)' }} />

          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                Total Processing Time
              </Typography>
              <Typography variant="body1">
                {metadata.total_time_ms}ms
              </Typography>
            </Grid>

            <Grid item xs={12} md={4}>
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                Total Cost
              </Typography>
              <Typography variant="body1">
                ${metadata.total_cost_usd.toFixed(4)}
              </Typography>
            </Grid>

            <Grid item xs={12} md={4}>
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                Enrichment Source
              </Typography>
              <Typography variant="body1">
                {metadata.enrichment_source}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Section 1: Enrichment Pipeline */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            📋 Enrichment Pipeline
          </Typography>
          <Typography variant="body2" color="textSecondary" paragraph>
            Step-by-step view of data enrichment process. Click to expand each step.
          </Typography>

          {/* Step 3: Supplier APIs */}
          <SupplierAPIStepComponent data={pipeline.step3_suppliers} />

          {/* Step 4: AI Enhancement */}
          <AIEnhancementStepComponent data={pipeline.step4_ai} />

          {/* TODO: Add other steps (Input, Catalog, Normalization, Quality, Storage) */}
        </CardContent>
      </Card>

      {/* Section 2: Data Comparison */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <DataComparisonTable pipeline={pipeline} />
        </CardContent>
      </Card>

      {/* Section 3: Storage Information */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            💾 Storage Information
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  Redis Cache
                </Typography>
                {pipeline.step7_storage.redis.saved ? (
                  <>
                    <Typography variant="body2" color="success.main" gutterBottom>
                      ✓ Cached
                    </Typography>
                    <Typography variant="caption" display="block">
                      Key: {pipeline.step7_storage.redis.key}
                    </Typography>
                    <Typography variant="caption" display="block">
                      TTL: {pipeline.step7_storage.redis.ttl_days} days
                    </Typography>
                  </>
                ) : (
                  <Typography variant="body2" color="textSecondary">
                    Not cached
                  </Typography>
                )}
              </Paper>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  PostgreSQL Database
                </Typography>
                {pipeline.step7_storage.postgres.saved ? (
                  <>
                    <Typography variant="body2" color="success.main" gutterBottom>
                      ✓ Saved to Production
                    </Typography>
                    <Typography variant="caption" display="block">
                      Table: {pipeline.step7_storage.postgres.table}
                    </Typography>
                    <Typography variant="caption" display="block">
                      ID: #{pipeline.step7_storage.postgres.id}
                    </Typography>
                  </>
                ) : (
                  <Typography variant="body2" color="textSecondary">
                    Not saved (rejected or staging)
                  </Typography>
                )}
              </Paper>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};
