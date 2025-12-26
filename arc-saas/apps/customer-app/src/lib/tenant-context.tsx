/**
 * Tenant Context
 *
 * Provides tenant information throughout the customer app.
 * Tenant is resolved from subdomain or URL path.
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export interface TenantConfig {
  tenantId: string;
  tenantKey: string;
  key: string; // Alias for tenantKey for convenience
  name: string;
  domain: string;
  theme?: {
    primaryColor?: string;
    logo?: string;
  };
  features?: Record<string, boolean>;
}

interface TenantContextValue {
  tenant: TenantConfig | null;
  isLoading: boolean;
  error: Error | null;
}

const TenantContext = createContext<TenantContextValue | null>(null);

/**
 * Extract tenant key from hostname
 * e.g., acme.app.example.com -> acme
 */
function getTenantFromHostname(): string | null {
  const hostname = window.location.hostname;

  // Local development with subdomain
  if (hostname.includes('.localhost')) {
    return hostname.split('.')[0];
  }

  // Production subdomain pattern: {tenant}.app.example.com
  const parts = hostname.split('.');
  if (parts.length >= 3) {
    return parts[0];
  }

  // Fallback for development
  if (hostname === 'localhost') {
    // Check URL param for development
    const params = new URLSearchParams(window.location.search);
    return params.get('tenant') || 'demo';
  }

  return null;
}

// Mock tenant for development when backend is not running
const DEV_MOCK_TENANT: TenantConfig = {
  tenantId: 'dev-tenant-001',
  tenantKey: 'demo',
  key: 'demo',
  name: 'Ananta Platform Demo',
  domain: 'localhost',
  theme: {
    primaryColor: '#6366f1',
  },
  features: {
    billing: true,
    multiUser: true,
  },
};

// Check if we should use mock tenant (dev mode without backend)
const USE_MOCK_TENANT = import.meta.env.VITE_USE_MOCK_TENANT === 'true' ||
  import.meta.env.DEV;

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenant] = useState<TenantConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function loadTenant() {
      try {
        const tenantKey = getTenantFromHostname();

        if (!tenantKey) {
          throw new Error('Could not determine tenant from URL');
        }

        // Get token from localStorage if available (for authenticated requests)
        const TOKEN_KEY = 'arc_customer_token';
        const token = localStorage.getItem(TOKEN_KEY);

        // Fetch tenant config from API
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`/api/tenants/by-key/${tenantKey}`, { headers });

        if (!response.ok) {
          // In development, fall back to mock tenant if API fails
          if (USE_MOCK_TENANT) {
            console.warn('[Dev Mode] Using mock tenant - backend not available or auth required');
            setTenant({ ...DEV_MOCK_TENANT, tenantKey, key: tenantKey });
            setIsLoading(false);
            return;
          }

          if (response.status === 404) {
            throw new Error(`Tenant "${tenantKey}" not found`);
          }
          if (response.status === 401 || response.status === 403) {
            // If auth required and we're in dev mode, use mock
            console.warn('[Dev Mode] Auth required for tenant lookup - using mock');
            setTenant({ ...DEV_MOCK_TENANT, tenantKey, key: tenantKey });
            setIsLoading(false);
            return;
          }
          throw new Error('Failed to load tenant configuration');
        }

        const tenantData = await response.json();

        setTenant({
          tenantId: tenantData.id,
          tenantKey: tenantData.key,
          key: tenantData.key,
          name: tenantData.name,
          domain: tenantData.domain,
          theme: tenantData.config?.theme,
          features: tenantData.config?.features,
        });

        // Apply tenant theme
        if (tenantData.config?.theme?.primaryColor) {
          applyTenantTheme(tenantData.config.theme);
        }
      } catch (err) {
        // In development, fall back to mock tenant on any error
        if (USE_MOCK_TENANT) {
          console.warn('[Dev Mode] Using mock tenant due to error:', err);
          setTenant(DEV_MOCK_TENANT);
          setIsLoading(false);
          return;
        }
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setIsLoading(false);
      }
    }

    loadTenant();
  }, []);

  return (
    <TenantContext.Provider value={{ tenant, isLoading, error }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}

/**
 * Apply tenant theme colors to CSS variables
 */
function applyTenantTheme(theme: { primaryColor?: string }) {
  if (theme.primaryColor) {
    // This is simplified - in production you'd generate the full color palette
    document.documentElement.style.setProperty('--brand-500', theme.primaryColor);
    document.documentElement.style.setProperty('--brand-600', theme.primaryColor);
  }
}
