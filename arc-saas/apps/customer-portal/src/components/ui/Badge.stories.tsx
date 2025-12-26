import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from './badge';

const meta: Meta<typeof Badge> = {
  title: 'UI/Badge',
  component: Badge,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'secondary', 'destructive', 'outline'],
      description: 'Badge visual style variant',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Base variants
export const Default: Story = {
  args: {
    children: 'Default',
    variant: 'default',
  },
};

export const Secondary: Story = {
  args: {
    children: 'Secondary',
    variant: 'secondary',
  },
};

export const Destructive: Story = {
  args: {
    children: 'Destructive',
    variant: 'destructive',
  },
};

export const Outline: Story = {
  args: {
    children: 'Outline',
    variant: 'outline',
  },
};

// Status badges (real-world examples)
export const StatusActive: Story = {
  args: {
    children: 'Active',
    className: 'bg-green-100 text-green-700 hover:bg-green-100',
  },
};

export const StatusPending: Story = {
  args: {
    children: 'Pending',
    className: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100',
  },
};

export const StatusInactive: Story = {
  args: {
    children: 'Inactive',
    className: 'bg-gray-100 text-gray-700 hover:bg-gray-100',
  },
};

export const StatusError: Story = {
  args: {
    children: 'Error',
    variant: 'destructive',
  },
};

// Role badges
export const RoleAdmin: Story = {
  args: {
    children: 'Admin',
    className: 'bg-purple-100 text-purple-700 hover:bg-purple-100',
  },
};

export const RoleEngineer: Story = {
  args: {
    children: 'Engineer',
    className: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
  },
};

export const RoleOwner: Story = {
  args: {
    children: 'Owner',
    className: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
  },
};

// Lifecycle badges (for components)
export const LifecycleActive: Story = {
  args: {
    children: 'Active',
    className: 'bg-green-100 text-green-700',
  },
};

export const LifecycleNRND: Story = {
  args: {
    children: 'NRND',
    className: 'bg-yellow-100 text-yellow-700',
  },
};

export const LifecycleObsolete: Story = {
  args: {
    children: 'Obsolete',
    className: 'bg-red-100 text-red-700',
  },
};
