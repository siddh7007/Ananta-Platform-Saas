/**
 * MobileBOMDropzone Component
 *
 * P1-5: Mobile-optimized BOM file upload with touch-friendly interactions.
 * Provides larger touch targets, camera capture option, and responsive layout.
 */

import React, { useCallback, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Paper,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  useMediaQuery,
  useTheme,
  Alert,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DescriptionIcon from '@mui/icons-material/Description';
import AddIcon from '@mui/icons-material/Add';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import TableChartIcon from '@mui/icons-material/TableChart';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useDropzone, Accept } from 'react-dropzone';
import { TouchTarget } from './TouchTarget';

export interface MobileBOMDropzoneProps {
  /** Callback when files are added */
  onFilesAdded: (files: File[]) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Number of files currently in queue */
  filesInQueue?: number;
  /** Total rows across all queued files */
  totalRows?: number;
  /** List of file names in queue (for removal) */
  queuedFileNames?: string[];
  /** Callback to remove a file from queue */
  onRemoveFile?: (filename: string) => void;
  /** Show camera capture option (for mobile photo of paper BOMs) */
  showCameraOption?: boolean;
  /** Test ID */
  'data-testid'?: string;
}

// Accepted file types
const ACCEPTED_FILES: Accept = {
  'text/csv': ['.csv'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
};

// Camera accepts images
const CAMERA_ACCEPTS: Accept = {
  'image/*': ['.jpg', '.jpeg', '.png', '.heic'],
};

// H2 Fix: File size constants
const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/**
 * Mobile-optimized BOM file upload dropzone
 */
export function MobileBOMDropzone({
  onFilesAdded,
  disabled = false,
  filesInQueue = 0,
  totalRows = 0,
  queuedFileNames = [],
  onRemoveFile,
  showCameraOption = true,
  'data-testid': testId,
}: MobileBOMDropzoneProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [cameraProcessing, setCameraProcessing] = useState(false);
  // H2 Fix: Add error state for file validation
  const [fileError, setFileError] = useState<string | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      // H2 Fix: Validate file sizes before accepting
      setFileError(null);

      const validFiles: File[] = [];
      const oversizedFiles: string[] = [];

      for (const file of acceptedFiles) {
        if (file.size > MAX_FILE_SIZE_BYTES) {
          oversizedFiles.push(`${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
        } else {
          validFiles.push(file);
        }
      }

      if (oversizedFiles.length > 0) {
        setFileError(`Files exceed ${MAX_FILE_SIZE_MB}MB limit: ${oversizedFiles.join(', ')}`);
      }

      if (validFiles.length > 0) {
        onFilesAdded(validFiles);
        setUploadDialogOpen(false);
      }
    },
    [onFilesAdded]
  );

  const { getRootProps, getInputProps, isDragActive, open: openFilePicker } = useDropzone({
    onDrop,
    accept: ACCEPTED_FILES,
    multiple: true,
    disabled,
    noClick: isMobile, // On mobile, use dialog instead of direct click
    noKeyboard: false,
  });

  // M2 Fix: Track timeout for cleanup
  const cameraTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (cameraTimeoutRef.current) {
        clearTimeout(cameraTimeoutRef.current);
      }
    };
  }, []);

  // Camera capture handler (for OCR processing)
  const handleCameraCapture = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      setCameraProcessing(true);
      setUploadDialogOpen(false);

      // In production, this would process the image through OCR
      // For now, we'll show an alert that this feature needs backend support
      try {
        // M2 Fix: Store timeout reference for cleanup
        await new Promise<void>((resolve) => {
          cameraTimeoutRef.current = setTimeout(resolve, 1500);
        });

        // TODO: Send to OCR backend endpoint
        // const result = await ocrApi.processImage(files[0]);
        // onFilesAdded(result.extractedFile);

        console.log('[MobileBOMDropzone] Camera capture received:', files[0].name);
        // For demo, show that the image was captured but can't be processed yet
      } catch (error) {
        console.error('[MobileBOMDropzone] Camera processing error:', error);
      } finally {
        setCameraProcessing(false);
        cameraTimeoutRef.current = null;
      }
    },
    []
  );

  const hasFiles = filesInQueue > 0;

  // Mobile upload dialog
  const renderUploadDialog = () => (
    <Dialog
      open={uploadDialogOpen}
      onClose={() => setUploadDialogOpen(false)}
      fullWidth
      maxWidth="xs"
      PaperProps={{
        sx: { borderRadius: 3 },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="h6" fontWeight={600}>
          Add BOM Files
        </Typography>
      </DialogTitle>
      <DialogContent>
        <List sx={{ pt: 0 }}>
          {/* File Picker Option */}
          <ListItem
            component="div"
            onClick={() => {
              setUploadDialogOpen(false);
              openFilePicker();
            }}
            sx={{
              borderRadius: 2,
              mb: 1,
              minHeight: 64,
              cursor: 'pointer',
              '&:hover': { bgcolor: 'action.hover' },
              '&:active': { bgcolor: 'action.selected' },
            }}
          >
            <ListItemIcon>
              <FolderOpenIcon color="primary" sx={{ fontSize: 28 }} />
            </ListItemIcon>
            <ListItemText
              primary={<Typography fontWeight={500}>Browse Files</Typography>}
              secondary="CSV, Excel (.xlsx, .xls)"
            />
          </ListItem>

          {/* Recent Files Option - could be implemented later */}
          <ListItem
            component="div"
            sx={{
              borderRadius: 2,
              mb: 1,
              minHeight: 64,
              cursor: 'pointer',
              '&:hover': { bgcolor: 'action.hover' },
              '&:active': { bgcolor: 'action.selected' },
            }}
          >
            <ListItemIcon>
              <TableChartIcon color="action" sx={{ fontSize: 28 }} />
            </ListItemIcon>
            <ListItemText
              primary={<Typography fontWeight={500}>Recent BOMs</Typography>}
              secondary="Quick access to recent uploads"
            />
          </ListItem>

          {/* Camera Capture Option */}
          {showCameraOption && (
            <ListItem
              component="label"
              sx={{
                borderRadius: 2,
                minHeight: 64,
                cursor: 'pointer',
                '&:hover': { bgcolor: 'action.hover' },
                '&:active': { bgcolor: 'action.selected' },
              }}
            >
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleCameraCapture}
                style={{ display: 'none' }}
              />
              <ListItemIcon>
                <PhotoCameraIcon color="action" sx={{ fontSize: 28 }} />
              </ListItemIcon>
              <ListItemText
                primary={<Typography fontWeight={500}>Take Photo</Typography>}
                secondary="Capture paper BOM (OCR coming soon)"
              />
            </ListItem>
          )}
        </List>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={() => setUploadDialogOpen(false)} color="inherit">
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );

  // Camera processing overlay
  const renderCameraProcessing = () => (
    <Dialog open={cameraProcessing} PaperProps={{ sx: { borderRadius: 3, p: 2 } }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, p: 2 }}>
        <CircularProgress />
        <Typography variant="body1">Processing image...</Typography>
        <Typography variant="caption" color="text.secondary">
          OCR feature coming soon
        </Typography>
      </Box>
    </Dialog>
  );

  // File queue list (mobile)
  const renderFileQueue = () => {
    if (!isMobile || queuedFileNames.length === 0) return null;

    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
          Queued Files
        </Typography>
        {queuedFileNames.map((filename) => (
          <Box
            key={filename}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              py: 1,
              px: 1.5,
              mb: 1,
              bgcolor: 'action.hover',
              borderRadius: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
              <DescriptionIcon color="success" fontSize="small" />
              <Typography variant="body2" noWrap sx={{ maxWidth: 180 }}>
                {filename}
              </Typography>
            </Box>
            {onRemoveFile && (
              <TouchTarget
                onClick={() => onRemoveFile(filename)}
                aria-label={`Remove ${filename}`}
                minSize={40}
                sx={{ color: 'error.main' }}
              >
                <DeleteOutlineIcon fontSize="small" />
              </TouchTarget>
            )}
          </Box>
        ))}
      </Box>
    );
  };

  return (
    <Card sx={{ mb: 3 }} data-testid={testId}>
      <CardContent sx={{ pb: isMobile ? 2 : 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          {hasFiles ? (
            <CheckCircleIcon color="success" sx={{ fontSize: 24 }} />
          ) : (
            <CloudUploadIcon color="action" sx={{ fontSize: 24 }} />
          )}
          <Typography variant="h6">
            {hasFiles ? 'Files Selected' : 'Upload BOM'}
          </Typography>
          {hasFiles && (
            <Chip
              label={`${filesInQueue} file${filesInQueue > 1 ? 's' : ''}`}
              color="success"
              size="small"
              variant="outlined"
            />
          )}
        </Box>

        {/* Dropzone Area */}
        <Paper
          {...getRootProps()}
          sx={{
            p: isMobile ? 3 : 4,
            border: '2px dashed',
            borderColor: hasFiles
              ? 'success.main'
              : isDragActive
              ? 'primary.main'
              : 'divider',
            bgcolor: hasFiles
              ? 'success.50'
              : isDragActive
              ? 'action.hover'
              : 'background.paper',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.6 : 1,
            textAlign: 'center',
            transition: 'all 0.2s ease',
            borderRadius: 2,
            '&:hover': disabled
              ? {}
              : {
                  borderColor: hasFiles ? 'success.dark' : 'primary.main',
                  bgcolor: hasFiles ? 'success.100' : 'action.hover',
                },
          }}
          onClick={isMobile ? () => setUploadDialogOpen(true) : undefined}
        >
          <input {...getInputProps()} />

          {hasFiles ? (
            // Files selected state
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <DescriptionIcon color="success" sx={{ fontSize: 32 }} />
                <Typography variant="h6" color="success.dark" fontWeight={500}>
                  {filesInQueue} file{filesInQueue > 1 ? 's' : ''} ready
                  {totalRows > 0 && ` • ${totalRows.toLocaleString()} rows`}
                </Typography>
              </Box>
              <TouchTarget
                onClick={(e) => {
                  e.stopPropagation();
                  if (isMobile) {
                    setUploadDialogOpen(true);
                  } else {
                    openFilePicker();
                  }
                }}
                variant="outlined"
                color="success"
                aria-label="Add more files"
              >
                <AddIcon />
                <Typography variant="body2" fontWeight={500}>
                  Add more files
                </Typography>
              </TouchTarget>
            </Box>
          ) : (
            // Empty state
            <>
              <CloudUploadIcon
                sx={{
                  fontSize: isMobile ? 56 : 64,
                  color: isDragActive ? 'primary.main' : 'action.active',
                  mb: 2,
                }}
              />
              <Typography variant="h6" gutterBottom>
                {isDragActive
                  ? 'Drop files here...'
                  : isMobile
                  ? 'Tap to upload BOM files'
                  : 'Drag & drop BOM files here'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: isMobile ? 2 : 0 }}>
                {isMobile
                  ? 'CSV, Excel files supported'
                  : 'or click to browse • Supports CSV, Excel (.xlsx, .xls)'}
              </Typography>

              {/* Mobile-specific larger button */}
              {isMobile && (
                <TouchTarget
                  onClick={(e) => {
                    e.stopPropagation();
                    setUploadDialogOpen(true);
                  }}
                  variant="filled"
                  color="primary"
                  fullWidth
                  aria-label="Select files to upload"
                  sx={{ mt: 2, py: 2 }}
                >
                  <CloudUploadIcon />
                  <Typography variant="body1" fontWeight={600}>
                    Select Files
                  </Typography>
                </TouchTarget>
              )}
            </>
          )}
        </Paper>

        {/* H2 Fix: File error alert */}
        {fileError && (
          <Alert
            severity="error"
            onClose={() => setFileError(null)}
            sx={{ mt: 2, borderRadius: 2 }}
          >
            {fileError}
          </Alert>
        )}

        {/* Mobile file queue */}
        {renderFileQueue()}

        {/* Upload options dialog */}
        {renderUploadDialog()}

        {/* Camera processing overlay */}
        {renderCameraProcessing()}
      </CardContent>
    </Card>
  );
}

export default MobileBOMDropzone;
