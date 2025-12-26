# Custom Hooks Implementation Guide

## Executive Summary

The dashboard service provides 5 custom React hooks for data fetching and state management. These hooks abstract API communication, error handling, loading states, and automatic refresh capabilities, enabling rapid development of dashboard features without writing repetitive fetch logic.

**Total Hooks: 5**
1. `useTenants` - Fetch list of all tenants with filtering and sorting
2. `useCurrentTenant` - Fetch details of the currently active tenant
3. `useSubscriptions` - Fetch subscriptions list with tenant filtering
4. `useResource` - Generic hook to fetch any resource list with full control
5. `useResourceById` - Generic hook to fetch a single resource by ID

All hooks are located in:
```
src/admin/hooks/
  ├── useTenants.ts
  ├── useCurrentTenant.ts
  ├── useSubscriptions.ts
  ├── useResource.ts (exports both useResource and useResourceById)
  └── index.ts
```

---

## Hook: useTenants

Fetches a list of all tenants with support for filtering, sorting, and automatic refresh.

### Type Definitions

```typescript
interface Tenant {
  id: string;
  name: string;
  key: string;
  status: number;
  domains?: string[];
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

interface UsTenantsOptions {
  filter?: Record<string, unknown>;
  sort?: { field: string; order: 'asc' | 'desc' };
  enabled?: boolean;
  refreshInterval?: number;
}

interface UsTenantsResult {
  tenants: Tenant[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}
```

### API Endpoint

```
GET /tenants/my-tenants
```

### Parameters

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `filter` | `Record<string, unknown>` | `{}` | Filter criteria to apply to the query |
| `sort.field` | `string` | `'name'` | Field to sort by |
| `sort.order` | `'asc' \| 'desc'` | `'asc'` | Sort direction |
| `enabled` | `boolean` | `true` | Enable/disable automatic fetching on mount |
| `refreshInterval` | `number` | `0` | Auto-refresh interval in milliseconds (0 = disabled) |

### Usage Examples

**Basic usage - fetch all tenants:**
```typescript
import { useTenants } from '@/admin/hooks';

function TenantsList() {
  const { tenants, loading, error } = useTenants();

  if (loading) return <div>Loading tenants...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <ul>
      {tenants.map(tenant => (
        <li key={tenant.id}>{tenant.name}</li>
      ))}
    </ul>
  );
}
```

**With filtering and sorting:**
```typescript
const { tenants, loading, error } = useTenants({
  filter: { status: 1 },
  sort: { field: 'createdAt', order: 'desc' },
});
```

**With automatic refresh (every 30 seconds):**
```typescript
const { tenants, loading, error, refetch } = useTenants({
  refreshInterval: 30000, // 30 seconds
});
```

**Conditionally fetch based on a flag:**
```typescript
const { tenants, loading, error } = useTenants({
  enabled: isReady, // Only fetch when isReady is true
});
```

**Manual refresh:**
```typescript
const { tenants, loading, error, refetch } = useTenants();

const handleRefresh = async () => {
  await refetch();
  console.log('Tenants refreshed');
};

return <button onClick={handleRefresh}>Refresh</button>;
```

---

## Hook: useCurrentTenant

Fetches the full details of the currently active tenant using the tenant ID from `TenantContext`.

### Type Definitions

```typescript
interface UseCurrentTenantResult {
  tenant: Tenant | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}
```

### API Endpoints

Tries endpoints in order:
1. `GET /tenants/current` (preferred)
2. `GET /tenants/{tenantId}` (fallback)

### Dependencies

- Requires active tenant ID from `TenantContext`
- Uses `useTenant()` hook to get the current tenant context

### Usage Examples

**Basic usage:**
```typescript
import { useCurrentTenant } from '@/admin/hooks';

function TenantDetails() {
  const { tenant, loading, error } = useCurrentTenant();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!tenant) return <div>No tenant selected</div>;

  return (
    <div>
      <h1>{tenant.name}</h1>
      <p>Key: {tenant.key}</p>
      <p>Status: {tenant.status}</p>
    </div>
  );
}
```

