import {BindingScope, inject, injectable} from '@loopback/core';
import {repository} from '@loopback/repository';
import {ILogger, LOGGER} from '@sourceloop/core';
import Stripe from 'stripe';
import {
  PaymentIntentRepository,
  PaymentMethodRepository,
  InvoiceRepository,
  TenantRepository,
  ContactRepository,
} from '../repositories';
import {PaymentIntentStatus, InvoiceStatus, PaymentMethodType} from '../enums';
import {StripeService} from './stripe.service';
import {NovuNotificationService} from './novu-notification.service';
import {Contact} from '../models';
import {NotificationCategory} from '../models/notification-preference.model';

/**
 * Stripe Webhook Service
 *
 * Handles the business logic for processing Stripe webhook events.
 * This service is responsible for:
 * - Updating payment intent records
 * - Updating invoice status on payment success/failure
 * - Syncing payment method changes
 * - Handling subscription lifecycle events
 */
@injectable({scope: BindingScope.SINGLETON})
export class StripeWebhookService {
  constructor(
    @repository(PaymentIntentRepository)
    private readonly paymentIntentRepo: PaymentIntentRepository,
    @repository(PaymentMethodRepository)
    private readonly paymentMethodRepo: PaymentMethodRepository,
    @repository(InvoiceRepository)
    private readonly invoiceRepo: InvoiceRepository,
    @repository(TenantRepository)
    private readonly tenantRepo: TenantRepository,
    @repository(ContactRepository)
    private readonly contactRepo: ContactRepository,
    @inject('services.StripeService')
    private readonly stripeService: StripeService,
    @inject('services.NovuNotificationService', {optional: true})
    private readonly notificationService: NovuNotificationService | null,
    @inject(LOGGER.LOGGER_INJECT)
    private readonly logger: ILogger,
  ) {}

  /**
   * Get primary contact for a tenant (for sending billing notifications)
   */
  private async getPrimaryContactForTenant(
    tenantId: string,
  ): Promise<Contact | null> {
    try {
      const contacts = await this.contactRepo.find({
        where: {tenantId, isPrimary: true},
        limit: 1,
      });
      if (contacts.length > 0) {
        return contacts[0];
      }
      // Fallback to any contact
      const anyContacts = await this.contactRepo.find({
        where: {tenantId},
        limit: 1,
      });
      return anyContacts[0] || null;
    } catch (error) {
      this.logger.warn(
        `[Stripe Webhook] Failed to get contact for tenant ${tenantId}: ${error}`,
      );
      return null;
    }
  }

