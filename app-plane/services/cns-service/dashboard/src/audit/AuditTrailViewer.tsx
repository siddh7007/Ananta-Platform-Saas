/**
 * Audit Trail Viewer - Real-time Enrichment Audit Viewing
 *
 * Single-page interface for viewing enrichment audit data
 * Features:
 * - Job list with filtering (Job ID, BOM name, bulk file name)
 * - Line item table for selected job
 * - Tabbed detail view (Vendor Response, Normalized Data, Comparison, Side-by-Side)
 * - Real-time data from MinIO JSON objects
 */

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  TextField,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Alert,
  CircularProgress,
  Button,
  Divider,
  InputAdornment,
  Stack,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Assessment as AuditIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Business as OrgIcon,
  Visibility as VisibilityIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { API_CONFIG, getAuthHeaders } from '../config/api';
import { useNotification } from '../contexts/NotificationContext';

interface AuditJob {
  job_id: string;
  total_items: number;
  has_audit_trail: boolean;
  bom_available: boolean;
  filename?: string;
  organization_id?: string;
  uploaded_by?: string;
  created_at?: string;
  status?: string;
}

interface AuditLineItem {
  line_id: string;
  mpn: string;
  manufacturer: string;
  vendor: string;
  quality_score: number;
  storage_location: string;
  timestamp: string;
  category: string;
  lifecycle: string;
  has_vendor_response: boolean;
  has_normalized_data: boolean;
  has_comparison: boolean;
}

interface SideBySideData {
  line_id: string;
  vendor_response: any;
  normalized_data: any;
  comparison: any;
  errors: string[];
}