**With manual refresh:**
```typescript
const { tenant, loading, error, refetch } = useCurrentTenant();

const handleRefresh = async () => {
  await refetch();
};

return (
  <div>
    {tenant && <h1>{tenant.name}</h1>}
    <button onClick={handleRefresh}>Refresh Details</button>
  </div>
);
```

**Conditional rendering based on tenant presence:**
```typescript
const { tenant, loading } = useCurrentTenant();

if (loading) return null;

if (!tenant) {
  return (
    <div className="alert">
      Please select a tenant from the context
    </div>
  );
}

// Render tenant-specific content
return <div>{tenant.name}</div>;
```

### Behavior Notes

- **No Tenant Selected**: When `tenantId` is null/undefined, the hook resets state and returns `null` for tenant
- **Endpoint Fallback**: Automatically tries the current endpoint first; if it fails, falls back to direct ID lookup
- **Auto-fetch on Change**: Refetches whenever the active tenant context changes

---

## Hook: useSubscriptions

Fetches a list of subscriptions with support for tenant filtering, sorting, and pagination.

### Type Definitions

```typescript
type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'cancelled'
  | 'paused'
  | 'expired'
  | 'pending'
  | 'inactive';

interface Subscription {
  id: string;
  tenantId: string;
  planId: string;
  status: SubscriptionStatus;
  startDate?: string;
  endDate?: string;
  trialEndDate?: string;
  cancelledAt?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

interface UseSubscriptionsOptions {
  tenantId?: string;
  filter?: Record<string, unknown>;
  sort?: { field: string; order: 'asc' | 'desc' };
  enabled?: boolean;
  refreshInterval?: number;
}

interface UseSubscriptionsResult {
  subscriptions: Subscription[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}
```

### API Endpoint

```
GET /subscriptions
```

### Parameters

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `tenantId` | `string` | (none) | Filter subscriptions by tenant ID |
| `filter` | `Record<string, unknown>` | `{}` | Additional filter criteria |
| `sort.field` | `string` | `'createdAt'` | Field to sort by |
| `sort.order` | `'asc' \| 'desc'` | `'desc'` | Sort direction |
| `enabled` | `boolean` | `true` | Enable/disable automatic fetching |
| `refreshInterval` | `number` | `0` | Auto-refresh interval in milliseconds |

### Usage Examples

**Basic usage - fetch all subscriptions:**
```typescript
import { useSubscriptions } from '@/admin/hooks';

function SubscriptionsList() {
  const { subscriptions, loading, error } = useSubscriptions();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <table>
      <tbody>
        {subscriptions.map(sub => (
          <tr key={sub.id}>
            <td>{sub.planId}</td>
            <td>{sub.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

**Filter by status and sort by date:**
```typescript
const { subscriptions, loading, error } = useSubscriptions({
  filter: { status: 'active' },
  sort: { field: 'startDate', order: 'desc' },
});
```

**Filter by specific tenant:**
```typescript
const { subscriptions } = useSubscriptions({
  tenantId: 'tenant-123',
  filter: { status: 'active' },
});
```

**With automatic refresh:**
```typescript
const { subscriptions, loading, error } = useSubscriptions({
  refreshInterval: 60000, // Refresh every 60 seconds
  filter: { status: 'active' },
});
```

**Display active subscriptions:**
```typescript
const { subscriptions, loading } = useSubscriptions({
  filter: { status: 'active' },
});

