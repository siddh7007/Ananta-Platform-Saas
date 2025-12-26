/**
 * EmptyState - Consistent empty state with icon and action
 */
import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import InboxIcon from '@mui/icons-material/Inbox';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

export type EmptyStateVariant = 'empty' | 'no-results' | 'upload' | 'error' | 'success';

export interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  compact?: boolean;
}

const variantConfig: Record<EmptyStateVariant, { icon: React.ReactNode; title: string; description: string }> = {
  empty: {
    icon: <InboxIcon sx={{ fontSize: 64, color: 'action.disabled' }} />,
    title: 'No data yet',
    description: 'There is nothing to display at the moment.',
  },
  'no-results': {
    icon: <SearchOffIcon sx={{ fontSize: 64, color: 'action.disabled' }} />,
    title: 'No results found',
    description: 'Try adjusting your search or filter criteria.',
  },
  upload: {
    icon: <CloudUploadIcon sx={{ fontSize: 64, color: 'action.disabled' }} />,
    title: 'No files uploaded',
    description: 'Upload a file to get started.',
  },
  error: {
    icon: <ErrorOutlineIcon sx={{ fontSize: 64, color: 'error.main' }} />,
    title: 'Something went wrong',
    description: 'An error occurred while loading data.',
  },
  success: {
    icon: <CheckCircleOutlineIcon sx={{ fontSize: 64, color: 'success.main' }} />,
    title: 'All done!',
    description: 'Everything has been processed successfully.',
  },
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  variant = 'empty',
  title,
  description,
  icon,
  action,
  compact = false,
}) => {
  const config = variantConfig[variant];

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      textAlign="center"
      py={compact ? 4 : 8}
      px={3}
    >
      <Box mb={2}>{icon || config.icon}</Box>
      <Typography
        variant={compact ? 'h6' : 'h5'}
        color="textPrimary"
        gutterBottom
        sx={{ fontWeight: 600 }}
      >
        {title || config.title}
      </Typography>
      <Typography
        variant="body2"
        color="textSecondary"
        sx={{ maxWidth: 400, mb: action ? 3 : 0 }}
      >
        {description || config.description}
      </Typography>
      {action && (
        <Button
          variant="contained"
          color="primary"
          onClick={action.onClick}
          sx={{ mt: 2 }}
        >
          {action.label}
        </Button>
      )}
    </Box>
  );
};

// Convenience components
export const NoDataState: React.FC<Omit<EmptyStateProps, 'variant'>> = (props) => (
  <EmptyState variant="empty" {...props} />
);

export const NoResultsState: React.FC<Omit<EmptyStateProps, 'variant'>> = (props) => (
  <EmptyState variant="no-results" {...props} />
);

export const UploadPromptState: React.FC<Omit<EmptyStateProps, 'variant'>> = (props) => (
  <EmptyState variant="upload" {...props} />
);

export const ErrorState: React.FC<Omit<EmptyStateProps, 'variant'>> = (props) => (
  <EmptyState variant="error" {...props} />
);

export const SuccessState: React.FC<Omit<EmptyStateProps, 'variant'>> = (props) => (
  <EmptyState variant="success" {...props} />
);

export default EmptyState;
