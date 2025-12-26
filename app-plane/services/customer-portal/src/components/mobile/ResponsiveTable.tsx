/**
 * ResponsiveTable Component
 *
 * P1-5: Table that transforms to card layout on mobile/tablet.
 * Provides consistent responsive behavior for data tables.
 */

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Chip,
  Collapse,
  IconButton,
  useMediaQuery,
  useTheme,
  SxProps,
  Theme,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

export interface ResponsiveTableColumn<T> {
  /** Unique key for the column */
  key: string;
  /** Header label */
  header: string;
  /** Render function for cell content */
  render: (row: T, index: number) => React.ReactNode;
  /** Priority for mobile display (1 = always show, 2 = show in expanded, 3 = hide on mobile) */
  priority?: 1 | 2 | 3;
  /** Width for desktop table */
  width?: string | number;
  /** Alignment */
  align?: 'left' | 'center' | 'right';
  /** Make this column the card title on mobile */
  isTitle?: boolean;
  /** Make this column the card subtitle on mobile */
  isSubtitle?: boolean;
}

export interface ResponsiveTableProps<T> {
  /** Data rows */
  data: T[];
  /** Column definitions */
  columns: ResponsiveTableColumn<T>[];
  /** Unique key extractor for each row */
  getRowKey: (row: T, index: number) => string;
  /** Breakpoint to switch to card view (default: 'md') */
  breakpoint?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Show row numbers */
  showRowNumbers?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Loading state */
  loading?: boolean;
  /** Custom card renderer (overrides default card layout) */
  renderCard?: (row: T, index: number, isExpanded: boolean, toggleExpand: () => void) => React.ReactNode;
  /** On row click handler */
  onRowClick?: (row: T, index: number) => void;
  /** Custom styles */
  sx?: SxProps<Theme>;
  /** Test ID */
  'data-testid'?: string;
}

interface ExpandableCardProps<T> {
  row: T;
  index: number;
  columns: ResponsiveTableColumn<T>[];
  showRowNumber: boolean;
  onRowClick?: (row: T, index: number) => void;
}

/**
 * C1 Fix: Wrapper component for custom renderCard to properly manage expanded state.
 * Hooks must be called at the top level of a component, not inside callbacks or loops.
 */
interface CustomCardWrapperProps<T> {
  row: T;
  index: number;
  renderCard: (row: T, index: number, isExpanded: boolean, toggleExpand: () => void) => React.ReactNode;
}

function CustomCardWrapper<T>({ row, index, renderCard }: CustomCardWrapperProps<T>) {
  const [expanded, setExpanded] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);
  const toggleExpand = React.useCallback(() => setExpanded((prev) => !prev), []);

  // H3 Fix: Error boundary for render prop
  if (hasError) {
    return (
      <Card sx={{ mb: 1.5, bgcolor: 'error.50', border: '1px solid', borderColor: 'error.main' }}>
        <CardContent>
          <Typography color="error" variant="body2">
            Error rendering row {index + 1}
          </Typography>
        </CardContent>
      </Card>
    );
  }

  try {
    return <>{renderCard(row, index, expanded, toggleExpand)}</>;
  } catch (error) {
    // Log error and show fallback UI
    console.error(`[ResponsiveTable] Render error at row ${index}:`, error);
    setHasError(true);
    return null;
  }
}

