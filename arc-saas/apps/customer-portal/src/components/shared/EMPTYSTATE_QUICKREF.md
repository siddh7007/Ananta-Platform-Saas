# EmptyState Quick Reference

## Import

```tsx
import {
  EmptyState,
  NoResultsState,
  ErrorState,
  NoPermissionState,
  NoBOMsState,
  NoComponentsState,
  NoFilteredResultsState,
} from '@/components/shared';
```

## Basic Usage

```tsx
<EmptyState
  title="No items"
  description="Nothing to show here"
  action={{ label: 'Add item', onClick: handleClick }}
/>
```

## Variants (4)

| Variant | Icon | Color | Use Case |
|---------|------|-------|----------|
| `default` | Package | Muted | General empty states |
| `search` | Search | Muted | No search results |
| `error` | AlertCircle | Red | Errors, failures |
| `no-permission` | Lock | Amber | Access denied |

```tsx
<EmptyState variant="error" title="Failed" />
```

## Sizes (3)

| Size | Icon | Use Case |
|------|------|----------|
| `sm` | 32px | Sidebars, inline |
| `md` | 48px | Lists, tables (default) |
| `lg` | 64px | Full page, onboarding |

```tsx
<EmptyState size="lg" title="Welcome" />
```

## Actions

### Single Action

```tsx
<EmptyState
  title="No data"
  action={{ label: 'Import', onClick: handleImport }}
/>
```

### Multiple Actions

```tsx
<EmptyState
  title="No files"
  action={{ label: 'Upload', onClick: handleUpload }}
  secondaryAction={{ label: 'Browse', onClick: handleBrowse, variant: 'outline' }}
/>
```

### Link Action

```tsx
<EmptyState
  title="Settings required"
  action={{ label: 'Go to settings', href: '/settings' }}
/>
```

## Convenience Components

### NoResultsState

```tsx
<NoResultsState
  query="resistor"
  onClear={() => setQuery('')}
/>
```

### ErrorState

```tsx
<ErrorState
  error="Connection failed"
  onRetry={() => refetch()}
/>
```

### NoPermissionState

```tsx
<NoPermissionState resource="billing data" />
```

### NoBOMsState

```tsx
<NoBOMsState onUpload={() => openDialog()} />
```

### NoComponentsState

```tsx
<NoComponentsState onSearch={() => focusSearch()} />
```

### NoFilteredResultsState

```tsx
<NoFilteredResultsState onClearFilters={() => reset()} />
```

## Custom Content

```tsx
<EmptyState title="No notifications">
  <div className="mt-4 p-4 bg-muted rounded">
    <p>Tips for getting started...</p>
  </div>
</EmptyState>
```

## Custom Icon

```tsx
import { Inbox } from 'lucide-react';

<EmptyState
  icon={Inbox}
  title="Empty inbox"
  description="All caught up!"
/>
```

## Common Patterns

### Empty List

```tsx
{items.length === 0 ? (
  <EmptyState
    title="No items"
    action={{ label: 'Add', onClick: onAdd }}
  />
) : (
  <ItemList items={items} />
)}
```

### Search Results

```tsx
{results.length === 0 && query && (
  <NoResultsState query={query} onClear={clearQuery} />
)}
```

### Error Handling

```tsx
{error ? (
  <ErrorState error={error.message} onRetry={refetch} />
) : (
  <Content data={data} />
)}
```

### Permission Check

```tsx
{!hasAccess ? (
  <NoPermissionState resource="billing" />
) : (
  <BillingContent />
)}
```

## TypeScript

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
```

## Props Reference

```tsx
interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  variant?: 'default' | 'search' | 'error' | 'no-permission';
  size?: 'sm' | 'md' | 'lg';
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  children?: ReactNode;
  className?: string;
}

interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
}
```

## When to Use

| Scenario | Component | Example |
|----------|-----------|---------|
| Empty table/list | `EmptyState` | No BOMs uploaded |
| No search results | `NoResultsState` | Component search |
| Failed to load | `ErrorState` | API error |
| No permission | `NoPermissionState` | Billing page |
| No filter matches | `NoFilteredResultsState` | Active filters |

## Documentation

- **Detailed Guide**: `EMPTYSTATE_USAGE.md`
- **Component Docs**: `EMPTYSTATE_README.md`
- **Examples**: `EmptyState.example.tsx`
- **Storybook**: Run `npm run storybook`
- **Tests**: `EmptyState.test.tsx`

## Accessibility

- Uses semantic HTML (`<h3>` for titles)
- `role="status"` for screen readers
- `aria-labelledby` connects title to container
- Icons marked `aria-hidden="true"`
- Keyboard accessible actions
- Touch-friendly button sizes

## Quick Tips

1. **Always provide a title** - Required prop
2. **Add descriptions** - Explain why empty and what to do
3. **Offer actions** - Help users take next steps
4. **Choose right size** - Match to container (sm/md/lg)
5. **Use variants** - Convey meaning (error/search/permission)
6. **Be helpful** - Suggest solutions, not just states
