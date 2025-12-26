import {model, property} from '@loopback/repository';
import {UserModifiableEntity} from '@sourceloop/core';

/**
 * Supported notification channels.
 */
export enum NotificationChannel {
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push',
  IN_APP = 'in_app',
  WEBHOOK = 'webhook',
}

/**
 * Notification categories for grouping preferences.
 */
export enum NotificationCategory {
  BILLING = 'billing',
  SUBSCRIPTION = 'subscription',
  USER = 'user',
  SYSTEM = 'system',
  SECURITY = 'security',
  WORKFLOW = 'workflow',
}

/**
 * NotificationPreference model for tenant-level notification channel configuration.
 * Allows tenants to enable/disable specific notification channels for different categories.
 *
 * Example usage:
 * - A tenant might want billing notifications via email only
 * - A tenant might want user notifications via email and in-app
 * - A tenant might disable SMS entirely
 */
@model({
  name: 'notification_preferences',
  description: 'Tenant notification channel preferences',
  settings: {
    indexes: {
      idx_notification_pref_tenant_category: {
        keys: {tenant_id: 1, category: 1},
        options: {unique: true},
      },
    },
  },
})
export class NotificationPreference extends UserModifiableEntity {
  @property({
    type: 'string',
    id: true,
    generated: true,
    postgresql: {
      dataType: 'uuid',
    },
  })
  id: string;

  @property({
    type: 'string',
    required: true,
    name: 'tenant_id',
    postgresql: {
      dataType: 'uuid',
    },
    description: 'Tenant this preference belongs to',
  })
  tenantId: string;

  @property({
    type: 'string',
    required: true,
    name: 'category',
    jsonSchema: {
      enum: Object.values(NotificationCategory),
    },
    description: 'Notification category (billing, subscription, user, etc.)',
  })
  category: NotificationCategory;

  @property({
    type: 'boolean',
    name: 'email_enabled',
    default: true,
    description: 'Whether email notifications are enabled for this category',
  })
  emailEnabled?: boolean;

  @property({
    type: 'boolean',
    name: 'sms_enabled',
    default: false,
    description: 'Whether SMS notifications are enabled for this category',
  })
  smsEnabled?: boolean;

  @property({
    type: 'boolean',
    name: 'push_enabled',
    default: false,
    description: 'Whether push notifications are enabled for this category',
  })
  pushEnabled?: boolean;

  @property({
    type: 'boolean',
    name: 'in_app_enabled',
    default: true,
    description: 'Whether in-app notifications are enabled for this category',
  })
  inAppEnabled?: boolean;

  @property({
    type: 'boolean',
    name: 'webhook_enabled',
    default: false,
    description: 'Whether webhook notifications are enabled for this category',
  })
  webhookEnabled?: boolean;

  @property({
    type: 'string',
    name: 'webhook_url',
    description: 'Custom webhook URL for notifications (if webhook_enabled)',
  })
  webhookUrl?: string;

  @property({
    type: 'object',
    name: 'channel_config',
    description: 'Additional channel-specific configuration (JSON)',
    postgresql: {
      dataType: 'jsonb',
    },
  })
  channelConfig?: Record<string, unknown>;

  constructor(data?: Partial<NotificationPreference>) {
    super(data);
  }

  /**
   * Get list of enabled channels for this preference.
   */
  getEnabledChannels(): NotificationChannel[] {
    const channels: NotificationChannel[] = [];
    if (this.emailEnabled) channels.push(NotificationChannel.EMAIL);
    if (this.smsEnabled) channels.push(NotificationChannel.SMS);
    if (this.pushEnabled) channels.push(NotificationChannel.PUSH);
    if (this.inAppEnabled) channels.push(NotificationChannel.IN_APP);
    if (this.webhookEnabled) channels.push(NotificationChannel.WEBHOOK);
    return channels;
  }

  /**
   * Check if a specific channel is enabled.
   */
  isChannelEnabled(channel: NotificationChannel): boolean {
    switch (channel) {
      case NotificationChannel.EMAIL:
        return this.emailEnabled ?? true;
      case NotificationChannel.SMS:
        return this.smsEnabled ?? false;
      case NotificationChannel.PUSH:
        return this.pushEnabled ?? false;
      case NotificationChannel.IN_APP:
        return this.inAppEnabled ?? true;
      case NotificationChannel.WEBHOOK:
        return this.webhookEnabled ?? false;
      default:
        return false;
    }
  }
}

export interface NotificationPreferenceRelations {}

export type NotificationPreferenceWithRelations = NotificationPreference &
  NotificationPreferenceRelations;

/**
 * Default notification preferences when a tenant doesn't have explicit settings.
 * Email and in-app are enabled by default; SMS, push, and webhook are disabled.
 */
export const DEFAULT_NOTIFICATION_PREFERENCES: Record<
  NotificationCategory,
  Pick<NotificationPreference, 'emailEnabled' | 'smsEnabled' | 'pushEnabled' | 'inAppEnabled' | 'webhookEnabled'>
> = {
  [NotificationCategory.BILLING]: {
    emailEnabled: true,
    smsEnabled: false,
    pushEnabled: false,
    inAppEnabled: true,
    webhookEnabled: false,
  },
  [NotificationCategory.SUBSCRIPTION]: {
    emailEnabled: true,
    smsEnabled: false,
    pushEnabled: false,
    inAppEnabled: true,
    webhookEnabled: false,
  },
  [NotificationCategory.USER]: {
    emailEnabled: true,
    smsEnabled: false,
    pushEnabled: false,
    inAppEnabled: true,
    webhookEnabled: false,
  },
  [NotificationCategory.SYSTEM]: {
    emailEnabled: true,
    smsEnabled: false,
    pushEnabled: false,
    inAppEnabled: true,
    webhookEnabled: false,
  },
  [NotificationCategory.SECURITY]: {
    emailEnabled: true,
    smsEnabled: true, // Security notifications may use SMS for MFA
    pushEnabled: false,
    inAppEnabled: true,
    webhookEnabled: false,
  },
  [NotificationCategory.WORKFLOW]: {
    emailEnabled: true,
    smsEnabled: false,
    pushEnabled: false,
    inAppEnabled: true,
    webhookEnabled: false,
  },
};