return (
  <div>
    <h2>Active Subscriptions ({subscriptions.length})</h2>
    {subscriptions.map(sub => (
      <SubscriptionCard key={sub.id} subscription={sub} />
    ))}
  </div>
);
```

### Subscription Status Values

| Status | Description |
|--------|-------------|
| `active` | Subscription is currently active and billing |
| `trialing` | Subscription is in trial period |
| `past_due` | Payment is past due |
| `cancelled` | Subscription has been cancelled |
| `paused` | Subscription is temporarily paused |
| `expired` | Subscription has expired |
| `pending` | Subscription is pending activation |
| `inactive` | Subscription is inactive |

---

## Hook: useResource

Generic hook to fetch any resource list from any API endpoint with full control over filtering, sorting, pagination, and data transformation.

### Type Definitions

```typescript
interface UseResourceOptions<T = unknown> {
  resource: string;
  filter?: Record<string, unknown>;
  sort?: { field: string; order: 'asc' | 'desc' };
  pagination?: { page: number; perPage: number };
  enabled?: boolean;
  refreshInterval?: number;
  transform?: (item: unknown) => T;
}

interface UseResourceResult<T = unknown> {
  data: T[];
  total: number | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}
```

### Parameters

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `resource` | `string` | **Required** | API endpoint path (e.g., '/boms', '/users') |
| `filter` | `Record<string, unknown>` | `{}` | Filter criteria |
| `sort.field` | `string` | `'createdAt'` | Field to sort by |
| `sort.order` | `'asc' \| 'desc'` | `'desc'` | Sort direction |
| `pagination` | `{ page, perPage }` | (none) | Pagination (page starts at 1) |
| `enabled` | `boolean` | `true` | Enable/disable automatic fetching |
| `refreshInterval` | `number` | `0` | Auto-refresh interval in milliseconds |
| `transform` | `(item) => T` | (none) | Optional transformation function for items |

### Usage Examples

**Fetch BOMs:**
```typescript
import { useResource } from '@/admin/hooks';

function BOMsList() {
  const { data: boms, loading, error } = useResource({
    resource: '/boms',
  });

  if (loading) return <div>Loading BOMs...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <ul>
      {boms.map(bom => (
        <li key={bom.id}>{bom.name}</li>
      ))}
    </ul>
  );
}
```

**Fetch with filtering and sorting:**
```typescript
const { data: activeBoms, loading } = useResource({
  resource: '/boms',
  filter: { status: 'active' },
  sort: { field: 'createdAt', order: 'desc' },
});
```

**Fetch with pagination:**
```typescript
const { data: boms, total, loading } = useResource({
  resource: '/boms',
  pagination: { page: 1, perPage: 25 },
});

return (
  <div>
    <ul>
      {boms.map(bom => <li key={bom.id}>{bom.name}</li>)}
    </ul>
    <p>Total: {total}</p>
  </div>
);
```

**Fetch users with type transformation:**
```typescript
interface User {
  id: string;
  fullName: string;
}

const { data: users } = useResource<User>({
  resource: '/users',
  transform: (item: any) => ({
    id: item.id,
    fullName: `${item.firstName} ${item.lastName}`,
  }),
});
```

**Fetch invoices with tenant filter:**
```typescript
const { data: invoices, total } = useResource({
  resource: '/invoices',
  filter: { tenantId: 'tenant-123' },
  sort: { field: 'issueDate', order: 'desc' },
  pagination: { page: 1, perPage: 20 },
});
```

**Conditional fetching:**
```typescript
const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

const { data: tenantData, loading } = useResource({
  resource: '/tenants',
  enabled: !!selectedTenantId,
  filter: { id: selectedTenantId },
});
```

**Manual refresh with refetch:**
```typescript
const { data, loading, error, refetch } = useResource({
  resource: '/boms',
});

const handleRefresh = async () => {
  console.log('Refreshing data...');
  await refetch();
};

return <button onClick={handleRefresh}>Refresh</button>;
```

### Generic Type Support

The hook is fully generic and supports TypeScript type inference:

```typescript
interface Invoice {
  id: string;
  amount: number;
  status: string;
}

// TypeScript infers data as Invoice[]
const { data: invoices } = useResource<Invoice>({
  resource: '/invoices',
});

