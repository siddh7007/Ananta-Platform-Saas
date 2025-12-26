/**
 * Notification Activities
 *
 * Handles notifications via Novu (self-hosted).
 *
 * Novu provides:
 * - Email, SMS, Push, In-App, Chat notifications
 * - Subscriber management
 * - Template management via UI
 * - Delivery tracking and analytics
 * - Digest and delay features
 * - Multi-channel workflows
 *
 * Self-hosted Novu: https://docs.novu.co/self-hosting-novu/introduction
 */

import { Context } from '@temporalio/activity';
import { Novu } from '@novu/api';
import { config } from '../config';
import {
  SendEmailInput,
  SendWelcomeEmailInput,
  SendProvisioningFailedEmailInput,
  NotificationResult,
} from '../types';
import { Contact } from '../types/common.types';
import { createLogger } from '../utils/logger';
import { createActivityTracer } from '../observability/activity-tracer';
import { ServiceUnavailableError, InvalidConfigurationError } from '../utils/errors';

const logger = createLogger('notification-activities');

// ============================================
// Novu Client (Self-Hosted)
// ============================================

let novuClient: Novu | null = null;

function getNovuClient(): Novu {
  if (!config.novu.enabled) {
    throw new InvalidConfigurationError(
      'Novu is not enabled. Set NOVU_ENABLED=true and configure NOVU_API_KEY and NOVU_BACKEND_URL'
    );
  }

  if (!novuClient) {
    logger.debug('Initializing Novu client', {
      backendUrl: config.novu.backendUrl,
    });

    novuClient = new Novu({
      secretKey: config.novu.apiKey,
      serverURL: config.novu.backendUrl,
    });
  }

  return novuClient;
}

// ============================================
// Send Notification
// ============================================

export async function sendEmail(input: SendEmailInput): Promise<NotificationResult> {
  const ctx = Context.current();
  ctx.heartbeat('Sending notification');

  if (!config.novu.enabled) {
    logger.warn('Novu not enabled, skipping notification', {
      templateId: input.templateId,
    });
    return {
      messageId: 'skipped-novu-disabled',
      status: 'sent',
      recipients: [],
    };
  }

  logger.info('Sending notification via Novu', {
    templateId: input.templateId,
    recipientCount: input.recipients.length,
  });

  const novu = getNovuClient();

  try {
    const results: string[] = [];
    const tenantId = (input.data.tenantId as string) || 'unknown';

    for (const recipient of input.recipients) {
      // Create subscriber ID from tenant and email
      const subscriberId = `tenant-${tenantId}-${recipient.email.replace(/[^a-zA-Z0-9]/g, '_')}`;

      // Create or update subscriber in Novu
      try {
        await novu.subscribers.create({
          subscriberId,
          email: recipient.email,
          firstName: recipient.name?.split(' ')[0] || '',
          lastName: recipient.name?.split(' ').slice(1).join(' ') || '',
          data: {
            tenantId,
          },
        });
      } catch (subError) {
        // Subscriber might already exist, continue
        logger.debug('Subscriber create/update note', {
          subscriberId,
          note: subError instanceof Error ? subError.message : 'Subscriber may already exist',
        });
      }

      // Trigger the notification workflow
      const response = await novu.trigger({
        workflowId: input.templateId,
        to: {
          subscriberId,
          email: recipient.email,
        },
        payload: input.data as Record<string, unknown>,
      });

      if (response.result?.transactionId) {
        results.push(response.result.transactionId);
      }
    }

    logger.info('Novu notification triggered successfully', {
      templateId: input.templateId,
      transactionIds: results,
      recipientCount: input.recipients.length,
    });

    return {
      messageId: results.join(',') || 'novu-triggered',
      status: 'sent',
      recipients: input.recipients.map((r) => r.email),
      provider: 'novu',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to send via Novu', {
      templateId: input.templateId,
      error: message,
    });
    throw new ServiceUnavailableError(`Failed to send via Novu: ${message}`);
  }
}

// ============================================
// Send Welcome Email
// ============================================

