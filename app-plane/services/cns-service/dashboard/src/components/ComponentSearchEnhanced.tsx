import React, { useState, useEffect, useRef, useMemo, useCallback, Component, ErrorInfo, ReactNode } from 'react';
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
  Breadcrumbs,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Tooltip,
  Fade,
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
import HomeIcon from '@mui/icons-material/Home';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import DescriptionIcon from '@mui/icons-material/Description';
import ImageIcon from '@mui/icons-material/Image';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import CheckIcon from '@mui/icons-material/Check';
import ClearIcon from '@mui/icons-material/Clear';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CNS_API_URL, DIRECTUS_URL, getAuthHeaders, getAuthHeadersAsync } from '../config/api';
import { ComponentCard } from './ComponentCard';

// ============================================================================
// Error Boundary Component
// ============================================================================

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ComponentSearchErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ComponentSearch] Error caught by boundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Box p={3}>
          <Card>
            <CardContent>
              <Box textAlign="center" py={4}>
                <ErrorIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
                <Typography variant="h5" color="error" gutterBottom>
                  Something went wrong
                </Typography>
                <Typography variant="body1" color="textSecondary" paragraph>
                  An error occurred while loading the Component Search page.
                </Typography>
                {this.state.error && (
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 2, fontFamily: 'monospace' }}>
                    {this.state.error.message}
                  </Typography>
                )}
                <Button
                  variant="contained"
                  color="primary"
                  onClick={this.handleRetry}
                  sx={{ mt: 2 }}
                >
                  Try Again
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Box>
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// ARIA Live Region Component for Screen Reader Announcements
// ============================================================================

interface LiveRegionProps {
  message: string;
  politeness?: 'polite' | 'assertive';
}

const LiveRegion: React.FC<LiveRegionProps> = ({ message, politeness = 'polite' }) => (
  <Box
    role="status"
    aria-live={politeness}
    aria-atomic="true"
    sx={{
      position: 'absolute',
      width: 1,
      height: 1,
      padding: 0,
      margin: -1,
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      whiteSpace: 'nowrap',
      border: 0,
    }}
  >
    {message}
  </Box>
);

// ============================================================================
// Interfaces
// ============================================================================

interface SearchResult {
  // Existing fields
  mpn: string;
  manufacturer: string;
  category: string;
  description: string;
  quality_score: number;
  enrichment_status: 'production' | 'staging' | 'rejected' | 'pending';
  data_sources: string[];
  last_updated: string;

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
  specifications?: Record<string, any>;
  package_type?: string;
  lifecycle_status?: string;
}

interface SearchFacet {
  value: string;
  count: number;
}

interface SearchFacets {
  categories: SearchFacet[];
  manufacturers: SearchFacet[];
  packages: SearchFacet[];
  lifecycle_statuses: SearchFacet[];
  data_sources: SearchFacet[];
}

// Type definitions for type-safe form handling
type SearchType = 'mpn' | 'manufacturer' | 'category' | 'description';
type SortByType = 'quality' | 'name' | 'date';
type SortOrderType = 'asc' | 'desc';

// Type guard functions
const isValidSearchType = (value: string): value is SearchType => {
  return ['mpn', 'manufacturer', 'category', 'description'].includes(value);
};

const isValidSortBy = (value: string): value is SortByType => {
  return ['quality', 'name', 'date'].includes(value);
};

const isValidSortOrder = (value: string): value is SortOrderType => {
  return ['asc', 'desc'].includes(value);
};

/**
 * Custom debounce hook
 * Delays updating the debounced value until after the specified delay
 */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
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
 * - Real-time search with debouncing (300ms)
 * - Keyboard navigation (Arrow keys, Enter, Escape)
 * - Search suggestions/autocomplete
 * - URL state synchronization
 * - Keyboard shortcuts (Ctrl+K, ?)
 */
