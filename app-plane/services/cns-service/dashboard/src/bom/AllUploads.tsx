/**
 * All Uploads - Combined view of Redis bulk uploads and Database BOMs
 *
 * This component shows all staff BOM uploads in a single page with two tabs:
 * 1. Active (Redis) - Temporary uploads with 24-48h TTL, active enrichment
 * 2. All BOMs (Database) - Persisted staff BOMs from Supabase
 *
 * Features:
 * - Tab-based navigation between Redis and Database sources
 * - Expandable rows to show BOM line items
 * - Side panel for component-level inspection with all metadata
 * - Workflow step visualization
 * - Enrichment progress and counts
 * - Continue/View workflow actions
 * - Pagination and search
 */

import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Chip,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  LinearProgress,
  Stack,
  TextField,
  InputAdornment,
  TablePagination,
  Tabs,
  Tab,
  Badge,
  Collapse,
  Drawer,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  CircularProgress,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Search as SearchIcon,
  OpenInNew as OpenInNewIcon,
  Add as AddIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  CloudUpload as UploadIcon,
  CloudQueue as RedisIcon,
  Storage as DatabaseIcon,
  PlayArrow as StartIcon,
  KeyboardArrowDown as ExpandIcon,
  KeyboardArrowUp as CollapseIcon,
  Close as CloseIcon,
  Memory as ComponentIcon,
  Category as CategoryIcon,
  Business as ManufacturerIcon,
  Description as DescriptionIcon,
  Link as LinkIcon,
  AttachMoney as PriceIcon,
  Verified as VerifiedIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Inventory as InventoryIcon,
  Numbers as NumberIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { CNS_API_URL, getAuthHeadersAsync, API_CONFIG, getAuthHeaders } from '../config/api';
import { useNotification } from '../contexts/NotificationContext';
import { useTenant } from '../contexts/TenantContext';

// ============================================================================
// Types
// ============================================================================

interface RedisUpload {
  upload_id: string;
  bom_id?: string;
  filename: string;
  status: string;
  total_rows: number;
  enrichment_progress?: {
    total_items: number;
    enriched_items: number;
    failed_items: number;
    pending_items: number;
    percent_complete: number;
  };
  created_at: string;
  redis_expires_at?: string;
}

interface DatabaseBOM {
  id: string;
  name: string;
  filename: string;
  status: string;
  organization_id: string | null;
  project_id: string | null;
  created_at: string;
  component_count: number | null;
  enrichment_status: string;
  percent_complete: number;
  upload_source: string | null;
  temporal_workflow_id: string | null;
  enrichment_progress: {
    total_items?: number;
    enriched_items?: number;
    failed_items?: number;
    pending_items?: number;
  } | null;
}

interface LineItem {
  id: string;
  line_number: number;
  manufacturer_part_number: string;
  manufacturer: string | null;
  description: string | null;
  quantity: number | null;
  reference_designator: string | null;
  enrichment_status: string;
  component_id: string | null;
  lifecycle_status: string | null;
  datasheet_url: string | null;
  specifications: Record<string, unknown> | null;
  compliance_status: Record<string, unknown> | null;
  pricing: Record<string, unknown> | null;
  enriched_at: string | null;
  created_at: string;
  updated_at: string | null;
}

// Unified type for display
interface UnifiedUpload {
  id: string;
  source: 'redis' | 'database';
  name: string;
  filename: string;
  status: string;
  enrichmentStatus: string;
  totalItems: number;
  enrichedItems: number;
  failedItems: number;
  pendingItems: number;
  percentComplete: number;
  createdAt: string;
  bomId?: string;
  expiresAt?: string;
}

// ============================================================================
// Status Colors
// ============================================================================

const statusColors: Record<string, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
  completed: 'success',
  complete: 'success',
  enriched: 'success',
  processing: 'info',
  enriching: 'info',
  in_progress: 'info',
  pending: 'warning',
  uploaded: 'default',
  failed: 'error',
  error: 'error',
  paused: 'warning',
  not_found: 'error',
};

const enrichmentStatusColors: Record<string, string> = {
  enriched: '#4caf50',
  pending: '#ff9800',
  failed: '#f44336',
  not_found: '#9e9e9e',
  in_progress: '#2196f3',
};