export const AuditTrailViewer = () => {
  const { showError, showSuccess } = useNotification();

  // State
  const [jobs, setJobs] = useState<AuditJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<AuditLineItem[]>([]);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [sideBySideData, setSideBySideData] = useState<SideBySideData | null>(null);

  const [filterText, setFilterText] = useState('');
  const [organizationFilter, setOrganizationFilter] = useState<string>('');
  const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [lineItemsLoading, setLineItemsLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const inspectorOpen = Boolean(selectedLineId);

  // Fetch jobs list
  const fetchJobs = async () => {
    setLoading(true);
    try {
      // Build URL with optional organization filter
      let url = `${API_CONFIG.BASE_URL}/bulk/audit-objects/jobs`;
      if (organizationFilter) {
        url += `?organization_id=${encodeURIComponent(organizationFilter)}`;
      }

      const response = await fetch(url, { headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to fetch jobs');
      const data = await response.json();
      setJobs(data);
    } catch (err: any) {
      console.error('Failed to fetch jobs:', err);
      showError(err.message || 'Failed to fetch audit jobs');
    } finally {
      setLoading(false);
    }
  };

  // Fetch line items for selected job
  const fetchLineItems = async (jobId: string) => {
    setLineItemsLoading(true);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/bulk/audit-objects/${jobId}/line-items`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch line items');
      const data = await response.json();
      setLineItems(data);
    } catch (err: any) {
      console.error('Failed to fetch line items:', err);
      showError(err.message || 'Failed to fetch line items');
    } finally {
      setLineItemsLoading(false);
    }
  };

  // Fetch side-by-side data for selected line
  const fetchSideBySide = async (jobId: string, lineId: string) => {
    setDetailLoading(true);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/bulk/audit-objects/${jobId}/line-items/${lineId}/side-by-side`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch audit data');
      const data = await response.json();
      setSideBySideData(data);
    } catch (err: any) {
      console.error('Failed to fetch side-by-side data:', err);
      showError(err.message || 'Failed to fetch audit data');
    } finally {
      setDetailLoading(false);
    }
  };

  // Initial fetch and refetch when organization filter changes
  useEffect(() => {
    fetchJobs();
  }, [organizationFilter]);

  // Fetch line items when job selected
  useEffect(() => {
    if (selectedJobId) {
      fetchLineItems(selectedJobId);
      setSelectedLineId(null);
      setSideBySideData(null);
    }
  }, [selectedJobId]);

  // Fetch detail when line selected
  useEffect(() => {
    if (selectedJobId && selectedLineId) {
      fetchSideBySide(selectedJobId, selectedLineId);
    }
  }, [selectedJobId, selectedLineId]);

  // Format date helper
  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'Unknown date';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return 'Invalid date';
    }
  };

  // Time filter helper
  const isWithinTimeRange = (dateString?: string): boolean => {
    if (!dateString) {
      // Jobs without dates are always included in "all" filter, excluded otherwise
      return timeFilter === 'all';
    }

    const jobDate = new Date(dateString);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (timeFilter) {
      case 'today':
        return jobDate >= todayStart;
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return jobDate >= weekAgo;
      case 'month':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return jobDate >= monthAgo;
      case 'all':
      default:
        return true;
    }
  };

  // Filter jobs
  const filteredJobs = jobs.filter(job => {
    // Text filter (job ID or filename)
    const matchesText = job.job_id.toLowerCase().includes(filterText.toLowerCase()) ||
      (job.filename && job.filename.toLowerCase().includes(filterText.toLowerCase()));

    // Time filter
    const matchesTime = isWithinTimeRange(job.created_at);

    return matchesText && matchesTime;
  });

  // Handle job selection
  const handleJobSelect = (jobId: string) => {
    setSelectedJobId(jobId);
  };

  // Handle line item selection
  const handleLineItemSelect = (lineId: string) => {
    setSelectedLineId(lineId);
  };

  // Tab change
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Render quality score chip
  const renderQualityChip = (score: number) => {
    const color = score >= 80 ? 'success' : score >= 60 ? 'warning' : 'error';
    return (
      <Chip
        label={`${score}%`}
        color={color}
        size="small"
        icon={score >= 80 ? <CheckIcon /> : <ErrorIcon />}
      />
    );
  };

  // Render storage location chip
  const renderStorageChip = (location: string) => {
    const color = location === 'database' ? 'success' : 'info';
    return <Chip label={location} color={color} size="small" />;
  };

  // Render JSON object
  const renderJSON = (data: any) => {
    if (!data) return <Typography color="text.secondary">No data available</Typography>;

    return (
      <Box
        component="pre"
        sx={{
          p: 2,
          bgcolor: 'grey.50',
          borderRadius: 1,
          overflow: 'auto',
          maxHeight: 500,
          fontSize: '0.875rem',
          fontFamily: 'monospace',
        }}
      >
        {JSON.stringify(data, null, 2)}
      </Box>
    );
  };

  // Render comparison view
  const renderComparison = () => {
    if (!sideBySideData?.vendor_response || !sideBySideData?.normalized_data) {
      return <Typography color="text.secondary">Missing data for comparison</Typography>;
    }

    const vendor = sideBySideData.vendor_response;
    const normalized = sideBySideData.normalized_data;

    return (
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell><strong>Field</strong></TableCell>
              <TableCell><strong>Vendor Response</strong></TableCell>
              <TableCell><strong>Normalized Data</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Object.keys(normalized).map(key => {
              const vendorValue = vendor[key];
              const normalizedValue = normalized[key];
              const changed = JSON.stringify(vendorValue) !== JSON.stringify(normalizedValue);

              return (
                <TableRow
                  key={key}
                  sx={{ backgroundColor: changed ? '#fff3cd' : 'transparent' }}
                >
                  <TableCell><strong>{key}</strong></TableCell>
                  <TableCell>{typeof vendorValue === 'object' ? JSON.stringify(vendorValue) : String(vendorValue || '-')}</TableCell>
                  <TableCell>{typeof normalizedValue === 'object' ? JSON.stringify(normalizedValue) : String(normalizedValue || '-')}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  const renderDetailBody = () => {
    if (!selectedLineId) {
      return (
        <Alert severity="info" sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          Select a line item to view audit data
        </Alert>
      );
    }

    if (detailLoading) {
      return (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress size={28} />
        </Box>
      );
    }

    if (!sideBySideData) {
      return (
        <Alert severity="error" sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          Failed to load audit data
        </Alert>
      );
    }

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {sideBySideData.errors.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Errors: {sideBySideData.errors.join(', ')}
          </Alert>
        )}

        <Tabs value={activeTab} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="Vendor Response" />
          <Tab label="Normalized Data" />
          <Tab label="Comparison" />
          <Tab label="Side-by-Side" />
        </Tabs>

        <Box sx={{ mt: 2, flex: 1, overflow: 'auto' }}>
          {activeTab === 0 && renderJSON(sideBySideData.vendor_response)}
          {activeTab === 1 && renderJSON(sideBySideData.normalized_data)}
          {activeTab === 2 && renderJSON(sideBySideData.comparison)}
          {activeTab === 3 && renderComparison()}
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AuditIcon fontSize="large" />
        Enrichment Audit Trail Viewer
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        View real-time enrichment audit data with side-by-side comparison
      </Typography>

      <Divider sx={{ my: 2 }} />

      <Box
        sx={{
          display: { xs: 'flex', md: 'grid' },
          flexDirection: { xs: 'column', md: undefined },
          gap: 3,
          alignItems: 'stretch',
          gridTemplateColumns: { md: `minmax(0, 1fr) ${inspectorOpen ? 'minmax(360px, 42%)' : '64px'}` },
          transition: 'grid-template-columns 0.25s ease',
        }}
      >
        <Stack spacing={3} sx={{ flex: 1 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box>
                  <Typography variant="h6">Jobs</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {filteredJobs.length} of {jobs.length} jobs
                  </Typography>
                </Box>
                <Button size="small" onClick={fetchJobs} disabled={loading} aria-label="Refresh jobs">
                  <RefreshIcon />
                </Button>
              </Box>

              {/* Time Filter Tabs */}
              <Tabs
                value={timeFilter}
                onChange={(_, newValue) => setTimeFilter(newValue)}
                sx={{ mb: 2, minHeight: 36 }}
                variant="fullWidth"
              >
                <Tab label="Today" value="today" sx={{ minHeight: 36, py: 1 }} />
                <Tab label="This Week" value="week" sx={{ minHeight: 36, py: 1 }} />
                <Tab label="This Month" value="month" sx={{ minHeight: 36, py: 1 }} />
                <Tab label="All Time" value="all" sx={{ minHeight: 36, py: 1 }} />
              </Tabs>

              <Stack spacing={2} sx={{ mb: 2 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Filter by Job ID or Filename..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />

                <TextField
                  fullWidth
                  size="small"
                  placeholder="Filter by Organization ID (UUID)..."
                  value={organizationFilter}
                  onChange={(e) => setOrganizationFilter(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <OrgIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                  helperText="Leave empty to show all organizations"
                />
              </Stack>

              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : filteredJobs.length === 0 ? (
                <Alert severity="info">No jobs found</Alert>
              ) : (
                <Box sx={{ maxHeight: 500, overflow: 'auto' }}>
                  {filteredJobs.map(job => (
                    <Paper
                      key={job.job_id}
                      sx={{
                        p: 1.5,
                        mb: 1,
                        cursor: 'pointer',
                        bgcolor: selectedJobId === job.job_id ? 'primary.light' : 'transparent',
                        border: 1,
                        borderColor: selectedJobId === job.job_id ? 'primary.main' : 'divider',
                        transition: 'background-color 0.2s ease, border 0.2s ease',
                        '&:hover': {
                          bgcolor: 'grey.50',
                        },
                      }}
                      onClick={() => handleJobSelect(job.job_id)}
                    >
                      <Typography variant="body2" fontWeight={600} noWrap sx={{ mb: 0.5 }}>
                        {job.filename || job.job_id}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        {formatDate(job.created_at)}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Chip label={`${job.total_items} items`} size="small" />
                        {job.status && (
                          <Chip
                            label={job.status}
                            size="small"
                            color={job.status === 'completed' ? 'success' : 'default'}
                          />
                        )}
                      </Box>
                      {job.uploaded_by && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                          Uploaded by: {job.uploaded_by}
                        </Typography>
                      )}
                      {!job.filename && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, fontSize: '0.7rem' }}>
                          Job ID: {job.job_id}
                        </Typography>
                      )}
                    </Paper>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Line Items {selectedJobId && `(${lineItems.length})`}
              </Typography>

              {!selectedJobId ? (
                <Alert severity="info">Select a job to view line items</Alert>
              ) : lineItemsLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : lineItems.length === 0 ? (
                <Alert severity="warning">No line items found</Alert>
              ) : (
                <TableContainer sx={{ maxHeight: 500 }}>
                  <Table size="small" stickyHeader aria-label="Line items table">
                    <TableHead>
                      <TableRow>
                        <TableCell>MPN</TableCell>
                        <TableCell>Mfr</TableCell>
                        <TableCell>Quality</TableCell>
                        <TableCell>Storage</TableCell>
                        <TableCell align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {lineItems.map(item => (
                        <TableRow
                          key={item.line_id}
                          onClick={() => handleLineItemSelect(item.line_id)}
                          sx={{
                            cursor: 'pointer',
                            bgcolor: selectedLineId === item.line_id ? 'primary.light' : 'transparent',
                            '&:hover': { bgcolor: 'grey.50' },
                            transition: 'background-color 0.2s ease',
                          }}
                        >
                          <TableCell>{item.mpn}</TableCell>
                          <TableCell>{item.manufacturer}</TableCell>
                          <TableCell>{renderQualityChip(item.quality_score)}</TableCell>
                          <TableCell>{renderStorageChip(item.storage_location)}</TableCell>
                          <TableCell align="center">
                            <Stack direction="row" spacing={0.5} justifyContent="center">
                              <Tooltip title="View Details">
                                <IconButton
                                  size="small"
                                  color="info"
                                  onClick={(e) => { e.stopPropagation(); handleLineItemSelect(item.line_id); }}
                                  aria-label="View details"
                                >
                                  <VisibilityIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Copy Line ID">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(item.line_id);
                                    showSuccess('Line ID copied to clipboard');
                                  }}
                                  aria-label="Copy line ID"
                                >
                                  <CopyIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Stack>

        <Box
          sx={{
            width: { xs: '100%', md: 'auto' },
            mt: { xs: inspectorOpen ? 3 : 0, md: 0 },
            display: { xs: inspectorOpen ? 'block' : 'none', md: 'flex' },
            alignItems: { md: 'stretch' },
            justifyContent: { md: 'stretch' },
            minHeight: { md: '70vh' },
            bgcolor: inspectorOpen ? 'transparent' : 'grey.100',
            borderRadius: { md: 2 },
            border: { md: inspectorOpen ? 'none' : '1px dashed rgba(25,118,210,0.4)' },
            transition: 'background-color 0.25s ease, border 0.25s ease',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {inspectorOpen ? (
            <Card sx={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }} elevation={3}>
              <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <Typography variant="h6" gutterBottom sx={{ pb: 1 }}>
                  Audit Detail
                </Typography>
                {renderDetailBody()}
              </CardContent>
            </Card>
          ) : (
            <Box
              sx={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'text.secondary',
                fontWeight: 600,
                letterSpacing: 1,
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  display: { xs: 'none', md: 'block' },
                  writingMode: 'vertical-rl',
                  transform: 'rotate(180deg)',
                }}
              >
                DETAILS
              </Typography>
              <Typography variant="caption" sx={{ display: { xs: 'block', md: 'none' } }}>
                Select a line item to view audit details.
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};
