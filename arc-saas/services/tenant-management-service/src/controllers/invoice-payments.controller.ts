import {inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {
  get,
  HttpErrors,
  param,
  post,
  requestBody,
} from '@loopback/rest';
import {
  CONTENT_TYPE,
  getModelSchemaRefSF,
  IAuthUserWithPermissions,
  ILogger,
  LOGGER,
  OPERATION_SECURITY_SPEC,
  STATUS_CODE,
} from '@sourceloop/core';
import {
  authenticate,
  AuthenticationBindings,
  STRATEGY,
} from 'loopback4-authentication';
import {authorize} from 'loopback4-authorization';
import {InvoiceRepository} from '../repositories';
import {PaymentIntent, Invoice} from '../models';
import {InvoiceStatus} from '../enums';
import {PermissionKey} from '../permissions';
import {PaymentService, PayInvoiceResult} from '../services/payment.service';

const basePath = '/invoices';

/**
 * DTO for paying an invoice
 */
interface PayInvoiceDto {
  /** Optional payment method ID (uses default if not specified) */
  paymentMethodId?: string;
}

/**
 * Invoice Payments Controller
 *
 * Provides endpoints for paying invoices:
 * - Pay an invoice (with default or specified payment method)
 * - Retry a failed payment
 * - Get payment status for an invoice
 */
export class InvoicePaymentsController {
  constructor(
    @repository(InvoiceRepository)
    public invoiceRepository: InvoiceRepository,
    @inject('services.PaymentService')
    private readonly paymentService: PaymentService,
    @inject(AuthenticationBindings.CURRENT_USER, {optional: true})
    private readonly currentUser?: IAuthUserWithPermissions,
    @inject(LOGGER.LOGGER_INJECT)
    private readonly logger?: ILogger,
  ) {}

  /**
   * Get the current user's tenant ID
   */
  private getTenantId(): string {
    if (!this.currentUser?.tenantId) {
      throw new HttpErrors.Forbidden('Tenant context required');
    }
    return this.currentUser.tenantId;
  }

  /**
   * Pay an invoice using saved payment method
   *
   * This will:
   * 1. Look up the invoice
   * 2. Get the default or specified payment method
   * 3. Create a Stripe payment intent and attempt to charge
   * 4. Return the result (may require additional action like 3DS)
   */
  @authorize({
    permissions: [PermissionKey.CreateBillingPaymentSource],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @post(`${basePath}/{id}/pay`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Payment initiated for invoice',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
              properties: {
                paymentIntent: getModelSchemaRefSF(PaymentIntent),
                clientSecret: {
                  type: 'string',
                  description: 'Stripe client secret for 3DS confirmation',
                },
                requiresAction: {
                  type: 'boolean',
                  description: 'Whether additional user action is needed',
                },
                status: {
                  type: 'string',
                  description: 'Current payment status',
                },
              },
            },
          },
        },
      },
    },
  })
  async payInvoice(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: {
            type: 'object',
            properties: {
              paymentMethodId: {
                type: 'string',
                description: 'Optional payment method ID (uses default if not specified)',
              },
            },
          },
        },
      },
    })
    dto?: PayInvoiceDto,
  ): Promise<PayInvoiceResult> {
    const tenantId = this.getTenantId();

    this.logger?.info(
      `[InvoicePayments] Pay invoice ${id} for tenant ${tenantId}`,
    );

    return this.paymentService.payInvoice(
      id,
      tenantId,
      dto?.paymentMethodId,
    );
  }

  /**
   * Retry a failed invoice payment
   *
   * Cancels any existing active payment intent and creates a new one.
   * Optionally use a different payment method.
   */
  @authorize({
    permissions: [PermissionKey.CreateBillingPaymentSource],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @post(`${basePath}/{id}/retry-payment`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Payment retry initiated for invoice',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
              properties: {
                paymentIntent: getModelSchemaRefSF(PaymentIntent),
                clientSecret: {
                  type: 'string',
                  description: 'Stripe client secret for 3DS confirmation',
                },
                requiresAction: {
                  type: 'boolean',
                  description: 'Whether additional user action is needed',
                },
                status: {
                  type: 'string',
                  description: 'Current payment status',
                },
              },
            },
          },
        },
      },
    },
  })
  async retryPayment(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: {
            type: 'object',
            properties: {
              paymentMethodId: {
                type: 'string',
                description: 'Optional payment method ID (uses default if not specified)',
              },
            },
          },
        },
      },
    })
    dto?: PayInvoiceDto,
  ): Promise<PayInvoiceResult> {
    const tenantId = this.getTenantId();

    this.logger?.info(
      `[InvoicePayments] Retry payment for invoice ${id}, tenant ${tenantId}`,
    );

    return this.paymentService.retryPayment(
      id,
      tenantId,
      dto?.paymentMethodId,
    );
  }

  /**
   * Get payment status for an invoice
   *
   * Returns the invoice and all associated payment intents
   */
  @authorize({
    permissions: [PermissionKey.GetBillingInvoice],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/{id}/payment-status`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Payment status for invoice',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
              properties: {
                invoice: getModelSchemaRefSF(Invoice),
                paymentIntents: {
                  type: 'array',
                  items: getModelSchemaRefSF(PaymentIntent),
                },
                currentStatus: {
                  type: 'string',
                  description: 'Current invoice status',
                },
              },
            },
          },
        },
      },
    },
  })
  async getPaymentStatus(
    @param.path.string('id') id: string,
  ): Promise<{
    invoice: Invoice;
    paymentIntents: PaymentIntent[];
    currentStatus: InvoiceStatus;
  }> {
    const tenantId = this.getTenantId();
    return this.paymentService.getInvoicePaymentStatus(id, tenantId);
  }
}
