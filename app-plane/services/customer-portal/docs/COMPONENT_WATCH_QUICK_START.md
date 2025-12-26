# Component Watch - Quick Start Guide

## Quick Reference

### Import Hooks

```typescript
import {
  useComponentWatches,
  useIsWatched,
  useAddWatch,
  useRemoveWatch,
  useUpdateWatchTypes,
  getEnabledWatchTypes,
  type WatchType,
} from '../hooks';
```

### Import Components

```typescript
import { WatchButton } from '../components/WatchButton';
import { WatchTypeSelector } from '../components/WatchTypeSelector';
```

## Common Patterns

### Pattern 1: Add Watch Button to List

```tsx
<TableRow>
  <TableCell>{component.mpn}</TableCell>
  <TableCell>{component.manufacturer}</TableCell>
  <TableCell>
    <WatchButton
      componentId={component.id}
      mpn={component.mpn}
      manufacturer={component.manufacturer}
      variant="icon"
      size="small"
    />
  </TableCell>
</TableRow>
```

### Pattern 2: Add Watch Button to Detail Page

```tsx
<Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
  <Typography variant="h4">{component.mpn}</Typography>
  <WatchButton
    componentId={component.id}
    mpn={component.mpn}
    manufacturer={component.manufacturer}
    variant="button"
    size="medium"
  />
</Box>
```

### Pattern 3: Show Watch Status

```tsx
const { isWatched, loading } = useIsWatched(componentId);

{isWatched && (
  <Chip
    label="Watching"
    color="primary"
    icon={<NotificationsIcon />}
  />
)}
```

### Pattern 4: Custom Watch Logic

```tsx
const { addWatch, adding } = useAddWatch({
  onSuccess: (watch) => {
    console.log('Watch added:', watch);
    // Custom logic here
  },
  onError: (error) => {
    console.error('Failed to add watch:', error);
  },
});

const handleWatch = async () => {
  await addWatch(componentId, ['lifecycle', 'price']);
};
```

### Pattern 5: List All Watched Components

```tsx
const { watches, loading, error } = useComponentWatches();

{watches.map(watch => (
  <div key={watch.id}>
    <p>{watch.mpn} - {watch.manufacturer}</p>
    <p>Types: {getEnabledWatchTypes(watch).join(', ')}</p>
  </div>
))}
```

### Pattern 6: Filter Watches by Component

```tsx
const { watches } = useComponentWatches({
  componentId: 'specific-component-id'
});

// watches will only contain watches for that component
```

## Watch Types Reference

```typescript
type WatchType =
  | 'lifecycle'      // EOL, NRND changes
  | 'risk'           // Risk score threshold
  | 'price'          // Price changes
  | 'availability'   // Stock levels
  | 'compliance'     // RoHS, REACH updates
  | 'pcn'            // Product Change Notices
  | 'supply_chain';  // Supply chain alerts
```

## Hook API Reference

### useIsWatched(componentId)

Check if a component is being watched.

```typescript
const { isWatched, watch, loading, error } = useIsWatched(componentId);
```

**Returns:**
- `isWatched: boolean` - True if component is watched
- `watch: ComponentWatch | null` - Watch object if exists
- `loading: boolean` - Loading state
- `error: string | null` - Error message if failed

### useComponentWatches(options?)

Get all watches for the current user.

```typescript
const {
  watches,
  loading,
  error,
  refetch,
  removeWatch,
  removeWatchByComponentId,
} = useComponentWatches({
  autoFetch: true,           // Auto-fetch on mount (default: true)
  componentId: 'optional-id' // Filter by component ID
});
```

**Returns:**
- `watches: ComponentWatch[]` - Array of watches
- `loading: boolean` - Loading state
- `error: string | null` - Error message
- `refetch: () => Promise<void>` - Refetch watches
- `removeWatch: (watchId) => Promise<void>` - Remove by watch ID
- `removeWatchByComponentId: (componentId) => Promise<void>` - Remove by component

### useAddWatch(options?)

Add a new component watch.

```typescript
const { addWatch, adding, error } = useAddWatch({
  onSuccess: (watch) => console.log('Added:', watch),
  onError: (error) => console.error('Failed:', error),
});

// Usage
await addWatch(componentId, ['lifecycle', 'price']);
```

**Returns:**
- `addWatch: (componentId, watchTypes) => Promise<ComponentWatch>`
- `adding: boolean` - Loading state
- `error: string | null` - Error message

### useRemoveWatch(options?)

Remove a component watch.

```typescript
const { removeWatch, removing, error } = useRemoveWatch({
  onSuccess: () => console.log('Removed'),
  onError: (error) => console.error('Failed:', error),
});

// Usage
await removeWatch(watchId);
```

