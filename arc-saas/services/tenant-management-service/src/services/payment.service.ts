import {BindingScope, inject, injectable} from '@loopback/core';
import {repository} from '@loopback/repository';
import {ILogger, LOGGER} from '@sourceloop/core';
import {
  PaymentIntentRepository,
  PaymentMethodRepository,
  InvoiceRepository,
  TenantRepository,
} from '../repositories';
import {PaymentIntent, PaymentMethod, Invoice} from '../models';
import {PaymentIntentStatus, InvoiceStatus} from '../enums';
import {StripeService} from './stripe.service';
import {HttpErrors} from '@loopback/rest';

/**
 * Result of initiating an invoice payment
 */
export interface PayInvoiceResult {
  paymentIntent: PaymentIntent;
  clientSecret?: string;
  requiresAction: boolean;
  status: PaymentIntentStatus;
}

/**
 * Payment Service
 *
 * Orchestrates payment operations between invoices, payment methods,
 * and Stripe. Provides high-level payment flows:
 *
 * 1. Pay an invoice with a saved payment method
 * 2. Create payment intents for invoices
 * 3. Handle payment lifecycle and status updates
 */
@injectable({scope: BindingScope.SINGLETON})
export class PaymentService {
  constructor(
    @repository(PaymentIntentRepository)
    private readonly paymentIntentRepo: PaymentIntentRepository,
    @repository(PaymentMethodRepository)
    private readonly paymentMethodRepo: PaymentMethodRepository,
    @repository(InvoiceRepository)
    private readonly invoiceRepo: InvoiceRepository,
    @repository(TenantRepository)
    private readonly tenantRepo: TenantRepository,
    @inject('services.StripeService')
    private readonly stripeService: StripeService,
    @inject(LOGGER.LOGGER_INJECT)
    private readonly logger: ILogger,
  ) {}

  /**
   * Pay an invoice using the tenant's default payment method
   * or a specified payment method.
   *
   * @param invoiceId - The invoice to pay
   * @param tenantId - The tenant making the payment
   * @param paymentMethodId - Optional specific payment method to use
   * @returns Payment result with status and any required actions
   */
  async payInvoice(
    invoiceId: string,
    tenantId: string,
    paymentMethodId?: string,
  ): Promise<PayInvoiceResult> {
    // Validate invoice exists and belongs to tenant
    const invoice = await this.invoiceRepo.findOne({
      where: {
        id: invoiceId,
        tenantId,
        deleted: false,
      } as object,
    });

    if (!invoice) {
      throw new HttpErrors.NotFound('Invoice not found');
    }

    if (invoice.status === InvoiceStatus.PAID) {
      throw new HttpErrors.BadRequest('Invoice is already paid');
    }

    // Get payment method
    const paymentMethod = await this.getPaymentMethodForPayment(
      tenantId,
      paymentMethodId,
    );

    if (!paymentMethod) {
      throw new HttpErrors.BadRequest(
        'No payment method available. Please add a payment method first.',
      );
    }

    // Check for existing active payment intent
    const existingIntent = await this.findActivePaymentIntentForInvoice(
      invoiceId,
    );

    if (existingIntent) {
      // Return existing payment intent if it's still active
      // Convert amounts from cents to dollars for API response
      return {
        paymentIntent: this.convertPaymentIntentForResponse(existingIntent),
        clientSecret: existingIntent.clientSecret ?? undefined,
        requiresAction:
          existingIntent.status === PaymentIntentStatus.REQUIRES_ACTION,
        status: existingIntent.status,
      };
    }

    // Create new payment intent
    return this.createPaymentIntentForInvoice(invoice, paymentMethod);
  }

