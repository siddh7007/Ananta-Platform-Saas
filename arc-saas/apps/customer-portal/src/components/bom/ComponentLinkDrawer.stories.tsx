import type { Meta, StoryObj } from '@storybook/react';
import { within, userEvent, expect } from '@storybook/test';
import { ComponentLinkDrawer } from './ComponentLinkDrawer';
import type { BomLineItem } from '@/types/bom';

/**
 * ComponentLinkDrawer
 *
 * A drawer component for searching and manually linking components to BOM line items.
 * Used when automatic enrichment fails or needs manual override.
 */

// Mock line item for stories
const mockLineItem: BomLineItem = {
  id: 'line-001',
  bomId: 'bom-001',
  lineNumber: 1,
  mpn: 'LM358',
  manufacturer: 'Texas Instruments',
  description: 'Dual Operational Amplifier',
  quantity: 10,
  enrichmentStatus: 'pending',
};

const mockLineItemNoMatch: BomLineItem = {
  id: 'line-002',
  bomId: 'bom-001',
  lineNumber: 2,
  mpn: 'UNKNOWN-PART-123',
  manufacturer: undefined,
  description: 'Unknown component',
  quantity: 5,
  enrichmentStatus: 'error',
};

const meta: Meta<typeof ComponentLinkDrawer> = {
  title: 'BOM/ComponentLinkDrawer',
  component: ComponentLinkDrawer,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
# Component Link Drawer

A slide-out drawer for searching and linking components to BOM line items.

## Features
- **Search**: Real-time search by MPN or manufacturer
- **Debounced Input**: 300ms debounce to prevent excessive API calls
- **Component Details**: Shows lifecycle status, manufacturer, category
- **Lifecycle Icons**: Visual indicators for active/NRND/obsolete status
- **Datasheet Link**: Direct link to component datasheets when available
- **Error Handling**: Displays link errors with retry option

## Usage
Opens when a user wants to manually link/re-link a component to a BOM line item,
typically from the BOM detail page when enrichment fails or returns wrong results.
        `,
      },
    },
  },
  argTypes: {
    open: {
      control: 'boolean',
      description: 'Whether the drawer is open',
    },
    bomId: {
      control: 'text',
      description: 'ID of the parent BOM',
    },
    lineItem: {
      control: 'object',
      description: 'The BOM line item to link a component to',
    },
    onClose: {
      action: 'closed',
      description: 'Called when drawer is closed',
    },
    onLinked: {
      action: 'linked',
      description: 'Called when component is successfully linked',
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="relative min-h-screen bg-background">
        <div className="p-6">
          <h1 className="text-xl font-bold">BOM Detail Page (Background)</h1>
          <p className="text-muted-foreground">The drawer slides in from the right</p>
        </div>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default open state with a line item that has MPN
 */
export const Open: Story = {
  args: {
    open: true,
    bomId: 'bom-001',
    lineItem: mockLineItem,
    onClose: () => {},
    onLinked: () => {},
  },
};

/**
 * Closed state - drawer is hidden
 */
export const Closed: Story = {
  args: {
    open: false,
    bomId: 'bom-001',
    lineItem: mockLineItem,
    onClose: () => {},
    onLinked: () => {},
  },
};

/**
 * With failed enrichment line item
 */
export const FailedEnrichment: Story = {
  args: {
    open: true,
    bomId: 'bom-001',
    lineItem: mockLineItemNoMatch,
    onClose: () => {},
    onLinked: () => {},
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows the drawer when a line item has failed enrichment and needs manual linking.',
      },
    },
  },
};

/**
 * No line item selected
 */
export const NoLineItem: Story = {
  args: {
    open: true,
    bomId: 'bom-001',
    lineItem: null,
    onClose: () => {},
    onLinked: () => {},
  },
  parameters: {
    docs: {
      description: {
        story: 'Edge case where drawer opens without a line item selected.',
      },
    },
  },
};

/**
 * Interactive test: search input behavior
 */
export const InteractiveSearch: Story = {
  args: {
    open: true,
    bomId: 'bom-001',
    lineItem: mockLineItem,
    onClose: () => {},
    onLinked: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify header is visible
    const header = await canvas.findByText('Link Component');
    expect(header).toBeInTheDocument();

    // Verify search input exists
    const searchInput = await canvas.findByPlaceholderText(/Search by MPN/i);
    expect(searchInput).toBeInTheDocument();

    // Verify pre-filled with MPN
    expect(searchInput).toHaveValue('LM358');

    // Clear and type new search
    await userEvent.clear(searchInput);
    await userEvent.type(searchInput, 'ATmega');

    // Verify value changed
    expect(searchInput).toHaveValue('ATmega');
  },
};

/**
 * Mobile responsive view
 */
export const MobileView: Story = {
  args: {
    open: true,
    bomId: 'bom-001',
    lineItem: mockLineItem,
    onClose: () => {},
    onLinked: () => {},
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
    docs: {
      description: {
        story: 'Drawer takes full width on mobile devices.',
      },
    },
  },
};
