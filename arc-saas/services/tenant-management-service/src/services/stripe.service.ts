import {injectable, BindingScope} from '@loopback/core';
import Stripe from 'stripe';
import {PaymentMethodType, PaymentIntentStatus} from '../enums';
import type {CardDetails, BankAccountDetails} from '../models/payment-method.model';

/**
 * Configuration for creating a customer in Stripe
 */
export interface CreateCustomerInput {
  tenantId: string;
  email: string;
  name?: string;
  metadata?: Record<string, string>;
}

/**
 * Configuration for creating a payment intent
 */
export interface CreatePaymentIntentInput {
  amount: number;
  currency: string;
  customerId?: string;
  paymentMethodId?: string;
  description?: string;
  receiptEmail?: string;
  metadata?: Record<string, string>;
  automaticPaymentMethods?: boolean;
  /** Whether to confirm the payment intent immediately */
  confirm?: boolean;
  /** Whether this is an off-session payment (no customer present) */
  offSession?: boolean;
}

/**
 * Configuration for attaching a payment method to a customer
 */
export interface AttachPaymentMethodInput {
  paymentMethodId: string;
  customerId: string;
  setAsDefault?: boolean;
}

/**
 * Parsed payment method details from Stripe
 */
export interface ParsedPaymentMethod {
  id: string;
  type: PaymentMethodType;
  cardDetails?: CardDetails;
  bankAccountDetails?: BankAccountDetails;
  billingDetails?: {
    name?: string;
    email?: string;
    address?: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
  };
}

/**
 * Service for interacting with Stripe payment gateway.
 * Provides methods for customer management, payment methods, and payment intents.
 */
@injectable({scope: BindingScope.SINGLETON})
export class StripeService {
  private client: Stripe | null = null;
  private enabled: boolean;
  private secretKey: string;
  private webhookSecret: string;
  private apiVersion: string;

  constructor() {
    this.enabled = process.env.STRIPE_ENABLED === 'true';
    this.secretKey = process.env.STRIPE_SECRET_KEY || '';
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
    // Use a valid Stripe API version - omit to use account default
    this.apiVersion = '2024-04-10';
  }

  /**
   * Check if Stripe is enabled and configured
   */
  isEnabled(): boolean {
    return this.enabled && !!this.secretKey;
  }

  /**
   * Get webhook secret for signature verification
   */
  getWebhookSecret(): string {
    return this.webhookSecret;
  }

  /**
   * Get or create Stripe client
   */
  private getClient(): Stripe {
    if (!this.isEnabled()) {
      throw new Error(
        'Stripe is not enabled. Set STRIPE_ENABLED=true and configure STRIPE_SECRET_KEY',
      );
    }

    if (!this.client) {
      this.client = new Stripe(this.secretKey, {
        apiVersion: this.apiVersion as Stripe.LatestApiVersion,
        typescript: true,
      });
    }

    return this.client;
  }

  // ============================================
  // CUSTOMER MANAGEMENT
  // ============================================

  /**
   * Create a Stripe customer for a tenant
   */
  async createCustomer(input: CreateCustomerInput): Promise<Stripe.Customer> {
    const client = this.getClient();

    const customer = await client.customers.create({
      email: input.email,
      name: input.name,
      metadata: {
        tenantId: input.tenantId,
        ...input.metadata,
      },
    });

    console.info('[Stripe] Customer created', {
      customerId: customer.id,
      tenantId: input.tenantId,
      email: input.email,
    });

    return customer;
  }

