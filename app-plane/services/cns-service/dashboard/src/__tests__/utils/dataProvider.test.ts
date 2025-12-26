import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dataProvider } from '../../dataProvider';

// Mock fetch globally
global.fetch = vi.fn();

describe('dataProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getList', () => {
    it('should fetch a list of resources', async () => {
      const mockResponse = {
        data: [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' },
        ],
        total: 2,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-range': 'items 0-1/2' }),
        json: async () => mockResponse.data,
      });

      const result = await dataProvider.getList('items', {
        pagination: { page: 1, perPage: 10 },
        sort: { field: 'id', order: 'ASC' },
        filter: {},
      });

      expect(result.data).toEqual(mockResponse.data);
      expect(result.total).toBe(2);
    });

    it('should handle pagination parameters', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-range': 'items 20-29/100' }),
        json: async () => [],
      });

      await dataProvider.getList('items', {
        pagination: { page: 3, perPage: 10 },
        sort: { field: 'name', order: 'DESC' },
        filter: {},
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('_start=20'),
        expect.any(Object)
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('_end=30'),
        expect.any(Object)
      );
    });

    it('should handle sort parameters', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => [],
      });

      await dataProvider.getList('items', {
        pagination: { page: 1, perPage: 10 },
        sort: { field: 'name', order: 'DESC' },
        filter: {},
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('_sort=name'),
        expect.any(Object)
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('_order=DESC'),
        expect.any(Object)
      );
    });
  });

  describe('getOne', () => {
    it('should fetch a single resource', async () => {
      const mockItem = { id: 1, name: 'Item 1' };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockItem,
      });

      const result = await dataProvider.getOne('items', { id: '1' });

      expect(result.data).toEqual(mockItem);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/items/1'),
        expect.any(Object)
      );
    });
  });

  describe('create', () => {
    it('should create a new resource', async () => {
      const newItem = { name: 'New Item' };
      const createdItem = { id: 3, ...newItem };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => createdItem,
      });

      const result = await dataProvider.create('items', { data: newItem });

      expect(result.data).toEqual(createdItem);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/items'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(newItem),
        })
      );
    });
  });

  describe('update', () => {
    it('should update an existing resource', async () => {
      const updatedItem = { id: 1, name: 'Updated Item' };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => updatedItem,
      });

      const result = await dataProvider.update('items', {
        id: '1',
        data: updatedItem,
        previousData: { id: 1, name: 'Old Item' },
      });

      expect(result.data).toEqual(updatedItem);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/items/1'),
        expect.objectContaining({
          method: 'PUT',
        })
      );
    });
  });

  describe('delete', () => {
    it('should delete a resource', async () => {
      const deletedItem = { id: 1 };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => deletedItem,
      });

      const result = await dataProvider.delete('items', {
        id: '1',
        previousData: { id: 1, name: 'Item to delete' },
      });

      expect(result.data).toEqual(deletedItem);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/items/1'),
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });

  describe('error handling', () => {
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

    it('should handle HTTP errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: 'Resource not found' }),
      });

      await expect(
        dataProvider.getOne('items', { id: '999' })
      ).rejects.toThrow();
    });
  });
});
