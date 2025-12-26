import type { Meta, StoryObj } from '@storybook/react';
import {
  EmptyState,
  NoResultsState,
  ErrorState,
  NoPermissionState,
  NoBOMsState,
  NoComponentsState,
  NoFilteredResultsState,
} from './EmptyState';
import { Inbox, FileX, Database, Shield } from 'lucide-react';
import { useState } from 'react';

const meta = {
  title: 'Shared/EmptyState',
  component: EmptyState,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A flexible empty state component for displaying when there is no data, no search results, errors, or permission issues. Includes preset variants and convenience components for common scenarios.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default empty state with Package icon
 */
export const Default: Story = {
  args: {
    title: 'No items found',
    description: 'There are no items to display at the moment.',
  },
};

/**
 * Empty state with custom icon
 */
export const CustomIcon: Story = {
  args: {
    icon: Inbox,
    title: 'Your inbox is empty',
    description: 'All caught up! No new messages.',
  },
};

/**
 * Search variant with preset Search icon
 */
export const SearchVariant: Story = {
  args: {
    variant: 'search',
    title: 'No results found',
    description: 'Try adjusting your search terms or filters.',
  },
};

/**
 * Error variant with preset AlertCircle icon
 */
export const ErrorVariant: Story = {
  args: {
    variant: 'error',
    title: 'Failed to load data',
    description: 'An error occurred while fetching the data. Please try again.',
  },
};

/**
 * No permission variant with Lock icon
 */
export const NoPermissionVariant: Story = {
  args: {
    variant: 'no-permission',
    title: 'Access denied',
    description: "You don't have permission to view this content.",
  },
};

/**
 * Small size variant (compact)
 */
export const SmallSize: Story = {
  args: {
    title: 'No items',
    description: 'Nothing to show here.',
    size: 'sm',
  },
};

/**
 * Medium size variant (default)
 */
export const MediumSize: Story = {
  args: {
    title: 'No items found',
    description: 'There are no items to display at the moment.',
    size: 'md',
  },
};

/**
 * Large size variant with background
 */
export const LargeSize: Story = {
  args: {
    title: 'No items found',
    description: 'There are no items to display at the moment.',
    size: 'lg',
  },
};

/**
 * Empty state with primary action
 */
export const WithAction: Story = {
  args: {
    icon: Database,
    title: 'No data available',
    description: 'Get started by importing your first dataset.',
    action: {
      label: 'Import data',
      onClick: () => alert('Import clicked'),
    },
  },
};

/**
 * Empty state with primary and secondary actions
 */
export const WithMultipleActions: Story = {
  args: {
    icon: FileX,
    title: 'No files uploaded',
    description: 'Upload files to get started or browse templates.',
    action: {
      label: 'Upload files',
      onClick: () => alert('Upload clicked'),
    },
    secondaryAction: {
      label: 'Browse templates',
      onClick: () => alert('Browse clicked'),
      variant: 'outline',
    },
  },
};

/**
 * Empty state with action as a link
 */
export const WithLinkAction: Story = {
  args: {
    icon: Shield,
    title: 'No security settings',
    description: 'Configure your security preferences.',
    action: {
      label: 'Go to settings',
      href: '/settings',
    },
  },
};

/**
 * Empty state with custom children content
 */
export const WithCustomContent: Story = {
  args: {
    title: 'No notifications',
    description: 'You will be notified when there are updates.',
    children: (
      <div className="mt-4 p-4 bg-muted rounded-md text-xs text-muted-foreground">
        <p>Tips for getting started:</p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>Enable notifications in settings</li>
          <li>Subscribe to updates</li>
          <li>Check back regularly</li>
        </ul>
      </div>
    ),
  },
};

/**
 * NoResultsState convenience component
 */
export const NoResults: Story = {
  render: () => {
    const [query] = useState('electronics');
    return <NoResultsState query={query} onClear={() => alert('Clear clicked')} />;
  },
  args: {} as any,
};

/**
 * ErrorState convenience component
 */
export const Error: Story = {
  render: () => {
    return (
      <ErrorState
        error="Failed to connect to server. Please check your internet connection."
        onRetry={() => alert('Retry clicked')}
      />
    );
  },
  args: {} as any,
};

/**
 * NoPermissionState convenience component
 */
export const NoPermission: Story = {
  render: () => {
    return <NoPermissionState resource="billing information" />;
  },
  args: {} as any,
};

/**
 * NoBOMsState convenience component
 */
export const NoBOMs: Story = {
  render: () => {
    return <NoBOMsState onUpload={() => alert('Upload clicked')} />;
  },
  args: {} as any,
};

/**
 * NoComponentsState convenience component
 */
export const NoComponents: Story = {
  render: () => {
    return <NoComponentsState onSearch={() => alert('Search clicked')} />;
  },
  args: {} as any,
};

/**
 * NoFilteredResultsState convenience component
 */
export const NoFilteredResults: Story = {
  render: () => {
    return <NoFilteredResultsState onClearFilters={() => alert('Clear filters clicked')} />;
  },
  args: {} as any,
};

/**
 * All size variants side by side
 */
export const AllSizes: Story = {
  render: () => (
    <div className="space-y-8 p-8 w-full">
      <div>
        <h3 className="text-sm font-medium mb-4">Small</h3>
        <EmptyState
          size="sm"
          title="No items"
          description="Nothing to show here"
          action={{ label: 'Action', onClick: () => {} }}
        />
      </div>
      <div>
        <h3 className="text-sm font-medium mb-4">Medium (Default)</h3>
        <EmptyState
          size="md"
          title="No items found"
          description="There are no items to display"
          action={{ label: 'Action', onClick: () => {} }}
        />
      </div>
      <div>
        <h3 className="text-sm font-medium mb-4">Large</h3>
        <EmptyState
          size="lg"
          title="No items found"
          description="There are no items to display at the moment"
          action={{ label: 'Action', onClick: () => {} }}
        />
      </div>
    </div>
  ),
  args: {} as any,
  parameters: {
    layout: 'fullscreen',
  },
};

/**
 * All variants side by side
 */
export const AllVariants: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-8 p-8">
      <div>
        <h3 className="text-sm font-medium mb-4">Default</h3>
        <EmptyState
          variant="default"
          title="No items"
          description="Default empty state"
        />
      </div>
      <div>
        <h3 className="text-sm font-medium mb-4">Search</h3>
        <EmptyState
          variant="search"
          title="No results"
          description="Search variant"
        />
      </div>
      <div>
        <h3 className="text-sm font-medium mb-4">Error</h3>
        <EmptyState
          variant="error"
          title="Error occurred"
          description="Error variant"
        />
      </div>
      <div>
        <h3 className="text-sm font-medium mb-4">No Permission</h3>
        <EmptyState
          variant="no-permission"
          title="Access denied"
          description="Permission variant"
        />
      </div>
    </div>
  ),
  args: {} as any,
  parameters: {
    layout: 'fullscreen',
  },
};

/**
 * Interactive example with state
 */
export const Interactive: Story = {
  render: () => {
    const [hasData, setHasData] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleLoad = () => {
      setLoading(true);
      setTimeout(() => {
        setHasData(true);
        setLoading(false);
      }, 1500);
    };

    const handleClear = () => {
      setHasData(false);
    };

    return (
      <div className="p-8 space-y-4">
        <div className="flex gap-2 mb-4">
          <button
            onClick={handleLoad}
            disabled={loading || hasData}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Load Data'}
          </button>
          <button
            onClick={handleClear}
            disabled={!hasData}
            className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md disabled:opacity-50"
          >
            Clear Data
          </button>
        </div>
        {hasData ? (
          <div className="p-8 bg-muted rounded-lg text-center">
            <p className="text-lg font-medium">Data loaded successfully!</p>
            <p className="text-sm text-muted-foreground mt-2">
              Your content would appear here.
            </p>
          </div>
        ) : (
          <EmptyState
            icon={Database}
            title="No data loaded"
            description="Click the button above to load sample data."
            action={{
              label: 'Load data',
              onClick: handleLoad,
            }}
          />
        )}
      </div>
    );
  },
  args: {} as any,
  parameters: {
    layout: 'fullscreen',
  },
};
