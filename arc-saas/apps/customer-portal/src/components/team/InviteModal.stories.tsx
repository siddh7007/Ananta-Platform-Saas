import type { Meta, StoryObj } from '@storybook/react';
import { within, userEvent, expect } from '@storybook/test';
import { InviteModal } from './InviteModal';

/**
 * InviteModal Component
 *
 * Modal for inviting new team members with email validation and role selection.
 */

const meta: Meta<typeof InviteModal> = {
  title: 'Team/InviteModal',
  component: InviteModal,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
# InviteModal Component

A modal form for inviting new team members to the organization.

## Features
- **Email Validation**: Validates email format before submission
- **Role Selection**: Dropdown showing roles the current user can assign
- **Personal Message**: Optional field for custom invitation message
- **Error Handling**: Displays validation and API errors
- **Loading State**: Shows spinner during submission

## Role-Based Role Options
- **Super Admin**: Can assign all roles
- **Owner**: Can assign admin, engineer, analyst
- **Admin**: Can assign engineer, analyst
- **Engineer/Analyst**: Cannot invite (no assignable roles)
        `,
      },
    },
  },
  argTypes: {
    isOpen: {
      control: 'boolean',
      description: 'Whether the modal is open',
    },
    currentUserRole: {
      control: 'select',
      options: ['super_admin', 'owner', 'admin', 'engineer', 'analyst'],
      description: 'Role of the current user (determines which roles can be assigned)',
    },
    tenantName: {
      control: 'text',
      description: 'Name of the organization (shown in modal)',
    },
    onClose: {
      action: 'closed',
      description: 'Called when modal is closed',
    },
    onInvite: {
      action: 'invited',
      description: 'Called with email, role, and optional message on submit',
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="relative min-h-screen bg-background p-6">
        <div className="mb-4">
          <h1 className="text-xl font-bold">Team Settings</h1>
          <p className="text-muted-foreground">Background content when modal is open</p>
        </div>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default invite handler that simulates success
const mockOnInvite = async () => {
  await new Promise((resolve) => setTimeout(resolve, 1000));
};

/**
 * Default open state with owner role
 */
export const Open: Story = {
  args: {
    isOpen: true,
    onClose: () => {},
    onInvite: mockOnInvite,
    currentUserRole: 'owner',
    tenantName: 'Acme Corporation',
  },
};

/**
 * Closed state
 */
export const Closed: Story = {
  args: {
    isOpen: false,
    onClose: () => {},
    onInvite: mockOnInvite,
    currentUserRole: 'owner',
    tenantName: 'Acme Corporation',
  },
};

/**
 * Super admin with all role options
 */
export const SuperAdmin: Story = {
  args: {
    isOpen: true,
    onClose: () => {},
    onInvite: mockOnInvite,
    currentUserRole: 'super_admin',
    tenantName: 'Platform Admin',
  },
  parameters: {
    docs: {
      description: {
        story: 'Super admins can assign all roles including owner.',
      },
    },
  },
};

/**
 * Admin with limited role options
 */
export const AdminRole: Story = {
  args: {
    isOpen: true,
    onClose: () => {},
    onInvite: mockOnInvite,
    currentUserRole: 'admin',
    tenantName: 'Acme Corporation',
  },
  parameters: {
    docs: {
      description: {
        story: 'Admins can only assign engineer and analyst roles.',
      },
    },
  },
};

/**
 * No tenant name
 */
export const NoTenantName: Story = {
  args: {
    isOpen: true,
    onClose: () => {},
    onInvite: mockOnInvite,
    currentUserRole: 'owner',
  },
  parameters: {
    docs: {
      description: {
        story: 'Modal without tenant name context message.',
      },
    },
  },
};

/**
 * Interactive test: fill form and submit
 */
export const InteractiveSubmit: Story = {
  args: {
    isOpen: true,
    onClose: () => {},
    onInvite: mockOnInvite,
    currentUserRole: 'owner',
    tenantName: 'Test Company',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Find email input
    const emailInput = await canvas.findByPlaceholderText(/colleague@company.com/i);
    expect(emailInput).toBeInTheDocument();

    // Type email
    await userEvent.type(emailInput, 'newmember@example.com');
    expect(emailInput).toHaveValue('newmember@example.com');

    // Find and expand role dropdown
    const roleButton = await canvas.findByText(/analyst/i);
    await userEvent.click(roleButton);

    // Find message textarea
    const messageInput = await canvas.findByPlaceholderText(/Add a personal note/i);
    await userEvent.type(messageInput, 'Welcome to the team!');

    // Verify submit button is enabled
    const submitButton = await canvas.findByText('Send Invitation');
    expect(submitButton).toBeEnabled();
  },
};

/**
 * Interactive test: validation error
 */
export const ValidationError: Story = {
  args: {
    isOpen: true,
    onClose: () => {},
    onInvite: mockOnInvite,
    currentUserRole: 'owner',
    tenantName: 'Test Company',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Find email input and enter invalid email
    const emailInput = await canvas.findByPlaceholderText(/colleague@company.com/i);
    await userEvent.type(emailInput, 'invalid-email');

    // Submit the form
    const submitButton = await canvas.findByText('Send Invitation');
    await userEvent.click(submitButton);

    // Error message should appear
    const error = await canvas.findByText(/Please enter a valid email/i);
    expect(error).toBeInTheDocument();
  },
};
