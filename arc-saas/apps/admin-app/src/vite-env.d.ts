/// <reference types="vite/client" />

interface ImportMetaEnv {
  // API Configuration
  readonly VITE_API_URL: string;
  readonly VITE_API_BASE_URL: string;
  readonly VITE_CUSTOMER_APP_URL: string;

  // Authentication Mode ('keycloak' | 'local' | 'both')
  readonly VITE_AUTH_MODE: string;

  // Keycloak Configuration
  readonly VITE_KEYCLOAK_ENABLED: string;
  readonly VITE_KEYCLOAK_URL: string;
  readonly VITE_KEYCLOAK_REALM: string;
  readonly VITE_KEYCLOAK_CLIENT_ID: string;
  readonly VITE_CLIENT_ID: string;

  // Session Configuration
  readonly VITE_SESSION_TIMEOUT_ENABLED: string;
  readonly VITE_SESSION_TIMEOUT_MINUTES: string;
  readonly VITE_SESSION_WARNING_MINUTES: string;

  // Feature Flags
  readonly VITE_FEATURE_BILLING: string;
  readonly VITE_FEATURE_WORKFLOWS: string;
  readonly VITE_FEATURE_MONITORING: string;
  readonly VITE_FEATURE_AUDIT_LOGS: string;

  // Novu Notifications
  readonly VITE_NOVU_APP_ID: string;
  readonly VITE_NOVU_APP_IDENTIFIER: string;
  readonly VITE_NOVU_BACKEND_URL: string;
  readonly VITE_NOVU_SOCKET_URL: string;

  // Debug/Logging
  readonly VITE_ENABLE_API_LOGGING: string;
  readonly VITE_APP_VERSION: string;
  readonly VITE_DEBUG: string;

  // Vite built-in
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly SSR: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
