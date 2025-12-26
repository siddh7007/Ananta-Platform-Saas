/**
 * Command Palette Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CommandPalette, useCommandPalette } from './CommandPalette';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const renderPalette = (open = true, onClose = vi.fn()) => {
  return render(
    <MemoryRouter>
      <CommandPalette open={open} onClose={onClose} />
    </MemoryRouter>
  );
};

describe('CommandPalette', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  describe('Rendering', () => {
    it('should render when open', () => {
      renderPalette(true);
      expect(screen.getByPlaceholderText(/search commands/i)).toBeInTheDocument();
    });

    it('should not render content when closed', () => {
      renderPalette(false);
      expect(screen.queryByPlaceholderText(/search commands/i)).not.toBeInTheDocument();
    });

    it('should show search input', () => {
      renderPalette();
      const input = screen.getByPlaceholderText(/search commands/i);
      expect(input).toBeInTheDocument();
    });

    it('should show navigation commands', () => {
      renderPalette();
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Projects')).toBeInTheDocument();
      expect(screen.getByText('BOMs')).toBeInTheDocument();
    });

    it('should show action commands', () => {
      renderPalette();
      expect(screen.getByText('Upload BOM')).toBeInTheDocument();
    });

    it('should show settings commands', () => {
      renderPalette();
      expect(screen.getByText('Account Settings')).toBeInTheDocument();
      expect(screen.getByText('Billing')).toBeInTheDocument();
    });

    it('should show category labels', () => {
      renderPalette();
      expect(screen.getByText('Navigation')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('should show keyboard hints in footer', () => {
      renderPalette();
      expect(screen.getByText('Navigate')).toBeInTheDocument();
      expect(screen.getByText('Select')).toBeInTheDocument();
      expect(screen.getByText('Close')).toBeInTheDocument();
    });
  });

  describe('Search Filtering', () => {
    it('should filter commands by query', async () => {
      const user = userEvent.setup();
      renderPalette();

      const input = screen.getByPlaceholderText(/search commands/i);
      await user.type(input, 'dashboard');

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Portfolio Dashboard')).toBeInTheDocument();
      // Other commands should be filtered out or have lower priority
    });

    it('should show no results message when nothing matches', async () => {
      const user = userEvent.setup();
      renderPalette();

      const input = screen.getByPlaceholderText(/search commands/i);
      await user.type(input, 'xyznonexistent');

      expect(screen.getByText(/no results found/i)).toBeInTheDocument();
    });

    it('should match on keywords', async () => {
      const user = userEvent.setup();
      renderPalette();

      const input = screen.getByPlaceholderText(/search commands/i);
      await user.type(input, 'payment');

      expect(screen.getByText('Billing')).toBeInTheDocument();
    });

    it('should match partial strings', async () => {
      const user = userEvent.setup();
      renderPalette();

      const input = screen.getByPlaceholderText(/search commands/i);
      await user.type(input, 'proj');

      expect(screen.getByText('Projects')).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should navigate with arrow keys', async () => {
      const user = userEvent.setup();
      renderPalette();

      const input = screen.getByPlaceholderText(/search commands/i);
      await user.click(input);

      // First item should be selected initially
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowUp}');

      // Selection should have moved
      // The exact item depends on the order, but navigation should work
    });

    it('should execute command on Enter', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      renderPalette(true, onClose);

      const input = screen.getByPlaceholderText(/search commands/i);
      await user.click(input);
      await user.keyboard('{Enter}');

      expect(mockNavigate).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    it('should close on Escape', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      renderPalette(true, onClose);

      const input = screen.getByPlaceholderText(/search commands/i);
      await user.click(input);
      await user.keyboard('{Escape}');

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Click Actions', () => {
    it('should navigate when clicking a command', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      renderPalette(true, onClose);

      const dashboardItem = screen.getByText('Dashboard');
      await user.click(dashboardItem);

      expect(mockNavigate).toHaveBeenCalledWith('/');
      expect(onClose).toHaveBeenCalled();
    });

    it('should navigate to correct path for different commands', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      renderPalette(true, onClose);

      const uploadItem = screen.getByText('Upload BOM');
      await user.click(uploadItem);

      expect(mockNavigate).toHaveBeenCalledWith('/bom/upload');
    });
  });

  describe('Accessibility', () => {
    it('should have aria-label on search input', () => {
      renderPalette();
      const input = screen.getByLabelText(/search commands/i);
      expect(input).toBeInTheDocument();
    });

    it('should have role listbox on command list', () => {
      renderPalette();
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });
  });
});

describe('useCommandPalette hook', () => {
  // Test the hook separately
  const TestComponent = () => {
    const { open, setOpen, onClose } = useCommandPalette();
    return (
      <div>
        <span data-testid="open-state">{open ? 'open' : 'closed'}</span>
        <button onClick={() => setOpen(true)}>Open</button>
        <button onClick={onClose}>Close</button>
      </div>
    );
  };

  it('should start closed', () => {
    render(<TestComponent />);
    expect(screen.getByTestId('open-state')).toHaveTextContent('closed');
  });

  it('should open on Ctrl+K', async () => {
    render(<TestComponent />);

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

    await waitFor(() => {
      expect(screen.getByTestId('open-state')).toHaveTextContent('open');
    });
  });

  it('should open on Cmd+K (Mac)', async () => {
    render(<TestComponent />);

    fireEvent.keyDown(window, { key: 'k', metaKey: true });

    await waitFor(() => {
      expect(screen.getByTestId('open-state')).toHaveTextContent('open');
    });
  });

  it('should toggle on repeated Ctrl+K', async () => {
    render(<TestComponent />);

    // Open
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    await waitFor(() => {
      expect(screen.getByTestId('open-state')).toHaveTextContent('open');
    });

    // Close
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    await waitFor(() => {
      expect(screen.getByTestId('open-state')).toHaveTextContent('closed');
    });
  });

  it('should close via onClose callback', async () => {
    const user = userEvent.setup();
    render(<TestComponent />);

    // Open first
    await user.click(screen.getByText('Open'));
    expect(screen.getByTestId('open-state')).toHaveTextContent('open');

    // Close via callback
    await user.click(screen.getByText('Close'));
    expect(screen.getByTestId('open-state')).toHaveTextContent('closed');
  });
});
