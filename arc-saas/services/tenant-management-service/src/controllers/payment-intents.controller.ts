import {inject} from '@loopback/core';
import {
  Count,
  CountSchema,
  Filter,
  repository,
  Where,
} from '@loopback/repository';
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
import {
  PaymentIntentRepository,
  PaymentMethodRepository,
  InvoiceRepository,
  TenantRepository,
} from '../repositories';
import {PaymentIntent} from '../models';
import {PermissionKey} from '../permissions';
import {StripeService} from '../services/stripe.service';
import {PaymentIntentStatus} from '../enums';

const basePath = '/payment-intents';

/**
 * Zero-decimal currencies that don't need conversion
 */
const ZERO_DECIMAL_CURRENCIES = [
  'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga',
  'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf',
];

/**
 * DTO for creating a new payment intent
 */
interface CreatePaymentIntentDto {
  /** Amount in cents */
  amount: number;
  /** Currency code (e.g., 'usd') */
  currency: string;
  /** Optional invoice ID to link the payment to */
  invoiceId?: string;
  /** Optional payment method ID to use */
  paymentMethodId?: string;
  /** Description for the payment */
  description?: string;
  /** Email to send receipt to */
  receiptEmail?: string;
}

/**
 * Payment Intent response with client secret
 */
interface PaymentIntentResponse {
  id: string;
  clientSecret: string;
  status: PaymentIntentStatus;
  amount: number;
  currency: string;
}

/**
 * Payment Intents Controller
 *
 * Manages payment intents for processing payments. Payment intents represent
 * the intent to collect payment from a customer.
 *
 * Flow:
 * 1. Create a payment intent (returns clientSecret)
 * 2. Frontend uses clientSecret with Stripe.js to confirm payment
 * 3. Stripe webhook notifies us of success/failure
 * 4. Status is updated automatically via webhook
 */
