/**
 * LoadingState Component
 *
 * Consistent loading states across the application.
 * Supports various loading patterns: spinner, skeleton, shimmer.
 *
 * Features:
 * - Multiple loading variants (spinner, skeleton, card-skeleton)
 * - Customizable skeleton layouts
 * - Centered and inline modes
 * - Optional loading message
 */

import React from 'react';
import {
  Box,
  CircularProgress,
  Skeleton,
  Typography,
  Card,
  CardContent,
  Grid,
} from '@mui/material';

// Loading variant types
export type LoadingVariant = 'spinner' | 'skeleton' | 'card-skeleton' | 'table-skeleton' | 'inline';

export interface LoadingStateProps {
  /** Loading variant */
  variant?: LoadingVariant;
  /** Optional message to display */
  message?: string;
  /** Height for the container (for skeleton/spinner) */
  height?: string | number;
  /** Number of skeleton rows/cards */
  count?: number;
  /** Number of columns for card skeleton grid */
  columns?: number;
  /** Whether to center the loading indicator */
  centered?: boolean;
  /** Size of the spinner */
  spinnerSize?: number;
}

/**
 * Spinner loading indicator
 */
function SpinnerLoading({
  message,
  height = '200px',
  centered = true,
  spinnerSize = 40,
}: {
  message?: string;
  height?: string | number;
  centered?: boolean;
  spinnerSize?: number;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: centered ? 'center' : 'flex-start',
        justifyContent: centered ? 'center' : 'flex-start',
        height,
        gap: 2,
      }}
    >
      <CircularProgress size={spinnerSize} />
      {message && (
        <Typography variant="body2" color="text.secondary">
          {message}
        </Typography>
      )}
    </Box>
  );
}

/**
 * Inline spinner for button/field loading
 */
function InlineLoading({
  message,
  spinnerSize = 20,
}: {
  message?: string;
  spinnerSize?: number;
}) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1,
      }}
    >
      <CircularProgress size={spinnerSize} />
      {message && (
        <Typography variant="body2" color="text.secondary">
          {message}
        </Typography>
      )}
    </Box>
  );
}

/**
 * Skeleton rows for list/text loading
 */
function SkeletonLoading({
  count = 3,
  height,
}: {
  count?: number;
  height?: string | number;
}) {
  return (
    <Box sx={{ height }}>
      {Array.from({ length: count }).map((_, index) => (
        <Box key={index} sx={{ mb: 2 }}>
          <Skeleton variant="text" width="80%" height={24} />
          <Skeleton variant="text" width="60%" height={20} />
        </Box>
      ))}
    </Box>
  );
}

/**
 * Card skeleton for grid layouts
 */
function CardSkeletonLoading({
  count = 4,
  columns = 4,
}: {
  count?: number;
  columns?: number;
}) {
  // Map columns to grid breakpoints
  const gridSize = Math.floor(12 / columns);

  return (
    <Grid container spacing={2}>
      {Array.from({ length: count }).map((_, index) => (
        <Grid item xs={12} sm={6} md={gridSize} key={index}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Skeleton
                variant="text"
                width="40%"
                height={40}
                sx={{ mx: 'auto', mb: 1 }}
              />
              <Skeleton
                variant="text"
                width="60%"
                height={16}
                sx={{ mx: 'auto' }}
              />
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

/**
 * Table skeleton for data grids
 */
function TableSkeletonLoading({
  count = 5,
}: {
  count?: number;
}) {
  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          py: 1.5,
          px: 2,
          backgroundColor: 'action.hover',
          borderRadius: 1,
          mb: 1,
        }}
      >
        {[20, 30, 25, 15, 10].map((width, i) => (
          <Skeleton key={i} variant="text" width={`${width}%`} height={20} />
        ))}
      </Box>
      {/* Rows */}
      {Array.from({ length: count }).map((_, rowIndex) => (
        <Box
          key={rowIndex}
          sx={{
            display: 'flex',
            gap: 2,
            py: 1.5,
            px: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          {[20, 30, 25, 15, 10].map((width, i) => (
            <Skeleton key={i} variant="text" width={`${width}%`} height={20} />
          ))}
        </Box>
      ))}
    </Box>
  );
}

/**
 * LoadingState Component
 */
export function LoadingState({
  variant = 'spinner',
  message,
  height,
  count,
  columns,
  centered = true,
  spinnerSize,
}: LoadingStateProps) {
  switch (variant) {
    case 'spinner':
      return (
        <SpinnerLoading
          message={message}
          height={height}
          centered={centered}
          spinnerSize={spinnerSize}
        />
      );

    case 'inline':
      return <InlineLoading message={message} spinnerSize={spinnerSize} />;

    case 'skeleton':
      return <SkeletonLoading count={count} height={height} />;

    case 'card-skeleton':
      return <CardSkeletonLoading count={count} columns={columns} />;

    case 'table-skeleton':
      return <TableSkeletonLoading count={count} />;

    default:
      return <SpinnerLoading message={message} height={height} />;
  }
}

// Export specialized variants as separate components
export const PageLoading = ({ message = 'Loading...' }: { message?: string }) => (
  <LoadingState variant="spinner" height="50vh" message={message} />
);

export const CardGridLoading = ({
  count = 4,
  columns = 4,
}: {
  count?: number;
  columns?: number;
}) => <LoadingState variant="card-skeleton" count={count} columns={columns} />;

export const TableLoading = ({ count = 5 }: { count?: number }) => (
  <LoadingState variant="table-skeleton" count={count} />
);

export const InlineSpinner = ({ message }: { message?: string }) => (
  <LoadingState variant="inline" message={message} />
);

export default LoadingState;
