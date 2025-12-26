/**
 * BOMColumnMapper Tests
 *
 * Tests for column mapping functionality.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../test/test-utils';
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

describe('BOMColumnMapper', () => {
  const defaultProps = {
    filename: 'test-bom.csv',
    totalRows: 50,
    columnMappings: createMockMappings(),
    previewData: mockPreviewData,
    onMappingChange: vi.fn(),
    onConfirm: vi.fn(),
  };

  it('renders filename in title', () => {
    render(<BOMColumnMapper {...defaultProps} />);

    expect(screen.getByText(/test-bom\.csv/)).toBeInTheDocument();
  });

  it('shows row count chip', () => {
    render(<BOMColumnMapper {...defaultProps} />);

    expect(screen.getByText('50 rows')).toBeInTheDocument();
  });

  it('renders all column mappings', () => {
    render(<BOMColumnMapper {...defaultProps} />);

    expect(screen.getByText('Part Number')).toBeInTheDocument();
    // 'Manufacturer' appears multiple times (mapping table + preview), use getAllByText
    expect(screen.getAllByText('Manufacturer').length).toBeGreaterThan(0);
    expect(screen.getByText('Qty')).toBeInTheDocument();
    expect(screen.getByText('Notes')).toBeInTheDocument();
  });

  it('shows sample data in table', () => {
    const { container } = render(<BOMColumnMapper {...defaultProps} />);

    // Sample data is shown in a table - check that the table exists and has data
    const tables = container.querySelectorAll('table');
    expect(tables.length).toBeGreaterThan(0);

    // Check for preview section header
    expect(screen.getByText('Data Preview (First 5 Rows)')).toBeInTheDocument();
  });

  it('shows mapped and ignored chips', () => {
    render(<BOMColumnMapper {...defaultProps} />);

    const mappedChips = screen.getAllByText('Mapped');
    expect(mappedChips.length).toBe(3); // 3 mapped columns

    expect(screen.getByText('Ignored')).toBeInTheDocument();
  });

  it('calls onMappingChange when selection changes', () => {
    const onMappingChange = vi.fn();
    render(<BOMColumnMapper {...defaultProps} onMappingChange={onMappingChange} />);

    // Find a select and change it
    const selects = screen.getAllByRole('combobox');
    fireEvent.mouseDown(selects[0]);

    const descriptionOption = screen.getByRole('option', { name: /description/i });
    fireEvent.click(descriptionOption);

    expect(onMappingChange).toHaveBeenCalledWith('Part Number', 'description');
  });

  it('calls onConfirm when confirm button is clicked', () => {
    const onConfirm = vi.fn();
    render(<BOMColumnMapper {...defaultProps} onConfirm={onConfirm} />);

    const confirmButton = screen.getByRole('button', { name: /confirm mappings/i });
    fireEvent.click(confirmButton);

    expect(onConfirm).toHaveBeenCalled();
  });

  it('shows error when MPN is not mapped', () => {
    const mappingsWithoutMPN: ColumnMapping[] = [
      { source: 'Col1', target: 'manufacturer', confidence: 0.9 },
      { source: 'Col2', target: 'quantity', confidence: 0.85 },
    ];

    render(<BOMColumnMapper {...defaultProps} columnMappings={mappingsWithoutMPN} />);

    expect(screen.getByText(/part number.*required/i)).toBeInTheDocument();
  });

  it('disables confirm when MPN is not mapped', () => {
    const mappingsWithoutMPN: ColumnMapping[] = [
      { source: 'Col1', target: 'manufacturer', confidence: 0.9 },
    ];

    render(<BOMColumnMapper {...defaultProps} columnMappings={mappingsWithoutMPN} />);

    const confirmButton = screen.getByRole('button', { name: /confirm mappings/i });
    expect(confirmButton).toBeDisabled();
  });

  it('shows warning for duplicate mappings', () => {
    const duplicateMappings: ColumnMapping[] = [
      { source: 'Col1', target: 'manufacturer_part_number', confidence: 0.9 },
      { source: 'Col2', target: 'manufacturer_part_number', confidence: 0.85 },
    ];

    render(<BOMColumnMapper {...defaultProps} columnMappings={duplicateMappings} />);

    expect(screen.getByText(/multiple columns.*same target/i)).toBeInTheDocument();
  });

  it('shows processing state when isConfirming is true', () => {
    render(<BOMColumnMapper {...defaultProps} isConfirming />);

    expect(screen.getByRole('button', { name: /processing/i })).toBeDisabled();
  });

  it('shows mapping count in footer', () => {
    render(<BOMColumnMapper {...defaultProps} />);

    expect(screen.getByText(/3 column\(s\) mapped/)).toBeInTheDocument();
    expect(screen.getByText(/1 ignored/)).toBeInTheDocument();
  });

  it('renders data preview section', () => {
    render(<BOMColumnMapper {...defaultProps} />);

    expect(screen.getByText('Data Preview (First 5 Rows)')).toBeInTheDocument();
  });
});