export async function sendWelcomeEmail(
  input: SendWelcomeEmailInput
): Promise<NotificationResult> {
  const tracer = createActivityTracer('sendWelcomeEmail', input.tenantId);
  tracer.start();

  const ctx = Context.current();
  ctx.heartbeat('Sending welcome email');

  logger.info('Sending welcome email', {
    tenantId: input.tenantId,
    tenantName: input.tenantName,
  });

  const primaryContact = input.contacts.find((c) => c.isPrimary) || input.contacts[0];

  if (!primaryContact) {
    logger.warn('No contacts found for tenant, skipping welcome email', {
      tenantId: input.tenantId,
    });
    tracer.success({ skipped: true });
    return {
      messageId: 'skipped',
      status: 'sent',
      recipients: [],
    };
  }

  try {
    const result = await sendEmail({
      templateId: config.novu.templates.welcome,
      recipients: [
        {
          email: primaryContact.email,
          name: `${primaryContact.firstName} ${primaryContact.lastName}`,
        },
      ],
      data: {
        tenantId: input.tenantId,
        tenantName: input.tenantName,
        firstName: primaryContact.firstName,
        lastName: primaryContact.lastName,
        appPlaneUrl: input.appPlaneUrl,
        adminPortalUrl: input.adminPortalUrl || `${input.appPlaneUrl}/admin`,
        loginUrl: input.loginUrl || input.appPlaneUrl,
        supportEmail: config.novu.supportEmail,
      },
    });

    tracer.success(result);
    return result;
  } catch (error) {
    tracer.failure(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

// ============================================
// Send Provisioning Failed Email
// ============================================

export async function sendProvisioningFailedEmail(
  input: SendProvisioningFailedEmailInput
): Promise<NotificationResult> {
  const tracer = createActivityTracer('sendProvisioningFailedEmail', input.tenantId);
  tracer.start();

  const ctx = Context.current();
  ctx.heartbeat('Sending provisioning failed email');

  logger.info('Sending provisioning failed email', {
    tenantId: input.tenantId,
    tenantName: input.tenantName,
    failedStep: input.failedStep,
  });

  const primaryContact = input.contacts.find((c) => c.isPrimary) || input.contacts[0];

  if (!primaryContact) {
    logger.warn('No contacts found for tenant, skipping failure notification', {
      tenantId: input.tenantId,
    });
    tracer.success({ skipped: true });
    return {
      messageId: 'skipped',
      status: 'sent',
      recipients: [],
    };
  }

  try {
    const result = await sendEmail({
      templateId: config.novu.templates.provisioningFailed,
      recipients: [
        {
          email: primaryContact.email,
          name: `${primaryContact.firstName} ${primaryContact.lastName}`,
        },
      ],
      data: {
        tenantId: input.tenantId,
        tenantName: input.tenantName,
        firstName: primaryContact.firstName,
        error: input.error,
        failedStep: input.failedStep || 'unknown',
        supportEmail: input.supportEmail || config.novu.supportEmail,
      },
    });

    tracer.success(result);
    return result;
  } catch (error) {
    tracer.failure(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

// ============================================
// Send Deprovisioning Notification
// ============================================

interface DeprovisioningNotificationInput {
  tenantId: string;
  tenantName: string;
  contacts: Contact[];
  gracePeriodDays?: number;
}

export async function sendDeprovisioningNotification(
  input: DeprovisioningNotificationInput
): Promise<NotificationResult> {
  const tracer = createActivityTracer('sendDeprovisioningNotification', input.tenantId);
  tracer.start();

  const ctx = Context.current();
  ctx.heartbeat('Sending deprovisioning notification');

  logger.info('Sending deprovisioning notification', {
    tenantId: input.tenantId,
    tenantName: input.tenantName,
    gracePeriodDays: input.gracePeriodDays,
  });

  const primaryContact = input.contacts.find((c) => c.isPrimary) || input.contacts[0];

  if (!primaryContact) {
    logger.warn('No contacts found for tenant, skipping deprovisioning notification', {
      tenantId: input.tenantId,
    });
    tracer.success({ skipped: true });
    return {
      messageId: 'skipped',
      status: 'sent',
      recipients: [],
    };
  }

  try {
    const result = await sendEmail({
      templateId: config.novu.templates.deprovisioning,
      recipients: [
        {
          email: primaryContact.email,
          name: `${primaryContact.firstName} ${primaryContact.lastName}`,
        },
      ],
      data: {
        tenantId: input.tenantId,
        tenantName: input.tenantName,
        firstName: primaryContact.firstName,
        gracePeriodDays: input.gracePeriodDays || 0,
        supportEmail: config.novu.supportEmail,
      },
    });

    tracer.success(result);
    return result;
  } catch (error) {
    tracer.failure(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

// ============================================
// Send In-App Notification (Novu Only)
// ============================================

interface InAppNotificationInput {
  tenantId: string;
  subscriberId: string;
  templateId: string;
  payload: Record<string, unknown>;
}

export async function sendInAppNotification(
  input: InAppNotificationInput
): Promise<NotificationResult> {
  const tracer = createActivityTracer('sendInAppNotification', input.tenantId);
  tracer.start();

  const ctx = Context.current();
  ctx.heartbeat('Sending in-app notification');

  if (!config.novu.enabled) {
    logger.warn('Novu not enabled, skipping in-app notification');
    tracer.success({ skipped: true });
    return {
      messageId: 'skipped-novu-disabled',
      status: 'sent',
      recipients: [],
    };
  }

  try {
    const novu = getNovuClient();

    const response = await novu.trigger({
      workflowId: input.templateId,
      to: {
        subscriberId: input.subscriberId,
      },
      payload: input.payload,
    });

    const result: NotificationResult = {
      messageId: response.result?.transactionId || 'novu-triggered',
      status: 'sent',
      recipients: [input.subscriberId],
      provider: 'novu',
    };

    tracer.success(result);
    logger.info('In-app notification sent', {
      tenantId: input.tenantId,
      templateId: input.templateId,
      transactionId: result.messageId,
    });

    return result;
  } catch (error) {
    tracer.failure(error instanceof Error ? error : new Error(String(error)));
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new ServiceUnavailableError(`Failed to send in-app notification: ${message}`);
  }
}

// ============================================
// Bulk Notification (Novu Only)
// ============================================

interface BulkNotificationInput {
  tenantId: string;
  templateId: string;
  subscribers: Array<{
    subscriberId: string;
    email?: string;
    payload?: Record<string, unknown>;
  }>;
  commonPayload?: Record<string, unknown>;
}

export async function sendBulkNotification(
  input: BulkNotificationInput
): Promise<NotificationResult> {
  const tracer = createActivityTracer('sendBulkNotification', input.tenantId);
  tracer.start();

  const ctx = Context.current();
  ctx.heartbeat('Sending bulk notification');

  if (!config.novu.enabled) {
    logger.warn('Novu not enabled, skipping bulk notification');
    tracer.success({ skipped: true });
    return {
      messageId: 'skipped-novu-disabled',
      status: 'sent',
      recipients: [],
    };
  }

  try {
    const novu = getNovuClient();
    const transactionIds: string[] = [];

    for (const subscriber of input.subscribers) {
      ctx.heartbeat(`Notifying subscriber ${subscriber.subscriberId}`);

      const response = await novu.trigger({
        workflowId: input.templateId,
        to: {
          subscriberId: subscriber.subscriberId,
          email: subscriber.email,
        },
        payload: {
          ...input.commonPayload,
          ...subscriber.payload,
        },
      });

      if (response.result?.transactionId) {
        transactionIds.push(response.result.transactionId);
      }
    }

    const result: NotificationResult = {
      messageId: transactionIds.join(',') || 'novu-bulk-triggered',
      status: 'sent',
      recipients: input.subscribers.map((s) => s.subscriberId),
      provider: 'novu',
    };

    tracer.success(result);
    logger.info('Bulk notification sent', {
      tenantId: input.tenantId,
      templateId: input.templateId,
      recipientCount: input.subscribers.length,
    });

    return result;
  } catch (error) {
    tracer.failure(error instanceof Error ? error : new Error(String(error)));
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new ServiceUnavailableError(`Failed to send bulk notification: ${message}`);
  }
}
