/**
 * EmptyState Component
 *
 * Reusable empty state component with icon, message, and action button.
 * Used throughout the app to guide users when no data exists.
 */

import React from 'react';
import { Box, Typography, Button, Card, CardContent } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  actionTo?: string;
  actionOnClick?: () => void;
  secondaryActionLabel?: string;
  secondaryActionTo?: string;
  variant?: 'card' | 'inline';
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  actionTo,
  actionOnClick,
  secondaryActionLabel,
  secondaryActionTo,
  variant = 'inline',
}) => {
  const content = (
    <Box
      sx={{
        textAlign: 'center',
        py: variant === 'card' ? 6 : 4,
        px: 2,
      }}
    >
      <Box sx={{ mb: 2, color: 'text.secondary' }}>
        {icon}
      </Box>
      <Typography variant="h6" gutterBottom fontWeight={600}>
        {title}
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mb: 3, maxWidth: 400, mx: 'auto' }}
      >
        {description}
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
        {actionLabel && (actionTo || actionOnClick) && (
          <Button
            component={actionTo ? RouterLink : 'button'}
            to={actionTo}
            onClick={actionOnClick}
            variant="contained"
            size="large"
          >
            {actionLabel}
          </Button>
        )}
        {secondaryActionLabel && secondaryActionTo && (
          <Button
            component={RouterLink}
            to={secondaryActionTo}
            variant="outlined"
            size="large"
          >
            {secondaryActionLabel}
          </Button>
        )}
      </Box>
    </Box>
  );

  if (variant === 'card') {
    return (
      <Card>
        <CardContent>{content}</CardContent>
      </Card>
    );
  }

  return content;
};
