import type { Meta, StoryObj } from '@storybook/react';
import { within, userEvent, expect } from '@storybook/test';
import { MemberCard } from './MemberCard';
import type { TeamMember } from '@/types/team';

/**
 * MemberCard Component
 *
 * Displays a team member with avatar, role badge, status, and action buttons.
 * Actions are role-gated based on the current user's permissions.
 */

// Mock team members
const activeMember: TeamMember = {
  id: 'member-1',
  userId: 'user-1',
  tenantId: 'tenant-1',
  name: 'John Doe',
  email: 'john.doe@example.com',
  roleKey: 'engineer',
  status: 'active',
  joinedAt: '2024-06-15T10:00:00Z',
  lastActiveAt: '2025-01-12T14:30:00Z',
};

const adminMember: TeamMember = {
  id: 'member-2',
  userId: 'user-2',
  tenantId: 'tenant-1',
  name: 'Jane Admin',
  email: 'jane.admin@example.com',
  roleKey: 'admin',
  status: 'active',
  joinedAt: '2024-01-01T08:00:00Z',
  lastActiveAt: '2025-01-12T16:00:00Z',
};

const pendingMember: TeamMember = {
  id: 'member-3',
  userId: 'user-3',
  tenantId: 'tenant-1',
  name: undefined,
  email: 'pending@example.com',
  roleKey: 'analyst',
  status: 'pending',
  joinedAt: '2025-01-10T10:00:00Z',
};

const ownerMember: TeamMember = {
  id: 'member-4',
  userId: 'user-4',
  tenantId: 'tenant-1',
  name: 'Company Owner',
  email: 'owner@example.com',
  roleKey: 'owner',
  status: 'active',
  joinedAt: '2023-01-01T00:00:00Z',
  lastActiveAt: '2025-01-12T18:00:00Z',
  avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=owner',
};

const meta: Meta<typeof MemberCard> = {
  title: 'Team/MemberCard',
  component: MemberCard,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
# MemberCard Component

Displays a single team member with their information and role-gated actions.

## Features
- **Avatar Display**: Shows avatar image or initials fallback
- **Role Badge**: Color-coded role indicator (owner, admin, engineer, analyst)
- **Status Badge**: Shows pending, suspended, or deactivated status
- **Activity Info**: Join date and last active time
- **Action Menu**: Role-gated Change Role and Remove Member options

## Role-Based Access Control
- **Admins+**: Can change roles of users below their level
- **Owners+**: Can remove non-owner members
- **Cannot**: Edit own role or remove self
        `,
      },
    },
  },
  argTypes: {
    member: {
      control: 'object',
      description: 'The team member to display',
    },
    currentUserRole: {
      control: 'select',
      options: ['super_admin', 'owner', 'admin', 'engineer', 'analyst'],
      description: 'Role of the currently logged-in user',
    },
    currentUserId: {
      control: 'text',
      description: 'ID of the currently logged-in user',
    },
    onChangeRole: {
      action: 'changeRole',
      description: 'Called when Change Role is clicked',
    },
    onRemove: {
      action: 'remove',
      description: 'Called when Remove Member is clicked',
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="p-4 max-w-md">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Active engineer member viewed by admin
 */
export const ActiveEngineer: Story = {
  args: {
    member: activeMember,
    currentUserRole: 'admin',
    currentUserId: 'current-user',
  },
};

/**
 * Admin member viewed by owner
 */
export const AdminMember: Story = {
  args: {
    member: adminMember,
    currentUserRole: 'owner',
    currentUserId: 'current-user',
  },
};

/**
 * Pending invitation - no name yet
 */
export const PendingInvitation: Story = {
  args: {
    member: pendingMember,
    currentUserRole: 'admin',
    currentUserId: 'current-user',
  },
  parameters: {
    docs: {
      description: {
        story: 'Member who has been invited but not yet accepted. Shows email prefix as name.',
      },
    },
  },
};

/**
 * Owner member with avatar
 */
export const OwnerWithAvatar: Story = {
  args: {
    member: ownerMember,
    currentUserRole: 'super_admin',
    currentUserId: 'current-user',
  },
  parameters: {
    docs: {
      description: {
        story: 'Owner member with custom avatar image.',
      },
    },
  },
};

/**
 * Current user viewing their own card
 */
export const CurrentUser: Story = {
  args: {
    member: activeMember,
    currentUserRole: 'engineer',
    currentUserId: 'user-1', // Same as member.userId
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows "(you)" indicator and hides action menu when viewing own card.',
      },
    },
  },
};

/**
 * Analyst viewing - no actions available
 */
export const ViewOnlyAnalyst: Story = {
  args: {
    member: activeMember,
    currentUserRole: 'analyst',
    currentUserId: 'current-user',
  },
  parameters: {
    docs: {
      description: {
        story: 'Analyst users have no edit permissions - action menu is hidden.',
      },
    },
  },
};

/**
 * Interactive test: open action menu
 */
export const InteractiveMenu: Story = {
  args: {
    member: activeMember,
    currentUserRole: 'owner',
    currentUserId: 'current-user',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Find the menu button
    const menuButton = canvas.getByRole('button');
    expect(menuButton).toBeInTheDocument();

    // Click to open menu
    await userEvent.click(menuButton);

    // Verify menu items appear
    const changeRoleButton = await canvas.findByText('Change Role');
    expect(changeRoleButton).toBeInTheDocument();

    const removeButton = await canvas.findByText('Remove Member');
    expect(removeButton).toBeInTheDocument();
  },
};

/**
 * Multiple cards layout
 */
export const MultipleCards: Story = {
  render: () => (
    <div className="space-y-4">
      <MemberCard
        member={ownerMember}
        currentUserRole="super_admin"
        currentUserId="current-user"
      />
      <MemberCard
        member={adminMember}
        currentUserRole="super_admin"
        currentUserId="current-user"
      />
      <MemberCard
        member={activeMember}
        currentUserRole="super_admin"
        currentUserId="current-user"
      />
      <MemberCard
        member={pendingMember}
        currentUserRole="super_admin"
        currentUserId="current-user"
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Example of multiple member cards in a list layout.',
      },
    },
  },
};