  /**
   * Send a billing notification via Novu with tenant preference support.
   * Uses sendWithPreferences() to respect per-tenant channel toggles (email, SMS, etc.)
   */
  private async sendBillingNotification(
    workflowId: string,
    tenantId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (!this.notificationService?.isEnabled()) {
      this.logger.debug(
        `[Stripe Webhook] Novu not enabled, skipping notification: ${workflowId}`,
      );
      return;
    }

    const contact = await this.getPrimaryContactForTenant(tenantId);
    if (!contact) {
      this.logger.warn(
        `[Stripe Webhook] No contact found for tenant ${tenantId}, skipping notification`,
      );
      return;
    }

    try {
      // Use sendWithPreferences to respect tenant notification channel settings
      const result = await this.notificationService.sendWithPreferences({
        workflowId,
        tenantId,
        category: NotificationCategory.BILLING,
        recipient: {
          email: contact.email,
          firstName: contact.firstName,
          lastName: contact.lastName,
          // Note: Contact model doesn't have phone yet - SMS notifications will skip
        },
        payload,
      });

      if (result.success) {
        const channels = result.channelsUsed.join(', ') || 'none';
        this.logger.info(
          `[Stripe Webhook] Sent ${workflowId} notification for tenant ${tenantId}, txId: ${result.transactionId}, channels: [${channels}]`,
        );
      } else {
        this.logger.warn(
          `[Stripe Webhook] Failed to send ${workflowId} notification: ${result.error}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `[Stripe Webhook] Error sending notification ${workflowId}: ${error}`,
      );
    }
  }

  /**
   * Process a Stripe webhook event
   */
  async processEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      // Payment Intent events
      case 'payment_intent.succeeded':
        await this.handlePaymentIntentSucceeded(
          event.data.object as Stripe.PaymentIntent,
        );
        break;

      case 'payment_intent.payment_failed':
        await this.handlePaymentIntentFailed(
          event.data.object as Stripe.PaymentIntent,
        );
        break;

      case 'payment_intent.canceled':
        await this.handlePaymentIntentCanceled(
          event.data.object as Stripe.PaymentIntent,
        );
        break;

      case 'payment_intent.processing':
        await this.handlePaymentIntentProcessing(
          event.data.object as Stripe.PaymentIntent,
        );
        break;

      case 'payment_intent.requires_action':
        await this.handlePaymentIntentRequiresAction(
          event.data.object as Stripe.PaymentIntent,
        );
        break;

      // Payment Method events
      case 'payment_method.attached':
        await this.handlePaymentMethodAttached(
          event.data.object as Stripe.PaymentMethod,
        );
        break;

      case 'payment_method.detached':
        await this.handlePaymentMethodDetached(
          event.data.object as Stripe.PaymentMethod,
        );
        break;

      case 'payment_method.updated':
        await this.handlePaymentMethodUpdated(
          event.data.object as Stripe.PaymentMethod,
        );
        break;

      // Invoice events
      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(
          event.data.object as Stripe.Invoice,
        );
        break;

      // Customer events
      case 'customer.updated':
        await this.handleCustomerUpdated(event.data.object as Stripe.Customer);
        break;

      default:
        this.logger.info(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }
  }

  /**
   * Handle payment_intent.succeeded event
   */
  private async handlePaymentIntentSucceeded(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    this.logger.info(
      `[Stripe Webhook] Payment succeeded: ${paymentIntent.id}`,
    );

    // Find our payment intent record
    const record = await this.paymentIntentRepo.findByStripePaymentIntentId(
      paymentIntent.id,
    );

    if (record) {
      // Update payment intent status
      await this.paymentIntentRepo.updateById(record.id, {
        status: PaymentIntentStatus.SUCCEEDED,
        succeededAt: new Date().toISOString(),
        amountReceived: paymentIntent.amount_received,
        stripePaymentMethodId:
          typeof paymentIntent.payment_method === 'string'
            ? paymentIntent.payment_method
            : paymentIntent.payment_method?.id,
      });

      // Update linked invoice if exists
      if (record.invoiceId) {
        await this.invoiceRepo.updateById(record.invoiceId, {
          status: InvoiceStatus.PAID,
        });
        this.logger.info(
          `[Stripe Webhook] Invoice ${record.invoiceId} marked as PAID`,
        );
      }

      // Send payment success notification
      await this.sendBillingNotification(
        'payment-success',
        record.tenantId,
        {
          paymentId: paymentIntent.id,
          amount: (paymentIntent.amount_received / 100).toFixed(2),
          currency: paymentIntent.currency.toUpperCase(),
          description: paymentIntent.description || 'Payment',
          timestamp: new Date().toISOString(),
        },
      );
    } else {
      this.logger.warn(
        `[Stripe Webhook] No local record found for payment intent: ${paymentIntent.id}`,
      );
    }
  }

  /**
   * Handle payment_intent.payment_failed event
   */
  private async handlePaymentIntentFailed(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    this.logger.warn(`[Stripe Webhook] Payment failed: ${paymentIntent.id}`);

    const record = await this.paymentIntentRepo.findByStripePaymentIntentId(
      paymentIntent.id,
    );

    if (record) {
      const lastError = paymentIntent.last_payment_error;
      await this.paymentIntentRepo.updateById(record.id, {
        status: PaymentIntentStatus.REQUIRES_PAYMENT_METHOD,
        failureCode: lastError?.code ?? undefined,
        failureMessage: lastError?.message ?? 'Payment failed',
      });

      this.logger.info(
        `[Stripe Webhook] Updated payment intent ${record.id} with failure: ${lastError?.message}`,
      );

      // Send payment failure notification
      await this.sendBillingNotification(
        'payment-failed',
        record.tenantId,
        {
          paymentId: paymentIntent.id,
          amount: (paymentIntent.amount / 100).toFixed(2),
          currency: paymentIntent.currency.toUpperCase(),
          errorCode: lastError?.code || 'unknown',
          errorMessage: lastError?.message || 'Payment failed',
          timestamp: new Date().toISOString(),
        },
      );
    }
  }

  /**
   * Handle payment_intent.canceled event
   */
  private async handlePaymentIntentCanceled(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    this.logger.info(`[Stripe Webhook] Payment canceled: ${paymentIntent.id}`);

    const record = await this.paymentIntentRepo.findByStripePaymentIntentId(
      paymentIntent.id,
    );

    if (record) {
      await this.paymentIntentRepo.updateById(record.id, {
        status: PaymentIntentStatus.CANCELLED,
        cancelledAt: new Date().toISOString(),
        cancellationReason: paymentIntent.cancellation_reason ?? undefined,
      });
    }
  }

  /**
   * Handle payment_intent.processing event
   */
  private async handlePaymentIntentProcessing(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    this.logger.info(
      `[Stripe Webhook] Payment processing: ${paymentIntent.id}`,
    );

    const record = await this.paymentIntentRepo.findByStripePaymentIntentId(
      paymentIntent.id,
    );

    if (record) {
      await this.paymentIntentRepo.updateById(record.id, {
        status: PaymentIntentStatus.PROCESSING,
      });
    }
  }

  /**
   * Handle payment_intent.requires_action event
   */
  private async handlePaymentIntentRequiresAction(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    this.logger.info(
      `[Stripe Webhook] Payment requires action: ${paymentIntent.id}`,
    );

    const record = await this.paymentIntentRepo.findByStripePaymentIntentId(
      paymentIntent.id,
    );

    if (record) {
      await this.paymentIntentRepo.updateById(record.id, {
        status: PaymentIntentStatus.REQUIRES_ACTION,
      });
    }
  }

  /**
   * Handle payment_method.attached event
   */
  private async handlePaymentMethodAttached(
    paymentMethod: Stripe.PaymentMethod,
  ): Promise<void> {
    this.logger.info(
      `[Stripe Webhook] Payment method attached: ${paymentMethod.id}`,
    );

    // Check if we already have this payment method
    const existing = await this.paymentMethodRepo.findByStripePaymentMethodId(
      paymentMethod.id,
    );

    if (existing) {
      this.logger.info(
        `[Stripe Webhook] Payment method ${paymentMethod.id} already exists locally`,
      );
      return;
    }

    // Find tenant by Stripe customer ID
    const customerId =
      typeof paymentMethod.customer === 'string'
        ? paymentMethod.customer
        : paymentMethod.customer?.id;

    if (!customerId) {
      this.logger.warn(
        `[Stripe Webhook] Payment method ${paymentMethod.id} has no customer`,
      );
      return;
    }

    // Look up tenant by stripeCustomerId (stored in tenant.metadata or a dedicated field)
    // For now, we'll log this - in production you'd query tenants by stripe customer ID
    this.logger.info(
      `[Stripe Webhook] Payment method attached for customer: ${customerId}`,
    );

    // Note: Auto-creating payment methods from webhooks is optional.
    // Usually payment methods are created when the user adds them in the UI.
  }

  /**
   * Handle payment_method.detached event
   */
  private async handlePaymentMethodDetached(
    paymentMethod: Stripe.PaymentMethod,
  ): Promise<void> {
    this.logger.info(
      `[Stripe Webhook] Payment method detached: ${paymentMethod.id}`,
    );

    const record = await this.paymentMethodRepo.findByStripePaymentMethodId(
      paymentMethod.id,
    );

    if (record) {
      // Soft delete the payment method
      await this.paymentMethodRepo.updateById(record.id, {
        deleted: true,
        deletedOn: new Date().toISOString(),
      } as object);

      this.logger.info(
        `[Stripe Webhook] Soft-deleted local payment method: ${record.id}`,
      );
    }
  }

  /**
   * Handle payment_method.updated event
   */
  private async handlePaymentMethodUpdated(
    paymentMethod: Stripe.PaymentMethod,
  ): Promise<void> {
    this.logger.info(
      `[Stripe Webhook] Payment method updated: ${paymentMethod.id}`,
    );

    const record = await this.paymentMethodRepo.findByStripePaymentMethodId(
      paymentMethod.id,
    );

    if (record) {
      // Update card details if available
      const updates: Record<string, unknown> = {};

      if (paymentMethod.card) {
        updates.cardDetails = {
          brand: paymentMethod.card.brand,
          last4: paymentMethod.card.last4,
          expMonth: paymentMethod.card.exp_month,
          expYear: paymentMethod.card.exp_year,
          fingerprint: paymentMethod.card.fingerprint,
        };
      }

      if (paymentMethod.billing_details) {
        if (paymentMethod.billing_details.name) {
          updates.billingName = paymentMethod.billing_details.name;
        }
        if (paymentMethod.billing_details.email) {
          updates.billingEmail = paymentMethod.billing_details.email;
        }
        if (paymentMethod.billing_details.address) {
          updates.billingAddress = paymentMethod.billing_details.address;
        }
      }

      if (Object.keys(updates).length > 0) {
        await this.paymentMethodRepo.updateById(record.id, updates as object);
        this.logger.info(
          `[Stripe Webhook] Updated local payment method: ${record.id}`,
        );
      }
    }
  }

  /**
   * Handle invoice.paid event
   */
  private async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    this.logger.info(`[Stripe Webhook] Invoice paid: ${invoice.id}`);

    // If we have a local invoice linked via metadata, update it
    const localInvoiceId = invoice.metadata?.localInvoiceId;
    const tenantId = invoice.metadata?.tenantId;

    if (localInvoiceId) {
      try {
        await this.invoiceRepo.updateById(localInvoiceId, {
          status: InvoiceStatus.PAID,
        });
        this.logger.info(
          `[Stripe Webhook] Local invoice ${localInvoiceId} marked as PAID`,
        );

        // Send invoice paid notification
        if (tenantId) {
          await this.sendBillingNotification(
            'invoice-paid',
            tenantId,
            {
              invoiceId: invoice.id,
              invoiceNumber: invoice.number || localInvoiceId,
              amount: ((invoice.amount_paid ?? 0) / 100).toFixed(2),
              currency: (invoice.currency || 'usd').toUpperCase(),
              invoiceUrl: invoice.hosted_invoice_url || '',
              pdfUrl: invoice.invoice_pdf || '',
              timestamp: new Date().toISOString(),
            },
          );
        }
      } catch (error) {
        this.logger.error(
          `[Stripe Webhook] Failed to update local invoice ${localInvoiceId}: ${error}`,
        );
      }
    }
  }

  /**
   * Handle invoice.payment_failed event
   */
  private async handleInvoicePaymentFailed(
    invoice: Stripe.Invoice,
  ): Promise<void> {
    this.logger.warn(`[Stripe Webhook] Invoice payment failed: ${invoice.id}`);

    // Log for monitoring - invoice stays in PENDING state
    const localInvoiceId = invoice.metadata?.localInvoiceId;
    const tenantId = invoice.metadata?.tenantId;

    if (localInvoiceId) {
      this.logger.warn(
        `[Stripe Webhook] Payment failed for local invoice: ${localInvoiceId}`,
      );

      // Send invoice payment failed notification
      if (tenantId) {
        await this.sendBillingNotification(
          'invoice-payment-failed',
          tenantId,
          {
            invoiceId: invoice.id,
            invoiceNumber: invoice.number || localInvoiceId,
            amount: ((invoice.amount_due ?? 0) / 100).toFixed(2),
            currency: (invoice.currency || 'usd').toUpperCase(),
            invoiceUrl: invoice.hosted_invoice_url || '',
            dueDate: invoice.due_date
              ? new Date(invoice.due_date * 1000).toISOString()
              : '',
            timestamp: new Date().toISOString(),
          },
        );
      }
    }
  }

  /**
   * Handle customer.updated event
   */
  private async handleCustomerUpdated(customer: Stripe.Customer): Promise<void> {
    this.logger.info(`[Stripe Webhook] Customer updated: ${customer.id}`);

    // Find tenant by stripe customer ID and update default payment method if changed
    const defaultPaymentMethod = customer.invoice_settings?.default_payment_method;

    if (defaultPaymentMethod) {
      const pmId =
        typeof defaultPaymentMethod === 'string'
          ? defaultPaymentMethod
          : defaultPaymentMethod.id;

      const paymentMethod =
        await this.paymentMethodRepo.findByStripePaymentMethodId(pmId);

      if (paymentMethod && !paymentMethod.isDefault) {
        await this.paymentMethodRepo.setAsDefault(
          paymentMethod.tenantId,
          paymentMethod.id,
        );
        this.logger.info(
          `[Stripe Webhook] Set payment method ${paymentMethod.id} as default for tenant ${paymentMethod.tenantId}`,
        );
      }
    }
  }
}
