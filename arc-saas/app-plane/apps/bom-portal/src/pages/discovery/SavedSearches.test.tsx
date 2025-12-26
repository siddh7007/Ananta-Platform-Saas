/**
 * SavedSearches Tests
 *
 * Tests for saved search functionality with localStorage persistence.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/test-utils';
import { SavedSearches, type SavedSearch } from './SavedSearches';
import type { ComponentFilterState } from './ComponentFilters';

const mockFilters: ComponentFilterState = {
  suppliers: [],
  lifecycleStatuses: [],
  complianceFlags: [],
  priceRange: [0, 100],
  riskLevels: [],
};

const mockSavedSearch: SavedSearch = {
  id: '1',
  name: 'Active MCUs',
  description: 'Microcontrollers in active status',
  query: 'ATMEGA',
  searchType: 'mpn',
  filters: { ...mockFilters, lifecycleStatuses: ['Active'] },
  createdAt: new Date().toISOString(),
};

describe('SavedSearches', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders save button', () => {
    render(
      <SavedSearches
        currentQuery="test"
        currentSearchType="mpn"
        currentFilters={mockFilters}
        onLoadSearch={vi.fn()}
      />
    );

    expect(screen.getByText(/save current search/i)).toBeInTheDocument();
  });

  it('disables save button when query is empty', () => {
    render(
      <SavedSearches
        currentQuery=""
        currentSearchType="mpn"
        currentFilters={mockFilters}
        onLoadSearch={vi.fn()}
      />
    );

    const saveButton = screen.getByText(/save current search/i).closest('button');
    expect(saveButton).toBeDisabled();
  });

  it('shows empty state when no saved searches', () => {
    render(
      <SavedSearches
        currentQuery="test"
        currentSearchType="mpn"
        currentFilters={mockFilters}
        onLoadSearch={vi.fn()}
      />
    );

    expect(screen.getByText(/no saved searches/i)).toBeInTheDocument();
  });

  it('opens save dialog when save button is clicked', () => {
    render(
      <SavedSearches
        currentQuery="ATMEGA"
        currentSearchType="mpn"
        currentFilters={mockFilters}
        onLoadSearch={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText(/save current search/i));

    expect(screen.getByText(/save search/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/search name/i)).toBeInTheDocument();
  });

  it('saves search to localStorage', async () => {
    render(
      <SavedSearches
        currentQuery="ATMEGA"
        currentSearchType="mpn"
        currentFilters={mockFilters}
        onLoadSearch={vi.fn()}
      />
    );

    // Open dialog
    fireEvent.click(screen.getByText(/save current search/i));

    // Enter name
    const nameInput = screen.getByLabelText(/search name/i);
    fireEvent.change(nameInput, { target: { value: 'My MCU Search' } });

    // Save
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      const stored = localStorage.getItem('component_saved_searches');
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(parsed[0].name).toBe('My MCU Search');
    });
  });

  it('loads saved searches from localStorage', () => {
    localStorage.setItem(
      'component_saved_searches',
      JSON.stringify([mockSavedSearch])
    );

    render(
      <SavedSearches
        currentQuery="test"
        currentSearchType="mpn"
        currentFilters={mockFilters}
        onLoadSearch={vi.fn()}
      />
    );

    expect(screen.getByText('Active MCUs')).toBeInTheDocument();
  });

  it('calls onLoadSearch when a saved search is clicked', () => {
    localStorage.setItem(
      'component_saved_searches',
      JSON.stringify([mockSavedSearch])
    );

    const onLoadSearch = vi.fn();
    render(
      <SavedSearches
        currentQuery="test"
        currentSearchType="mpn"
        currentFilters={mockFilters}
        onLoadSearch={onLoadSearch}
      />
    );

    fireEvent.click(screen.getByText('Active MCUs'));

    expect(onLoadSearch).toHaveBeenCalledWith(mockSavedSearch);
  });

  it('deletes search when delete is clicked', async () => {
    localStorage.setItem(
      'component_saved_searches',
      JSON.stringify([mockSavedSearch])
    );

    render(
      <SavedSearches
        currentQuery="test"
        currentSearchType="mpn"
        currentFilters={mockFilters}
        onLoadSearch={vi.fn()}
      />
    );

    // Open menu
    const menuButton = screen.getByRole('button', { name: '' });
    fireEvent.click(menuButton);

    // Click delete
    fireEvent.click(screen.getByText(/delete/i));

    await waitFor(() => {
      expect(screen.queryByText('Active MCUs')).not.toBeInTheDocument();
    });
  });

  it('handles localStorage quota error gracefully', () => {
    // Mock localStorage.setItem to throw
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = vi.fn().mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <SavedSearches
        currentQuery="ATMEGA"
        currentSearchType="mpn"
        currentFilters={mockFilters}
        onLoadSearch={vi.fn()}
      />
    );

    // Should not crash
    fireEvent.click(screen.getByText(/save current search/i));
    fireEvent.change(screen.getByLabelText(/search name/i), {
      target: { value: 'Test' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    // Restore
    Storage.prototype.setItem = originalSetItem;
    consoleSpy.mockRestore();
  });
});