**Returns:**
- `removeWatch: (watchId) => Promise<void>`
- `removing: boolean` - Loading state
- `error: string | null` - Error message

### useUpdateWatchTypes(options?)

Update watch types (removes old watch and creates new one).

```typescript
const { updateWatchTypes, updating, error } = useUpdateWatchTypes({
  onSuccess: (watch) => console.log('Updated:', watch),
  onError: (error) => console.error('Failed:', error),
});

// Usage
await updateWatchTypes(watchId, componentId, ['lifecycle', 'risk']);
```

**Returns:**
- `updateWatchTypes: (watchId, componentId, watchTypes) => Promise<ComponentWatch>`
- `updating: boolean` - Loading state
- `error: string | null` - Error message

### getEnabledWatchTypes(watch)

Utility to extract enabled watch types from a ComponentWatch object.

```typescript
const watch = { /* ... */ };
const types = getEnabledWatchTypes(watch);
// Returns: ['lifecycle', 'price', 'risk']
```

## Component Props Reference

### WatchButton

```typescript
interface WatchButtonProps {
  componentId: string;              // Required
  mpn?: string;                     // For display
  manufacturer?: string;            // For display
  variant?: 'button' | 'icon';      // Default: 'button'
  size?: 'small' | 'medium' | 'large'; // Default: 'medium'
  showLabel?: boolean;              // Default: true
  watchedLabel?: string;            // Default: 'Watching'
  unwatchedLabel?: string;          // Default: 'Watch'
  onWatchChange?: (isWatched: boolean) => void;
}
```

### WatchTypeSelector

```typescript
interface WatchTypeSelectorProps {
  componentId: string;              // Required
  mpn?: string;                     // For display
  manufacturer?: string;            // For display
  initialWatchTypes?: WatchType[];  // For editing
  onSave: (watchTypes: WatchType[]) => Promise<void> | void;
  onRemove?: () => Promise<void> | void; // Optional (for editing)
  onCancel: () => void;
}
```

## Data Types

### ComponentWatch

```typescript
interface ComponentWatch {
  id: string;
  user_id: string;
  organization_id: string;
  component_id: string;
  watch_lifecycle: boolean;
  watch_risk: boolean;
  watch_price: boolean;
  watch_availability: boolean;
  watch_compliance: boolean;
  watch_supply_chain: boolean;
  notes: string | null;
  created_at: string;
  mpn?: string;              // Joined from component
  manufacturer?: string;     // Joined from component
}
```

### ComponentWatchCreate

```typescript
interface ComponentWatchCreate {
  component_id: string;
  watch_lifecycle?: boolean;
  watch_risk?: boolean;
  watch_price?: boolean;
  watch_availability?: boolean;
  watch_compliance?: boolean;
  watch_supply_chain?: boolean;
  notes?: string;
}
```

## Navigation

- `/alerts/watched` - Watched Components page
- `/alerts/preferences` - Alert Preferences (includes watch list)
- `/components/search` - Component Search (with watch buttons)

## Tips

1. **Use icon variant in tables** to save space
2. **Use button variant in headers** for better visibility
3. **Always provide mpn and manufacturer** for better UX
4. **Use callbacks** for custom success/error handling
5. **Filter by componentId** to check specific component watches
6. **Use optimistic updates** - hooks handle this automatically
7. **Handle errors gracefully** - hooks return error state

## Examples in Codebase

- `src/pages/ComponentSearch.tsx` - Watch button in search results
- `src/components/ComponentDetailDialog.tsx` - Watch button in header
- `src/pages/AlertPreferences.tsx` - Watch list section
- `src/pages/WatchedComponents.tsx` - Full watch management

## Testing

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useIsWatched } from '../hooks';

test('useIsWatched returns correct state', async () => {
  const { result } = renderHook(() => useIsWatched('component-123'));

  await waitFor(() => {
    expect(result.current.loading).toBe(false);
  });

  expect(result.current.isWatched).toBe(true);
  expect(result.current.watch).toBeTruthy();
});
```

## Troubleshooting

**Watch button not appearing:**
- Check componentId is provided and valid
- Verify WatchButton import path
- Check console for errors

**Watches not loading:**
- Verify user is authenticated
- Check organization context is set
- Verify CNS API is accessible
- Check network tab for API errors

**Update not working:**
- Check watchId is correct
- Verify componentId matches
- Check watch types array is not empty
- Review console for API errors

## Support

For issues or questions:
1. Check implementation docs: `COMPONENT_WATCH_IMPLEMENTATION.md`
2. Review examples in codebase
3. Check CNS API logs for backend errors
4. Contact platform team
