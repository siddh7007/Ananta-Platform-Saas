/**
 * ResponsiveTable Component
 *
 * A responsive table that switches between:
 * - Desktop (md+): Traditional table layout
 * - Mobile (<md): Stacked card layout
 *
 * Features:
 * - Automatic responsive behavior using CSS media queries
 * - Customizable card rendering for mobile
 * - Support for row selection, actions, and custom cell rendering
 * - Accessible with proper ARIA attributes and keyboard navigation
 * - Live region announcements for loading/empty states
 */

import { ReactNode, useState, useCallback, KeyboardEvent } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// Column definition for the table
export interface ResponsiveTableColumn<T> {
  /** Unique key for the column */
  key: string;
  /** Header label */
  header: string;
  /** Whether to show this column on mobile cards */
  showOnMobile?: boolean;
  /** Whether this is the primary field (shown as card title on mobile) */
  isPrimary?: boolean;
  /** Custom cell renderer */
  render?: (item: T, index: number) => ReactNode;
  /** Cell content alignment */
  align?: 'left' | 'center' | 'right';
  /** Custom header class */
  headerClassName?: string;
  /** Custom cell class */
  cellClassName?: string;
  /** Width (for desktop) */
  width?: string | number;
  /** Whether column is sortable */
  sortable?: boolean;
}

export interface ResponsiveTableProps<T> {
  /** Data items to display */
  data: T[];
  /** Column definitions */
  columns: ResponsiveTableColumn<T>[];
  /** Unique key extractor for each row */
  getRowKey: (item: T) => string;
  /** Whether the table is loading */
  isLoading?: boolean;
  /** Custom loading component */
  loadingComponent?: ReactNode;
  /** Custom empty state component */
  emptyComponent?: ReactNode;
  /** Empty state message (used if emptyComponent not provided) */
  emptyMessage?: string;
  /** Optional row click handler */
  onRowClick?: (item: T) => void;
  /** Enable row selection */
  selectable?: boolean;
  /** Currently selected row keys */
  selectedKeys?: string[];
  /** Selection change handler */
  onSelectionChange?: (keys: string[]) => void;
  /** Custom row actions (rendered in last column on desktop, card footer on mobile) */
  renderActions?: (item: T) => ReactNode;
  /** Custom mobile card renderer (overrides default card layout) */
  renderMobileCard?: (item: T, index: number) => ReactNode;
  /** Additional class for the container */
  className?: string;
  /** Enable striped rows */
  striped?: boolean;
  /** Enable hover effect */
  hoverable?: boolean;
  /** Accessible label for the table */
  ariaLabel?: string;
  /** Maximum mobile fields before "show more" (default: 6) */
  maxMobileFields?: number;
}

