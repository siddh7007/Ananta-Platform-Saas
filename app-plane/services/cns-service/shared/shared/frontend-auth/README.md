# @components-platform/frontend-auth

Shared Auth0 + Supabase authentication for Components Platform frontends.

## Features

- 🔐 **Auth0 Integration**: Social login (Google, Microsoft, Email/Password)
- 🏢 **Organization Support**: Platform admin detection via Auth0 Organizations
- 🔒 **Supabase RLS**: Row-level security with tenant isolation
- 🚫 **Data Leak Prevention**: Cache management to prevent cross-session data exposure
- ⚡ **React Admin Ready**: Drop-in auth provider for React Admin applications

## Installation

```bash
# Install peer dependencies
npm install @auth0/auth0-react @supabase/supabase-js react-admin

# Link shared package (local development)
cd shared/frontend-auth
npm install
npm run build
cd ../../services/your-service
npm link ../../shared/frontend-auth
```

## Usage

### 1. Create Supabase Client

```tsx
import { createSupabaseClient } from '@components-platform/frontend-auth';

export const supabase = createSupabaseClient({
  url: import.meta.env.VITE_SUPABASE_URL!,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY!,
});
```

### 2. Create Auth Provider

```tsx
import { createAuth0AuthProvider } from '@components-platform/frontend-auth';
import { supabase } from './supabaseClient';
import { clearDataProviderCache } from './dataProvider';

export const authProvider = createAuth0AuthProvider({
  supabase,
  auth0Domain: import.meta.env.VITE_AUTH0_DOMAIN!,
  auth0ClientId: import.meta.env.VITE_AUTH0_CLIENT_ID!,
  middlewareUrl: import.meta.env.VITE_MIDDLEWARE_API_URL,
  enableGateLogging: import.meta.env.VITE_ENABLE_GATE_LOGGING !== 'false',
  onClearCache: clearDataProviderCache,
  onLogin: async (user) => {
    console.log('User logged in:', user);
    // Optional: publish event, analytics, etc.
  },
  onLogout: async (user) => {
    console.log('User logged out:', user);
    // Optional: publish event, analytics, etc.
  },
});
```

### 3. Set Up Auth0 Provider

```tsx
import { Auth0Provider } from '@auth0/auth0-react';
import { Admin, Resource } from 'react-admin';
import { Auth0Login, updateAuth0State } from '@components-platform/frontend-auth';
import { authProvider } from './authProvider';

function Auth0StateSync({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user, error } = useAuth0();

  useEffect(() => {
    updateAuth0State({ isAuthenticated, isLoading, user, error });
  }, [isAuthenticated, isLoading, user, error]);

  return <>{children}</>;
}

function App() {
  return (
    <Auth0Provider
      domain={import.meta.env.VITE_AUTH0_DOMAIN!}
      clientId={import.meta.env.VITE_AUTH0_CLIENT_ID!}
      authorizationParams={{
        redirect_uri: window.location.origin,
      }}
    >
      <Auth0StateSync>
        <Admin
          authProvider={authProvider}
          loginPage={Auth0Login}
        >
          {/* Your resources */}
        </Admin>
      </Auth0StateSync>
    </Auth0Provider>
  );
}
```

### 4. Data Provider Cache Management

**CRITICAL**: Clear cache on logout to prevent data leaks!

```tsx
import { createCacheManager } from '@components-platform/frontend-auth';

// Create cache manager
const {
  getCachedTenantId,
  setCachedTenantId,
  getCachedSuperAdmin,
  setCachedSuperAdmin,
  clearCache,
} = createCacheManager();

// Export for auth provider
export const clearDataProviderCache = clearCache;

// Use in data provider
export const dataProvider = {
  getList: async (resource, params) => {
    // Get cached tenant ID
    let tenantId = getCachedTenantId();

    if (!tenantId) {
      // Fetch from API
      const { data } = await supabase
        .from('users')
        .select('organization_id')
        .single();

      tenantId = data?.organization_id;
      setCachedTenantId(tenantId);
    }

    // Use tenantId for RLS filtering...
  },
};
```

