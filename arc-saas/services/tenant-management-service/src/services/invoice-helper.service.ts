import pdfDocument from 'pdfkit';
import fs from 'node:fs';
import {Invoice} from '../models';
import {repository} from '@loopback/repository';
import {InvoiceRepository, PaymentMethodRepository} from '../repositories';
import {BindingScope, inject, injectable} from '@loopback/context';
import {ILogger, LOGGER} from '@sourceloop/core';
import {InvoiceStatus} from '../enums';
import {PaymentService} from './payment.service';
import {StripeService} from './stripe.service';
const LARGE_SIZE = 16;
const MEDIUM_SIZE = 12;

/**
 * Options for invoice creation with auto-payment behavior
 */
export interface CreateInvoiceOptions {
  /** If true, automatically create a PaymentIntent for this invoice */
  autoCreatePaymentIntent?: boolean;
  /** If true, immediately confirm the PaymentIntent (charge the customer) */
  autoConfirm?: boolean;
}

@injectable({scope: BindingScope.TRANSIENT})
export class InvoiceHelperService {
  constructor(
    @repository(InvoiceRepository)
    private readonly invoiceRepository: InvoiceRepository,
    @repository(PaymentMethodRepository)
    private readonly paymentMethodRepository: PaymentMethodRepository,
    @inject('services.PaymentService', {optional: true})
    private readonly paymentService?: PaymentService,
    @inject('services.StripeService', {optional: true})
    private readonly stripeService?: StripeService,
    @inject(LOGGER.LOGGER_INJECT, {optional: true})
    private readonly logger?: ILogger,
  ) {}

  /**
   * Create an invoice with optional auto-payment intent creation.
   *
   * @param invoice - Invoice data (without id)
   * @param options - Options for auto-payment behavior
   * @returns The created invoice
   */
  async createInvoice(
    invoice: Omit<Invoice, 'id'>,
    options?: CreateInvoiceOptions,
  ): Promise<Invoice> {
    // Create the invoice first
    const createdInvoice = await this.invoiceRepository.create(invoice);

    // Auto-create PaymentIntent if enabled and Stripe is configured
    if (options?.autoCreatePaymentIntent && this.stripeService?.isEnabled()) {
      await this.autoCreatePaymentIntentForInvoice(createdInvoice, options.autoConfirm);
    }

    return createdInvoice;
  }

  /**
   * Auto-create a PaymentIntent for an invoice if the tenant has a default payment method.
   * This enables automatic payment collection when the invoice is due.
   *
   * @param invoice - The invoice to create a payment intent for
   * @param autoConfirm - If true, immediately attempt to charge the customer
   */
  private async autoCreatePaymentIntentForInvoice(
    invoice: Invoice,
    autoConfirm?: boolean,
  ): Promise<void> {
    if (!this.paymentService) {
      this.logger?.warn('[InvoiceHelper] PaymentService not available, skipping auto PaymentIntent creation');
      return;
    }

    // Only create payment intents for pending invoices
    if (invoice.status !== InvoiceStatus.PENDING) {
      this.logger?.info(`[InvoiceHelper] Invoice ${invoice.id} is not pending (status: ${invoice.status}), skipping PaymentIntent`);
      return;
    }

    try {
      // Check if tenant has a default payment method
      const defaultPaymentMethod = await this.paymentMethodRepository.findOne({
        where: {
          tenantId: invoice.tenantId,
          isDefault: true,
          deleted: false,
        } as object,
      });

      if (!defaultPaymentMethod) {
        this.logger?.info(`[InvoiceHelper] Tenant ${invoice.tenantId} has no default payment method, skipping auto PaymentIntent`);
        return;
      }

      // Create the payment intent
      this.logger?.info(`[InvoiceHelper] Auto-creating PaymentIntent for invoice ${invoice.id}`);

      const result = await this.paymentService.payInvoice(
        invoice.id,
        invoice.tenantId,
        defaultPaymentMethod.id,
      );

      this.logger?.info(
        `[InvoiceHelper] PaymentIntent ${result.paymentIntent.id} created for invoice ${invoice.id} with status ${result.status}`,
      );

      // If auto-confirm is not requested and the payment succeeded immediately, log it
      if (result.status === 'succeeded') {
        this.logger?.info(`[InvoiceHelper] Invoice ${invoice.id} was paid immediately`);
      } else if (result.requiresAction) {
        this.logger?.info(`[InvoiceHelper] Invoice ${invoice.id} requires customer action (3D Secure, etc.)`);
      }
    } catch (error) {
      // Don't fail invoice creation if payment intent creation fails
      // The invoice can still be paid manually later
      this.logger?.warn(
        `[InvoiceHelper] Failed to auto-create PaymentIntent for invoice ${invoice.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  async downloadInvoice(id: string): Promise<void> {
    const invoice = await this.invoiceRepository.findById(id);
    if (!invoice) {
      throw new Error('Invoice with given id does not exist');
    }

    const pdfFilePath = await this.generatePDF(invoice);
    invoice.invoiceFile = pdfFilePath;
    await this.invoiceRepository.updateById(invoice.id, invoice);
  }

  async generatePDF(invoice: Invoice): Promise<string> {
    const doc = new pdfDocument();
    const fileName = `invoice_${invoice.id}.pdf`;
    const writeStream = fs.createWriteStream(fileName);

    doc.pipe(writeStream);

    // Write invoice details to PDF
    doc
      .fontSize(LARGE_SIZE)
      .text('Invoice Details', {underline: true})
      .moveDown();
    doc.fontSize(MEDIUM_SIZE).text(`Invoice ID: ${invoice.id}`).moveDown();
    doc
      .fontSize(MEDIUM_SIZE)
      .text(`Start Date: ${invoice.startDate}`)
      .moveDown();
    doc.fontSize(MEDIUM_SIZE).text(`End Date: ${invoice.endDate}`).moveDown();
    doc
      .fontSize(MEDIUM_SIZE)
      .text(`Amount: ${invoice.amount} ${invoice.currencyCode}`)
      .moveDown();
    doc.fontSize(MEDIUM_SIZE).text(`Due Date: ${invoice.dueDate}`).moveDown();
    doc.fontSize(MEDIUM_SIZE).text(`Status: ${invoice.status}`).moveDown();

    // End PDF generation
    doc.end();

    return new Promise<string>((resolve, reject) => {
      writeStream.on('finish', () => {
        resolve(fileName);
      });
      writeStream.on('error', err => {
        reject(err);
      });
    });
  }
}
