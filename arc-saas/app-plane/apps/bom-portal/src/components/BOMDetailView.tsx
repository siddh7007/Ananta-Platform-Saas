/**
 * BOM Detail View Component
 *
 * Phase 1: Component Detail View
 *
 * Displays detailed component list for a BOM with:
 * - Paginated table of components
 * - Search and filtering
 * - Enrichment status indicators
 * - Click to view full component details
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  TextField,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Typography,
  CircularProgress,
  Alert,
  TablePagination,
  Stack,
  InputAdornment,
} from '@mui/material';
import {
  Search as SearchIcon,
  Visibility as ViewIcon,
  Download as DownloadIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  HourglassEmpty as PendingIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useNotify } from 'react-admin';
import { getCnsBaseUrl, getAuthHeaders } from '../services/cnsApi';

interface Component {
  id: string;
  line_number: number;
  manufacturer_part_number: string;
  manufacturer: string;
  quantity: number;
  reference_designator?: string;
  description?: string;
  enrichment_status: 'pending' | 'completed' | 'failed';
  match_status?: string;
  supplier?: string;
  supplier_part_number?: string;
  price?: number;
  stock?: number;
  category?: string;
  lifecycle_status?: string;
  quality_score?: number;
  datasheet_url?: string;
  enrichment_data: Record<string, any>;
}

interface BOMDetailViewProps {
  bomId: string;
  bomName: string;
  tenantId: string;
  projectId: string;
  onClose: () => void;
  onComponentClick?: (component: Component) => void;
}

export const BOMDetailView: React.FC<BOMDetailViewProps> = ({
  bomId,
  bomName,
  tenantId,
  projectId,
  onClose,
  onComponentClick,
}) => {
  const notify = useNotify();

  const [components, setComponents] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0); // 0-indexed for MUI TablePagination
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState(''); // Local input state
  const [statusFilter, setStatusFilter] = useState<string>('');

  const loadComponents = async () => {
    try {
      setLoading(true);
      const cnsBaseUrl = getCnsBaseUrl();
      const authHeaders = await getAuthHeaders();

      const params = new URLSearchParams({
        page: (page + 1).toString(), // API expects 1-indexed
        page_size: rowsPerPage.toString(),
        organization_id: tenantId,
        project_id: projectId,
        ...(search && { search }),
        ...(statusFilter && { enrichment_status: statusFilter }),
      });

      const response = await fetch(
        `${cnsBaseUrl}/api/boms/${bomId}/components?${params}`,
        { headers: authHeaders }
      );

      if (!response.ok) {
        throw new Error(`Failed to load components: ${response.statusText}`);
      }

      const data = await response.json();

      setComponents(data.items || []);
      setTotalItems(data.pagination?.total_items || 0);

      console.log('[BOM Detail] Loaded components:', {
        bomId,
        itemCount: data.items?.length,
        total: data.pagination?.total_items,
        page: page + 1,
      });
    } catch (error: any) {
      console.error('[BOM Detail] Error loading components:', error);
      notify(`Failed to load components: ${error.message}`, { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComponents();
  }, [bomId, page, rowsPerPage, search, statusFilter]);

  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setPage(0); // Reset to first page
      setSearch(searchInput);
    }
  };

  const handleSearchClick = () => {
    setPage(0);
    setSearch(searchInput);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearch('');
    setPage(0);
  };

  const handleStatusFilterChange = (value: string) => {
    setPage(0); // Reset to first page
    setStatusFilter(value);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'pending':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckIcon fontSize="small" />;
      case 'failed':
        return <ErrorIcon fontSize="small" />;
      case 'pending':
        return <PendingIcon fontSize="small" />;
      default:
        return null;
    }
  };

  const exportToCSV = () => {
    // Simple CSV export of current page
    const headers = [
      'Line',
      'MPN',
      'Manufacturer',
      'Qty',
      'Reference',
      'Status',
      'Supplier',
      'Price',
      'Stock',
      'Category',
      'Lifecycle',
    ];

    const rows = components.map((c) => [
      c.line_number,
      c.manufacturer_part_number,
      c.manufacturer || '',
      c.quantity,
      c.reference_designator || '',
      c.enrichment_status,
      c.supplier || '',
      c.price ? `$${c.price.toFixed(2)}` : '',
      c.stock || '',
      c.category || '',
      c.lifecycle_status || '',
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bom_${bomId.substring(0, 8)}_components_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    notify('CSV exported successfully', { type: 'success' });
  };

  return (
    <Dialog open onClose={onClose} maxWidth="xl" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6">BOM Components</Typography>
            <Typography variant="body2" color="textSecondary">
              {bomName}
            </Typography>
          </Box>

          <Stack direction="row" spacing={2} alignItems="center">
            {/* Search */}
            <TextField
              size="small"
              placeholder="Search MPN, manufacturer..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyPress={handleSearchKeyPress}
              sx={{ minWidth: 250 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: searchInput && (
                  <InputAdornment position="end">
                    <Button size="small" onClick={handleClearSearch}>
                      Clear
                    </Button>
                  </InputAdornment>
                ),
              }}
            />

            <Button
              size="small"
              variant="contained"
              onClick={handleSearchClick}
              disabled={loading}
            >
              Search
            </Button>

            {/* Status Filter */}
            <Select
              size="small"
              value={statusFilter}
              onChange={(e) => handleStatusFilterChange(e.target.value)}
              displayEmpty
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="">All Statuses</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="failed">Failed</MenuItem>
            </Select>

            {/* Refresh */}
            <Tooltip title="Refresh">
              <span>
                <IconButton onClick={loadComponents} disabled={loading}>
                  <RefreshIcon />
                </IconButton>
              </span>
            </Tooltip>

            {/* Export */}
            <Button
              variant="outlined"
              size="small"
              startIcon={<DownloadIcon />}
              onClick={exportToCSV}
              disabled={loading || components.length === 0}
            >
              Export
            </Button>
          </Stack>
        </Box>
      </DialogTitle>

      <DialogContent>
        {loading ? (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        ) : components.length === 0 ? (
          <Alert severity="info">
            No components found. {search && 'Try a different search term.'}
          </Alert>
        ) : (
          <>
            <TableContainer component={Paper} variant="outlined">
              <Table stickyHeader>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'background.paper' }}>
                    <TableCell width={60}><strong>Line</strong></TableCell>
                    <TableCell width={200}><strong>MPN</strong></TableCell>
                    <TableCell width={150}><strong>Manufacturer</strong></TableCell>
                    <TableCell width={60} align="center"><strong>Qty</strong></TableCell>
                    <TableCell width={100}><strong>Reference</strong></TableCell>
                    <TableCell width={120} align="center"><strong>Status</strong></TableCell>
                    <TableCell width={120}><strong>Supplier</strong></TableCell>
                    <TableCell width={100} align="right"><strong>Price</strong></TableCell>
                    <TableCell width={80} align="right"><strong>Stock</strong></TableCell>
                    <TableCell width={120}><strong>Category</strong></TableCell>
                    <TableCell width={80} align="center"><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {components.map((component) => (
                    <TableRow key={component.id} hover>
                      <TableCell>{component.line_number}</TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {component.manufacturer_part_number}
                        </Typography>
                        {component.quality_score !== undefined && (
                          <Typography variant="caption" color="textSecondary">
                            Quality: {component.quality_score}/100
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {component.manufacturer || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">{component.quantity}</TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {component.reference_designator || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          icon={getStatusIcon(component.enrichment_status)}
                          label={component.enrichment_status}
                          color={getStatusColor(component.enrichment_status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {component.supplier || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {component.price ? (
                          <Typography variant="body2" fontWeight={500}>
                            ${component.price.toFixed(2)}
                          </Typography>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {component.stock !== undefined && component.stock !== null ? (
                          <Chip
                            label={component.stock}
                            size="small"
                            color={component.stock > 0 ? 'success' : 'error'}
                            variant="outlined"
                          />
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 120 }}>
                          {component.category || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={() => onComponentClick?.(component)}
                            disabled={!onComponentClick}
                          >
                            <ViewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Pagination */}
            <TablePagination
              component="div"
              count={totalItems}
              page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={[25, 50, 100, 200]}
            />
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};
