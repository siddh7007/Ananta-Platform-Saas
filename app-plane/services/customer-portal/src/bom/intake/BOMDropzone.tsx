/**
 * BOMDropzone Component
 *
 * File dropzone for BOM uploads with drag-and-drop support.
 * Accepts CSV and Excel files.
 * Shows different states: empty, files selected, processing.
 */

import React, { useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Paper,
  Chip,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DescriptionIcon from '@mui/icons-material/Description';
import AddIcon from '@mui/icons-material/Add';
import { useDropzone, Accept } from 'react-dropzone';

interface BOMDropzoneProps {
  onFilesAdded: (files: File[]) => void;
  disabled?: boolean;
  /** Number of files currently in queue */
  filesInQueue?: number;
  /** Total rows across all queued files */
  totalRows?: number;
}

// Accepted file types
const ACCEPTED_FILES: Accept = {
  'text/csv': ['.csv'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
};

export function BOMDropzone({
  onFilesAdded,
  disabled = false,
  filesInQueue = 0,
  totalRows = 0,
}: BOMDropzoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFilesAdded(acceptedFiles);
      }
    },
    [onFilesAdded]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_FILES,
    multiple: true,
    disabled,
  });

  const hasFiles = filesInQueue > 0;

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          {hasFiles ? (
            <CheckCircleIcon color="success" sx={{ fontSize: 20 }} />
          ) : (
            <CloudUploadIcon color="action" sx={{ fontSize: 20 }} />
          )}
          <Typography variant="h6">
            {hasFiles ? 'Files Selected' : 'Select Files'}
          </Typography>
          {hasFiles && (
            <Chip
              label={`${filesInQueue} file${filesInQueue > 1 ? 's' : ''} ready`}
              color="success"
              size="small"
              variant="outlined"
            />
          )}
        </Box>

        <Paper
          {...getRootProps()}
          sx={{
            p: hasFiles ? 2 : 4,
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
            '&:hover': disabled
              ? {}
              : {
                  borderColor: hasFiles ? 'success.dark' : 'primary.main',
                  bgcolor: hasFiles ? 'success.100' : 'action.hover',
                },
          }}
        >
          <input {...getInputProps()} />

          {hasFiles ? (
            // Files selected state - compact view
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <DescriptionIcon color="success" />
                <Typography variant="body1" color="success.dark" fontWeight={500}>
                  {filesInQueue} file{filesInQueue > 1 ? 's' : ''} queued
                  {totalRows > 0 && ` (${totalRows.toLocaleString()} rows)`}
                </Typography>
              </Box>
              <Chip
                icon={<AddIcon />}
                label="Add more files"
                variant="outlined"
                size="small"
                sx={{ cursor: 'pointer' }}
              />
            </Box>
          ) : (
            // Empty state - full dropzone
            <>
              <CloudUploadIcon
                sx={{
                  fontSize: 64,
                  color: isDragActive ? 'primary.main' : 'action.active',
                  mb: 2,
                }}
              />
              <Typography variant="h6" gutterBottom>
                {isDragActive ? 'Drop files here...' : 'Drag & drop BOM files here'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                or click to browse • Supports CSV, Excel (.xlsx, .xls)
              </Typography>
            </>
          )}
        </Paper>
      </CardContent>
    </Card>
  );
}

export default BOMDropzone;