// ============================================================================
// Shared Utility Functions
// ============================================================================

/**
 * Format date string to locale string with fallback
 * Extracted to module level to avoid duplication
 */
const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
};

// ============================================================================
// Helper Components
// ============================================================================

const EnrichmentCounts = ({ upload }: { upload: UnifiedUpload }) => {
  return (
    <Box display="flex" alignItems="center" gap={0.5} justifyContent="center">
      <Tooltip title={`Enriched: ${upload.enrichedItems}`}>
        <Box display="flex" alignItems="center" gap={0.25}>
          <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />
          <Typography variant="caption">{upload.enrichedItems}</Typography>
        </Box>
      </Tooltip>
      <Tooltip title={`Failed: ${upload.failedItems}`}>
        <Box display="flex" alignItems="center" gap={0.25}>
          <ErrorIcon sx={{ fontSize: 14, color: 'error.main' }} />
          <Typography variant="caption">{upload.failedItems}</Typography>
        </Box>
      </Tooltip>
      <Tooltip title={`Pending: ${upload.pendingItems}`}>
        <Box display="flex" alignItems="center" gap={0.25}>
          <ScheduleIcon sx={{ fontSize: 14, color: 'warning.main' }} />
          <Typography variant="caption">{upload.pendingItems}</Typography>
        </Box>
      </Tooltip>
    </Box>
  );
};

const SourceBadge = ({ source }: { source: 'redis' | 'database' }) => {
  if (source === 'redis') {
    return (
      <Tooltip title="Active in Redis (temporary)">
        <Chip
          icon={<RedisIcon sx={{ fontSize: 12 }} />}
          label="Active"
          size="small"
          color="info"
          sx={{ fontSize: 10, height: 20 }}
        />
      </Tooltip>
    );
  }
  return (
    <Tooltip title="Stored in Database (permanent)">
      <Chip
        icon={<DatabaseIcon sx={{ fontSize: 12 }} />}
        label="Saved"
        size="small"
        color="default"
        sx={{ fontSize: 10, height: 20 }}
      />
    </Tooltip>
  );
};

// Line Item Status Chip
const LineItemStatusChip = ({ status }: { status: string }) => {
  const color = enrichmentStatusColors[status?.toLowerCase()] || '#9e9e9e';
  return (
    <Chip
      label={status || 'unknown'}
      size="small"
      sx={{
        backgroundColor: color,
        color: '#fff',
        fontSize: 10,
        height: 20,
      }}
    />
  );
};

// ============================================================================
// Component Detail Panel
// ============================================================================

interface ComponentDetailPanelProps {
  open: boolean;
  onClose: () => void;
  lineItem: LineItem | null;
  bomName: string;
}

