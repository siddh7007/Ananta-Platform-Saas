/**
 * Environment Configuration Schema
 *
 * Centralized schema validation for all environment variables using Zod.
 * This ensures type safety and validates configuration at runtime.
 *
 * Usage:
 *   import { env, validateEnv } from './env.schema';
 *   // Access validated env vars
 *   console.log(env.VITE_API_URL);
 *
 * All VITE_ prefixed variables are exposed to the browser.
 * Sensitive values should NEVER use the VITE_ prefix.
 */

import { z } from 'zod';

// =============================================================================
// Schema Definition
// =============================================================================

/**
 * URL validation helper that also accepts empty strings (for optional URLs)
 */
const urlSchema = z.string().url().or(z.literal(''));

/**
 * Boolean from string helper with default true
 */
const booleanFromStringDefaultTrue = z
  .string()
  .optional()
  .transform((val) => val === undefined ? true : val === 'true');

/**
 * Boolean from string helper with default false
 */
const booleanFromStringDefaultFalse = z
  .string()
  .optional()
  .transform((val) => val === undefined ? false : val === 'true');

/**
 * Auth mode enum
 */
const authModeSchema = z.enum(['keycloak', 'local', 'both']).default('keycloak');

/**
 * Environment variable schema
 */
export const envSchema = z.object({
  // ==========================================================================
  // API Configuration
  // ==========================================================================
  /**
   * Backend API URL (tenant-management-service)
   * NO DEFAULT - allows fallback to VITE_API_BASE_URL in api.ts
   * Final fallback to http://localhost:14000 is handled in api.ts
   */
  VITE_API_URL: urlSchema.optional(),

  /**
   * Alias for VITE_API_URL (backward compatibility)
   * Used when VITE_API_URL is not set
   */
  VITE_API_BASE_URL: urlSchema.optional(),

  /**
   * Customer app URL for redirects after registration
   * @default http://localhost:27555
   */
  VITE_CUSTOMER_APP_URL: urlSchema.default('http://localhost:27555'),

  // ==========================================================================
  // Keycloak Configuration
  // ==========================================================================
  /**
   * Keycloak server URL
   *
   * Port configuration:
   * - Local dev (Bun/Node):    http://localhost:8180
   * - Docker Compose (ext):    http://localhost:14003
   * - Docker internal:         http://keycloak:8080
   *
   * @default http://localhost:8180
   */
  VITE_KEYCLOAK_URL: urlSchema.default('http://localhost:8180'),

  /**
   * Keycloak realm name
   * @default ananta-saas
   */
  VITE_KEYCLOAK_REALM: z.string().default('ananta-saas'),

  /**
   * Keycloak client ID
   * @default admin-app
   */
  VITE_KEYCLOAK_CLIENT_ID: z.string().default('admin-app'),

  /**
   * Auth mode: 'keycloak', 'local', or 'both'
   * @default keycloak
   */
  VITE_AUTH_MODE: authModeSchema,

  // ==========================================================================
  // Novu Notification Configuration
  // ==========================================================================
  /**
   * Novu application identifier
   */
  VITE_NOVU_APP_IDENTIFIER: z.string().optional(),

  /**
   * Novu backend API URL
   * @default http://localhost:13100
   */
  VITE_NOVU_BACKEND_URL: urlSchema.default('http://localhost:13100'),

  /**
   * Novu WebSocket URL for real-time notifications
   * @default http://localhost:13101
   */
  VITE_NOVU_SOCKET_URL: urlSchema.default('http://localhost:13101'),

  // ==========================================================================
  // Feature Flags
  // ==========================================================================
  /**
   * Enable billing module
   * @default false
   */
  VITE_FEATURE_BILLING: booleanFromStringDefaultFalse,

  /**
   * Enable workflow management module
   * @default true
   */
  VITE_FEATURE_WORKFLOWS: booleanFromStringDefaultTrue,

  /**
   * Enable monitoring dashboards
   * @default true
   */
  VITE_FEATURE_MONITORING: booleanFromStringDefaultTrue,

  /**
   * Enable audit logs module
   * @default true
   */
  VITE_FEATURE_AUDIT_LOGS: booleanFromStringDefaultTrue,

  /**
   * Enable notifications admin module
   * @default true
   */
  VITE_FEATURE_NOTIFICATIONS: booleanFromStringDefaultTrue,

  // ==========================================================================
  // Debug Configuration
  // ==========================================================================
  /**
   * Enable detailed API logging in browser console
   * @default true in development
   */
  VITE_ENABLE_API_LOGGING: booleanFromStringDefaultTrue,
});

// =============================================================================
// Type Export
// =============================================================================

/**
 * Inferred type from the schema
 */
export type EnvConfig = z.infer<typeof envSchema>;

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validate environment variables against the schema.
 * Returns validated config or throws with detailed error messages.
 *
 * @param rawEnv - Raw environment object (typically import.meta.env)
 * @returns Validated and typed environment configuration
 * @throws ZodError with detailed validation errors
 */
