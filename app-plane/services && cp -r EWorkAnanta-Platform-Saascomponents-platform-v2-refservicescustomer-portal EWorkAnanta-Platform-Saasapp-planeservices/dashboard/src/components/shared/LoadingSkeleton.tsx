/**
 * Loading Skeleton Components
 *
 * Placeholder UI components shown during data loading.
 * Provides better UX than spinners by showing content shape.
 *
 * Components:
 * - TableRowSkeleton: Skeleton for table rows
 * - CardSkeleton: Skeleton for stat cards
 * - DetailsSkeleton: Skeleton for detail dialogs
 */

import React from 'react';
import {
  Box,
  Skeleton,
  TableRow,
  TableCell,
  Card,
  CardContent,
  Grid,
} from '@mui/material';

export interface TableRowSkeletonProps {
  /** Number of columns in the table */
  columns: number;
  /** Number of skeleton rows to render */
  rows?: number;
  /** Whether first column is a checkbox */
  hasCheckbox?: boolean;
  /** Custom cell widths (percentage) */
  cellWidths?: number[];
}

/**
 * Skeleton placeholder for table rows.
 * Use while loading table data.
 */
export const TableRowSkeleton: React.FC<TableRowSkeletonProps> = ({
  columns,
  rows = 5,
  hasCheckbox = false,
  cellWidths,
}) => {
  const actualColumns = hasCheckbox ? columns - 1 : columns;
  const defaultWidth = 100 / actualColumns;

  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <TableRow key={rowIndex}>
          {hasCheckbox && (
            <TableCell padding="checkbox">
              <Skeleton variant="rectangular" width={18} height={18} />
            </TableCell>
          )}
          {Array.from({ length: actualColumns }).map((_, colIndex) => (
            <TableCell key={colIndex}>
              <Skeleton
                variant="text"
                width={`${cellWidths?.[colIndex] ?? defaultWidth}%`}
                height={24}
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
};

export interface CardSkeletonProps {
  /** Number of skeleton cards to render */
  count?: number;
}

/**
 * Skeleton placeholder for stat cards.
 * Use while loading dashboard stats.
 */
export const CardSkeleton: React.FC<CardSkeletonProps> = ({
  count = 4,
}) => {
  return (
    <Grid container spacing={2}>
      {Array.from({ length: count }).map((_, index) => (
        <Grid item xs={12} sm={6} md={3} key={index}>
          <Card>
            <CardContent>
              <Skeleton variant="text" width="60%" height={20} />
              <Skeleton variant="text" width="40%" height={36} sx={{ mt: 1 }} />
              <Skeleton variant="text" width="30%" height={16} sx={{ mt: 0.5 }} />
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};

export interface DetailsSkeletonProps {
  /** Number of detail rows */
  rows?: number;
  /** Show image placeholder */
  showImage?: boolean;
}

/**
 * Skeleton placeholder for detail views/dialogs.
 * Use while loading component details.
 */
export const DetailsSkeleton: React.FC<DetailsSkeletonProps> = ({
  rows = 6,
  showImage = false,
}) => {
  return (
    <Box>
      {showImage && (
        <Box mb={2} display="flex" justifyContent="center">
          <Skeleton variant="rectangular" width={200} height={150} />
        </Box>
      )}
      <Grid container spacing={2}>
        {Array.from({ length: rows }).map((_, index) => (
          <Grid item xs={6} key={index}>
            <Skeleton variant="text" width="40%" height={16} />
            <Skeleton variant="text" width="80%" height={24} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export interface QueueRowSkeletonProps {
  /** Number of skeleton rows */
  rows?: number;
}

/**
 * Skeleton specifically for Quality Queue rows.
 */
export const QueueRowSkeleton: React.FC<QueueRowSkeletonProps> = ({
  rows = 5,
}) => {
  return (
    <TableRowSkeleton
      columns={10}
      rows={rows}
      hasCheckbox={true}
      cellWidths={[15, 12, 12, 8, 8, 15, 10, 8, 12]}
    />
  );
};

export interface EnrichmentRowSkeletonProps {
  /** Number of skeleton rows */
  rows?: number;
}

/**
 * Skeleton specifically for Enrichment Monitor rows.
 */
export const EnrichmentRowSkeleton: React.FC<EnrichmentRowSkeletonProps> = ({
  rows = 5,
}) => {
  return (
    <TableRowSkeleton
      columns={10}
      rows={rows}
      hasCheckbox={true}
      cellWidths={[20, 8, 8, 15, 8, 8, 8, 12, 13]}
    />
  );
};

export default TableRowSkeleton;
