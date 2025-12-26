/**
 * DataTable Component
 *
 * Generic key-value table with consistent styling.
 * Used for displaying structured data in a readable format.
 */
import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
  TableContainer,
  Paper,
  Typography,
  Box,
} from '@mui/material';

export interface DataTableRow {
  /** Label for the row */
  label: string;
  /** Value to display (can be string, number, or React node) */
  value: React.ReactNode;
  /** Optional tooltip for the label */
  tooltip?: string;
  /** Whether to show this row (default: true) */
  show?: boolean;
  /** Whether the value is monospace (for IDs, codes, etc.) */
  monospace?: boolean;
}

export interface DataTableProps {
  /** Array of data rows */
  data: DataTableRow[];
  /** Dense mode for compact display (default: true) */
  dense?: boolean;
  /** Whether to show in Paper wrapper (default: false) */
  paper?: boolean;
  /** Title for the table */
  title?: string;
  /** Empty state message */
  emptyMessage?: string;
}

export const DataTable: React.FC<DataTableProps> = ({
  data,
  dense = true,
  paper = false,
  title,
  emptyMessage = 'No data available',
}) => {
  // Filter to only show visible rows
  const visibleRows = data.filter((row) => row.show !== false && row.value !== undefined && row.value !== null);

  if (visibleRows.length === 0) {
    return (
      <Box sx={{ py: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          {emptyMessage}
        </Typography>
      </Box>
    );
  }

  const tableContent = (
    <>
      {title && (
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 600,
            mb: 1.5,
            color: 'text.primary',
          }}
        >
          {title}
        </Typography>
      )}
      <TableContainer>
        <Table size={dense ? 'small' : 'medium'}>
          <TableBody>
            {visibleRows.map((row, index) => (
              <TableRow
                key={row.label}
                sx={{
                  '&:last-child td, &:last-child th': { border: 0 },
                  '@media print': {
                    '& td': { py: 0.5, fontSize: '0.75rem' },
                  },
                }}
              >
                <TableCell
                  component="th"
                  scope="row"
                  sx={{
                    fontWeight: 500,
                    color: 'text.secondary',
                    width: '40%',
                    py: dense ? 1 : 1.5,
                    verticalAlign: 'top',
                  }}
                >
                  {row.label}
                </TableCell>
                <TableCell
                  sx={{
                    py: dense ? 1 : 1.5,
                    fontFamily: row.monospace ? 'monospace' : 'inherit',
                    fontSize: row.monospace ? '0.85rem' : 'inherit',
                    wordBreak: 'break-word',
                  }}
                >
                  {row.value}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );

  if (paper) {
    return (
      <Paper variant="outlined" sx={{ p: 2 }}>
        {tableContent}
      </Paper>
    );
  }

  return tableContent;
};

/**
 * Helper function to create a DataTableRow with conditional visibility
 */
export const createRow = (
  label: string,
  value: React.ReactNode,
  options?: { monospace?: boolean; tooltip?: string }
): DataTableRow => ({
  label,
  value,
  show: value !== undefined && value !== null && value !== '',
  ...options,
});

export default DataTable;