export class PaymentIntentsController {
  constructor(
    @repository(PaymentIntentRepository)
    public paymentIntentRepository: PaymentIntentRepository,
    @repository(PaymentMethodRepository)
    public paymentMethodRepository: PaymentMethodRepository,
    @repository(InvoiceRepository)
    public invoiceRepository: InvoiceRepository,
    @repository(TenantRepository)
    public tenantRepository: TenantRepository,
    @inject('services.StripeService')
    private readonly stripeService: StripeService,
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
   * Convert amount from cents to dollars for API response.
   * Zero-decimal currencies (JPY, KRW, etc.) are not converted.
   */
  private convertFromCents(amountInCents: number, currency: string): number {
    if (ZERO_DECIMAL_CURRENCIES.includes(currency.toLowerCase())) {
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
   * Get Stripe customer ID for the tenant
   * Looks for existing customer ID in payment methods
   */
  private async getStripeCustomerId(tenantId: string): Promise<string | null> {
    // Check if we have the customer ID in any existing payment method
    const existingPaymentMethods =
      await this.paymentMethodRepository.findByTenantId(tenantId);
    if (existingPaymentMethods.length > 0 && existingPaymentMethods[0].stripeCustomerId) {
      return existingPaymentMethods[0].stripeCustomerId;
    }
    return null;
  }

  /**
   * Create a new payment intent
   *
   * Creates a payment intent in Stripe and stores a local record.
   * The client secret can be used with Stripe.js to complete the payment.
   */
  @authorize({
    permissions: [PermissionKey.CreateBillingInvoice],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @post(basePath, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'PaymentIntent created',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
              properties: {
                id: {type: 'string'},
                clientSecret: {type: 'string'},
                status: {type: 'string'},
                amount: {type: 'number'},
                currency: {type: 'string'},
              },
            },
          },
        },
      },
    },
  })
  async create(
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: {
            type: 'object',
            required: ['amount', 'currency'],
            properties: {
              amount: {
                type: 'number',
                description: 'Amount in cents',
                minimum: 50, // Stripe minimum
              },
              currency: {
                type: 'string',
                description: 'Currency code (e.g., usd)',
              },
              invoiceId: {
                type: 'string',
                description: 'Invoice to link this payment to',
              },
              paymentMethodId: {
                type: 'string',
                description: 'Payment method to use',
              },
              description: {
                type: 'string',
                description: 'Payment description',
              },
              receiptEmail: {
                type: 'string',
                description: 'Email for receipt',
              },
            },
          },
        },
      },
    })
    dto: CreatePaymentIntentDto,
  ): Promise<PaymentIntentResponse> {
    if (!this.stripeService.isEnabled()) {
      throw new HttpErrors.ServiceUnavailable(
        'Payment processing is not configured',
      );
    }

    const tenantId = this.getTenantId();

    // Validate invoice if provided
    if (dto.invoiceId) {
      const invoice = await this.invoiceRepository.findOne({
        where: {id: dto.invoiceId, tenantId} as object,
      });
      if (!invoice) {
        throw new HttpErrors.NotFound('Invoice not found');
      }
    }

    // Get Stripe payment method ID if local ID provided
    let stripePaymentMethodId: string | undefined;
    if (dto.paymentMethodId) {
      const pm = await this.paymentMethodRepository.findOne({
        where: {
          id: dto.paymentMethodId,
          tenantId,
          deleted: false,
        } as object,
      });
      if (!pm) {
        throw new HttpErrors.NotFound('Payment method not found');
      }
      stripePaymentMethodId = pm.stripePaymentMethodId;
    }

    // Get Stripe customer ID
    const stripeCustomerId = await this.getStripeCustomerId(tenantId);

    // Create Stripe payment intent
    const stripePaymentIntent = await this.stripeService.createPaymentIntent({
      amount: dto.amount,
      currency: dto.currency.toLowerCase(),
      customerId: stripeCustomerId || undefined,
      paymentMethodId: stripePaymentMethodId,
      description: dto.description,
      receiptEmail: dto.receiptEmail,
      metadata: {
        tenantId,
        ...(dto.invoiceId && {invoiceId: dto.invoiceId}),
      },
    });

    // Create local record
    const paymentIntent = await this.paymentIntentRepository.create({
      tenantId,
      stripePaymentIntentId: stripePaymentIntent.id,
      stripePaymentMethodId: stripePaymentMethodId,
      amount: dto.amount,
      currency: dto.currency.toLowerCase(),
      status: this.stripeService.mapPaymentIntentStatus(
        stripePaymentIntent.status,
      ),
      invoiceId: dto.invoiceId,
      description: dto.description,
      receiptEmail: dto.receiptEmail,
      clientSecret: stripePaymentIntent.client_secret || undefined,
    });

    this.logger?.info(
      `[PaymentIntents] Created payment intent ${paymentIntent.id} for tenant ${tenantId}`,
    );

    // Convert amount from cents to dollars for API response
    return {
      id: paymentIntent.id,
      clientSecret: stripePaymentIntent.client_secret!,
      status: paymentIntent.status,
      amount: this.convertFromCents(paymentIntent.amount, paymentIntent.currency),
      currency: paymentIntent.currency,
    };
  }

  /**
   * Create a payment intent for an invoice
   *
   * Convenience endpoint to create a payment intent from an invoice.
   * Uses the invoice amount and links the payment to the invoice.
   */
  @authorize({
    permissions: [PermissionKey.CreateBillingInvoice],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @post(`${basePath}/for-invoice/{invoiceId}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'PaymentIntent created for invoice',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
              properties: {
                id: {type: 'string'},
                clientSecret: {type: 'string'},
                status: {type: 'string'},
                amount: {type: 'number'},
                currency: {type: 'string'},
              },
            },
          },
        },
      },
    },
  })
  async createForInvoice(
    @param.path.string('invoiceId') invoiceId: string,
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: {
            type: 'object',
            properties: {
              paymentMethodId: {
                type: 'string',
                description: 'Payment method to use (optional)',
              },
            },
          },
        },
      },
    })
    dto?: {paymentMethodId?: string},
  ): Promise<PaymentIntentResponse> {
    const tenantId = this.getTenantId();

    // Get the invoice
    const invoice = await this.invoiceRepository.findOne({
      where: {id: invoiceId, tenantId} as object,
    });

    if (!invoice) {
      throw new HttpErrors.NotFound('Invoice not found');
    }

    // Check if payment intent already exists for this invoice
    const existingIntent =
      await this.paymentIntentRepository.findByInvoiceId(invoiceId);
    const activeIntent = existingIntent.find(
      pi =>
        pi.status !== PaymentIntentStatus.CANCELLED &&
        pi.status !== PaymentIntentStatus.SUCCEEDED,
    );

    if (activeIntent) {
      // Return existing active payment intent (convert amount from cents to dollars)
      return {
        id: activeIntent.id,
        clientSecret: activeIntent.clientSecret!,
        status: activeIntent.status,
        amount: this.convertFromCents(activeIntent.amount, activeIntent.currency),
        currency: activeIntent.currency,
      };
    }

    // Create new payment intent
    return this.create({
      amount: invoice.amount,
      currency: invoice.currencyCode || 'usd',
      invoiceId,
      paymentMethodId: dto?.paymentMethodId,
      description: `Payment for Invoice #${invoice.id}`,
    });
  }

  @authorize({
    permissions: [PermissionKey.GetBillingInvoice],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/count`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'PaymentIntent count',
        content: {[CONTENT_TYPE.JSON]: {schema: CountSchema}},
      },
    },
  })
  async count(
    @param.where(PaymentIntent) where?: Where<PaymentIntent>,
  ): Promise<Count> {
    const tenantId = this.getTenantId();
    return this.paymentIntentRepository.count({
      ...where,
      tenantId,
      deleted: false,
    } as object);
  }

  @authorize({
    permissions: [PermissionKey.GetBillingInvoice],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(basePath, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Array of PaymentIntent instances',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'array',
              items: getModelSchemaRefSF(PaymentIntent),
            },
          },
        },
      },
    },
  })
  async find(
    @param.filter(PaymentIntent) filter?: Filter<PaymentIntent>,
  ): Promise<PaymentIntent[]> {
    const tenantId = this.getTenantId();

    const results = await this.paymentIntentRepository.find({
      ...filter,
      where: {
        ...(filter?.where || {}),
        tenantId,
        deleted: false,
      } as object,
    });

    // Convert all amounts from cents to dollars for API response
    return results.map(pi => this.convertPaymentIntentForResponse(pi));
  }

  @authorize({
    permissions: [PermissionKey.GetBillingInvoice],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/{id}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'PaymentIntent instance',
        content: {
          [CONTENT_TYPE.JSON]: {schema: getModelSchemaRefSF(PaymentIntent)},
        },
      },
    },
  })
  async findById(@param.path.string('id') id: string): Promise<PaymentIntent> {
    const tenantId = this.getTenantId();

    const paymentIntent = await this.paymentIntentRepository.findOne({
      where: {id, tenantId, deleted: false} as object,
    });

    if (!paymentIntent) {
      throw new HttpErrors.NotFound('Payment intent not found');
    }

    // Convert amount from cents to dollars for API response
    return this.convertPaymentIntentForResponse(paymentIntent);
  }

  /**
   * Get payment intents for an invoice
   */
  @authorize({
    permissions: [PermissionKey.GetBillingInvoice],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/for-invoice/{invoiceId}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Payment intents for invoice',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'array',
              items: getModelSchemaRefSF(PaymentIntent),
            },
          },
        },
      },
    },
  })
  async findByInvoice(
    @param.path.string('invoiceId') invoiceId: string,
  ): Promise<PaymentIntent[]> {
    const tenantId = this.getTenantId();

    // Verify invoice belongs to tenant
    const invoice = await this.invoiceRepository.findOne({
      where: {id: invoiceId, tenantId} as object,
    });

    if (!invoice) {
      throw new HttpErrors.NotFound('Invoice not found');
    }

    const results = await this.paymentIntentRepository.findByInvoiceId(invoiceId);

    // Convert all amounts from cents to dollars for API response
    return results.map(pi => this.convertPaymentIntentForResponse(pi));
  }

  /**
   * Cancel a payment intent
   */
  @authorize({
    permissions: [PermissionKey.UpdateBillingInvoice],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @post(`${basePath}/{id}/cancel`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Payment intent cancelled',
        content: {
          [CONTENT_TYPE.JSON]: {schema: getModelSchemaRefSF(PaymentIntent)},
        },
      },
    },
  })
  async cancel(@param.path.string('id') id: string): Promise<PaymentIntent> {
    const tenantId = this.getTenantId();

    const paymentIntent = await this.paymentIntentRepository.findOne({
      where: {id, tenantId, deleted: false} as object,
    });

    if (!paymentIntent) {
      throw new HttpErrors.NotFound('Payment intent not found');
    }

    // Can't cancel if already succeeded or cancelled
    if (
      paymentIntent.status === PaymentIntentStatus.SUCCEEDED ||
      paymentIntent.status === PaymentIntentStatus.CANCELLED
    ) {
      throw new HttpErrors.BadRequest(
        `Cannot cancel payment intent with status: ${paymentIntent.status}`,
      );
    }

    // Cancel in Stripe
    if (this.stripeService.isEnabled() && paymentIntent.stripePaymentIntentId) {
      await this.stripeService.cancelPaymentIntent(
        paymentIntent.stripePaymentIntentId,
        'requested_by_customer',
      );
    }

    // Update local record
    await this.paymentIntentRepository.updateById(id, {
      status: PaymentIntentStatus.CANCELLED,
      cancelledAt: new Date().toISOString(),
      cancellationReason: 'requested_by_customer',
    });

    this.logger?.info(
      `[PaymentIntents] Cancelled payment intent ${id} for tenant ${tenantId}`,
    );

    const result = await this.paymentIntentRepository.findById(id);
    // Convert amount from cents to dollars for API response
    return this.convertPaymentIntentForResponse(result);
  }

  /**
   * Confirm a payment intent (for server-side confirmation)
   *
   * Usually confirmation happens on the frontend with Stripe.js,
   * but this endpoint supports server-side confirmation when needed.
   */
  @authorize({
    permissions: [PermissionKey.UpdateBillingInvoice],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @post(`${basePath}/{id}/confirm`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Payment intent confirmed',
        content: {
          [CONTENT_TYPE.JSON]: {schema: getModelSchemaRefSF(PaymentIntent)},
        },
      },
    },
  })
  async confirm(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: {
            type: 'object',
            properties: {
              paymentMethodId: {
                type: 'string',
                description: 'Payment method ID to use for confirmation',
              },
            },
          },
        },
      },
    })
    dto?: {paymentMethodId?: string},
  ): Promise<PaymentIntent> {
    const tenantId = this.getTenantId();

    const paymentIntent = await this.paymentIntentRepository.findOne({
      where: {id, tenantId, deleted: false} as object,
    });

    if (!paymentIntent) {
      throw new HttpErrors.NotFound('Payment intent not found');
    }

    // Can only confirm if requires confirmation or payment method
    if (
      paymentIntent.status !== PaymentIntentStatus.REQUIRES_CONFIRMATION &&
      paymentIntent.status !== PaymentIntentStatus.REQUIRES_PAYMENT_METHOD
    ) {
      throw new HttpErrors.BadRequest(
        `Cannot confirm payment intent with status: ${paymentIntent.status}`,
      );
    }

    // Get Stripe payment method ID if local ID provided
    let stripePaymentMethodId: string | undefined;
    if (dto?.paymentMethodId) {
      const pm = await this.paymentMethodRepository.findOne({
        where: {
          id: dto.paymentMethodId,
          tenantId,
          deleted: false,
        } as object,
      });
      if (!pm) {
        throw new HttpErrors.NotFound('Payment method not found');
      }
      stripePaymentMethodId = pm.stripePaymentMethodId;
    }

    // Confirm in Stripe
    if (this.stripeService.isEnabled() && paymentIntent.stripePaymentIntentId) {
      const stripeIntent = await this.stripeService.confirmPaymentIntent(
        paymentIntent.stripePaymentIntentId,
        stripePaymentMethodId,
      );

      // Update local status
      await this.paymentIntentRepository.updateById(id, {
        status: this.stripeService.mapPaymentIntentStatus(stripeIntent.status),
        stripePaymentMethodId:
          stripePaymentMethodId || paymentIntent.stripePaymentMethodId,
      });
    }

    this.logger?.info(
      `[PaymentIntents] Confirmed payment intent ${id} for tenant ${tenantId}`,
    );

    const result = await this.paymentIntentRepository.findById(id);
    // Convert amount from cents to dollars for API response
    return this.convertPaymentIntentForResponse(result);
  }
}
