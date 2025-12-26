/**
 * EmptyState Component Examples
 *
 * Real-world usage examples demonstrating various empty state scenarios
 * in a typical CBP customer portal context.
 */

import { useState } from 'react';
import {
  EmptyState,
  NoResultsState,
  ErrorState,
  NoPermissionState,
  NoBOMsState,
  NoComponentsState,
  NoFilteredResultsState,
} from './EmptyState';
import { Upload, FileX, Shield, Filter } from 'lucide-react';

// Example 1: BOM List Page with Upload
export function BOMListExample() {
  const [boms] = useState<any[]>([]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Bill of Materials</h1>
      {boms.length === 0 ? (
        <NoBOMsState onUpload={() => console.log('Upload clicked')} />
      ) : (
        <div>BOM List would render here</div>
      )}
    </div>
  );
}

// Example 2: Search Results
export function SearchResultsExample() {
  const [searchQuery, setSearchQuery] = useState('resistor 100k');
  const [results] = useState<any[]>([]);

  return (
    <div className="p-6">
      <div className="mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search components..."
          className="w-full px-4 py-2 border rounded-md"
        />
      </div>
      {results.length === 0 && searchQuery && (
        <NoResultsState
          query={searchQuery}
          onClear={() => setSearchQuery('')}
        />
      )}
    </div>
  );
}

// Example 3: Error State with Retry
export function DataFetchingExample() {
  const [error, setError] = useState<string | null>(
    'Failed to connect to the enrichment service. Please check your internet connection.'
  );

  const handleRetry = () => {
    console.log('Retrying...');
    setError(null);
  };

  return (
    <div className="p-6">
      {error ? (
        <ErrorState error={error} onRetry={handleRetry} />
      ) : (
        <div>Data would render here</div>
      )}
    </div>
  );
}

// Example 4: Permission-Gated Content
export function BillingPageExample() {
  const [hasAccess] = useState(false);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Billing & Invoices</h1>
      {!hasAccess ? (
        <NoPermissionState resource="billing information" />
      ) : (
        <div>Billing content would render here</div>
      )}
    </div>
  );
}

// Example 5: Filtered Results with No Matches
export function FilteredListExample() {
  const [hasFilters, setHasFilters] = useState(true);
  const [filteredResults] = useState<any[]>([]);

  return (
    <div className="p-6">
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setHasFilters(!hasFilters)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
        >
          Toggle Filters
        </button>
      </div>
      {filteredResults.length === 0 && hasFilters && (
        <NoFilteredResultsState onClearFilters={() => setHasFilters(false)} />
      )}
    </div>
  );
}

// Example 6: Component Library Search
export function ComponentSearchExample() {
  const [components] = useState<any[]>([]);

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">Component Library</h2>
      {components.length === 0 && (
        <NoComponentsState onSearch={() => console.log('Search clicked')} />
      )}
    </div>
  );
}

// Example 7: Custom Empty State with Multiple Actions
export function ProjectsExample() {
  const [projects] = useState<any[]>([]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Projects</h1>
      {projects.length === 0 && (
        <EmptyState
          icon={FileX}
          title="No projects yet"
          description="Create a new project or import an existing one to get started."
          size="lg"
          action={{
            label: 'Create project',
            onClick: () => console.log('Create clicked'),
          }}
          secondaryAction={{
            label: 'Import project',
            onClick: () => console.log('Import clicked'),
            variant: 'outline',
          }}
        />
      )}
    </div>
  );
}

// Example 8: Small Inline Empty State
export function SidebarRecentItemsExample() {
  const [recentItems] = useState<any[]>([]);

  return (
    <div className="w-64 p-4 border rounded-lg">
      <h3 className="text-sm font-semibold mb-3">Recent Items</h3>
      {recentItems.length === 0 && (
        <EmptyState
          size="sm"
          title="No recent items"
          description="Items you view will appear here."
        />
      )}
    </div>
  );
}