function ExpandableCard<T>({
  row,
  index,
  columns,
  showRowNumber,
  onRowClick,
}: ExpandableCardProps<T>) {
  const [expanded, setExpanded] = React.useState(false);

  const titleColumn = columns.find((c) => c.isTitle);
  const subtitleColumn = columns.find((c) => c.isSubtitle);
  const primaryColumns = columns.filter((c) => c.priority === 1 && !c.isTitle && !c.isSubtitle);
  const secondaryColumns = columns.filter((c) => c.priority === 2);
  const hasSecondary = secondaryColumns.length > 0;

  const handleClick = () => {
    if (onRowClick) {
      onRowClick(row, index);
    }
  };

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((prev) => !prev);
  };

  return (
    <Card
      sx={{
        mb: 1.5,
        cursor: onRowClick ? 'pointer' : 'default',
        '&:active': onRowClick ? { transform: 'scale(0.99)' } : {},
        transition: 'transform 0.1s ease',
      }}
      onClick={handleClick}
    >
      <CardContent sx={{ pb: expanded ? 1 : '16px !important', pt: 1.5, px: 2 }}>
        {/* Header Row */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {showRowNumber && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                #{index + 1}
              </Typography>
            )}
            {titleColumn && (
              <Typography variant="subtitle1" fontWeight={600} noWrap>
                {titleColumn.render(row, index)}
              </Typography>
            )}
            {subtitleColumn && (
              <Typography variant="body2" color="text.secondary" noWrap>
                {subtitleColumn.render(row, index)}
              </Typography>
            )}
          </Box>

          {hasSecondary && (
            <IconButton
              size="small"
              onClick={handleToggleExpand}
              aria-label={expanded ? 'Collapse details' : 'Expand details'}
              aria-expanded={expanded}
              sx={{ ml: 1, minWidth: 40, minHeight: 40 }}
            >
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          )}
        </Box>

        {/* Primary Fields (Always Visible) */}
        {primaryColumns.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
            {primaryColumns.map((column) => (
              <Box key={column.key} sx={{ minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  {column.header}
                </Typography>
                <Typography variant="body2" fontWeight={500}>
                  {column.render(row, index)}
                </Typography>
              </Box>
            ))}
          </Box>
        )}

        {/* Secondary Fields (Expandable) */}
        <Collapse in={expanded}>
          <Box
            sx={{
              mt: 2,
              pt: 2,
              borderTop: '1px solid',
              borderColor: 'divider',
            }}
          >
            {secondaryColumns.map((column) => (
              <Box key={column.key} sx={{ mb: 1.5, '&:last-child': { mb: 0 } }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  {column.header}
                </Typography>
                <Typography variant="body2">
                  {column.render(row, index)}
                </Typography>
              </Box>
            ))}
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
}

/**
 * Responsive table that transforms to card layout on mobile
 */
export function ResponsiveTable<T>({
  data,
  columns,
  getRowKey,
  breakpoint = 'md',
  showRowNumbers = false,
  emptyMessage = 'No data available',
  loading = false,
  renderCard,
  onRowClick,
  sx,
  'data-testid': testId,
}: ResponsiveTableProps<T>) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down(breakpoint));

  // Render empty state
  if (!loading && data.length === 0) {
    return (
      <Box
        sx={{
          textAlign: 'center',
          py: 6,
          color: 'text.secondary',
        }}
        data-testid={testId}
      >
        <Typography variant="body1">{emptyMessage}</Typography>
      </Box>
    );
  }

  // Render loading skeleton
  // H4 Fix: Use stable skeleton keys instead of array indices
  if (loading) {
    return (
      <Box sx={{ ...sx }} data-testid={testId}>
        {['skeleton-row-1', 'skeleton-row-2', 'skeleton-row-3'].map((key) => (
          <Card key={key} sx={{ mb: 1.5 }}>
            <CardContent>
              <Box sx={{ height: 20, bgcolor: 'action.hover', borderRadius: 1, mb: 1, width: '60%' }} />
              <Box sx={{ height: 16, bgcolor: 'action.hover', borderRadius: 1, width: '40%' }} />
            </CardContent>
          </Card>
        ))}
      </Box>
    );
  }

  // Mobile Card View
  if (isMobile) {
    return (
      <Box sx={{ ...sx }} data-testid={testId}>
        {data.map((row, index) => {
          const key = getRowKey(row, index);

          if (renderCard) {
            // C1 Fix: Use CustomCardWrapper component to properly manage state
            return (
              <CustomCardWrapper
                key={key}
                row={row}
                index={index}
                renderCard={renderCard}
              />
            );
          }

          return (
            <ExpandableCard
              key={key}
              row={row}
              index={index}
              columns={columns}
              showRowNumber={showRowNumbers}
              onRowClick={onRowClick}
            />
          );
        })}
      </Box>
    );
  }

  // Desktop Table View
  const visibleColumns = columns.filter((c) => c.priority !== 3);

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ ...sx }} data-testid={testId}>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: 'action.hover' }}>
            {showRowNumbers && (
              <TableCell sx={{ fontWeight: 600, width: 50 }}>#</TableCell>
            )}
            {visibleColumns.map((column) => (
              <TableCell
                key={column.key}
                align={column.align || 'left'}
                sx={{ fontWeight: 600, width: column.width }}
              >
                {column.header}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((row, index) => (
            <TableRow
              key={getRowKey(row, index)}
              hover
              onClick={onRowClick ? () => onRowClick(row, index) : undefined}
              sx={{
                cursor: onRowClick ? 'pointer' : 'default',
              }}
            >
              {showRowNumbers && (
                <TableCell sx={{ color: 'text.secondary' }}>{index + 1}</TableCell>
              )}
              {visibleColumns.map((column) => (
                <TableCell key={column.key} align={column.align || 'left'}>
                  {column.render(row, index)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default ResponsiveTable;
