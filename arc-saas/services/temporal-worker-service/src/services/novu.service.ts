/**
 * Novu Notification Service
 *
 * Standalone Novu client service that can be used outside of Temporal activities.
 * This provides the same notification capabilities without Temporal-specific context.
 *
 * Usage:
 *   import { NovuService } from './services/novu.service';
 *   const novuService = new NovuService();
 *   await novuService.sendNotification({ ... });
 */

import { Novu } from '@novu/api';
import { config, NovuConfig } from '../config';
import { NotificationType } from '../types/common.types';
import { createLogger } from '../utils/logger';

const logger = createLogger('novu-service');

export interface NovuNotificationInput {
  type: NotificationType | string;
  tenantId: string;
  recipient: {
    email: string;
    firstName?: string;
    lastName?: string;
  };
  payload: Record<string, unknown>;
}

export interface NovuNotificationResult {
  success: boolean;
  transactionId?: string;
  subscriberId?: string;
  error?: string;
}

export class NovuService {
  private client: Novu | null = null;
  private config: NovuConfig;

  constructor(novuConfig?: Partial<NovuConfig>) {
    this.config = {
      ...config.novu,
      ...novuConfig,
    };
  }

  /**
   * Check if Novu is enabled and configured
   */
  isEnabled(): boolean {
    return this.config.enabled && !!this.config.apiKey;
  }

  /**
   * Get or create Novu client
   */
  private getClient(): Novu {
    if (!this.isEnabled()) {
      throw new Error(
        'Novu is not enabled. Set NOVU_ENABLED=true and configure NOVU_API_KEY'
      );
    }

    if (!this.client) {
      this.client = new Novu({
        secretKey: this.config.apiKey,
        serverURL: this.config.backendUrl,
      });
      logger.debug('Novu client initialized', {
        backendUrl: this.config.backendUrl,
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
    }
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
      logger.debug('Subscriber upserted', { subscriberId });
    } catch (error) {
      // Subscriber may already exist, log but don't throw
      logger.debug('Subscriber upsert note', {
        subscriberId,
        note: error instanceof Error ? error.message : 'May already exist',
      });
    }
  }

  /**
   * Send a notification via Novu
   */
  async sendNotification(
    input: NovuNotificationInput
  ): Promise<NovuNotificationResult> {
    if (!this.isEnabled()) {
      logger.warn('Novu not enabled, skipping notification', {
        type: input.type,
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
      input.recipient.email
    );

    try {
      // Upsert subscriber first
      await this.upsertSubscriber(subscriberId, {
        email: input.recipient.email,
        firstName: input.recipient.firstName,
        lastName: input.recipient.lastName,
        tenantId: input.tenantId,
      });

      // Get the template/workflow ID based on type
      const workflowId = this.getWorkflowId(input.type);

      // Trigger the notification
      const response = await client.trigger({
        workflowId,
        to: {
          subscriberId,
          email: input.recipient.email,
        },
        payload: {
          ...input.payload,
          tenantId: input.tenantId,
          supportEmail: this.config.supportEmail,
        },
      });

      const transactionId = response.result?.transactionId;

      logger.info('Notification sent via Novu', {
        type: input.type,
        workflowId,
        transactionId,
        tenantId: input.tenantId,
      });

      return {
        success: true,
        transactionId: transactionId || 'novu-triggered',
        subscriberId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to send notification via Novu', {
        type: input.type,
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
   * Get the Novu workflow/template ID for a notification type
   */
  private getWorkflowId(type: NotificationType | string): string {
    switch (type) {
      case NotificationType.WelcomeTenant:
        return this.config.templates.welcome;
      case NotificationType.ProvisioningFailed:
        return this.config.templates.provisioningFailed;
      case NotificationType.Deprovisioning:
        return this.config.templates.deprovisioning;
      default:
        // Allow custom workflow IDs to be passed directly
        return type;
    }
  }

  /**
   * Send a bulk notification to multiple recipients
   */
  async sendBulkNotification(
    type: NotificationType | string,
    tenantId: string,
    recipients: Array<{
      email: string;
      firstName?: string;
      lastName?: string;
      payload?: Record<string, unknown>;
    }>,
    commonPayload?: Record<string, unknown>
  ): Promise<NovuNotificationResult[]> {
    const results: NovuNotificationResult[] = [];

    for (const recipient of recipients) {
      const result = await this.sendNotification({
        type,
        tenantId,
        recipient,
        payload: {
          ...commonPayload,
          ...recipient.payload,
        },
      });
      results.push(result);
    }

    return results;
  }

  /**
   * Send an in-app notification to a specific subscriber
   */
  async sendInAppNotification(
    subscriberId: string,
    workflowId: string,
    payload: Record<string, unknown>
  ): Promise<NovuNotificationResult> {
    if (!this.isEnabled()) {
      return {
        success: true,
        transactionId: 'skipped-novu-disabled',
      };
    }

    const client = this.getClient();

    try {
      const response = await client.trigger({
        workflowId,
        to: {
          subscriberId,
        },
        payload,
      });

      return {
        success: true,
        transactionId: response.result?.transactionId || 'novu-triggered',
        subscriberId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: message,
      };
    }
  }
}

// Export a singleton instance for convenience
export const novuService = new NovuService();
