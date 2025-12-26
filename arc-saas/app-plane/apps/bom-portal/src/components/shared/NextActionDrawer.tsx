/**
 * NextActionDrawer Component
 *
 * Contextual action panel drawer for multi-step workflows.
 * Used for mitigation assignment, alert triage, component vaulting.
 *
 * Features:
 * - Slide-out drawer from right edge
 * - Header with title and close button
 * - Form content area
 * - Footer with action buttons
 * - Loading and error states
 */

import React from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Button,
  Divider,
  CircularProgress,
  Alert,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { spacingScale } from '../../theme';

export interface NextActionDrawerProps {
  /** Whether drawer is open */
  open: boolean;
  /** Close handler */
  onClose: () => void;
  /** Drawer title */
  title: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Form content */
  children: React.ReactNode;
  /** Primary action button config */
  primaryAction?: {
    label: string;
    onClick: () => void;
    loading?: boolean;
    disabled?: boolean;
  };
  /** Secondary action button config */
  secondaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
  /** Error message to display */
  error?: string | null;
  /** Success message to display */
  success?: string | null;
  /** Drawer width */
  width?: number | string;
  /** Whether to show a divider above footer */
  showFooterDivider?: boolean;
}

/**
 * NextActionDrawer Component
 */
export function NextActionDrawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  primaryAction,
  secondaryAction,
  error,
  success,
  width = 400,
  showFooterDivider = true,
}: NextActionDrawerProps) {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width,
          maxWidth: '100vw',
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          p: spacingScale.lg,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box>
          <Typography variant="h6" component="h2" fontWeight={600}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{ mt: -0.5, mr: -1 }}
        >
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Content */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          p: spacingScale.lg,
        }}
      >
        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Success Alert */}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        {/* Form Content */}
        {children}
      </Box>

      {/* Footer */}
      {(primaryAction || secondaryAction) && (
        <>
          {showFooterDivider && <Divider />}
          <Box
            sx={{
              display: 'flex',
              gap: 2,
              p: spacingScale.lg,
              justifyContent: 'flex-end',
            }}
          >
            {secondaryAction && (
              <Button
                variant="outlined"
                onClick={secondaryAction.onClick}
                disabled={secondaryAction.disabled}
              >
                {secondaryAction.label}
              </Button>
            )}
            {primaryAction && (
              <Button
                variant="contained"
                onClick={primaryAction.onClick}
                disabled={primaryAction.disabled || primaryAction.loading}
                startIcon={
                  primaryAction.loading ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : null
                }
              >
                {primaryAction.label}
              </Button>
            )}
          </Box>
        </>
      )}
    </Drawer>
  );
}

export default NextActionDrawer;