## Platform Admin Login

The package automatically detects platform admin login via URL:

- **Customer Login**: `http://localhost:27510/` → No organization parameter
- **Admin Login**: `http://localhost:27510/#/admin-login` → Forces organization login

Platform admins get `org_id` in their JWT token for cross-service authorization.

## Environment Variables

```env
# Auth0
VITE_AUTH0_DOMAIN=dev-xxxxx.us.auth0.com
VITE_AUTH0_CLIENT_ID=your-client-id

# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Middleware
VITE_MIDDLEWARE_API_URL=http://localhost:27700

# Debugging
VITE_ENABLE_GATE_LOGGING=true  # Verbose auth logs
```

## Security Features

### 1. Data Leak Prevention

The cache management system prevents tenant data exposure:

```ts
// ❌ BAD: Module-level cache persists across sessions
let cachedTenantId: string | undefined;

// ✅ GOOD: Use cache manager with clearCache on logout
const { getCachedTenantId, clearCache } = createCacheManager();
```

### 2. Organization Enforcement

Platform admins MUST login via `/admin-login` route to get `org_id` in token:

```ts
// Automatically checked by auth provider
if (isAdminLogin && !orgId) {
  // Force re-login with organization parameter
  logout();
}
```

### 3. Middleware Session Creation

All authentication flows through middleware API to:
- Create/update Supabase user records (with service role)
- Insert organization_memberships for RLS
- Generate Supabase JWT tokens
- Prevent auth bypass vulnerabilities

## API Reference

### `createAuth0AuthProvider(config)`

Creates React Admin auth provider with Auth0 + Supabase integration.

**Config Options:**
- `supabase` (required): Supabase client instance
- `auth0Domain` (required): Auth0 domain
- `auth0ClientId` (required): Auth0 client ID
- `middlewareUrl`: Middleware API URL (default: `http://localhost:27700`)
- `platformOrgId`: Platform organization ID (default: `org_oNtVXvVrzXz1ubua`)
- `namespace`: Auth0 custom claims namespace
- `defaultTenantId`: Default tenant for new users
- `enableGateLogging`: Enable verbose auth logs
- `onLogin`: Callback for login events
- `onLogout`: Callback for logout events
- `onClearCache`: Callback to clear data provider cache

### `Auth0Login`

React component for Auth0 login page.

**Props:**
- `platformOrgId`: Organization ID for platform admins
- `redirectUri`: Custom redirect URI
- `title`: Custom title (default: "Components Platform")
- `subtitle`: Custom subtitle

### `createCacheManager()`

Creates cache management utilities.

**Returns:**
- `getCachedTenantId()`: Get cached tenant ID
- `setCachedTenantId(id)`: Set cached tenant ID
- `getCachedSuperAdmin()`: Get cached admin status
- `setCachedSuperAdmin(status)`: Set cached admin status
- `clearCache()`: Clear all cached state (call on logout!)

## Migration Guide

### From Customer Portal Auth

```tsx
// Before
import { auth0AuthProvider } from './providers/auth0AuthProvider';
import { Auth0Login } from './components/Auth0Login';

// After
import { createAuth0AuthProvider, Auth0Login } from '@components-platform/frontend-auth';

const authProvider = createAuth0AuthProvider({
  supabase,
  auth0Domain: import.meta.env.VITE_AUTH0_DOMAIN!,
  auth0ClientId: import.meta.env.VITE_AUTH0_CLIENT_ID!,
  onClearCache: clearDataProviderCache,
});
```

## Troubleshooting

### No org_id in token for admin login

Ensure `/admin-login` route is in URL:
```
✅ http://localhost:27510/#/admin-login
❌ http://localhost:27510/
```

### Data leaking across sessions

Ensure cache is cleared on logout:
```ts
createAuth0AuthProvider({
  // ...
  onClearCache: clearDataProviderCache,  // ← Must be provided!
});
```

### RLS policies failing

Check organization_memberships table:
```sql
SELECT * FROM organization_memberships WHERE user_id = 'xxx';
```

Middleware should auto-create memberships. If missing, check middleware logs.

## License

MIT
