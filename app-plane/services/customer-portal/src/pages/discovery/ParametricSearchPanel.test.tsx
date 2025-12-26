/**
 * ParametricSearchPanel Component Tests
 *
 * P1-1: Tests for parametric search panel with dynamic facets.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ParametricSearchPanel } from './ParametricSearchPanel';
import type {
  ParametricFilterState,
  SearchFacet,
} from '../../hooks/useParametricSearch';

// Default filter state for tests
const defaultFilters: ParametricFilterState = {
  suppliers: [],
  lifecycleStatuses: [],
  complianceFlags: [],
  priceRange: [0, 1000],
  riskLevels: [],
  stockAvailable: false,
  inProduction: false,
  qualityScoreMin: 0,
  leadTimeDaysMax: null,
  categories: [],
  manufacturers: [],
};

// Sample facets for testing
const sampleFacets: SearchFacet[] = [
  {
    name: 'manufacturers',
    label: 'Manufacturer',
    type: 'checkbox',
    values: [
      { value: 'Texas Instruments', label: 'Texas Instruments', count: 25 },
      { value: 'STMicroelectronics', label: 'STMicroelectronics', count: 18 },
      { value: 'NXP', label: 'NXP', count: 12 },
      { value: 'Analog Devices', label: 'Analog Devices', count: 8 },
      { value: 'Microchip', label: 'Microchip', count: 6 },
      { value: 'Infineon', label: 'Infineon', count: 4 },
    ],
  },
  {
    name: 'categories',
    label: 'Category',
    type: 'checkbox',
    values: [
      { value: 'Microcontrollers', label: 'Microcontrollers', count: 30 },
      { value: 'Op Amps', label: 'Op Amps', count: 20 },
      { value: 'Voltage Regulators', label: 'Voltage Regulators', count: 15 },
    ],
  },
  {
    name: 'lifecycleStatuses',
    label: 'Lifecycle Status',
    type: 'chip',
    values: [
      { value: 'Active', label: 'Active', count: 50 },
      { value: 'NRND', label: 'NRND', count: 10 },
      { value: 'Obsolete', label: 'Obsolete', count: 5 },
    ],
  },
  {
    name: 'riskLevels',
    label: 'Risk Level',
    type: 'chip',
    values: [
      { value: 'Low', label: 'Low', count: 40 },
      { value: 'Medium', label: 'Medium', count: 20 },
      { value: 'High', label: 'High', count: 5 },
    ],
  },
  {
    name: 'complianceFlags',
    label: 'Compliance',
    type: 'checkbox',
    values: [
      { value: 'RoHS', label: 'RoHS', count: 60 },
      { value: 'REACH', label: 'REACH', count: 55 },
      { value: 'Halogen-Free', label: 'Halogen-Free', count: 30 },
    ],
  },
  {
    name: 'suppliers',
    label: 'Supplier',
    type: 'checkbox',
    values: [
      { value: 'DigiKey', label: 'DigiKey', count: 45 },
      { value: 'Mouser', label: 'Mouser', count: 40 },
    ],
  },
];

describe('ParametricSearchPanel', () => {
  const mockOnFilterChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders filter header with icon', () => {
      render(
        <ParametricSearchPanel
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          facets={sampleFacets}
        />
      );

      expect(screen.getByText('Filters')).toBeInTheDocument();
    });

    it('renders all filter sections', () => {
      render(
        <ParametricSearchPanel
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          facets={sampleFacets}
        />
      );

      expect(screen.getByText('Manufacturer')).toBeInTheDocument();
      expect(screen.getByText('Category')).toBeInTheDocument();
      expect(screen.getByText('Lifecycle Status')).toBeInTheDocument();
      expect(screen.getByText('Risk Level')).toBeInTheDocument();
      expect(screen.getByText('Compliance')).toBeInTheDocument();
      expect(screen.getByText('Quality Score')).toBeInTheDocument();
      expect(screen.getByText('Price Range')).toBeInTheDocument();
    });

    it('shows quick toggle switches', () => {
      render(
        <ParametricSearchPanel
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          facets={sampleFacets}
        />
      );

      expect(screen.getByText('In Stock Only')).toBeInTheDocument();
      expect(screen.getByText('Active Parts Only')).toBeInTheDocument();
    });

    it('displays results count when provided', () => {
      render(
        <ParametricSearchPanel
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          facets={sampleFacets}
          filteredCount={45}
          totalCount={100}
        />
      );

      expect(screen.getByText('45 of 100')).toBeInTheDocument();
    });

    it('shows loading skeleton when loading', () => {
      render(
        <ParametricSearchPanel
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          facets={[]}
          loading={true}
        />
      );

      // Should render skeleton instead of manufacturer facet
      expect(screen.queryByText('Texas Instruments')).not.toBeInTheDocument();
    });
  });

  describe('Active Filter Badge', () => {
    it('shows active filter count badge when filters are applied', () => {
      const filtersWithActive: ParametricFilterState = {
        ...defaultFilters,
        lifecycleStatuses: ['Active'],
        stockAvailable: true,
      };

      render(
        <ParametricSearchPanel
          filters={filtersWithActive}
          onFilterChange={mockOnFilterChange}
          facets={sampleFacets}
        />
      );

      // Should show badge with count 2
      expect(screen.getByLabelText('2 active filters')).toBeInTheDocument();
    });

    it('shows Clear button when filters are active', () => {
      const filtersWithActive: ParametricFilterState = {
        ...defaultFilters,
        lifecycleStatuses: ['Active'],
      };

      render(
        <ParametricSearchPanel
          filters={filtersWithActive}
          onFilterChange={mockOnFilterChange}
          facets={sampleFacets}
        />
      );

      expect(screen.getByText('Clear')).toBeInTheDocument();
    });

    it('does not show Clear button when no filters are active', () => {
      render(
        <ParametricSearchPanel
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          facets={sampleFacets}
        />
      );

      expect(screen.queryByText('Clear')).not.toBeInTheDocument();
    });
  });

  describe('Filter Interactions', () => {
    it('calls onFilterChange when toggling stock availability', async () => {
      const user = userEvent.setup();

      render(
        <ParametricSearchPanel
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          facets={sampleFacets}
        />
      );

      const stockSwitch = screen.getByRole('checkbox', { name: /in stock only/i });
      await user.click(stockSwitch);

      expect(mockOnFilterChange).toHaveBeenCalledWith({ stockAvailable: true });
    });

    it('calls onFilterChange when toggling active parts only', async () => {
      const user = userEvent.setup();

      render(
        <ParametricSearchPanel
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          facets={sampleFacets}
        />
      );

      const activeSwitch = screen.getByRole('checkbox', { name: /active parts only/i });
      await user.click(activeSwitch);

      expect(mockOnFilterChange).toHaveBeenCalledWith({ inProduction: true });
    });

    it('calls onFilterChange when clicking Clear button', async () => {
      const user = userEvent.setup();
      const filtersWithActive: ParametricFilterState = {
        ...defaultFilters,
        lifecycleStatuses: ['Active'],
      };

      render(
        <ParametricSearchPanel
          filters={filtersWithActive}
          onFilterChange={mockOnFilterChange}
          facets={sampleFacets}
        />
      );

      await user.click(screen.getByText('Clear'));

      expect(mockOnFilterChange).toHaveBeenCalledWith(
        expect.objectContaining({
          suppliers: [],
          lifecycleStatuses: [],
          complianceFlags: [],
          riskLevels: [],
          stockAvailable: false,
          inProduction: false,
          qualityScoreMin: 0,
          leadTimeDaysMax: null,
          categories: [],
          manufacturers: [],
        })
      );
    });

    it('calls onFilterChange when selecting manufacturer checkbox', async () => {
      const user = userEvent.setup();

      render(
        <ParametricSearchPanel
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          facets={sampleFacets}
        />
      );

      // Click on Texas Instruments checkbox
      const tiCheckbox = screen.getByRole('checkbox', { name: /texas instruments/i });
      await user.click(tiCheckbox);

      expect(mockOnFilterChange).toHaveBeenCalledWith({
        manufacturers: ['Texas Instruments'],
      });
    });

    it('calls onFilterChange when clicking lifecycle chip', async () => {
      const user = userEvent.setup();

      render(
        <ParametricSearchPanel
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          facets={sampleFacets}
        />
      );

      // Click on Active chip
      const activeChip = screen.getByText('Active');
      await user.click(activeChip);

      expect(mockOnFilterChange).toHaveBeenCalledWith({
        lifecycleStatuses: ['Active'],
      });
    });

    it('removes filter when clicking already selected chip', async () => {
      const user = userEvent.setup();
      const filtersWithActive: ParametricFilterState = {
        ...defaultFilters,
        lifecycleStatuses: ['Active'],
      };

      render(
        <ParametricSearchPanel
          filters={filtersWithActive}
          onFilterChange={mockOnFilterChange}
          facets={sampleFacets}
        />
      );

      // Click on Active chip again to deselect
      const activeChip = screen.getByText('Active');
      await user.click(activeChip);

      expect(mockOnFilterChange).toHaveBeenCalledWith({
        lifecycleStatuses: [],
      });
    });
  });

  describe('Facet Counts', () => {
    it('displays facet value counts', () => {
      render(
        <ParametricSearchPanel
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          facets={sampleFacets}
        />
      );

      // Check manufacturer counts are displayed
      expect(screen.getByText('25')).toBeInTheDocument(); // Texas Instruments
      expect(screen.getByText('18')).toBeInTheDocument(); // STMicroelectronics
    });

    it('shows selected filter count in section header', () => {
      const filtersWithSelected: ParametricFilterState = {
        ...defaultFilters,
        manufacturers: ['Texas Instruments', 'STMicroelectronics'],
      };

      render(
        <ParametricSearchPanel
          filters={filtersWithSelected}
          onFilterChange={mockOnFilterChange}
          facets={sampleFacets}
        />
      );

      // Find the Manufacturer section and check for count badge
      const manufacturerSection = screen.getByText('Manufacturer').closest('div');
      expect(manufacturerSection).toBeInTheDocument();

      // Should show "2" badge for 2 selected manufacturers
      const badges = screen.getAllByText('2');
      expect(badges.length).toBeGreaterThan(0);
    });
  });

  describe('Show More/Less', () => {
    it('shows "Show more" button when facet has many values', () => {
      render(
        <ParametricSearchPanel
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          facets={sampleFacets}
        />
      );

      // Manufacturers facet has 6 values, max visible is 5
      expect(screen.getByText(/show.*more/i)).toBeInTheDocument();
    });

    it('expands to show all values when clicking Show more', async () => {
      const user = userEvent.setup();

      render(
        <ParametricSearchPanel
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          facets={sampleFacets}
        />
      );

      const showMoreButton = screen.getByText(/show.*more/i);
      await user.click(showMoreButton);

      // Should now show all manufacturers including Infineon
      expect(screen.getByText('Infineon')).toBeInTheDocument();
      expect(screen.getByText('Show less')).toBeInTheDocument();
    });
  });

  describe('Slider Filters', () => {
    it('renders quality score slider', () => {
      render(
        <ParametricSearchPanel
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          facets={sampleFacets}
        />
      );

      expect(screen.getByText('Minimum quality score')).toBeInTheDocument();
    });

    it('shows quality score badge when filter is active', () => {
      const filtersWithQuality: ParametricFilterState = {
        ...defaultFilters,
        qualityScoreMin: 80,
      };

      render(
        <ParametricSearchPanel
          filters={filtersWithQuality}
          onFilterChange={mockOnFilterChange}
          facets={sampleFacets}
        />
      );

      expect(screen.getByText('≥80%')).toBeInTheDocument();
    });

    it('shows price range badge when filter is active', () => {
      const filtersWithPrice: ParametricFilterState = {
        ...defaultFilters,
        priceRange: [10, 500],
      };

      render(
        <ParametricSearchPanel
          filters={filtersWithPrice}
          onFilterChange={mockOnFilterChange}
          facets={sampleFacets}
        />
      );

      expect(screen.getByText('$10-$500')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes on filter panel', () => {
      render(
        <ParametricSearchPanel
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          facets={sampleFacets}
        />
      );

      expect(screen.getByRole('complementary')).toHaveAttribute(
        'aria-label',
        'Search filters'
      );
    });

    it('has accessible label on clear button', () => {
      const filtersWithActive: ParametricFilterState = {
        ...defaultFilters,
        stockAvailable: true,
      };

      render(
        <ParametricSearchPanel
          filters={filtersWithActive}
          onFilterChange={mockOnFilterChange}
          facets={sampleFacets}
        />
      );

      expect(
        screen.getByRole('button', { name: /clear all filters/i })
      ).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles empty facets gracefully', () => {
      render(
        <ParametricSearchPanel
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          facets={[]}
        />
      );

      // Should still render base structure
      expect(screen.getByText('Filters')).toBeInTheDocument();
      expect(screen.getByText('Lifecycle Status')).toBeInTheDocument();
    });

    it('handles facets with zero counts', () => {
      const facetsWithZero: SearchFacet[] = [
        {
          name: 'manufacturers',
          label: 'Manufacturer',
          type: 'checkbox',
          values: [{ value: 'Empty Mfr', label: 'Empty Mfr', count: 0 }],
        },
      ];

      render(
        <ParametricSearchPanel
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          facets={facetsWithZero}
        />
      );

      expect(screen.getByText('Empty Mfr')).toBeInTheDocument();
      // There may be multiple '0' elements, check that at least one exists
      const zeros = screen.getAllByText('0');
      expect(zeros.length).toBeGreaterThan(0);
    });

    it('handles very long manufacturer names with truncation', () => {
      const facetsWithLongNames: SearchFacet[] = [
        {
          name: 'manufacturers',
          label: 'Manufacturer',
          type: 'checkbox',
          values: [
            {
              value: 'Very Long Manufacturer Name That Should Be Truncated',
              label: 'Very Long Manufacturer Name That Should Be Truncated',
              count: 10,
            },
          ],
        },
      ];

      render(
        <ParametricSearchPanel
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          facets={facetsWithLongNames}
        />
      );

      const truncatedLabel = screen.getByTitle(
        'Very Long Manufacturer Name That Should Be Truncated'
      );
      expect(truncatedLabel).toBeInTheDocument();
    });
  });
});