  /**
   * Create a payment intent for an invoice
   * Can be called manually or automatically when invoice is created
   */
  async createPaymentIntentForInvoice(
    invoice: Invoice,
    paymentMethod: PaymentMethod,
  ): Promise<PayInvoiceResult> {
    if (!this.stripeService.isEnabled()) {
      throw new HttpErrors.ServiceUnavailable(
        'Payment processing is not configured',
      );
    }

    if (!paymentMethod.stripeCustomerId || !paymentMethod.stripePaymentMethodId) {
      throw new HttpErrors.BadRequest('Invalid payment method configuration');
    }

    this.logger.info(
      `[Payment] Creating payment intent for invoice ${invoice.id}`,
    );

    // Convert dollars to cents for Stripe (Stripe expects smallest currency unit)
    const amountInCents = this.convertToCents(invoice.amount, invoice.currencyCode || 'usd');

    // Create Stripe payment intent
    const stripePaymentIntent = await this.stripeService.createPaymentIntent({
      amount: amountInCents,
      currency: invoice.currencyCode || 'usd',
      customerId: paymentMethod.stripeCustomerId,
      paymentMethodId: paymentMethod.stripePaymentMethodId,
      metadata: {
        invoiceId: invoice.id,
        tenantId: invoice.tenantId,
      },
      description: `Payment for Invoice #${invoice.id}`,
      confirm: true, // Attempt to confirm immediately
      offSession: false, // Allow customer authentication
    });

    // Map Stripe status to our status
    const status = this.mapStripeStatus(stripePaymentIntent.status);

    // Create local payment intent record
    const paymentIntent = await this.paymentIntentRepo.create({
      tenantId: invoice.tenantId,
      invoiceId: invoice.id,
      stripePaymentIntentId: stripePaymentIntent.id,
      stripeCustomerId: paymentMethod.stripeCustomerId,
      stripePaymentMethodId: paymentMethod.stripePaymentMethodId,
      amount: stripePaymentIntent.amount,
      currency: stripePaymentIntent.currency,
      status,
      clientSecret: stripePaymentIntent.client_secret ?? undefined,
      description: `Payment for Invoice #${invoice.id}`,
    });

    // Update invoice status if payment succeeded
    if (status === PaymentIntentStatus.SUCCEEDED) {
      await this.markInvoicePaid(invoice.id, paymentIntent.id);
    }

    this.logger.info(
      `[Payment] Created payment intent ${paymentIntent.id} with status ${status}`,
    );

    // Convert amounts from cents to dollars for API response
    return {
      paymentIntent: this.convertPaymentIntentForResponse(paymentIntent),
      clientSecret: stripePaymentIntent.client_secret ?? undefined,
      requiresAction: status === PaymentIntentStatus.REQUIRES_ACTION,
      status,
    };
  }

  /**
   * Get payment method for a payment
   * Uses specified method or falls back to default
   */
  private async getPaymentMethodForPayment(
    tenantId: string,
    paymentMethodId?: string,
  ): Promise<PaymentMethod | null> {
    if (paymentMethodId) {
      return this.paymentMethodRepo.findOne({
        where: {
          id: paymentMethodId,
          tenantId,
          deleted: false,
        } as object,
      });
    }

    // Get default payment method
    return this.paymentMethodRepo.findOne({
      where: {
        tenantId,
        isDefault: true,
        deleted: false,
      } as object,
    });
  }

  /**
   * Find active payment intent for an invoice
   */
  private async findActivePaymentIntentForInvoice(
    invoiceId: string,
  ): Promise<PaymentIntent | null> {
    const intents = await this.paymentIntentRepo.find({
      where: {
        invoiceId,
        deleted: false,
      } as object,
      order: ['createdOn DESC'],
    });

    // Find an active intent (not cancelled, not succeeded)
    return (
      intents.find(
        pi =>
          pi.status !== PaymentIntentStatus.CANCELLED &&
          pi.status !== PaymentIntentStatus.SUCCEEDED,
      ) ?? null
    );
  }

  /**
   * Mark an invoice as paid
   */
  private async markInvoicePaid(
    invoiceId: string,
    paymentIntentId: string,
  ): Promise<void> {
    await this.invoiceRepo.updateById(invoiceId, {
      status: InvoiceStatus.PAID,
    });

    this.logger.info(
      `[Payment] Invoice ${invoiceId} marked as paid via payment intent ${paymentIntentId}`,
    );
  }

  /**
   * Map Stripe payment intent status to our status enum
   */
  private mapStripeStatus(
    stripeStatus: string,
  ): PaymentIntentStatus {
    switch (stripeStatus) {
      case 'requires_payment_method':
        return PaymentIntentStatus.REQUIRES_PAYMENT_METHOD;
      case 'requires_confirmation':
        return PaymentIntentStatus.REQUIRES_CONFIRMATION;
      case 'requires_action':
        return PaymentIntentStatus.REQUIRES_ACTION;
      case 'processing':
        return PaymentIntentStatus.PROCESSING;
      case 'requires_capture':
        return PaymentIntentStatus.REQUIRES_CAPTURE;
      case 'canceled':
        return PaymentIntentStatus.CANCELLED;
      case 'succeeded':
        return PaymentIntentStatus.SUCCEEDED;
      default:
        return PaymentIntentStatus.REQUIRES_PAYMENT_METHOD;
    }
  }

  /**
   * Convert amount from major currency unit (dollars) to minor unit (cents)
   * Stripe expects amounts in the smallest currency unit.
   * For zero-decimal currencies (JPY, etc.), no conversion is needed.
   */
  private convertToCents(amount: number, currency: string): number {
    // Zero-decimal currencies that don't need conversion
    const zeroDecimalCurrencies = [
      'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga',
      'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf',
    ];

    if (zeroDecimalCurrencies.includes(currency.toLowerCase())) {
      return Math.round(amount);
    }

    // For standard currencies, multiply by 100 to get cents
    return Math.round(amount * 100);
  }

