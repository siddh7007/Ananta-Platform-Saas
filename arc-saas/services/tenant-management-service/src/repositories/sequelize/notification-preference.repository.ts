import {Getter, inject} from '@loopback/core';
import {Entity} from '@loopback/repository';
import {SequelizeDataSource} from '@loopback/sequelize';
import {SequelizeUserModifyCrudRepository} from '@sourceloop/core/sequelize';
import {IAuthUserWithPermissions} from '@sourceloop/core';
import {AuthenticationBindings} from 'loopback4-authentication';

import {
  NotificationPreference,
  NotificationPreferenceRelations,
  NotificationCategory,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from '../../models/notification-preference.model';
import {TenantManagementDbSourceName} from '../../types';

/**
 * Repository for tenant notification preferences.
 * Provides helper methods for retrieving and managing notification channel settings.
 */
export class NotificationPreferenceRepository<
  T extends NotificationPreference = NotificationPreference,
> extends SequelizeUserModifyCrudRepository<
  T,
  typeof NotificationPreference.prototype.id,
  NotificationPreferenceRelations
> {
  constructor(
    @inject(`datasources.${TenantManagementDbSourceName}`)
    dataSource: SequelizeDataSource,
    @inject.getter(AuthenticationBindings.CURRENT_USER)
    public readonly getCurrentUser: Getter<IAuthUserWithPermissions>,
    @inject('models.NotificationPreference')
    private readonly notificationPreference: typeof Entity & {prototype: T},
  ) {
    super(notificationPreference as any, dataSource, getCurrentUser);
  }

  /**
   * Get all preferences for a tenant.
   */
  async findByTenantId(tenantId: string): Promise<T[]> {
    return this.find({where: {tenantId} as any});
  }

  /**
   * Get preference for a specific tenant and category.
   */
  async findByTenantAndCategory(
    tenantId: string,
    category: NotificationCategory,
  ): Promise<T | null> {
    return this.findOne({
      where: {tenantId, category} as any,
    });
  }

  /**
   * Get preference for a tenant and category, or return default if not set.
   * This is the main method used by notification services.
   */
  async getEffectivePreference(
    tenantId: string,
    category: NotificationCategory,
  ): Promise<T> {
    const preference = await this.findByTenantAndCategory(tenantId, category);

    if (preference) {
      return preference;
    }

    // Return a default preference object (not persisted)
    const defaults = DEFAULT_NOTIFICATION_PREFERENCES[category];
    return {
      id: '',
      tenantId,
      category,
      emailEnabled: defaults.emailEnabled,
      smsEnabled: defaults.smsEnabled,
      pushEnabled: defaults.pushEnabled,
      inAppEnabled: defaults.inAppEnabled,
      webhookEnabled: defaults.webhookEnabled,
    } as T;
  }

  /**
   * Get all effective preferences for a tenant (with defaults for missing categories).
   */
  async getAllEffectivePreferences(tenantId: string): Promise<T[]> {
    const existingPrefs = await this.findByTenantId(tenantId);
    const existingCategories = new Set(existingPrefs.map(p => p.category));

    const allPrefs: T[] = [...existingPrefs];

    // Add defaults for categories that don't have explicit settings
    for (const category of Object.values(NotificationCategory)) {
      if (!existingCategories.has(category)) {
        const defaults = DEFAULT_NOTIFICATION_PREFERENCES[category];
        allPrefs.push({
          id: '',
          tenantId,
          category,
          emailEnabled: defaults.emailEnabled,
          smsEnabled: defaults.smsEnabled,
          pushEnabled: defaults.pushEnabled,
          inAppEnabled: defaults.inAppEnabled,
          webhookEnabled: defaults.webhookEnabled,
        } as T);
      }
    }

    return allPrefs;
  }

  /**
   * Create or update preference for a tenant and category.
   */
  async upsertPreference(
    tenantId: string,
    category: NotificationCategory,
    data: Partial<Omit<T, 'id' | 'tenantId' | 'category'>>,
  ): Promise<T> {
    const existing = await this.findByTenantAndCategory(tenantId, category);

    if (existing) {
      await this.updateById(existing.id, data as any);
      return this.findById(existing.id);
    }

    return this.create({
      tenantId,
      category,
      ...data,
    } as any);
  }

  /**
   * Bulk update preferences for a tenant.
   */
  async bulkUpsertPreferences(
    tenantId: string,
    preferences: Array<{
      category: NotificationCategory;
      emailEnabled?: boolean;
      smsEnabled?: boolean;
      pushEnabled?: boolean;
      inAppEnabled?: boolean;
      webhookEnabled?: boolean;
      webhookUrl?: string;
    }>,
  ): Promise<T[]> {
    const results: T[] = [];

    for (const pref of preferences) {
      const result = await this.upsertPreference(tenantId, pref.category, {
        emailEnabled: pref.emailEnabled,
        smsEnabled: pref.smsEnabled,
        pushEnabled: pref.pushEnabled,
        inAppEnabled: pref.inAppEnabled,
        webhookEnabled: pref.webhookEnabled,
        webhookUrl: pref.webhookUrl,
      } as any);
      results.push(result);
    }

    return results;
  }

  /**
   * Delete all preferences for a tenant (e.g., when tenant is deleted).
   */
  async deleteByTenantId(tenantId: string): Promise<number> {
    const result = await this.deleteAll({tenantId} as any);
    return result.count;
  }
}
