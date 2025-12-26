/**
 * PageHeader - Title, description, refresh button, and filter chips
 */
import React from 'react';
import { Box, Typography, IconButton, Tooltip, Chip, Breadcrumbs, Link } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  showBack?: boolean;
  onBack?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  chips?: Array<{ label: string; color?: 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'success' }>;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  breadcrumbs,
  showBack = false,
  onBack,
  onRefresh,
  refreshing = false,
  chips,
  actions,
}) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <Box mb={3}>
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumbs sx={{ mb: 1 }}>
          {breadcrumbs.map((crumb, index) => (
            crumb.href ? (
              <Link
                key={index}
                color="inherit"
                href={crumb.href}
                underline="hover"
                sx={{ fontSize: '0.875rem' }}
              >
                {crumb.label}
              </Link>
            ) : (
              <Typography key={index} color="textPrimary" sx={{ fontSize: '0.875rem' }}>
                {crumb.label}
              </Typography>
            )
          ))}
        </Breadcrumbs>
      )}

      {/* Title Row */}
      <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
        {showBack && (
          <Tooltip title="Go back">
            <IconButton onClick={handleBack} size="small" sx={{ mr: 1 }}>
              <ArrowBackIcon />
            </IconButton>
          </Tooltip>
        )}

        <Box flex={1}>
          <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
            <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
              {title}
            </Typography>
            {chips && chips.map((chip, index) => (
              <Chip
                key={index}
                label={chip.label}
                size="small"
                color={chip.color || 'default'}
              />
            ))}
          </Box>
          {description && (
            <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
              {description}
            </Typography>
          )}
        </Box>

        {/* Actions */}
        <Box display="flex" alignItems="center" gap={1}>
          {actions}
          {onRefresh && (
            <Tooltip title="Refresh data">
              <IconButton onClick={onRefresh} disabled={refreshing}>
                <RefreshIcon
                  sx={{
                    animation: refreshing ? 'spin 1s linear infinite' : 'none',
                    '@keyframes spin': {
                      '0%': { transform: 'rotate(0deg)' },
                      '100%': { transform: 'rotate(360deg)' },
                    },
                  }}
                />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default PageHeader;