// Usage - TypeScript knows about Invoice properties
invoices.forEach(invoice => {
  console.log(invoice.amount); // OK
  console.log(invoice.unknown); // Error - property doesn't exist
});
```

### Response Format Handling

The hook automatically handles multiple response formats:

```typescript
// Array response
// GET /items -> [{ id: 1 }, { id: 2 }]
const { data } = useResource({ resource: '/items' });

// Wrapped response
// GET /items -> { data: [{ id: 1 }], total: 100 }
const { data, total } = useResource({ resource: '/items' });
```

---

## Hook: useResourceById

Generic hook to fetch a single resource by ID from any API endpoint.

### Type Definitions

```typescript
interface UseResourceByIdOptions<T = unknown> {
  resource: string;
  id: string | null;
  enabled?: boolean;
  transform?: (item: unknown) => T;
}

interface UseResourceByIdResult<T = unknown> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}
```

### Parameters

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `resource` | `string` | **Required** | API endpoint path (e.g., '/boms', '/users') |
| `id` | `string \| null` | **Required** | Resource ID to fetch (null disables fetch) |
| `enabled` | `boolean` | `true` | Enable/disable automatic fetching |
| `transform` | `(item) => T` | (none) | Optional transformation function |

### API Endpoint

```
GET /{resource}/{id}
```

### Usage Examples

**Basic usage - fetch single BOM:**
```typescript
import { useResourceById } from '@/admin/hooks';

function BOMDetail({ bomId }: { bomId: string }) {
  const { data: bom, loading, error } = useResourceById({
    resource: '/boms',
    id: bomId,
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!bom) return <div>BOM not found</div>;

  return <div>{bom.name}</div>;
}
```

**With conditional fetching (null ID):**
```typescript
function UserDetail({ userId }: { userId: string | null }) {
  const { data: user, loading } = useResourceById({
    resource: '/users',
    id: userId,
    // Automatically disables fetch if userId is null
  });

  if (!userId) return <div>No user selected</div>;
  if (loading) return <div>Loading user...</div>;

  return <div>{user?.name}</div>;
}
```

**With type transformation:**
```typescript
interface FormattedInvoice {
  id: string;
  displayAmount: string;
  displayStatus: string;
}

const { data: invoice } = useResourceById<FormattedInvoice>({
  resource: '/invoices',
  id: 'invoice-123',
  transform: (item: any) => ({
    id: item.id,
    displayAmount: `$${item.amount.toFixed(2)}`,
    displayStatus: item.status.toUpperCase(),
  }),
});
```

**Using from URL parameter:**
```typescript
import { useParams } from 'react-router-dom';

function TenantPage() {
  const { tenantId } = useParams<{ tenantId: string }>();

  const { data: tenant, loading, error, refetch } = useResourceById({
    resource: '/tenants',
    id: tenantId || null,
  });

  if (!tenantId) return <div>Invalid tenant ID</div>;
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h1>{tenant?.name}</h1>
      <button onClick={() => refetch()}>Refresh</button>
    </div>
  );
}
```

**Manual refresh:**
```typescript
const { data: bom, loading, error, refetch } = useResourceById({
  resource: '/boms',
  id: 'bom-123',
});

const handleRefresh = async () => {
  await refetch();
};

return (
  <div>
    {bom && <h1>{bom.name}</h1>}
    <button onClick={handleRefresh}>Refresh Details</button>
  </div>
);
```

### Behavior Notes

- **Null ID**: When `id` is null, fetching is skipped and `data` returns `null`
- **ID Change**: Automatically refetches when the `id` parameter changes
- **No Pagination**: This hook is designed for single resource fetching only

---

## Common Patterns

### Pattern 1: List with Pagination

```typescript
const [page, setPage] = useState(1);

const { data: items, total, loading } = useResource({
  resource: '/items',
  pagination: { page, perPage: 20 },
  sort: { field: 'createdAt', order: 'desc' },
});

