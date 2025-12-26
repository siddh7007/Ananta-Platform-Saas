import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CNS_API_BASE_URL,
  CNS_API_URL,
  CNS_DASHBOARD_URL,
  API_CONFIG,
  CNS_STAFF_ORGANIZATION_ID,
  CNS_STAFF_ORGANIZATION_NAME,
  getAuthHeaders,
} from '../../config/api';

vi.mock('../../lib/keycloak/keycloakConfig', () => ({
  getAccessToken: () => 'test-keycloak-token',
}));

describe('API Configuration', () => {
  describe('API URLs', () => {
    it('should define CNS API base URL', () => {
      expect(CNS_API_BASE_URL).toBeDefined();
      expect(typeof CNS_API_BASE_URL).toBe('string');
      expect(CNS_API_BASE_URL).toContain('/api');
    });

    it('should have CNS_API_URL as alias', () => {
      expect(CNS_API_URL).toBe(CNS_API_BASE_URL);
    });

    it('should define dashboard URL', () => {
      expect(CNS_DASHBOARD_URL).toBeDefined();
      expect(typeof CNS_DASHBOARD_URL).toBe('string');
    });

    it('should include proper URL structure', () => {
      expect(CNS_API_BASE_URL).toMatch(/^https?:\/\//);
      expect(CNS_DASHBOARD_URL).toMatch(/^https?:\/\//);
    });
  });

  describe('API_CONFIG object', () => {
    it('should contain all required configuration', () => {
      expect(API_CONFIG).toBeDefined();
      expect(API_CONFIG.apiBaseUrl).toBeDefined();
      expect(API_CONFIG.dashboardUrl).toBeDefined();
      expect(API_CONFIG.BASE_URL).toBeDefined();
    });

    it('should have consistent BASE_URL alias', () => {
      expect(API_CONFIG.BASE_URL).toBe(API_CONFIG.apiBaseUrl);
    });

    it('should include port configuration', () => {
      expect(API_CONFIG.cnsPort).toBeDefined();
      expect(API_CONFIG.dashboardPort).toBeDefined();
    });
  });

  describe('CNS Staff Organization', () => {
    it('should define staff organization ID', () => {
      expect(CNS_STAFF_ORGANIZATION_ID).toBeDefined();
      expect(typeof CNS_STAFF_ORGANIZATION_ID).toBe('string');
    });

    it('should have valid UUID format for org ID', () => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(CNS_STAFF_ORGANIZATION_ID).toMatch(uuidRegex);
    });

    it('should define staff organization name', () => {
      expect(CNS_STAFF_ORGANIZATION_NAME).toBeDefined();
      expect(typeof CNS_STAFF_ORGANIZATION_NAME).toBe('string');
      expect(CNS_STAFF_ORGANIZATION_NAME.length).toBeGreaterThan(0);
    });

    it('should use expected staff organization name', () => {
      expect(CNS_STAFF_ORGANIZATION_NAME).toContain('Platform');
    });
  });

  describe('getAuthHeaders', () => {
    beforeEach(() => {
      // Clear localStorage before each test
      localStorage.clear();
    });

    it('should return authorization headers', () => {
      const headers = getAuthHeaders();
      expect(headers).toBeDefined();
      expect(typeof headers).toBe('object');
    });

    it('should include Authorization header', () => {
      const headers = getAuthHeaders();
      expect(headers).toHaveProperty('Authorization');
    });

    it('should use Bearer token format', () => {
      const headers = getAuthHeaders();
      if (headers.Authorization) {
        expect(headers.Authorization).toMatch(/^Bearer\s+/);
      }
    });

    it('should use Keycloak access token when available', () => {
      const headers = getAuthHeaders();
      expect(headers.Authorization).toContain('test-keycloak-token');
    });
  });

  describe('Environment-based configuration', () => {
    it('should respect VITE_CNS_API_URL when set', () => {
      // The value should come from setupTests.ts or default
      expect(CNS_API_BASE_URL).toBe(process.env.VITE_CNS_API_URL);
    });

    it('should properly append /api to base URL', () => {
      expect(CNS_API_BASE_URL.endsWith('/api')).toBe(true);
    });
  });

  describe('URL construction', () => {
    it('should not have double slashes in URLs', () => {
      expect(CNS_API_BASE_URL).not.toContain('//api');
      expect(CNS_DASHBOARD_URL).not.toMatch(/\/\//g);
    });

    it('should not have trailing slashes', () => {
      // API URL should end with /api, not /api/
      expect(CNS_API_BASE_URL.endsWith('/api/')).toBe(false);
    });
  });
});