  /**
   * Get a Stripe customer by ID
   */
  async getCustomer(customerId: string): Promise<Stripe.Customer | null> {
    const client = this.getClient();

    try {
      const customer = await client.customers.retrieve(customerId);
      if (customer.deleted) {
        return null;
      }
      return customer as Stripe.Customer;
    } catch (error) {
      if (error instanceof Stripe.errors.StripeError && error.code === 'resource_missing') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Update a Stripe customer
   */
  async updateCustomer(
    customerId: string,
    updates: Stripe.CustomerUpdateParams,
  ): Promise<Stripe.Customer> {
    const client = this.getClient();
    return client.customers.update(customerId, updates);
  }

  /**
   * Find customer by tenant ID (via metadata search)
   */
  async findCustomerByTenantId(tenantId: string): Promise<Stripe.Customer | null> {
    const client = this.getClient();

    const customers = await client.customers.search({
      query: `metadata['tenantId']:'${tenantId}'`,
      limit: 1,
    });

    return customers.data.length > 0 ? customers.data[0] : null;
  }

  // ============================================
  // PAYMENT METHODS
  // ============================================

  /**
   * Create a SetupIntent for collecting payment method details
   */
  async createSetupIntent(customerId: string): Promise<Stripe.SetupIntent> {
    const client = this.getClient();

    const setupIntent = await client.setupIntents.create({
      customer: customerId,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    console.info('[Stripe] SetupIntent created', {
      setupIntentId: setupIntent.id,
      customerId,
    });

    return setupIntent;
  }

  /**
   * Attach a payment method to a customer
   */
  async attachPaymentMethod(
    input: AttachPaymentMethodInput,
  ): Promise<Stripe.PaymentMethod> {
    const client = this.getClient();

    // Attach the payment method to the customer
    const paymentMethod = await client.paymentMethods.attach(
      input.paymentMethodId,
      {customer: input.customerId},
    );

    // Set as default if requested
    if (input.setAsDefault) {
      await client.customers.update(input.customerId, {
        invoice_settings: {
          default_payment_method: input.paymentMethodId,
        },
      });
    }

    console.info('[Stripe] Payment method attached', {
      paymentMethodId: paymentMethod.id,
      customerId: input.customerId,
      type: paymentMethod.type,
      setAsDefault: input.setAsDefault,
    });

    return paymentMethod;
  }

  /**
   * Detach a payment method from a customer
   */
  async detachPaymentMethod(paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    const client = this.getClient();
    const paymentMethod = await client.paymentMethods.detach(paymentMethodId);

    console.info('[Stripe] Payment method detached', {
      paymentMethodId,
    });

    return paymentMethod;
  }

  /**
   * Get a payment method by ID
   */
  async getPaymentMethod(paymentMethodId: string): Promise<Stripe.PaymentMethod | null> {
    const client = this.getClient();

    try {
      return await client.paymentMethods.retrieve(paymentMethodId);
    } catch (error) {
      if (error instanceof Stripe.errors.StripeError && error.code === 'resource_missing') {
        return null;
      }
      throw error;
    }
  }

  /**
   * List payment methods for a customer
   */
  async listPaymentMethods(
    customerId: string,
    type?: PaymentMethodType,
  ): Promise<Stripe.PaymentMethod[]> {
    const client = this.getClient();

    const params: Stripe.PaymentMethodListParams = {
      customer: customerId,
    };

    if (type) {
      params.type = type as Stripe.PaymentMethodListParams.Type;
    }

    const paymentMethods = await client.paymentMethods.list(params);
    return paymentMethods.data;
  }

  /**
   * Parse Stripe payment method into our model format
   */
  parsePaymentMethod(pm: Stripe.PaymentMethod): ParsedPaymentMethod {
    const result: ParsedPaymentMethod = {
      id: pm.id,
      type: pm.type as PaymentMethodType,
      billingDetails: pm.billing_details
        ? {
            name: pm.billing_details.name ?? undefined,
            email: pm.billing_details.email ?? undefined,
            address: pm.billing_details.address
              ? {
                  line1: pm.billing_details.address.line1 ?? undefined,
                  line2: pm.billing_details.address.line2 ?? undefined,
                  city: pm.billing_details.address.city ?? undefined,
                  state: pm.billing_details.address.state ?? undefined,
                  postalCode: pm.billing_details.address.postal_code ?? undefined,
                  country: pm.billing_details.address.country ?? undefined,
                }
              : undefined,
          }
        : undefined,
    };

    // Parse card details
    if (pm.type === 'card' && pm.card) {
      result.cardDetails = {
        brand: pm.card.brand,
        last4: pm.card.last4,
        expMonth: pm.card.exp_month,
        expYear: pm.card.exp_year,
        funding: pm.card.funding ?? undefined,
        country: pm.card.country ?? undefined,
      };
    }

    // Parse US bank account details
    if (pm.type === 'us_bank_account' && pm.us_bank_account) {
      result.bankAccountDetails = {
        bankName: pm.us_bank_account.bank_name ?? undefined,
        last4: pm.us_bank_account.last4 ?? '',
        accountHolderType: pm.us_bank_account.account_holder_type ?? undefined,
        routingNumber: pm.us_bank_account.routing_number ?? undefined,
      };
    }

    return result;
  }

  // ============================================
  // PAYMENT INTENTS
  // ============================================

  /**
   * Create a payment intent
   */
  async createPaymentIntent(
    input: CreatePaymentIntentInput,
  ): Promise<Stripe.PaymentIntent> {
    const client = this.getClient();

    const params: Stripe.PaymentIntentCreateParams = {
      amount: input.amount,
      currency: input.currency,
      description: input.description,
      receipt_email: input.receiptEmail,
      metadata: input.metadata,
    };

    if (input.customerId) {
      params.customer = input.customerId;
    }

    if (input.paymentMethodId) {
      params.payment_method = input.paymentMethodId;
      // IMPORTANT: Cannot use automatic_payment_methods when specifying a payment_method
      // Stripe rejects requests with both parameters set
    } else if (input.automaticPaymentMethods !== false) {
      // Only enable automatic payment methods when no specific payment method is provided
      params.automatic_payment_methods = {
        enabled: true,
      };
    }

    // Confirm immediately if requested
    if (input.confirm) {
      params.confirm = true;
    }

    // Off-session payment (no customer present)
    if (input.offSession !== undefined) {
      params.off_session = input.offSession;
    }

    const paymentIntent = await client.paymentIntents.create(params);

    console.info('[Stripe] PaymentIntent created', {
      paymentIntentId: paymentIntent.id,
      amount: input.amount,
      currency: input.currency,
      status: paymentIntent.status,
    });

    return paymentIntent;
  }

  /**
   * Get a payment intent by ID
   */
  async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent | null> {
    const client = this.getClient();

    try {
      return await client.paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      if (error instanceof Stripe.errors.StripeError && error.code === 'resource_missing') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Confirm a payment intent
   */
  async confirmPaymentIntent(
    paymentIntentId: string,
    paymentMethodId?: string,
  ): Promise<Stripe.PaymentIntent> {
    const client = this.getClient();

    const params: Stripe.PaymentIntentConfirmParams = {};
    if (paymentMethodId) {
      params.payment_method = paymentMethodId;
    }

    const paymentIntent = await client.paymentIntents.confirm(paymentIntentId, params);

    console.info('[Stripe] PaymentIntent confirmed', {
      paymentIntentId,
      status: paymentIntent.status,
    });

    return paymentIntent;
  }

  /**
   * Cancel a payment intent
   */
  async cancelPaymentIntent(
    paymentIntentId: string,
    reason?: Stripe.PaymentIntentCancelParams.CancellationReason,
  ): Promise<Stripe.PaymentIntent> {
    const client = this.getClient();

    const paymentIntent = await client.paymentIntents.cancel(paymentIntentId, {
      cancellation_reason: reason,
    });

    console.info('[Stripe] PaymentIntent cancelled', {
      paymentIntentId,
      reason,
    });

    return paymentIntent;
  }

  /**
   * Map Stripe payment intent status to our enum
   */
  mapPaymentIntentStatus(stripeStatus: Stripe.PaymentIntent.Status): PaymentIntentStatus {
    const statusMap: Record<Stripe.PaymentIntent.Status, PaymentIntentStatus> = {
      requires_payment_method: PaymentIntentStatus.REQUIRES_PAYMENT_METHOD,
      requires_confirmation: PaymentIntentStatus.REQUIRES_CONFIRMATION,
      requires_action: PaymentIntentStatus.REQUIRES_ACTION,
      processing: PaymentIntentStatus.PROCESSING,
      requires_capture: PaymentIntentStatus.REQUIRES_CAPTURE,
      canceled: PaymentIntentStatus.CANCELLED,
      succeeded: PaymentIntentStatus.SUCCEEDED,
    };

    return statusMap[stripeStatus] || PaymentIntentStatus.REQUIRES_PAYMENT_METHOD;
  }

  // ============================================
  // WEBHOOKS
  // ============================================

  /**
   * Construct and verify a webhook event from the raw body and signature
   */
  constructWebhookEvent(
    rawBody: string | Buffer,
    signature: string,
  ): Stripe.Event {
    const client = this.getClient();

    if (!this.webhookSecret) {
      throw new Error('Webhook secret is not configured');
    }

    return client.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
  }

  /**
   * Verify webhook signature without constructing full event
   */
  verifyWebhookSignature(
    rawBody: string | Buffer,
    signature: string,
  ): boolean {
    try {
      this.constructWebhookEvent(rawBody, signature);
      return true;
    } catch {
      return false;
    }
  }

  // ============================================
  // INVOICES (Stripe Billing)
  // ============================================

  /**
   * Create a Stripe invoice for a customer
   */
  async createInvoice(
    customerId: string,
    options?: {
      autoAdvance?: boolean;
      collectionMethod?: 'charge_automatically' | 'send_invoice';
      dueDate?: number;
      metadata?: Record<string, string>;
    },
  ): Promise<Stripe.Invoice> {
    const client = this.getClient();

    const invoice = await client.invoices.create({
      customer: customerId,
      auto_advance: options?.autoAdvance ?? true,
      collection_method: options?.collectionMethod ?? 'charge_automatically',
      due_date: options?.dueDate,
      metadata: options?.metadata,
    });

    console.info('[Stripe] Invoice created', {
      invoiceId: invoice.id,
      customerId,
    });

    return invoice;
  }

  /**
   * Add an invoice item to a customer (will be added to next invoice)
   */
  async createInvoiceItem(
    customerId: string,
    amount: number,
    currency: string,
    description?: string,
    invoiceId?: string,
  ): Promise<Stripe.InvoiceItem> {
    const client = this.getClient();

    return client.invoiceItems.create({
      customer: customerId,
      amount,
      currency,
      description,
      invoice: invoiceId,
    });
  }

  /**
   * Finalize and send an invoice
   */
  async finalizeInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    const client = this.getClient();
    return client.invoices.finalizeInvoice(invoiceId);
  }

  /**
   * Pay an invoice immediately
   */
  async payInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    const client = this.getClient();
    return client.invoices.pay(invoiceId);
  }
}
