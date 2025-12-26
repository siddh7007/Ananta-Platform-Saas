/**
 * Environment configuration - centralized access to environment variables
 */
export const env = {
  // Keycloak
  keycloak: {
    url: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8180',
    realm: import.meta.env.VITE_KEYCLOAK_REALM || 'ananta-saas',
    clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'cbp-frontend',
  },

  // API URLs
  api: {
    platform: import.meta.env.VITE_API_URL || 'http://localhost:14000',
    cns: import.meta.env.VITE_CNS_API_URL || 'http://localhost:27200/api',
    supabase: import.meta.env.VITE_SUPABASE_URL || 'http://localhost:27810',
  },

  // External Dashboards
  dashboards: {
    cns: import.meta.env.VITE_CNS_DASHBOARD_URL || 'http://localhost:27250',
  },

  // Admin Portal URL (for registration redirects)
  adminPortal: {
    url: import.meta.env.VITE_ADMIN_PORTAL_URL || 'http://localhost:27555',
  },

  // Feature Flags
  features: {
    devtools: import.meta.env.VITE_ENABLE_DEVTOOLS === 'true',
    mockData: import.meta.env.VITE_ENABLE_MOCK_DATA === 'true',
  },

  // App Info
  app: {
    name: import.meta.env.VITE_APP_NAME || 'Component Platform',
    version: import.meta.env.VITE_APP_VERSION || '0.1.0',
  },

  // API Timeout Configuration (milliseconds)
  timeout: {
    default: parseInt(import.meta.env.VITE_API_TIMEOUT || '30000', 10),
    search: parseInt(import.meta.env.VITE_API_SEARCH_TIMEOUT || '15000', 10),
  },

  // Runtime Environment
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
} as const;

export type Env = typeof env;
