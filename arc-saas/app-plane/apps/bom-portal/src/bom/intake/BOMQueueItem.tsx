/**
 * BOMQueueItem Component
 *
 * Individual queue item display with status indicators.
 * Shows file info, status, and actions based on current state.
 */

import React, { useCallback } from 'react';
import {
  Box,
  ListItem,
  ListItemText,
  Typography,
  Chip,
  Alert,
  Button,
  LinearProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import ErrorIcon from '@mui/icons-material/Error';
import RefreshIcon from '@mui/icons-material/Refresh';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  BOMUploadStatusType,
  getStatusIcon,
  getStatusColor,
  getStatusText,
  getStatusProgress,
} from './BOMUploadStatus';
import { BOMColumnMapper } from './BOMColumnMapper';
import { BOMUploadComplete } from './BOMUploadComplete';
import type { ColumnMapping } from '../../utils/bomParser';

// Queue item data structure
export interface QueueItemData {
  file: File;
  status: BOMUploadStatusType;
  uploadId?: string;
  bomId?: string;
  s3Key?: string;
  error?: string;
  totalRows?: number;
  previewData?: Record<string, unknown>[];
  allRows?: Record<string, unknown>[];
  columnMappings?: ColumnMapping[];
  unmappedColumns?: string[];
}

interface BOMQueueItemProps {
  item: QueueItemData;
  index: number;
  showDebugIds?: boolean;
  onMappingChange: (index: number, sourceColumn: string, targetField: string) => void;
  onConfirmMappings: (index: number) => void;
  onStartEnrichment: (index: number) => void;
  onRetry: (index: number) => void;
  onSkip: () => void;
  onViewDetails: (uploadId: string) => void;
  onRemove?: (index: number) => void;
}

export function BOMQueueItem({
  item,
  index,
  showDebugIds = false,
  onMappingChange,
  onConfirmMappings,
  onStartEnrichment,
  onRetry,
  onSkip,
  onViewDetails,
  onRemove,
}: BOMQueueItemProps) {
  const isProcessing = ['parsing', 'uploading', 'confirming', 'saving'].includes(item.status);
  const progress = getStatusProgress(item.status);

  // Helper to download from local File object
  const downloadLocalFile = useCallback(() => {
    if (!item.file || item.file.size === 0) return;

    const url = URL.createObjectURL(item.file);
    const link = document.createElement('a');
    link.href = url;
    link.download = item.file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [item.file]);

  // Download original file - from local File object or S3
  const handleDownload = useCallback(async () => {
    // If we have an uploadId, file is in S3 - get presigned URL
    if (item.uploadId) {
      try {
        const { getCnsBaseUrl, getAuthHeaders } = await import('../../services/cnsApi');
        const headers = await getAuthHeaders();
        const response = await fetch(
          `${getCnsBaseUrl()}/api/customer/download/${item.uploadId}`,
          { headers }
        );

        if (!response.ok) {
          console.error('[Download] Failed to get download URL:', response.status);
          // Fall back to local file if available
          if (item.file && item.file.size > 0) {
            downloadLocalFile();
          }
          return;
        }

        const data = await response.json();
        // Open the presigned URL in new tab or trigger download
        const link = document.createElement('a');
        link.href = data.download_url;
        link.download = data.filename || item.file?.name || 'bom_file';
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (err) {
        console.error('[Download] Error fetching S3 URL:', err);
        // Fall back to local file if available
        if (item.file && item.file.size > 0) {
          downloadLocalFile();
        }
      }
      return;
    }

    // Local file download (before upload to S3)
    downloadLocalFile();
  }, [item.uploadId, item.file, downloadLocalFile]);

  return (
    <React.Fragment>
      {/* Main List Item */}
      <ListItem
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          mb: 1,
          bgcolor: item.status === 'mapping' ? 'warning.50' : 'background.paper',
          flexDirection: 'column',
          alignItems: 'stretch',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
          <Box sx={{ mr: 2 }}>{getStatusIcon(item.status)}</Box>
          <ListItemText
            primary={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" fontWeight={600}>
                  {item.file.name}
                </Typography>
                {item.totalRows && (
                  <Chip label={`${item.totalRows} rows`} size="small" variant="outlined" />
                )}
              </Box>
            }
            secondary={
              <Typography variant="caption" color="text.secondary">
                {getStatusText(item.status)}
                {showDebugIds && item.uploadId && ` • ID: ${item.uploadId.substring(0, 8)}`}
              </Typography>
            }
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Chip
              label={item.status}
              color={getStatusColor(item.status)}
              size="small"
              sx={{ textTransform: 'capitalize' }}
            />

            {/* Download original file button */}
            <Tooltip title="Download original file">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload();
                }}
                disabled={!item.file || item.file.size === 0}
              >
                <DownloadIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            {/* Remove from queue button - only for pending items */}
            {item.status === 'pending' && onRemove && (
              <Tooltip title="Remove from queue">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(index);
                  }}
                  color="error"
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>

        {/* Progress bar - visible during processing and after completion */}
        {(isProcessing || item.status === 'completed') && (
          <Box sx={{ width: '100%', mt: 1 }}>
            <LinearProgress
              variant="determinate"
              value={item.status === 'completed' ? 100 : progress}
              color={item.status === 'completed' ? 'success' : 'primary'}
              sx={{ height: 4, borderRadius: 1 }}
            />
          </Box>
        )}
      </ListItem>

      {/* Column Mapping Editor */}
      {item.status === 'mapping' &&
        item.columnMappings &&
        item.uploadId &&
        item.previewData && (
          <Box px={2} pb={2}>
            <BOMColumnMapper
              filename={item.file.name}
              totalRows={item.totalRows || 0}
              columnMappings={item.columnMappings}
              previewData={item.previewData}
              onMappingChange={(source, target) => onMappingChange(index, source, target)}
              onConfirm={() => onConfirmMappings(index)}
            />
          </Box>
        )}

      {/* Success Display with Enrichment Prompt */}
      {item.status === 'completed' && item.uploadId && (
        <BOMUploadComplete
          filename={item.file.name}
          totalRows={item.totalRows || 0}
          uploadId={item.uploadId}
          bomId={item.bomId}
          onStartEnrichment={() => onStartEnrichment(index)}
          onSkip={onSkip}
          onViewDetails={() => onViewDetails(item.uploadId!)}
        />
      )}

      {/* Error Display */}
      {item.error && (
        <Alert severity="error" sx={{ mx: 2, mb: 1 }} icon={<ErrorIcon />}>
          <Box>
            <Typography variant="body2" fontWeight={600} gutterBottom>
              Upload Failed: {item.file.name}
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {item.error}
            </Typography>
            <Box sx={{ mt: 1 }}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => onRetry(index)}
                startIcon={<RefreshIcon />}
              >
                Retry
              </Button>
            </Box>
          </Box>
        </Alert>
      )}
    </React.Fragment>
  );
}

export default BOMQueueItem;
