import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  MenuItem,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Tooltip,
  InputAdornment,
  LinearProgress,
  Alert,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import MemoryIcon from '@mui/icons-material/Memory';
import InfoIcon from '@mui/icons-material/Info';
import DescriptionIcon from '@mui/icons-material/Description';
import BrokenImageIcon from '@mui/icons-material/BrokenImage';
import { useGetList } from 'react-admin';
import { cnsApi } from '../services/cnsApi';
import { supabase } from '../providers/dataProvider';
import { VaultSavedSearches, type VaultSavedSearch, type VaultSearchFilters } from './discovery';

/**
 * Project Component Catalog
 *
 * Displays all components for a project, filterable by BOM
 */
export const ProjectComponentCatalog: React.FC = () => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [searchText, setSearchText] = useState('');
  const [selectedBomId, setSelectedBomId] = useState<string>('all');
  const [components, setComponents] = useState<any[]>([]);
  const [componentsLoading, setComponentsLoading] = useState(false);
  const [componentsError, setComponentsError] = useState<string | null>(null);

  // Get current project from localStorage
  const currentProjectId = localStorage.getItem('current_project_id');

  // Fetch BOMs for this project (for filter dropdown)
  const { data: boms = [], isLoading: bomsLoading } = useGetList('boms', {
    pagination: { page: 1, perPage: 100 },
    filter: currentProjectId ? { project_id: currentProjectId } : {},
    sort: { field: 'created_at', order: 'DESC' },
  });

  // Fetch BOM line items manually to ensure project scoping works consistently
  useEffect(() => {
    async function fetchComponents() {
      if (!currentProjectId) {
        setComponents([]);
        return;
      }

      setComponentsLoading(true);
      setComponentsError(null);

      try {
        let bomIds: string[] = [];

        if (selectedBomId && selectedBomId !== 'all') {
          bomIds = [selectedBomId];
        } else {
          const { data: bomRows, error: bomError } = await supabase
            .from('boms')
            .select('id')
            .eq('project_id', currentProjectId);

          if (bomError) {
            throw bomError;
          }

          bomIds = (bomRows || []).map((bom: any) => bom.id);
        }

        if (!bomIds.length) {
          setComponents([]);
          return;
        }

        const { data: lineItems, error: lineItemError } = await supabase
          .from('bom_line_items')
          .select(`
            id,
            bom_id,
            manufacturer_part_number,
            manufacturer,
            description,
            quantity,
            reference_designator,
            enrichment_status,
            component_id,
            datasheet_url,
            created_at,
            updated_at
          `)
          .in('bom_id', bomIds)
          .order('line_number', { ascending: true });

        if (lineItemError) {
          throw lineItemError;
        }

        setComponents(lineItems || []);
        setPage(0);
      } catch (error) {
        console.error('[Project Catalog] ❌ Failed to fetch line items:', error);
        setComponents([]);
        setComponentsError(error instanceof Error ? error.message : 'Failed to load components');
      } finally {
        setComponentsLoading(false);
      }
    }

    fetchComponents();
  }, [currentProjectId, selectedBomId]);

  // State for enriched components with vault data
  const [enrichedComponents, setEnrichedComponents] = useState<any[]>([]);
  const [loadingVault, setLoadingVault] = useState(false);

  // Enrich components with vault data when available
  useEffect(() => {
    async function enrichWithVaultData() {
      console.log('[Project Catalog] 🔄 useEffect triggered - components changed');
      console.debug('[Project Catalog] 📊 Component count:', components.length);

      if (!components.length) {
        console.log('[Project Catalog] ⚠️ No components, clearing enriched data');
        setEnrichedComponents([]);
        return;
      }

      setLoadingVault(true);
      const startTime = performance.now();

      try {
        // Extract component IDs that exist
        const componentIds = components
          .map((c: any) => c.component_id)
          .filter((id): id is string => id != null && id !== '');

        const totalComponents = components.length;
        const withComponentId = components.filter((c: any) => c.component_id).length;

        console.log(`[Project Catalog] 🔍 Analyzing ${totalComponents} line items:`);
        console.log(`[Project Catalog]   ✅ ${withComponentId} with vault linkage (component_id)`);
        console.log(`[Project Catalog]   ⚠️ ${totalComponents - withComponentId} without vault linkage`);
        console.log(`[Project Catalog]   🎯 ${componentIds.length} unique components to enrich`);

        if (componentIds.length === 0) {
          // No vault data available, use components as-is
          console.warn('[Project Catalog] ⚠️ No vault linkage found, using line items as-is');
          setEnrichedComponents(components);
          setLoadingVault(false);
          return;
        }

        // Fetch vault data
        console.log(`[Project Catalog] 📦 Fetching ${componentIds.length} components from vault...`);
        const vaultData = await cnsApi.getComponentsByIds(componentIds);
        const vaultMap = new Map(vaultData.map((v: any) => [v.id, v]));
        console.log(`[Project Catalog] ✅ Received ${vaultData.length} components from vault`);

        // Merge vault data with line items
        const enriched = components.map((lineItem: any) => {
          const vaultComponent = lineItem.component_id ? vaultMap.get(lineItem.component_id) : null;

          if (vaultComponent) {
            // Use high-quality vault data when available
            return {
              ...lineItem,
              // Enrich with vault fields (prefer vault data over line item data)
              description: vaultComponent.description || lineItem.description,
              datasheet_url: vaultComponent.datasheet_url || lineItem.datasheet_url,
              image_url: vaultComponent.image_url || lineItem.image_url,
              lifecycle_status: vaultComponent.lifecycle || lineItem.lifecycle_status || 'Unknown',  // API returns 'lifecycle'
              quality_score: vaultComponent.quality_score,
              category: vaultComponent.category || lineItem.category,
              specifications: vaultComponent.specifications,
              pricing: vaultComponent.pricing,
              stock_status: vaultComponent.stock_status,
              lead_time_days: vaultComponent.lead_time_days,
              unit_price: vaultComponent.unit_price,
              currency: vaultComponent.currency,
              moq: vaultComponent.moq,
              // Mark as vault-enriched
              _vaultEnriched: true,
            };
          }

          return lineItem;
        });

        const enrichedCount = enriched.filter((c: any) => c._vaultEnriched).length;
        const duration = (performance.now() - startTime).toFixed(2);

        console.log(`[Project Catalog] ✅ Enrichment complete - ${enrichedCount}/${components.length} enriched with vault data - ${duration}ms`);

        // Log field completeness for enriched components
        const enrichedComponents = enriched.filter((c: any) => c._vaultEnriched);
        if (enrichedComponents.length > 0) {
          const fieldsStats = {
            with_quality_score: enrichedComponents.filter((c: any) => c.quality_score !== null && c.quality_score !== undefined).length,
            with_specifications: enrichedComponents.filter((c: any) => c.specifications && Object.keys(c.specifications).length > 0).length,
            with_pricing: enrichedComponents.filter((c: any) => c.pricing && c.pricing.length > 0).length,
            with_stock: enrichedComponents.filter((c: any) => c.stock_status || c.stock_quantity).length,
            with_image_url: enrichedComponents.filter((c: any) => c.image_url).length,
            with_datasheet_url: enrichedComponents.filter((c: any) => c.datasheet_url).length,
          };
          console.log('[Project Catalog] 📊 Enriched fields stats:', fieldsStats);
        }

        setEnrichedComponents(enriched);
      } catch (error) {
        const duration = (performance.now() - startTime).toFixed(2);
        console.error(`[Project Catalog] ❌ Failed to enrich with vault data after ${duration}ms:`, error);
        // Fall back to line items without enrichment
        setEnrichedComponents(components);
      } finally {
        setLoadingVault(false);
      }
    }

    enrichWithVaultData();
  }, [components]);

  // Filter components by search text (client-side)
  const filteredComponents = enrichedComponents.filter((component: any) => {
    if (!searchText) return true;
    const search = searchText.toLowerCase();
    // Support both mpn (vault) and manufacturer_part_number (supabase) field names
    const mpn = component.mpn || component.manufacturer_part_number || '';
    return (
      mpn.toLowerCase().includes(search) ||
      component.manufacturer?.toLowerCase().includes(search) ||
      component.description?.toLowerCase().includes(search)
    );
  });

  const paginatedComponents = filteredComponents.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Saved searches integration
  const handleLoadSavedSearch = (search: VaultSavedSearch) => {
    setSearchText(search.filters.searchText);
    setSelectedBomId(search.filters.bomId);
    setPage(0); // Reset to first page
  };

  const currentFilters: VaultSearchFilters = {
    searchText,
    projectId: 'current', // ProjectComponentCatalog doesn't have project selector
    bomId: selectedBomId,
    category: 'all', // ProjectComponentCatalog doesn't have category filter
  };

  if (!currentProjectId) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">
          Please select a project from the sidebar to view its component catalog.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)' }}>
      {/* Left Sidebar - Saved Searches */}
      <Box
        sx={{
          width: 280,
          flexShrink: 0,
          borderRight: 1,
          borderColor: 'divider',
          p: 2,
          overflow: 'auto',
          bgcolor: 'background.paper',
        }}
      >
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Saved Searches
        </Typography>
        <VaultSavedSearches
          currentFilters={currentFilters}
          onLoadSearch={handleLoadSavedSearch}
          storageKey="project_catalog_saved_searches"
        />
      </Box>

      {/* Main Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <MemoryIcon sx={{ fontSize: 32, mr: 1.5, color: 'primary.main' }} />
          <Typography variant="h4" fontWeight={700}>
            Component Catalog
          </Typography>
        </Box>

        {/* Filters */}
        <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Search Box */}
            <TextField
              placeholder="Search MPN, Manufacturer, Description..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              sx={{ flex: 1, minWidth: 300 }}
              size="small"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />

            {/* BOM Filter */}
            <TextField
              select
              label="Filter by BOM"
              value={selectedBomId}
              onChange={(e) => setSelectedBomId(e.target.value)}
              sx={{ minWidth: 250 }}
              size="small"
              disabled={bomsLoading}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <FilterListIcon />
                  </InputAdornment>
                ),
              }}
            >
              <MenuItem value="all">All BOMs</MenuItem>
              {boms.map((bom: any) => (
                <MenuItem key={bom.id} value={bom.id}>
                  {bom.name || `BOM ${bom.id.slice(0, 8)}`}
                  {bom.status && (
                    <Chip
                      label={bom.status}
                      size="small"
                      sx={{ ml: 1, height: 20, fontSize: 10 }}
                      color={
                        bom.status === 'completed' ? 'success' :
                        bom.status === 'processing' ? 'primary' :
                        'default'
                      }
                    />
                  )}
                </MenuItem>
              ))}
            </TextField>

            {/* Results Count */}
            <Chip
              label={`${filteredComponents.length} component${filteredComponents.length !== 1 ? 's' : ''}`}
              color="primary"
              variant="outlined"
            />
          </Box>
        </CardContent>
      </Card>

      {/* Loading State */}
      {(componentsLoading || loadingVault) && <LinearProgress sx={{ mb: 2 }} />}
      {componentsError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setComponentsError(null)}>
          {componentsError}
        </Alert>
      )}

      {/* Components Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                <TableCell sx={{ fontWeight: 700, width: 60 }} align="center">Image</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>MPN</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Manufacturer</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="center">Quantity</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Reference Designator</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedComponents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      {componentsLoading ? 'Loading components...' : 'No components found'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedComponents.map((component: any, index: number) => (
                  <TableRow
                    key={component.id || index}
                    sx={{
                      '&:hover': { bgcolor: 'action.hover' },
                      '&:nth-of-type(odd)': { bgcolor: 'action.selected' },
                    }}
                  >
                    {/* Image Column */}
                    <TableCell align="center" sx={{ width: 60, p: 1 }}>
                      {component.image_url ? (
                        <Box
                          component="img"
                          src={component.image_url}
                          alt={component.mpn || component.manufacturer_part_number || 'Component'}
                          sx={{
                            width: 40,
                            height: 40,
                            objectFit: 'contain',
                            borderRadius: 1,
                            bgcolor: 'action.hover',
                          }}
                          onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                            // Replace broken image with placeholder
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.removeAttribute('style');
                          }}
                        />
                      ) : null}
                      <Box
                        sx={{
                          display: component.image_url ? 'none' : 'flex',
                          width: 40,
                          height: 40,
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: 'action.hover',
                          borderRadius: 1,
                        }}
                      >
                        <MemoryIcon sx={{ fontSize: 20, color: 'action.disabled' }} />
                      </Box>
                    </TableCell>
                    {/* MPN Column */}
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" fontWeight={600}>
                          {component.mpn || component.manufacturer_part_number || '-'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {component.manufacturer || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          maxWidth: 300,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {component.description || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={component.quantity || 0}
                        size="small"
                        color="default"
                        sx={{ minWidth: 50 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace" fontSize={12}>
                        {component.reference_designator || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={component.enrichment_status || 'pending'}
                        size="small"
                        color={
                          component.enrichment_status === 'enriched' ? 'success' :
                          component.enrichment_status === 'processing' ? 'primary' :
                          component.enrichment_status === 'failed' ? 'error' :
                          'default'
                        }
                        sx={{ fontSize: 11 }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="View Details">
                        <IconButton size="small" onClick={() => window.location.hash = `/bom_line_items/${component.id}/show`}>
                          <InfoIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {component.datasheet_url && (
                        <Tooltip title="View Datasheet">
                          <IconButton
                            size="small"
                            onClick={() => window.open(component.datasheet_url, '_blank')}
                          >
                            <DescriptionIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        <TablePagination
          rowsPerPageOptions={[10, 25, 50, 100]}
          component="div"
          count={filteredComponents.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Card>

      {/* Summary Stats */}
      <Box sx={{ mt: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Card sx={{ flex: 1, minWidth: 200 }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Total Components
            </Typography>
            <Typography variant="h4" fontWeight={700} color="primary.main">
              {components.length}
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1, minWidth: 200 }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              BOMs in Project
            </Typography>
            <Typography variant="h4" fontWeight={700} color="secondary.main">
              {boms.length}
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1, minWidth: 200 }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Vault-Enriched
            </Typography>
            <Typography variant="h4" fontWeight={700} color="success.main">
              {enrichedComponents.filter((c: any) => c._vaultEnriched).length}
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1, minWidth: 200 }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              With Images
            </Typography>
            <Typography variant="h4" fontWeight={700} color="info.main">
              {enrichedComponents.filter((c: any) => c.image_url).length}
            </Typography>
          </CardContent>
        </Card>
      </Box>
      </Box>
    </Box>
  );
};