export function validateEnv(rawEnv: Record<string, unknown>): EnvConfig {
  return envSchema.parse(rawEnv);
}

/**
 * Safe validation that returns a result object instead of throwing.
 *
 * @param rawEnv - Raw environment object
 * @returns { success: true, data: EnvConfig } or { success: false, error: ZodError }
 */
export function safeValidateEnv(rawEnv: Record<string, unknown>) {
  return envSchema.safeParse(rawEnv);
}

// =============================================================================
// Singleton Validated Environment
// =============================================================================

/**
 * Get the validated environment configuration.
 * Caches the result after first validation.
 */
let cachedEnv: EnvConfig | null = null;

export function getEnv(): EnvConfig {
  if (cachedEnv) {
    return cachedEnv;
  }

  // In development, be lenient with validation errors
  if (import.meta.env.DEV) {
    const result = safeValidateEnv(import.meta.env);
    if (!result.success) {
      console.warn(
        '[ENV SCHEMA] Validation warnings:',
        result.error.flatten().fieldErrors
      );
      // IMPORTANT: Don't discard all env vars on validation failure.
      // Use passthrough parsing to keep valid fields and apply defaults to invalid ones.
      // This ensures user-provided values are preserved even when some fields fail validation.
      try {
        // Try parsing with passthrough to keep unknown fields
        cachedEnv = envSchema.passthrough().parse(import.meta.env);
      } catch {
        // If that still fails, merge raw env with defaults
        // IMPORTANT: Only use raw values that pass individual field validation
        // Invalid values (like malformed URLs) fall back to defaults
        const defaults = envSchema.parse({});
        const rawEnv = import.meta.env as Record<string, unknown>;

        // Helper to validate a URL string (must be http:// or https://)
        const isValidUrl = (val: unknown): val is string => {
          if (typeof val !== 'string' || val === '') return false;
          try {
            const url = new URL(val);
            // Must have http or https protocol - reject relative URLs like 'localhost:8180'
            return url.protocol === 'http:' || url.protocol === 'https:';
          } catch {
            return false;
          }
        };

        // Helper to validate a non-empty string
        const isNonEmptyString = (val: unknown): val is string => {
          return typeof val === 'string' && val.length > 0;
        };

        cachedEnv = {
          ...defaults,
          // Override with raw env values only if they pass validation
          // URLs must be valid URLs, strings must be non-empty
          ...(isValidUrl(rawEnv.VITE_API_URL) ? { VITE_API_URL: rawEnv.VITE_API_URL } : {}),
          ...(isValidUrl(rawEnv.VITE_API_BASE_URL) || rawEnv.VITE_API_BASE_URL === '' ? { VITE_API_BASE_URL: rawEnv.VITE_API_BASE_URL as string } : {}),
          ...(isValidUrl(rawEnv.VITE_CUSTOMER_APP_URL) ? { VITE_CUSTOMER_APP_URL: rawEnv.VITE_CUSTOMER_APP_URL } : {}),
          ...(isValidUrl(rawEnv.VITE_KEYCLOAK_URL) ? { VITE_KEYCLOAK_URL: rawEnv.VITE_KEYCLOAK_URL } : {}),
          ...(isNonEmptyString(rawEnv.VITE_KEYCLOAK_REALM) ? { VITE_KEYCLOAK_REALM: rawEnv.VITE_KEYCLOAK_REALM } : {}),
          ...(isNonEmptyString(rawEnv.VITE_KEYCLOAK_CLIENT_ID) ? { VITE_KEYCLOAK_CLIENT_ID: rawEnv.VITE_KEYCLOAK_CLIENT_ID } : {}),
        } as EnvConfig;
      }
      return cachedEnv;
    }
    cachedEnv = result.data;
    return cachedEnv;
  }

  // In production, validate strictly
  cachedEnv = validateEnv(import.meta.env);
  return cachedEnv;
}

/**
 * Pre-validated environment configuration singleton.
 * Use this for direct access to validated env vars.
 *
 * @example
 * import { env } from './env.schema';
 * fetch(`${env.VITE_API_URL}/tenants`);
 */
export const env = getEnv();

// =============================================================================
// Utility: Check for Keycloak URL Mismatch
// =============================================================================

/**
 * Warn if Keycloak URL uses Docker port but we're running locally (or vice versa).
 * This helps catch common misconfiguration issues.
 */
export function checkKeycloakUrlConsistency(): void {
  const keycloakUrl = env.VITE_KEYCLOAK_URL;
  const isDockerPort = keycloakUrl.includes(':14003') || keycloakUrl.includes(':8080');
  const isLocalPort = keycloakUrl.includes(':8180');

  // Log environment info in development
  if (import.meta.env.DEV) {
    if (isDockerPort) {
      console.info(
        '[KEYCLOAK] Using Docker port configuration:',
        keycloakUrl,
        '\n  Ensure Docker containers are running.'
      );
    } else if (isLocalPort) {
      console.info(
        '[KEYCLOAK] Using local development port:',
        keycloakUrl,
        '\n  Ensure Keycloak is running on port 8180.'
      );
    }
  }
}
