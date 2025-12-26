/**
 * API Configuration
 *
 * Centralized API URL configuration derived from validated environment variables.
 * Uses Zod schema validation from env.schema.ts for type-safe access.
 *
 * Environment Variables:
 * - VITE_API_URL: Full URL to the backend API (e.g., http://localhost:14000)
 * - VITE_API_BASE_URL: Alias for VITE_API_URL
 *
 * Default: http://localhost:14000 (tenant-management-service)
 */

import { getEnv } from './env.schema';

// =============================================================================
// Validated Environment Configuration
// =============================================================================

/**
 * Get validated environment config.
 * This runs Zod validation and logs warnings in dev mode for missing vars.
 */
const env = getEnv();

// =============================================================================
// Exported Configuration
// =============================================================================

/**
 * Get the API base URL from environment variables.
 * Priority: VITE_API_URL > VITE_API_BASE_URL > DEFAULT_API_URL
 */
export const API_URL = env.VITE_API_URL || env.VITE_API_BASE_URL || 'http://localhost:14000';

/**
 * Get the customer app URL for redirects
 * Default: http://localhost:27555 (admin-app port)
 */
export const CUSTOMER_APP_URL = env.VITE_CUSTOMER_APP_URL;

/**
 * Check if API logging is enabled
 */
export const API_LOGGING_ENABLED = env.VITE_ENABLE_API_LOGGING;

/**
 * Export all config as a single object for convenience
 */
export const apiConfig = {
  baseUrl: API_URL,
  customerAppUrl: CUSTOMER_APP_URL,
  loggingEnabled: API_LOGGING_ENABLED,
};

export default apiConfig;