const ComponentDetailPanel = ({ open, onClose, lineItem, bomName }: ComponentDetailPanelProps) => {
  if (!lineItem) return null;

  const renderJsonData = (data: Record<string, unknown> | null, label: string) => {
    if (!data || Object.keys(data).length === 0) return null;
    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          {label}
        </Typography>
        <Paper variant="outlined" sx={{ p: 1, backgroundColor: 'grey.50', maxHeight: 200, overflow: 'auto' }}>
          <pre style={{ margin: 0, fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {JSON.stringify(data, null, 2)}
          </pre>
        </Paper>
      </Box>
    );
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: 450, md: 500 } } }}
    >
      <Box sx={{ p: 2 }}>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Box>
            <Typography variant="h6" gutterBottom>
              Component Details
            </Typography>
            <Typography variant="caption" color="text.secondary">
              From: {bomName}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Main Info */}
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <ComponentIcon color="primary" />
            <Typography variant="h6" sx={{ fontFamily: 'monospace' }}>
              {lineItem.manufacturer_part_number}
            </Typography>
          </Box>

          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <ManufacturerIcon fontSize="small" color="action" />
            <Typography variant="body2">
              {lineItem.manufacturer || 'Unknown Manufacturer'}
            </Typography>
          </Box>

          {lineItem.description && (
            <Box display="flex" alignItems="flex-start" gap={1}>
              <DescriptionIcon fontSize="small" color="action" sx={{ mt: 0.5 }} />
              <Typography variant="body2" color="text.secondary">
                {lineItem.description}
              </Typography>
            </Box>
          )}
        </Paper>

        {/* Status Section */}
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Status & Enrichment
        </Typography>
        <List dense disablePadding>
          <ListItem>
            <ListItemIcon sx={{ minWidth: 36 }}>
              {lineItem.enrichment_status === 'enriched' ? (
                <VerifiedIcon color="success" fontSize="small" />
              ) : lineItem.enrichment_status === 'failed' ? (
                <ErrorIcon color="error" fontSize="small" />
              ) : (
                <ScheduleIcon color="warning" fontSize="small" />
              )}
            </ListItemIcon>
            <ListItemText
              primary="Enrichment Status"
              secondary={<LineItemStatusChip status={lineItem.enrichment_status} />}
            />
          </ListItem>

          {lineItem.lifecycle_status && (
            <ListItem>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <InfoIcon fontSize="small" color="action" />
              </ListItemIcon>
              <ListItemText
                primary="Lifecycle"
                secondary={lineItem.lifecycle_status}
              />
            </ListItem>
          )}

          {lineItem.enriched_at && (
            <ListItem>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <CheckCircleIcon fontSize="small" color="success" />
              </ListItemIcon>
              <ListItemText
                primary="Enriched At"
                secondary={formatDate(lineItem.enriched_at)}
              />
            </ListItem>
          )}
        </List>

        <Divider sx={{ my: 2 }} />

        {/* BOM Info */}
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          BOM Line Info
        </Typography>
        <List dense disablePadding>
          <ListItem>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <NumberIcon fontSize="small" color="action" />
            </ListItemIcon>
            <ListItemText
              primary="Line Number"
              secondary={lineItem.line_number}
            />
          </ListItem>

          {lineItem.quantity && (
            <ListItem>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <InventoryIcon fontSize="small" color="action" />
              </ListItemIcon>
              <ListItemText
                primary="Quantity"
                secondary={lineItem.quantity}
              />
            </ListItem>
          )}

          {lineItem.reference_designator && (
            <ListItem>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <CategoryIcon fontSize="small" color="action" />
              </ListItemIcon>
              <ListItemText
                primary="Reference Designator"
                secondary={lineItem.reference_designator}
              />
            </ListItem>
          )}
        </List>

        <Divider sx={{ my: 2 }} />

        {/* Links */}
        {lineItem.datasheet_url && (
          <>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Resources
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<LinkIcon />}
              href={lineItem.datasheet_url}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ mb: 2 }}
            >
              Open Datasheet
            </Button>
          </>
        )}

        {/* JSON Data Sections */}
        {renderJsonData(lineItem.specifications, 'Specifications')}
        {renderJsonData(lineItem.pricing, 'Pricing Data')}
        {renderJsonData(lineItem.compliance_status, 'Compliance Status')}

        <Divider sx={{ my: 2 }} />

        {/* Timestamps */}
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Timestamps
        </Typography>
        <List dense disablePadding>
          <ListItem>
            <ListItemText
              primary="Created"
              secondary={formatDate(lineItem.created_at)}
            />
          </ListItem>
          <ListItem>
            <ListItemText
              primary="Updated"
              secondary={formatDate(lineItem.updated_at)}
            />
          </ListItem>
        </List>

        {/* Component ID for linking */}
        {lineItem.component_id && (
          <Box mt={2}>
            <Typography variant="caption" color="text.secondary">
              Component ID: {lineItem.component_id}
            </Typography>
          </Box>
        )}
      </Box>
    </Drawer>
  );
};

// ============================================================================
// Expandable Row Component
// ============================================================================

interface ExpandableRowProps {
  upload: UnifiedUpload;
  onStartEnrichment: (upload: UnifiedUpload) => void;
  onRowClick: (upload: UnifiedUpload) => void;
  onSelectLineItem: (lineItem: LineItem, bomName: string) => void;
}

