/**
 * Auth Provider Router
 *
 * Intelligently routes to the appropriate auth provider based on environment configuration.
 * PRODUCTION MODE: Always uses real authentication (Keycloak, Auth0, or Supabase)
 * DEVELOPMENT MODE: Can optionally use mock authentication with strict safeguards
 *
 * This is the ONLY auth provider that should be imported into App.tsx
 */

import { AuthProvider } from 'react-admin';
import { authConfig } from '../config/authConfig';
import { mockAuthProvider } from './mockAuthProvider';
import { supabaseAuthProvider } from './supabaseAuthProvider';
import { auth0AuthProvider } from './auth0AuthProvider';
import { keycloakAuthProvider } from '../lib/keycloak/keycloakAuthProvider';

/**
 * Get the appropriate auth provider based on configuration
 *
 * SAFETY GUARANTEES:
 * 1. Production mode NEVER uses insecure mock auth, regardless of configuration
 * 2. Development mode can use mock auth ONLY if explicitly enabled
 * 3. All mode switches are logged for audit purposes
 */
const getAuthProvider = (): AuthProvider => {
  // Get the auth provider from environment variable
  const authProviderType = import.meta.env.VITE_AUTH_PROVIDER?.toLowerCase() || 'supabase';

  // CRITICAL: In production mode, ALWAYS use real authentication
  if (authConfig.mode === 'production') {
    if (authConfig.logAuthEvents) {
      console.log(
        '🔒 PRODUCTION MODE: Using production authentication\n' +
        'Mock authentication bypass is disabled regardless of configuration.'
      );
    }

    // In production, use Keycloak, Auth0, or Supabase (no mock)
    if (authProviderType === 'keycloak') {
      if (authConfig.logAuthEvents) {
        console.log('✅ Using Keycloak authentication');
      }
      return keycloakAuthProvider;
    }

    if (authProviderType === 'auth0') {
      if (authConfig.logAuthEvents) {
        console.log('✅ Using Auth0 authentication');
      }
      return auth0AuthProvider;
    }

    // Default to Supabase
    if (authConfig.logAuthEvents) {
      console.log('✅ Using Supabase authentication');
    }
    return supabaseAuthProvider;
  }

  // In development mode, check if dev bypass is enabled
  if (authConfig.devBypassEnabled) {
    if (authConfig.logAuthEvents) {
      console.warn(
        '⚠️ DEVELOPMENT MODE: Using mock authentication bypass\n' +
        '⚠️ This configuration is UNSAFE for production!\n' +
        '   Session Duration: ' + authConfig.sessionDurationMinutes + 'min\n' +
        '   Allowed IPs: ' + (authConfig.allowedDevIPs?.join(', ') || 'Any') + '\n\n' +
        '   To disable bypass in dev, set:\n' +
        '   VITE_DEV_BYPASS_ENABLED=false'
      );
    }
    return mockAuthProvider;
  }

  // Development mode with real authentication
  if (authProviderType === 'keycloak') {
    if (authConfig.logAuthEvents) {
      console.log(
        '🔓 DEVELOPMENT MODE: Using Keycloak authentication\n' +
        'Dev bypass is disabled. Using Keycloak auth flow.'
      );
    }
    return keycloakAuthProvider;
  }

  if (authProviderType === 'auth0') {
    if (authConfig.logAuthEvents) {
      console.log(
        '🔓 DEVELOPMENT MODE: Using Auth0 authentication\n' +
        'Dev bypass is disabled. Using Auth0 auth flow.'
      );
    }
    return auth0AuthProvider;
  }

  // Default: Supabase
  if (authConfig.logAuthEvents) {
    console.log(
      '🔓 DEVELOPMENT MODE: Using Supabase authentication\n' +
      'Dev bypass is disabled. Using Supabase auth flow.'
    );
  }
  return supabaseAuthProvider;
};

/**
 * The auth provider to use in the application
 * This selection happens once at module load time
 */
export const authProvider = getAuthProvider();

/**
 * Helper to check if currently using mock auth bypass (for debugging)
 */
export const isUsingMockAuthBypass = (): boolean => {
  return authConfig.mode === 'development' && authConfig.devBypassEnabled;
};

/**
 * Helper to get current auth mode (for UI display)
 */
export const getAuthMode = (): string => {
  if (authConfig.mode === 'production') {
    return 'Production (Secure)';
  }

  if (authConfig.devBypassEnabled) {
    return 'Development (Mock Bypass - ' + authConfig.sessionDurationMinutes + 'min sessions)';
  }

  return 'Development (Secure)';
};

// Log final auth provider selection
if (authConfig.logAuthEvents) {
  console.log('\n✅ Auth Provider Selected: ' + getAuthMode() + '\n');
}

/**
 * NOTE: Legacy Supabase auth utilities removed.
 * The auth provider is now intelligently routed based on authConfig.
 * See mockAuthProvider.ts for dev bypass implementation.
 * See keycloakAuthProvider.ts for production authentication.
 */
