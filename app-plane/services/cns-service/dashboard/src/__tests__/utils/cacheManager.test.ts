import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getCachedTenantId,
  setCachedTenantId,
  getCachedSuperAdmin,
  setCachedSuperAdmin,
  clearCache,
} from '../../cacheManager';

describe('cacheManager', () => {
  beforeEach(() => {
    // Clear cache before each test
    clearCache();
  });

  describe('tenant caching', () => {
    it('should store and retrieve tenant ID', () => {
      const tenantId = 'test-tenant-123';
      setCachedTenantId(tenantId);
      expect(getCachedTenantId()).toBe(tenantId);
    });

    it('should return null when no tenant ID is cached', () => {
      expect(getCachedTenantId()).toBeNull();
    });

    it('should overwrite previous tenant ID', () => {
      setCachedTenantId('tenant-1');
      setCachedTenantId('tenant-2');
      expect(getCachedTenantId()).toBe('tenant-2');
    });
  });

  describe('super admin caching', () => {
    it('should store and retrieve super admin status', () => {
      setCachedSuperAdmin(true);
      expect(getCachedSuperAdmin()).toBe(true);
    });

    it('should return null when no super admin status is cached', () => {
      expect(getCachedSuperAdmin()).toBeNull();
    });

    it('should handle false value correctly', () => {
      setCachedSuperAdmin(false);
      expect(getCachedSuperAdmin()).toBe(false);
    });
  });

  describe('cache clearing', () => {
    it('should clear all cached data', () => {
      setCachedTenantId('test-tenant');
      setCachedSuperAdmin(true);

      clearCache();

      expect(getCachedTenantId()).toBeNull();
      expect(getCachedSuperAdmin()).toBeNull();
    });

    it('should allow re-caching after clear', () => {
      setCachedTenantId('tenant-1');
      clearCache();
      setCachedTenantId('tenant-2');

      expect(getCachedTenantId()).toBe('tenant-2');
    });
  });
});
