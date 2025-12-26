/**
 * ResponsiveTable Component Tests
 *
 * Tests for the responsive table component including:
 * - Desktop table layout
 * - Mobile card layout
 * - Loading and empty states
 * - Selection functionality
 * - Keyboard navigation
 * - Accessibility (ARIA attributes)
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResponsiveTable, type ResponsiveTableColumn } from '@/components/ui/ResponsiveTable';

// Test data interface
interface TestItem {
  id: string;
  name: string;
  status: string;
  count: number;
  date: string;
}

// Test data factory
function createTestItem(overrides: Partial<TestItem> = {}): TestItem {
  return {
    id: `item-${Math.random().toString(36).slice(2)}`,
    name: 'Test Item',
    status: 'active',
    count: 10,
    date: '2024-01-15',
    ...overrides,
  };
}

// Column definitions for tests
const testColumns: ResponsiveTableColumn<TestItem>[] = [
  { key: 'name', header: 'Name', isPrimary: true },
  { key: 'status', header: 'Status', showOnMobile: true },
  { key: 'count', header: 'Count', align: 'right' },
  { key: 'date', header: 'Date' },
];

// =============================================================================
// Loading State Tests
// =============================================================================

describe('ResponsiveTable Loading State', () => {
  it('should render loading indicator when isLoading is true', () => {
    render(
      <ResponsiveTable
        data={[]}
        columns={testColumns}
        getRowKey={(item) => item.id}
        isLoading={true}
      />
    );

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should render custom loading component when provided', () => {
    render(
      <ResponsiveTable
        data={[]}
        columns={testColumns}
        getRowKey={(item) => item.id}
        isLoading={true}
        loadingComponent={<div data-testid="custom-loader">Custom Loading...</div>}
      />
    );

    expect(screen.getByTestId('custom-loader')).toBeInTheDocument();
  });

  it('should not render data while loading', () => {
    const items = [createTestItem({ name: 'Should not appear' })];

    render(
      <ResponsiveTable
        data={items}
        columns={testColumns}
        getRowKey={(item) => item.id}
        isLoading={true}
      />
    );

    expect(screen.queryByText('Should not appear')).not.toBeInTheDocument();
  });
});

// =============================================================================
// Empty State Tests
// =============================================================================

describe('ResponsiveTable Empty State', () => {
  it('should render default empty message when no data', () => {
    render(
      <ResponsiveTable
        data={[]}
        columns={testColumns}
        getRowKey={(item) => item.id}
      />
    );

    expect(screen.getByText('No data to display')).toBeInTheDocument();
  });

  it('should render custom empty message when provided', () => {
    render(
      <ResponsiveTable
        data={[]}
        columns={testColumns}
        getRowKey={(item) => item.id}
        emptyMessage="No items found"
      />
    );

    expect(screen.getByText('No items found')).toBeInTheDocument();
  });

  it('should render custom empty component when provided', () => {
    render(
      <ResponsiveTable
        data={[]}
        columns={testColumns}
        getRowKey={(item) => item.id}
        emptyComponent={<div data-testid="custom-empty">Custom Empty State</div>}
      />
    );

    expect(screen.getByTestId('custom-empty')).toBeInTheDocument();
  });
});

// =============================================================================
// Desktop Table Tests
// =============================================================================

describe('ResponsiveTable Desktop Layout', () => {
  it('should render table with proper ARIA attributes', () => {
    const items = [createTestItem()];

    render(
      <ResponsiveTable
        data={items}
        columns={testColumns}
        getRowKey={(item) => item.id}
        ariaLabel="Test table"
      />
    );

    const table = screen.getByRole('grid');
    expect(table).toHaveAttribute('aria-label', 'Test table');
    expect(table).toHaveAttribute('aria-rowcount', '2'); // header + 1 row
  });

  it('should render all column headers', () => {
    const items = [createTestItem()];

    render(
      <ResponsiveTable
        data={items}
        columns={testColumns}
        getRowKey={(item) => item.id}
      />
    );

    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Count' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Date' })).toBeInTheDocument();
  });

  it('should render data rows', () => {
    const items = [
      createTestItem({ id: '1', name: 'Item 1' }),
      createTestItem({ id: '2', name: 'Item 2' }),
    ];

    render(
      <ResponsiveTable
        data={items}
        columns={testColumns}
        getRowKey={(item) => item.id}
      />
    );

    const rows = screen.getAllByRole('row');
    // 1 header row + 2 data rows
    expect(rows).toHaveLength(3);
  });

  it('should handle row click', () => {
    const items = [createTestItem({ id: '1', name: 'Clickable Item' })];
    const handleRowClick = vi.fn();

    render(
      <ResponsiveTable
        data={items}
        columns={testColumns}
        getRowKey={(item) => item.id}
        onRowClick={handleRowClick}
      />
    );

    const row = screen.getAllByRole('row')[1]; // First data row
    fireEvent.click(row);

    expect(handleRowClick).toHaveBeenCalledWith(items[0]);
  });

  it('should render row actions when provided', () => {
    const items = [createTestItem()];

    render(
      <ResponsiveTable
        data={items}
        columns={testColumns}
        getRowKey={(item) => item.id}
        renderActions={() => <button>Action</button>}
      />
    );

    // Both desktop and mobile layouts render the action button
    const actionButtons = screen.getAllByRole('button', { name: 'Action' });
    expect(actionButtons.length).toBeGreaterThanOrEqual(1);
  });
});

// =============================================================================
// Selection Tests
// =============================================================================

describe('ResponsiveTable Selection', () => {
  it('should render checkboxes when selectable is true', () => {
    const items = [createTestItem()];

    render(
      <ResponsiveTable
        data={items}
        columns={testColumns}
        getRowKey={(item) => item.id}
        selectable
        selectedKeys={[]}
        onSelectionChange={vi.fn()}
      />
    );

    // Select all checkbox + row checkbox
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThanOrEqual(2);
  });

  it('should call onSelectionChange when row is selected', () => {
    const items = [createTestItem({ id: 'item-1' })];
    const handleSelectionChange = vi.fn();

    render(
      <ResponsiveTable
        data={items}
        columns={testColumns}
        getRowKey={(item) => item.id}
        selectable
        selectedKeys={[]}
        onSelectionChange={handleSelectionChange}
      />
    );

    const rowCheckbox = screen.getByRole('checkbox', { name: 'Select row 1' });
    fireEvent.click(rowCheckbox);

    expect(handleSelectionChange).toHaveBeenCalledWith(['item-1']);
  });

  it('should select all rows when select all is clicked', () => {
    const items = [
      createTestItem({ id: '1' }),
      createTestItem({ id: '2' }),
    ];
    const handleSelectionChange = vi.fn();

    render(
      <ResponsiveTable
        data={items}
        columns={testColumns}
        getRowKey={(item) => item.id}
        selectable
        selectedKeys={[]}
        onSelectionChange={handleSelectionChange}
      />
    );

    const selectAllCheckbox = screen.getByRole('checkbox', { name: 'Select all rows' });
    fireEvent.click(selectAllCheckbox);

    expect(handleSelectionChange).toHaveBeenCalledWith(['1', '2']);
  });

  it('should deselect all when all are selected', () => {
    const items = [
      createTestItem({ id: '1' }),
      createTestItem({ id: '2' }),
    ];
    const handleSelectionChange = vi.fn();

    render(
      <ResponsiveTable
        data={items}
        columns={testColumns}
        getRowKey={(item) => item.id}
        selectable
        selectedKeys={['1', '2']}
        onSelectionChange={handleSelectionChange}
      />
    );

    const selectAllCheckbox = screen.getByRole('checkbox', { name: 'Deselect all rows' });
    fireEvent.click(selectAllCheckbox);

    expect(handleSelectionChange).toHaveBeenCalledWith([]);
  });

  it('should announce selection count in live region', () => {
    const items = [createTestItem()];

    render(
      <ResponsiveTable
        data={items}
        columns={testColumns}
        getRowKey={(item) => item.id}
        selectable
        selectedKeys={['item-1', 'item-2']}
        onSelectionChange={vi.fn()}
      />
    );

    expect(screen.getByText('2 items selected')).toBeInTheDocument();
  });
});

// =============================================================================
// Keyboard Navigation Tests
// =============================================================================

describe('ResponsiveTable Keyboard Navigation', () => {
  it('should make rows focusable when onRowClick is provided', () => {
    const items = [createTestItem()];

    render(
      <ResponsiveTable
        data={items}
        columns={testColumns}
        getRowKey={(item) => item.id}
        onRowClick={vi.fn()}
      />
    );

    const row = screen.getAllByRole('row')[1];
    expect(row).toHaveAttribute('tabindex', '0');
  });

  it('should trigger row click on Enter key', () => {
    const items = [createTestItem()];
    const handleRowClick = vi.fn();

    render(
      <ResponsiveTable
        data={items}
        columns={testColumns}
        getRowKey={(item) => item.id}
        onRowClick={handleRowClick}
      />
    );

    const row = screen.getAllByRole('row')[1];
    fireEvent.keyDown(row, { key: 'Enter' });

    expect(handleRowClick).toHaveBeenCalled();
  });

  it('should trigger row click on Space key', () => {
    const items = [createTestItem()];
    const handleRowClick = vi.fn();

    render(
      <ResponsiveTable
        data={items}
        columns={testColumns}
        getRowKey={(item) => item.id}
        onRowClick={handleRowClick}
      />
    );

    const row = screen.getAllByRole('row')[1];
    fireEvent.keyDown(row, { key: ' ' });

    expect(handleRowClick).toHaveBeenCalled();
  });
});

// =============================================================================
// Custom Rendering Tests
// =============================================================================

describe('ResponsiveTable Custom Rendering', () => {
  it('should use custom cell renderer when provided', () => {
    const items = [createTestItem({ status: 'active' })];

    const columnsWithRenderer: ResponsiveTableColumn<TestItem>[] = [
      { key: 'name', header: 'Name' },
      {
        key: 'status',
        header: 'Status',
        render: (item) => <span data-testid="custom-status">{item.status.toUpperCase()}</span>,
      },
    ];

    render(
      <ResponsiveTable
        data={items}
        columns={columnsWithRenderer}
        getRowKey={(item) => item.id}
      />
    );

    // Both desktop and mobile layouts render the custom status
    const customStatuses = screen.getAllByTestId('custom-status');
    expect(customStatuses.length).toBeGreaterThanOrEqual(1);
    expect(customStatuses[0]).toHaveTextContent('ACTIVE');
  });

  it('should apply column alignment classes', () => {
    const items = [createTestItem({ count: 42 })];

    render(
      <ResponsiveTable
        data={items}
        columns={testColumns}
        getRowKey={(item) => item.id}
      />
    );

    // The 'Count' column header should have right alignment
    const countHeader = screen.getByRole('columnheader', { name: 'Count' });
    expect(countHeader).toHaveClass('text-right');
  });
});

// =============================================================================
// Mobile Card Layout Tests
// =============================================================================

describe('ResponsiveTable Mobile Layout', () => {
  it('should have mobile list with proper ARIA attributes', () => {
    const items = [createTestItem()];

    // Note: In actual tests, we'd need to simulate mobile viewport
    // For now, we verify the mobile container exists
    const { container } = render(
      <ResponsiveTable
        data={items}
        columns={testColumns}
        getRowKey={(item) => item.id}
        ariaLabel="Test table"
      />
    );

    // Mobile list container (hidden on desktop)
    const mobileList = container.querySelector('[role="list"]');
    expect(mobileList).toHaveAttribute('aria-label', 'Test table');
  });

  it('should render mobile cards as list items', () => {
    const items = [createTestItem()];

    const { container } = render(
      <ResponsiveTable
        data={items}
        columns={testColumns}
        getRowKey={(item) => item.id}
      />
    );

    // Check for list items
    const listItems = container.querySelectorAll('[role="listitem"]');
    expect(listItems.length).toBe(items.length);
  });
});

// =============================================================================
// Striped and Hoverable Tests
// =============================================================================

describe('ResponsiveTable Styling Options', () => {
  it('should apply striped styles when enabled', () => {
    const items = [
      createTestItem({ id: '1' }),
      createTestItem({ id: '2' }),
    ];

    render(
      <ResponsiveTable
        data={items}
        columns={testColumns}
        getRowKey={(item) => item.id}
        striped
      />
    );

    const rows = screen.getAllByRole('row');
    // Second data row (index 2) should have striped background
    expect(rows[2]).toHaveClass('bg-muted/30');
  });

  it('should not apply hover styles when hoverable is false', () => {
    const items = [createTestItem()];

    render(
      <ResponsiveTable
        data={items}
        columns={testColumns}
        getRowKey={(item) => item.id}
        hoverable={false}
      />
    );

    const row = screen.getAllByRole('row')[1];
    expect(row).not.toHaveClass('hover:bg-muted/50');
  });
});

// =============================================================================
// Mobile Show More/Less Toggle Tests
// =============================================================================

describe('ResponsiveTable Mobile Toggle', () => {
  // Extended columns that will trigger "show more" with maxMobileFields=3
  const extendedColumns: ResponsiveTableColumn<TestItem>[] = [
    { key: 'name', header: 'Name', isPrimary: true },
    { key: 'status', header: 'Status', showOnMobile: true },
    { key: 'count', header: 'Count', showOnMobile: true },
    { key: 'date', header: 'Date', showOnMobile: true },
    // Add more columns to exceed maxMobileFields
    { key: 'extra1', header: 'Extra 1', showOnMobile: true },
    { key: 'extra2', header: 'Extra 2', showOnMobile: true },
  ];

  it('should render show more button when fields exceed maxMobileFields', () => {
    const items = [createTestItem({ id: 'item-1' })];

    const { container } = render(
      <ResponsiveTable
        data={items}
        columns={extendedColumns}
        getRowKey={(item) => item.id}
        maxMobileFields={3}
      />
    );

    // Look for "Show X more fields" button in mobile layout
    const showMoreButton = container.querySelector('button[aria-expanded]');
    expect(showMoreButton).toBeInTheDocument();
    expect(showMoreButton).toHaveAttribute('aria-expanded', 'false');
  });

  it('should have aria-controls pointing to card details', () => {
    const items = [createTestItem({ id: 'test-item' })];

    const { container } = render(
      <ResponsiveTable
        data={items}
        columns={extendedColumns}
        getRowKey={(item) => item.id}
        maxMobileFields={3}
      />
    );

    const showMoreButton = container.querySelector('button[aria-expanded]');
    expect(showMoreButton).toHaveAttribute('aria-controls', 'card-details-test-item');

    // The controlled element should exist
    const detailsElement = container.querySelector('#card-details-test-item');
    expect(detailsElement).toBeInTheDocument();
    expect(detailsElement?.tagName.toLowerCase()).toBe('dl');
  });

  it('should toggle aria-expanded when show more/less is clicked', () => {
    const items = [createTestItem({ id: 'toggle-test' })];

    const { container } = render(
      <ResponsiveTable
        data={items}
        columns={extendedColumns}
        getRowKey={(item) => item.id}
        maxMobileFields={3}
      />
    );

    const toggleButton = container.querySelector('button[aria-expanded]') as HTMLButtonElement;
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');

    // Click to expand
    fireEvent.click(toggleButton);
    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');

    // Click to collapse
    fireEvent.click(toggleButton);
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
  });
});

// =============================================================================
// Live Region Tests
// =============================================================================

describe('ResponsiveTable Live Regions', () => {
  it('should have live region for selection announcements', () => {
    const items = [createTestItem()];

    const { container } = render(
      <ResponsiveTable
        data={items}
        columns={testColumns}
        getRowKey={(item) => item.id}
        selectable
        selectedKeys={[]}
        onSelectionChange={vi.fn()}
      />
    );

    const liveRegion = container.querySelector('[aria-live="polite"][aria-atomic="true"]');
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveClass('sr-only');
  });

  it('should announce selection count in live region', () => {
    const items = [createTestItem({ id: '1' }), createTestItem({ id: '2' })];

    const { container, rerender } = render(
      <ResponsiveTable
        data={items}
        columns={testColumns}
        getRowKey={(item) => item.id}
        selectable
        selectedKeys={[]}
        onSelectionChange={vi.fn()}
      />
    );

    // Initially no selection announcement
    let liveRegion = container.querySelector('[aria-live="polite"][aria-atomic="true"]');
    expect(liveRegion?.textContent).toBe('');

    // Re-render with selected items
    rerender(
      <ResponsiveTable
        data={items}
        columns={testColumns}
        getRowKey={(item) => item.id}
        selectable
        selectedKeys={['1', '2']}
        onSelectionChange={vi.fn()}
      />
    );

    liveRegion = container.querySelector('[aria-live="polite"][aria-atomic="true"]');
    expect(liveRegion?.textContent).toBe('2 items selected');
  });

  it('should have aria-busy on loading state', () => {
    render(
      <ResponsiveTable
        data={[]}
        columns={testColumns}
        getRowKey={(item) => item.id}
        isLoading={true}
      />
    );

    const loadingRegion = screen.getByRole('status');
    expect(loadingRegion).toHaveAttribute('aria-busy', 'true');
    expect(loadingRegion).toHaveAttribute('aria-live', 'polite');
  });

  it('should have status role on empty state', () => {
    render(
      <ResponsiveTable
        data={[]}
        columns={testColumns}
        getRowKey={(item) => item.id}
      />
    );

    const emptyRegion = screen.getByRole('status');
    expect(emptyRegion).toHaveAttribute('aria-live', 'polite');
    expect(emptyRegion).toHaveAttribute('aria-label', 'No data available');
  });
});
