# Caching Strategy - Quick Reference

**Quick guide for using the client-side caching system (CBP-P3-006)**

## Import Hooks

```typescript
import {
  useBomList,
  useBomDetail,
  useCreateBom,
  useUpdateBom,
  useDeleteBom,
  useComponentSearch,
  useComponentDetail,
  useCurrentUser,
  useUpdateUserProfile,
} from '@/hooks';
```

## Common Patterns

### Fetch a List

```typescript
const { data, isLoading, error } = useBomList({
  status: ['enriching', 'enriched'],
  search: 'capacitor',
  sortBy: 'createdAt',
  sortOrder: 'desc',
});

// data = { data: Bom[], total: number, page: number, pageSize: number }
```

### Fetch Detail

```typescript
const { data: bom, isLoading } = useBomDetail(bomId);

// bom = BomDetail with lineItems
```

### Create Resource

```typescript
const { mutate: createBom, isPending } = useCreateBom();

createBom({
  name: 'My BOM',
  description: 'Description',
  projectId: 'proj-123',
});
```

### Update Resource (Optimistic)

```typescript
const { mutate: updateBom, isPending } = useUpdateBom(bomId);

// UI updates instantly, rollback on error
updateBom({ name: 'New Name' });
```

### Delete Resource

```typescript
const { mutate: deleteBom } = useDeleteBom();

deleteBom(bomId);
```

### Search Components

```typescript
const { data, totalCount, facets, isLoading } = useComponentSearch(
  'STM32',
  {
    categories: ['Integrated Circuits'],
    manufacturers: ['STMicroelectronics'],
    inStockOnly: true,
    excludeObsolete: true,
  }
);

// data = ComponentSearchResult[]
// facets = { categories, manufacturers, packages }
```

### Prefetch on Hover

```typescript
import { usePrefetchBomDetail } from '@/hooks';

const prefetch = usePrefetchBomDetail();

<Link
  to={`/boms/${bom.id}`}
  onMouseEnter={() => prefetch(bom.id)}
>
  View BOM
</Link>
```

### Manual Cache Invalidation

```typescript
import { useInvalidateBoms } from '@/hooks';

const invalidateBoms = useInvalidateBoms();

const handleRefresh = () => {
  invalidateBoms();
};
```

## Stale Times

| Resource | Stale Time |
|----------|-----------|
| BOM List | 2 minutes |
| BOM Detail | 5 minutes |
| Component Search | 10 minutes |
| Component Detail | 15 minutes |
| User Profile | 5 minutes |

## Query Keys

```typescript
import { queryKeys } from '@/lib/query-keys';

// BOM keys
queryKeys.boms.all              // ['boms']
queryKeys.boms.list(filters)    // ['boms', 'lists', filters]
queryKeys.boms.detail(id)       // ['boms', 'details', id]

// Component keys
queryKeys.components.search(q, filters)  // ['components', 'search', q, filters]
queryKeys.components.detail(id)          // ['components', 'details', id]

// User keys
queryKeys.user.current()        // ['user', 'current']
queryKeys.user.profile()        // ['user', 'profile']
```

## Manual Cache Operations

```typescript
import {
  queryClient,
  invalidateResource,
  invalidateMultipleResources,
  clearAllCache,
  getQueryData,
  setQueryData,
} from '@/lib/query-client';

// Invalidate single resource
invalidateResource('boms');

// Invalidate multiple resources
invalidateMultipleResources(['boms', 'components']);

// Clear all cache (on logout)
clearAllCache();

// Read from cache
const bom = getQueryData<BomDetail>(queryKeys.boms.detail(id));

// Write to cache
setQueryData(queryKeys.boms.detail(id), updatedBom);
```

## Error Handling

```typescript
const { data, error, isLoading } = useBomList();

if (isLoading) {
  return <LoadingSpinner />;
}

if (error) {
  return <ErrorMessage error={error} />;
}

return <BomTable boms={data.data} />;
```

## Loading States

```typescript
const { data, isLoading, isFetching, isPending } = useBomList();

// isLoading: true on initial load
// isFetching: true on background refetch
// isPending: true for mutations

{isLoading && <Spinner />}
{isFetching && <RefreshingIndicator />}
{isPending && <SavingIndicator />}
```

## Mutation Callbacks

```typescript
const { mutate: createBom } = useCreateBom();

createBom(
  { name: 'New BOM' },
  {
    onSuccess: (data) => {
      toast.success('BOM created!');
      navigate(`/boms/${data.id}`);
    },
    onError: (error) => {
      toast.error('Failed to create BOM');
      console.error(error);
    },
  }
);
```

## Placeholder Data

Keeps old data visible while refetching:

```typescript
useBomList(filters, {
  placeholderData: (previousData) => previousData,
});

// User sees old BOM list while new data loads
// No flickering or empty states during refresh
```

## Disable Auto Refetch

```typescript
useBomDetail(id, {
  refetchOnWindowFocus: false,
  refetchOnMount: false,
  refetchOnReconnect: false,
});
```

## Custom Stale Time

```typescript
useBomList(filters, {
  staleTime: 30 * 1000, // 30 seconds instead of default 2 minutes
});
```

## Dependent Queries

```typescript
const { data: user } = useCurrentUser();
const { data: boms } = useBomList(
  { organizationId: user?.organizationId },
  { enabled: !!user } // Only run when user is loaded
);
```

## Polling / Interval Refetch

```typescript
useBomDetail(id, {
  refetchInterval: 10000, // Refetch every 10 seconds
  refetchIntervalInBackground: true, // Continue when tab is not focused
});
```

## React Query Devtools

Add to development environment:

```typescript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <YourApp />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

## TypeScript Types

All hooks are fully typed:

```typescript
// Auto-complete and type checking
const { data } = useBomList();
//     ^? BomListResponse

const { data: bom } = useBomDetail(id);
//           ^? BomDetail | undefined

const { data: components } = useComponentSearch(query, filters);
//           ^? ComponentSearchResult[]
```

## Common Pitfalls

### 1. Don't hard-code query keys

```typescript
// BAD
queryClient.invalidateQueries({ queryKey: ['boms'] });

// GOOD
queryClient.invalidateQueries({ queryKey: queryKeys.boms.all });
```

### 2. Remember to handle loading and error states

```typescript
// BAD
const { data } = useBomList();
return <BomTable boms={data.data} />; // Crashes if data is undefined

// GOOD
const { data, isLoading, error } = useBomList();
if (isLoading) return <LoadingSpinner />;
if (error) return <ErrorMessage />;
return <BomTable boms={data.data} />;
```

### 3. Use enabled option for conditional queries

```typescript
// BAD
const { data } = useBomDetail(maybeId);

// GOOD
const { data } = useBomDetail(maybeId, { enabled: !!maybeId });
```

## Performance Tips

1. Use prefetching for instant page loads
2. Leverage placeholder data for smooth refetches
3. Set appropriate stale times based on data volatility
4. Use optimistic updates for instant UI feedback
5. Invalidate only what changed (not everything)

## Getting Help

- Full docs: `CACHING_STRATEGY.md`
- Implementation summary: `CBP-P3-006-IMPLEMENTATION-SUMMARY.md`
- Source code: `src/lib/query-client.ts`, `src/lib/query-keys.ts`, `src/hooks/useQueryHooks.ts`

---

**Last Updated**: 2025-12-15
