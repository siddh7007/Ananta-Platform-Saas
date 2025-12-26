import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  InputAdornment,
  Alert,
  Link as MuiLink,
  ToggleButtonGroup,
  ToggleButton,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Collapse,
  IconButton,
  Slider,
  Pagination,
  Stack,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import ViewListIcon from '@mui/icons-material/ViewList';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import FilterListIcon from '@mui/icons-material/FilterList';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { Link } from 'react-router-dom';
import { CNS_API_URL, DIRECTUS_URL, getAdminAuthHeaders } from '../config/api';

interface SearchResult {
  mpn: string;
  manufacturer: string;
  category: string;
  description: string;
  quality_score: number;
  enrichment_status: 'production' | 'staging' | 'rejected' | 'pending';
  data_sources: string[];
  last_updated: string;
}

/**
 * Enhanced Component Search Page (V1-style)
 *
 * Features:
 * - Advanced filters (Quality Score, Lifecycle, RoHS)
 * - Table vs Tiles view toggle
 * - Sorting (by quality, name, date)
 * - Pagination for large result sets
 * - Collapsible filter panel
 */
export const ComponentSearchEnhanced: React.FC = () => {
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState<'mpn' | 'manufacturer' | 'category' | 'description'>('mpn');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  // View state
  const [viewMode, setViewMode] = useState<'table' | 'tiles'>('table');

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [minQuality, setMinQuality] = useState<number>(0);
  const [maxQuality, setMaxQuality] = useState<number>(100);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Sorting state
  const [sortBy, setSortBy] = useState<'quality' | 'name' | 'date'>('quality');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination state
  const [page, setPage] = useState(1);
  const [itemsPerPage] = useState(10);

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setError('Please enter a search term');
      return;
    }

    setLoading(true);
    setError(null);
    setSearched(true);
    setPage(1);

    try {
      const params = new URLSearchParams({
        query: searchTerm,
        search_type: searchType,
        limit: '100', // Fetch more for client-side filtering
      });

      const response = await fetch(`${CNS_API_URL}/catalog/search?${params}`, {
        headers: getAdminAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      setResults(data.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter results based on advanced filters
  const getFilteredResults = () => {
    let filtered = [...results];

    // Quality score filter
    filtered = filtered.filter(
      (r) => r.quality_score >= minQuality && r.quality_score <= maxQuality
    );

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((r) => r.enrichment_status === statusFilter);
    }

    return filtered;
  };

  // Sort results
  const getSortedResults = (filtered: SearchResult[]) => {
    return filtered.sort((a, b) => {
      let comparison = 0;

      if (sortBy === 'quality') {
        comparison = a.quality_score - b.quality_score;
      } else if (sortBy === 'name') {
        comparison = a.mpn.localeCompare(b.mpn);
      } else if (sortBy === 'date') {
        comparison = new Date(a.last_updated).getTime() - new Date(b.last_updated).getTime();
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  };

  // Paginate results
  const getPaginatedResults = (sorted: SearchResult[]) => {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sorted.slice(startIndex, endIndex);
  };

  const filteredResults = getFilteredResults();
  const sortedResults = getSortedResults(filteredResults);
  const displayResults = getPaginatedResults(sortedResults);
  const totalPages = Math.ceil(sortedResults.length / itemsPerPage);

  const getQualityColor = (score: number) => {
    if (score >= 95) return 'success';
    if (score >= 70) return 'warning';
    return 'error';
  };

  const getQualityIcon = (score: number) => {
    if (score >= 95) return <CheckCircleIcon fontSize="small" />;
    if (score >= 70) return <WarningIcon fontSize="small" />;
    return <ErrorIcon fontSize="small" />;
  };

  const getStatusChip = (status: string) => {
    const statusConfig = {
      production: { label: 'Production', color: 'success' as const },
      staging: { label: 'Staging', color: 'warning' as const },
      rejected: { label: 'Rejected', color: 'error' as const },
      pending: { label: 'Pending', color: 'default' as const },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return <Chip label={config.label} color={config.color} size="small" />;
  };

  return (
    <Box p={3}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', md: 'center' }}
        spacing={2}
      >
        <Box>
          <Typography variant="h4" gutterBottom>
            Component Search (Enhanced)
          </Typography>
          <Typography variant="body1" color="textSecondary" paragraph sx={{ mb: 0 }}>
            Search the enriched component catalog shared with Directus. Apply advanced filters to verify quality scores
            before promoting components.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          color="primary"
          component="a"
          href={`${DIRECTUS_URL}/admin/content/catalog_components`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open in Directus
        </Button>
      </Stack>

      {/* Search Form */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box display="flex" gap={2} alignItems="flex-start">
            <TextField
              fullWidth
              label="Search Components"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="e.g., STM32F407VGT6, Texas Instruments, Microcontrollers"
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
              onChange={(e) => setSearchType(e.target.value as any)}
              SelectProps={{ native: true }}
              sx={{ minWidth: 200 }}
            >
              <option value="mpn">MPN</option>
              <option value="manufacturer">Manufacturer</option>
              <option value="category">Category</option>
              <option value="description">Description</option>
            </TextField>
            <Button
              variant="contained"
              color="primary"
              size="large"
              onClick={handleSearch}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} /> : <SearchIcon />}
              sx={{ minWidth: 140 }}
            >
              {loading ? 'Searching...' : 'Search'}
            </Button>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Advanced Filters Panel */}
      {searched && results.length > 0 && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Box display="flex" alignItems="center" gap={1}>
                <FilterListIcon />
                <Typography variant="h6">Advanced Filters</Typography>
                <Chip
                  label={`${sortedResults.length} of ${results.length} components`}
                  color="primary"
                  size="small"
                />
              </Box>
              <IconButton onClick={() => setShowFilters(!showFilters)}>
                {showFilters ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>

            <Collapse in={showFilters}>
              <Box mt={2}>
                <Grid container spacing={3}>
                  {/* Quality Score Range */}
                  <Grid item xs={12} md={4}>
                    <Typography gutterBottom>Quality Score: {minQuality}% - {maxQuality}%</Typography>
                    <Slider
                      value={[minQuality, maxQuality]}
                      onChange={(_, value) => {
                        const [min, max] = value as number[];
                        setMinQuality(min);
                        setMaxQuality(max);
                        setPage(1);
                      }}
                      valueLabelDisplay="auto"
                      min={0}
                      max={100}
                      step={5}
                      marks={[
                        { value: 0, label: '0%' },
                        { value: 50, label: '50%' },
                        { value: 100, label: '100%' },
                      ]}
                    />
                  </Grid>

                  {/* Status Filter */}
                  <Grid item xs={12} md={4}>
                    <FormControl fullWidth>
                      <InputLabel>Enrichment Status</InputLabel>
                      <Select
                        value={statusFilter}
                        label="Enrichment Status"
                        onChange={(e) => {
                          setStatusFilter(e.target.value);
                          setPage(1);
                        }}
                      >
                        <MenuItem value="all">All Statuses</MenuItem>
                        <MenuItem value="production">Production</MenuItem>
                        <MenuItem value="staging">Staging</MenuItem>
                        <MenuItem value="pending">Pending</MenuItem>
                        <MenuItem value="rejected">Rejected</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  {/* Sort By */}
                  <Grid item xs={12} md={4}>
                    <FormControl fullWidth>
                      <InputLabel>Sort By</InputLabel>
                      <Select
                        value={`${sortBy}-${sortOrder}`}
                        label="Sort By"
                        onChange={(e) => {
                          const [by, order] = e.target.value.split('-');
                          setSortBy(by as any);
                          setSortOrder(order as any);
                          setPage(1);
                        }}
                      >
                        <MenuItem value="quality-desc">Quality (High to Low)</MenuItem>
                        <MenuItem value="quality-asc">Quality (Low to High)</MenuItem>
                        <MenuItem value="name-asc">Name (A-Z)</MenuItem>
                        <MenuItem value="name-desc">Name (Z-A)</MenuItem>
                        <MenuItem value="date-desc">Recently Updated</MenuItem>
                        <MenuItem value="date-asc">Oldest First</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </Box>
            </Collapse>
          </CardContent>
        </Card>
      )}

      {/* Results Toolbar */}
      {searched && results.length > 0 && (
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="body2" color="textSecondary">
            Showing {(page - 1) * itemsPerPage + 1}-{Math.min(page * itemsPerPage, sortedResults.length)} of {sortedResults.length}
          </Typography>

          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, newView) => newView && setViewMode(newView)}
            size="small"
          >
            <ToggleButton value="table">
              <ViewListIcon />
              <Typography variant="caption" ml={1}>Table</Typography>
            </ToggleButton>
            <ToggleButton value="tiles">
              <ViewModuleIcon />
              <Typography variant="caption" ml={1}>Tiles</Typography>
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      )}

      {/* Search Results - Table View */}
      {searched && viewMode === 'table' && displayResults.length > 0 && (
        <Card>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>MPN</strong></TableCell>
                  <TableCell><strong>Manufacturer</strong></TableCell>
                  <TableCell><strong>Category</strong></TableCell>
                  <TableCell><strong>Description</strong></TableCell>
                  <TableCell align="center"><strong>Quality</strong></TableCell>
                  <TableCell align="center"><strong>Status</strong></TableCell>
                  <TableCell><strong>Sources</strong></TableCell>
                  <TableCell align="center"><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {displayResults.map((component, index) => (
                  <TableRow key={index} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {component.mpn}
                      </Typography>
                    </TableCell>
                    <TableCell>{component.manufacturer}</TableCell>
                    <TableCell>
                      <Chip label={component.category} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                        {component.description}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Box display="flex" alignItems="center" justifyContent="center" gap={1}>
                        {getQualityIcon(component.quality_score)}
                        <Chip
                          label={`${component.quality_score}%`}
                          color={getQualityColor(component.quality_score)}
                          size="small"
                        />
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      {getStatusChip(component.enrichment_status)}
                    </TableCell>
                    <TableCell>
                      <Box display="flex" gap={0.5} flexWrap="wrap">
                        {component.data_sources.map((source, idx) => (
                          <Chip
                            key={idx}
                            label={source}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.7rem' }}
                          />
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <MuiLink
                        component={Link}
                        to={`/components/${component.mpn}/detail`}
                        underline="hover"
                      >
                        View Details
                      </MuiLink>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* Search Results - Tiles View */}
      {searched && viewMode === 'tiles' && displayResults.length > 0 && (
        <Grid container spacing={2}>
          {displayResults.map((component, index) => (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                    <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
                      {component.mpn}
                    </Typography>
                    {getStatusChip(component.enrichment_status)}
                  </Box>

                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    <strong>Manufacturer:</strong> {component.manufacturer}
                  </Typography>

                  <Chip label={component.category} size="small" variant="outlined" sx={{ mb: 2 }} />

                  <Typography variant="body2" color="text.secondary" paragraph noWrap>
                    {component.description}
                  </Typography>

                  <Box display="flex" alignItems="center" gap={1} mb={2}>
                    {getQualityIcon(component.quality_score)}
                    <Typography variant="body2">
                      Quality: {component.quality_score}%
                    </Typography>
                  </Box>

                  <Box display="flex" gap={0.5} flexWrap="wrap" mb={2}>
                    {component.data_sources.map((source, idx) => (
                      <Chip
                        key={idx}
                        label={source}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.65rem' }}
                      />
                    ))}
                  </Box>

                  <Button
                    component={Link}
                    to={`/components/${component.mpn}/detail`}
                    variant="outlined"
                    size="small"
                    fullWidth
                  >
                    View Details
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Pagination */}
      {searched && sortedResults.length > itemsPerPage && (
        <Box display="flex" justifyContent="center" mt={3}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, value) => setPage(value)}
            color="primary"
            size="large"
            showFirstButton
            showLastButton
          />
        </Box>
      )}

      {/* No Results */}
      {searched && results.length === 0 && !loading && (
        <Card>
          <CardContent>
            <Box textAlign="center" py={4}>
              <SearchIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="textSecondary">
                No components found
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Try searching with different keywords or filters
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!searched && (
        <Card>
          <CardContent>
            <Box textAlign="center" py={6}>
              <SearchIcon sx={{ fontSize: 80, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="textSecondary" gutterBottom>
                Start searching for components
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Enter an MPN, manufacturer name, or category to find components
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};
