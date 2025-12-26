/**
 * StatusBadge Storybook Stories
 *
 * Visual testing for color-blind safe status indicators.
 * Each status is distinguishable by icon + color combination.
 */

import type { Meta, StoryObj } from '@storybook/react';
import { StatusBadge } from './status-badge';
import { STATUS_CONFIG } from '@/lib/status-colors';

const meta: Meta<typeof StatusBadge> = {
  title: 'UI/StatusBadge',
  component: StatusBadge,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Accessible status badge with icon + color combination. Ensures status is understandable without relying on color alone. Passes WCAG 4.5:1 contrast requirements.',
      },
    },
  },
  argTypes: {
    status: {
      control: 'select',
      options: Object.keys(STATUS_CONFIG),
      description: 'The status type to display',
    },
    showLabel: {
      control: 'boolean',
      description: 'Whether to show the text label',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Badge size',
    },
  },
};

export default meta;
type Story = StoryObj<typeof StatusBadge>;

// Default story
export const Default: Story = {
  args: {
    status: 'completed',
    showLabel: true,
    size: 'md',
  },
};

// All statuses in a grid
export const AllStatuses: Story = {
  render: () => (
    <div className="space-y-6 p-8">
      <div>
        <h3 className="text-lg font-semibold mb-4">All Status Types (Medium)</h3>
        <div className="grid grid-cols-3 gap-4">
          {Object.keys(STATUS_CONFIG).map((status) => (
            <div key={status} className="flex items-center gap-2">
              <StatusBadge status={status as any} size="md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  ),
};

// Size variations
export const Sizes: Story = {
  render: () => (
    <div className="space-y-6 p-8">
      <div>
        <h3 className="text-lg font-semibold mb-4">Small</h3>
        <div className="flex flex-wrap gap-3">
          <StatusBadge status="pending" size="sm" />
          <StatusBadge status="processing" size="sm" />
          <StatusBadge status="completed" size="sm" />
          <StatusBadge status="failed" size="sm" />
        </div>
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-4">Medium (Default)</h3>
        <div className="flex flex-wrap gap-3">
          <StatusBadge status="pending" size="md" />
          <StatusBadge status="processing" size="md" />
          <StatusBadge status="completed" size="md" />
          <StatusBadge status="failed" size="md" />
        </div>
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-4">Large</h3>
        <div className="flex flex-wrap gap-3">
          <StatusBadge status="pending" size="lg" />
          <StatusBadge status="processing" size="lg" />
          <StatusBadge status="completed" size="lg" />
          <StatusBadge status="failed" size="lg" />
        </div>
      </div>
    </div>
  ),
};

// Icon only (no label)
export const IconOnly: Story = {
  render: () => (
    <div className="space-y-4 p-8">
      <h3 className="text-lg font-semibold mb-4">Icon Only Mode</h3>
      <div className="flex flex-wrap gap-3">
        {Object.keys(STATUS_CONFIG).map((status) => (
          <StatusBadge key={status} status={status as any} showLabel={false} size="md" />
        ))}
      </div>
    </div>
  ),
};

// Animated states
export const AnimatedStates: Story = {
  render: () => (
    <div className="space-y-4 p-8">
      <h3 className="text-lg font-semibold mb-4">Animated Processing States</h3>
      <div className="flex flex-wrap gap-4">
        <StatusBadge status="processing" size="lg" />
        <StatusBadge status="uploading" size="lg" />
        <StatusBadge status="enriching" size="lg" />
      </div>
    </div>
  ),
};

// Color-blind simulation
export const ColorBlindTest: Story = {
  render: () => (
    <div className="space-y-8 p-8">
      <div>
        <h3 className="text-lg font-semibold mb-2">Color-Blind Accessibility Test</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Each status should be distinguishable by icon shape, not just color.
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <h4 className="text-md font-medium mb-3">Success States (Check icons)</h4>
          <div className="flex flex-wrap gap-3">
            <StatusBadge status="success" size="md" />
            <StatusBadge status="completed" size="md" />
          </div>
        </div>

        <div>
          <h4 className="text-md font-medium mb-3">Warning States (Triangle icons)</h4>
          <div className="flex flex-wrap gap-3">
            <StatusBadge status="warning" size="md" />
            <StatusBadge status="partial" size="md" />
          </div>
        </div>

        <div>
          <h4 className="text-md font-medium mb-3">Error States (X icons)</h4>
          <div className="flex flex-wrap gap-3">
            <StatusBadge status="error" size="md" />
            <StatusBadge status="failed" size="md" />
            <StatusBadge status="cancelled" size="md" />
          </div>
        </div>

        <div>
          <h4 className="text-md font-medium mb-3">Processing States (Animated)</h4>
          <div className="flex flex-wrap gap-3">
            <StatusBadge status="processing" size="md" />
            <StatusBadge status="enriching" size="md" />
            <StatusBadge status="uploading" size="md" />
          </div>
        </div>

        <div>
          <h4 className="text-md font-medium mb-3">Waiting States (Clock icons)</h4>
          <div className="flex flex-wrap gap-3">
            <StatusBadge status="pending" size="md" />
          </div>
        </div>
      </div>
    </div>
  ),
};

// Dark mode
export const DarkMode: Story = {
  parameters: {
    backgrounds: { default: 'dark' },
  },
  render: () => (
    <div className="dark space-y-6 p-8">
      <h3 className="text-lg font-semibold mb-4 text-white">Dark Mode Support</h3>
      <div className="grid grid-cols-3 gap-4">
        {Object.keys(STATUS_CONFIG).map((status) => (
          <StatusBadge key={status} status={status as any} size="md" />
        ))}
      </div>
    </div>
  ),
};

// Custom labels
export const CustomLabels: Story = {
  render: () => (
    <div className="space-y-4 p-8">
      <h3 className="text-lg font-semibold mb-4">Custom Labels</h3>
      <div className="flex flex-wrap gap-3">
        <StatusBadge status="completed" customLabel="Done" size="md" />
        <StatusBadge status="processing" customLabel="In Progress" size="md" />
        <StatusBadge status="failed" customLabel="Rejected" size="md" />
        <StatusBadge status="pending" customLabel="Waiting" size="md" />
      </div>
    </div>
  ),
};
