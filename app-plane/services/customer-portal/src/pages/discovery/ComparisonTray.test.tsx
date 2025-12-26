/**
 * ComparisonTray Tests
 *
 * Tests for component comparison tray functionality.
 * P1-2: Updated to test unlimited comparison support.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../test/test-utils';
import { ComparisonTray, type ComparisonComponent } from './ComparisonTray';
import { COMPARISON_CONFIG } from '../../config/comparison';

const createMockComponent = (overrides = {}): ComparisonComponent => ({
  id: 'comp-1',
  mpn: 'ATMEGA328P-PU',
  manufacturer: 'Microchip',
  description: '8-bit MCU',
  category: 'Microcontrollers',
  quality_score: 95,
  lifecycle_status: 'Active',
  unit_price: 2.5,
  stock_quantity: 1000,
  lead_time_days: 7,
  rohs_compliant: true,
  ...overrides,
});

describe('ComparisonTray', () => {
  it('returns null when no components are selected', () => {
    const { container } = render(
      <ComparisonTray
        components={[]}
        onRemove={vi.fn()}
        onClear={vi.fn()}
        onSendToVault={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders component count badge with unlimited display', () => {
    const components = [
      createMockComponent({ id: '1', mpn: 'COMP-1' }),
      createMockComponent({ id: '2', mpn: 'COMP-2' }),
    ];

    render(
      <ComparisonTray
        components={components}
        onRemove={vi.fn()}
        onClear={vi.fn()}
        onSendToVault={vi.fn()}
      />
    );

    // P1-2: With unlimited comparisons (Infinity), shows "X selected" instead of "X/Y"
    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });

  it('renders component MPNs in chips', () => {
    const components = [
      createMockComponent({ id: '1', mpn: 'ATMEGA328P' }),
      createMockComponent({ id: '2', mpn: 'STM32F103' }),
    ];

    render(
      <ComparisonTray
        components={components}
        onRemove={vi.fn()}
        onClear={vi.fn()}
        onSendToVault={vi.fn()}
      />
    );

    // MPNs may appear in multiple places (chips, table headers), so use getAllByText
    expect(screen.getAllByText('ATMEGA328P').length).toBeGreaterThan(0);
    expect(screen.getAllByText('STM32F103').length).toBeGreaterThan(0);
  });

  it('calls onRemove when component is removed', () => {
    const onRemove = vi.fn();
    const components = [createMockComponent({ id: 'test-id', mpn: 'TEST-MPN' })];

    render(
      <ComparisonTray
        components={components}
        onRemove={onRemove}
        onClear={vi.fn()}
        onSendToVault={vi.fn()}
      />
    );

    // Click delete on the chip
    const deleteButtons = screen.getAllByTestId('CancelIcon');
    if (deleteButtons.length > 0) {
      fireEvent.click(deleteButtons[0]);
      expect(onRemove).toHaveBeenCalledWith('test-id');
    }
  });

  it('calls onClear when clear all is clicked', () => {
    const onClear = vi.fn();
    const components = [createMockComponent()];

    render(
      <ComparisonTray
        components={components}
        onRemove={vi.fn()}
        onClear={onClear}
        onSendToVault={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText(/clear all/i));

    expect(onClear).toHaveBeenCalled();
  });

  it('calls onSendToVault when send button is clicked', () => {
    const onSendToVault = vi.fn();
    const components = [createMockComponent()];

    render(
      <ComparisonTray
        components={components}
        onRemove={vi.fn()}
        onClear={vi.fn()}
        onSendToVault={onSendToVault}
      />
    );

    fireEvent.click(screen.getByText(/send to vault/i));

    expect(onSendToVault).toHaveBeenCalledWith(components);
  });

  it('expands to show comparison table when header is clicked', () => {
    const components = [
      createMockComponent({ id: '1', manufacturer: 'Microchip' }),
      createMockComponent({ id: '2', manufacturer: 'STMicro' }),
    ];

    render(
      <ComparisonTray
        components={components}
        onRemove={vi.fn()}
        onClear={vi.fn()}
        onSendToVault={vi.fn()}
      />
    );

    // Click to expand
    fireEvent.click(screen.getByText('Compare Components'));

    // Should show attribute labels
    expect(screen.getByText('Manufacturer')).toBeInTheDocument();
    expect(screen.getByText('Lifecycle')).toBeInTheDocument();
  });

  it('respects custom maxComponents limit', () => {
    const components = [
      createMockComponent({ id: '1' }),
      createMockComponent({ id: '2' }),
    ];

    render(
      <ComparisonTray
        components={components}
        onRemove={vi.fn()}
        onClear={vi.fn()}
        onSendToVault={vi.fn()}
        maxComponents={6}
      />
    );

    expect(screen.getByText('2/6')).toBeInTheDocument();
  });

  it('uses custom sidebar width when provided', () => {
    const components = [createMockComponent()];

    const { container } = render(
      <ComparisonTray
        components={components}
        onRemove={vi.fn()}
        onClear={vi.fn()}
        onSendToVault={vi.fn()}
        sidebarWidth={300}
      />
    );

    // Component should render without errors with custom width
    expect(container.querySelector('.MuiPaper-root')).toBeInTheDocument();
  });

  describe('P1-2: Unlimited Comparison Features', () => {
    it('shows "+N more" chip when components exceed collapsed display limit', () => {
      const components = Array.from({ length: 10 }, (_, i) =>
        createMockComponent({ id: `${i}`, mpn: `COMP-${i}` })
      );

      render(
        <ComparisonTray
          components={components}
          onRemove={vi.fn()}
          onClear={vi.fn()}
          onSendToVault={vi.fn()}
        />
      );

      // Should show "+N more" based on collapsedDisplayLimit (default 6)
      const moreChip = screen.getByText(`+${10 - COMPARISON_CONFIG.collapsedDisplayLimit} more`);
      expect(moreChip).toBeInTheDocument();
    });

    it('expands when "+N more" chip is clicked', () => {
      const components = Array.from({ length: 10 }, (_, i) =>
        createMockComponent({ id: `${i}`, mpn: `COMP-${i}`, manufacturer: `Mfg-${i}` })
      );

      render(
        <ComparisonTray
          components={components}
          onRemove={vi.fn()}
          onClear={vi.fn()}
          onSendToVault={vi.fn()}
        />
      );

      // Click the "+N more" chip
      const moreChip = screen.getByText(`+${10 - COMPARISON_CONFIG.collapsedDisplayLimit} more`);
      fireEvent.click(moreChip);

      // Should show expanded table with attribute labels
      expect(screen.getByText('Manufacturer')).toBeInTheDocument();
    });

    it('shows performance warning when many components selected', () => {
      // Create more components than the warning threshold
      const components = Array.from(
        { length: COMPARISON_CONFIG.performanceWarningThreshold + 5 },
        (_, i) => createMockComponent({ id: `${i}`, mpn: `COMP-${i}` })
      );

      render(
        <ComparisonTray
          components={components}
          onRemove={vi.fn()}
          onClear={vi.fn()}
          onSendToVault={vi.fn()}
        />
      );

      // Click to expand
      fireEvent.click(screen.getByText('Compare Components'));

      // Should show performance warning
      expect(screen.getByText(/Consider filtering to fewer items/)).toBeInTheDocument();
    });

    it('handles many components without crashing', () => {
      const components = Array.from({ length: 50 }, (_, i) =>
        createMockComponent({ id: `${i}`, mpn: `COMP-${i}` })
      );

      const { container } = render(
        <ComparisonTray
          components={components}
          onRemove={vi.fn()}
          onClear={vi.fn()}
          onSendToVault={vi.fn()}
        />
      );

      expect(container.querySelector('.MuiPaper-root')).toBeInTheDocument();
      expect(screen.getByText('50 selected')).toBeInTheDocument();
    });

    it('shows fraction format when maxComponents is finite', () => {
      const components = [
        createMockComponent({ id: '1' }),
        createMockComponent({ id: '2' }),
      ];

      render(
        <ComparisonTray
          components={components}
          onRemove={vi.fn()}
          onClear={vi.fn()}
          onSendToVault={vi.fn()}
          maxComponents={10}
        />
      );

      expect(screen.getByText('2/10')).toBeInTheDocument();
    });
  });
});
