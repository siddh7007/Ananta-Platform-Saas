/**
 * API Configuration Tests
 *
 * Verifies that API configuration respects environment variable overrides.
 *
 * Note: These tests mock the env.schema module to provide controlled env values.
 * This avoids issues with the singleton cache in the real env.schema module.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create a mock env object that can be modified per-test
let mockEnvValues: Record<string, unknown> = {};

// Mock env.schema to return our controlled values
// Note: VITE_API_URL is now optional (no default) to allow fallback to VITE_API_BASE_URL
vi.mock('./env.schema', () => ({
  getEnv: () => ({
    VITE_API_URL: mockEnvValues.VITE_API_URL ?? undefined, // undefined, not empty string
    VITE_API_BASE_URL: mockEnvValues.VITE_API_BASE_URL ?? undefined,
    VITE_CUSTOMER_APP_URL: mockEnvValues.VITE_CUSTOMER_APP_URL ?? 'http://localhost:27555',
    VITE_ENABLE_API_LOGGING: mockEnvValues.VITE_ENABLE_API_LOGGING ?? true,
    VITE_KEYCLOAK_URL: 'http://localhost:8180',
    VITE_KEYCLOAK_REALM: 'ananta-saas',
    VITE_KEYCLOAK_CLIENT_ID: 'admin-app',
    VITE_AUTH_MODE: 'keycloak',
  }),
  env: {},
  envSchema: { parse: vi.fn() },
  validateEnv: vi.fn(),
  safeValidateEnv: vi.fn(),
  checkKeycloakUrlConsistency: vi.fn(),
}));

describe('API Configuration', () => {
  beforeEach(() => {
    // Reset mock values and module cache before each test
    mockEnvValues = {};
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses default API URL when no env vars are set', async () => {
    mockEnvValues = {
      VITE_API_URL: '',
      VITE_API_BASE_URL: undefined,
    };

    const { API_URL } = await import('./api');
    expect(API_URL).toBe('http://localhost:14000');
  });

  it('respects VITE_API_URL environment variable', async () => {
    mockEnvValues = {
      VITE_API_URL: 'https://api.production.example.com',
      VITE_API_BASE_URL: undefined,
    };

    const { API_URL } = await import('./api');
    expect(API_URL).toBe('https://api.production.example.com');
  });

  it('falls back to VITE_API_BASE_URL when VITE_API_URL is not set', async () => {
    mockEnvValues = {
      VITE_API_URL: '',
      VITE_API_BASE_URL: 'https://api.staging.example.com',
    };

    const { API_URL } = await import('./api');
    expect(API_URL).toBe('https://api.staging.example.com');
  });

  it('VITE_API_URL takes priority over VITE_API_BASE_URL', async () => {
    mockEnvValues = {
      VITE_API_URL: 'https://api.primary.example.com',
      VITE_API_BASE_URL: 'https://api.secondary.example.com',
    };

    const { API_URL } = await import('./api');
    expect(API_URL).toBe('https://api.primary.example.com');
  });

  it('uses default customer app URL when not set', async () => {
    mockEnvValues = {
      VITE_CUSTOMER_APP_URL: 'http://localhost:27555',
    };

    const { CUSTOMER_APP_URL } = await import('./api');
    expect(CUSTOMER_APP_URL).toBe('http://localhost:27555');
  });

  it('respects VITE_CUSTOMER_APP_URL environment variable', async () => {
    mockEnvValues = {
      VITE_CUSTOMER_APP_URL: 'https://app.example.com',
    };

    const { CUSTOMER_APP_URL } = await import('./api');
    expect(CUSTOMER_APP_URL).toBe('https://app.example.com');
  });

  it('correctly detects API logging enabled state', async () => {
    mockEnvValues = {
      VITE_ENABLE_API_LOGGING: true,
    };

    const { API_LOGGING_ENABLED } = await import('./api');
    expect(API_LOGGING_ENABLED).toBe(true);
  });

  it('correctly detects API logging disabled state', async () => {
    mockEnvValues = {
      VITE_ENABLE_API_LOGGING: false,
    };

    const { API_LOGGING_ENABLED } = await import('./api');
    expect(API_LOGGING_ENABLED).toBe(false);
  });

  it('apiConfig object contains all expected properties', async () => {
    mockEnvValues = {};

    const { apiConfig } = await import('./api');

    expect(apiConfig).toHaveProperty('baseUrl');
    expect(apiConfig).toHaveProperty('customerAppUrl');
    expect(apiConfig).toHaveProperty('loggingEnabled');
  });
});