  /**
   * Convert amount from minor currency unit (cents) to major unit (dollars)
   * Used when displaying amounts from Stripe back to users.
   */
  private convertFromCents(amountInCents: number, currency: string): number {
    const zeroDecimalCurrencies = [
      'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga',
      'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf',
    ];

    if (zeroDecimalCurrencies.includes(currency.toLowerCase())) {
      return amountInCents;
    }

    return amountInCents / 100;
  }

  /**
   * Convert a PaymentIntent's amount fields from cents to dollars for API responses.
   * Creates a new object to avoid mutating the original.
   */
  private convertPaymentIntentForResponse(paymentIntent: PaymentIntent): PaymentIntent {
    const currency = paymentIntent.currency || 'usd';
    return {
      ...paymentIntent,
      amount: this.convertFromCents(paymentIntent.amount, currency),
      amountReceived: paymentIntent.amountReceived
        ? this.convertFromCents(paymentIntent.amountReceived, currency)
        : undefined,
    } as PaymentIntent;
  }

  /**
   * Retry a failed payment for an invoice
   * Creates a new payment intent with the same or different payment method
   */
  async retryPayment(
    invoiceId: string,
    tenantId: string,
    paymentMethodId?: string,
  ): Promise<PayInvoiceResult> {
    const invoice = await this.invoiceRepo.findOne({
      where: {
        id: invoiceId,
        tenantId,
        deleted: false,
      } as object,
    });

    if (!invoice) {
      throw new HttpErrors.NotFound('Invoice not found');
    }

    if (invoice.status === InvoiceStatus.PAID) {
      throw new HttpErrors.BadRequest('Invoice is already paid');
    }

    // Cancel any existing active payment intents
    const existingIntent = await this.findActivePaymentIntentForInvoice(
      invoiceId,
    );
    if (existingIntent && existingIntent.stripePaymentIntentId) {
      try {
        await this.stripeService.cancelPaymentIntent(
          existingIntent.stripePaymentIntentId,
        );
        await this.paymentIntentRepo.updateById(existingIntent.id, {
          status: PaymentIntentStatus.CANCELLED,
          cancelledAt: new Date().toISOString(),
          cancellationReason: 'retry_requested',
        });
      } catch (error) {
        this.logger.warn(
          `[Payment] Failed to cancel existing payment intent: ${error}`,
        );
      }
    }

    // Create new payment
    return this.payInvoice(invoiceId, tenantId, paymentMethodId);
  }

  /**
   * Get payment status for an invoice
   */
  async getInvoicePaymentStatus(
    invoiceId: string,
    tenantId: string,
  ): Promise<{
    invoice: Invoice;
    paymentIntents: PaymentIntent[];
    currentStatus: InvoiceStatus;
  }> {
    const invoice = await this.invoiceRepo.findOne({
      where: {
        id: invoiceId,
        tenantId,
        deleted: false,
      } as object,
    });

    if (!invoice) {
      throw new HttpErrors.NotFound('Invoice not found');
    }

    const paymentIntents = await this.paymentIntentRepo.find({
      where: {
        invoiceId,
        deleted: false,
      } as object,
      order: ['createdOn DESC'],
    });

    // Convert all payment intent amounts from cents to dollars for API response
    const convertedPaymentIntents = paymentIntents.map(pi =>
      this.convertPaymentIntentForResponse(pi),
    );

    return {
      invoice,
      paymentIntents: convertedPaymentIntents,
      currentStatus: invoice.status,
    };
  }

  /**
   * Calculate revenue for a tenant from successful payments
   */
  async getTenantRevenue(
    tenantId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    totalRevenue: number;
    currency: string;
    paymentCount: number;
  }> {
    const where: Record<string, unknown> = {
      tenantId,
      status: PaymentIntentStatus.SUCCEEDED,
      deleted: false,
    };

    if (startDate) {
      where.succeededAt = {gte: startDate.toISOString()};
    }
    if (endDate) {
      where.succeededAt = {...(where.succeededAt as object), lte: endDate.toISOString()};
    }

    const successfulPayments = await this.paymentIntentRepo.find({
      where: where as object,
    });

    // Sum up all payments (amounts are stored in cents)
    const totalRevenueInCents = successfulPayments.reduce(
      (sum, pi) => sum + (pi.amountReceived || pi.amount),
      0,
    );

    // Convert from cents to dollars for API response
    // Note: For mixed-currency payments, we would need more sophisticated handling
    const currency = 'usd';
    const totalRevenue = this.convertFromCents(totalRevenueInCents, currency);

    return {
      totalRevenue,
      currency,
      paymentCount: successfulPayments.length,
    };
  }
}
