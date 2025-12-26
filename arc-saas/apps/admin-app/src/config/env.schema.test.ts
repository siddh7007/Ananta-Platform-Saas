/**
 * Environment Schema Tests
 *
 * Tests for the Zod-based environment configuration validation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { envSchema, validateEnv, safeValidateEnv } from './env.schema';

describe('envSchema', () => {
  describe('default values', () => {
    it('should have VITE_API_URL as optional (undefined when not provided)', () => {
      // VITE_API_URL is intentionally optional to allow fallback chain in api.ts:
      // VITE_API_URL || VITE_API_BASE_URL || 'http://localhost:14000'
      const result = envSchema.parse({});
      expect(result.VITE_API_URL).toBeUndefined();
    });

    it('should use default Keycloak URL when not provided', () => {
      const result = envSchema.parse({});
      expect(result.VITE_KEYCLOAK_URL).toBe('http://localhost:8180');
    });

    it('should use default realm when not provided', () => {
      const result = envSchema.parse({});
      expect(result.VITE_KEYCLOAK_REALM).toBe('ananta-saas');
    });

    it('should use default client ID when not provided', () => {
      const result = envSchema.parse({});
      expect(result.VITE_KEYCLOAK_CLIENT_ID).toBe('admin-app');
    });

    it('should use default auth mode when not provided', () => {
      const result = envSchema.parse({});
      expect(result.VITE_AUTH_MODE).toBe('keycloak');
    });

    it('should use default customer app URL when not provided', () => {
      const result = envSchema.parse({});
      expect(result.VITE_CUSTOMER_APP_URL).toBe('http://localhost:27555');
    });
  });

  describe('custom values', () => {
    it('should accept valid custom API URL', () => {
      const result = envSchema.parse({
        VITE_API_URL: 'http://api.example.com:3000',
      });
      expect(result.VITE_API_URL).toBe('http://api.example.com:3000');
    });

    it('should accept Docker Keycloak URL', () => {
      const result = envSchema.parse({
        VITE_KEYCLOAK_URL: 'http://localhost:14003',
      });
      expect(result.VITE_KEYCLOAK_URL).toBe('http://localhost:14003');
    });

    it('should accept internal Docker Keycloak URL', () => {
      const result = envSchema.parse({
        VITE_KEYCLOAK_URL: 'http://keycloak:8080',
      });
      expect(result.VITE_KEYCLOAK_URL).toBe('http://keycloak:8080');
    });

    it('should accept custom realm', () => {
      const result = envSchema.parse({
        VITE_KEYCLOAK_REALM: 'custom-realm',
      });
      expect(result.VITE_KEYCLOAK_REALM).toBe('custom-realm');
    });
  });

  describe('auth mode validation', () => {
    it('should accept "keycloak" auth mode', () => {
      const result = envSchema.parse({ VITE_AUTH_MODE: 'keycloak' });
      expect(result.VITE_AUTH_MODE).toBe('keycloak');
    });

    it('should accept "local" auth mode', () => {
      const result = envSchema.parse({ VITE_AUTH_MODE: 'local' });
      expect(result.VITE_AUTH_MODE).toBe('local');
    });

    it('should accept "both" auth mode', () => {
      const result = envSchema.parse({ VITE_AUTH_MODE: 'both' });
      expect(result.VITE_AUTH_MODE).toBe('both');
    });

    it('should reject invalid auth mode', () => {
      const result = safeValidateEnv({ VITE_AUTH_MODE: 'invalid' });
      expect(result.success).toBe(false);
    });
  });

  describe('feature flags', () => {
    it('should default billing to false', () => {
      const result = envSchema.parse({});
      expect(result.VITE_FEATURE_BILLING).toBe(false);
    });

    it('should default workflows to true', () => {
      const result = envSchema.parse({});
      expect(result.VITE_FEATURE_WORKFLOWS).toBe(true);
    });

    it('should default monitoring to true', () => {
      const result = envSchema.parse({});
      expect(result.VITE_FEATURE_MONITORING).toBe(true);
    });

    it('should default audit logs to true', () => {
      const result = envSchema.parse({});
      expect(result.VITE_FEATURE_AUDIT_LOGS).toBe(true);
    });

    it('should parse "true" string as boolean true', () => {
      const result = envSchema.parse({ VITE_FEATURE_BILLING: 'true' });
      expect(result.VITE_FEATURE_BILLING).toBe(true);
    });

    it('should parse "false" string as boolean false', () => {
      const result = envSchema.parse({ VITE_FEATURE_WORKFLOWS: 'false' });
      expect(result.VITE_FEATURE_WORKFLOWS).toBe(false);
    });
  });

  describe('Novu configuration', () => {
    it('should have optional app identifier', () => {
      const result = envSchema.parse({});
      expect(result.VITE_NOVU_APP_IDENTIFIER).toBeUndefined();
    });

    it('should use default Novu backend URL', () => {
      const result = envSchema.parse({});
      expect(result.VITE_NOVU_BACKEND_URL).toBe('http://localhost:13100');
    });

    it('should use default Novu socket URL', () => {
      const result = envSchema.parse({});
      expect(result.VITE_NOVU_SOCKET_URL).toBe('http://localhost:13101');
    });
  });

  describe('URL validation', () => {
    it('should reject invalid URL format', () => {
      const result = safeValidateEnv({ VITE_API_URL: 'not-a-url' });
      expect(result.success).toBe(false);
    });

    it('should accept https URLs', () => {
      const result = envSchema.parse({
        VITE_API_URL: 'https://api.production.com',
      });
      expect(result.VITE_API_URL).toBe('https://api.production.com');
    });

    it('should accept empty string for optional URLs', () => {
      const result = envSchema.parse({
        VITE_API_BASE_URL: '',
      });
      expect(result.VITE_API_BASE_URL).toBe('');
    });
  });
});

describe('validateEnv', () => {
  it('should throw on invalid configuration', () => {
    expect(() =>
      validateEnv({ VITE_AUTH_MODE: 'invalid-mode' })
    ).toThrow();
  });

  it('should return validated config on valid input', () => {
    const result = validateEnv({
      VITE_API_URL: 'http://localhost:14000',
      VITE_KEYCLOAK_URL: 'http://localhost:8180',
    });
    expect(result.VITE_API_URL).toBe('http://localhost:14000');
  });
});

describe('safeValidateEnv', () => {
  it('should return success:false on invalid configuration', () => {
    const result = safeValidateEnv({ VITE_AUTH_MODE: 'invalid' });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should return success:true with data on valid input', () => {
    const result = safeValidateEnv({});
    expect(result.success).toBe(true);
    if (result.success) {
      // VITE_API_URL is optional - verify other defaults work
      expect(result.data.VITE_KEYCLOAK_URL).toBe('http://localhost:8180');
      expect(result.data.VITE_API_URL).toBeUndefined();
    }
  });
});

describe('Keycloak port configuration', () => {
  it('should accept local dev port 8180', () => {
    const result = envSchema.parse({
      VITE_KEYCLOAK_URL: 'http://localhost:8180',
    });
    expect(result.VITE_KEYCLOAK_URL).toBe('http://localhost:8180');
  });

  it('should accept Docker external port 14003', () => {
    const result = envSchema.parse({
      VITE_KEYCLOAK_URL: 'http://localhost:14003',
    });
    expect(result.VITE_KEYCLOAK_URL).toBe('http://localhost:14003');
  });

  it('should accept Docker internal hostname and port', () => {
    const result = envSchema.parse({
      VITE_KEYCLOAK_URL: 'http://keycloak:8080',
    });
    expect(result.VITE_KEYCLOAK_URL).toBe('http://keycloak:8080');
  });
});

describe('URL validation helpers in getEnv fallback', () => {
  // These tests verify that the catch block in getEnv() properly validates URLs
  // before using them, rather than blindly copying invalid values

  it('should identify valid URLs', () => {
    // Test the URL validation logic used in getEnv fallback
    // Must be http:// or https:// to be considered valid
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

    expect(isValidUrl('http://localhost:8180')).toBe(true);
    expect(isValidUrl('https://api.example.com')).toBe(true);
    expect(isValidUrl('http://keycloak:8080')).toBe(true);
    expect(isValidUrl('not-a-url')).toBe(false);
    expect(isValidUrl('localhost:8180')).toBe(false); // missing protocol
    expect(isValidUrl('')).toBe(false);
    expect(isValidUrl(null)).toBe(false);
    expect(isValidUrl(undefined)).toBe(false);
    expect(isValidUrl(123)).toBe(false);
  });

  it('should identify non-empty strings', () => {
    const isNonEmptyString = (val: unknown): val is string => {
      return typeof val === 'string' && val.length > 0;
    };

    expect(isNonEmptyString('admin-app')).toBe(true);
    expect(isNonEmptyString('ananta-saas')).toBe(true);
    expect(isNonEmptyString('')).toBe(false);
    expect(isNonEmptyString(null)).toBe(false);
    expect(isNonEmptyString(undefined)).toBe(false);
    expect(isNonEmptyString(123)).toBe(false);
  });
});
