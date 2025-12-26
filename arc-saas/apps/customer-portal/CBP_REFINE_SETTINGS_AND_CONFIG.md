# CBP Refine - Settings & Configuration Documentation

**Portal**: Customer Business Portal (CBP) - Refine.dev Version
**Location**: `arc-saas/apps/customer-portal`
**Date**: 2025-12-14
**Framework**: Refine.dev 4.x + React 18 + TypeScript

---

## Executive Summary

This document provides comprehensive documentation of all settings, configuration options, environment variables, and customization capabilities in the CBP Refine Customer Portal.

**Configuration Sources**:
- Environment Variables (`.env` files)
- Runtime Configuration (`src/config/`)
- Feature Flags
- Theme Settings
- User Preferences
- Tenant-Specific Settings

---

## Table of Contents

1. [Environment Variables](#1-environment-variables)
2. [Application Configuration](#2-application-configuration)
3. [Authentication Configuration](#3-authentication-configuration)
4. [API & Data Provider Configuration](#4-api--data-provider-configuration)
5. [Navigation Configuration](#5-navigation-configuration)
6. [Theme & Styling Configuration](#6-theme--styling-configuration)
7. [Feature Flags](#7-feature-flags)
8. [Multi-Tenant Configuration](#8-multi-tenant-configuration)
9. [User Preferences](#9-user-preferences)
10. [Build & Deployment Configuration](#10-build--deployment-configuration)
11. [Security Configuration](#11-security-configuration)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Environment Variables

### 1.1 Required Environment Variables

**File**: `.env` / `.env.local` / `.env.production`

```bash
# ===========================================
# KEYCLOAK / AUTHENTICATION
# ===========================================
VITE_KEYCLOAK_URL=http://localhost:8180
VITE_KEYCLOAK_REALM=ananta-saas
VITE_KEYCLOAK_CLIENT_ID=cbp-frontend

# ===========================================
# API ENDPOINTS
# ===========================================
# Control Plane API (tenants, users, subscriptions)
VITE_API_URL_PLATFORM=http://localhost:14000

# CNS Service API (BOMs, enrichment)
VITE_API_URL_CNS=http://localhost:27200

# Supabase API (components catalog)
VITE_API_URL_SUPABASE=http://localhost:27810

# ===========================================
# APPLICATION SETTINGS
# ===========================================
VITE_APP_NAME="Ananta Customer Portal"
VITE_APP_VERSION=1.0.0

# ===========================================
# FEATURE FLAGS
# ===========================================
VITE_FEATURE_DEVTOOLS=false
VITE_FEATURE_MOCK_DATA=false
VITE_FEATURE_ANALYTICS=false
VITE_FEATURE_BILLING=true
VITE_FEATURE_RISK_ANALYSIS=true

# ===========================================
# EXTERNAL SERVICES
# ===========================================
VITE_NOVU_APP_ID=
VITE_SENTRY_DSN=
VITE_ANALYTICS_ID=
```

### 1.2 Environment-Specific Defaults

| Variable | Development | Staging | Production |
|----------|-------------|---------|------------|
| `VITE_KEYCLOAK_URL` | `localhost:8180` | `auth.staging.ananta.io` | `auth.ananta.io` |
| `VITE_API_URL_PLATFORM` | `localhost:14000` | `api.staging.ananta.io` | `api.ananta.io` |
| `VITE_API_URL_CNS` | `localhost:27200` | `cns.staging.ananta.io` | `cns.ananta.io` |
| `VITE_FEATURE_DEVTOOLS` | `true` | `false` | `false` |
| `VITE_FEATURE_MOCK_DATA` | `true` | `false` | `false` |

### 1.3 Environment Variable Validation

**Source**: `src/config/env.ts`

```typescript
// Environment configuration with defaults and validation
export const env = {
  keycloak: {
    url: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8180',
    realm: import.meta.env.VITE_KEYCLOAK_REALM || 'ananta-saas',
    clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'cbp-frontend',
  },
  api: {
    platform: import.meta.env.VITE_API_URL_PLATFORM || 'http://localhost:14000',
    cns: import.meta.env.VITE_API_URL_CNS || 'http://localhost:27200',
    supabase: import.meta.env.VITE_API_URL_SUPABASE || 'http://localhost:27810',
  },
  features: {
    devtools: import.meta.env.VITE_FEATURE_DEVTOOLS === 'true',
    mockData: import.meta.env.VITE_FEATURE_MOCK_DATA === 'true',
    analytics: import.meta.env.VITE_FEATURE_ANALYTICS === 'true',
    billing: import.meta.env.VITE_FEATURE_BILLING !== 'false',
    riskAnalysis: import.meta.env.VITE_FEATURE_RISK_ANALYSIS !== 'false',
  },
  app: {
    name: import.meta.env.VITE_APP_NAME || 'Ananta Customer Portal',
    version: import.meta.env.VITE_APP_VERSION || '1.0.0',
  },
};
```

---

## 2. Application Configuration

### 2.1 Main App Configuration

**Source**: `src/App.tsx`

```typescript
// Refine Application Configuration
<Refine
  dataProvider={{
    default: platformDataProvider,
    cns: cnsDataProvider,
    supabase: supabaseDataProvider,
  }}
  authProvider={authProvider}
  accessControlProvider={accessControlProvider}
  routerProvider={routerProvider}
  resources={resources}
  options={{
    syncWithLocation: true,
    warnWhenUnsavedChanges: true,
    useNewQueryKeys: true,
    projectId: 'cbp-refine',
    disableTelemetry: true,
  }}
>
  {/* App content */}
</Refine>
```

### 2.2 Refine Options

| Option | Value | Description |
|--------|-------|-------------|
| `syncWithLocation` | `true` | Sync filters/pagination with URL |
| `warnWhenUnsavedChanges` | `true` | Prompt before leaving unsaved forms |
| `useNewQueryKeys` | `true` | Use v4 query key format |
| `projectId` | `'cbp-refine'` | Project identifier for DevTools |
| `disableTelemetry` | `true` | Disable Refine analytics |

### 2.3 Resource Configuration

**Source**: `src/App.tsx` (resources array)

```typescript
const resources = [
  {
    name: 'dashboard',
    list: '/',
    meta: {
      label: 'Dashboard',
      icon: <Home />,
    },
  },
  {
    name: 'boms',
    list: '/boms',
    show: '/boms/:id',
    create: '/boms/upload',
    meta: {
      label: 'BOMs',
      icon: <FileText />,
      dataProviderName: 'cns',
    },
  },
  {
    name: 'components',
    list: '/components',
    show: '/components/:id',
    meta: {
      label: 'Components',
      icon: <Box />,
      dataProviderName: 'supabase',
    },
  },
  {
    name: 'team',
    list: '/team',
    create: '/team/invite',
    meta: {
      label: 'Team',
      icon: <Users />,
      dataProviderName: 'platform',
    },
  },
  {
    name: 'billing',
    list: '/billing',
    meta: {
      label: 'Billing',
      icon: <CreditCard />,
      dataProviderName: 'platform',
    },
  },
  // ... additional resources
];
```

---

## 3. Authentication Configuration

### 3.1 Keycloak Configuration

**Source**: `src/config/auth.ts`

```typescript
export const keycloakConfig = {
  url: env.keycloak.url,
  realm: env.keycloak.realm,
  clientId: env.keycloak.clientId,
};

// OIDC Settings
export const oidcConfig = {
  authority: `${keycloakConfig.url}/realms/${keycloakConfig.realm}`,
  client_id: keycloakConfig.clientId,
  redirect_uri: `${window.location.origin}/callback`,
  post_logout_redirect_uri: `${window.location.origin}/`,
  response_type: 'code',
  scope: 'openid profile email',
  automaticSilentRenew: true,
  silentRequestTimeout: 10000,
  filterProtocolClaims: true,
  loadUserInfo: true,
};
```

### 3.2 Role Hierarchy

**Source**: `src/config/auth.ts`

```typescript
// 5-Level Role Hierarchy
export type AppRole = 'analyst' | 'engineer' | 'admin' | 'owner' | 'super_admin';

export const ROLE_HIERARCHY: Record<AppRole, number> = {
  analyst: 1,      // Lowest - read-only access
  engineer: 2,     // Technical operations
  admin: 3,        // Organization management
  owner: 4,        // Billing and ownership
  super_admin: 5,  // Platform-wide access
};

// Role comparison helper
export function hasMinimumRole(userRole: AppRole, requiredRole: AppRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}
```

### 3.3 Keycloak Role Mappings

**Source**: `src/config/auth.ts`

```typescript
// Map Keycloak roles to app roles
export const KEYCLOAK_ROLE_MAPPINGS: Record<string, AppRole> = {
  // Super Admin mappings
  'platform:super_admin': 'super_admin',
  'platform-super-admin': 'super_admin',
  'super-admin': 'super_admin',
  'superadmin': 'super_admin',
  'super_admin': 'super_admin',
  'realm-admin': 'super_admin',
  'platform_admin': 'super_admin',

  // Owner mappings
  'owner': 'owner',
  'org-owner': 'owner',
  'organization-owner': 'owner',
  'billing_admin': 'owner',

  // Admin mappings
  'platform:admin': 'admin',
  'tenant-admin': 'admin',
  'admin': 'admin',
  'administrator': 'admin',
  'org_admin': 'admin',
  'org-admin': 'admin',

  // Engineer mappings
  'platform:engineer': 'engineer',
  'platform:staff': 'engineer',
  'engineer': 'engineer',
  'staff': 'engineer',
  'developer': 'engineer',
  'support': 'engineer',
  'operator': 'engineer',

  // Analyst mappings (default/lowest)
  'analyst': 'analyst',
  'user': 'analyst',
  'customer': 'analyst',
  'viewer': 'analyst',
  'member': 'analyst',
};
```

### 3.4 Auth Provider Configuration

**Source**: `src/providers/auth-provider.ts`

```typescript
export const authProvider: AuthBindings = {
  login: async () => {
    // Redirect to Keycloak login
    await userManager.signinRedirect();
    return { success: true };
  },

  logout: async () => {
    // End Keycloak session
    await userManager.signoutRedirect();
    return { success: true, redirectTo: '/' };
  },

  check: async () => {
    const user = await userManager.getUser();
    if (user && !user.expired) {
      return { authenticated: true };
    }
    return { authenticated: false, redirectTo: '/login' };
  },

  getIdentity: async () => {
    const user = await userManager.getUser();
    if (!user) return null;

    return {
      id: user.profile.sub,
      email: user.profile.email,
      name: user.profile.name,
      avatar: user.profile.picture,
      role: extractRoleFromToken(user),
    };
  },

  getPermissions: async () => {
    const user = await userManager.getUser();
    if (!user) return [];

    return extractPermissionsFromToken(user);
  },
};
```

---

## 4. API & Data Provider Configuration

### 4.1 Data Provider Overview

The portal uses 3 separate data providers:

| Provider | Base URL | Resources | Purpose |
|----------|----------|-----------|---------|
| `platform` | `VITE_API_URL_PLATFORM` | team, billing, settings | Control plane operations |
| `cns` | `VITE_API_URL_CNS` | boms, enrichment | BOM management |
| `supabase` | `VITE_API_URL_SUPABASE` | components | Component catalog |

### 4.2 Platform Data Provider

**Source**: `src/providers/data-provider-platform.ts`

```typescript
import dataProvider from '@refinedev/simple-rest';
import { env } from '@/config/env';

export const platformDataProvider = dataProvider(env.api.platform, {
  headers: () => {
    const token = getAccessToken();
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  },
});
```

### 4.3 CNS Data Provider

**Source**: `src/providers/data-provider-cns.ts`

```typescript
import dataProvider from '@refinedev/simple-rest';
import { env } from '@/config/env';

export const cnsDataProvider = dataProvider(env.api.cns, {
  headers: () => {
    const token = getAccessToken();
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-ID': getTenantId(),
    };
  },
});
```

### 4.4 Supabase Data Provider

**Source**: `src/providers/data-provider-supabase.ts`

```typescript
import { dataProvider } from '@refinedev/supabase';
import { supabaseClient } from '@/lib/supabase';

export const supabaseDataProvider = dataProvider(supabaseClient);
```

### 4.5 Custom HTTP Client

```typescript
// Custom axios instance with interceptors
import axios from 'axios';

export const httpClient = axios.create({
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
httpClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle errors
httpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Trigger re-authentication
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

---

## 5. Navigation Configuration

### 5.1 Navigation Manifest

**Source**: `src/config/navigation.ts`

```typescript
export interface NavItem {
  name: string;
  label: string;
  href: string;
  icon: LucideIcon;
  minRole: AppRole;
  badge?: string | number;
  children?: NavItem[];
  dataProviderName?: string;
  featureFlag?: string;
}

export const navigationManifest: NavItem[] = [
  {
    name: 'dashboard',
    label: 'Dashboard',
    href: '/',
    icon: Home,
    minRole: 'analyst',
  },
  {
    name: 'boms',
    label: 'BOMs',
    href: '/boms',
    icon: FileText,
    minRole: 'analyst',
    dataProviderName: 'cns',
  },
  {
    name: 'components',
    label: 'Components',
    href: '/components',
    icon: Box,
    minRole: 'analyst',
    dataProviderName: 'supabase',
  },
  {
    name: 'team',
    label: 'Team',
    href: '/team',
    icon: Users,
    minRole: 'admin',
    dataProviderName: 'platform',
  },
  {
    name: 'billing',
    label: 'Billing',
    href: '/billing',
    icon: CreditCard,
    minRole: 'owner',
    featureFlag: 'billing',
    dataProviderName: 'platform',
  },
  {
    name: 'risk',
    label: 'Risk Analysis',
    href: '/risk',
    icon: Shield,
    minRole: 'engineer',
    featureFlag: 'riskAnalysis',
  },
  {
    name: 'alerts',
    label: 'Alerts',
    href: '/alerts',
    icon: Bell,
    minRole: 'analyst',
    badge: 'unreadCount',
  },
  {
    name: 'workspaces',
    label: 'Workspaces',
    href: '/workspaces',
    icon: Folder,
    minRole: 'admin',
  },
  {
    name: 'projects',
    label: 'Projects',
    href: '/projects',
    icon: Briefcase,
    minRole: 'engineer',
  },
  {
    name: 'settings',
    label: 'Settings',
    href: '/settings',
    icon: Settings,
    minRole: 'analyst',
    children: [
      { name: 'profile', label: 'Profile', href: '/settings/profile', icon: User, minRole: 'analyst' },
      { name: 'security', label: 'Security', href: '/settings/security', icon: Lock, minRole: 'analyst' },
      { name: 'notifications', label: 'Notifications', href: '/settings/notifications', icon: Bell, minRole: 'analyst' },
      { name: 'api-keys', label: 'API Keys', href: '/settings/api-keys', icon: Key, minRole: 'engineer' },
      { name: 'organization', label: 'Organization', href: '/settings/organization', icon: Building, minRole: 'admin' },
    ],
  },
];
```

### 5.2 Navigation Filtering

```typescript
// Filter navigation based on user role and feature flags
export function getNavigationForRole(
  userRole: AppRole,
  features: Record<string, boolean> = {}
): NavItem[] {
  return navigationManifest.filter((item) => {
    // Check role requirement
    if (!hasMinimumRole(userRole, item.minRole)) {
      return false;
    }

    // Check feature flag
    if (item.featureFlag && !features[item.featureFlag]) {
      return false;
    }

    return true;
  }).map((item) => ({
    ...item,
    children: item.children?.filter((child) =>
      hasMinimumRole(userRole, child.minRole)
    ),
  }));
}
```

---

## 6. Theme & Styling Configuration

### 6.1 Tailwind Configuration

**Source**: `tailwind.config.js`

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: 0 },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: 0 },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
```

### 6.2 CSS Variables

**Source**: `src/index.css` or `src/styles/globals.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }
}
```

### 6.3 Theme Provider

```typescript
// Theme context for switching themes
export type Theme = 'light' | 'dark' | 'mid-light' | 'mid-dark' | 'system';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    // Load from localStorage
    const saved = localStorage.getItem('theme');
    return (saved as Theme) || 'system';
  });

  const resolvedTheme = useMemo(() => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    }
    return theme.includes('dark') ? 'dark' : 'light';
  }, [theme]);

  useEffect(() => {
    // Update document class
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(resolvedTheme);
    localStorage.setItem('theme', theme);
  }, [theme, resolvedTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
```

---

## 7. Feature Flags

### 7.1 Feature Flag Configuration

**Source**: `src/config/features.ts`

```typescript
export interface FeatureFlags {
  // Core features
  devtools: boolean;
  mockData: boolean;

  // Business features
  billing: boolean;
  riskAnalysis: boolean;
  alerts: boolean;

  // Experimental features
  aiEnrichment: boolean;
  componentRecommendations: boolean;
  bulkOperations: boolean;

  // UI features
  darkMode: boolean;
  advancedFilters: boolean;
  exportPdf: boolean;
}

export const defaultFeatures: FeatureFlags = {
  devtools: false,
  mockData: false,
  billing: true,
  riskAnalysis: true,
  alerts: true,
  aiEnrichment: false,
  componentRecommendations: false,
  bulkOperations: true,
  darkMode: true,
  advancedFilters: true,
  exportPdf: true,
};

// Load features from environment
export function loadFeatures(): FeatureFlags {
  return {
    ...defaultFeatures,
    devtools: import.meta.env.VITE_FEATURE_DEVTOOLS === 'true',
    mockData: import.meta.env.VITE_FEATURE_MOCK_DATA === 'true',
    billing: import.meta.env.VITE_FEATURE_BILLING !== 'false',
    riskAnalysis: import.meta.env.VITE_FEATURE_RISK_ANALYSIS !== 'false',
    // ... other features
  };
}
```

### 7.2 Feature Flag Hook

```typescript
// Hook to check feature flags
export function useFeature(featureName: keyof FeatureFlags): boolean {
  const features = useContext(FeatureContext);
  return features[featureName] ?? false;
}

// Usage
function BillingPage() {
  const billingEnabled = useFeature('billing');

  if (!billingEnabled) {
    return <FeatureDisabled name="Billing" />;
  }

  return <BillingContent />;
}
```

### 7.3 Feature-Gated Components

```typescript
// Higher-order component for feature gating
export function withFeature<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  featureName: keyof FeatureFlags,
  FallbackComponent?: React.ComponentType
) {
  return function FeatureGatedComponent(props: P) {
    const isEnabled = useFeature(featureName);

    if (!isEnabled) {
      return FallbackComponent ? <FallbackComponent /> : null;
    }

    return <WrappedComponent {...props} />;
  };
}

// Usage
export const BillingPage = withFeature(BillingPageContent, 'billing', FeatureNotAvailable);
```

---

## 8. Multi-Tenant Configuration

### 8.1 Tenant Context

**Source**: `src/contexts/TenantContext.tsx`

```typescript
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  settings?: TenantSettings;
}

export interface TenantSettings {
  theme?: string;
  defaultWorkspace?: string;
  features?: Partial<FeatureFlags>;
  branding?: {
    primaryColor?: string;
    logoUrl?: string;
    faviconUrl?: string;
  };
}

interface TenantContextValue {
  tenant: Tenant | null;
  tenants: Tenant[];
  setCurrentTenant: (tenantId: string) => void;
  isLoading: boolean;
}

export const TenantContext = createContext<TenantContextValue>({
  tenant: null,
  tenants: [],
  setCurrentTenant: () => {},
  isLoading: true,
});

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch user's tenants
    fetchUserTenants().then((result) => {
      setTenants(result);

      // Set current tenant from localStorage or first tenant
      const savedTenantId = localStorage.getItem('currentTenantId');
      const currentTenant = result.find(t => t.id === savedTenantId) || result[0];
      setTenant(currentTenant);
      setIsLoading(false);
    });
  }, []);

  const setCurrentTenant = useCallback((tenantId: string) => {
    const newTenant = tenants.find(t => t.id === tenantId);
    if (newTenant) {
      setTenant(newTenant);
      localStorage.setItem('currentTenantId', tenantId);
    }
  }, [tenants]);

  return (
    <TenantContext.Provider value={{ tenant, tenants, setCurrentTenant, isLoading }}>
      {children}
    </TenantContext.Provider>
  );
}
```

### 8.2 Tenant Selector Component

```typescript
export function TenantSelector() {
  const { tenant, tenants, setCurrentTenant } = useTenant();

  return (
    <Select value={tenant?.id} onValueChange={setCurrentTenant}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select organization" />
      </SelectTrigger>
      <SelectContent>
        {tenants.map((t) => (
          <SelectItem key={t.id} value={t.id}>
            <div className="flex items-center gap-2">
              {t.logo && <img src={t.logo} alt="" className="h-4 w-4 rounded" />}
              {t.name}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

### 8.3 Tenant-Scoped API Requests

```typescript
// Automatically include tenant ID in API requests
httpClient.interceptors.request.use((config) => {
  const tenant = getCurrentTenant();
  if (tenant) {
    config.headers['X-Tenant-ID'] = tenant.id;
  }
  return config;
});
```

---

## 9. User Preferences

### 9.1 User Preferences Schema

```typescript
export interface UserPreferences {
  // Display preferences
  theme: Theme;
  language: string;
  timezone: string;
  dateFormat: string;

  // Notification preferences
  emailNotifications: boolean;
  pushNotifications: boolean;
  notificationDigest: 'immediate' | 'daily' | 'weekly' | 'none';

  // UI preferences
  sidebarCollapsed: boolean;
  defaultView: 'grid' | 'table';
  itemsPerPage: number;

  // Feature preferences
  showOnboarding: boolean;
  showTips: boolean;
}

export const defaultPreferences: UserPreferences = {
  theme: 'system',
  language: 'en',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  dateFormat: 'MM/DD/YYYY',
  emailNotifications: true,
  pushNotifications: false,
  notificationDigest: 'daily',
  sidebarCollapsed: false,
  defaultView: 'table',
  itemsPerPage: 20,
  showOnboarding: true,
  showTips: true,
};
```

### 9.2 Preferences Hook

```typescript
export function usePreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    const saved = localStorage.getItem('userPreferences');
    return saved ? { ...defaultPreferences, ...JSON.parse(saved) } : defaultPreferences;
  });

  const updatePreference = useCallback(<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    setPreferences((prev) => {
      const updated = { ...prev, [key]: value };
      localStorage.setItem('userPreferences', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const resetPreferences = useCallback(() => {
    setPreferences(defaultPreferences);
    localStorage.removeItem('userPreferences');
  }, []);

  return { preferences, updatePreference, resetPreferences };
}
```

### 9.3 Preferences Page

```typescript
function PreferencesPage() {
  const { preferences, updatePreference } = usePreferences();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Display Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="theme">Theme</Label>
            <Select
              value={preferences.theme}
              onValueChange={(v) => updatePreference('theme', v as Theme)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="itemsPerPage">Items per page</Label>
            <Select
              value={String(preferences.itemsPerPage)}
              onValueChange={(v) => updatePreference('itemsPerPage', Number(v))}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 50, 100].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="emailNotifications">Email notifications</Label>
            <Switch
              id="emailNotifications"
              checked={preferences.emailNotifications}
              onCheckedChange={(v) => updatePreference('emailNotifications', v)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## 10. Build & Deployment Configuration

### 10.1 Vite Configuration

**Source**: `vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 27100,
    strictPort: true,
    proxy: {
      '/api/platform': {
        target: 'http://localhost:14000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/platform/, ''),
      },
      '/api/cns': {
        target: 'http://localhost:27200',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/cns/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          refine: ['@refinedev/core', '@refinedev/react-router-v6'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
        },
      },
    },
  },
});
```

### 10.2 TypeScript Configuration

**Source**: `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### 10.3 Docker Configuration

**Source**: `Dockerfile`

```dockerfile
# Build stage
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### 10.4 Nginx Configuration

**Source**: `nginx.conf`

```nginx
server {
    listen 80;
    server_name localhost;

    root /usr/share/nginx/html;
    index index.html;

    # SPA routing - serve index.html for all routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/platform {
        proxy_pass http://platform-api:14000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/cns {
        proxy_pass http://cns-service:27200;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

---

## 11. Security Configuration

### 11.1 Content Security Policy

```typescript
// CSP configuration for meta tag or server headers
export const cspConfig = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'"],
  'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  'font-src': ["'self'", 'https://fonts.gstatic.com'],
  'img-src': ["'self'", 'data:', 'https:'],
  'connect-src': [
    "'self'",
    import.meta.env.VITE_API_URL_PLATFORM,
    import.meta.env.VITE_API_URL_CNS,
    import.meta.env.VITE_KEYCLOAK_URL,
  ],
  'frame-ancestors': ["'none'"],
  'form-action': ["'self'"],
};
```

### 11.2 Token Storage

```typescript
// Secure token storage configuration
export const tokenStorageConfig = {
  // Where to store tokens
  storage: 'memory' as const, // 'memory' | 'sessionStorage' | 'localStorage'

  // Token refresh settings
  refreshThreshold: 60, // seconds before expiry to refresh

  // Logout on close (for high-security environments)
  logoutOnClose: false,
};

// Token manager with secure storage
class TokenManager {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  setTokens(access: string, refresh: string) {
    this.accessToken = access;
    this.refreshToken = refresh;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  clear() {
    this.accessToken = null;
    this.refreshToken = null;
  }
}

export const tokenManager = new TokenManager();
```

### 11.3 API Security Headers

```typescript
// Headers included in all API requests
export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
};
```

---

## 12. Troubleshooting

### 12.1 Common Issues

#### Authentication Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| Login redirect loop | Invalid redirect URI | Check `VITE_KEYCLOAK_URL` and Keycloak client settings |
| 401 on API calls | Expired token | Check token refresh logic, increase `silentRequestTimeout` |
| Role not detected | Missing role mapping | Add role to `KEYCLOAK_ROLE_MAPPINGS` |

#### API Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| CORS errors | Missing CORS headers | Configure CORS on backend or use proxy |
| 404 on API calls | Wrong base URL | Check `VITE_API_URL_*` variables |
| Tenant mismatch | Wrong tenant ID | Check `X-Tenant-ID` header |

#### UI Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| Theme not applying | CSS variables missing | Check `globals.css` is imported |
| Icons not showing | Lucide not imported | Add specific icon imports |
| Layout broken | Tailwind not processing | Check `tailwind.config.js` content paths |

### 12.2 Debug Mode

```typescript
// Enable debug mode for troubleshooting
if (import.meta.env.DEV) {
  // Log all API requests
  httpClient.interceptors.request.use((config) => {
    console.log('[API Request]', config.method?.toUpperCase(), config.url);
    return config;
  });

  // Log all API responses
  httpClient.interceptors.response.use(
    (response) => {
      console.log('[API Response]', response.status, response.config.url);
      return response;
    },
    (error) => {
      console.error('[API Error]', error.response?.status, error.config?.url);
      return Promise.reject(error);
    }
  );
}
```

### 12.3 Environment Validation

```typescript
// Validate environment on startup
export function validateEnvironment(): string[] {
  const errors: string[] = [];

  // Required variables
  const required = [
    'VITE_KEYCLOAK_URL',
    'VITE_KEYCLOAK_REALM',
    'VITE_KEYCLOAK_CLIENT_ID',
    'VITE_API_URL_PLATFORM',
  ];

  for (const key of required) {
    if (!import.meta.env[key]) {
      errors.push(`Missing required environment variable: ${key}`);
    }
  }

  // URL format validation
  const urls = [
    'VITE_KEYCLOAK_URL',
    'VITE_API_URL_PLATFORM',
    'VITE_API_URL_CNS',
  ];

  for (const key of urls) {
    const value = import.meta.env[key];
    if (value && !value.startsWith('http')) {
      errors.push(`Invalid URL format for ${key}: ${value}`);
    }
  }

  return errors;
}

// Run validation on app start
const envErrors = validateEnvironment();
if (envErrors.length > 0) {
  console.error('Environment validation failed:', envErrors);
}
```

---

## Appendix A: Environment Variable Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_KEYCLOAK_URL` | Yes | `http://localhost:8180` | Keycloak server URL |
| `VITE_KEYCLOAK_REALM` | Yes | `ananta-saas` | Keycloak realm name |
| `VITE_KEYCLOAK_CLIENT_ID` | Yes | `cbp-frontend` | OIDC client ID |
| `VITE_API_URL_PLATFORM` | Yes | `http://localhost:14000` | Platform API URL |
| `VITE_API_URL_CNS` | No | `http://localhost:27200` | CNS Service URL |
| `VITE_API_URL_SUPABASE` | No | `http://localhost:27810` | Supabase API URL |
| `VITE_APP_NAME` | No | `Ananta Customer Portal` | Application name |
| `VITE_FEATURE_DEVTOOLS` | No | `false` | Enable Refine DevTools |
| `VITE_FEATURE_MOCK_DATA` | No | `false` | Use mock data |
| `VITE_FEATURE_BILLING` | No | `true` | Enable billing features |
| `VITE_FEATURE_RISK_ANALYSIS` | No | `true` | Enable risk analysis |

---

## Appendix B: Quick Start Guide

### Development Setup

```bash
# 1. Clone and install
cd arc-saas/apps/customer-portal
npm install

# 2. Create environment file
cp .env.example .env.local

# 3. Edit .env.local with your settings
# VITE_KEYCLOAK_URL=http://localhost:8180
# VITE_API_URL_PLATFORM=http://localhost:14000
# ...

# 4. Start development server
npm run dev

# 5. Open http://localhost:27100
```

### Production Build

```bash
# 1. Set production environment
export NODE_ENV=production

# 2. Build
npm run build

# 3. Preview build
npm run preview

# 4. Deploy dist/ folder to your server
```

---

**Document Version**: 1.0
**Last Updated**: 2025-12-14
**Maintainer**: Platform Team
