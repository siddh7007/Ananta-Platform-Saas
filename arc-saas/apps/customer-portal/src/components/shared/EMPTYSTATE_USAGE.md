# EmptyState Component Usage Guide

A flexible, accessible empty state component for displaying when there's no data, no search results, errors, or permission issues.

## Quick Start

```tsx
import { EmptyState } from '@/components/shared';

function MyComponent() {
  return (
    <EmptyState
      title="No items found"
      description="There are no items to display at the moment."
      action={{
        label: 'Create item',
        onClick: () => handleCreate(),
      }}
    />
  );
}
```

## Features

- **4 Preset Variants**: default, search, error, no-permission
- **3 Size Options**: sm, md, lg
- **Flexible Actions**: Support for primary and secondary actions
- **Link Support**: Actions can be onClick handlers or navigation links
- **Accessibility**: Full ARIA support with proper heading hierarchy
- **Custom Content**: Support for additional content below description
- **Convenience Components**: Pre-configured components for common scenarios

## Basic Usage

### Default Empty State

```tsx
<EmptyState
  title="No items"
  description="Nothing to display here."
/>
```

### With Custom Icon

```tsx
import { Inbox } from 'lucide-react';

<EmptyState
  icon={Inbox}
  title="Your inbox is empty"
  description="All caught up! No new messages."
/>
```

### With Action Button

```tsx
<EmptyState
  title="No data available"
  description="Get started by importing your first dataset."
  action={{
    label: 'Import data',
    onClick: () => handleImport(),
  }}
/>
```

### With Link Action

```tsx
<EmptyState
  title="No security settings"
  description="Configure your security preferences."
  action={{
    label: 'Go to settings',
    href: '/settings',
  }}
/>
```

### With Multiple Actions

```tsx
<EmptyState
  title="No files uploaded"
  description="Upload files to get started or browse templates."
  action={{
    label: 'Upload files',
    onClick: () => handleUpload(),
  }}
  secondaryAction={{
    label: 'Browse templates',
    onClick: () => handleBrowse(),
    variant: 'outline',
  }}
/>
```

## Variants

### Default Variant

Generic empty state with Package icon:

```tsx
<EmptyState
  variant="default"
  title="No items"
  description="Nothing to show here."
/>
```

### Search Variant

For no search results (Search icon):

```tsx
<EmptyState
  variant="search"
  title="No results found"
  description="Try adjusting your search terms."
/>
```

### Error Variant

For error states (AlertCircle icon, red tint):

```tsx
<EmptyState
  variant="error"
  title="Failed to load data"
  description="An error occurred while fetching the data."
  action={{
    label: 'Try again',
    onClick: () => refetch(),
  }}
/>
```

### No Permission Variant

For access denied states (Lock icon, amber tint):

```tsx
<EmptyState
  variant="no-permission"
  title="Access denied"
  description="You don't have permission to view this content."
/>
```

## Sizes

### Small (sm)

Compact size for inline use:

```tsx
<EmptyState
  size="sm"
  title="No items"
  description="Nothing here."
/>
```

- Icon: 32px
- Compact text and spacing
- No background

### Medium (md) - Default

Standard size:

```tsx
<EmptyState
  size="md"
  title="No items found"
  description="There are no items to display."
/>
```

- Icon: 48px
- Standard spacing
- No background

### Large (lg)

Prominent size for full-page empty states:

```tsx
<EmptyState
  size="lg"
  title="No items found"
  description="There are no items to display at the moment."
/>
```

- Icon: 64px
- Large text and spacing
- Subtle background (bg-muted/50)

## Convenience Components

Pre-configured components for common scenarios:

### NoResultsState

For search results:

```tsx
import { NoResultsState } from '@/components/shared';

<NoResultsState
  query="electronics"
  onClear={() => setSearchQuery('')}
/>
```

### ErrorState

For error scenarios:

```tsx
import { ErrorState } from '@/components/shared';

<ErrorState
  error="Failed to connect to server"
  onRetry={() => refetch()}
/>
```

### NoPermissionState

For permission denied:

```tsx
import { NoPermissionState } from '@/components/shared';

<NoPermissionState resource="billing information" />
```

### NoBOMsState

For empty BOM list:

```tsx
import { NoBOMsState } from '@/components/shared';

<NoBOMsState onUpload={() => openUploadDialog()} />
```

### NoComponentsState

For empty component search:

```tsx
import { NoComponentsState } from '@/components/shared';

<NoComponentsState onSearch={() => focusSearchInput()} />
```

### NoFilteredResultsState

For filtered results with no matches:

```tsx
import { NoFilteredResultsState } from '@/components/shared';

<NoFilteredResultsState
  onClearFilters={() => resetFilters()}
/>
```

## Advanced Usage

### With Custom Content

Add additional content below the description:

```tsx
<EmptyState
  title="No notifications"
  description="You will be notified when there are updates."
>
  <div className="mt-4 p-4 bg-muted rounded-md text-xs">
    <p>Tips for getting started:</p>
    <ul className="list-disc list-inside mt-2 space-y-1">
      <li>Enable notifications in settings</li>
      <li>Subscribe to updates</li>
      <li>Check back regularly</li>
    </ul>
  </div>
</EmptyState>
```

### Conditional Rendering

