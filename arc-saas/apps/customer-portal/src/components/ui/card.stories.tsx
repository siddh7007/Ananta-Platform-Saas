import type { Meta, StoryObj } from '@storybook/react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './card';
import { Button } from './button';
import { Badge } from './badge';

/**
 * Card component with elevation, hover, status, and loading variants.
 *
 * The Card component is a container with support for multiple visual variants:
 * - Elevation: Control shadow depth (none, flat, raised, floating)
 * - Hover: Interactive hover effects (lift, glow, scale)
 * - Status: Colored left border for semantic states (success, warning, error, info)
 * - Loading: Overlay with spinner during async operations
 * - Clickable: Makes card appear interactive with cursor and scale feedback
 */
const meta = {
  title: 'UI/Card',
  component: Card,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    elevation: {
      control: 'select',
      options: ['none', 'flat', 'raised', 'floating'],
      description: 'Shadow depth of the card',
      table: {
        defaultValue: { summary: 'flat' },
      },
    },
    hover: {
      control: 'select',
      options: ['none', 'lift', 'glow', 'scale'],
      description: 'Hover effect style',
      table: {
        defaultValue: { summary: 'none' },
      },
    },
    clickable: {
      control: 'boolean',
      description: 'Makes card appear interactive',
      table: {
        defaultValue: { summary: 'false' },
      },
    },
    status: {
      control: 'select',
      options: [undefined, 'success', 'warning', 'error', 'info'],
      description: 'Status indicator with colored left border',
    },
    loading: {
      control: 'boolean',
      description: 'Shows loading overlay',
      table: {
        defaultValue: { summary: 'false' },
      },
    },
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default card with flat elevation and no hover effect.
 */
export const Default: Story = {
  args: {},
  render: (args) => (
    <Card {...args} className="w-[350px]">
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card Description</CardDescription>
      </CardHeader>
      <CardContent>
        <p>This is the default card with flat elevation.</p>
      </CardContent>
    </Card>
  ),
};

/**
 * Card with footer actions.
 */
export const WithFooter: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Create Project</CardTitle>
        <CardDescription>Deploy your new project in one-click.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Configure your project settings below.</p>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline">Cancel</Button>
        <Button>Deploy</Button>
      </CardFooter>
    </Card>
  ),
};

/**
 * Card with raised elevation.
 */
export const Raised: Story = {
  args: {
    elevation: 'raised',
  },
  render: (args) => (
    <Card {...args} className="w-[350px]">
      <CardHeader>
        <CardTitle>Raised Card</CardTitle>
        <CardDescription>Medium shadow depth</CardDescription>
      </CardHeader>
      <CardContent>
        <p>This card appears raised above the page.</p>
      </CardContent>
    </Card>
  ),
};

/**
 * Card with floating elevation.
 */
export const Floating: Story = {
  args: {
    elevation: 'floating',
  },
  render: (args) => (
    <Card {...args} className="w-[350px]">
      <CardHeader>
        <CardTitle>Floating Card</CardTitle>
        <CardDescription>Large shadow depth</CardDescription>
      </CardHeader>
      <CardContent>
        <p>This card appears to float above the page.</p>
      </CardContent>
    </Card>
  ),
};

/**
 * Card with lift hover effect.
 */
export const HoverLift: Story = {
  args: {
    elevation: 'raised',
    hover: 'lift',
  },
  render: (args) => (
    <Card {...args} className="w-[350px]">
      <CardHeader>
        <CardTitle>Hover to Lift</CardTitle>
        <CardDescription>Card lifts up on hover</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Hover over this card to see the lift effect.</p>
      </CardContent>
    </Card>
  ),
};

/**
 * Card with glow hover effect.
 */
export const HoverGlow: Story = {
  args: {
    elevation: 'raised',
    hover: 'glow',
  },
  render: (args) => (
    <Card {...args} className="w-[350px]">
      <CardHeader>
        <CardTitle>Hover to Glow</CardTitle>
        <CardDescription>Card glows on hover</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Hover over this card to see the glow effect.</p>
      </CardContent>
    </Card>
  ),
};

/**
 * Card with scale hover effect.
 */
export const HoverScale: Story = {
  args: {
    elevation: 'raised',
    hover: 'scale',
  },
  render: (args) => (
    <Card {...args} className="w-[350px]">
      <CardHeader>
        <CardTitle>Hover to Scale</CardTitle>
        <CardDescription>Card scales up on hover</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Hover over this card to see the scale effect.</p>
      </CardContent>
    </Card>
  ),
};

/**
 * Clickable card with interaction feedback.
 */
export const Clickable: Story = {
  args: {
    elevation: 'raised',
    hover: 'lift',
    clickable: true,
  },
  render: (args) => (
    <Card {...args} className="w-[350px]" onClick={() => alert('Card clicked!')}>
      <CardHeader>
        <CardTitle>Clickable Card</CardTitle>
        <CardDescription>Click to trigger action</CardDescription>
      </CardHeader>
      <CardContent>
        <p>This card is clickable and provides visual feedback.</p>
      </CardContent>
    </Card>
  ),
};

