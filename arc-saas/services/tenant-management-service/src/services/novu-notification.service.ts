import {injectable, BindingScope, inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {Novu} from '@novu/api';
import {
  NotificationCategory,
  NotificationChannel,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from '../models/notification-preference.model';
import {NotificationPreferenceRepository} from '../repositories/sequelize';

/**
 * Channel configuration for a notification workflow
 */
interface ChannelConfig {
  email?: boolean;
  sms?: boolean;
  push?: boolean;
  inApp?: boolean;
  webhook?: boolean;
}

/**
 * Service for sending notifications via Novu.
 * Checks tenant notification preferences before sending.
 * Supports multi-channel notifications (email, SMS, push, in-app, webhook).
 */
@injectable({scope: BindingScope.SINGLETON})
export class NovuNotificationService {
  private client: Novu | null = null;
  private enabled: boolean;
  private apiKey: string;
  private backendUrl: string;

  constructor(
    @repository(NotificationPreferenceRepository)
    private readonly preferenceRepository?: NotificationPreferenceRepository,
  ) {
    this.enabled = process.env.NOVU_ENABLED === 'true';
    this.apiKey = process.env.NOVU_API_KEY || '';
    this.backendUrl = process.env.NOVU_BACKEND_URL || 'http://localhost:3100';
  }

  /**
   * Check if Novu is enabled and configured
   */
  isEnabled(): boolean {
    return this.enabled && !!this.apiKey;
  }

  /**
   * Get or create Novu client
   */
  private getClient(): Novu {
    if (!this.isEnabled()) {
      throw new Error(
        'Novu is not enabled. Set NOVU_ENABLED=true and configure NOVU_API_KEY',
      );
    }

    if (!this.client) {
      this.client = new Novu({
        secretKey: this.apiKey,
        serverURL: this.backendUrl,
      });
    }

    return this.client;
  }

  /**
   * Generate a subscriber ID for a tenant user
   */
  generateSubscriberId(tenantId: string, email: string): string {
    const sanitizedEmail = email.replace(/[^a-zA-Z0-9]/g, '_');
    return `tenant-${tenantId}-${sanitizedEmail}`;
  }

  /**
   * Create or update a subscriber in Novu
   */
  async upsertSubscriber(
    subscriberId: string,
    data: {
      email: string;
      firstName?: string;
      lastName?: string;
      tenantId?: string;
    },
  ): Promise<void> {
    const client = this.getClient();

    try {
      await client.subscribers.create({
        subscriberId,
        email: data.email,
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        data: {
          tenantId: data.tenantId,
        },
      });
    } catch (error) {
      // Subscriber may already exist, log but don't throw
      console.debug('Subscriber upsert note:', {
        subscriberId,
        note: error instanceof Error ? error.message : 'May already exist',
      });
    }
  }

  /**
   * Get effective channel configuration for a tenant and category
   * Returns default preferences if repository is not available or tenant hasn't configured preferences
   */
  async getEffectiveChannelConfig(
    tenantId: string,
    category: NotificationCategory,
  ): Promise<ChannelConfig> {
    if (!this.preferenceRepository) {
      // Return defaults if repository not available
      const defaults = DEFAULT_NOTIFICATION_PREFERENCES[category];
      return {
        email: defaults.emailEnabled,
        sms: defaults.smsEnabled,
        push: defaults.pushEnabled,
        inApp: defaults.inAppEnabled,
        webhook: defaults.webhookEnabled,
      };
    }

    try {
      const preference = await this.preferenceRepository.getEffectivePreference(
        tenantId,
        category,
      );
      return {
        email: preference.emailEnabled,
        sms: preference.smsEnabled,
        push: preference.pushEnabled,
        inApp: preference.inAppEnabled,
        webhook: preference.webhookEnabled,
      };
    } catch (error) {
      console.warn('Failed to get notification preferences, using defaults', {
        tenantId,
        category,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      // Return defaults on error
      const defaults = DEFAULT_NOTIFICATION_PREFERENCES[category];
      return {
        email: defaults.emailEnabled,
        sms: defaults.smsEnabled,
        push: defaults.pushEnabled,
        inApp: defaults.inAppEnabled,
        webhook: defaults.webhookEnabled,
      };
    }
  }

  /**
   * Check if a specific channel is enabled for a tenant and category
   */
  async isChannelEnabled(
    tenantId: string,
    category: NotificationCategory,
    channel: NotificationChannel,
  ): Promise<boolean> {
    const config = await this.getEffectiveChannelConfig(tenantId, category);
    switch (channel) {
      case NotificationChannel.EMAIL:
        return config.email ?? true;
      case NotificationChannel.SMS:
        return config.sms ?? false;
      case NotificationChannel.PUSH:
        return config.push ?? false;
      case NotificationChannel.IN_APP:
        return config.inApp ?? true;
      case NotificationChannel.WEBHOOK:
        return config.webhook ?? false;
      default:
        return false;
    }
  }

  /**
   * Send a notification via Novu (basic - no preference checking)
   * For backwards compatibility and system notifications that should always be sent.
   */
  async sendNotification(input: {
    workflowId: string;
    tenantId: string;
    recipient: {
      email: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
    };
    payload: Record<string, unknown>;
  }): Promise<{success: boolean; transactionId?: string; error?: string}> {
    if (!this.isEnabled()) {
      console.warn('Novu not enabled, skipping notification', {
        workflowId: input.workflowId,
        tenantId: input.tenantId,
      });
      return {
        success: true,
        transactionId: 'skipped-novu-disabled',
      };
    }

    const client = this.getClient();
    const subscriberId = this.generateSubscriberId(
      input.tenantId,
      input.recipient.email,
    );

    try {
      // Upsert subscriber first
      await this.upsertSubscriber(subscriberId, {
        email: input.recipient.email,
        firstName: input.recipient.firstName,
        lastName: input.recipient.lastName,
        tenantId: input.tenantId,
      });

      // Trigger the notification
      const response = await client.trigger({
        workflowId: input.workflowId,
        to: {
          subscriberId,
          email: input.recipient.email,
        },
        payload: {
          ...input.payload,
          tenantId: input.tenantId,
        },
      });

      const transactionId = response.result?.transactionId;

      console.info('Notification sent via Novu', {
        workflowId: input.workflowId,
        transactionId,
        tenantId: input.tenantId,
      });

      return {
        success: true,
        transactionId: transactionId || 'novu-triggered',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to send notification via Novu', {
        workflowId: input.workflowId,
        tenantId: input.tenantId,
        error: message,
      });
      return {
        success: false,
        error: message,
      };
    }
  }

  /**
   * Send a notification with tenant preference checking.
   * Only sends if the tenant has enabled the category for at least one channel.
   *
   * @param input - Notification details
   * @param category - The notification category (billing, subscription, etc.)
   * @returns Result including which channels were used
   */
  async sendWithPreferences(input: {
    workflowId: string;
    tenantId: string;
    category: NotificationCategory;
    recipient: {
      email: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
    };
    payload: Record<string, unknown>;
  }): Promise<{
    success: boolean;
    transactionId?: string;
    error?: string;
    channelsUsed: NotificationChannel[];
    skippedReason?: string;
  }> {
    const channelConfig = await this.getEffectiveChannelConfig(
      input.tenantId,
      input.category,
    );

    // Check if any channel is enabled
    const enabledChannels: NotificationChannel[] = [];
    if (channelConfig.email) enabledChannels.push(NotificationChannel.EMAIL);
    if (channelConfig.sms) enabledChannels.push(NotificationChannel.SMS);
    if (channelConfig.push) enabledChannels.push(NotificationChannel.PUSH);
    if (channelConfig.inApp) enabledChannels.push(NotificationChannel.IN_APP);
    if (channelConfig.webhook) enabledChannels.push(NotificationChannel.WEBHOOK);

    if (enabledChannels.length === 0) {
      console.info('All channels disabled for category, skipping notification', {
        workflowId: input.workflowId,
        tenantId: input.tenantId,
        category: input.category,
      });
      return {
        success: true,
        channelsUsed: [],
        skippedReason: `All channels disabled for category: ${input.category}`,
      };
    }

    if (!this.isEnabled()) {
      console.warn('Novu not enabled, skipping notification', {
        workflowId: input.workflowId,
        tenantId: input.tenantId,
      });
      return {
        success: true,
        transactionId: 'skipped-novu-disabled',
        channelsUsed: [],
        skippedReason: 'Novu is disabled',
      };
    }

    const client = this.getClient();
    const subscriberId = this.generateSubscriberId(
      input.tenantId,
      input.recipient.email,
    );

    try {
      // Upsert subscriber first
      await this.upsertSubscriber(subscriberId, {
        email: input.recipient.email,
        firstName: input.recipient.firstName,
        lastName: input.recipient.lastName,
        tenantId: input.tenantId,
      });

      // Build subscriber data for Novu trigger
      const toPayload: {
        subscriberId: string;
        email?: string;
        phone?: string;
      } = {
        subscriberId,
      };
      if (channelConfig.email && input.recipient.email) {
        toPayload.email = input.recipient.email;
      }
      if (channelConfig.sms && input.recipient.phone) {
        toPayload.phone = input.recipient.phone;
      }

      // Trigger the notification with channel-specific overrides
      const response = await client.trigger({
        workflowId: input.workflowId,
        to: toPayload as any,
        payload: {
          ...input.payload,
          tenantId: input.tenantId,
          category: input.category,
          enabledChannels: enabledChannels,
        },
        // Novu handles channel routing based on workflow steps
        // We pass channel info in payload for any conditional logic in templates
      });

      const transactionId = response.result?.transactionId;

      console.info('Notification sent via Novu with preferences', {
        workflowId: input.workflowId,
        transactionId,
        tenantId: input.tenantId,
        category: input.category,
        channelsUsed: enabledChannels,
      });

      return {
        success: true,
        transactionId: transactionId || 'novu-triggered',
        channelsUsed: enabledChannels,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to send notification via Novu', {
        workflowId: input.workflowId,
        tenantId: input.tenantId,
        category: input.category,
        error: message,
      });
      return {
        success: false,
        error: message,
        channelsUsed: [],
      };
    }
  }

  /**
   * Helper method to map workflow IDs to notification categories
   * This is used to automatically determine the category for preference checking
   */
  getWorkflowCategory(workflowId: string): NotificationCategory {
    // Billing-related workflows
    if (
      workflowId.includes('payment') ||
      workflowId.includes('invoice') ||
      workflowId.includes('billing')
    ) {
      return NotificationCategory.BILLING;
    }

    // Subscription-related workflows
    if (
      workflowId.includes('subscription') ||
      workflowId.includes('plan') ||
      workflowId.includes('trial')
    ) {
      return NotificationCategory.SUBSCRIPTION;
    }

    // User-related workflows
    if (
      workflowId.includes('user') ||
      workflowId.includes('invitation') ||
      workflowId.includes('welcome')
    ) {
      return NotificationCategory.USER;
    }

    // Security-related workflows
    if (
      workflowId.includes('security') ||
      workflowId.includes('password') ||
      workflowId.includes('login') ||
      workflowId.includes('mfa')
    ) {
      return NotificationCategory.SECURITY;
    }

    // Workflow-related (provisioning, etc.)
    if (
      workflowId.includes('workflow') ||
      workflowId.includes('provisioning') ||
      workflowId.includes('tenant-created')
    ) {
      return NotificationCategory.WORKFLOW;
    }

    // Default to system for unrecognized workflows
    return NotificationCategory.SYSTEM;
  }
}
