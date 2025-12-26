import {BindingScope, inject, injectable} from '@loopback/core';
import {ILogger, LOGGER} from '@sourceloop/core';
import {Novu} from '@novu/api';
import {NotificationType} from '../../enums';
import {WebhookNotificationServiceType} from '../../types';

/**
 * Novu Workflow IDs matching the templates created by bootstrap-novu-templates.js
 */
const NOVU_WORKFLOW_IDS: Record<NotificationType, string> = {
  [NotificationType.ValidateLead]: 'lead-validation',
  [NotificationType.WelcomeTenant]: 'tenant-welcome',
};

/**
 * Service for handling notifications via Novu (self-hosted).
 * This service sends email and in-app notifications using Novu's workflow system.
 */
@injectable({scope: BindingScope.SINGLETON})
export class NotificationService implements WebhookNotificationServiceType {
  private novuClient: Novu | null = null;

  constructor(
    @inject(LOGGER.LOGGER_INJECT)
    private logger: ILogger,
  ) {}

  /**
   * Get or create the Novu client instance
   */
  private getNovuClient(): Novu | null {
    const enabled = process.env.NOVU_ENABLED === 'true';
    if (!enabled) {
      return null;
    }

    if (!this.novuClient) {
      const apiKey = process.env.NOVU_API_KEY;
      const backendUrl = process.env.NOVU_BACKEND_URL || 'http://localhost:3000';

      if (!apiKey) {
        this.logger.warn('NOVU_API_KEY not configured');
        return null;
      }

      this.novuClient = new Novu({
        secretKey: apiKey,
        serverURL: backendUrl,
      });

      this.logger.info(`Novu client initialized with backend: ${backendUrl}`);
    }

    return this.novuClient;
  }

  /**
   * The `send` function sends an email notification with a given email address,
   * notification type, data, and authentication token.
   * @param {string} email - The email address of the recipient.
   * @param {NotificationType} type - The type of notification to send.
   * @param {T} data - The data to populate the notification template.
   * @param {string} _token - Authentication token (unused for Novu).
   */
  async send<T>(
    email: string,
    type: NotificationType,
    data: T,
    _token: string,
  ): Promise<void> {
    const novu = this.getNovuClient();

    if (!novu) {
      this.logger.warn(
        `Novu not enabled, skipping notification: ${type} to ${email}`,
      );
      return;
    }

    const workflowId = NOVU_WORKFLOW_IDS[type];
    if (!workflowId) {
      this.logger.error(`Unknown notification type: ${type}`);
      throw new Error(`Unknown notification type: ${type}`);
    }

    // Create a unique subscriber ID based on email
    const subscriberId = `lead-${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const payload = data as Record<string, unknown>;

    try {
      // Create or update subscriber in Novu
      try {
        await novu.subscribers.create({
          subscriberId,
          email,
          firstName: (payload.firstName as string) || '',
          lastName: (payload.lastName as string) || '',
        });
      } catch (subError) {
        // Subscriber might already exist, continue
        this.logger.debug(
          `Subscriber create note: ${subError instanceof Error ? subError.message : 'may already exist'}`,
        );
      }

      // Trigger the notification workflow
      const response = await novu.trigger({
        workflowId,
        to: {
          subscriberId,
          email,
        },
        payload,
      });

      this.logger.info(
        `Notification sent via Novu: type=${type}, email=${email}, workflowId=${workflowId}, transactionId=${response.result?.transactionId}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to send notification via Novu: ${message} (type=${type}, email=${email}, workflowId=${workflowId})`,
      );
      throw error;
    }
  }

  /**
   * Send a lead validation email with the verification link.
   * @param email - The lead's email address.
   * @param data - The payload containing firstName, companyName, and validationToken.
   */
  async sendLeadValidationEmail(
    email: string,
    data: {
      firstName: string;
      companyName: string;
      validationToken: string;
    },
  ) {
    const frontendUrl = process.env.CUSTOMER_PORTAL_URL || 'http://localhost:27100';
    const validationUrl = `${frontendUrl}/register/verify?token=${data.validationToken}`;

    return this.send(
      email,
      NotificationType.ValidateLead,
      {
        firstName: data.firstName,
        email,
        companyName: data.companyName,
        validationUrl,
      },
      '',
    );
  }

  /**
   * Send a tenant welcome email after successful provisioning.
   * @param email - The admin user's email address.
   * @param data - The payload containing tenant and user info.
   */
  async sendTenantWelcomeEmail(
    email: string,
    data: {
      firstName: string;
      lastName: string;
      tenantName: string;
      tenantKey: string;
    },
  ) {
    const appPlaneUrl =
      process.env.APP_PLANE_URL || `https://${data.tenantKey}.ananta.local`;

    return this.send(
      email,
      NotificationType.WelcomeTenant,
      {
        firstName: data.firstName,
        lastName: data.lastName,
        email,
        tenantName: data.tenantName,
        appPlaneUrl,
      },
      '',
    );
  }
}
