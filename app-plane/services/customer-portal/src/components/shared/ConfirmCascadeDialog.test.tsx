/**
 * ConfirmCascadeDialog Tests
 *
 * Tests for destructive action confirmation dialog.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/test-utils';
import {
  ConfirmCascadeDialog,
  type CascadeDependency,
} from './ConfirmCascadeDialog';

const mockDependencies: CascadeDependency[] = [
  { type: 'bom', count: 5, label: 'BOMs' },
  { type: 'component', count: 150, label: 'Components' },
  { type: 'alert', count: 3, label: 'Alerts' },
];

describe('ConfirmCascadeDialog', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onConfirm: vi.fn().mockResolvedValue(undefined),
    title: 'Delete Project',
    message: 'This action cannot be undone.',
    targetName: 'My Project',
    targetType: 'Project',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog when open', () => {
    render(<ConfirmCascadeDialog {...defaultProps} />);

    expect(screen.getByText('Delete Project')).toBeInTheDocument();
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
  });

  it('shows target name and type', () => {
    render(<ConfirmCascadeDialog {...defaultProps} />);

    expect(screen.getByText('My Project')).toBeInTheDocument();
    expect(screen.getByText('Project')).toBeInTheDocument();
  });

  it('calls onClose when cancel is clicked', () => {
    const onClose = vi.fn();
    render(<ConfirmCascadeDialog {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByText('Cancel'));

    expect(onClose).toHaveBeenCalled();
  });

  it('calls onConfirm when confirm is clicked', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<ConfirmCascadeDialog {...defaultProps} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalled();
    });
  });

  it('shows dependencies when provided', () => {
    render(
      <ConfirmCascadeDialog {...defaultProps} dependencies={mockDependencies} />
    );

    expect(screen.getByText('BOMs')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Components')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
  });

  it('shows total affected resources count', () => {
    render(
      <ConfirmCascadeDialog {...defaultProps} dependencies={mockDependencies} />
    );

    // Total: 5 + 150 + 3 = 158
    expect(screen.getByText('158 resources')).toBeInTheDocument();
  });

  it('loads dependencies asynchronously', async () => {
    const loadDependencies = vi.fn().mockResolvedValue(mockDependencies);

    render(
      <ConfirmCascadeDialog
        {...defaultProps}
        loadDependencies={loadDependencies}
      />
    );

    // Should show loading state initially
    expect(screen.getByText(/loading/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('BOMs')).toBeInTheDocument();
    });

    expect(loadDependencies).toHaveBeenCalled();
  });

  it('shows error when loading dependencies fails', async () => {
    const loadDependencies = vi
      .fn()
      .mockRejectedValue(new Error('Network error'));

    render(
      <ConfirmCascadeDialog
        {...defaultProps}
        loadDependencies={loadDependencies}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });

  describe('Typed confirmation', () => {
    it('requires typing target name when requireTypedConfirmation is true', () => {
      render(
        <ConfirmCascadeDialog
          {...defaultProps}
          requireTypedConfirmation
        />
      );

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      expect(deleteButton).toBeDisabled();
    });

    it('enables delete when correct name is typed', () => {
      render(
        <ConfirmCascadeDialog
          {...defaultProps}
          requireTypedConfirmation
        />
      );

      const input = screen.getByPlaceholderText('My Project');
      fireEvent.change(input, { target: { value: 'My Project' } });

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      expect(deleteButton).not.toBeDisabled();
    });

    it('shows error when typed name does not match', () => {
      render(
        <ConfirmCascadeDialog
          {...defaultProps}
          requireTypedConfirmation
        />
      );

      const input = screen.getByPlaceholderText('My Project');
      fireEvent.change(input, { target: { value: 'Wrong Name' } });

      expect(screen.getByText(/does not match/i)).toBeInTheDocument();
    });
  });

  it('renders with warning severity without error', () => {
    // Test that component renders without throwing
    expect(() => {
      render(<ConfirmCascadeDialog {...defaultProps} severity="warning" />);
    }).not.toThrow();

    // Dialog content should be rendered
    expect(screen.getByText('Delete Project')).toBeInTheDocument();
  });

  it('renders with error severity without error', () => {
    // Test that component renders without throwing
    expect(() => {
      render(<ConfirmCascadeDialog {...defaultProps} severity="error" />);
    }).not.toThrow();

    // Dialog content should be rendered
    expect(screen.getByText('Delete Project')).toBeInTheDocument();
  });

  it('uses custom confirm button text', () => {
    render(
      <ConfirmCascadeDialog
        {...defaultProps}
        confirmButtonText="Remove Forever"
      />
    );

    expect(screen.getByText('Remove Forever')).toBeInTheDocument();
  });

  it('shows deleting state while confirming', async () => {
    const onConfirm = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );

    render(<ConfirmCascadeDialog {...defaultProps} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByText('Delete'));

    expect(screen.getByText(/deleting/i)).toBeInTheDocument();
  });
});
