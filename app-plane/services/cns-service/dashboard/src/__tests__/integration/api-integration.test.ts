import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dataProvider } from '../../dataProvider';
import { getAuthHeaders } from '../../config/api';

vi.mock('../../lib/keycloak/keycloakConfig', () => ({
  getAccessToken: () => 'test-keycloak-token',
}));

vi.mock('../../lib/keycloak', () => ({
  getToken: async () => 'test-keycloak-token',
}));

// Mock fetch
global.fetch = vi.fn();

describe('API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication headers', () => {
    it('should include access token in requests', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: async () => [],
      });

      await dataProvider.getList('items', {
        pagination: { page: 1, perPage: 10 },
        sort: { field: 'id', order: 'ASC' },
        filter: {},
      });

      expect(global.fetch).toHaveBeenCalled();
      const fetchCall = (global.fetch as any).mock.calls[0];
      expect(fetchCall[1].headers).toHaveProperty('Authorization');
    });

    it('should use Bearer token format', () => {
      const headers = getAuthHeaders();
      expect(headers.Authorization).toMatch(/^Bearer\s+/);
    });
  });

  describe('Error handling', () => {
    it('should handle 401 Unauthorized', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: 'Invalid token' }),
      });

      await expect(
        dataProvider.getList('items', {
          pagination: { page: 1, perPage: 10 },
          sort: { field: 'id', order: 'ASC' },
          filter: {},
        })
      ).rejects.toThrow();
    });

    it('should handle 403 Forbidden', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({ error: 'Access denied' }),
      });

      await expect(
        dataProvider.getList('items', {
          pagination: { page: 1, perPage: 10 },
          sort: { field: 'id', order: 'ASC' },
          filter: {},
        })
      ).rejects.toThrow();
    });

    it('should handle 500 Internal Server Error', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Server error' }),
      });

      await expect(
        dataProvider.getList('items', {
          pagination: { page: 1, perPage: 10 },
          sort: { field: 'id', order: 'ASC' },
          filter: {},
        })
      ).rejects.toThrow();
    });

    it('should handle network errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      await expect(
        dataProvider.getList('items', {
          pagination: { page: 1, perPage: 10 },
          sort: { field: 'id', order: 'ASC' },
          filter: {},
        })
      ).rejects.toThrow('Network error');
    });
  });

  describe('Data transformation', () => {
    it('should handle paginated responses', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-range': 'items 0-9/100' }),
        json: async () => Array(10).fill({ id: 1, name: 'Item' }),
      });

      const result = await dataProvider.getList('items', {
        pagination: { page: 1, perPage: 10 },
        sort: { field: 'id', order: 'ASC' },
        filter: {},
      });

      expect(result.data).toHaveLength(10);
      expect(result.total).toBe(100);
    });

    it('should handle empty responses', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-range': 'items 0-0/0' }),
        json: async () => [],
      });

      const result = await dataProvider.getList('items', {
        pagination: { page: 1, perPage: 10 },
        sort: { field: 'id', order: 'ASC' },
        filter: {},
      });

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('Request construction', () => {
    it('should construct correct URLs for resources', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: async () => [],
      });

      await dataProvider.getList('boms', {
        pagination: { page: 1, perPage: 10 },
        sort: { field: 'id', order: 'ASC' },
        filter: {},
      });

      const fetchCall = (global.fetch as any).mock.calls[0];
      expect(fetchCall[0]).toContain('/boms');
    });

    it('should include query parameters', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: async () => [],
      });

      await dataProvider.getList('items', {
        pagination: { page: 2, perPage: 20 },
        sort: { field: 'name', order: 'DESC' },
        filter: { status: 'active' },
      });

      const fetchCall = (global.fetch as any).mock.calls[0];
      const url = fetchCall[0];

      expect(url).toContain('_start=20');
      expect(url).toContain('_end=40');
      expect(url).toContain('_sort=name');
      expect(url).toContain('_order=DESC');
    });
  });
});
