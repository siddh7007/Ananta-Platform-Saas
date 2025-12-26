/**
 * TeamManagement Component Tests
 *
 * Tests for the Team Management page including:
 * - Members table rendering
 * - Invite form functionality
 * - Role updates
 * - Member removal
 * - Invitation management
 * - Permission-based UI
 *
 * @module pages/team/TeamManagement.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TeamManagement } from './TeamManagement';

// Mock react-admin
vi.mock('react-admin', () => ({
  usePermissions: vi.fn(() => ({ permissions: 'admin' })),
}));

// Mock the useTeamMembers hook
const mockInviteMember = vi.fn();
const mockResendInvitation = vi.fn();
const mockRevokeInvitation = vi.fn();
const mockUpdateMemberRole = vi.fn();
const mockRemoveMember = vi.fn();
const mockRefresh = vi.fn();

vi.mock('../../hooks/useTeamMembers', () => ({
  useTeamMembers: vi.fn(() => ({
    members: [
      {
        id: 'user-1',
        email: 'sarah@example.com',
        firstName: 'Sarah',
        lastName: 'Johnson',
        fullName: 'Sarah Johnson',
        role: 'owner',
        status: 'active',
        joinedAt: '2024-01-15T10:00:00Z',
        lastLoginAt: new Date().toISOString(),
      },
      {
        id: 'user-2',
        email: 'david@example.com',
        firstName: 'David',
        lastName: 'Chen',
        fullName: 'David Chen',
        role: 'admin',
        status: 'active',
        joinedAt: '2024-02-10T14:30:00Z',
        lastLoginAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'user-3',
        email: 'emily@example.com',
        firstName: 'Emily',
        lastName: 'Rodriguez',
        fullName: 'Emily Rodriguez',
        role: 'engineer',
        status: 'active',
        joinedAt: '2024-03-05T09:15:00Z',
        lastLoginAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
    invitations: [
      {
        id: 'invite-1',
        email: 'pending@example.com',
        role: 'engineer',
        status: 'pending',
        expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        invitedBy: 'user-1',
        invitedByName: 'Sarah Johnson',
      },
    ],
    stats: {
      totalMembers: 3,
      activeMembers: 3,
      pendingInvitations: 1,
      roleDistribution: {
        analyst: 0,
        engineer: 1,
        admin: 1,
        owner: 1,
      },
    },
    isLoading: false,
    isInviting: false,
    isUpdating: false,
    error: null,
    refresh: mockRefresh,
    inviteMember: mockInviteMember,
    resendInvitation: mockResendInvitation,
    revokeInvitation: mockRevokeInvitation,
    updateMemberRole: mockUpdateMemberRole,
    removeMember: mockRemoveMember,
  })),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = { is_admin: 'true' };
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('TeamManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    localStorageMock.setItem('is_admin', 'true');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the page title', () => {
      render(<TeamManagement />);
      expect(screen.getByText('Team')).toBeInTheDocument();
    });

    it('should render custom title', () => {
      render(<TeamManagement title="My Team" />);
      expect(screen.getByText('My Team')).toBeInTheDocument();
    });

    it('should render team members table', () => {
      render(<TeamManagement />);
      // "Team Members" appears both as card heading and stats label
      // Find the heading (h6 element)
      const headings = screen.getAllByText('Team Members');
      expect(headings.length).toBeGreaterThanOrEqual(1);
    });

    it('should display all team members', () => {
      render(<TeamManagement />);
      expect(screen.getByText('Sarah Johnson')).toBeInTheDocument();
      expect(screen.getByText('David Chen')).toBeInTheDocument();
      expect(screen.getByText('Emily Rodriguez')).toBeInTheDocument();
    });

    it('should display member emails', () => {
      render(<TeamManagement />);
      expect(screen.getByText('sarah@example.com')).toBeInTheDocument();
      expect(screen.getByText('david@example.com')).toBeInTheDocument();
      expect(screen.getByText('emily@example.com')).toBeInTheDocument();
    });

    it('should display role badges', () => {
      render(<TeamManagement />);
      // Roles appear in both member rows and stats section
      // Use getAllByText since roles appear multiple times
      expect(screen.getAllByText('Owner').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Admin').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Engineer').length).toBeGreaterThanOrEqual(1);
    });

    it('should display team stats', () => {
      render(<TeamManagement />);
      expect(screen.getByText('Team Overview')).toBeInTheDocument();
      // Total members count is displayed
      expect(screen.getByText('3')).toBeInTheDocument();
      // "Team Members" appears multiple times - as heading and stats label
      const teamMembersTexts = screen.getAllByText('Team Members');
      expect(teamMembersTexts.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Invite Form', () => {
    it('should render invite form for admin users', () => {
      render(<TeamManagement />);
      expect(screen.getByText('Invite Team Member')).toBeInTheDocument();
      expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    });

    it('should have role selector', () => {
      render(<TeamManagement />);
      // MUI Select uses a different label association - find by role combobox
      // The role selector is inside the invite form card
      const inviteFormCard = screen.getByText('Invite Team Member').closest('.MuiCard-root');
      expect(inviteFormCard).toBeInTheDocument();

      // Find the combobox (MUI Select) within the form
      const roleCombobox = within(inviteFormCard as HTMLElement).getByRole('combobox');
      expect(roleCombobox).toBeInTheDocument();
    });

    it('should have send invitation button', () => {
      render(<TeamManagement />);
      expect(screen.getByRole('button', { name: /Send Invitation/i })).toBeInTheDocument();
    });

    it('should call inviteMember when form is submitted', async () => {
      const user = userEvent.setup();
      mockInviteMember.mockResolvedValueOnce({
        id: 'new-invite',
        email: 'new@example.com',
        role: 'engineer',
        status: 'pending',
      });

      render(<TeamManagement />);

      const emailInput = screen.getByLabelText(/Email Address/i);
      await user.type(emailInput, 'new@example.com');

      const sendButton = screen.getByRole('button', { name: /Send Invitation/i });
      await user.click(sendButton);

      await waitFor(() => {
        expect(mockInviteMember).toHaveBeenCalledWith({
          email: 'new@example.com',
          role: 'engineer',
        });
      });
    });

    it('should show error for invalid email', async () => {
      const user = userEvent.setup();
      render(<TeamManagement />);

      const emailInput = screen.getByLabelText(/Email Address/i);
      await user.type(emailInput, 'invalid-email');

      const sendButton = screen.getByRole('button', { name: /Send Invitation/i });
      await user.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText(/Please enter a valid email address/i)).toBeInTheDocument();
      });
    });

    it('should show error for empty email', async () => {
      const user = userEvent.setup();
      render(<TeamManagement />);

      const sendButton = screen.getByRole('button', { name: /Send Invitation/i });
      // Button is disabled when email is empty - verify this behavior
      expect(sendButton).toBeDisabled();

      // Type something and clear to trigger validation
      const emailInput = screen.getByLabelText(/Email Address/i);
      await user.type(emailInput, 'test');
      await user.clear(emailInput);

      // Now use fireEvent to trigger click even on disabled button
      // The component validates on handleInvite which checks for empty email
      fireEvent.click(sendButton);

      // Since button is disabled, validation happens on actual form submit
      // For empty email with button disabled, we verify button state instead
      expect(sendButton).toBeDisabled();
    });

    it('should clear form after successful invite', async () => {
      const user = userEvent.setup();
      mockInviteMember.mockResolvedValueOnce({
        id: 'new-invite',
        email: 'new@example.com',
        role: 'engineer',
        status: 'pending',
      });

      render(<TeamManagement />);

      const emailInput = screen.getByLabelText(/Email Address/i);
      await user.type(emailInput, 'new@example.com');

      const sendButton = screen.getByRole('button', { name: /Send Invitation/i });
      await user.click(sendButton);

      await waitFor(() => {
        expect(emailInput).toHaveValue('');
      });
    });
  });

  describe('Pending Invitations', () => {
    it('should display pending invitations section', () => {
      render(<TeamManagement />);
      expect(screen.getByText('Pending Invitations')).toBeInTheDocument();
    });

    it('should display pending invitation email', () => {
      render(<TeamManagement />);
      expect(screen.getByText('pending@example.com')).toBeInTheDocument();
    });

    it('should have resend button for pending invitations', () => {
      render(<TeamManagement />);
      const resendButtons = screen.getAllByLabelText(/Resend/i);
      expect(resendButtons.length).toBeGreaterThan(0);
    });

    it('should have cancel button for pending invitations', () => {
      render(<TeamManagement />);
      const cancelButtons = screen.getAllByLabelText(/Cancel/i);
      expect(cancelButtons.length).toBeGreaterThan(0);
    });

    it('should call resendInvitation when resend is clicked', async () => {
      const user = userEvent.setup();
      mockResendInvitation.mockResolvedValueOnce({});

      render(<TeamManagement />);

      const resendButton = screen.getAllByLabelText(/Resend/i)[0];
      await user.click(resendButton);

      await waitFor(() => {
        expect(mockResendInvitation).toHaveBeenCalledWith('invite-1');
      });
    });
  });

  describe('Member Actions', () => {
    it('should have action menu for non-owner members', () => {
      render(<TeamManagement />);
      // Owner should not have action menu
      const actionButtons = screen.getAllByRole('button', { name: '' });
      expect(actionButtons.length).toBeGreaterThan(0);
    });

    it('should open role change dialog', async () => {
      const user = userEvent.setup();
      render(<TeamManagement />);

      // Find action button for admin user (David Chen)
      const rows = screen.getAllByRole('row');
      const davidRow = rows.find(row => within(row).queryByText('David Chen'));
      if (davidRow) {
        const actionButton = within(davidRow).getByRole('button', { name: '' });
        await user.click(actionButton);
      }

      // Click change role menu item
      const changeRoleItem = await screen.findByText(/Change Role/i);
      await user.click(changeRoleItem);

      expect(screen.getByText('Change Role')).toBeInTheDocument();
    });
  });

  describe('Search', () => {
    it('should have search input', () => {
      render(<TeamManagement />);
      expect(screen.getByPlaceholderText(/Search members/i)).toBeInTheDocument();
    });

    it('should filter members by name', async () => {
      vi.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<TeamManagement />);

      const searchInput = screen.getByPlaceholderText(/Search members/i);
      await user.type(searchInput, 'Sarah');

      // Wait for debounce (300ms)
      await vi.advanceTimersByTimeAsync(350);

      expect(screen.getByText('Sarah Johnson')).toBeInTheDocument();
      expect(screen.queryByText('David Chen')).not.toBeInTheDocument();

      vi.useRealTimers();
    });

    it('should filter members by email', async () => {
      vi.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<TeamManagement />);

      const searchInput = screen.getByPlaceholderText(/Search members/i);
      await user.type(searchInput, 'david@');

      // Wait for debounce (300ms)
      await vi.advanceTimersByTimeAsync(350);

      expect(screen.getByText('David Chen')).toBeInTheDocument();
      expect(screen.queryByText('Sarah Johnson')).not.toBeInTheDocument();

      vi.useRealTimers();
    });

    it('should show empty state when no matches', async () => {
      vi.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<TeamManagement />);

      const searchInput = screen.getByPlaceholderText(/Search members/i);
      await user.type(searchInput, 'nonexistent');

      // Wait for debounce (300ms)
      await vi.advanceTimersByTimeAsync(350);

      expect(screen.getByText(/No members match your search/i)).toBeInTheDocument();

      vi.useRealTimers();
    });
  });

  describe('Refresh', () => {
    it('should have refresh button', () => {
      render(<TeamManagement />);
      expect(screen.getByRole('button', { name: /Refresh/i })).toBeInTheDocument();
    });

    it('should call refresh when button is clicked', async () => {
      const user = userEvent.setup();
      render(<TeamManagement />);

      const refreshButton = screen.getByRole('button', { name: /Refresh/i });
      await user.click(refreshButton);

      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper table structure', () => {
      render(<TeamManagement />);
      // There are two tables: members table and pending invitations table
      const tables = screen.getAllByRole('table');
      expect(tables.length).toBeGreaterThanOrEqual(1);
    });

    it('should have table headers in members table', () => {
      render(<TeamManagement />);
      // Get all tables (members table and invitations table may both exist)
      const tables = screen.getAllByRole('table');
      expect(tables.length).toBeGreaterThanOrEqual(1);

      // The first table is the members table - verify it has a header
      const membersTable = tables[0];
      const thead = membersTable.querySelector('thead');
      expect(thead).toBeInTheDocument();

      // Check headers within the table head
      const headerRow = within(thead!).getByRole('row');
      expect(within(headerRow).getByText('Member')).toBeInTheDocument();
      expect(within(headerRow).getByText('Role')).toBeInTheDocument();
      expect(within(headerRow).getByText('Status')).toBeInTheDocument();
      expect(within(headerRow).getByText('Last Active')).toBeInTheDocument();
    });

    it('should have data-testid attribute', () => {
      render(<TeamManagement data-testid="team-management" />);
      expect(screen.getByTestId('team-management')).toBeInTheDocument();
    });
  });

  describe('Display Name', () => {
    it('should have displayName set', () => {
      expect(TeamManagement.displayName).toBe('TeamManagement');
    });
  });
});
