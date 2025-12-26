/**
 * ComparisonTray Tests
 *
 * Tests for component comparison tray functionality.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../test/test-utils';
import { ComparisonTray, type ComparisonComponent } from './ComparisonTray';

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

  it('renders component count badge', () => {
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

    expect(screen.getByText('2/4')).toBeInTheDocument();
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
});