// Example 9: Custom Content with Tips
export function OnboardingExample() {
  const [isComplete] = useState(false);

  return (
    <div className="p-6">
      {!isComplete && (
        <EmptyState
          icon={Upload}
          title="Welcome to your BOM Dashboard"
          description="Upload your first Bill of Materials to start analyzing components"
          size="lg"
          action={{
            label: 'Upload BOM',
            onClick: () => console.log('Upload clicked'),
          }}
        >
          <div className="mt-6 p-4 bg-muted/50 rounded-lg text-left">
            <p className="text-sm font-medium mb-2">What you can do:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>✓ Upload BOMs in CSV or Excel format</li>
              <li>✓ Automatically enrich component data</li>
              <li>✓ Track supply chain risks</li>
              <li>✓ Generate compliance reports</li>
            </ul>
          </div>
        </EmptyState>
      )}
    </div>
  );
}

// Example 10: Conditional Rendering Based on State
export function ConditionalExample() {
  const [status, setStatus] = useState<'loading' | 'error' | 'empty' | 'data'>('empty');

  return (
    <div className="p-6 space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setStatus('loading')}
          className="px-3 py-1 bg-secondary rounded text-sm"
        >
          Loading
        </button>
        <button
          onClick={() => setStatus('error')}
          className="px-3 py-1 bg-secondary rounded text-sm"
        >
          Error
        </button>
        <button
          onClick={() => setStatus('empty')}
          className="px-3 py-1 bg-secondary rounded text-sm"
        >
          Empty
        </button>
        <button
          onClick={() => setStatus('data')}
          className="px-3 py-1 bg-secondary rounded text-sm"
        >
          Data
        </button>
      </div>

      {status === 'loading' && (
        <div className="text-center py-12">Loading...</div>
      )}

      {status === 'error' && (
        <ErrorState
          error="Failed to load data"
          onRetry={() => setStatus('loading')}
        />
      )}

      {status === 'empty' && (
        <EmptyState
          title="No data available"
          description="Try importing or creating new data."
          action={{
            label: 'Create data',
            onClick: () => setStatus('data'),
          }}
        />
      )}

      {status === 'data' && (
        <div className="p-8 bg-muted rounded-lg text-center">
          <p className="text-lg font-medium">Data loaded successfully!</p>
        </div>
      )}
    </div>
  );
}

// Example 11: Access Control with Link Action
export function SettingsAccessExample() {
  const [canAccess] = useState(false);

  return (
    <div className="p-6">
      {!canAccess ? (
        <EmptyState
          icon={Shield}
          variant="no-permission"
          title="Restricted Access"
          description="You need admin permissions to access organization settings."
          action={{
            label: 'Contact admin',
            href: '/team',
          }}
        />
      ) : (
        <div>Settings would render here</div>
      )}
    </div>
  );
}

// Example 12: Filtered Table with Clear Action
export function FilteredTableExample() {
  const [activeFilters, setActiveFilters] = useState(['status:active', 'category:resistor']);
  const [results] = useState<any[]>([]);

  return (
    <div className="p-6">
      <div className="mb-4">
        <div className="flex gap-2">
          {activeFilters.map((filter) => (
            <span
              key={filter}
              className="px-2 py-1 bg-secondary text-secondary-foreground rounded text-sm"
            >
              {filter}
            </span>
          ))}
        </div>
      </div>

      {results.length === 0 && activeFilters.length > 0 && (
        <EmptyState
          icon={Filter}
          title="No matches found"
          description={`No components match your ${activeFilters.length} active filter${
            activeFilters.length > 1 ? 's' : ''
          }.`}
          action={{
            label: 'Clear all filters',
            onClick: () => setActiveFilters([]),
            variant: 'outline',
          }}
        />
      )}
    </div>
  );
}

// Export all examples for Storybook or documentation
export const EmptyStateExamples = {
  BOMListExample,
  SearchResultsExample,
  DataFetchingExample,
  BillingPageExample,
  FilteredListExample,
  ComponentSearchExample,
  ProjectsExample,
  SidebarRecentItemsExample,
  OnboardingExample,
  ConditionalExample,
  SettingsAccessExample,
  FilteredTableExample,
};

export default EmptyStateExamples;
