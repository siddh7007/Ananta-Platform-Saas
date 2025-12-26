/**
 * Unit tests for ResponsiveTable component
 * @module components/layout/ResponsiveTable.test
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock @mui/x-data-grid before importing component
vi.mock('@mui/x-data-grid', () => ({
  DataGrid: ({ rows, columns, loading, onRowClick }: any) => (
    <div role="grid" data-testid="data-grid">
      <div role="row">
        {columns.map((col: any) => (
          <div key={col.field} role="columnheader">{col.headerName}</div>
        ))}
      </div>
      {loading && <div data-testid="loading-overlay">Loading...</div>}
      {rows.map((row: any) => (
        <div
          key={row.id}
          role="row"
          aria-label={`Row for ${row.name || row.id}`}
          onClick={() => onRowClick && onRowClick({ row })}
        >
          {columns.map((col: any) => (
            <div key={col.field} role="cell">{row[col.field]}</div>
          ))}
        </div>
      ))}
    </div>
  ),
  GridColDef: vi.fn(),
}));

// Mock hooks
import * as useTouchDeviceModule from '../../hooks/useTouchDevice';
import * as useOrientationModule from '../../hooks/useOrientation';

vi.mock('../../hooks/useTouchDevice', () => ({
  useTouchDevice: vi.fn(() => ({
    isTablet: false,
    isMobile: false,
    isDesktop: true,
    isTouchDevice: false,
  })),
}));

vi.mock('../../hooks/useOrientation', () => ({
  useOrientation: vi.fn(() => ({
    orientation: 'landscape',
    isLandscape: true,
    isPortrait: false,
  })),
}));

import { ResponsiveTable, ResponsiveTableProps } from './ResponsiveTable';

const mockUseTouchDevice = vi.mocked(useTouchDeviceModule.useTouchDevice);
const mockUseOrientation = vi.mocked(useOrientationModule.useOrientation);

// Define GridColDef interface for type safety in tests
interface GridColDef {
  field: string;
  headerName: string;
  width?: number;
  valueFormatter?: (value: any) => any;
}

describe('ResponsiveTable', () => {
  const mockColumns: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 70 },
    { field: 'name', headerName: 'Name', width: 130 },
    { field: 'status', headerName: 'Status', width: 100 },
  ];

  const mockRows = [
    { id: 1, name: 'Item 1', status: 'active' },
    { id: 2, name: 'Item 2', status: 'pending' },
    { id: 3, name: 'Item 3', status: 'inactive' },
  ];

  const defaultProps: ResponsiveTableProps = {
    rows: mockRows,
    columns: mockColumns,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Desktop View', () => {
    it('should render DataGrid on desktop', () => {
      render(<ResponsiveTable {...defaultProps} />);

      // DataGrid should be rendered
      expect(screen.getByRole('grid')).toBeInTheDocument();
    });

    it('should display column headers', () => {
      render(<ResponsiveTable {...defaultProps} />);

      expect(screen.getByRole('columnheader', { name: /id/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /name/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /status/i })).toBeInTheDocument();
    });

    it('should display row data', () => {
      render(<ResponsiveTable {...defaultProps} />);

      expect(screen.getByRole('cell', { name: 'Item 1' })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: 'Item 2' })).toBeInTheDocument();
    });

    it('should handle row click', () => {
      const onRowClick = vi.fn();
      render(<ResponsiveTable {...defaultProps} onRowClick={onRowClick} />);

      const row = screen.getByRole('row', { name: /item 1/i });
      fireEvent.click(row);

      expect(onRowClick).toHaveBeenCalled();
    });

    it('should show loading state', () => {
      render(<ResponsiveTable {...defaultProps} loading={true} />);

      // MUI DataGrid shows loading overlay
      expect(screen.getByRole('grid')).toBeInTheDocument();
    });
  });

  describe('Tablet View', () => {
    beforeEach(() => {
      mockUseTouchDevice.mockReturnValue({
        isTablet: true,
        isMobile: false,
        isDesktop: false,
        isTouchDevice: true,
      });
    });

    it('should render cards on tablet', () => {
      render(<ResponsiveTable {...defaultProps} />);

      // Should render card view container
      expect(document.querySelector('.tablet-card-view')).toBeInTheDocument();
    });

    it('should display correct number of cards', () => {
      render(<ResponsiveTable {...defaultProps} />);

      // Should have 3 cards for 3 rows
      const cards = document.querySelectorAll('.MuiCard-root');
      expect(cards).toHaveLength(3);
    });

    it('should handle card click', () => {
      const onRowClick = vi.fn();
      render(<ResponsiveTable {...defaultProps} onRowClick={onRowClick} />);

      const cards = document.querySelectorAll('.MuiCard-root');
      fireEvent.click(cards[0]);

      expect(onRowClick).toHaveBeenCalledWith(mockRows[0]);
    });

    it('should display 2 columns in landscape mode', () => {
      mockUseOrientation.mockReturnValue({
        orientation: 'landscape',
        isLandscape: true,
        isPortrait: false,
      });

      render(<ResponsiveTable {...defaultProps} />);

      const container = document.querySelector('.tablet-card-view');
      expect(container).toHaveStyle({ gridTemplateColumns: 'repeat(2, 1fr)' });
    });

    it('should display 1 column in portrait mode', () => {
      mockUseOrientation.mockReturnValue({
        orientation: 'portrait',
        isLandscape: false,
        isPortrait: true,
      });

      render(<ResponsiveTable {...defaultProps} />);

      const container = document.querySelector('.tablet-card-view');
      expect(container).toHaveStyle({ gridTemplateColumns: 'repeat(1, 1fr)' });
    });

    it('should show loading skeleton on tablet', () => {
      render(<ResponsiveTable {...defaultProps} loading={true} />);

      const skeletons = document.querySelectorAll('.tablet-skeleton');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Mobile View', () => {
    beforeEach(() => {
      mockUseTouchDevice.mockReturnValue({
        isTablet: false,
        isMobile: true,
        isDesktop: false,
        isTouchDevice: true,
      });
    });

    it('should render cards on mobile', () => {
      render(<ResponsiveTable {...defaultProps} />);

      expect(document.querySelector('.tablet-card-view')).toBeInTheDocument();
    });

    it('should display single column on mobile', () => {
      render(<ResponsiveTable {...defaultProps} />);

      const container = document.querySelector('.tablet-card-view');
      expect(container).toHaveStyle({ gridTemplateColumns: 'repeat(1, 1fr)' });
    });
  });

  describe('Empty State', () => {
    it('should show empty message when no rows', () => {
      mockUseTouchDevice.mockReturnValue({
        isTablet: true,
        isMobile: false,
        isDesktop: false,
        isTouchDevice: true,
      });

      render(<ResponsiveTable {...defaultProps} rows={[]} />);

      expect(screen.getByText(/no data available/i)).toBeInTheDocument();
    });
  });

  describe('Custom Render', () => {
    it('should use custom renderCard when provided', () => {
      mockUseTouchDevice.mockReturnValue({
        isTablet: true,
        isMobile: false,
        isDesktop: false,
        isTouchDevice: true,
      });

      const customRender = (row: any) => (
        <div data-testid={`custom-card-${row.id}`}>Custom: {row.name}</div>
      );

      render(<ResponsiveTable {...defaultProps} renderCard={customRender} />);

      expect(screen.getByTestId('custom-card-1')).toBeInTheDocument();
      expect(screen.getByText('Custom: Item 1')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels in card view', () => {
      mockUseTouchDevice.mockReturnValue({
        isTablet: true,
        isMobile: false,
        isDesktop: false,
        isTouchDevice: true,
      });

      render(<ResponsiveTable {...defaultProps} />);

      // Cards should be clickable elements
      const cards = document.querySelectorAll('.MuiCard-root');
      expect(cards[0]).toBeInTheDocument();
    });
  });

  describe('Value Formatting', () => {
    it('should apply valueFormatter to column values', () => {
      mockUseTouchDevice.mockReturnValue({
        isTablet: true,
        isMobile: false,
        isDesktop: false,
        isTouchDevice: true,
      });

      const columnsWithFormatter: GridColDef[] = [
        { field: 'id', headerName: 'ID', width: 70 },
        {
          field: 'status',
          headerName: 'Status',
          width: 100,
          valueFormatter: (value: string) => value.toUpperCase(),
        },
      ];

      const rows = [{ id: 1, status: 'active' }];

      render(<ResponsiveTable rows={rows} columns={columnsWithFormatter} />);

      expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    });
  });
});
