/**
 * BOMUploadStatus Utilities
 *
 * Status indicators, icons, colors, and text for BOM upload states.
 */

import React from 'react';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import DescriptionIcon from '@mui/icons-material/Description';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import { workflowStatusColors } from '../../theme';

// Queue item status type
export type BOMUploadStatusType =
  | 'pending'
  | 'parsing'
  | 'uploading'
  | 'mapping'
  | 'confirming'
  | 'saving'
  | 'completed'
  | 'error';

// Status color mapping
export function getStatusColor(status: BOMUploadStatusType): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' {
  switch (status) {
    case 'completed':
      return 'success';
    case 'error':
      return 'error';
    case 'saving':
    case 'confirming':
      return 'info';
    case 'mapping':
      return 'warning';
    case 'parsing':
    case 'uploading':
      return 'primary';
    default:
      return 'default';
  }
}

// Spinning animation keyframes
const spinAnimation = {
  animation: 'spin 1s linear infinite',
  '@keyframes spin': {
    '0%': { transform: 'rotate(0deg)' },
    '100%': { transform: 'rotate(360deg)' },
  },
};

// Status icon component
export function getStatusIcon(status: BOMUploadStatusType): React.ReactNode {
  switch (status) {
    case 'completed':
      return <CheckCircleIcon sx={{ fontSize: 20, color: 'success.main' }} />;
    case 'error':
      return <ErrorIcon sx={{ fontSize: 20, color: 'error.main' }} />;
    case 'parsing':
    case 'uploading':
    case 'confirming':
    case 'saving':
      return <AutorenewIcon sx={{ fontSize: 20, color: 'info.main', ...spinAnimation }} />;
    case 'mapping':
      return <DescriptionIcon sx={{ fontSize: 20, color: 'warning.main' }} />;
    default:
      return <DescriptionIcon sx={{ fontSize: 20 }} />;
  }
}

// Status text descriptions
export function getStatusText(status: BOMUploadStatusType): string {
  switch (status) {
    case 'pending':
      return 'Ready to upload';
    case 'parsing':
      return 'Parsing file...';
    case 'uploading':
      return 'Uploading to storage...';
    case 'mapping':
      return 'Review column mappings';
    case 'confirming':
      return 'Confirming mappings...';
    case 'saving':
      return 'Saving line items...';
    case 'completed':
      return 'Upload complete';
    case 'error':
      return 'Upload failed';
    default:
      return status;
  }
}

// Status step number (for stepper display)
export function getStatusStep(status: BOMUploadStatusType): number {
  switch (status) {
    case 'pending':
      return 0;
    case 'parsing':
      return 1;
    case 'uploading':
      return 2;
    case 'mapping':
      return 3;
    case 'confirming':
    case 'saving':
      return 4;
    case 'completed':
      return 5;
    case 'error':
      return -1;
    default:
      return 0;
  }
}

// Progress percentage for linear progress
export function getStatusProgress(status: BOMUploadStatusType): number {
  switch (status) {
    case 'pending':
      return 0;
    case 'parsing':
      return 20;
    case 'uploading':
      return 40;
    case 'mapping':
      return 60;
    case 'confirming':
      return 70;
    case 'saving':
      return 85;
    case 'completed':
      return 100;
    case 'error':
      return 0;
    default:
      return 0;
  }
}
