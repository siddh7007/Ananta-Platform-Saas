import type { Meta, StoryObj } from '@storybook/react';
import { within, userEvent, expect } from '@storybook/test';
import { useState } from 'react';
import { RoleDropdown } from './RoleDropdown';
import type { AppRole } from '@/config/auth';

/**
 * RoleDropdown Component
 *
 * A reusable dropdown for selecting roles with descriptions.
 * Shows only roles the current user can assign.
 */

// Wrapper component to handle state
const RoleDropdownWithState = ({
  initialValue = 'analyst',
  currentUserRole = 'owner',
  disabled = false,
  showAllRoles = false,
}: {
  initialValue?: AppRole;
  currentUserRole?: AppRole;
  disabled?: boolean;
  showAllRoles?: boolean;
}) => {
  const [value, setValue] = useState<AppRole>(initialValue);
  return (
    <RoleDropdown
      value={value}
      onChange={setValue}
      currentUserRole={currentUserRole}
      disabled={disabled}
      showAllRoles={showAllRoles}
    />
  );
};

const meta: Meta<typeof RoleDropdown> = {
  title: 'Team/RoleDropdown',
  component: RoleDropdown,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
# RoleDropdown Component

A dropdown selector for choosing user roles with color-coded badges and descriptions.

## Features
- **Role Badges**: Color-coded role indicators matching the design system
- **Descriptions**: Each role shows its permission description
- **Role Filtering**: Only shows roles the current user can assign
- **Disabled State**: Grays out and prevents interaction
- **Show All Mode**: Option to show all roles regardless of permissions

## Role Hierarchy
1. **Super Admin** (Purple): Platform-wide access
2. **Owner** (Amber): Full organization access including billing
3. **Admin** (Blue): User and settings management
4. **Engineer** (Green): Technical operations (BOMs, components)
5. **Analyst** (Gray): Read-only access
        `,
      },
    },
  },
  argTypes: {
    value: {
      control: 'select',
      options: ['super_admin', 'owner', 'admin', 'engineer', 'analyst'],
      description: 'Currently selected role',
    },
    currentUserRole: {
      control: 'select',
      options: ['super_admin', 'owner', 'admin', 'engineer', 'analyst'],
      description: 'Role of the current user (determines available options)',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the dropdown is disabled',
    },
    showAllRoles: {
      control: 'boolean',
      description: 'Show all invitable roles regardless of user level',
    },
    onChange: {
      action: 'changed',
      description: 'Called when role selection changes',
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="p-4 min-w-[300px]">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default state with owner role
 */
export const Default: Story = {
  render: () => <RoleDropdownWithState />,
};

/**
 * Super admin can assign all roles
 */
export const SuperAdminOptions: Story = {
  render: () => <RoleDropdownWithState currentUserRole="super_admin" />,
  parameters: {
    docs: {
      description: {
        story: 'Super admins see all assignable roles including owner.',
      },
    },
  },
};

/**
 * Admin has limited options
 */
export const AdminOptions: Story = {
  render: () => <RoleDropdownWithState currentUserRole="admin" />,
  parameters: {
    docs: {
      description: {
        story: 'Admins can only assign engineer and analyst roles.',
      },
    },
  },
};

/**
 * Engineer has no assignable roles
 */
export const EngineerOptions: Story = {
  render: () => <RoleDropdownWithState currentUserRole="engineer" />,
  parameters: {
    docs: {
      description: {
        story: 'Engineers cannot assign any roles - shows empty state.',
      },
    },
  },
};

/**
 * Disabled state
 */
export const Disabled: Story = {
  render: () => <RoleDropdownWithState disabled={true} />,
  parameters: {
    docs: {
      description: {
        story: 'Dropdown in disabled state - cannot be interacted with.',
      },
    },
  },
};

/**
 * Show all roles mode
 */
export const ShowAllRoles: Story = {
  render: () => <RoleDropdownWithState currentUserRole="analyst" showAllRoles={true} />,
  parameters: {
    docs: {
      description: {
        story: 'Shows all invitable roles regardless of current user permissions. Useful for display purposes.',
      },
    },
  },
};

/**
 * Engineer role selected
 */
export const EngineerSelected: Story = {
  render: () => <RoleDropdownWithState initialValue="engineer" currentUserRole="owner" />,
};

/**
 * Admin role selected
 */
export const AdminSelected: Story = {
  render: () => <RoleDropdownWithState initialValue="admin" currentUserRole="owner" />,
};

/**
 * Interactive test: open and select
 */
export const InteractiveSelect: Story = {
  render: () => <RoleDropdownWithState currentUserRole="owner" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Find and click the dropdown button
    const dropdownButton = canvas.getByRole('button');
    expect(dropdownButton).toBeInTheDocument();

    await userEvent.click(dropdownButton);

    // Verify options are visible
    const engineerOption = await canvas.findByText('Technical operations');
    expect(engineerOption).toBeInTheDocument();

    // Select engineer role
    const engineerButton = canvas.getAllByText('Engineer')[1]; // The option, not the badge
    await userEvent.click(engineerButton);

    // Verify selection changed (button should now show Engineer)
    const updatedButton = canvas.getByRole('button');
    expect(updatedButton).toHaveTextContent('Engineer');
  },
};

/**
 * Compact width
 */
export const CompactWidth: Story = {
  render: () => (
    <div className="w-48">
      <RoleDropdownWithState />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Dropdown adapts to narrow container widths.',
      },
    },
  },
};

/**
 * Form context example
 */
export const InFormContext: Story = {
  render: () => (
    <div className="space-y-4 max-w-md">
      <div>
        <label className="block text-sm font-medium mb-1">Email</label>
        <input
          type="email"
          className="w-full px-3 py-2 border rounded-md"
          placeholder="user@example.com"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Role</label>
        <RoleDropdownWithState />
      </div>
      <button className="w-full py-2 bg-primary text-primary-foreground rounded-md">
        Send Invitation
      </button>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Example of RoleDropdown used within a form context.',
      },
    },
  },
};
