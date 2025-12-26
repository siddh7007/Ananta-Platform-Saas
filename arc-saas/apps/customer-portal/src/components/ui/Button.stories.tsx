import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './button';
import { Loader2, Plus, ArrowRight, Download } from 'lucide-react';

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
      description: 'Button visual style variant',
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'icon'],
      description: 'Button size',
    },
    disabled: {
      control: 'boolean',
      description: 'Disable the button',
    },
    asChild: {
      control: 'boolean',
      description: 'Render as child element',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Base variants
export const Default: Story = {
  args: {
    children: 'Default Button',
    variant: 'default',
  },
};

export const Destructive: Story = {
  args: {
    children: 'Delete Item',
    variant: 'destructive',
  },
};

export const Outline: Story = {
  args: {
    children: 'Outline Button',
    variant: 'outline',
  },
};

export const Secondary: Story = {
  args: {
    children: 'Secondary Button',
    variant: 'secondary',
  },
};

export const Ghost: Story = {
  args: {
    children: 'Ghost Button',
    variant: 'ghost',
  },
};

export const Link: Story = {
  args: {
    children: 'Link Button',
    variant: 'link',
  },
};

// Sizes
export const Small: Story = {
  args: {
    children: 'Small Button',
    size: 'sm',
  },
};

export const Large: Story = {
  args: {
    children: 'Large Button',
    size: 'lg',
  },
};

export const IconButton: Story = {
  args: {
    children: <Plus className="h-4 w-4" />,
    size: 'icon',
    'aria-label': 'Add item',
  },
};

// States
export const Disabled: Story = {
  args: {
    children: 'Disabled Button',
    disabled: true,
  },
};

export const Loading: Story = {
  args: {
    children: (
      <>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading...
      </>
    ),
    disabled: true,
  },
};

// With icons
export const WithIconLeft: Story = {
  args: {
    children: (
      <>
        <Plus className="mr-2 h-4 w-4" />
        Add Item
      </>
    ),
  },
};

export const WithIconRight: Story = {
  args: {
    children: (
      <>
        Continue
        <ArrowRight className="ml-2 h-4 w-4" />
      </>
    ),
  },
};

// Real-world examples
export const DownloadButton: Story = {
  args: {
    children: (
      <>
        <Download className="mr-2 h-4 w-4" />
        Download PDF
      </>
    ),
    variant: 'outline',
  },
};

export const SaveButton: Story = {
  args: {
    children: 'Save Changes',
    variant: 'default',
    size: 'lg',
  },
};

export const CancelButton: Story = {
  args: {
    children: 'Cancel',
    variant: 'ghost',
  },
};
