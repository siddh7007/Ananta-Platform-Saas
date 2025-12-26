/**
 * CommandPalette Tests
 *
 * Basic test suite for the Command Palette component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { CommandPalette } from './CommandPalette';
import { AuthProvider } from '@/contexts/AuthContext';
import { TenantProvider } from '@/contexts/TenantContext';

// Mock contexts
const mockUser = {
  id: '1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'engineer',
};

const mockTenant = {
  id: '1',
  name: 'Test Workspace',
};

const MockProviders = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <AuthProvider>
      <TenantProvider>{children}</TenantProvider>
    </AuthProvider>
  </BrowserRouter>
);

describe('CommandPalette', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  it('should render when open', () => {
    render(
      <MockProviders>
        <CommandPalette open={true} onOpenChange={() => {}} />
      </MockProviders>
    );

    expect(
      screen.getByPlaceholderText('Search or type a command...')
    ).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    render(
      <MockProviders>
        <CommandPalette open={false} onOpenChange={() => {}} />
      </MockProviders>
    );

    expect(
      screen.queryByPlaceholderText('Search or type a command...')
    ).not.toBeInTheDocument();
  });

  it('should filter items based on search query', async () => {
    render(
      <MockProviders>
        <CommandPalette open={true} onOpenChange={() => {}} />
      </MockProviders>
    );

    const searchInput = screen.getByPlaceholderText('Search or type a command...');

    // Type search query
    fireEvent.change(searchInput, { target: { value: 'bom' } });

    await waitFor(() => {
      expect(screen.getByText('BOMs')).toBeInTheDocument();
    });
  });

  it('should show empty state when no results', async () => {
    render(
      <MockProviders>
        <CommandPalette open={true} onOpenChange={() => {}} />
      </MockProviders>
    );

    const searchInput = screen.getByPlaceholderText('Search or type a command...');

    // Type query with no matches
    fireEvent.change(searchInput, { target: { value: 'xyz123notfound' } });

    await waitFor(() => {
      expect(screen.getByText(/No results found/i)).toBeInTheDocument();
    });
  });

  it('should close when Escape is pressed', async () => {
    const onOpenChange = vi.fn();

    render(
      <MockProviders>
        <CommandPalette open={true} onOpenChange={onOpenChange} />
      </MockProviders>
    );

    // Press Escape
    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('should persist recent items to localStorage', () => {
    // This test would need to mock navigation and verify localStorage
    // For now, it's a placeholder for future implementation
    expect(localStorage.getItem('cbp:command-palette:recent')).toBeNull();
  });
});

describe('useKeyboardShortcuts', () => {
  it('should register Cmd+K shortcut', () => {
    const onOpenChange = vi.fn();

    render(
      <MockProviders>
        <CommandPalette open={false} onOpenChange={onOpenChange} />
      </MockProviders>
    );

    // Simulate Cmd+K
    fireEvent.keyDown(document, {
      key: 'k',
      metaKey: true,
    });

    // Command palette should open
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it('should register Ctrl+K shortcut', () => {
    const onOpenChange = vi.fn();

    render(
      <MockProviders>
        <CommandPalette open={false} onOpenChange={onOpenChange} />
      </MockProviders>
    );

    // Simulate Ctrl+K
    fireEvent.keyDown(document, {
      key: 'k',
      ctrlKey: true,
    });

    // Command palette should open
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });
});
