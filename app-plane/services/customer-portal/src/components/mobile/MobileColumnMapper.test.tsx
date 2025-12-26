/**
 * MobileColumnMapper Component Tests
 *
 * P1-5: Tests for mobile-optimized column mapping with accordion layout.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MobileColumnMapper } from './MobileColumnMapper';
import type { ColumnMapping } from '../../utils/bomParser';

// Mock matchMedia for responsive tests
const createMatchMedia = (matches: boolean) => {
  return (query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  });
};

describe('MobileColumnMapper', () => {
  const mockOnMappingChange = vi.fn();
  const mockOnConfirm = vi.fn();

  const defaultMappings: ColumnMapping[] = [
    { source: 'Part Number', target: 'manufacturer_part_number', confidence: 90 },
    { source: 'Mfr', target: 'manufacturer', confidence: 85 },
    { source: 'Qty', target: 'quantity', confidence: 80 },
    { source: 'Notes', target: 'ignore', confidence: 0 },
  ];

  const defaultPreviewData = [
    { 'Part Number': 'ABC123', Mfr: 'Texas Instruments', Qty: 10, Notes: 'Lead-free' },
    { 'Part Number': 'XYZ789', Mfr: 'NXP', Qty: 5, Notes: '' },
    { 'Part Number': 'DEF456', Mfr: 'STMicro', Qty: 20, Notes: 'RoHS' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    window.matchMedia = createMatchMedia(true); // Mobile view by default
  });

  describe('Rendering', () => {
    it('renders the header with filename', () => {
      render(
        <MobileColumnMapper
          filename="test-bom.csv"
          totalRows={100}
          columnMappings={defaultMappings}
          previewData={defaultPreviewData}
          onMappingChange={mockOnMappingChange}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText('Map Columns')).toBeInTheDocument();
      expect(screen.getByText('test-bom.csv')).toBeInTheDocument();
    });

    it('displays total row count', () => {
      render(
        <MobileColumnMapper
          filename="test.csv"
          totalRows={500}
          columnMappings={defaultMappings}
          previewData={defaultPreviewData}
          onMappingChange={mockOnMappingChange}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText('500 rows')).toBeInTheDocument();
    });

    it('renders all column mappings as accordions', () => {
      render(
        <MobileColumnMapper
          filename="test.csv"
          totalRows={100}
          columnMappings={defaultMappings}
          previewData={defaultPreviewData}
          onMappingChange={mockOnMappingChange}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText('Part Number')).toBeInTheDocument();
      expect(screen.getByText('Mfr')).toBeInTheDocument();
      expect(screen.getByText('Qty')).toBeInTheDocument();
      expect(screen.getByText('Notes')).toBeInTheDocument();
    });

    it('shows mapping progress', () => {
      render(
        <MobileColumnMapper
          filename="test.csv"
          totalRows={100}
          columnMappings={defaultMappings}
          previewData={defaultPreviewData}
          onMappingChange={mockOnMappingChange}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText('Mapping progress')).toBeInTheDocument();
      expect(screen.getByText('3 of 4 columns mapped')).toBeInTheDocument();
    });
  });

  describe('Validation', () => {
    it('shows error when MPN is not mapped', () => {
      const mappingsWithoutMPN: ColumnMapping[] = [
        { source: 'Part Number', target: 'ignore', confidence: 0 },
        { source: 'Mfr', target: 'manufacturer', confidence: 85 },
      ];

      render(
        <MobileColumnMapper
          filename="test.csv"
          totalRows={100}
          columnMappings={mappingsWithoutMPN}
          previewData={defaultPreviewData}
          onMappingChange={mockOnMappingChange}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText(/Part Number \(MPN\) column is required/i)).toBeInTheDocument();
    });

    it('shows warning when duplicate mappings exist', () => {
      const mappingsWithDuplicates: ColumnMapping[] = [
        { source: 'Part Number', target: 'manufacturer_part_number', confidence: 90 },
        { source: 'PN2', target: 'manufacturer_part_number', confidence: 85 }, // Duplicate
      ];

      render(
        <MobileColumnMapper
          filename="test.csv"
          totalRows={100}
          columnMappings={mappingsWithDuplicates}
          previewData={defaultPreviewData}
          onMappingChange={mockOnMappingChange}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText(/Multiple columns mapped to same target/i)).toBeInTheDocument();
    });

    it('disables confirm button when MPN is missing', () => {
      const mappingsWithoutMPN: ColumnMapping[] = [
        { source: 'Part Number', target: 'ignore', confidence: 0 },
      ];

      render(
        <MobileColumnMapper
          filename="test.csv"
          totalRows={100}
          columnMappings={mappingsWithoutMPN}
          previewData={defaultPreviewData}
          onMappingChange={mockOnMappingChange}
          onConfirm={mockOnConfirm}
        />
      );

      expect(
        screen.getByRole('button', { name: /Confirm mappings and process/i })
      ).toBeDisabled();
    });

    it('disables confirm button when duplicates exist', () => {
      const mappingsWithDuplicates: ColumnMapping[] = [
        { source: 'Part Number', target: 'manufacturer_part_number', confidence: 90 },
        { source: 'PN2', target: 'manufacturer_part_number', confidence: 85 },
      ];

      render(
        <MobileColumnMapper
          filename="test.csv"
          totalRows={100}
          columnMappings={mappingsWithDuplicates}
          previewData={defaultPreviewData}
          onMappingChange={mockOnMappingChange}
          onConfirm={mockOnConfirm}
        />
      );

      expect(
        screen.getByRole('button', { name: /Confirm mappings and process/i })
      ).toBeDisabled();
    });
  });

  describe('Accordion Interactions', () => {
    it('expands accordion to show details', async () => {
      const user = userEvent.setup();

      render(
        <MobileColumnMapper
          filename="test.csv"
          totalRows={100}
          columnMappings={defaultMappings}
          previewData={defaultPreviewData}
          onMappingChange={mockOnMappingChange}
          onConfirm={mockOnConfirm}
        />
      );

      // Click on the first accordion
      const accordion = screen.getByText('Part Number').closest('[role="button"]');
      if (accordion) {
        await user.click(accordion);
      }

      // Should show sample values and mapping selector - use getAllByText since multiple may exist
      const mapsToElements = screen.getAllByText('Maps to:');
      expect(mapsToElements.length).toBeGreaterThan(0);
      const sampleValuesElements = screen.getAllByText('Sample values:');
      expect(sampleValuesElements.length).toBeGreaterThan(0);
    });

    it('shows sample values when accordion is expanded', async () => {
      const user = userEvent.setup();

      render(
        <MobileColumnMapper
          filename="test.csv"
          totalRows={100}
          columnMappings={defaultMappings}
          previewData={defaultPreviewData}
          onMappingChange={mockOnMappingChange}
          onConfirm={mockOnConfirm}
        />
      );

      // Expand the Part Number accordion
      const accordion = screen.getByText('Part Number').closest('[role="button"]');
      if (accordion) {
        await user.click(accordion);
      }

      // Should show sample values
      expect(screen.getByText('ABC123')).toBeInTheDocument();
    });

    it('shows confidence indicator when available', async () => {
      const user = userEvent.setup();

      render(
        <MobileColumnMapper
          filename="test.csv"
          totalRows={100}
          columnMappings={defaultMappings}
          previewData={defaultPreviewData}
          onMappingChange={mockOnMappingChange}
          onConfirm={mockOnConfirm}
        />
      );

      // Expand the Part Number accordion
      const accordion = screen.getByText('Part Number').closest('[role="button"]');
      if (accordion) {
        await user.click(accordion);
      }

      expect(screen.getByText(/Auto-detected with 90% confidence/i)).toBeInTheDocument();
    });
  });

  describe('Mapping Changes', () => {
    it('calls onMappingChange when target is changed', async () => {
      const user = userEvent.setup();

      render(
        <MobileColumnMapper
          filename="test.csv"
          totalRows={100}
          columnMappings={defaultMappings}
          previewData={defaultPreviewData}
          onMappingChange={mockOnMappingChange}
          onConfirm={mockOnConfirm}
        />
      );

      // Expand the Notes accordion (which is currently ignored)
      const accordion = screen.getByText('Notes').closest('[role="button"]');
      if (accordion) {
        await user.click(accordion);
      }

      // Find and click the select dropdown
      const select = screen.getAllByRole('combobox')[0]; // Get first expanded select
      await user.click(select);

      // Select "Description"
      const descriptionOption = screen.getByRole('option', { name: /Description/i });
      await user.click(descriptionOption);

      expect(mockOnMappingChange).toHaveBeenCalledWith('Notes', 'description');
    });
  });

  describe('Confirm Action', () => {
    it('calls onConfirm when button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <MobileColumnMapper
          filename="test.csv"
          totalRows={100}
          columnMappings={defaultMappings}
          previewData={defaultPreviewData}
          onMappingChange={mockOnMappingChange}
          onConfirm={mockOnConfirm}
        />
      );

      const confirmButton = screen.getByRole('button', { name: /Confirm mappings and process/i });
      await user.click(confirmButton);

      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    });

    it('shows Processing text when isConfirming is true', () => {
      render(
        <MobileColumnMapper
          filename="test.csv"
          totalRows={100}
          columnMappings={defaultMappings}
          previewData={defaultPreviewData}
          onMappingChange={mockOnMappingChange}
          onConfirm={mockOnConfirm}
          isConfirming={true}
        />
      );

      expect(screen.getByText('Processing...')).toBeInTheDocument();
    });

    it('disables button when isConfirming is true', () => {
      render(
        <MobileColumnMapper
          filename="test.csv"
          totalRows={100}
          columnMappings={defaultMappings}
          previewData={defaultPreviewData}
          onMappingChange={mockOnMappingChange}
          onConfirm={mockOnConfirm}
          isConfirming={true}
        />
      );

      expect(screen.getByRole('button', { name: /Processing/i })).toBeDisabled();
    });
  });

  describe('Status Indicators', () => {
    it('shows Mapped chip for mapped columns', () => {
      render(
        <MobileColumnMapper
          filename="test.csv"
          totalRows={100}
          columnMappings={defaultMappings}
          previewData={defaultPreviewData}
          onMappingChange={mockOnMappingChange}
          onConfirm={mockOnConfirm}
        />
      );

      const mappedChips = screen.getAllByText('Mapped');
      expect(mappedChips.length).toBe(3); // Part Number, Mfr, Qty are mapped
    });

    it('shows Ignored chip for ignored columns', () => {
      render(
        <MobileColumnMapper
          filename="test.csv"
          totalRows={100}
          columnMappings={defaultMappings}
          previewData={defaultPreviewData}
          onMappingChange={mockOnMappingChange}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText('Ignored')).toBeInTheDocument();
    });

    it('displays footer statistics', () => {
      render(
        <MobileColumnMapper
          filename="test.csv"
          totalRows={100}
          columnMappings={defaultMappings}
          previewData={defaultPreviewData}
          onMappingChange={mockOnMappingChange}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText(/3 columns mapped/i)).toBeInTheDocument();
      expect(screen.getByText(/1 ignored/i)).toBeInTheDocument();
    });
  });

  describe('Info Messages', () => {
    it('shows info alert with instructions', () => {
      render(
        <MobileColumnMapper
          filename="test.csv"
          totalRows={100}
          columnMappings={defaultMappings}
          previewData={defaultPreviewData}
          onMappingChange={mockOnMappingChange}
          onConfirm={mockOnConfirm}
        />
      );

      expect(
        screen.getByText(/Tap each column to review and adjust the mapping/i)
      ).toBeInTheDocument();
    });
  });

  describe('Test IDs', () => {
    it('applies data-testid to the card', () => {
      render(
        <MobileColumnMapper
          filename="test.csv"
          totalRows={100}
          columnMappings={defaultMappings}
          previewData={defaultPreviewData}
          onMappingChange={mockOnMappingChange}
          onConfirm={mockOnConfirm}
          data-testid="mobile-mapper"
        />
      );

      expect(screen.getByTestId('mobile-mapper')).toBeInTheDocument();
    });
  });

  describe('Empty Sample Data', () => {
    it('handles empty preview data gracefully', async () => {
      const user = userEvent.setup();

      render(
        <MobileColumnMapper
          filename="test.csv"
          totalRows={100}
          columnMappings={defaultMappings}
          previewData={[]}
          onMappingChange={mockOnMappingChange}
          onConfirm={mockOnConfirm}
        />
      );

      // Expand an accordion
      const accordion = screen.getByText('Part Number').closest('[role="button"]');
      if (accordion) {
        await user.click(accordion);
      }

      // Multiple accordions may show "No sample data", so check for at least one
      const noDataElements = screen.getAllByText('No sample data');
      expect(noDataElements.length).toBeGreaterThan(0);
    });

    it('shows (empty) for null/undefined values in sample data', async () => {
      const user = userEvent.setup();
      const dataWithEmptyValues = [
        { 'Part Number': 'ABC123', Mfr: null, Qty: '', Notes: undefined },
      ];

      render(
        <MobileColumnMapper
          filename="test.csv"
          totalRows={100}
          columnMappings={defaultMappings}
          previewData={dataWithEmptyValues}
          onMappingChange={mockOnMappingChange}
          onConfirm={mockOnConfirm}
        />
      );

      // Expand the Mfr accordion
      const accordion = screen.getByText('Mfr').closest('[role="button"]');
      if (accordion) {
        await user.click(accordion);
      }

      // There may be multiple (empty) elements, just check that at least one exists
      const emptyElements = screen.getAllByText('(empty)');
      expect(emptyElements.length).toBeGreaterThan(0);
    });
  });
});
