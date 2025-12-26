/**
 * ComponentSearch Page
 *
 * Refactored to use modular discovery components.
 * Features: Left-rail filters, saved searches, comparison tray, send to vault.
 */

import React, { useState, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  MenuItem,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  LinearProgress,
  Alert,
  InputAdornment,
  Stack,
  Checkbox,
  Divider,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import InventoryIcon from '@mui/icons-material/Inventory';
import { cnsApi } from '../services/cnsApi';
import {
  ComponentFilters,
  SavedSearches,
  ComparisonTray,
  SendToVaultDrawer,
  type ComponentFilterState,
  type SavedSearch,
  type ComparisonComponent,
  type VaultSubmission,
} from './discovery';
import { analytics } from '../services/analytics';
import { SearchGuideBanner } from '../components/shared';
import { useNotify } from 'react-admin';
import { COMPARISON_CONFIG } from '../config/comparison';
import { WatchButton } from '../components/WatchButton';

type SearchType = 'all' | 'mpn' | 'manufacturer' | 'category' | 'description';

interface ComponentSearchResult {
  id?: string;
  mpn: string;
  manufacturer: string;
  category: string;
  description: string;
  quality_score: number;
  enrichment_status: 'production' | 'staging' | 'rejected' | 'pending';
  data_sources: string[];
  last_updated: string;
  lifecycle_status?: string;
  unit_price?: number;
  stock_quantity?: number;
  lead_time_days?: number;
  rohs_compliant?: boolean;
  image_url?: string;
}

const DEFAULT_FILTERS: ComponentFilterState = {
  suppliers: [],
  lifecycleStatuses: [],
  complianceFlags: [],
  priceRange: [0, 1000],
  riskLevels: [],
};

const STATUS_LABELS: Record<ComponentSearchResult['enrichment_status'], string> = {
  production: 'Production Ready',
  staging: 'Staging',
  rejected: 'Rejected',
  pending: 'Pending',
};

export const ComponentSearch: React.FC = () => {
  const notify = useNotify();
  // Search state
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<SearchType>('all');
  const [limit, setLimit] = useState(25);
  const [results, setResults] = useState<ComponentSearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Track page view on mount
  React.useEffect(() => {
    analytics.trackPageView('Component Search', '/component-search');
  }, []);

  // Filter state
  const [filters, setFilters] = useState<ComponentFilterState>(DEFAULT_FILTERS);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [vaultDrawerOpen, setVaultDrawerOpen] = useState(false);

  // Calculate active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.suppliers.length) count++;
    if (filters.lifecycleStatuses.length) count++;
    if (filters.complianceFlags.length) count++;
    if (filters.riskLevels.length) count++;
    if (filters.priceRange[0] > 0 || filters.priceRange[1] < 1000) count++;
    return count;
  }, [filters]);

  // Filter results based on filter state
  const filteredResults = useMemo(() => {
    return results.filter((component) => {
      // Lifecycle filter
      if (
        filters.lifecycleStatuses.length > 0 &&
        !filters.lifecycleStatuses.includes(component.lifecycle_status || 'Unknown')
      ) {
        return false;
      }
      // Price filter
      if (component.unit_price !== undefined) {
        if (
          component.unit_price < filters.priceRange[0] ||
          component.unit_price > filters.priceRange[1]
        ) {
          return false;
        }
      }
      return true;
    });
  }, [results, filters]);

  // Selected components for comparison
  const comparisonComponents: ComparisonComponent[] = useMemo(() => {
    return filteredResults
      .filter((c) => selectedIds.has(c.id || `${c.mpn}-${c.manufacturer}`))
      .map((c) => ({
        id: c.id || `${c.mpn}-${c.manufacturer}`,
        mpn: c.mpn,
        manufacturer: c.manufacturer,
        description: c.description,
        category: c.category,
        quality_score: c.quality_score,
        lifecycle_status: c.lifecycle_status,
        unit_price: c.unit_price,
        stock_quantity: c.stock_quantity,
        lead_time_days: c.lead_time_days,
        rohs_compliant: c.rohs_compliant,
        image_url: c.image_url,
      }));
  }, [filteredResults, selectedIds]);

  const handleSearch = async () => {
    if (!query.trim()) {
      setError('Please enter a search term');
      return;
    }
    setLoading(true);
    setError(null);
    setHasSearched(true);
    try {
      const response = await cnsApi.searchComponentCatalog({
        query,
        search_type: searchType,
        limit,
      });
      setResults(response.results);
      setTotal(response.total);
      setSelectedIds(new Set());
      // Track search analytics
      analytics.trackSearch(query, response.total);
    } catch (err: any) {
      console.error('[Component Search] Failed to fetch results', err);
      setError(err.message || 'Component search failed');
      setResults([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') handleSearch();
  };

  const handleLoadSearch = (search: SavedSearch) => {
    setQuery(search.query);
    setSearchType(search.searchType as SearchType);
    setFilters(search.filters);
    // Trigger search after state updates
    setTimeout(handleSearch, 0);
  };

  const handleToggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (
        COMPARISON_CONFIG.maxComponents === Infinity ||
        next.size < COMPARISON_CONFIG.maxComponents
      ) {
        // P1-2: Unlimited comparison tray - explicitly handle Infinity
        next.add(id);
      }
      return next;
    });
  };

  const handleSendToVault = async (submission: VaultSubmission) => {
    try {
      await cnsApi.submitVaultRequest({
        component_ids: submission.componentIds,
        reviewer_id: submission.reviewerId,
        due_date: submission.dueDate ? submission.dueDate.toISOString() : null,
        notes: submission.notes,
        stage: submission.stage,
        priority: submission.priority,
      });
      analytics.trackComponentAddedToVault(submission.componentIds[0], submission.stage);
      setSelectedIds(new Set());
      setVaultDrawerOpen(false);
      notify('Components sent to vault for review', { type: 'success' });
    } catch (err: any) {
      notify(err?.message || 'Failed to send to vault', { type: 'error' });
      throw err;
    }
  };

  const getQualityIcon = (score: number) => {
    if (score >= 95) return <CheckCircleIcon fontSize="small" color="success" />;
    if (score >= 70) return <WarningIcon fontSize="small" color="warning" />;
    return <ErrorIcon fontSize="small" color="error" />;
  };

  const getQualityColor = (score: number): 'success' | 'warning' | 'error' => {
    if (score >= 95) return 'success';
    if (score >= 70) return 'warning';
    return 'error';
  };

  const getStatusColor = (
    status: ComponentSearchResult['enrichment_status']
  ): 'success' | 'warning' | 'error' | undefined => {
    if (status === 'production') return 'success';
    if (status === 'staging') return 'warning';
    if (status === 'rejected') return 'error';
    return undefined;
  };

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)' }}>
      {/* Left Rail - Filters & Saved Searches */}
      <Box
        sx={{
          width: 280,
          flexShrink: 0,
          borderRight: 1,
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.paper',
        }}
      >
        <ComponentFilters
          filters={filters}
          onFilterChange={setFilters}
          activeFilterCount={activeFilterCount}
        />
        <Divider />
        <Box sx={{ p: 2, flex: 1, overflow: 'auto' }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Saved Searches
          </Typography>
          <SavedSearches
            currentQuery={query}
            currentSearchType={searchType}
            currentFilters={filters}
            onLoadSearch={handleLoadSearch}
          />
        </Box>
      </Box>

      {/* Main Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 1.5 }}>
          <InventoryIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Box>
            <Typography variant="h4" fontWeight={700}>
              Component Search
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Query the Central Component Vault for enriched parts metadata
            </Typography>
          </Box>
        </Box>

        {/* Guide Banner for first-time users */}
        {!hasSearched && (
          <SearchGuideBanner
            onTrySearch={() => {
              setQuery('STM32');
              setTimeout(handleSearch, 100);
            }}
          />
        )}

        {/* Search Bar */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                fullWidth
                label="Search Components"
                placeholder="e.g. STM32F407VGT6, Texas Instruments"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                select
                label="Search By"
                value={searchType}
                onChange={(e) => setSearchType(e.target.value as SearchType)}
                sx={{ minWidth: 160 }}
              >
                <MenuItem value="all">All Fields</MenuItem>
                <MenuItem value="mpn">MPN</MenuItem>
                <MenuItem value="manufacturer">Manufacturer</MenuItem>
                <MenuItem value="category">Category</MenuItem>
                <MenuItem value="description">Description</MenuItem>
              </TextField>
              <TextField
                select
                label="Limit"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                sx={{ minWidth: 100 }}
              >
                {[25, 50, 100].map((v) => (
                  <MenuItem key={v} value={v}>
                    {v}
                  </MenuItem>
                ))}
              </TextField>
              <Button
                variant="contained"
                size="large"
                onClick={handleSearch}
                disabled={loading}
                startIcon={<SearchIcon />}
                sx={{ minWidth: 120 }}
              >
                {loading ? 'Searching...' : 'Search'}
              </Button>
            </Stack>
            {error && (
              <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}
          </CardContent>
        </Card>

        {loading && <LinearProgress sx={{ mb: 2 }} />}

        {/* Results */}
        {hasSearched ? (
          <Card>
            <CardContent>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 2,
                }}
              >
                <Typography variant="h6">Results</Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {selectedIds.size > 0 && (
                    <Chip
                      label={`${selectedIds.size} selected`}
                      color="primary"
                      onDelete={() => setSelectedIds(new Set())}
                    />
                  )}
                  <Chip
                    label={`${filteredResults.length} of ${total} components`}
                    color={total > 0 ? 'primary' : 'default'}
                    variant="outlined"
                  />
                </Box>
              </Box>

              {filteredResults.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <SearchIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                  <Typography variant="body1" color="text.secondary">
                    No components found
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Try adjusting search or filters
                  </Typography>
                </Box>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox" />
                        <TableCell sx={{ fontWeight: 700 }}>MPN</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Manufacturer</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="center">
                          Quality
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="center">
                          Status
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Sources</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="center">
                          Watch
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredResults.map((component) => {
                        const id = component.id || `${component.mpn}-${component.manufacturer}`;
                        const isSelected = selectedIds.has(id);
                        return (
                          <TableRow
                            key={id}
                            hover
                            selected={isSelected}
                            onClick={() => handleToggleSelection(id)}
                            sx={{ cursor: 'pointer' }}
                          >
                            <TableCell padding="checkbox">
                              <Checkbox
                                checked={isSelected}
                                disabled={
                                  !isSelected &&
                                  COMPARISON_CONFIG.maxComponents !== Infinity &&
                                  selectedIds.size >= COMPARISON_CONFIG.maxComponents
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Typography fontWeight={600}>{component.mpn}</Typography>
                            </TableCell>
                            <TableCell>{component.manufacturer}</TableCell>
                            <TableCell>
                              <Chip
                                label={component.category || 'Uncategorized'}
                                size="small"
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell sx={{ maxWidth: 280 }}>
                              <Typography variant="body2" noWrap title={component.description}>
                                {component.description || '-'}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Stack
                                direction="row"
                                spacing={0.5}
                                alignItems="center"
                                justifyContent="center"
                              >
                                {getQualityIcon(component.quality_score)}
                                <Chip
                                  label={`${component.quality_score}%`}
                                  color={getQualityColor(component.quality_score)}
                                  size="small"
                                />
                              </Stack>
                            </TableCell>
                            <TableCell align="center">
                              <Chip
                                label={STATUS_LABELS[component.enrichment_status]}
                                color={getStatusColor(component.enrichment_status)}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>
                              <Stack direction="row" spacing={0.5} flexWrap="wrap">
                                {component.data_sources.map((source) => (
                                  <Chip
                                    key={source}
                                    label={source}
                                    size="small"
                                    variant="outlined"
                                  />
                                ))}
                              </Stack>
                            </TableCell>
                            <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                              <WatchButton
                                componentId={id}
                                mpn={component.mpn}
                                manufacturer={component.manufacturer}
                                variant="icon"
                                size="small"
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent>
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <SearchIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 1 }} />
                <Typography variant="h6">Search the catalog</Typography>
                <Typography variant="body2" color="text.secondary">
                  Enter an MPN, manufacturer, or category to search
                </Typography>
              </Box>
            </CardContent>
          </Card>
        )}
      </Box>

      {/* Comparison Tray */}
      <ComparisonTray
        components={comparisonComponents}
        onRemove={(id) => handleToggleSelection(id)}
        onClear={() => setSelectedIds(new Set())}
        onSendToVault={() => {
          if (comparisonComponents.length > 0) {
            setVaultDrawerOpen(true);
          }
        }}
      />

      {/* Send to Vault Drawer */}
      <SendToVaultDrawer
        open={vaultDrawerOpen}
        onClose={() => setVaultDrawerOpen(false)}
        components={comparisonComponents}
        onSubmit={handleSendToVault}
      />
    </Box>
  );
};

export default ComponentSearch;
