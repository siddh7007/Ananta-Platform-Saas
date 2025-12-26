/**
 * ResponsiveTable Storybook Stories
 *
 * Stories demonstrating the responsive table component:
 * - Desktop table layout
 * - Mobile card layout
 * - Loading and empty states
 * - Selection functionality
 * - Custom cell rendering
 * - Row actions
 */

import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { ResponsiveTable, ResponsiveTableColumn } from './ResponsiveTable';
import { Button } from './button';
import { Badge } from './badge';
import { MoreHorizontal, Edit, Trash2, Eye } from 'lucide-react';

// Sample data interface
interface Product {
  id: string;
  name: string;
  sku: string;
  status: 'active' | 'inactive' | 'pending';
  price: number;
  stock: number;
  category: string;
  lastUpdated: string;
}

// Sample data
const sampleProducts: Product[] = [
  {
    id: '1',
    name: 'Resistor 10kΩ',
    sku: 'RES-10K-001',
    status: 'active',
    price: 0.05,
    stock: 10000,
    category: 'Passive Components',
    lastUpdated: '2024-01-15',
  },
  {
    id: '2',
    name: 'Capacitor 100µF',
    sku: 'CAP-100UF-002',
    status: 'active',
    price: 0.15,
    stock: 5000,
    category: 'Passive Components',
    lastUpdated: '2024-01-14',
  },
  {
    id: '3',
    name: 'MCU STM32F4',
    sku: 'MCU-STM32-003',
    status: 'pending',
    price: 8.50,
    stock: 250,
    category: 'Microcontrollers',
    lastUpdated: '2024-01-13',
  },
  {
    id: '4',
    name: 'LED RGB 5mm',
    sku: 'LED-RGB-004',
    status: 'inactive',
    price: 0.25,
    stock: 0,
    category: 'LEDs',
    lastUpdated: '2024-01-10',
  },
  {
    id: '5',
    name: 'Transistor 2N2222',
    sku: 'TRN-2N22-005',
    status: 'active',
    price: 0.10,
    stock: 8000,
    category: 'Semiconductors',
    lastUpdated: '2024-01-12',
  },
];

// Column definitions
const productColumns: ResponsiveTableColumn<Product>[] = [
  {
    key: 'name',
    header: 'Product Name',
    isPrimary: true,
  },
  {
    key: 'sku',
    header: 'SKU',
    showOnMobile: true,
  },
  {
    key: 'status',
    header: 'Status',
    showOnMobile: true,
    render: (item) => {
      const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
        active: 'default',
        inactive: 'destructive',
        pending: 'secondary',
      };
      return <Badge variant={variants[item.status]}>{item.status}</Badge>;
    },
  },
  {
    key: 'price',
    header: 'Price',
    align: 'right',
    render: (item) => `$${item.price.toFixed(2)}`,
  },
  {
    key: 'stock',
    header: 'Stock',
    align: 'right',
    render: (item) => item.stock.toLocaleString(),
  },
  {
    key: 'category',
    header: 'Category',
  },
  {
    key: 'lastUpdated',
    header: 'Last Updated',
  },
];

// Basic columns for simpler examples
const basicColumns: ResponsiveTableColumn<Product>[] = [
  { key: 'name', header: 'Name', isPrimary: true },
  { key: 'sku', header: 'SKU', showOnMobile: true },
  { key: 'status', header: 'Status', showOnMobile: true },
  { key: 'price', header: 'Price', align: 'right' },
];

const meta: Meta<typeof ResponsiveTable<Product>> = {
  title: 'UI/ResponsiveTable',
  component: ResponsiveTable,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A responsive table component that automatically switches between a traditional table layout on desktop and a card-based layout on mobile devices.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    data: {
      description: 'Array of data items to display',
    },
    columns: {
      description: 'Column definitions for the table',
    },
    isLoading: {
      control: 'boolean',
      description: 'Shows loading state when true',
    },
    selectable: {
      control: 'boolean',
      description: 'Enables row selection when true',
    },
    striped: {
      control: 'boolean',
      description: 'Adds striped row styling',
    },
    hoverable: {
      control: 'boolean',
      description: 'Adds hover effect on rows',
    },
    emptyMessage: {
      control: 'text',
      description: 'Message shown when data is empty',
    },
    ariaLabel: {
      control: 'text',
      description: 'Accessible label for the table',
    },
  },
};

export default meta;
type Story = StoryObj<typeof ResponsiveTable<Product>>;

// =============================================================================
// Basic Stories
// =============================================================================

export const Default: Story = {
  args: {
    data: sampleProducts,
    columns: basicColumns,
    getRowKey: (item) => item.id,
    ariaLabel: 'Products table',
  },
};

export const WithAllColumns: Story = {
  args: {
    data: sampleProducts,
    columns: productColumns,
    getRowKey: (item) => item.id,
    ariaLabel: 'Products table',
  },
};

// =============================================================================
// Loading & Empty States
// =============================================================================

export const Loading: Story = {
  args: {
    data: [],
    columns: basicColumns,
    getRowKey: (item) => item.id,
    isLoading: true,
    ariaLabel: 'Products table',
  },
};

