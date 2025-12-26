import { describe, it, expect, beforeEach } from 'vitest';
import { createCacheManager } from '../../lib/auth';

describe('Auth utilities', () => {
  describe('createCacheManager', () => {
    let cacheManager: ReturnType<typeof createCacheManager>;

    beforeEach(() => {
      cacheManager = createCacheManager();
    });

    it('should create a cache manager instance', () => {
      expect(cacheManager).toBeDefined();
      expect(cacheManager.getCachedTenantId).toBeInstanceOf(Function);
      expect(cacheManager.setCachedTenantId).toBeInstanceOf(Function);
      expect(cacheManager.getCachedSuperAdmin).toBeInstanceOf(Function);
      expect(cacheManager.setCachedSuperAdmin).toBeInstanceOf(Function);
      expect(cacheManager.clearCache).toBeInstanceOf(Function);
    });

    it('should store and retrieve tenant ID', () => {
      cacheManager.setCachedTenantId('tenant-123');
      expect(cacheManager.getCachedTenantId()).toBe('tenant-123');
    });

    it('should store and retrieve super admin status', () => {
      cacheManager.setCachedSuperAdmin(true);
      expect(cacheManager.getCachedSuperAdmin()).toBe(true);
    });

    it('should return null for empty cache', () => {
      expect(cacheManager.getCachedTenantId()).toBeNull();
      expect(cacheManager.getCachedSuperAdmin()).toBeNull();
    });

    it('should clear all cached values', () => {
      cacheManager.setCachedTenantId('tenant-123');
      cacheManager.setCachedSuperAdmin(true);

      cacheManager.clearCache();

      expect(cacheManager.getCachedTenantId()).toBeNull();
      expect(cacheManager.getCachedSuperAdmin()).toBeNull();
    });

    it('should maintain separate state for different instances', () => {
      const cache1 = createCacheManager();
      const cache2 = createCacheManager();

      cache1.setCachedTenantId('tenant-1');
      cache2.setCachedTenantId('tenant-2');

      expect(cache1.getCachedTenantId()).toBe('tenant-1');
      expect(cache2.getCachedTenantId()).toBe('tenant-2');
    });

    it('should overwrite previous tenant ID', () => {
      cacheManager.setCachedTenantId('tenant-1');
      cacheManager.setCachedTenantId('tenant-2');

      expect(cacheManager.getCachedTenantId()).toBe('tenant-2');
    });

    it('should handle boolean false for super admin', () => {
      cacheManager.setCachedSuperAdmin(false);
      expect(cacheManager.getCachedSuperAdmin()).toBe(false);
    });

    it('should allow re-setting values after clear', () => {
      cacheManager.setCachedTenantId('tenant-1');
      cacheManager.clearCache();
      cacheManager.setCachedTenantId('tenant-2');

      expect(cacheManager.getCachedTenantId()).toBe('tenant-2');
    });
  });

  describe('Cache isolation', () => {
    it('should create isolated cache instances', () => {
      const cache1 = createCacheManager();
      const cache2 = createCacheManager();

      cache1.setCachedTenantId('tenant-1');
      cache1.setCachedSuperAdmin(true);

      // cache2 should have empty cache
      expect(cache2.getCachedTenantId()).toBeNull();
      expect(cache2.getCachedSuperAdmin()).toBeNull();
    });

    it('should not share state between instances', () => {
      const cache1 = createCacheManager();
      const cache2 = createCacheManager();

      cache1.setCachedTenantId('tenant-1');
      cache2.clearCache();

      // cache1 should still have its value
      expect(cache1.getCachedTenantId()).toBe('tenant-1');
    });
  });
});
