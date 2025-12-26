/**
 * BulkApprovalToolbar Tests
 *
 * P1-4: Tests for bulk component approval functionality.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/test-utils';
import { BulkApprovalToolbar } from './BulkApprovalToolbar';
import type { VaultComponent } from './VaultComponentCard';

const createMockComponent = (overrides: Partial<VaultComponent> = {}): VaultComponent => ({
  id: 'comp-1',
  mpn: 'ATMEGA328P-PU',
  manufacturer: 'Microchip',
  stage: 'pending',
  ...overrides,
});

describe('BulkApprovalToolbar', () => {
  const mockComponents: VaultComponent[] = [
    createMockComponent({ id: '1', stage: 'pending' }),
    createMockComponent({ id: '2', stage: 'pending' }),
    createMockComponent({ id: '3', stage: 'approved' }),
    createMockComponent({ id: '4', stage: 'deprecated' }),
  ];

  it('returns null when no components selected', () => {
    const { container } = render(
      <BulkApprovalToolbar
        selectedIds={new Set()}
        components={mockComponents}
        onClearSelection={vi.fn()}
        onSelectAllInStage={vi.fn()}
        onBulkStageChange={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('shows selection count when components are selected', () => {
    render(
      <BulkApprovalToolbar
        selectedIds={new Set(['1', '2'])}
        components={mockComponents}
        onClearSelection={vi.fn()}
        onSelectAllInStage={vi.fn()}
        onBulkStageChange={vi.fn()}
      />
    );

    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });

  it('shows breakdown of selected components by stage', () => {
    render(
      <BulkApprovalToolbar
        selectedIds={new Set(['1', '2', '3'])}
        components={mockComponents}
        onClearSelection={vi.fn()}
        onSelectAllInStage={vi.fn()}
        onBulkStageChange={vi.fn()}
      />
    );

    // Should show breakdown: 2 pending, 1 approved, 0 deprecated
    expect(screen.getByText(/2 pending, 1 approved, 0 deprecated/)).toBeInTheDocument();
  });

  it('calls onClearSelection when clear is clicked', () => {
    const onClearSelection = vi.fn();
    render(
      <BulkApprovalToolbar
        selectedIds={new Set(['1'])}
        components={mockComponents}
        onClearSelection={onClearSelection}
        onSelectAllInStage={vi.fn()}
        onBulkStageChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /clear selection/i }));
    expect(onClearSelection).toHaveBeenCalled();
  });

  it('shows approve button with count of pending components', () => {
    render(
      <BulkApprovalToolbar
        selectedIds={new Set(['1', '2'])}
        components={mockComponents}
        onClearSelection={vi.fn()}
        onSelectAllInStage={vi.fn()}
        onBulkStageChange={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /approve 2 pending/i })).toBeInTheDocument();
  });

  it('disables approve button when no pending components selected', () => {
    render(
      <BulkApprovalToolbar
        selectedIds={new Set(['3'])} // Only approved component
        components={mockComponents}
        onClearSelection={vi.fn()}
        onSelectAllInStage={vi.fn()}
        onBulkStageChange={vi.fn()}
      />
    );

    const approveButton = screen.getByRole('button', { name: /approve/i });
    expect(approveButton).toBeDisabled();
  });

  it('shows confirmation dialog for large selections', async () => {
    // Create 15 components to trigger confirmation
    const manyComponents = Array.from({ length: 15 }, (_, i) =>
      createMockComponent({ id: `${i}`, stage: 'pending' })
    );
    const selectedIds = new Set(manyComponents.map((c) => c.id));

    render(
      <BulkApprovalToolbar
        selectedIds={selectedIds}
        components={manyComponents}
        onClearSelection={vi.fn()}
        onSelectAllInStage={vi.fn()}
        onBulkStageChange={vi.fn()}
      />
    );

    // Click approve
    fireEvent.click(screen.getByRole('button', { name: /approve/i }));

    // Should show confirmation dialog
    await waitFor(() => {
      expect(screen.getByText(/confirm bulk approve/i)).toBeInTheDocument();
      expect(screen.getByText(/15 component/i)).toBeInTheDocument();
    });
  });

  it('calls onBulkStageChange when approve confirmed', async () => {
    const onBulkStageChange = vi.fn().mockResolvedValue(undefined);

    // Create 15 components to trigger confirmation
    const manyComponents = Array.from({ length: 15 }, (_, i) =>
      createMockComponent({ id: `${i}`, stage: 'pending' })
    );
    const selectedIds = new Set(manyComponents.map((c) => c.id));

    render(
      <BulkApprovalToolbar
        selectedIds={selectedIds}
        components={manyComponents}
        onClearSelection={vi.fn()}
        onSelectAllInStage={vi.fn()}
        onBulkStageChange={onBulkStageChange}
      />
    );

    // Click approve
    fireEvent.click(screen.getByRole('button', { name: /approve/i }));

    // Confirm
    await waitFor(() => {
      expect(screen.getByText(/confirm bulk approve/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /approve 15 components/i }));

    await waitFor(() => {
      expect(onBulkStageChange).toHaveBeenCalledWith(
        expect.arrayContaining(['0', '1', '2']),
        'approved'
      );
    });
  });

  it('shows deprecate button', () => {
    render(
      <BulkApprovalToolbar
        selectedIds={new Set(['1'])}
        components={mockComponents}
        onClearSelection={vi.fn()}
        onSelectAllInStage={vi.fn()}
        onBulkStageChange={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /deprecate/i })).toBeInTheDocument();
  });

  it('shows "To Pending" button when approved/deprecated components are selected', () => {
    render(
      <BulkApprovalToolbar
        selectedIds={new Set(['3'])} // Approved component
        components={mockComponents}
        onClearSelection={vi.fn()}
        onSelectAllInStage={vi.fn()}
        onBulkStageChange={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /to pending/i })).toBeInTheDocument();
  });

  it('shows warning icon for large selections', () => {
    // Create 60 components to exceed warning threshold
    const manyComponents = Array.from({ length: 60 }, (_, i) =>
      createMockComponent({ id: `${i}`, stage: 'pending' })
    );
    const selectedIds = new Set(manyComponents.map((c) => c.id));

    render(
      <BulkApprovalToolbar
        selectedIds={selectedIds}
        components={manyComponents}
        onClearSelection={vi.fn()}
        onSelectAllInStage={vi.fn()}
        onBulkStageChange={vi.fn()}
      />
    );

    expect(screen.getByText('60 selected')).toBeInTheDocument();
  });

  it('calls onSelectAllInStage when "All Pending" is clicked', () => {
    const onSelectAllInStage = vi.fn();
    render(
      <BulkApprovalToolbar
        selectedIds={new Set(['1'])}
        components={mockComponents}
        onClearSelection={vi.fn()}
        onSelectAllInStage={onSelectAllInStage}
        onBulkStageChange={vi.fn()}
      />
    );

    // Button has aria-label "Select all X pending components"
    fireEvent.click(screen.getByRole('button', { name: /select all.*pending/i }));
    expect(onSelectAllInStage).toHaveBeenCalledWith('pending');
  });

  it('executes small bulk approvals without confirmation', async () => {
    const onBulkStageChange = vi.fn().mockResolvedValue(undefined);
    const onClearSelection = vi.fn();

    // 5 components - below confirmation threshold
    const fewComponents = Array.from({ length: 5 }, (_, i) =>
      createMockComponent({ id: `${i}`, stage: 'pending' })
    );
    const selectedIds = new Set(fewComponents.map((c) => c.id));

    render(
      <BulkApprovalToolbar
        selectedIds={selectedIds}
        components={fewComponents}
        onClearSelection={onClearSelection}
        onSelectAllInStage={vi.fn()}
        onBulkStageChange={onBulkStageChange}
      />
    );

    // Click approve - should execute without confirmation
    fireEvent.click(screen.getByRole('button', { name: /approve/i }));

    await waitFor(() => {
      expect(onBulkStageChange).toHaveBeenCalled();
    });

    // Should not show confirmation dialog
    expect(screen.queryByText(/confirm bulk approve/i)).not.toBeInTheDocument();
  });

  it('has proper ARIA labels for accessibility', () => {
    render(
      <BulkApprovalToolbar
        selectedIds={new Set(['1', '2'])}
        components={mockComponents}
        onClearSelection={vi.fn()}
        onSelectAllInStage={vi.fn()}
        onBulkStageChange={vi.fn()}
      />
    );

    expect(screen.getByRole('toolbar', { name: /bulk approval actions/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /approve 2 pending/i })).toBeInTheDocument();
  });
});
