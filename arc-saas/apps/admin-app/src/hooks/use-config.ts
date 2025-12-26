import { useMemo } from 'react';

/**
 * Application configuration interface
 * Values can be overridden via environment variables
 */
export interface AppConfig {
  /** Base URL for the API */
  apiBaseUrl: string;
  /** Client ID for authentication */
  clientId: string;
  /** Enable Keycloak OIDC authentication */
  keycloakEnabled: boolean;
  /** Keycloak realm URL */
  keycloakUrl?: string;
  /** Keycloak realm name */
  keycloakRealm?: string;
  /** Keycloak client ID */
  keycloakClientId?: string;
  /** Enable session timeout feature */
  sessionTimeoutEnabled: boolean;
  /** Session timeout in minutes */
  sessionTimeoutMinutes: number;
  /** Minutes before timeout to show warning */
  sessionWarningMinutes: number;
  /** Application version */
  appVersion: string;
  /** Environment name */
  environment: 'development' | 'staging' | 'production';
  /** Enable debug logging */
  debugEnabled: boolean;
}

const DEFAULT_SESSION_TIMEOUT = 30;
const DEFAULT_SESSION_WARNING = 5;

/**
 * Get configuration from environment variables with defaults
 */
function getConfig(): AppConfig {
  const env = import.meta.env;

  return {
    apiBaseUrl: env.VITE_API_BASE_URL || '/api',
    clientId: env.VITE_CLIENT_ID || 'arc-saas-admin',
    keycloakEnabled: env.VITE_KEYCLOAK_ENABLED === 'true',
    keycloakUrl: env.VITE_KEYCLOAK_URL,
    keycloakRealm: env.VITE_KEYCLOAK_REALM,
    keycloakClientId: env.VITE_KEYCLOAK_CLIENT_ID,
    sessionTimeoutEnabled: env.VITE_SESSION_TIMEOUT_ENABLED === 'true',
    sessionTimeoutMinutes: env.VITE_SESSION_TIMEOUT_MINUTES
      ? parseInt(env.VITE_SESSION_TIMEOUT_MINUTES, 10)
      : DEFAULT_SESSION_TIMEOUT,
    sessionWarningMinutes: env.VITE_SESSION_WARNING_MINUTES
      ? parseInt(env.VITE_SESSION_WARNING_MINUTES, 10)
      : DEFAULT_SESSION_WARNING,
    appVersion: env.VITE_APP_VERSION || '1.0.0',
    environment: (env.MODE as AppConfig['environment']) || 'development',
    debugEnabled: env.MODE === 'development' || env.VITE_DEBUG === 'true',
  };
}

// Singleton config instance
let configInstance: AppConfig | null = null;

/**
 * Hook to access application configuration.
 * Configuration is read from environment variables and cached.
 *
 * @returns The application configuration object
 *
 * @example
 * const { config } = useConfig();
 * console.log(config.apiBaseUrl);
 * if (config.keycloakEnabled) {
 *   // Use Keycloak auth
 * }
 */
export function useConfig(): { config: AppConfig } {
  const config = useMemo(() => {
    if (!configInstance) {
      configInstance = getConfig();
    }
    return configInstance;
  }, []);

  return { config };
}

/**
 * Get config outside of React components (for services, utils, etc.)
 */
export function getAppConfig(): AppConfig {
  if (!configInstance) {
    configInstance = getConfig();
  }
  return configInstance;
}

export default useConfig;
