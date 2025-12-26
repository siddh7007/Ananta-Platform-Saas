/**
 * BOMColumnMapper STRICT Tests
 *
 * These tests validate actual component behavior and WILL FAIL
 * if the component doesn't meet specifications.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '../../test/test-utils';
import { BOMColumnMapper } from './BOMColumnMapper';
import type { ColumnMapping } from '../../utils/bomParser';

const createMockMappings = (): ColumnMapping[] => [
  { source: 'Part Number', target: 'manufacturer_part_number', confidence: 0.95 },
  { source: 'Manufacturer', target: 'manufacturer', confidence: 0.9 },
  { source: 'Qty', target: 'quantity', confidence: 0.85 },
  { source: 'Notes', target: 'ignore', confidence: 0 },
];

const mockPreviewData = [
  { 'Part Number': 'ATMEGA328P', Manufacturer: 'Microchip', Qty: '10', Notes: 'Main MCU' },
  { 'Part Number': 'LM7805', Manufacturer: 'Texas Instruments', Qty: '5', Notes: 'Regulator' },
  { 'Part Number': 'RC0805FR-10K', Manufacturer: 'Yageo', Qty: '100', Notes: '' },
];

describe('BOMColumnMapper STRICT Tests', () => {
  const defaultProps = {
    filename: 'test-bom.csv',
    totalRows: 50,
    columnMappings: createMockMappings(),
    previewData: mockPreviewData,
    onMappingChange: vi.fn(),
    onConfirm: vi.fn(),
  };

  describe('Header Section', () => {
    it('shows exact title format "Review Column Mappings: {filename}"', () => {
      render(<BOMColumnMapper {...defaultProps} filename="my-components.csv" />);

      // Must contain exact format
      expect(screen.getByText(/Review Column Mappings: my-components\.csv/)).toBeInTheDocument();
    });

    it('displays row count in chip with exact format "{n} rows"', () => {
      render(<BOMColumnMapper {...defaultProps} totalRows={123} />);

      // Must be exactly "123 rows" not "123" or "rows: 123"
      expect(screen.getByText('123 rows')).toBeInTheDocument();
    });
  });

  describe('Info Alert', () => {
    it('displays auto-detection info alert with required field instruction', () => {
      render(<BOMColumnMapper {...defaultProps} />);

      // Must mention Part Number (MPN) requirement
      expect(screen.getByText(/At least one column must be mapped to "Part Number \(MPN\)"/)).toBeInTheDocument();
    });
  });

  describe('Validation - MPN Required', () => {
    it('shows exact error message when MPN is not mapped', () => {
      const mappingsWithoutMPN: ColumnMapping[] = [
        { source: 'Col1', target: 'manufacturer', confidence: 0.9 },
        { source: 'Col2', target: 'quantity', confidence: 0.85 },
      ];

      render(<BOMColumnMapper {...defaultProps} columnMappings={mappingsWithoutMPN} />);

      // Error message must be exactly this text
      expect(screen.getByText('Part Number (MPN) column is required')).toBeInTheDocument();
    });

    it('disables confirm button when MPN is missing', () => {
      const mappingsWithoutMPN: ColumnMapping[] = [
        { source: 'Col1', target: 'manufacturer', confidence: 0.9 },
      ];

      render(<BOMColumnMapper {...defaultProps} columnMappings={mappingsWithoutMPN} />);

      const confirmButton = screen.getByRole('button', { name: /confirm mappings/i });
      expect(confirmButton).toBeDisabled();
    });
  });

  describe('Validation - Duplicate Mappings', () => {
    it('shows exact warning when multiple columns map to same target', () => {
      const duplicateMappings: ColumnMapping[] = [
        { source: 'Col1', target: 'manufacturer_part_number', confidence: 0.9 },
        { source: 'Col2', target: 'manufacturer_part_number', confidence: 0.85 },
      ];

      render(<BOMColumnMapper {...defaultProps} columnMappings={duplicateMappings} />);

      // Warning must contain this exact message
      expect(screen.getByText(/Multiple columns are mapped to the same target/)).toBeInTheDocument();
    });

    it('disables confirm button when duplicates exist', () => {
      const duplicateMappings: ColumnMapping[] = [
        { source: 'Col1', target: 'manufacturer_part_number', confidence: 0.9 },
        { source: 'Col2', target: 'manufacturer_part_number', confidence: 0.85 },
      ];

      render(<BOMColumnMapper {...defaultProps} columnMappings={duplicateMappings} />);

      const confirmButton = screen.getByRole('button', { name: /confirm mappings/i });
      expect(confirmButton).toBeDisabled();
    });
  });

  describe('Column Mapping Table', () => {
    it('renders exactly 4 rows for 4 column mappings', () => {
      render(<BOMColumnMapper {...defaultProps} />);

      // Get the mapping table (first table)
      const tables = screen.getAllByRole('table');
      const mappingTable = tables[0];
      const rows = within(mappingTable).getAllByRole('row');

      // 1 header + 4 data rows = 5 total
      expect(rows.length).toBe(5);
    });

    it('shows all 4 source column names in the table', () => {
      render(<BOMColumnMapper {...defaultProps} />);

      expect(screen.getByText('Part Number')).toBeInTheDocument();
      expect(screen.getByText('Qty')).toBeInTheDocument();
      expect(screen.getByText('Notes')).toBeInTheDocument();
      // Manufacturer appears multiple times, but must appear at least once
      expect(screen.getAllByText('Manufacturer').length).toBeGreaterThanOrEqual(1);
    });

    it('shows exactly 3 "Mapped" chips and 1 "Ignored" chip', () => {
      render(<BOMColumnMapper {...defaultProps} />);

      const mappedChips = screen.getAllByText('Mapped');
      const ignoredChips = screen.getAllByText('Ignored');

      expect(mappedChips).toHaveLength(3);
      expect(ignoredChips).toHaveLength(1);
    });

    it('renders a select dropdown for each column', () => {
      render(<BOMColumnMapper {...defaultProps} />);

      const selects = screen.getAllByRole('combobox');
      expect(selects).toHaveLength(4); // One per column mapping
    });
  });

  describe('Mapping Change Callback', () => {
    it('calls onMappingChange with exact (sourceColumn, targetField) args', () => {
      const onMappingChange = vi.fn();
      render(<BOMColumnMapper {...defaultProps} onMappingChange={onMappingChange} />);

      // Click on first select
      const selects = screen.getAllByRole('combobox');
      fireEvent.mouseDown(selects[0]);

      // Select "Description" option
      const descriptionOption = screen.getByRole('option', { name: /description/i });
      fireEvent.click(descriptionOption);

      // Must be called with exact source column name and new target
      expect(onMappingChange).toHaveBeenCalledWith('Part Number', 'description');
    });
  });

  describe('Data Preview Section', () => {
    it('shows exact section header "Data Preview (First 5 Rows)"', () => {
      render(<BOMColumnMapper {...defaultProps} />);

      expect(screen.getByText('Data Preview (First 5 Rows)')).toBeInTheDocument();
    });

    it('shows "Showing 5 of {n} rows" when totalRows > 5', () => {
      render(<BOMColumnMapper {...defaultProps} totalRows={50} />);

      expect(screen.getByText('Showing 5 of 50 rows')).toBeInTheDocument();
    });

    it('does NOT show "Showing X of Y" when totalRows <= 5', () => {
      render(<BOMColumnMapper {...defaultProps} totalRows={3} />);

      expect(screen.queryByText(/Showing \d+ of \d+ rows/)).not.toBeInTheDocument();
    });

    it('shows field labels in preview headers (not raw field names)', () => {
      render(<BOMColumnMapper {...defaultProps} />);

      // Should show friendly labels, not raw field names like "manufacturer_part_number"
      // "Part Number (MPN)" appears in both dropdown AND preview header (2+ times)
      const mpnLabels = screen.getAllByText('Part Number (MPN)');
      expect(mpnLabels.length).toBeGreaterThanOrEqual(2); // dropdown + header

      // Quantity appears in preview header
      const quantityLabels = screen.getAllByText('Quantity');
      expect(quantityLabels.length).toBeGreaterThanOrEqual(1);

      // Raw field names should NOT appear anywhere
      expect(screen.queryByText('manufacturer_part_number')).not.toBeInTheDocument();
    });
  });

  describe('Footer Section', () => {
    it('shows exact mapped count format "{n} column(s) mapped"', () => {
      render(<BOMColumnMapper {...defaultProps} />);

      // 3 mapped columns (all except 'ignore')
      expect(screen.getByText(/3 column\(s\) mapped/)).toBeInTheDocument();
    });

    it('shows exact ignored count format "{n} ignored"', () => {
      render(<BOMColumnMapper {...defaultProps} />);

      expect(screen.getByText(/1 ignored/)).toBeInTheDocument();
    });
  });

  describe('Confirm Button', () => {
    it('shows exact button text "Confirm Mappings & Process"', () => {
      render(<BOMColumnMapper {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Confirm Mappings & Process/ })).toBeInTheDocument();
    });

    it('shows "Processing..." when isConfirming is true', () => {
      render(<BOMColumnMapper {...defaultProps} isConfirming />);

      expect(screen.getByRole('button', { name: /Processing\.\.\./ })).toBeInTheDocument();
    });

    it('is disabled when isConfirming is true', () => {
      render(<BOMColumnMapper {...defaultProps} isConfirming />);

      const button = screen.getByRole('button', { name: /Processing/ });
      expect(button).toBeDisabled();
    });

    it('calls onConfirm exactly once when clicked', () => {
      const onConfirm = vi.fn();
      render(<BOMColumnMapper {...defaultProps} onConfirm={onConfirm} />);

      const confirmButton = screen.getByRole('button', { name: /Confirm Mappings & Process/ });
      fireEvent.click(confirmButton);

      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });

  describe('Sample Data Display', () => {
    it('shows truncated sample values with ellipsis format', () => {
      render(<BOMColumnMapper {...defaultProps} />);

      // Sample data shows "value1, value2..." format
      // First row sample: ATMEGA328P, LM7805 from Part Number column
      expect(screen.getByText(/ATMEGA328P, LM7805/)).toBeInTheDocument();
    });

    it('shows "(empty)" for columns with no sample data', () => {
      const mappingsWithEmpty: ColumnMapping[] = [
        { source: 'EmptyCol', target: 'manufacturer_part_number', confidence: 0.9 },
      ];
      const emptyPreview = [
        { EmptyCol: '' },
        { EmptyCol: null },
        { EmptyCol: undefined },
      ];

      render(
        <BOMColumnMapper
          {...defaultProps}
          columnMappings={mappingsWithEmpty}
          previewData={emptyPreview}
        />
      );

      expect(screen.getByText('(empty)')).toBeInTheDocument();
    });
  });
});