```tsx
function BOMList({ boms, loading }) {
  if (loading) {
    return <BomListSkeleton />;
  }

  if (!boms || boms.length === 0) {
    return <NoBOMsState onUpload={() => openUploadDialog()} />;
  }

  return <BOMTable data={boms} />;
}
```

### With Search State

```tsx
function SearchableList({ items, searchQuery, onClearSearch }) {
  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (filteredItems.length === 0) {
    return searchQuery ? (
      <NoResultsState query={searchQuery} onClear={onClearSearch} />
    ) : (
      <EmptyState
        title="No items yet"
        description="Add your first item to get started"
        action={{ label: 'Add item', onClick: onAdd }}
      />
    );
  }

  return <ItemList items={filteredItems} />;
}
```

### With Error Handling

```tsx
function DataView({ data, error, refetch }) {
  if (error) {
    return (
      <ErrorState
        error={error.message}
        onRetry={refetch}
      />
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        title="No data available"
        description="Import or create your first dataset"
        action={{ label: 'Import', onClick: onImport }}
      />
    );
  }

  return <DataTable data={data} />;
}
```

## Accessibility

The component follows accessibility best practices:

- **Semantic HTML**: Uses proper heading hierarchy with `<h3>` for titles
- **ARIA Labels**: `aria-labelledby` links the title to the container
- **Role**: Container has `role="status"` for screen readers
- **Icon Decoration**: Icons are marked `aria-hidden="true"` as they're decorative
- **Focus Management**: Action buttons are keyboard accessible
- **Touch Targets**: Buttons meet minimum size requirements

## Styling

The component uses Tailwind CSS with design tokens:

- **Colors**: Uses semantic color tokens (`foreground`, `muted-foreground`)
- **Spacing**: Responsive spacing scales with size
- **Typography**: Size-appropriate text scales
- **Backgrounds**: Large variant includes subtle background

### Custom Styling

Add custom classes via `className` prop:

```tsx
<EmptyState
  title="Custom styled"
  className="border border-dashed rounded-lg"
/>
```

## TypeScript

Full TypeScript support with exported types:

```tsx
import type {
  EmptyStateProps,
  EmptyStateAction,
  EmptyStateVariant,
  EmptyStateSize,
} from '@/components/shared';

const action: EmptyStateAction = {
  label: 'Create',
  onClick: handleCreate,
  variant: 'default',
};

const variant: EmptyStateVariant = 'search';
const size: EmptyStateSize = 'lg';
```

## Best Practices

1. **Choose the Right Variant**:
   - Use `default` for general empty states
   - Use `search` for no search/filter results
   - Use `error` for error states
   - Use `no-permission` for access denied

2. **Provide Actions**:
   - Always provide a primary action when possible
   - Use clear, action-oriented button labels
   - Consider secondary actions for alternative paths

3. **Write Helpful Descriptions**:
   - Explain why the state is empty
   - Suggest next steps
   - Keep it concise but informative

4. **Size Appropriately**:
   - Use `sm` for inline/sidebar empty states
   - Use `md` for standard list/table empty states
   - Use `lg` for full-page empty states

5. **Consistent Messaging**:
   - Use consistent tone across your app
   - Match your brand voice
   - Be helpful and positive

## Common Patterns

### Empty Table

```tsx
{data.length === 0 ? (
  <EmptyState
    title="No records found"
    description="Your data will appear here once added."
    action={{ label: 'Add record', onClick: onAdd }}
  />
) : (
  <DataTable data={data} />
)}
```

### Empty Search Results

```tsx
{searchResults.length === 0 && (
  <NoResultsState
    query={searchQuery}
    onClear={() => setSearchQuery('')}
  />
)}
```

### Permission-Gated Content

```tsx
{!hasPermission ? (
  <NoPermissionState resource="settings" />
) : (
  <SettingsContent />
)}
```

### Error Boundary Fallback

```tsx
function ErrorFallback({ error, resetError }) {
  return (
    <ErrorState
      error={error.message}
      onRetry={resetError}
    />
  );
}
```

## Related Components

- **LoadingSpinner**: Use while data is loading
- **ListSkeletons**: Use for loading states
- **ErrorBoundary**: Wrap components for error handling
- **PermissionGuard**: Guard routes by permissions

## Testing

Example test patterns:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyState } from '@/components/shared';

it('calls onClick when action is clicked', async () => {
  const handleClick = jest.fn();
  const user = userEvent.setup();

  render(
    <EmptyState
      title="Empty"
      action={{ label: 'Click me', onClick: handleClick }}
    />
  );

  await user.click(screen.getByRole('button', { name: 'Click me' }));
  expect(handleClick).toHaveBeenCalledTimes(1);
});
```

## Migration from Inline Empty States

Before:

```tsx
{items.length === 0 && (
  <div className="text-center p-8">
    <p>No items found</p>
    <button onClick={onAdd}>Add item</button>
  </div>
)}
```

After:

```tsx
{items.length === 0 && (
  <EmptyState
    title="No items found"
    description="Add your first item to get started"
    action={{ label: 'Add item', onClick: onAdd }}
  />
)}
```

Benefits:
- Consistent styling across the app
- Better accessibility
- More features (sizes, variants, multiple actions)
- Type-safe props