export function ResponsiveTable<T>({
  data,
  columns,
  getRowKey,
  isLoading = false,
  loadingComponent,
  emptyComponent,
  emptyMessage = 'No data to display',
  onRowClick,
  selectable = false,
  selectedKeys = [],
  onSelectionChange,
  renderActions,
  renderMobileCard,
  className,
  striped = false,
  hoverable = true,
  ariaLabel = 'Data table',
  maxMobileFields = 6,
}: ResponsiveTableProps<T>) {
  // Track which cards have expanded fields on mobile
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const handleSelectAll = useCallback(() => {
    if (!onSelectionChange) return;
    if (selectedKeys.length === data.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(data.map(getRowKey));
    }
  }, [onSelectionChange, selectedKeys.length, data, getRowKey]);

  const handleSelectRow = useCallback(
    (key: string) => {
      if (!onSelectionChange) return;
      if (selectedKeys.includes(key)) {
        onSelectionChange(selectedKeys.filter((k) => k !== key));
      } else {
        onSelectionChange([...selectedKeys, key]);
      }
    },
    [onSelectionChange, selectedKeys]
  );

  const toggleCardExpansion = useCallback((key: string) => {
    setExpandedCards((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  }, []);

  // Keyboard handler for row navigation
  const handleRowKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTableRowElement>, item: T, _index: number) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onRowClick?.(item);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextRow = e.currentTarget.nextElementSibling as HTMLElement;
        nextRow?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevRow = e.currentTarget.previousElementSibling as HTMLElement;
        prevRow?.focus();
      }
    },
    [onRowClick]
  );

  // Keyboard handler for mobile cards
  const handleCardKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>, item: T) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onRowClick?.(item);
      }
    },
    [onRowClick]
  );

  // Loading state with live region announcement
  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label="Loading data"
        className={cn('w-full', className)}
      >
        {loadingComponent || (
          <div className="flex items-center justify-center py-12">
            <div
              className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
              aria-hidden="true"
            />
            <span className="sr-only">Loading...</span>
          </div>
        )}
      </div>
    );
  }

  // Empty state with live region announcement
  if (data.length === 0) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="No data available"
        className={cn('w-full', className)}
      >
        {emptyComponent || (
          <div className="py-12 text-center text-muted-foreground">{emptyMessage}</div>
        )}
      </div>
    );
  }

  const primaryColumn = columns.find((c) => c.isPrimary) || columns[0];
  const mobileColumns = columns.filter((c) => c.showOnMobile !== false && !c.isPrimary);
  const hasMoreMobileFields = mobileColumns.length > maxMobileFields;

  return (
    <div className={cn('w-full', className)}>
      {/* Live region for selection announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {selectedKeys.length > 0 && `${selectedKeys.length} items selected`}
      </div>

      {/* Desktop Table - hidden on mobile */}
      <div className="hidden md:block overflow-x-auto">
        <table
          className="w-full"
          role="grid"
          aria-label={ariaLabel}
          aria-rowcount={data.length + 1}
        >
          <thead>
            <tr className="border-b bg-muted/50" role="row">
              {selectable && (
                <th scope="col" className="p-3 w-10" role="columnheader">
                  <input
                    type="checkbox"
                    checked={selectedKeys.length === data.length && data.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    aria-label={
                      selectedKeys.length === data.length ? 'Deselect all rows' : 'Select all rows'
                    }
                  />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  role="columnheader"
                  className={cn(
                    'p-3 text-sm font-medium text-muted-foreground',
                    column.align === 'center' && 'text-center',
                    column.align === 'right' && 'text-right',
                    column.align !== 'center' && column.align !== 'right' && 'text-left',
                    column.headerClassName
                  )}
                  style={{ width: column.width }}
                >
                  {column.header}
                </th>
              ))}
              {renderActions && (
                <th
                  scope="col"
                  role="columnheader"
                  className="p-3 text-right text-sm font-medium text-muted-foreground w-24"
                >
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.map((item, index) => {
              const rowKey = getRowKey(item);
              const isSelected = selectedKeys.includes(rowKey);

              return (
                <tr
                  key={rowKey}
                  role="row"
                  aria-rowindex={index + 2}
                  aria-selected={selectable ? isSelected : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  className={cn(
                    'transition-colors',
                    striped && index % 2 === 1 && 'bg-muted/30',
                    hoverable && 'hover:bg-muted/50',
                    isSelected && 'bg-primary/5',
                    onRowClick && 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary'
                  )}
                  onClick={() => onRowClick?.(item)}
                  onKeyDown={(e) => handleRowKeyDown(e, item, index)}
                >
                  {selectable && (
                    <td role="gridcell" className="p-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectRow(rowKey)}
                        className="rounded border-gray-300 focus:ring-2 focus:ring-primary focus:ring-offset-2"
                        aria-label={`Select row ${index + 1}`}
                      />
                    </td>
                  )}
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      role="gridcell"
                      className={cn(
                        'p-3',
                        column.align === 'center' && 'text-center',
                        column.align === 'right' && 'text-right',
                        column.cellClassName
                      )}
                    >
                      {column.render
                        ? column.render(item, index)
                        : (item as Record<string, unknown>)[column.key]?.toString() || '-'}
                    </td>
                  ))}
                  {renderActions && (
                    <td
                      role="gridcell"
                      className="p-3 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {renderActions(item)}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards - hidden on desktop */}
      <div
        className="md:hidden space-y-3"
        role="list"
        aria-label={ariaLabel}
      >
        {data.map((item, index) => {
          const rowKey = getRowKey(item);
          const isSelected = selectedKeys.includes(rowKey);
          const isExpanded = expandedCards.has(rowKey);
          const visibleMobileColumns = isExpanded
            ? mobileColumns
            : mobileColumns.slice(0, maxMobileFields);

          // Custom mobile card renderer
          if (renderMobileCard) {
            return (
              <div
                key={rowKey}
                role="listitem"
                className="relative"
                aria-selected={selectable ? isSelected : undefined}
              >
                {selectable && (
                  <div className="absolute top-3 left-3 z-10">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelectRow(rowKey)}
                      className="rounded border-gray-300 focus:ring-2 focus:ring-primary focus:ring-offset-2"
                      aria-label={`Select item ${index + 1}`}
                    />
                  </div>
                )}
                {renderMobileCard(item, index)}
              </div>
            );
          }

          // Default mobile card layout
          return (
            <div
              key={rowKey}
              role="listitem"
              aria-selected={selectable ? isSelected : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              className={cn(
                'rounded-lg border bg-card p-4 transition-colors',
                hoverable && 'active:bg-muted/50',
                isSelected && 'border-primary bg-primary/5',
                onRowClick && 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary'
              )}
              onClick={() => onRowClick?.(item)}
              onKeyDown={(e) => handleCardKeyDown(e, item)}
            >
              {/* Header with checkbox and primary field */}
              <div className="flex items-start gap-3">
                {selectable && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelectRow(rowKey)}
                      className="rounded border-gray-300 mt-1 focus:ring-2 focus:ring-primary focus:ring-offset-2"
                      aria-label={`Select item ${index + 1}`}
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  {/* Primary field as title */}
                  <div className="font-medium">
                    {primaryColumn.render
                      ? primaryColumn.render(item, index)
                      : (item as Record<string, unknown>)[primaryColumn.key]?.toString() || '-'}
                  </div>

                  {/* Secondary fields in a description list */}
                  <dl
                    id={`card-details-${rowKey}`}
                    className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm"
                  >
                    {visibleMobileColumns.map((column) => (
                      <div key={column.key}>
                        <dt className="text-xs text-muted-foreground">{column.header}</dt>
                        <dd className="mt-0.5 truncate">
                          {column.render
                            ? column.render(item, index)
                            : (item as Record<string, unknown>)[column.key]?.toString() || '-'}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  {/* Show more/less button when there are hidden fields */}
                  {hasMoreMobileFields && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 h-7 px-2 text-xs text-muted-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCardExpansion(rowKey);
                      }}
                      aria-expanded={isExpanded}
                      aria-controls={`card-details-${rowKey}`}
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-3 w-3 mr-1" aria-hidden="true" />
                          Show less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3 w-3 mr-1" aria-hidden="true" />
                          Show {mobileColumns.length - maxMobileFields} more fields
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>

              {/* Actions footer */}
              {renderActions && (
                <div
                  className="mt-3 pt-3 border-t flex justify-end"
                  onClick={(e) => e.stopPropagation()}
                >
                  {renderActions(item)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ResponsiveTable;
