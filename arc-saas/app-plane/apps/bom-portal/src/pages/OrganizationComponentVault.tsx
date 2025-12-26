import React, { useState, useEffect, useMemo } from 'react';
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
  Avatar,
  Grid,
  CardMedia,
  CardActions,
  Button,
  Collapse,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import MemoryIcon from '@mui/icons-material/Memory';
import InfoIcon from '@mui/icons-material/Info';
import DescriptionIcon from '@mui/icons-material/Description';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import ImageIcon from '@mui/icons-material/Image';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import TableRowsIcon from '@mui/icons-material/TableRows';
import ViewKanbanIcon from '@mui/icons-material/ViewKanban';
import { useGetList, useDataProvider, useNotify } from 'react-admin';
import { cnsApi } from '../services/cnsApi';
import { VaultKanban, type VaultComponent } from './vault';
import type { VaultStage } from './discovery/SendToVaultDrawer';

/**
 * Organization Component Vault
 *
 * Searches fully enriched components from Central Component Catalog
 * Filtered by tenant, projects, BOMs, categories
 * Shows: Image, Datasheet, 3D Model links
 */
type ViewMode = 'table' | 'kanban';

export const OrganizationComponentVault: React.FC = () => {
  const notify = useNotify();
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [searchText, setSearchText] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedBomId, setSelectedBomId] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [selectedComponent, setSelectedComponent] = useState<VaultComponent | null>(null);
  const dataProvider = useDataProvider();

  // Get current organization from localStorage
  const organizationId = localStorage.getItem('organization_id');

  // Fetch Projects for filter
  const { data: projects = [], isLoading: projectsLoading } = useGetList('projects', {
    pagination: { page: 1, perPage: 100 },
    filter: organizationId ? { organization_id: organizationId } : {},
    sort: { field: 'created_at', order: 'DESC' },
  });

  // Fetch BOMs for filter (filtered by selected project)
  const bomFilter: any = {};
  if (organizationId) bomFilter.organization_id = organizationId;
  if (selectedProjectId && selectedProjectId !== 'all') bomFilter.project_id = selectedProjectId;

  const { data: boms = [], isLoading: bomsLoading } = useGetList('boms', {
    pagination: { page: 1, perPage: 100 },
    filter: bomFilter,
    sort: { field: 'created_at', order: 'DESC' },
  });

  // Build filter for BOM line items (with project/BOM filters)
  // Note: Tenant isolation handled by RLS (Row Level Security)
  const lineItemFilter: any = {
    enrichment_status: 'enriched', // Only fully enriched
  };
  if (selectedProjectId && selectedProjectId !== 'all') {
    lineItemFilter.project_id = selectedProjectId;
  }
  if (selectedBomId && selectedBomId !== 'all') {
    lineItemFilter.bom_id = selectedBomId;
  }

  // Fetch filtered BOM line items (to get component_id values)
  const { data: bomLineItems = [], isLoading: lineItemsLoading } = useGetList('bom_line_items', {
    pagination: { page: 1, perPage: 10000 },
    filter: lineItemFilter,
    sort: { field: 'created_at', order: 'DESC' },
  });

  // State for Component Vault data
  const [vaultComponents, setVaultComponents] = useState<any[]>([]);
  const [loadingVault, setLoadingVault] = useState(false);
  const [vaultError, setVaultError] = useState<string | null>(null);

  // Fetch components from Component Vault by component_id
  useEffect(() => {
    async function fetchVaultComponents() {
      console.log('[Component Vault] 🔄 useEffect triggered - bomLineItems changed');
      console.debug('[Component Vault] 📊 BOM line items count:', bomLineItems.length);

      if (!bomLineItems.length) {
        console.log('[Component Vault] ⚠️ No BOM line items, clearing vault components');
        setVaultComponents([]);
        return;
      }

      setLoadingVault(true);
      setVaultError(null);
      const startTime = performance.now();

      try {
        // Extract unique component IDs (filter out nulls/undefined)
        const componentIds = [...new Set(
          bomLineItems
            .map((item: any) => item.component_id)
            .filter((id): id is string => id != null && id !== '')
        )];

        const totalLineItems = bomLineItems.length;
        const itemsWithComponentId = bomLineItems.filter((item: any) => item.component_id).length;

        console.log(`[Component Vault] 🔍 Analyzing ${totalLineItems} BOM line items:`);
        console.log(`[Component Vault]   ✅ ${itemsWithComponentId} with component_id`);
        console.log(`[Component Vault]   ⚠️ ${totalLineItems - itemsWithComponentId} without component_id`);
        console.log(`[Component Vault]   🎯 ${componentIds.length} unique components to fetch`);

        if (componentIds.length === 0) {
          console.warn('[Component Vault] ⚠️ No component_id values found in BOM line items - all components are missing vault linkage');
          setVaultComponents([]);
          setLoadingVault(false);
          return;
        }

        // Fetch from Component Vault
        console.log(`[Component Vault] 📦 Starting batch fetch of ${componentIds.length} components...`);
        const vaultData = await cnsApi.getComponentsByIds(componentIds);

        // Build usage count map from BOM line items
        const usageMap = new Map<string, number>();
        bomLineItems.forEach((item: any) => {
          if (item.component_id) {
            usageMap.set(item.component_id, (usageMap.get(item.component_id) || 0) + 1);
          }
        });

        // Map vault data to component structure with normalized field names
        console.log(`[Component Vault] 🔄 Mapping ${vaultData.length} vault components to UI format...`);

        const enrichedVaultData = vaultData.map((component: any) => {
          const usage = usageMap.get(component.id) || 1;
          return {
            // Map vault fields to UI expected fields (API already maps manufacturer_part_number → mpn)
            id: component.id,
            mpn: component.mpn,
            manufacturer: component.manufacturer,
            description: component.description,
            category: component.category,
            datasheet_url: component.datasheet_url,
            image_url: component.image_url,
            model_3d_url: null,  // Not in API yet
            lifecycle_status: component.lifecycle || 'Unknown',  // API returns 'lifecycle'
            stock_quantity: component.stock_quantity,  // Integer quantity from API
            stock_status: component.stock_status,  // Text status from API
            lead_time_days: component.lead_time_days,
            unit_price: component.unit_price,
            currency: component.currency,
            moq: component.moq,
            quality_score: component.quality_score,
            supplier: component.enrichment_source,
            usageCount: usage,
            // Keep original vault data for reference
            vaultId: component.id,
            specifications: component.specifications,
            parameters: component.parameters,  // Technical parameters separate from specifications
            pricing: component.pricing,
            rohs: component.rohs,
            reach: component.reach,
            aec_qualified: component.aec_qualified,  // Automotive qualification
            halogen_free: component.halogen_free,    // Halogen-free compliance
            reviewer: component.reviewer || component.reviewer_name,
            due_date: component.review_due_date || component.due_date,
            priority: component.priority,
            vault_stage: component.vault_stage || component.stage || 'pending',
          };
        });

        const duration = (performance.now() - startTime).toFixed(2);
        console.log(`[Component Vault] ✅ Successfully fetched and mapped ${enrichedVaultData.length} components - ${duration}ms`);

        // Log field completeness statistics
        const fieldsStats = {
          with_stock_quantity: enrichedVaultData.filter(c => c.stock_quantity !== null && c.stock_quantity !== undefined).length,
          with_parameters: enrichedVaultData.filter(c => c.parameters && Object.keys(c.parameters).length > 0).length,
          with_specifications: enrichedVaultData.filter(c => c.specifications && Object.keys(c.specifications).length > 0).length,
          with_pricing: enrichedVaultData.filter(c => c.pricing && c.pricing.length > 0).length,
          with_aec_qualified: enrichedVaultData.filter(c => c.aec_qualified === true).length,
          with_halogen_free: enrichedVaultData.filter(c => c.halogen_free === true).length,
        };
        console.log('[Component Vault] 📊 Field completeness stats:', fieldsStats);

        setVaultComponents(enrichedVaultData);
      } catch (error) {
        const duration = (performance.now() - startTime).toFixed(2);
        console.error(`[Component Vault] ❌ Failed to fetch vault components after ${duration}ms:`, error);
        setVaultError(error instanceof Error ? error.message : 'Failed to fetch components');
        setVaultComponents([]);
      } finally {
        setLoadingVault(false);
      }
    }

    fetchVaultComponents();
  }, [bomLineItems]);

  // Use vault components instead of extracting from line items
  const uniqueComponents = vaultComponents;

  // Filter by search text and category
  const filteredComponents = uniqueComponents.filter((component: any) => {
    const matchesSearch = !searchText ||
      component.mpn?.toLowerCase().includes(searchText.toLowerCase()) ||
      component.manufacturer?.toLowerCase().includes(searchText.toLowerCase()) ||
      component.description?.toLowerCase().includes(searchText.toLowerCase());

    const matchesCategory = selectedCategory === 'all' ||
      component.category?.toLowerCase().includes(selectedCategory.toLowerCase());

    return matchesSearch && matchesCategory;
  });

  // Extract unique categories from vault components
  const categories = React.useMemo(() => {
    const cats = new Set<string>();
    vaultComponents.forEach((component: any) => {
      if (component.category) cats.add(component.category);
    });
    return Array.from(cats).sort();
  }, [vaultComponents]);

  // Pagination
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

  // Transform components for kanban view
  const kanbanComponents: VaultComponent[] = useMemo(() => {
    return filteredComponents.map((c: any) => ({
      id: c.vaultId || `${c.mpn}-${c.manufacturer}`,
      mpn: c.mpn,
      manufacturer: c.manufacturer,
      description: c.description,
      category: c.category,
      quality_score: c.quality_score,
      lifecycle_status: c.lifecycle_status,
      image_url: c.image_url,
      datasheet_url: c.datasheet_url,
      stage: (c.vault_stage as VaultStage) || 'pending',
      reviewer: c.reviewer,
      dueDate: c.due_date,
      priority: c.priority,
    }));
  }, [filteredComponents]);

  const handleStageChange = async (componentId: string, newStage: VaultStage) => {
    try {
      await cnsApi.updateVaultComponentStage(componentId, newStage);
      setVaultComponents((prev) =>
        prev.map((component: any) => {
          const matches = component.vaultId === componentId || component.id === componentId;
          if (!matches) return component;
          return {
            ...component,
            vault_stage: newStage,
          };
        })
      );
      notify('Component stage updated', { type: 'success' });
    } catch (error: any) {
      console.error('Failed to update vault stage:', error);
      notify(error?.message || 'Failed to update stage', { type: 'error' });
      throw error;
    }
  };

  const handleViewDetails = (component: VaultComponent) => {
    setSelectedComponent(component);
    // Could open a details drawer here
    console.log('View details:', component);
  };

  const isLoading = projectsLoading || bomsLoading || lineItemsLoading || loadingVault;

  if (!organizationId) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          No organization selected. Please ensure you're logged in.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <MemoryIcon sx={{ fontSize: 32, mr: 1.5, color: 'primary.main' }} />
          <Typography variant="h4" fontWeight={700}>
            Component Vault
          </Typography>
          <Chip
            label="Enriched Only"
            color="success"
            size="small"
            sx={{ ml: 2 }}
          />
        </Box>
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(_, value) => value && setViewMode(value)}
          size="small"
        >
          <ToggleButton value="table">
            <Tooltip title="Table View">
              <TableRowsIcon />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="kanban">
            <Tooltip title="Kanban View">
              <ViewKanbanIcon />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            {/* Search Box */}
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Search MPN, Manufacturer, Description..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                size="small"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            {/* Project Filter */}
            <Grid item xs={12} md={2}>
              <TextField
                select
                fullWidth
                label="Project"
                value={selectedProjectId}
                onChange={(e) => {
                  setSelectedProjectId(e.target.value);
                  setSelectedBomId('all'); // Reset BOM filter
                }}
                size="small"
                disabled={projectsLoading}
              >
                <MenuItem value="all">All Projects</MenuItem>
                {projects.map((project: any) => (
                  <MenuItem key={project.id} value={project.id}>
                    {project.name || `Project ${project.id.slice(0, 8)}`}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* BOM Filter */}
            <Grid item xs={12} md={2}>
              <TextField
                select
                fullWidth
                label="BOM"
                value={selectedBomId}
                onChange={(e) => setSelectedBomId(e.target.value)}
                size="small"
                disabled={bomsLoading}
              >
                <MenuItem value="all">All BOMs</MenuItem>
                {boms.map((bom: any) => (
                  <MenuItem key={bom.id} value={bom.id}>
                    {bom.name || `BOM ${bom.id.slice(0, 8)}`}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Category Filter */}
            <Grid item xs={12} md={2}>
              <TextField
                select
                fullWidth
                label="Category"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                size="small"
              >
                <MenuItem value="all">All Categories</MenuItem>
                {categories.map((cat) => (
                  <MenuItem key={cat} value={cat}>
                    {cat}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Results Count */}
            <Grid item xs={12} md={2}>
              <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                <Chip
                  label={`${filteredComponents.length} component${filteredComponents.length !== 1 ? 's' : ''}`}
                  color="primary"
                  variant="outlined"
                />
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Error State */}
      {vaultError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load components from vault: {vaultError}
        </Alert>
      )}

      {/* Kanban View */}
      {viewMode === 'kanban' && (
        <VaultKanban
          components={kanbanComponents}
          loading={isLoading}
          error={vaultError}
          onStageChange={handleStageChange}
          onViewDetails={handleViewDetails}
        />
      )}

      {/* Table View */}
      {viewMode === 'table' && (
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                <TableCell sx={{ fontWeight: 700, width: 50 }} />
                <TableCell sx={{ fontWeight: 700 }}>Image</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>MPN</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Manufacturer</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="center">Usage</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="center">Stock</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="center">Pricing</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="center">Resources</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedComponents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      {isLoading ? 'Loading components...' : 'No enriched components found'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedComponents.map((component: any, index: number) => (
                  <React.Fragment key={index}>
                    <TableRow
                      sx={{
                        '&:hover': { bgcolor: 'action.hover' },
                        '&:nth-of-type(odd)': { bgcolor: 'action.selected' },
                      }}
                    >
                      {/* Expand Button */}
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => setExpandedRow(expandedRow === index ? null : index)}
                        >
                          {expandedRow === index ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                        </IconButton>
                      </TableCell>

                      {/* Image */}
                      <TableCell>
                      <Avatar
                        src={component.image_url}
                        variant="rounded"
                        sx={{ width: 60, height: 60 }}
                      >
                        <ImageIcon />
                      </Avatar>
                    </TableCell>

                    {/* MPN */}
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <MemoryIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                        <Typography variant="body2" fontWeight={600}>
                          {component.mpn || '-'}
                        </Typography>
                      </Box>
                    </TableCell>

                    {/* Manufacturer */}
                    <TableCell>
                      <Typography variant="body2">
                        {component.manufacturer || '-'}
                      </Typography>
                    </TableCell>

                    {/* Category */}
                    <TableCell>
                      <Chip
                        label={component.category || 'Uncategorized'}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: 11 }}
                      />
                    </TableCell>

                    {/* Description */}
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

                    {/* Usage Count */}
                    <TableCell align="center">
                      <Chip
                        label={`${component.usageCount}x`}
                        size="small"
                        color="info"
                        sx={{ minWidth: 50 }}
                      />
                    </TableCell>

                    {/* Stock */}
                    <TableCell align="center">
                      <Typography variant="body2" color="text.secondary">
                        {component.stock_quantity || '-'}
                      </Typography>
                    </TableCell>

                    {/* Pricing */}
                    <TableCell align="center">
                      {component.pricing && component.pricing.length > 0 ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          {component.pricing.slice(0, 2).map((priceBreak: any, idx: number) => (
                            <Chip
                              key={idx}
                              label={`${priceBreak.quantity}: $${priceBreak.price}`}
                              size="small"
                              color="success"
                              variant="outlined"
                              sx={{ fontSize: 10, height: 20 }}
                            />
                          ))}
                          {component.pricing.length > 2 && (
                            <Typography variant="caption" color="text.secondary">
                              +{component.pricing.length - 2} more
                            </Typography>
                          )}
                        </Box>
                      ) : component.unit_price ? (
                        <Chip
                          label={`$${component.unit_price}${component.currency ? ` ${component.currency}` : ''}`}
                          size="small"
                          color="success"
                          variant="outlined"
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary">-</Typography>
                      )}
                    </TableCell>

                    {/* Resources */}
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                        {component.datasheet_url && (
                          <Tooltip title="Datasheet">
                            <IconButton
                              size="small"
                              onClick={() => window.open(component.datasheet_url, '_blank')}
                            >
                              <DescriptionIcon fontSize="small" color="primary" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {component.model_3d_url && (
                          <Tooltip title="3D Model">
                            <IconButton
                              size="small"
                              onClick={() => window.open(component.model_3d_url, '_blank')}
                            >
                              <ViewInArIcon fontSize="small" color="secondary" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {component.image_url && (
                          <Tooltip title="View Image">
                            <IconButton
                              size="small"
                              onClick={() => window.open(component.image_url, '_blank')}
                            >
                              <ImageIcon fontSize="small" color="success" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>

                  {/* Expandable Specifications Row */}
                  <TableRow>
                    <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={10}>
                      <Collapse in={expandedRow === index} timeout="auto" unmountOnExit>
                        <Box sx={{ margin: 2 }}>
                          <Typography variant="h6" gutterBottom component="div">
                            Specifications & Details
                          </Typography>

                          <Grid container spacing={2}>
                            {/* Technical Parameters (separate from specifications) */}
                            {component.parameters && Object.keys(component.parameters).length > 0 && (
                              <Grid item xs={12} md={6}>
                                <Card variant="outlined">
                                  <CardContent>
                                    <Typography variant="subtitle2" color="primary" gutterBottom>
                                      Technical Parameters
                                    </Typography>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                      {Object.entries(component.parameters).map(([key, value]: [string, any]) => (
                                        <Chip
                                          key={key}
                                          label={`${key}: ${value}`}
                                          size="small"
                                          variant="outlined"
                                          sx={{ fontSize: 11 }}
                                        />
                                      ))}
                                    </Box>
                                  </CardContent>
                                </Card>
                              </Grid>
                            )}

                            {/* Specifications */}
                            {component.specifications && Object.keys(component.specifications).length > 0 && (
                              <Grid item xs={12} md={6}>
                                <Card variant="outlined">
                                  <CardContent>
                                    <Typography variant="subtitle2" color="primary" gutterBottom>
                                      Technical Specifications
                                    </Typography>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                      {Object.entries(component.specifications).map(([key, value]: [string, any]) => (
                                        <Chip
                                          key={key}
                                          label={`${key}: ${value}`}
                                          size="small"
                                          variant="outlined"
                                          sx={{ fontSize: 11 }}
                                        />
                                      ))}
                                    </Box>
                                  </CardContent>
                                </Card>
                              </Grid>
                            )}

                            {/* Compliance & Quality */}
                            <Grid item xs={12} md={4}>
                              <Card variant="outlined">
                                <CardContent>
                                  <Typography variant="subtitle2" color="primary" gutterBottom>
                                    Quality & Compliance
                                  </Typography>
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    <Chip
                                      label={`Quality: ${component.quality_score?.toFixed(1)}%`}
                                      color={component.quality_score >= 95 ? 'success' : component.quality_score >= 80 ? 'primary' : 'warning'}
                                      size="small"
                                    />
                                    {component.rohs && (
                                      <Chip label={`RoHS: ${component.rohs}`} size="small" variant="outlined" />
                                    )}
                                    {component.reach && (
                                      <Chip label={`REACH: ${component.reach}`} size="small" variant="outlined" />
                                    )}
                                    {component.lifecycle_status && (
                                      <Chip label={`Lifecycle: ${component.lifecycle_status}`} size="small" variant="outlined" />
                                    )}
                                    {component.aec_qualified && (
                                      <Chip label="AEC-Q Qualified" size="small" variant="outlined" color="success" />
                                    )}
                                    {component.halogen_free && (
                                      <Chip label="Halogen-Free" size="small" variant="outlined" color="success" />
                                    )}
                                  </Box>
                                </CardContent>
                              </Card>
                            </Grid>

                            {/* Stock & Lead Time */}
                            {(component.stock_status || component.stock_quantity || component.lead_time_days) && (
                              <Grid item xs={12} md={6}>
                                <Card variant="outlined">
                                  <CardContent>
                                    <Typography variant="subtitle2" color="primary" gutterBottom>
                                      Availability
                                    </Typography>
                                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                      {component.stock_quantity !== null && component.stock_quantity !== undefined ? (
                                        <Chip
                                          label={`Stock: ${component.stock_quantity} units`}
                                          size="small"
                                          color={component.stock_quantity > 0 ? 'success' : 'warning'}
                                        />
                                      ) : component.stock_status && (
                                        <Chip label={`Status: ${component.stock_status}`} size="small" />
                                      )}
                                      {component.lead_time_days && (
                                        <Chip label={`Lead Time: ${component.lead_time_days} days`} size="small" />
                                      )}
                                      {component.moq && (
                                        <Chip label={`MOQ: ${component.moq}`} size="small" />
                                      )}
                                    </Box>
                                  </CardContent>
                                </Card>
                              </Grid>
                            )}

                            {/* Pricing Details */}
                            {component.pricing && component.pricing.length > 0 && (
                              <Grid item xs={12} md={6}>
                                <Card variant="outlined">
                                  <CardContent>
                                    <Typography variant="subtitle2" color="primary" gutterBottom>
                                      Price Breaks
                                    </Typography>
                                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                      {component.pricing.map((pb: any, idx: number) => (
                                        <Chip
                                          key={idx}
                                          label={`${pb.quantity}+: $${pb.price}`}
                                          size="small"
                                          color="success"
                                        />
                                      ))}
                                    </Box>
                                  </CardContent>
                                </Card>
                              </Grid>
                            )}
                          </Grid>
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
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
      )}

      {/* Summary Stats */}
      <Box sx={{ mt: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Card sx={{ flex: 1, minWidth: 200 }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Unique Components
            </Typography>
            <Typography variant="h4" fontWeight={700} color="primary.main">
              {uniqueComponents.length}
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1, minWidth: 200 }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Categories
            </Typography>
            <Typography variant="h4" fontWeight={700} color="secondary.main">
              {categories.length}
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1, minWidth: 200 }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              With Datasheet
            </Typography>
            <Typography variant="h4" fontWeight={700} color="success.main">
              {uniqueComponents.filter((c: any) => c.datasheet_url).length}
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1, minWidth: 200 }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              With 3D Model
            </Typography>
            <Typography variant="h4" fontWeight={700} color="info.main">
              {uniqueComponents.filter((c: any) => c.model_3d_url).length}
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};