/**
 * Card with success status.
 */
export const StatusSuccess: Story = {
  args: {
    elevation: 'raised',
    status: 'success',
  },
  render: (args) => (
    <Card {...args} className="w-[350px]">
      <CardHeader>
        <CardTitle>Success Status</CardTitle>
        <CardDescription>Operation completed successfully</CardDescription>
      </CardHeader>
      <CardContent>
        <p>This card indicates a successful state.</p>
      </CardContent>
    </Card>
  ),
};

/**
 * Card with warning status.
 */
export const StatusWarning: Story = {
  args: {
    elevation: 'raised',
    status: 'warning',
  },
  render: (args) => (
    <Card {...args} className="w-[350px]">
      <CardHeader>
        <CardTitle>Warning Status</CardTitle>
        <CardDescription>Attention required</CardDescription>
      </CardHeader>
      <CardContent>
        <p>This card indicates a warning state.</p>
      </CardContent>
    </Card>
  ),
};

/**
 * Card with error status.
 */
export const StatusError: Story = {
  args: {
    elevation: 'raised',
    status: 'error',
  },
  render: (args) => (
    <Card {...args} className="w-[350px]">
      <CardHeader>
        <CardTitle>Error Status</CardTitle>
        <CardDescription>Something went wrong</CardDescription>
      </CardHeader>
      <CardContent>
        <p>This card indicates an error state.</p>
      </CardContent>
    </Card>
  ),
};

/**
 * Card with info status.
 */
export const StatusInfo: Story = {
  args: {
    elevation: 'raised',
    status: 'info',
  },
  render: (args) => (
    <Card {...args} className="w-[350px]">
      <CardHeader>
        <CardTitle>Info Status</CardTitle>
        <CardDescription>Information available</CardDescription>
      </CardHeader>
      <CardContent>
        <p>This card indicates an informational state.</p>
      </CardContent>
    </Card>
  ),
};

/**
 * Card in loading state.
 */
export const Loading: Story = {
  args: {
    elevation: 'raised',
    loading: true,
  },
  render: (args) => (
    <Card {...args} className="w-[350px]">
      <CardHeader>
        <CardTitle>Loading Card</CardTitle>
        <CardDescription>Fetching data...</CardDescription>
      </CardHeader>
      <CardContent>
        <p>This card is in a loading state.</p>
      </CardContent>
    </Card>
  ),
};

/**
 * Subscription card with variants.
 */
export const SubscriptionCard: Story = {
  render: () => (
    <Card className="w-[400px]" elevation="raised" hover="lift">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Professional Plan</CardTitle>
          <Badge className="bg-green-100 text-green-700">Active</Badge>
        </div>
        <CardDescription>Your current subscription</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Price</span>
          <span className="font-medium">$79/month</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Next billing</span>
          <span className="font-medium">Jan 15, 2025</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">BOMs used</span>
          <span className="font-medium">12 / 50</span>
        </div>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button variant="outline" className="flex-1">
          Manage Billing
        </Button>
        <Button className="flex-1">Change Plan</Button>
      </CardFooter>
    </Card>
  ),
};

/**
 * BOM card with clickable interaction.
 */
export const BomCard: Story = {
  render: () => (
    <Card
      className="w-[350px]"
      elevation="raised"
      hover="lift"
      clickable
      onClick={() => alert('Navigate to BOM details')}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">PCB Assembly v2.1</CardTitle>
          <Badge className="bg-green-100 text-green-700">Complete</Badge>
        </div>
        <CardDescription>Last updated: Dec 10, 2024</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Line items</span>
          <span className="font-medium">47</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Enrichment</span>
          <span className="font-medium">92%</span>
        </div>
      </CardContent>
      <CardFooter>
        <Button className="w-full">View Details</Button>
      </CardFooter>
    </Card>
  ),
};

/**
 * Error notification card.
 */
export const ErrorNotification: Story = {
  render: () => (
    <Card className="w-[350px]" elevation="raised" status="error">
      <CardHeader>
        <CardTitle>Build Failed</CardTitle>
        <CardDescription>Production deployment</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm">
          The build process encountered errors. Please check the logs for more information.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">2 minutes ago</p>
      </CardContent>
      <CardFooter>
        <Button size="sm" variant="destructive">
          View Logs
        </Button>
      </CardFooter>
    </Card>
  ),
};

/**
 * Playground for testing all variants.
 */
export const Playground: Story = {
  args: {
    elevation: 'raised',
    hover: 'lift',
    clickable: true,
    status: undefined,
    loading: false,
  },
  render: (args) => (
    <Card {...args} className="w-[350px]" onClick={() => console.log('Card clicked!')}>
      <CardHeader>
        <CardTitle>Playground Card</CardTitle>
        <CardDescription>Test different variant combinations</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Use the controls to test different combinations of card variants.</p>
      </CardContent>
      <CardFooter>
        <Button size="sm">Action</Button>
      </CardFooter>
    </Card>
  ),
};
