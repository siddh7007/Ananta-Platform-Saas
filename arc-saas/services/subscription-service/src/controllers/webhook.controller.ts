import {inject, intercept} from '@loopback/core';
import {repository} from '@loopback/repository';
import {post, requestBody, RestBindings, Request, HttpErrors} from '@loopback/rest';
import {authorize} from 'loopback4-authorization';
import {WEBHOOK_VERIFIER} from '../keys';
import {InvoiceRepository, SubscriptionRepository} from '../repositories';
import {BillingCustomerRepository} from '../repositories/billing-customer.repository';
import {IContent, IPayload} from '../types';
import * as crypto from 'crypto';

/**
 * Stripe event types we handle
 */
const STRIPE_EVENTS = {
  CUSTOMER_CREATED: 'customer.created',
  CUSTOMER_UPDATED: 'customer.updated',
  CUSTOMER_DELETED: 'customer.deleted',
  SUBSCRIPTION_CREATED: 'customer.subscription.created',
  SUBSCRIPTION_UPDATED: 'customer.subscription.updated',
  SUBSCRIPTION_DELETED: 'customer.subscription.deleted',
  INVOICE_PAID: 'invoice.paid',
  INVOICE_PAYMENT_FAILED: 'invoice.payment_failed',
  INVOICE_FINALIZED: 'invoice.finalized',
  PAYMENT_INTENT_SUCCEEDED: 'payment_intent.succeeded',
  PAYMENT_INTENT_FAILED: 'payment_intent.payment_failed',
};

export class WebhookController {
  constructor(
    @repository(BillingCustomerRepository)
    public billingCustomerRepository: BillingCustomerRepository,
    @repository(InvoiceRepository)
    public invoiceRepository: InvoiceRepository,
    @repository(SubscriptionRepository)
    public subscriptionRepository: SubscriptionRepository,
  ) {}

  @authorize({
    permissions: ['*'],
  })
  @intercept(WEBHOOK_VERIFIER)
  @post('/webhooks/billing-payment')
  async handleWebhook(@requestBody() payload: IPayload): Promise<void> {
    const content = payload.content;
    await this.handlePayment(content);
  }