export const CustomLoadingComponent: Story = {
  args: {
    data: [],
    columns: basicColumns,
    getRowKey: (item) => item.id,
    isLoading: true,
    loadingComponent: (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-pulse space-y-4 w-full max-w-md">
          <div className="h-4 bg-muted rounded w-3/4"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
          <div className="h-4 bg-muted rounded w-5/6"></div>
        </div>
        <p className="text-muted-foreground mt-4">Loading products...</p>
      </div>
    ),
    ariaLabel: 'Products table',
  },
};

export const Empty: Story = {
  args: {
    data: [],
    columns: basicColumns,
    getRowKey: (item) => item.id,
    emptyMessage: 'No products found',
    ariaLabel: 'Products table',
  },
};

export const CustomEmptyComponent: Story = {
  args: {
    data: [],
    columns: basicColumns,
    getRowKey: (item) => item.id,
    emptyComponent: (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="text-6xl mb-4">📦</div>
        <h3 className="text-lg font-medium">No products yet</h3>
        <p className="text-muted-foreground mb-4">Get started by adding your first product</p>
        <Button>Add Product</Button>
      </div>
    ),
    ariaLabel: 'Products table',
  },
};

// =============================================================================
// Interactive Features
// =============================================================================

export const Clickable: Story = {
  args: {
    data: sampleProducts,
    columns: basicColumns,
    getRowKey: (item) => item.id,
    onRowClick: fn(),
    ariaLabel: 'Products table',
  },
  parameters: {
    docs: {
      description: {
        story: 'Rows become clickable when onRowClick is provided. Supports keyboard navigation with Enter/Space keys.',
      },
    },
  },
};

export const Selectable: Story = {
  args: {
    data: sampleProducts,
    columns: basicColumns,
    getRowKey: (item) => item.id,
    selectable: true,
    selectedKeys: ['1', '3'],
    onSelectionChange: fn(),
    ariaLabel: 'Products table',
  },
  parameters: {
    docs: {
      description: {
        story: 'Enable row selection with checkboxes. Includes select all functionality.',
      },
    },
  },
};

export const WithRowActions: Story = {
  args: {
    data: sampleProducts,
    columns: basicColumns,
    getRowKey: (item) => item.id,
    renderActions: (item) => (
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`View ${item.name}`}>
          <Eye className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Edit ${item.name}`}>
          <Edit className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Delete ${item.name}`}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    ),
    ariaLabel: 'Products table',
  },
};

export const WithDropdownActions: Story = {
  args: {
    data: sampleProducts,
    columns: basicColumns,
    getRowKey: (item) => item.id,
    renderActions: () => (
      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="More actions">
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    ),
    ariaLabel: 'Products table',
  },
};

// =============================================================================
// Styling Variants
// =============================================================================

export const Striped: Story = {
  args: {
    data: sampleProducts,
    columns: basicColumns,
    getRowKey: (item) => item.id,
    striped: true,
    ariaLabel: 'Products table',
  },
};

export const NoHover: Story = {
  args: {
    data: sampleProducts,
    columns: basicColumns,
    getRowKey: (item) => item.id,
    hoverable: false,
    ariaLabel: 'Products table',
  },
};

export const StripedWithSelection: Story = {
  args: {
    data: sampleProducts,
    columns: basicColumns,
    getRowKey: (item) => item.id,
    striped: true,
    selectable: true,
    selectedKeys: ['2'],
    onSelectionChange: fn(),
    ariaLabel: 'Products table',
  },
};

// =============================================================================
// Mobile-Specific Stories
// =============================================================================

export const MobileCardLayout: Story = {
  args: {
    data: sampleProducts.slice(0, 3),
    columns: productColumns,
    getRowKey: (item) => item.id,
    ariaLabel: 'Products table',
    maxMobileFields: 4,
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
    docs: {
      description: {
        story: 'On mobile devices, the table transforms into a card-based layout. Resize your browser or use mobile viewport to see.',
      },
    },
  },
};

export const MobileWithShowMore: Story = {
  args: {
    data: sampleProducts.slice(0, 2),
    columns: productColumns,
    getRowKey: (item) => item.id,
    ariaLabel: 'Products table',
    maxMobileFields: 3,
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
    docs: {
      description: {
        story: 'When there are more fields than maxMobileFields, a "Show more" button appears to expand the card.',
      },
    },
  },
};

// =============================================================================
// Full Featured Example
// =============================================================================

export const FullFeatured: Story = {
  args: {
    data: sampleProducts,
    columns: productColumns,
    getRowKey: (item) => item.id,
    selectable: true,
    selectedKeys: [],
    onSelectionChange: fn(),
    onRowClick: fn(),
    striped: true,
    renderActions: (item) => (
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`View ${item.name}`}>
          <Eye className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Edit ${item.name}`}>
          <Edit className="h-4 w-4" />
        </Button>
      </div>
    ),
    ariaLabel: 'Products inventory table',
  },
  parameters: {
    docs: {
      description: {
        story: 'A full-featured example combining selection, row click, custom rendering, and row actions.',
      },
    },
  },
};