return (
  <div>
    <ItemList items={items} loading={loading} />
    <Pagination
      current={page}
      total={total}
      onChange={setPage}
    />
  </div>
);
```

### Pattern 2: Master-Detail View

```typescript
function MasterDetail() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Master list
  const { data: items, loading: listLoading } = useResource({
    resource: '/items',
  });

  // Detail view
  const { data: detail, loading: detailLoading } = useResourceById({
    resource: '/items',
    id: selectedId,
  });

  return (
    <div className="master-detail">
      <div className="master">
        {items.map(item => (
          <div
            key={item.id}
            onClick={() => setSelectedId(item.id)}
            className={selectedId === item.id ? 'selected' : ''}
          >
            {item.name}
          </div>
        ))}
      </div>
      <div className="detail">
        {detailLoading && <div>Loading...</div>}
        {detail && <ItemDetail item={detail} />}
      </div>
    </div>
  );
}
```

### Pattern 3: Filtered Search

```typescript
function SearchableList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [status, setStatus] = useState('active');

  const { data: items, loading, refetch } = useResource({
    resource: '/items',
    filter: {
      ...(searchTerm && { name: searchTerm }),
      status,
    },
  });

  return (
    <div>
      <input
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        placeholder="Search..."
      />
      <select value={status} onChange={e => setStatus(e.target.value)}>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
      <button onClick={() => refetch()}>Search</button>
      <ItemList items={items} loading={loading} />
    </div>
  );
}
```

### Pattern 4: Auto-Refresh with Interval

```typescript
function LiveStatus() {
  const { data: status, loading } = useResource({
    resource: '/status',
    refreshInterval: 5000, // Refresh every 5 seconds
  });

  return (
    <div>
      <h2>System Status {loading && '(updating...)'}</h2>
      {status && (
        <div>
          <p>CPU: {status.cpu}%</p>
          <p>Memory: {status.memory}%</p>
          <p>Updated: {new Date().toLocaleTimeString()}</p>
        </div>
      )}
    </div>
  );
}
```

### Pattern 5: Loading & Error States

```typescript
function RobustList() {
  const { data, loading, error, refetch } = useResource({
    resource: '/items',
  });

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <ErrorAlert
        message={error}
        onRetry={() => refetch()}
      />
    );
  }

  if (!data || data.length === 0) {
    return <EmptyState />;
  }

  return <ItemList items={data} />;
}
```

---

## Integration with apiClient

All hooks use the centralized `apiClient` from `@/admin/lib/apiClient` which provides:

### Features

1. **Automatic URL Prefixing**: `buildResourcePath()` automatically prepends the API base URL
2. **Error Mapping**: Converts AxiosError to `EnhancedError` with friendly messages
3. **Authentication**: Automatically includes auth headers from local storage
4. **Request Logging**: Logs all API calls for debugging
5. **Response Normalization**: Handles different response formats consistently

### Example apiClient Usage in Hooks

```typescript
// Inside hook
const response = await apiClient.get(
  buildResourcePath('/tenants'),
  {
    params: { filter: 'value' }
  }
);

// apiClient automatically:
// - Prepends API base URL from env
// - Adds Authorization header
// - Logs request details
// - Maps errors to EnhancedError
```

### Configuration

The `apiClient` reads from environment variables:

```bash
VITE_API_URL=http://localhost:14000
```

---

## Error Handling

All hooks follow consistent error handling patterns:

### Error States

```typescript
const { loading, error, refetch } = useResource({
  resource: '/items',
});

if (error) {
  // error is a user-friendly message string
  console.log(error); // "Failed to fetch items"
}
```

### Error Recovery

```typescript
const { error, refetch } = useResource({
  resource: '/items',
});

const handleRetry = async () => {
  await refetch(); // Refetch clears error and retries
};