  /**
   * Stripe-specific webhook endpoint
   * Handles raw Stripe events with signature verification
   */
  @authorize({
    permissions: ['*'],
  })
  @post('/webhooks/stripe')
  async handleStripeWebhook(
    @inject(RestBindings.Http.REQUEST) request: Request,
  ): Promise<{received: boolean}> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET not configured - rejecting webhook');
      throw new HttpErrors.InternalServerError('Webhook secret not configured');
    }

    // Verify Stripe signature
    const signature = request.headers['stripe-signature'] as string;
    if (!signature) {
      console.error('Missing Stripe signature header');
      throw new HttpErrors.Unauthorized('Missing Stripe signature');
    }

    // Get raw body for signature verification
    const rawBody = (request as unknown as {rawBody?: Buffer}).rawBody;
    if (!rawBody) {
      console.error('Raw body not available for signature verification');
      throw new HttpErrors.BadRequest('Raw body required for webhook verification');
    }

    // Verify the signature
    const event = this.verifyStripeSignature(rawBody.toString(), signature, webhookSecret);
    if (!event) {
      console.error('Invalid Stripe signature');
      throw new HttpErrors.Unauthorized('Invalid Stripe signature');
    }

    console.log('Received verified Stripe event:', event.type, event.id);

    try {
      await this.processStripeEvent(event);
      return {received: true};
    } catch (error) {
      console.error('Error processing Stripe webhook:', error);
      throw error;
    }
  }

  /**
   * Verify Stripe webhook signature using HMAC-SHA256
   * Stripe signature format: t=timestamp,v1=signature
   */
  private verifyStripeSignature(
    payload: string,
    signature: string,
    secret: string,
  ): StripeEvent | null {
    try {
      // Parse signature header
      const elements = signature.split(',');
      const signatureMap: Record<string, string> = {};
      for (const element of elements) {
        const [key, value] = element.split('=');
        signatureMap[key] = value;
      }

      const timestamp = signatureMap['t'];
      const expectedSignature = signatureMap['v1'];

      if (!timestamp || !expectedSignature) {
        console.error('Invalid signature format');
        return null;
      }

      // Check timestamp is not too old (5 minute tolerance)
      const timestampAge = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
      if (timestampAge > 300) {
        console.error('Webhook timestamp too old:', timestampAge, 'seconds');
        return null;
      }

      // Compute expected signature
      const signedPayload = timestamp + '.' + payload;
      const computedSignature = crypto
        .createHmac('sha256', secret)
        .update(signedPayload, 'utf8')
        .digest('hex');

      // Compare signatures using timing-safe comparison
      const isValid = crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(computedSignature),
      );

      if (!isValid) {
        console.error('Signature mismatch');
        return null;
      }

      // Parse and return the event
      return JSON.parse(payload) as StripeEvent;
    } catch (error) {
      console.error('Error verifying Stripe signature:', error);
      return null;
    }
  }

  private async processStripeEvent(event: StripeEvent): Promise<void> {
    // Cast via unknown to satisfy TypeScript
    const data = event.data.object as unknown;

    switch (event.type) {
      case STRIPE_EVENTS.SUBSCRIPTION_CREATED:
      case STRIPE_EVENTS.SUBSCRIPTION_UPDATED:
        await this.handleSubscriptionUpdate(data as StripeSubscription);
        break;
      case STRIPE_EVENTS.SUBSCRIPTION_DELETED:
        await this.handleSubscriptionCancelled(data as StripeSubscription);
        break;
      case STRIPE_EVENTS.INVOICE_PAID:
        await this.handleInvoicePaid(data as StripeInvoice);
        break;
      case STRIPE_EVENTS.INVOICE_PAYMENT_FAILED:
        await this.handleInvoicePaymentFailed(data as StripeInvoice);
        break;
      case STRIPE_EVENTS.CUSTOMER_DELETED:
        await this.handleCustomerDeleted(data as StripeCustomer);
        break;
      default:
        console.log('Unhandled Stripe event type:', event.type);
    }
  }

  private async handleSubscriptionUpdate(subscription: StripeSubscription): Promise<void> {
    // tenant_id is stored in Stripe subscription metadata
    const subscriberId = subscription.metadata?.tenant_id;
    if (!subscriberId) return;

    const statusMap: Record<string, number> = {
      trialing: 1,
      active: 2,
      past_due: 3,
      canceled: 4,
      unpaid: 5,
    };
    const status = statusMap[subscription.status] || 1;

    // Update using subscriberId (tenant) and externalSubscriptionId
    await this.subscriptionRepository.updateAll(
      {status, externalSubscriptionId: subscription.id, modifiedOn: new Date()},
      {subscriberId},
    );
    console.log('Subscription updated from Stripe webhook', subscriberId, subscription.status);
  }

  private async handleSubscriptionCancelled(subscription: StripeSubscription): Promise<void> {
    const subscriberId = subscription.metadata?.tenant_id;
    if (!subscriberId) return;

    await this.subscriptionRepository.updateAll(
      {status: 4, modifiedOn: new Date()},
      {subscriberId},
    );
  }

  private async handleInvoicePaid(invoice: StripeInvoice): Promise<void> {
    const invoices = await this.invoiceRepository.find({where: {invoiceId: invoice.id}});
    if (invoices.length > 0) {
      await this.invoiceRepository.updateById(invoices[0].id, {invoiceStatus: 'paid'});
    }
  }

  private async handleInvoicePaymentFailed(invoice: StripeInvoice): Promise<void> {
    const invoices = await this.invoiceRepository.find({where: {invoiceId: invoice.id}});
    if (invoices.length > 0) {
      await this.invoiceRepository.updateById(invoices[0].id, {invoiceStatus: 'not_paid'});
    }
  }

  private async handleCustomerDeleted(customer: StripeCustomer): Promise<void> {
    const tenantId = customer.metadata?.tenant_id;
    if (!tenantId) return;
    await this.billingCustomerRepository.deleteAll({customerId: customer.id});
  }

  private async handlePayment(content: IContent): Promise<void> {
    const invoice = await this.invoiceRepository.find({where: {invoiceId: content.invoice.id}});
    if (invoice.length > 0) {
      await this.invoiceRepository.updateById(invoice[0].id, {invoiceStatus: content.invoice.status});
    }
  }
}

// Stripe types
interface StripeEvent {
  id: string;
  type: string;
  data: {object: Record<string, unknown>};
}

interface StripeSubscription {
  id: string;
  customer: string;
  status: string;
  metadata?: {tenant_id?: string};
}

interface StripeInvoice {
  id: string;
  customer: string;
  status: string;
}

interface StripeCustomer {
  id: string;
  metadata?: {tenant_id?: string};
}
