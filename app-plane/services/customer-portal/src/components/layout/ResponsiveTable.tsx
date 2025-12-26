import React from 'react';
import { Box, Card, CardContent, Typography, Chip } from '@mui/material';
import { DataGrid, GridColDef, GridRowsProp } from '@mui/x-data-grid';
import { useTouchDevice } from '../../hooks/useTouchDevice';
import { useOrientation } from '../../hooks/useOrientation';

export interface ResponsiveTableProps {
  rows: GridRowsProp;
  columns: GridColDef[];
  onRowClick?: (row: any) => void;
  renderCard?: (row: any) => React.ReactNode;
  loading?: boolean;
  className?: string;
}

/**
 * ResponsiveTable - Switches between table and card views
 *
 * Desktop: Traditional DataGrid table
 * Tablet: Card grid (2 columns landscape, 1 column portrait)
 * Mobile: Full-width cards
 *
 * @example
 * <ResponsiveTable
 *   rows={bomData}
 *   columns={columnDefs}
 *   onRowClick={handleRowClick}
 *   renderCard={(row) => <BOMCard data={row} />}
 * />
 */
export const ResponsiveTable: React.FC<ResponsiveTableProps> = ({
  rows,
  columns,
  onRowClick,
  renderCard,
  loading = false,
  className = '',
}) => {
  const { isTablet, isMobile, isDesktop } = useTouchDevice();
  const { isLandscape } = useOrientation();

  // Desktop view - traditional table
  if (isDesktop) {
    return (
      <Box className={`desktop-table ${className}`}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          onRowClick={onRowClick ? (params) => onRowClick(params.row) : undefined}
          autoHeight
          disableRowSelectionOnClick
          sx={{
            '& .MuiDataGrid-cell': {
              cursor: onRowClick ? 'pointer' : 'default',
            },
          }}
        />
      </Box>
    );
  }

  // Tablet/Mobile view - card grid
  const gridColumns = isTablet && isLandscape ? 2 : 1;

  return (
    <Box
      className={`tablet-card-view ${className}`}
      sx={{
        display: 'grid',
        gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
        gap: 2,
        width: '100%',
      }}
    >
      {loading ? (
        // Loading skeleton
        Array.from({ length: 6 }).map((_, idx) => (
          <Card key={idx} className="tablet-skeleton" sx={{ height: 120 }} />
        ))
      ) : rows.length === 0 ? (
        // Empty state
        <Box sx={{ gridColumn: '1 / -1', textAlign: 'center', py: 4 }}>
          <Typography variant="body1" color="textSecondary">
            No data available
          </Typography>
        </Box>
      ) : (
        // Data cards
        rows.map((row) => (
          <Card
            key={row.id}
            onClick={() => onRowClick?.(row)}
            sx={{
              cursor: onRowClick ? 'pointer' : 'default',
              transition: 'all 0.2s',
              '&:hover': onRowClick
                ? {
                    boxShadow: 3,
                    transform: 'translateY(-2px)',
                  }
                : {},
            }}
          >
            <CardContent>
              {renderCard ? (
                renderCard(row)
              ) : (
                // Default card rendering
                <DefaultCardContent row={row} columns={columns} />
              )}
            </CardContent>
          </Card>
        ))
      )}
    </Box>
  );
};

/**
 * Default card content when no custom renderer provided
 */
const DefaultCardContent: React.FC<{ row: any; columns: GridColDef[] }> = ({
  row,
  columns,
}) => {
  return (
    <Box>
      {columns.slice(0, 5).map((col) => {
        const value = row[col.field];
        const displayValue = col.valueFormatter
          ? (col.valueFormatter as (value: unknown) => string)(value)
          : value;

        return (
          <Box key={col.field} sx={{ mb: 1 }}>
            <Typography variant="caption" color="textSecondary">
              {col.headerName || col.field}
            </Typography>
            <Typography variant="body2">
              {typeof displayValue === 'string' ? (
                displayValue
              ) : (
                <Chip label={String(displayValue)} size="small" />
              )}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
};

export default ResponsiveTable;
