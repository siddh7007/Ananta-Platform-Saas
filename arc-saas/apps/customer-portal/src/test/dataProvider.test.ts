import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Tests for Refine data providers
 */

// Mock axios
vi.mock('@/lib/axios', () => {
  const mockAxiosInstance = {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    request: vi.fn(),
    defaults: {
      baseURL: 'http://localhost:14000',
    },
  };

  return {
    platformApi: mockAxiosInstance,
    cnsApi: { ...mockAxiosInstance, defaults: { baseURL: 'http://localhost:27200' } },
    supabaseApi: { ...mockAxiosInstance, defaults: { baseURL: 'http://localhost:27810' } },
  };
});

describe('Data Provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getList', () => {
    it('should build LoopBack-style filter for pagination', async () => {
      const { platformApi } = await import('@/lib/axios');
      const { platformDataProvider } = await import('@/providers/dataProvider');

      (platformApi.get as any).mockResolvedValue({
        data: [{ id: '1', name: 'Test' }],
        headers: { 'x-total-count': '1' },
      });

      const result = await platformDataProvider.getList({
        resource: 'tenants',
        pagination: { current: 1, pageSize: 20 },
      });

      expect(platformApi.get).toHaveBeenCalledWith('/tenants', {
        params: {
          filter: expect.stringContaining('"limit":20'),
        },
      });
      expect(result.data).toHaveLength(1);
    });

    it('should handle wrapped response format', async () => {
      const { platformApi } = await import('@/lib/axios');
      const { platformDataProvider } = await import('@/providers/dataProvider');

      (platformApi.get as any).mockResolvedValue({
        data: {
          data: [{ id: '1' }, { id: '2' }],
          total: 50,
        },
        headers: {},
      });

      const result = await platformDataProvider.getList({
        resource: 'users',
      });

      expect(result.total).toBe(50);
      expect(result.data).toHaveLength(2);
    });

    it('should apply filters correctly', async () => {
      const { platformApi } = await import('@/lib/axios');
      const { platformDataProvider } = await import('@/providers/dataProvider');

      (platformApi.get as any).mockResolvedValue({
        data: [],
        headers: {},
      });

      await platformDataProvider.getList({
        resource: 'boms',
        filters: [
          { field: 'status', operator: 'eq', value: 'active' },
          { field: 'name', operator: 'contains', value: 'test' },
        ],
      });

      const callArgs = (platformApi.get as any).mock.calls[0];
      const filter = JSON.parse(callArgs[1].params.filter);

      expect(filter.where.status).toBe('active');
      expect(filter.where.name).toEqual({ like: '%test%' });
    });

    it('should apply sorting correctly', async () => {
      const { platformApi } = await import('@/lib/axios');
      const { platformDataProvider } = await import('@/providers/dataProvider');

      (platformApi.get as any).mockResolvedValue({
        data: [],
        headers: {},
      });

      await platformDataProvider.getList({
        resource: 'boms',
        sorters: [{ field: 'createdAt', order: 'desc' }],
      });

      const callArgs = (platformApi.get as any).mock.calls[0];
      const filter = JSON.parse(callArgs[1].params.filter);

      expect(filter.order).toContain('createdAt DESC');
    });
  });

  describe('getOne', () => {
    it('should fetch single resource by ID', async () => {
      const { platformApi } = await import('@/lib/axios');
      const { platformDataProvider } = await import('@/providers/dataProvider');

      (platformApi.get as any).mockResolvedValue({
        data: { id: '123', name: 'Test Tenant' },
      });

      const result = await platformDataProvider.getOne({
        resource: 'tenants',
        id: '123',
      });

      expect(platformApi.get).toHaveBeenCalledWith('/tenants/123', { params: {} });
      expect(result.data.id).toBe('123');
    });

    it('should include relations when specified', async () => {
      const { platformApi } = await import('@/lib/axios');
      const { platformDataProvider } = await import('@/providers/dataProvider');

      (platformApi.get as any).mockResolvedValue({
        data: { id: '123' },
      });

      await platformDataProvider.getOne({
        resource: 'boms',
        id: '123',
        meta: { include: ['lineItems'] },
      });

      const callArgs = (platformApi.get as any).mock.calls[0];
      expect(callArgs[1].params.filter).toContain('lineItems');
    });
  });

  describe('create', () => {
    it('should POST to resource endpoint', async () => {
      const { platformApi } = await import('@/lib/axios');
      const { platformDataProvider } = await import('@/providers/dataProvider');

      (platformApi.post as any).mockResolvedValue({
        data: { id: 'new-123', name: 'New Item' },
      });

      const result = await platformDataProvider.create({
        resource: 'invitations',
        variables: { email: 'test@example.com', roleKey: 'engineer' },
      });

      expect(platformApi.post).toHaveBeenCalledWith('/invitations', {
        email: 'test@example.com',
        roleKey: 'engineer',
      });
      expect(result.data.id).toBe('new-123');
    });
  });

  describe('update', () => {
    it('should PATCH resource by ID', async () => {
      const { platformApi } = await import('@/lib/axios');
      const { platformDataProvider } = await import('@/providers/dataProvider');

      (platformApi.patch as any).mockResolvedValue({
        data: { id: '123', name: 'Updated' },
      });

      const result = await platformDataProvider.update({
        resource: 'users',
        id: '123',
        variables: { name: 'Updated' },
      });

      expect(platformApi.patch).toHaveBeenCalledWith('/users/123', { name: 'Updated' });
      expect(result.data.name).toBe('Updated');
    });
  });

  describe('deleteOne', () => {
    it('should DELETE resource by ID', async () => {
      const { platformApi } = await import('@/lib/axios');
      const { platformDataProvider } = await import('@/providers/dataProvider');

      (platformApi.delete as any).mockResolvedValue({
        data: { id: '123' },
      });

      const result = await platformDataProvider.deleteOne({
        resource: 'invitations',
        id: '123',
      });

      expect(platformApi.delete).toHaveBeenCalledWith('/invitations/123');
      expect(result.data.id).toBe('123');
    });
  });

  describe('getMany', () => {
    it('should fetch multiple resources by IDs', async () => {
      const { platformApi } = await import('@/lib/axios');
      const { platformDataProvider } = await import('@/providers/dataProvider');

      (platformApi.get as any).mockResolvedValue({
        data: [{ id: '1' }, { id: '2' }],
      });

      const result = await platformDataProvider.getMany!({
        resource: 'users',
        ids: ['1', '2'],
      });

      const callArgs = (platformApi.get as any).mock.calls[0];
      const filter = JSON.parse(callArgs[1].params.filter);

      expect(filter.where.id.inq).toEqual(['1', '2']);
      expect(result.data).toHaveLength(2);
    });
  });

  describe('custom', () => {
    it('should make custom requests', async () => {
      const { platformApi } = await import('@/lib/axios');
      const { platformDataProvider } = await import('@/providers/dataProvider');

      (platformApi.request as any).mockResolvedValue({
        data: { success: true },
      });

      const result = await platformDataProvider.custom!({
        url: '/custom-endpoint',
        method: 'post',
        payload: { action: 'test' },
      });

      expect(platformApi.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'post',
          url: '/custom-endpoint',
          data: { action: 'test' },
        })
      );
      expect(result.data.success).toBe(true);
    });
  });
});

describe('Resource Provider Mapping', () => {
  it('should map boms to cns provider', async () => {
    const { resourceProviderMap } = await import('@/providers/dataProvider');
    expect(resourceProviderMap['boms']).toBe('cns');
  });

  it('should map components to supabase provider', async () => {
    const { resourceProviderMap } = await import('@/providers/dataProvider');
    expect(resourceProviderMap['components']).toBe('supabase');
  });

  it('should map users to platform provider', async () => {
    const { resourceProviderMap } = await import('@/providers/dataProvider');
    expect(resourceProviderMap['users']).toBe('platform');
  });

  it('should default unknown resources to platform provider', async () => {
    const { getProviderForResource, dataProviders } = await import('@/providers/dataProvider');
    const provider = getProviderForResource('unknown-resource');
    expect(provider).toBe(dataProviders['default']);
  });
});
