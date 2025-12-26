/**
 * LoadingState - Loading indicators for various contexts
 */
import React from 'react';
import {
  Box,
  CircularProgress,
  Skeleton,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Grid,
} from '@mui/material';

// ============================================================
// Page Loading
// ============================================================
export interface PageLoadingProps {
  message?: string;
  fullHeight?: boolean;
  /** Show as full-screen overlay (for app initialization) */
  fullScreen?: boolean;
  /** Additional subtitle/helper text */
  subtitle?: string;
}

export const PageLoading: React.FC<PageLoadingProps> = ({
  message = 'Loading...',
  fullHeight = true,
  fullScreen = false,
  subtitle,
}) => {
  const content = (
    <Box
      display="flex"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      minHeight={fullScreen ? '100vh' : fullHeight ? '400px' : '200px'}
      gap={2}
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <CircularProgress size={fullScreen ? 50 : 40} />
      <Typography
        color="textSecondary"
        variant={fullScreen ? 'h6' : 'body2'}
        sx={{ fontWeight: fullScreen ? 500 : 400 }}
      >
        {message}
      </Typography>
      {subtitle && (
        <Typography
          color="textSecondary"
          variant="caption"
          sx={{ maxWidth: '400px', textAlign: 'center' }}
        >
          {subtitle}
        </Typography>
      )}
    </Box>
  );

  if (fullScreen) {
    return (
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'background.default',
          zIndex: 9999,
        }}
      >
        {content}
      </Box>
    );
  }

  return content;
};

// ============================================================
// Inline Spinner
// ============================================================
export interface InlineSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: 'primary' | 'secondary' | 'inherit';
}

export const InlineSpinner: React.FC<InlineSpinnerProps> = ({
  size = 'small',
  color = 'primary',
}) => {
  const sizeMap = { small: 16, medium: 24, large: 32 };
  return <CircularProgress size={sizeMap[size]} color={color} />;
};

// ============================================================
// Card Grid Loading
// ============================================================
export interface CardGridLoadingProps {
  count?: number;
  columns?: number;
}

export const CardGridLoading: React.FC<CardGridLoadingProps> = ({
  count = 4,
  columns = 4,
}) => (
  <Grid container spacing={3}>
    {Array.from({ length: count }).map((_, index) => (
      <Grid item xs={12} sm={6} md={12 / columns} key={index}>
        <Card elevation={2}>
          <CardContent>
            <Skeleton variant="text" width="60%" height={20} />
            <Skeleton variant="text" width="40%" height={40} sx={{ mt: 1 }} />
            <Skeleton variant="text" width="80%" height={16} sx={{ mt: 1 }} />
          </CardContent>
        </Card>
      </Grid>
    ))}
  </Grid>
);

// ============================================================
// Table Loading
// ============================================================
export interface TableLoadingProps {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
}

export const TableLoading: React.FC<TableLoadingProps> = ({
  rows = 5,
  columns = 5,
  showHeader = true,
}) => (
  <Table size="small">
    {showHeader && (
      <TableHead>
        <TableRow>
          {Array.from({ length: columns }).map((_, index) => (
            <TableCell key={index}>
              <Skeleton variant="text" width="80%" height={20} />
            </TableCell>
          ))}
        </TableRow>
      </TableHead>
    )}
    <TableBody>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <TableRow key={rowIndex}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <TableCell key={colIndex}>
              <Skeleton variant="text" width={`${60 + Math.random() * 30}%`} height={20} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

// ============================================================
// Section Loading
// ============================================================
export interface SectionLoadingProps {
  height?: number | string;
}

export const SectionLoading: React.FC<SectionLoadingProps> = ({ height = 200 }) => (
  <Box sx={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <CircularProgress />
  </Box>
);

// ============================================================
// Stat Cards Loading
// ============================================================
export interface StatCardsLoadingProps {
  count?: number;
}

export const StatCardsLoading: React.FC<StatCardsLoadingProps> = ({ count = 4 }) => (
  <Grid container spacing={3}>
    {Array.from({ length: count }).map((_, index) => (
      <Grid item xs={12} sm={6} md={3} key={index}>
        <Card elevation={2}>
          <CardContent sx={{ p: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="flex-start">
              <Box flex={1}>
                <Skeleton variant="text" width="70%" height={16} />
                <Skeleton variant="text" width="50%" height={40} sx={{ mt: 1 }} />
                <Skeleton variant="text" width="90%" height={14} sx={{ mt: 1 }} />
              </Box>
              <Skeleton variant="circular" width={48} height={48} />
            </Box>
          </CardContent>
        </Card>
      </Grid>
    ))}
  </Grid>
);

export default {
  PageLoading,
  InlineSpinner,
  CardGridLoading,
  TableLoading,
  SectionLoading,
  StatCardsLoading,
};