if (error) {
  return (
    <div>
      <p>{error}</p>
      <button onClick={handleRetry}>Retry</button>
    </div>
  );
}
```

### EnhancedError Mapping

The `@/admin/lib/errorMapping` module converts Axios errors to friendly messages:

```
Network Error → "Unable to connect to server"
404 → "Resource not found"
401 → "Authentication required"
403 → "Access denied"
500 → "Server error"
```

---

## Export Index

The `src/admin/hooks/index.ts` file exports all hooks for convenient importing:

```typescript
export * from './useTenants';
export * from './useCurrentTenant';
export * from './useSubscriptions';
export * from './useResource';
```

### Importing Options

```typescript
// Individual imports
import { useTenants } from '@/admin/hooks';
import { useResource } from '@/admin/hooks';

// Or namespace import
import * as hooks from '@/admin/hooks';
const { useTenants, useResource } = hooks;
```

---

## TypeScript Support

All hooks are fully typed with TypeScript support for:

### Generic Types

```typescript
// Specify result type
const { data: boms } = useResource<BOM>({
  resource: '/boms',
});

const { data: user } = useResourceById<User>({
  resource: '/users',
  id: 'user-123',
});
```

### Type Inference

```typescript
// Types are inferred from interfaces
const { tenants } = useTenants(); // tenants is Tenant[]
const { subscriptions } = useSubscriptions(); // subscriptions is Subscription[]
```

### Custom Interface Extensions

```typescript
// Extend base interfaces
interface CustomUser extends BaseUser {
  department?: string;
}

const { data: users } = useResource<CustomUser>({
  resource: '/users',
});
```

---

## Dependencies

All hooks have minimal dependencies:

- **React**: `useState`, `useEffect`, `useCallback` (built-in)
- **Axios**: `apiClient` (centralized in `@/admin/lib/apiClient`)
- **React Context**: `TenantContext` (only for `useCurrentTenant`)
- **Error Mapping**: `@/admin/lib/errorMapping`

---

## Performance Considerations

### Dependency Arrays

Hooks use optimized dependency arrays to prevent unnecessary re-renders:

```typescript
// Dependencies are carefully managed
useEffect(() => {
  fetchTenants();
}, [fetchTenants]); // Only refetch when function changes
```

### Transform Functions

For data transformation, memoize outside the hook when possible:

```typescript
// GOOD - memoized transform
const transformUser = useCallback(
  (item: any) => ({ ...item, fullName: item.firstName + ' ' + item.lastName }),
  []
);

const { data } = useResource({
  resource: '/users',
  transform: transformUser,
});

// Or define outside component
const transformUser = (item: any) => ({ ...item, ... });
const { data } = useResource({
  resource: '/users',
  transform: transformUser,
});
```

### Auto-Refresh Intervals

Use `refreshInterval` sparingly for performance:

```typescript
// GOOD - only refresh when necessary
const { data } = useResource({
  resource: '/status',
  refreshInterval: 30000, // Reasonable interval
});

// AVOID - too frequent
const { data } = useResource({
  resource: '/data',
  refreshInterval: 1000, // Every second is too often
});
```

---

## Testing

Hooks can be tested using `@testing-library/react-hooks`:

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useTenants } from '@/admin/hooks';

describe('useTenants', () => {
  it('fetches tenants on mount', async () => {
    const { result } = renderHook(() => useTenants());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.tenants).toHaveLength(2);
  });

  it('handles errors', async () => {
    // Mock apiClient to return error
    const { result } = renderHook(() => useTenants());

    await waitFor(() => {
      expect(result.current.error).toBeDefined();
    });
  });
});
```

---

## Summary

| Hook | Purpose | Returns | Endpoint |
|------|---------|---------|----------|
| `useTenants` | List all tenants | `Tenant[]` | GET /tenants/my-tenants |
| `useCurrentTenant` | Get current tenant details | `Tenant \| null` | GET /tenants/current or /tenants/:id |
| `useSubscriptions` | List subscriptions | `Subscription[]` | GET /subscriptions |
| `useResource` | Generic list fetching | `T[]` | GET /{resource} |
| `useResourceById` | Fetch single resource | `T \| null` | GET /{resource}/:id |

All hooks support filtering, sorting, auto-refresh, error handling, and manual refetching through a consistent API.
