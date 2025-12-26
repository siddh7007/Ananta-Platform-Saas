# @arc-saas/pg-client

PostgreSQL client utilities for ARC SaaS tenant applications with multi-tenant schema isolation and React Query integration.

## Installation

```bash
npm install @arc-saas/pg-client pg
# For React apps
npm install @tanstack/react-query
```

## Features

- Multi-tenant PostgreSQL connection pooling
- Schema-based tenant isolation
- Fluent query builder
- Transaction support with savepoints
- React Query hooks for data fetching
- TypeScript-first design

## Usage

### Basic Client Usage

```typescript
import { createTenantClient } from '@arc-saas/pg-client';

const client = createTenantClient(
  {
    host: 'localhost',
    port: 5432,
    database: 'app_db',
    user: 'postgres',
    password: 'password',
  },
  {
    tenantId: 'tenant-123',
    tenantKey: 'acme',
    isolationStrategy: 'schema', // 'schema' | 'database' | 'row'
  }
);

// Find all users
const users = await client.findAll('users');

// Find with conditions
const activeUsers = await client.findAll('users', {
  where: { status: 'active' },
  orderBy: 'created_at DESC',
  limit: 10,
});

// Find by ID
const user = await client.findById('users', 'user-123');

// Paginated query
const result = await client.findPaginated('users', {
  page: 1,
  pageSize: 20,
  where: { role: 'admin' },
});
// { data: [...], total: 100, page: 1, pageSize: 20, totalPages: 5, ... }

// Insert
const newUser = await client.insert('users', {
  name: 'John Doe',
  email: 'john@example.com',
});

// Update
const updated = await client.updateById('users', 'user-123', {
  name: 'Jane Doe',
});

// Delete
await client.deleteById('users', 'user-123');

// Close when done
await client.close();
```

### Query Builder

```typescript
import { TenantQueryBuilder } from '@arc-saas/pg-client';

const users = await new TenantQueryBuilder(client, 'users')
  .select('id', 'name', 'email')
  .where('status', 'active')
  .whereNotNull('verified_at')
  .orderBy('created_at', 'DESC')
  .limit(10)
  .get();

// Pagination
const page = await new TenantQueryBuilder(client, 'orders')
  .where('user_id', userId)
  .orderByDesc('created_at')
  .paginate(1, 20);

// Check existence
const exists = await new TenantQueryBuilder(client, 'users')
  .where('email', 'john@example.com')
  .exists();

// Count
const count = await new TenantQueryBuilder(client, 'orders')
  .where('status', 'pending')
  .count();
```

### Transactions

```typescript
import { withTransaction, Transaction } from '@arc-saas/pg-client';

// Simple transaction
await withTransaction(pool, async (client) => {
  await client.query('INSERT INTO orders ...');
  await client.query('UPDATE inventory ...');
  // Automatically commits or rolls back
});

// Manual transaction control
const tx = new Transaction(pool);
try {
  await tx.begin({ isolationLevel: 'SERIALIZABLE' });

  await tx.query('INSERT INTO orders ...');
  await tx.savepoint('after_order');

  try {
    await tx.query('UPDATE inventory ...');
  } catch {
    await tx.rollbackTo('after_order');
  }

  await tx.commit();
} catch (error) {
  await tx.rollback();
}
```

### React Integration

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  TenantDbProvider,
  useQuery,
  usePaginatedQuery,
  useInsert,
  useUpdate,
  useDelete,
  createQueryClient,
} from '@arc-saas/pg-client/react';

// App setup
const queryClient = createQueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TenantDbProvider
        config={{
          host: process.env.DB_HOST,
          port: 5432,
          database: process.env.DB_NAME,
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
        }}
        options={{
          tenantId: 'tenant-123',
          tenantKey: 'acme',
          isolationStrategy: 'schema',
        }}
        loadingComponent={<div>Loading...</div>}
      >
        <UserList />
      </TenantDbProvider>
    </QueryClientProvider>
  );
}

// Component using hooks
function UserList() {
  const { data: users, isLoading } = useQuery('users', {
    where: { status: 'active' },
    orderBy: 'name ASC',
  });

  const insertUser = useInsert('users', {
    onSuccess: () => console.log('User created!'),
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      {users?.map(user => (
        <div key={user.id}>{user.name}</div>
      ))}
      <button onClick={() => insertUser.mutate({ name: 'New User' })}>
        Add User
      </button>
    </div>
  );
}

// Paginated list
function OrderList() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = usePaginatedQuery('orders', {
    page,
    pageSize: 20,
    orderBy: 'created_at DESC',
  });

  return (
    <div>
      {data?.data.map(order => (
        <div key={order.id}>{order.id}</div>
      ))}
      <button
        disabled={!data?.hasPreviousPage}
        onClick={() => setPage(p => p - 1)}
      >
        Previous
      </button>
      <button
        disabled={!data?.hasNextPage}
        onClick={() => setPage(p => p + 1)}
      >
        Next
      </button>
    </div>
  );
}
```

## Tenant Isolation Strategies

### Schema Isolation (Recommended for Pooled)

Each tenant gets their own PostgreSQL schema:

```
database: app_db
├── tenant_acme (schema)
│   ├── users
│   ├── orders
│   └── ...
├── tenant_globex (schema)
│   ├── users
│   ├── orders
│   └── ...
```

### Database Isolation (For Silo Tenants)

Each tenant gets their own database:

```typescript
const client = createTenantClient(config, {
  tenantId: 'tenant-123',
  tenantKey: 'acme',
  isolationStrategy: 'database',
  databaseOverride: 'acme_db', // Dedicated database
});
```

### Row-Level Security

Shared tables with tenant_id column:

```typescript
const client = createTenantClient(config, {
  tenantId: 'tenant-123',
  tenantKey: 'acme',
  isolationStrategy: 'row',
});
// All queries automatically filter by tenant_id
```

## API Reference

### TenantPgClient

| Method | Description |
|--------|-------------|
| `query(sql, params)` | Execute raw SQL |
| `findAll(table, options)` | Find all records |
| `findOne(table, where)` | Find single record |
| `findById(table, id)` | Find by ID |
| `findPaginated(table, options)` | Paginated query |
| `insert(table, data)` | Insert record |
| `insertMany(table, records)` | Bulk insert |
| `update(table, where, data)` | Update records |
| `updateById(table, id, data)` | Update by ID |
| `delete(table, where)` | Delete records |
| `deleteById(table, id)` | Delete by ID |
| `exists(table, where)` | Check existence |
| `count(table, where)` | Count records |
| `healthCheck()` | Verify connection |
| `close()` | Close connection |

### React Hooks

| Hook | Description |
|------|-------------|
| `useQuery(table, options)` | Fetch records |
| `useQueryById(table, id)` | Fetch by ID |
| `usePaginatedQuery(table, options)` | Paginated fetch |
| `useInfiniteQuery(table, options)` | Infinite scroll |
| `useInsert(table, options)` | Insert mutation |
| `useUpdate(table, options)` | Update mutation |
| `useDelete(table, options)` | Delete mutation |
| `useRawQuery(key, sql, params)` | Raw SQL query |

## License

MIT