const ComponentSearchEnhancedInner: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Search state
  const [inputValue, setInputValue] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState<SearchType>('mpn');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [isBrowseMode, setIsBrowseMode] = useState(false);

  // Debounce and typing state
  const [isTyping, setIsTyping] = useState(false);
  const debouncedQuery = useDebounce(inputValue, 300);

  // Autocomplete state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcuts state
  const [showShortcuts, setShowShortcuts] = useState(false);

  // View state
  const [viewMode, setViewMode] = useState<'table' | 'tiles'>('table');

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [minQuality, setMinQuality] = useState<number>(0);
  const [maxQuality, setMaxQuality] = useState<number>(100);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Sorting state
  const [sortBy, setSortBy] = useState<SortByType>('quality');
  const [sortOrder, setSortOrder] = useState<SortOrderType>('desc');

  // Pagination state
  const [page, setPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Facets state (stored for future faceted filtering UI)
  const [_facets, setFacets] = useState<SearchFacets | null>(null);
  // TODO: Use _facets to build faceted filter UI (categories, manufacturers, etc.)

  // ARIA live region announcement state for screen readers
  const [announcement, setAnnouncement] = useState('');

  // AbortController ref for fetch request cancellation (prevents memory leaks)
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup: abort pending requests on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Initialize from URL parameters on mount
  useEffect(() => {
    const urlQuery = searchParams.get('q');
    const urlPage = searchParams.get('page');
    const urlType = searchParams.get('type') as typeof searchType;

    if (urlQuery) {
      setInputValue(urlQuery);
      setSearchTerm(urlQuery);
      setSearched(true);
      setIsBrowseMode(false);
    }
    if (urlPage) {
      setPage(parseInt(urlPage, 10));
    }
    if (urlType && ['mpn', 'manufacturer', 'category', 'description'].includes(urlType)) {
      setSearchType(urlType);
    }

    // If no URL params, load all components initially
    if (!urlQuery) {
      handleBrowseAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // Update URL when search parameters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchTerm && !isBrowseMode) {
      params.set('q', searchTerm);
    }
    if (page > 1) {
      params.set('page', page.toString());
    }
    if (searchType !== 'mpn') {
      params.set('type', searchType);
    }
    setSearchParams(params, { replace: true });
  }, [searchTerm, page, searchType, isBrowseMode, setSearchParams]);

  // Handle debounced search
  useEffect(() => {
    if (debouncedQuery === inputValue) {
      setIsTyping(false);
    }

    if (debouncedQuery.length >= 2) {
      setSearchTerm(debouncedQuery);
      performSearch(debouncedQuery);
    } else if (debouncedQuery.length === 0 && searched) {
      // If user clears input, browse all
      handleBrowseAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  // Update suggestions when results change
  useEffect(() => {
    if (inputValue.length >= 2 && !loading && results.length > 0 && !isBrowseMode) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  }, [results, inputValue, loading, isBrowseMode]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K or Cmd+K to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // ? to toggle shortcuts help (only when not in input/textarea)
      if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes((e.target as Element).tagName)) {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Scroll selected suggestion into view
  useEffect(() => {
    if (selectedIndex >= 0 && suggestionsRef.current) {
      const items = suggestionsRef.current.querySelectorAll('[data-suggestion-item]');
      items[selectedIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  // Browse all components (no search query)
  const handleBrowseAll = useCallback(async () => {
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    setLoading(true);
    setError(null);
    setSearched(true);
    setIsBrowseMode(true);
    setSearchTerm('');
    setInputValue('');
    setPage(1);
    setShowSuggestions(false);
    setSelectedIndex(-1);

    try {
      // Use async headers to wait for Keycloak initialization on initial load
      const headers = await getAuthHeadersAsync();
      const response = await fetch(`${CNS_API_URL}/catalog/browse?limit=100`, {
        headers,
        signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to load components');
      }

      const data = await response.json();
      setResults(data.results || []);
      setFacets(data.facets || null);

      // Announce results for screen readers
      const count = data.results?.length || 0;
      setAnnouncement(`Loaded ${count} component${count !== 1 ? 's' : ''}`);
    } catch (err) {
      // Don't report aborted requests as errors
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load components');
      setResults([]);
      setFacets(null);
      setAnnouncement('Error loading components');
    } finally {
      setLoading(false);
    }
  }, []);

  // Perform search with given query
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      handleBrowseAll();
      return;
    }

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    setLoading(true);
    setError(null);
    setSearched(true);
    setIsBrowseMode(false);
    setPage(1);
    setSelectedIndex(-1);

    try {
      const params = new URLSearchParams({
        query,
        search_type: searchType,
        limit: '100', // Fetch more for client-side filtering
      });

      const response = await fetch(`${CNS_API_URL}/catalog/search?${params}`, {
        headers: getAuthHeaders(),
        signal,
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      setResults(data.results || []);
      setFacets(data.facets || null);

      // Announce results for screen readers
      const count = data.results?.length || 0;
      setAnnouncement(
        count > 0
          ? `Found ${count} component${count !== 1 ? 's' : ''} matching "${query}"`
          : `No components found matching "${query}"`
      );
    } catch (err) {
      // Don't report aborted requests as errors
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
      setFacets(null);
      setAnnouncement('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [handleBrowseAll, searchType]);

  const handleSearch = () => {
    if (!inputValue.trim()) {
      handleBrowseAll();
      return;
    }
    setSearchTerm(inputValue);
    performSearch(inputValue);
    setShowSuggestions(false);
  };

  // Handle input change with typing indicator
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    setIsTyping(true);
    setSelectedIndex(-1);
  };

  // Handle keyboard navigation in search input
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const suggestions = getFilteredResults().slice(0, 5);

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (showSuggestions) {
          setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
        }
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (showSuggestions) {
          setSelectedIndex(prev => Math.max(prev - 1, -1));
        }
        break;

      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          // Navigate to selected component
          navigate(`/component/${encodeURIComponent(suggestions[selectedIndex].mpn)}`);
          setShowSuggestions(false);
          setSelectedIndex(-1);
        } else if (inputValue) {
          // Perform search
          handleSearch();
        }
        break;

      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        (e.target as HTMLInputElement).blur();
        break;
    }
  };

  // Clear search
  const handleClearSearch = () => {
    setInputValue('');
    setSearchTerm('');
    setSelectedIndex(-1);
    setShowSuggestions(false);
    handleBrowseAll();
    searchInputRef.current?.focus();
  };

  // Handle suggestion click
  const handleSuggestionClick = (component: SearchResult) => {
    navigate(`/component/${encodeURIComponent(component.mpn)}`);
    setShowSuggestions(false);
    setSelectedIndex(-1);
  };

  // Memoized filtered results - only recalculates when dependencies change
  const filteredResults = useMemo(() => {
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
  }, [results, minQuality, maxQuality, statusFilter]);

  // Memoized sorted results - only recalculates when filtered results or sort params change
  const sortedResults = useMemo(() => {
    // Create a copy to avoid mutating filteredResults
    const sorted = [...filteredResults];

    return sorted.sort((a, b) => {
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
  }, [filteredResults, sortBy, sortOrder]);

  // Memoized paginated results
  const displayResults = useMemo(() => {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedResults.slice(startIndex, endIndex);
  }, [sortedResults, page, itemsPerPage]);

  // Memoized derived values
  const totalPages = useMemo(() => Math.ceil(sortedResults.length / itemsPerPage), [sortedResults.length, itemsPerPage]);
  const suggestions = useMemo(() => filteredResults.slice(0, 5), [filteredResults]);

  // Legacy function wrapper for keyboard navigation (needs function reference)
  const getFilteredResults = useCallback(() => filteredResults, [filteredResults]);

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

  const getStatusChip = (status: string | undefined | null) => {
    const statusConfig = {
      production: { label: 'Production', color: 'success' as const },
      staging: { label: 'Staging', color: 'warning' as const },
      rejected: { label: 'Rejected', color: 'error' as const },
      pending: { label: 'Pending', color: 'default' as const },
    };

    const config = (status && status in statusConfig)
      ? statusConfig[status as keyof typeof statusConfig]
      : statusConfig.pending;
    return <Chip label={config.label} color={config.color} size="small" />;
  };

  const renderComponentImage = (component: SearchResult, size: 'small' | 'large' = 'small') => {
    const dimension = size === 'small' ? 40 : 120;

    if (component.image_url) {
      return (
        <Box
          component="img"
          src={component.image_url}
          alt={`${component.mpn} component image`}
          sx={{
            width: dimension,
            height: dimension,
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
          width: dimension,
          height: dimension,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'grey.100',
        }}
      >
        <ImageIcon sx={{ fontSize: dimension * 0.5, color: 'grey.400' }} />
      </Box>
    );
  };

  const renderComplianceBadges = (component: SearchResult) => {
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
    ) : null;
  };

  const renderStockStatus = (component: SearchResult) => {
    if (component.in_stock === undefined && !component.stock_status) {
      return null;
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

  const renderPricing = (component: SearchResult) => {
    if (!component.unit_price) {
      return null;
    }

    return (
      <Typography variant="body2" color="primary" fontWeight={600}>
        ${component.unit_price.toFixed(2)}
      </Typography>
    );
  };

  return (
    <Box p={3}>
      {/* ARIA Live Region for screen reader announcements */}
      <LiveRegion message={announcement} />

      {/* Breadcrumb Navigation */}
      <Breadcrumbs
        separator={<NavigateNextIcon fontSize="small" />}
        aria-label="breadcrumb"
        sx={{ mb: 2 }}
      >
        <MuiLink
          component={Link}
          to="/"
          underline="hover"
          color="inherit"
          sx={{ display: 'flex', alignItems: 'center' }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
          Dashboard
        </MuiLink>
        <Typography color="text.primary">
          Component Search
        </Typography>
      </Breadcrumbs>

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
        <Stack direction="row" spacing={1}>
          <Tooltip title="Keyboard shortcuts">
            <IconButton
              color={showShortcuts ? 'primary' : 'default'}
              onClick={() => setShowShortcuts(prev => !prev)}
              size="small"
            >
              <KeyboardIcon />
            </IconButton>
          </Tooltip>
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
      </Stack>

      {/* Search Form */}
      <Card sx={{ mb: 2, mt: 2 }}>
        <CardContent>
          <Box display="flex" gap={2} alignItems="flex-start">
            <Box sx={{ position: 'relative', flexGrow: 1 }}>
              <TextField
                fullWidth
                inputRef={searchInputRef}
                id="search-input"
                label="Search Components"
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  if (inputValue.length >= 2 && results.length > 0 && !isBrowseMode) {
                    setShowSuggestions(true);
                  }
                }}
                placeholder="e.g., STM32F407VGT6, Texas Instruments, Microcontrollers"
                role="combobox"
                aria-autocomplete="list"
                aria-controls={showSuggestions ? "search-suggestions-listbox" : undefined}
                aria-expanded={showSuggestions && suggestions.length > 0}
                aria-activedescendant={selectedIndex >= 0 ? `suggestion-${selectedIndex}` : undefined}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon aria-hidden="true" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      {isTyping && (
                        <CircularProgress
                          size={20}
                          sx={{ mr: inputValue ? 1 : 0 }}
                          aria-label="Searching..."
                        />
                      )}
                      {inputValue && (
                        <Tooltip title="Clear search">
                          <IconButton
                            onClick={handleClearSearch}
                            size="small"
                            edge="end"
                            aria-label="Clear search"
                          >
                            <ClearIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </InputAdornment>
                  ),
                }}
              />

              {/* Autocomplete Suggestions Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <Paper
                  ref={suggestionsRef}
                  elevation={8}
                  role="listbox"
                  aria-label="Search suggestions"
                  id="search-suggestions-listbox"
                  sx={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 1300,
                    mt: 1,
                    maxHeight: 300,
                    overflow: 'auto',
                  }}
                >
                  <List dense disablePadding aria-live="polite">
                    {suggestions.map((component, index) => (
                      <ListItem
                        key={`${component.mpn}-${index}`}
                        disablePadding
                        data-suggestion-item
                        role="option"
                        aria-selected={index === selectedIndex}
                        id={`suggestion-${index}`}
                      >
                        <ListItemButton
                          selected={index === selectedIndex}
                          onClick={() => handleSuggestionClick(component)}
                          tabIndex={-1}
                          sx={{
                            bgcolor: index === selectedIndex ? 'action.selected' : 'background.paper',
                          }}
                        >
                          <ListItemText
                            primary={
                              <Box display="flex" justifyContent="space-between" alignItems="center">
                                <Typography variant="body2" fontWeight={600}>
                                  {component.mpn}
                                </Typography>
                                <Chip
                                  label={`${component.quality_score}%`}
                                  color={getQualityColor(component.quality_score)}
                                  size="small"
                                  sx={{ ml: 1 }}
                                  aria-label={`Quality score: ${component.quality_score}%`}
                                />
                              </Box>
                            }
                            secondary={
                              <Typography variant="caption" color="text.secondary" noWrap>
                                {component.manufacturer} • {component.category}
                              </Typography>
                            }
                          />
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              )}
            </Box>
            <TextField
              select
              label="Search By"
              value={searchType}
              onChange={(e) => {
                const value = e.target.value;
                if (isValidSearchType(value)) {
                  setSearchType(value);
                }
              }}
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
            <Button
              variant="outlined"
              color="secondary"
              size="large"
              onClick={handleBrowseAll}
              disabled={loading}
              sx={{ minWidth: 140 }}
            >
              Browse All
            </Button>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Keyboard Shortcuts Help */}
      <Fade in={showShortcuts}>
        <Paper
          elevation={8}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1400,
            p: 3,
            bgcolor: 'grey.900',
            color: 'white',
            maxWidth: 320,
          }}
        >
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6" fontWeight={600}>
              Keyboard Shortcuts
            </Typography>
            <IconButton
              size="small"
              onClick={() => setShowShortcuts(false)}
              sx={{ color: 'white' }}
            >
              <ClearIcon fontSize="small" />
            </IconButton>
          </Box>
          <Stack spacing={1}>
            <Box display="flex" alignItems="center" gap={2}>
              <Typography
                component="kbd"
                sx={{
                  px: 1,
                  py: 0.5,
                  bgcolor: 'grey.800',
                  borderRadius: 1,
                  fontSize: '0.875rem',
                  fontFamily: 'monospace',
                  minWidth: 80,
                }}
              >
                Ctrl+K
              </Typography>
              <Typography variant="body2">Focus search</Typography>
            </Box>
            <Box display="flex" alignItems="center" gap={2}>
              <Typography
                component="kbd"
                sx={{
                  px: 1,
                  py: 0.5,
                  bgcolor: 'grey.800',
                  borderRadius: 1,
                  fontSize: '0.875rem',
                  fontFamily: 'monospace',
                  minWidth: 80,
                }}
              >
                ↑ ↓
              </Typography>
              <Typography variant="body2">Navigate suggestions</Typography>
            </Box>
            <Box display="flex" alignItems="center" gap={2}>
              <Typography
                component="kbd"
                sx={{
                  px: 1,
                  py: 0.5,
                  bgcolor: 'grey.800',
                  borderRadius: 1,
                  fontSize: '0.875rem',
                  fontFamily: 'monospace',
                  minWidth: 80,
                }}
              >
                Enter
              </Typography>
              <Typography variant="body2">Open selected / Search</Typography>
            </Box>
            <Box display="flex" alignItems="center" gap={2}>
              <Typography
                component="kbd"
                sx={{
                  px: 1,
                  py: 0.5,
                  bgcolor: 'grey.800',
                  borderRadius: 1,
                  fontSize: '0.875rem',
                  fontFamily: 'monospace',
                  minWidth: 80,
                }}
              >
                Esc
              </Typography>
              <Typography variant="body2">Clear selection</Typography>
            </Box>
            <Box display="flex" alignItems="center" gap={2}>
              <Typography
                component="kbd"
                sx={{
                  px: 1,
                  py: 0.5,
                  bgcolor: 'grey.800',
                  borderRadius: 1,
                  fontSize: '0.875rem',
                  fontFamily: 'monospace',
                  minWidth: 80,
                }}
              >
                ?
              </Typography>
              <Typography variant="body2">Toggle shortcuts</Typography>
            </Box>
          </Stack>
        </Paper>
      </Fade>

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
              <IconButton
                onClick={() => setShowFilters(!showFilters)}
                aria-label={showFilters ? "Collapse filters" : "Expand filters"}
                aria-expanded={showFilters}
              >
                {showFilters ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>

            <Collapse in={showFilters}>
              <Box mt={2}>
                <Grid container spacing={3}>
                  {/* Quality Score Range */}
                  <Grid item xs={12} md={4}>
                    <Typography
                      id="quality-score-slider-label"
                      gutterBottom
                    >
                      Quality Score: {minQuality}% - {maxQuality}%
                    </Typography>
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
                      aria-labelledby="quality-score-slider-label"
                      getAriaValueText={(value) => `${value}%`}
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
                          if (isValidSortBy(by) && isValidSortOrder(order)) {
                            setSortBy(by);
                            setSortOrder(order);
                            setPage(1);
                          }
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
            <Table size="small" aria-label="Component search results table">
              <TableHead>
                <TableRow>
                  <TableCell width={60}><strong>Image</strong></TableCell>
                  <TableCell><strong>MPN</strong></TableCell>
                  <TableCell><strong>Manufacturer</strong></TableCell>
                  <TableCell><strong>Category</strong></TableCell>
                  <TableCell><strong>Description</strong></TableCell>
                  <TableCell align="center"><strong>Compliance</strong></TableCell>
                  <TableCell align="center"><strong>Stock</strong></TableCell>
                  <TableCell align="center"><strong>Price</strong></TableCell>
                  <TableCell align="center"><strong>Quality</strong></TableCell>
                  <TableCell align="center"><strong>Status</strong></TableCell>
                  <TableCell align="center"><strong>Docs</strong></TableCell>
                  <TableCell align="center"><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {displayResults.map((component, index) => (
                  <TableRow
                    key={component.mpn || index}
                    hover
                    onClick={() => navigate(`/component/${encodeURIComponent(component.mpn)}`)}
                    sx={{ cursor: 'pointer' }}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/component/${encodeURIComponent(component.mpn)}`);
                      }
                    }}
                    role="button"
                    aria-label={`View details for ${component.mpn} by ${component.manufacturer}`}
                  >
                    {/* Image Column */}
                    <TableCell>
                      {renderComponentImage(component, 'small')}
                    </TableCell>
                    {/* MPN Column */}
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {component.mpn}
                      </Typography>
                    </TableCell>
                    {/* Manufacturer Column */}
                    <TableCell>{component.manufacturer}</TableCell>
                    {/* Category Column */}
                    <TableCell>
                      <Chip label={component.category} size="small" variant="outlined" />
                    </TableCell>
                    {/* Description Column */}
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                        {component.description}
                      </Typography>
                    </TableCell>
                    {/* Compliance Column */}
                    <TableCell align="center">
                      {renderComplianceBadges(component) || (
                        <Typography variant="caption" color="text.secondary">—</Typography>
                      )}
                    </TableCell>
                    {/* Stock Column */}
                    <TableCell align="center">
                      {renderStockStatus(component) || (
                        <Typography variant="caption" color="text.secondary">—</Typography>
                      )}
                    </TableCell>
                    {/* Price Column */}
                    <TableCell align="center">
                      {renderPricing(component) || (
                        <Typography variant="caption" color="text.secondary">—</Typography>
                      )}
                    </TableCell>
                    {/* Quality Column */}
                    <TableCell align="center">
                      <Box display="flex" alignItems="center" justifyContent="center" gap={1}>
                        {getQualityIcon(component.quality_score)}
                        <Chip
                          label={`${component.quality_score}%`}
                          color={getQualityColor(component.quality_score)}
                          size="small"
                          role="status"
                          aria-label={`Quality score: ${component.quality_score}%`}
                        />
                      </Box>
                    </TableCell>
                    {/* Status Column */}
                    <TableCell align="center">
                      {getStatusChip(component.enrichment_status)}
                    </TableCell>
                    {/* Docs Column */}
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
                              aria-label={`Open datasheet for ${component.mpn}`}
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
                              aria-label={`Open 3D model for ${component.mpn}`}
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
                    {/* Actions Column */}
                    <TableCell align="center">
                      <MuiLink
                        component={Link}
                        to={`/component/${encodeURIComponent(component.mpn)}`}
                        underline="hover"
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
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
        <Grid container spacing={3}>
          {displayResults.map((component, index) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={index}>
              <ComponentCard
                component={component}
                onViewDetails={(mpn) => navigate(`/component/${encodeURIComponent(mpn)}`)}
              />
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

// ============================================================================
// Exported Component with Error Boundary Wrapper
// ============================================================================

/**
 * Component Search with Error Boundary protection.
 * Catches and displays errors gracefully, allowing users to retry.
 */
export const ComponentSearchEnhanced: React.FC = () => (
  <ComponentSearchErrorBoundary>
    <ComponentSearchEnhancedInner />
  </ComponentSearchErrorBoundary>
);
