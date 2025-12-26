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
  Paper,
  Chip,
  CircularProgress,
  InputAdornment,
  Alert,
  Link as MuiLink,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import { Link } from 'react-router-dom';
import { CNS_API_URL, getAuthHeaders } from '../config/api';

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
 * Component Search Page
 *
 * Allows users to search for components in the catalog by:
 * - MPN (Manufacturer Part Number)
 * - Manufacturer
 * - Category
 * - Description keywords
 */
export const ComponentSearch: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState<'mpn' | 'manufacturer' | 'category'>('mpn');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setError('Please enter a search term');
      return;
    }

    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const params = new URLSearchParams({
        query: searchTerm,
        search_type: searchType,
        limit: '50',
      });

      const headers = getAuthHeaders();
      const response = await fetch(`${CNS_API_URL}/catalog/search?${params}`, {
        headers: headers ? new Headers(headers) : undefined,
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

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        Component Search
      </Typography>
      <Typography variant="body1" color="textSecondary" paragraph>
        Search the enriched component catalog by MPN, manufacturer, or category
      </Typography>

      {/* Search Form */}
      <Card sx={{ mb: 3 }}>
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

      {/* Search Results */}
      {searched && (
        <Card>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">
                Search Results
              </Typography>
              <Chip
                label={`${results.length} components found`}
                color="primary"
                variant="outlined"
              />
            </Box>

            {results.length > 0 ? (
              <TableContainer component={Paper} variant="outlined">
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
                    {results.map((component, index) => (
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
            ) : (
              <Box textAlign="center" py={4}>
                <SearchIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="textSecondary">
                  No components found
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Try searching with different keywords or filters
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

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
