/**
 * Data Provider Tests
 *
 * Tests for the Refine dataProvider implementation.
 * Verifies API_URL handling, HTTP methods, error handling, and token refresh.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { dataProvider } from './data-provider';

// Mock the dependencies
vi.mock('../lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../lib/token-manager', () => ({
  getAccessToken: vi.fn(() => 'mock-access-token'),
  getAuthHeaders: vi.fn(() => ({ Authorization: 'Bearer mock-access-token' })),
  refreshAccessToken: vi.fn(),
  handleSessionExpired: vi.fn(),
}));

vi.mock('../config/api', () => ({
  API_URL: 'http://localhost:14000',
}));

// Import mocked modules for assertions
import { getAuthHeaders, refreshAccessToken, handleSessionExpired } from '../lib/token-manager';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock performance.now for timing
vi.spyOn(performance, 'now').mockReturnValue(0);

describe('dataProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getApiUrl', () => {
    it('returns the configured API_URL', () => {
      expect(dataProvider.getApiUrl()).toBe('http://localhost:14000');
    });
  });

  describe('getList', () => {
    it('fetches list with correct URL and params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': '100' }),
        json: async () => ({ data: [{ id: '1', name: 'Test' }], total: 1 }),
      });

      const result = await dataProvider.getList({
        resource: 'tenants',
        pagination: { current: 1, pageSize: 10 },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:14000/tenants?page=1&limit=10',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer mock-access-token',
          }),
        })
      );

      expect(result.data).toEqual([{ id: '1', name: 'Test' }]);
      expect(result.total).toBe(1);
    });

    it('handles sorting parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': '100' }),
        json: async () => ({ data: [], total: 0 }),
      });

      await dataProvider.getList({
        resource: 'tenants',
        sorters: [{ field: 'name', order: 'asc' }],
      });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('sort=name');
      expect(calledUrl).toContain('order=asc');
    });

    it('handles filter parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': '100' }),
        json: async () => ({ data: [], total: 0 }),
      });

      await dataProvider.getList({
        resource: 'tenants',
        filters: [{ field: 'status', operator: 'eq', value: 'active' }],
      });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('status=active');
    });

    it('returns array directly when no data wrapper', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': '100' }),
        json: async () => [{ id: '1' }, { id: '2' }],
      });

      const result = await dataProvider.getList({ resource: 'plans' });

      expect(result.data).toEqual([{ id: '1' }, { id: '2' }]);
      expect(result.total).toBe(2);
    });
  });

  describe('getOne', () => {
    it('fetches single resource by id', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': '100' }),
        json: async () => ({ id: '123', name: 'Test Tenant' }),
      });

      const result = await dataProvider.getOne({
        resource: 'tenants',
        id: '123',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:14000/tenants/123',
        expect.objectContaining({ method: 'GET' })
      );

      expect(result.data).toEqual({ id: '123', name: 'Test Tenant' });
    });
  });

  describe('create', () => {
    it('creates resource with POST', async () => {
      const newTenant = { name: 'New Tenant', key: 'newtenant' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: new Headers({ 'content-length': '100' }),
        json: async () => ({ id: '456', ...newTenant }),
      });

      const result = await dataProvider.create({
        resource: 'tenants',
        variables: newTenant,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:14000/tenants',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(newTenant),
        })
      );

      expect(result.data.id).toBe('456');
    });
  });

  describe('update', () => {
    it('updates resource with PATCH', async () => {
      const updates = { name: 'Updated Tenant' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': '100' }),
        json: async () => ({ id: '123', ...updates }),
      });

      const result = await dataProvider.update({
        resource: 'tenants',
        id: '123',
        variables: updates,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:14000/tenants/123',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(updates),
        })
      );

      expect(result.data.name).toBe('Updated Tenant');
    });
  });

  describe('deleteOne', () => {
    it('deletes resource with DELETE', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: new Headers({ 'content-length': '0' }),
      });

      const result = await dataProvider.deleteOne({
        resource: 'tenants',
        id: '123',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:14000/tenants/123',
        expect.objectContaining({ method: 'DELETE' })
      );

      expect(result.data).toEqual({ success: true });
    });
  });

  describe('getMany', () => {
    it('fetches multiple resources by ids', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': '100' }),
        json: async () => ({ data: [{ id: '1' }, { id: '2' }] }),
      });

      const result = await dataProvider.getMany({
        resource: 'tenants',
        ids: ['1', '2'],
      });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('ids=1');
      expect(calledUrl).toContain('ids=2');
      expect(result.data).toHaveLength(2);
    });
  });

  describe('custom', () => {
    it('handles relative URLs by prepending API_URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': '100' }),
        json: async () => ({ status: 'success' }),
      });

      await dataProvider.custom({
        url: '/tenants/123/provision',
        method: 'post',
        payload: { planId: 'plan-basic' },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:14000/tenants/123/provision',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('uses absolute URLs without prepending API_URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': '100' }),
        json: async () => ({ status: 'success' }),
      });

      await dataProvider.custom({
        url: 'https://external-api.com/webhook',
        method: 'post',
        payload: { event: 'test' },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://external-api.com/webhook',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('appends query parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': '100' }),
        json: async () => ({}),
      });

      await dataProvider.custom({
        url: '/search',
        method: 'get',
        query: { q: 'test', limit: '10' },
      });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('q=test');
      expect(calledUrl).toContain('limit=10');
    });

    it('includes custom headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': '100' }),
        json: async () => ({}),
      });

      await dataProvider.custom({
        url: '/leads/123/tenants',
        method: 'post',
        headers: { 'X-Lead-Token': 'lead-token-abc' },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Lead-Token': 'lead-token-abc',
          }),
        })
      );
    });
  });

  describe('401 handling and token refresh', () => {
    it('refreshes token on 401 and retries request', async () => {
      // First request returns 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers(),
        json: async () => ({ error: 'Unauthorized' }),
      });

      // Mock successful token refresh
      vi.mocked(refreshAccessToken).mockResolvedValueOnce('new-access-token');

      // Retry request succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': '100' }),
        json: async () => ({ id: '1', name: 'Test' }),
      });

      const result = await dataProvider.getOne({
        resource: 'tenants',
        id: '1',
      });

      expect(refreshAccessToken).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.data).toEqual({ id: '1', name: 'Test' });
    });

    it('handles session expiration when refresh fails', async () => {
      // First request returns 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers(),
        json: async () => ({ error: 'Unauthorized' }),
      });

      // Token refresh fails
      vi.mocked(refreshAccessToken).mockResolvedValueOnce(null);

      await expect(
        dataProvider.getOne({ resource: 'tenants', id: '1' })
      ).rejects.toThrow('Session expired');

      expect(handleSessionExpired).toHaveBeenCalled();
    });

    it('refreshes token on 401 for custom requests', async () => {
      // First request returns 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers(),
      });

      // Mock successful token refresh
      vi.mocked(refreshAccessToken).mockResolvedValueOnce('new-access-token');

      // Retry request succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': '100' }),
        json: async () => ({ status: 'success' }),
      });

      const result = await dataProvider.custom({
        url: '/tenants/123/provision',
        method: 'post',
      });

      expect(refreshAccessToken).toHaveBeenCalled();
      expect(result.data.status).toBe('success');
    });
  });

  describe('error handling', () => {
    it('throws HttpError on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        url: 'http://localhost:14000/tenants/999',
        headers: new Headers(),
        json: async () => ({ message: 'Tenant not found' }),
      });

      await expect(
        dataProvider.getOne({ resource: 'tenants', id: '999' })
      ).rejects.toMatchObject({
        statusCode: 404,
        message: 'Tenant not found',
      });
    });

    it('handles validation errors with details', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        url: 'http://localhost:14000/tenants',
        headers: new Headers(),
        json: async () => ({
          message: 'Validation failed',
          errors: [{ field: 'key', message: 'Key too long' }],
        }),
      });

      await expect(
        dataProvider.create({
          resource: 'tenants',
          variables: { key: 'this-key-is-too-long' },
        })
      ).rejects.toMatchObject({
        statusCode: 422,
        errors: [{ field: 'key', message: 'Key too long' }],
      });
    });

    it('handles 204 No Content response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: new Headers(),
      });

      const result = await dataProvider.deleteOne({
        resource: 'tenants',
        id: '123',
      });

      expect(result.data).toEqual({ success: true });
    });

    it('handles empty response with content-length 0', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': '0' }),
      });

      const result = await dataProvider.deleteOne({
        resource: 'tenants',
        id: '123',
      });

      expect(result.data).toEqual({ success: true });
    });
  });

  describe('bulk operations', () => {
    it('createMany sends bulk POST request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': '100' }),
        json: async () => ({ created: 2 }),
      });

      await dataProvider.createMany({
        resource: 'users',
        variables: [
          { email: 'user1@test.com' },
          { email: 'user2@test.com' },
        ],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:14000/users/bulk',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            items: [
              { email: 'user1@test.com' },
              { email: 'user2@test.com' },
            ],
          }),
        })
      );
    });

    it('deleteMany sends bulk DELETE request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': '100' }),
        json: async () => ({ deleted: 2 }),
      });

      await dataProvider.deleteMany({
        resource: 'users',
        ids: ['1', '2'],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:14000/users/bulk',
        expect.objectContaining({
          method: 'DELETE',
          body: JSON.stringify({ ids: ['1', '2'] }),
        })
      );
    });
  });
});
