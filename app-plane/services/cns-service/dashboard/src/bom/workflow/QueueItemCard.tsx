/**
 * Queue Item Card
 *
 * Displays a single BOM file in the upload queue with:
 * - File info header
 * - Status chip
 * - Progress bar
 * - Column mapping UI (when in mapping state)
 * - Action buttons
 *
 * @module bom/workflow/QueueItemCard
 */

import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Select,
  MenuItem,
  FormControl,
  Chip,
  Divider,
  IconButton,
  Tooltip,
  Collapse,
  LinearProgress,
} from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

// ============================================================
// Types
// ============================================================

export type QueueItemStatus = 'pending' | 'parsing' | 'uploading' | 'mapping' | 'confirming' | 'saving' | 'completed' | 'error';

export interface ColumnMapping {
  source: string;
  target: 'mpn' | 'manufacturer' | 'quantity' | 'reference' | 'description' | 'ignore';
  sampleData?: string[];
}

export interface QueueItem {
  id: string;
  file: File;
  status: QueueItemStatus;
  uploadId?: string;
  bomId?: string;
  totalRows?: number;
  detectedColumns?: Record<string, string>;
  unmappedColumns?: string[];
  previewData?: Array<Record<string, unknown>>;
  error?: string;
  columnMappings?: ColumnMapping[];
  expanded?: boolean;
}

export interface QueueItemCardProps {
  item: QueueItem;
  onToggleExpand: () => void;
  onMappingChange: (source: string, target: string) => void;
  onConfirm: () => void;
  onDelete: () => void;
  onDownload: () => void;
}

// ============================================================
// Constants
// ============================================================

export const TARGET_FIELDS = [
  { value: 'mpn', label: 'Part Number (MPN)', required: true },
  { value: 'manufacturer', label: 'Manufacturer' },
  { value: 'quantity', label: 'Quantity' },
  { value: 'reference', label: 'Reference Designator' },
  { value: 'description', label: 'Description' },
  { value: 'ignore', label: '-- Ignore --' },
];

// ============================================================
// Helper Functions
// ============================================================

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getStatusProgress(status: QueueItemStatus): number {
  switch (status) {
    case 'pending': return 0;
    case 'parsing': return 25;
    case 'uploading': return 50;
    case 'mapping': return 60;
    case 'confirming': return 75;
    case 'saving': return 90;
    case 'completed': return 100;
    case 'error': return 0;
    default: return 0;
  }
}

// ============================================================
// Component
// ============================================================

/**
 * QueueItemCard - Single file in the upload queue
 *
 * Features:
 * - Expandable column mapping section
 * - Status chip with color coding
 * - Progress bar for active states
 * - Error message display
 * - Download and delete actions
 */
export const QueueItemCard: React.FC<QueueItemCardProps> = ({
  item,
  onToggleExpand,
  onMappingChange,
  onConfirm,
  onDelete,
  onDownload,
}) => {
  const getStatusChip = () => {
    const statusConfig: Record<QueueItemStatus, { color: 'default' | 'primary' | 'success' | 'error' | 'warning'; label: string }> = {
      pending: { color: 'default', label: 'Pending' },
      parsing: { color: 'primary', label: 'Parsing...' },
      uploading: { color: 'primary', label: 'Uploading...' },
      mapping: { color: 'warning', label: 'Map Columns' },
      confirming: { color: 'primary', label: 'Confirming...' },
      saving: { color: 'primary', label: 'Saving...' },
      completed: { color: 'success', label: 'Ready' },
      error: { color: 'error', label: 'Error' },
    };
    const config = statusConfig[item.status];
    return <Chip size="small" label={config.label} color={config.color} />;
  };

  const isProcessing = ['parsing', 'uploading', 'confirming', 'saving'].includes(item.status);
  const hasMpnMapping = item.columnMappings?.some(m => m.target === 'mpn');

  return (
    <Paper variant="outlined" sx={{ mb: 2, overflow: 'hidden' }}>
      {/* Header */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          cursor: item.status === 'mapping' ? 'pointer' : 'default',
          '&:hover': item.status === 'mapping' ? { bgcolor: 'action.hover' } : {},
        }}
        onClick={item.status === 'mapping' ? onToggleExpand : undefined}
      >
        <DescriptionIcon color="action" />
        <Box flex={1}>
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="subtitle1" fontWeight={600}>{item.file.name}</Typography>
            {item.totalRows && (
              <Chip size="small" label={`${item.totalRows} rows`} variant="outlined" />
            )}
          </Box>
          <Typography variant="caption" color="text.secondary">
            {formatFileSize(item.file.size)}
          </Typography>
        </Box>
        {getStatusChip()}
        <Box display="flex" gap={0.5}>
          <Tooltip title="Download">
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDownload(); }}>
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {item.status === 'pending' && (
            <Tooltip title="Remove">
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {item.status === 'mapping' && (
            <IconButton size="small">
              {item.expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          )}
        </Box>
      </Box>

      {/* Progress Bar - persist after completion */}
      {(isProcessing || item.status === 'completed') && (
        <LinearProgress
          variant="determinate"
          value={item.status === 'completed' ? 100 : getStatusProgress(item.status)}
          color={item.status === 'completed' ? 'success' : 'primary'}
          sx={{ height: 4 }}
        />
      )}

      {/* Error Message */}
      {item.status === 'error' && item.error && (
        <Alert severity="error" sx={{ mx: 2, mb: 2 }}>
          {item.error}
        </Alert>
      )}

      {/* Column Mapping Section */}
      <Collapse in={item.status === 'mapping' && item.expanded}>
        <Divider />
        <Box sx={{ p: 2, bgcolor: 'grey.50' }}>
          <Typography variant="subtitle2" gutterBottom>Column Mappings</Typography>

          {!hasMpnMapping && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Part Number (MPN) mapping is required
            </Alert>
          )}

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>File Column</strong></TableCell>
                  <TableCell><strong>Sample Data</strong></TableCell>
                  <TableCell><strong>Maps To</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {item.columnMappings?.map((mapping, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{mapping.source}</TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                        {mapping.sampleData?.slice(0, 2).join(', ') || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <FormControl size="small" fullWidth>
                        <Select
                          value={mapping.target}
                          onChange={(e) => onMappingChange(mapping.source, e.target.value)}
                        >
                          {TARGET_FIELDS.map(f => (
                            <MenuItem key={f.value} value={f.value}>
                              {f.label} {f.required && '*'}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={mapping.target === 'ignore' ? 'Ignored' : 'Mapped'}
                        color={mapping.target === 'ignore' ? 'default' : 'success'}
                        variant="outlined"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Box display="flex" justifyContent="flex-end" mt={2}>
            <Button
              variant="contained"
              color="success"
              onClick={onConfirm}
              disabled={!hasMpnMapping}
              startIcon={<PlayArrowIcon />}
            >
              Confirm & Start Enrichment
            </Button>
          </Box>
        </Box>
      </Collapse>
    </Paper>
  );
};

export default QueueItemCard;
