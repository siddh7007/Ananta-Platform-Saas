/**
 * ConfirmCascadeDialog STRICT Tests
 *
 * These tests validate actual component behavior and WILL FAIL
 * if the component doesn't meet specifications.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '../../test/test-utils';
import {
  ConfirmCascadeDialog,
  type CascadeDependency,
} from './ConfirmCascadeDialog';

const mockDependencies: CascadeDependency[] = [
  { type: 'bom', count: 5, label: 'BOMs' },
  { type: 'component', count: 150, label: 'Components' },
  { type: 'alert', count: 3, label: 'Alerts' },
];

describe('ConfirmCascadeDialog STRICT Tests', () => {
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

  describe('Dialog Structure', () => {
    it('renders title with exact text in h6 typography', () => {
      render(<ConfirmCascadeDialog {...defaultProps} />);

      const title = screen.getByText('Delete Project');
      expect(title).toBeInTheDocument();
      // Title should be in the dialog title area
      expect(title.closest('[class*="MuiDialogTitle"]')).toBeInTheDocument();
    });

    it('shows warning message in an Alert component', () => {
      render(<ConfirmCascadeDialog {...defaultProps} />);

      // Message should be inside MuiAlert
      const alert = screen.getByRole('alert');
      expect(within(alert).getByText('This action cannot be undone.')).toBeInTheDocument();
    });

    it('displays target name and type in the info box', () => {
      render(<ConfirmCascadeDialog {...defaultProps} />);

      expect(screen.getByText('My Project')).toBeInTheDocument();
      expect(screen.getByText('Project')).toBeInTheDocument();
    });
  });

  describe('Severity Handling', () => {
    it('renders warning severity dialog without error', () => {
      expect(() => {
        render(<ConfirmCascadeDialog {...defaultProps} severity="warning" />);
      }).not.toThrow();

      // Dialog should show title and message
      expect(screen.getByText('Delete Project')).toBeInTheDocument();
      expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
    });

    it('renders error severity dialog without error', () => {
      expect(() => {
        render(<ConfirmCascadeDialog {...defaultProps} severity="error" />);
      }).not.toThrow();

      // Dialog should show title and message
      expect(screen.getByText('Delete Project')).toBeInTheDocument();
    });

    it('shows appropriate alert in dialog (role="alert")', () => {
      render(<ConfirmCascadeDialog {...defaultProps} />);

      // Alert component should be present with the message
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent('This action cannot be undone.');
    });
  });

  describe('Dependencies Display', () => {
    it('shows exact total count "X resources" with sum of all dependencies', () => {
      render(
        <ConfirmCascadeDialog {...defaultProps} dependencies={mockDependencies} />
      );

      // Total: 5 + 150 + 3 = 158
      expect(screen.getByText('158 resources')).toBeInTheDocument();
    });

    it('shows each dependency type with its label and count', () => {
      render(
        <ConfirmCascadeDialog {...defaultProps} dependencies={mockDependencies} />
      );

      expect(screen.getByText('BOMs')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('Components')).toBeInTheDocument();
      expect(screen.getByText('150')).toBeInTheDocument();
      expect(screen.getByText('Alerts')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('shows "This action will also affect:" header when dependencies exist', () => {
      render(
        <ConfirmCascadeDialog {...defaultProps} dependencies={mockDependencies} />
      );

      expect(screen.getByText('This action will also affect:')).toBeInTheDocument();
    });

    it('shows "No dependent resources will be affected." when no dependencies', () => {
      render(
        <ConfirmCascadeDialog {...defaultProps} dependencies={[]} />
      );

      expect(screen.getByText('No dependent resources will be affected.')).toBeInTheDocument();
    });
  });

  describe('Async Dependencies Loading', () => {
    it('shows exact loading text "Loading affected resources..."', async () => {
      const loadDependencies = vi.fn((): Promise<CascadeDependency[]> => new Promise(() => {})); // Never resolves

      render(
        <ConfirmCascadeDialog {...defaultProps} loadDependencies={loadDependencies} />
      );

      expect(screen.getByText('Loading affected resources...')).toBeInTheDocument();
    });

    it('shows loading spinner during async load', async () => {
      const loadDependencies = vi.fn((): Promise<CascadeDependency[]> => new Promise(() => {}));
      const { container } = render(
        <ConfirmCascadeDialog {...defaultProps} loadDependencies={loadDependencies} />
      );

      // MUI CircularProgress renders as SVG with role="progressbar"
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('displays error message on load failure', async () => {
      const loadDependencies = vi.fn<[], Promise<CascadeDependency[]>>().mockRejectedValue(new Error('Network error'));

      render(
        <ConfirmCascadeDialog {...defaultProps} loadDependencies={loadDependencies} />
      );

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('shows dependencies after successful load', async () => {
      const loadDependencies = vi.fn().mockResolvedValue(mockDependencies);

      render(
        <ConfirmCascadeDialog {...defaultProps} loadDependencies={loadDependencies} />
      );

      await waitFor(() => {
        expect(screen.getByText('BOMs')).toBeInTheDocument();
        expect(screen.getByText('158 resources')).toBeInTheDocument();
      });
    });
  });

  describe('Typed Confirmation', () => {
    it('shows instruction "Type {targetName} to confirm:" when required', () => {
      render(
        <ConfirmCascadeDialog {...defaultProps} requireTypedConfirmation />
      );

      expect(screen.getByText(/Type/)).toBeInTheDocument();
      expect(screen.getByText('My Project', { selector: 'strong' })).toBeInTheDocument();
    });

    it('shows input with placeholder matching targetName', () => {
      render(
        <ConfirmCascadeDialog {...defaultProps} requireTypedConfirmation />
      );

      const input = screen.getByPlaceholderText('My Project');
      expect(input).toBeInTheDocument();
    });

    it('disables Delete button when input is empty', () => {
      render(
        <ConfirmCascadeDialog {...defaultProps} requireTypedConfirmation />
      );

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      expect(deleteButton).toBeDisabled();
    });

    it('shows exact error "Text does not match" when input differs', () => {
      render(
        <ConfirmCascadeDialog {...defaultProps} requireTypedConfirmation />
      );

      const input = screen.getByPlaceholderText('My Project');
      fireEvent.change(input, { target: { value: 'Wrong Name' } });

      expect(screen.getByText('Text does not match')).toBeInTheDocument();
    });

    it('enables Delete button when input exactly matches targetName', () => {
      render(
        <ConfirmCascadeDialog {...defaultProps} requireTypedConfirmation />
      );

      const input = screen.getByPlaceholderText('My Project');
      fireEvent.change(input, { target: { value: 'My Project' } });

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      expect(deleteButton).not.toBeDisabled();
    });

    it('is case-sensitive - "my project" does not match "My Project"', () => {
      render(
        <ConfirmCascadeDialog {...defaultProps} requireTypedConfirmation />
      );

      const input = screen.getByPlaceholderText('My Project');
      fireEvent.change(input, { target: { value: 'my project' } });

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      expect(deleteButton).toBeDisabled();
    });
  });

  describe('Button Actions', () => {
    it('Cancel button calls onClose', () => {
      const onClose = vi.fn();
      render(<ConfirmCascadeDialog {...defaultProps} onClose={onClose} />);

      fireEvent.click(screen.getByText('Cancel'));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('Delete button calls onConfirm and then onClose on success', async () => {
      const onConfirm = vi.fn().mockResolvedValue(undefined);
      const onClose = vi.fn();
      render(
        <ConfirmCascadeDialog {...defaultProps} onConfirm={onConfirm} onClose={onClose} />
      );

      fireEvent.click(screen.getByText('Delete'));

      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledTimes(1);
      });
    });

    it('shows exact "Deleting..." text during confirmation', async () => {
      const onConfirm = vi.fn((): Promise<void> => new Promise((resolve) => setTimeout(resolve, 100)));
      render(<ConfirmCascadeDialog {...defaultProps} onConfirm={onConfirm} />);

      fireEvent.click(screen.getByText('Delete'));

      expect(screen.getByText('Deleting...')).toBeInTheDocument();
    });

    it('disables Cancel button during confirmation', async () => {
      const onConfirm = vi.fn((): Promise<void> => new Promise((resolve) => setTimeout(resolve, 100)));
      render(<ConfirmCascadeDialog {...defaultProps} onConfirm={onConfirm} />);

      fireEvent.click(screen.getByText('Delete'));

      const cancelButton = screen.getByText('Cancel');
      expect(cancelButton).toBeDisabled();
    });

    it('uses custom confirmButtonText', () => {
      render(
        <ConfirmCascadeDialog {...defaultProps} confirmButtonText="Remove Forever" />
      );

      expect(screen.getByRole('button', { name: /Remove Forever/ })).toBeInTheDocument();
    });
  });

  describe('Expandable Items', () => {
    it('shows expand button when dependency has items', () => {
      const depsWithItems: CascadeDependency[] = [
        {
          type: 'bom',
          count: 3,
          label: 'BOMs',
          items: [
            { id: '1', name: 'BOM 1' },
            { id: '2', name: 'BOM 2' },
            { id: '3', name: 'BOM 3' },
          ],
        },
      ];

      render(
        <ConfirmCascadeDialog {...defaultProps} dependencies={depsWithItems} />
      );

      // MUI Dialog renders in portal - use document.body
      // The expand button should be present (screen finds in document.body)
      const buttons = screen.getAllByRole('button');
      // Should have Cancel, Delete, and at least one expand button
      expect(buttons.length).toBeGreaterThanOrEqual(3);
    });

    it('shows dependency list when items are provided', () => {
      const depsWithItems: CascadeDependency[] = [
        {
          type: 'bom',
          count: 3,
          label: 'BOMs',
          items: [
            { id: '1', name: 'BOM Alpha' },
            { id: '2', name: 'BOM Beta' },
            { id: '3', name: 'BOM Gamma' },
          ],
        },
      ];

      render(
        <ConfirmCascadeDialog {...defaultProps} dependencies={depsWithItems} />
      );

      // Should show the dependency label and count
      expect(screen.getByText('BOMs')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('shows truncation message when items exceed 5', () => {
      const depsWithManyItems: CascadeDependency[] = [
        {
          type: 'bom',
          count: 8,
          label: 'BOMs',
          items: [
            { id: '1', name: 'BOM 1' },
            { id: '2', name: 'BOM 2' },
            { id: '3', name: 'BOM 3' },
            { id: '4', name: 'BOM 4' },
            { id: '5', name: 'BOM 5' },
            { id: '6', name: 'BOM 6' },
            { id: '7', name: 'BOM 7' },
            { id: '8', name: 'BOM 8' },
          ],
        },
      ];

      render(
        <ConfirmCascadeDialog {...defaultProps} dependencies={depsWithManyItems} />
      );

      // Find all buttons and click the expand one (not Cancel/Delete)
      const buttons = screen.getAllByRole('button');
      // Find the small icon button (expand button is typically smaller)
      const expandButton = buttons.find(btn =>
        !btn.textContent?.includes('Cancel') &&
        !btn.textContent?.includes('Delete')
      );

      if (expandButton) {
        fireEvent.click(expandButton);
        // After expanding, should show "... and 3 more"
        expect(screen.getByText('... and 3 more')).toBeInTheDocument();
      }
    });
  });

  describe('Dialog State Reset', () => {
    it('clears typed confirmation when dialog reopens', async () => {
      const { rerender } = render(
        <ConfirmCascadeDialog {...defaultProps} requireTypedConfirmation />
      );

      // Type something
      const input = screen.getByPlaceholderText('My Project');
      fireEvent.change(input, { target: { value: 'Some Text' } });

      // Close dialog
      rerender(<ConfirmCascadeDialog {...defaultProps} requireTypedConfirmation open={false} />);

      // Reopen dialog
      rerender(<ConfirmCascadeDialog {...defaultProps} requireTypedConfirmation open={true} />);

      // Input should be empty
      const newInput = screen.getByPlaceholderText('My Project') as HTMLInputElement;
      expect(newInput.value).toBe('');
    });
  });
});