const ExpandableRowComponent = ({ upload, onStartEnrichment, onRowClick, onSelectLineItem }: ExpandableRowProps) => {
  const [expanded, setExpanded] = useState(false);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Fetch line items when expanded
  const fetchLineItems = async () => {
    if (!upload.bomId) return;

    setLoading(true);
    setError(null);

    try {
      const headers = await getAuthHeadersAsync();
      if (!headers) {
        setError('Not authenticated');
        return;
      }

      const response = await fetch(
        `${CNS_API_URL}/admin/line-items?bom_id=${upload.bomId}&limit=100`,
        { headers }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch line items');
      }

      const data = await response.json();
      setLineItems(data);
    } catch (err) {
      console.error('[ExpandableRow] Error fetching line items:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newExpanded = !expanded;
    setExpanded(newExpanded);

    if (newExpanded && lineItems.length === 0 && upload.bomId) {
      fetchLineItems();
    }
  };

  return (
    <>
      {/* Main Row */}
      <TableRow
        hover
        sx={{
          cursor: 'pointer',
          '& > *': { borderBottom: expanded ? 'none' : undefined },
        }}
      >
        {/* Expand Button */}
        <TableCell sx={{ width: 40, p: 0.5 }}>
          <IconButton
            size="small"
            onClick={handleToggleExpand}
            disabled={!upload.bomId}
          >
            {expanded ? <CollapseIcon /> : <ExpandIcon />}
          </IconButton>
        </TableCell>

        <TableCell onClick={() => onRowClick(upload)}>
          <Box>
            <Typography variant="body2" fontWeight={500}>
              {upload.name}
            </Typography>
            {upload.filename && upload.filename !== upload.name && (
              <Typography variant="caption" color="text.secondary">
                {upload.filename}
              </Typography>
            )}
          </Box>
        </TableCell>
        <TableCell>
          <SourceBadge source={upload.source} />
        </TableCell>
        <TableCell>
          <Chip
            label={upload.status || 'unknown'}
            size="small"
            color={statusColors[upload.status?.toLowerCase() || 'default'] || 'default'}
          />
        </TableCell>
        <TableCell align="center">
          <EnrichmentCounts upload={upload} />
          {upload.percentComplete > 0 && upload.percentComplete < 100 && (
            <LinearProgress
              variant="determinate"
              value={upload.percentComplete}
              sx={{ mt: 0.5, height: 4, borderRadius: 1 }}
            />
          )}
        </TableCell>
        <TableCell align="right">
          {upload.totalItems || '-'}
        </TableCell>
        <TableCell>
          <Typography variant="caption">
            {formatDate(upload.createdAt)}
          </Typography>
          {upload.expiresAt && (
            <Typography variant="caption" display="block" color="warning.main">
              Expires: {formatDate(upload.expiresAt)}
            </Typography>
          )}
        </TableCell>
        <TableCell align="center">
          <Stack direction="row" spacing={0.5} justifyContent="center">
            {upload.pendingItems > 0 && upload.bomId && (
              <Tooltip title="Start Enrichment">
                <IconButton
                  size="small"
                  color="primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartEnrichment(upload);
                  }}
                >
                  <StartIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {upload.bomId && (
              <Tooltip title="View Details">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/bom-jobs/${upload.bomId}`);
                  }}
                >
                  <OpenInNewIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </TableCell>
      </TableRow>

      {/* Expanded Content - Line Items */}
      <TableRow>
        <TableCell colSpan={8} sx={{ p: 0, backgroundColor: 'grey.50' }}>
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <Box sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ComponentIcon fontSize="small" />
                Line Items ({lineItems.length})
              </Typography>

              {loading && (
                <Box display="flex" justifyContent="center" py={2}>
                  <CircularProgress size={24} />
                </Box>
              )}

              {error && (
                <Alert severity="error" sx={{ mb: 1 }}>
                  {error}
                </Alert>
              )}

              {!loading && !error && lineItems.length === 0 && (
                <Typography variant="body2" color="text.secondary" align="center" py={2}>
                  No line items found
                </Typography>
              )}

              {!loading && lineItems.length > 0 && (
                <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ backgroundColor: 'grey.100' }}>#</TableCell>
                        <TableCell sx={{ backgroundColor: 'grey.100' }}>MPN</TableCell>
                        <TableCell sx={{ backgroundColor: 'grey.100' }}>Manufacturer</TableCell>
                        <TableCell sx={{ backgroundColor: 'grey.100' }}>Description</TableCell>
                        <TableCell sx={{ backgroundColor: 'grey.100' }}>Qty</TableCell>
                        <TableCell sx={{ backgroundColor: 'grey.100' }}>Status</TableCell>
                        <TableCell sx={{ backgroundColor: 'grey.100' }} align="center">Inspect</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {lineItems.map((item) => (
                        <TableRow
                          key={item.id}
                          hover
                          sx={{ cursor: 'pointer' }}
                          onClick={() => onSelectLineItem(item, upload.name)}
                        >
                          <TableCell>{item.line_number}</TableCell>
                          <TableCell>
                            <Typography variant="body2" fontFamily="monospace" fontWeight={500}>
                              {item.manufacturer_part_number}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" noWrap sx={{ maxWidth: 150 }}>
                              {item.manufacturer || '-'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Tooltip title={item.description || ''}>
                              <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                                {item.description || '-'}
                              </Typography>
                            </Tooltip>
                          </TableCell>
                          <TableCell>{item.quantity || '-'}</TableCell>
                          <TableCell>
                            <LineItemStatusChip status={item.enrichment_status} />
                          </TableCell>
                          <TableCell align="center">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectLineItem(item, upload.name);
                              }}
                            >
                              <SearchIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {lineItems.length >= 100 && (
                <Typography variant="caption" color="text.secondary" display="block" mt={1} textAlign="center">
                  Showing first 100 items. View full BOM for all items.
                </Typography>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

// Memoize to prevent unnecessary re-renders when parent state changes
const ExpandableRow = memo(ExpandableRowComponent);

// ============================================================================
// Main Component
// ============================================================================

export const AllUploads = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();
  const { tenantId } = useTenant();

  // Tab state
  const [activeTab, setActiveTab] = useState(0);

  // Redis uploads state
  const [redisUploads, setRedisUploads] = useState<UnifiedUpload[]>([]);
  const [redisLoading, setRedisLoading] = useState(true);
  const [redisError, setRedisError] = useState<string | null>(null);

  // Database BOMs state
  const [dbUploads, setDbUploads] = useState<UnifiedUpload[]>([]);
  const [dbLoading, setDbLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [dbTotalCount, setDbTotalCount] = useState(0);

  // Shared state
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Side panel state
  const [selectedLineItem, setSelectedLineItem] = useState<LineItem | null>(null);
  const [selectedBomName, setSelectedBomName] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);

  // Transform Redis upload to unified format
  const transformRedisUpload = (upload: RedisUpload): UnifiedUpload => {
    const progress = upload.enrichment_progress;
    return {
      id: upload.upload_id,
      source: 'redis',
      name: upload.filename?.replace(/\.[^/.]+$/, '') || 'Untitled',
      filename: upload.filename,
      status: upload.status,
      enrichmentStatus: progress ? (progress.pending_items > 0 ? 'in_progress' : 'completed') : 'pending',
      totalItems: progress?.total_items || upload.total_rows || 0,
      enrichedItems: progress?.enriched_items || 0,
      failedItems: progress?.failed_items || 0,
      pendingItems: progress?.pending_items || upload.total_rows || 0,
      percentComplete: progress?.percent_complete || 0,
      createdAt: upload.created_at,
      bomId: upload.bom_id,
      expiresAt: upload.redis_expires_at,
    };
  };

  // Transform Database BOM to unified format
  const transformDbBom = (bom: DatabaseBOM): UnifiedUpload => {
    const progress = bom.enrichment_progress;
    return {
      id: bom.id,
      source: 'database',
      name: bom.name || 'Untitled',
      filename: bom.filename || '',
      status: bom.status,
      enrichmentStatus: bom.enrichment_status || 'unknown',
      totalItems: progress?.total_items || bom.component_count || 0,
      enrichedItems: progress?.enriched_items || 0,
      failedItems: progress?.failed_items || 0,
      pendingItems: progress?.pending_items || 0,
      percentComplete: bom.percent_complete || 0,
      createdAt: bom.created_at,
      bomId: bom.id,
    };
  };

  // Fetch Redis uploads
  const fetchRedisUploads = useCallback(async () => {
    setRedisLoading(true);
    setRedisError(null);

    try {
      const headers = getAuthHeaders();
      if (!headers) {
        setRedisError('Not authenticated');
        setRedisLoading(false);
        return;
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}/bulk/uploads`, { headers });

      if (!response.ok) {
        throw new Error('Failed to fetch Redis uploads');
      }

      const data = await response.json();
      const uploads = (data.uploads || []).map(transformRedisUpload);
      setRedisUploads(uploads);
    } catch (err) {
      console.error('[AllUploads] Redis fetch error:', err);
      setRedisError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setRedisLoading(false);
    }
  }, []);

  // Fetch Database BOMs
  const fetchDbBoms = useCallback(async () => {
    setDbLoading(true);
    setDbError(null);

    try {
      const headers = await getAuthHeadersAsync();
      if (!headers) {
        setDbError('Not authenticated');
        setDbLoading(false);
        return;
      }

      const params = new URLSearchParams({
        upload_source: 'staff',
        limit: String(rowsPerPage),
        offset: String(page * rowsPerPage),
      });
      if (search) {
        params.set('search', search);
      }

      const [uploadsRes, countRes] = await Promise.all([
        fetch(`${CNS_API_URL}/admin/boms?${params}`, { headers }),
        fetch(`${CNS_API_URL}/admin/boms/count?upload_source=staff${search ? `&search=${encodeURIComponent(search)}` : ''}`, { headers }),
      ]);

      if (!uploadsRes.ok) {
        throw new Error('Failed to fetch database BOMs');
      }

      const uploadsData: DatabaseBOM[] = await uploadsRes.json();
      setDbUploads(uploadsData.map(transformDbBom));

      if (countRes.ok) {
        const countData = await countRes.json();
        setDbTotalCount(countData.total || 0);
      }
    } catch (err) {
      console.error('[AllUploads] DB fetch error:', err);
      setDbError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setDbLoading(false);
    }
  }, [page, rowsPerPage, search]);

  // Ref for cleanup timeout (memory leak fix)
  const panelCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ref for auto-refresh interval
  const autoRefreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch Redis uploads on mount only (no dependencies that would cause refetch)
  useEffect(() => {
    fetchRedisUploads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch Database BOMs when pagination/search changes
  useEffect(() => {
    fetchDbBoms();
  }, [fetchDbBoms]);

  // Auto-refresh for Active tab (every 30 seconds)
  useEffect(() => {
    // Only auto-refresh when on Active tab and not loading
    if (activeTab === 0 && !redisLoading) {
      autoRefreshIntervalRef.current = setInterval(() => {
        fetchRedisUploads();
      }, 30000); // 30 seconds
    }

    return () => {
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current);
        autoRefreshIntervalRef.current = null;
      }
    };
  }, [activeTab, redisLoading, fetchRedisUploads]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (panelCloseTimeoutRef.current) {
        clearTimeout(panelCloseTimeoutRef.current);
      }
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current);
      }
    };
  }, []);

  // Refresh both sources
  const handleRefresh = useCallback(() => {
    fetchRedisUploads();
    fetchDbBoms();
  }, [fetchRedisUploads, fetchDbBoms]);

  // Search handler
  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setPage(0);
      fetchDbBoms();
    }
  };

  // Pagination handlers
  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Action handlers
  const handleStartEnrichment = async (upload: UnifiedUpload) => {
    if (!upload.bomId) {
      showError('No BOM ID available for enrichment');
      return;
    }

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/boms/${upload.bomId}/enrichment/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(getAuthHeaders() || {}) },
        body: JSON.stringify({ tenant_id: tenantId, priority: 7 }),
      });

      if (response.status === 409) {
        showSuccess('Enrichment already in progress');
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || 'Failed to start enrichment');
      }

      showSuccess('Enrichment started successfully!');
      handleRefresh();
    } catch (err) {
      showError(`Failed to start: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleRowClick = (upload: UnifiedUpload) => {
    if (upload.bomId) {
      navigate(`/bom-jobs/${upload.bomId}`);
    }
  };

  const handleSelectLineItem = (lineItem: LineItem, bomName: string) => {
    setSelectedLineItem(lineItem);
    setSelectedBomName(bomName);
    setPanelOpen(true);
  };

  const handleClosePanel = useCallback(() => {
    setPanelOpen(false);
    // Clear any existing timeout to prevent memory leak
    if (panelCloseTimeoutRef.current) {
      clearTimeout(panelCloseTimeoutRef.current);
    }
    // Delay clearing to allow animation
    panelCloseTimeoutRef.current = setTimeout(() => {
      setSelectedLineItem(null);
      setSelectedBomName('');
      panelCloseTimeoutRef.current = null;
    }, 300);
  }, []);

  // Get current data based on tab
  const currentUploads = activeTab === 0 ? redisUploads : dbUploads;
  const currentLoading = activeTab === 0 ? redisLoading : dbLoading;
  const currentError = activeTab === 0 ? redisError : dbError;

  return (
    <>
      <Card>
        <CardContent>
          {/* Header */}
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h5" component="h1">
              All Staff Uploads
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={handleRefresh}
                disabled={currentLoading}
              >
                Refresh
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => navigate('/upload-persisted')}
              >
                New Upload
              </Button>
            </Stack>
          </Box>

          {/* Tabs */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
              <Tab
                label={
                  <Box display="flex" alignItems="center" gap={1}>
                    <RedisIcon fontSize="small" />
                    <span>Active</span>
                    <Badge badgeContent={redisUploads.length} color="info" max={99} />
                  </Box>
                }
              />
              <Tab
                label={
                  <Box display="flex" alignItems="center" gap={1}>
                    <DatabaseIcon fontSize="small" />
                    <span>All BOMs</span>
                    <Badge badgeContent={dbTotalCount} color="default" max={999} />
                  </Box>
                }
              />
            </Tabs>
          </Box>

          {/* Tab descriptions */}
          <Alert severity="info" sx={{ mb: 2 }}>
            {activeTab === 0 ? (
              <>
                <strong>Active Uploads:</strong> Temporary Redis-cached uploads with 24-48h TTL. Click the arrow to expand and view line items.
              </>
            ) : (
              <>
                <strong>All BOMs:</strong> Permanently stored staff BOMs. Expand rows to inspect individual components and their metadata.
              </>
            )}
          </Alert>

          {/* Search (only for database tab) */}
          {activeTab === 1 && (
            <Box mb={2}>
              <TextField
                size="small"
                placeholder="Search by name or filename..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearch}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
                sx={{ width: 300 }}
              />
            </Box>
          )}

          {/* Error */}
          {currentError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => activeTab === 0 ? setRedisError(null) : setDbError(null)}>
              {currentError}
            </Alert>
          )}

          {/* Loading */}
          {currentLoading && <LinearProgress sx={{ mb: 2 }} />}

          {/* Table */}
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 40 }}></TableCell>
                  <TableCell>Name / Filename</TableCell>
                  <TableCell>Source</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Progress</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {currentUploads.length === 0 && !currentLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                      <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
                        <UploadIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
                        <Typography color="text.secondary">
                          {activeTab === 0 ? 'No active uploads in Redis' : 'No staff BOMs found'}
                        </Typography>
                        <Button
                          variant="contained"
                          startIcon={<AddIcon />}
                          onClick={() => navigate('/upload-persisted')}
                        >
                          Upload BOM
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : (
                  currentUploads.map((upload) => (
                    <ExpandableRow
                      key={upload.id}
                      upload={upload}
                      onStartEnrichment={handleStartEnrichment}
                      onRowClick={handleRowClick}
                      onSelectLineItem={handleSelectLineItem}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pagination (only for database tab) */}
          {activeTab === 1 && (
            <TablePagination
              component="div"
              count={dbTotalCount}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[10, 25, 50, 100]}
            />
          )}
        </CardContent>
      </Card>

      {/* Side Panel for Component Details */}
      <ComponentDetailPanel
        open={panelOpen}
        onClose={handleClosePanel}
        lineItem={selectedLineItem}
        bomName={selectedBomName}
      />
    </>
  );
};

export default AllUploads;
