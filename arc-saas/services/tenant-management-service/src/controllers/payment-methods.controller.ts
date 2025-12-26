import {inject} from '@loopback/core';
import {
  Count,
  CountSchema,
  Filter,
  repository,
  Where,
} from '@loopback/repository';
import {
  del,
  get,
  HttpErrors,
  param,
  patch,
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
import {PaymentMethodRepository, TenantRepository} from '../repositories';
import {PaymentMethod} from '../models';
import {PermissionKey} from '../permissions';
import {StripeService} from '../services/stripe.service';
import {PaymentMethodType} from '../enums';

const basePath = '/payment-methods';

/**
 * DTO for creating a new payment method
 */
interface CreatePaymentMethodDto {
  /** Stripe payment method ID (from frontend Elements) */
  stripePaymentMethodId: string;
  /** Whether to set as default payment method */
  setAsDefault?: boolean;
}

/**
 * DTO for creating a SetupIntent (to collect payment method)
 */
interface SetupIntentResponse {
  clientSecret: string;
  setupIntentId: string;
}

/**
 * Payment Methods Controller
 *
 * Manages payment methods for tenants, integrating with Stripe for
 * secure card storage and payment processing.
 *
 * Flow:
 * 1. Frontend uses Stripe Elements to collect card details
 * 2. Stripe Elements creates a PaymentMethod (pm_xxx)
 * 3. Frontend calls POST /payment-methods with the pm_xxx ID
 * 4. Backend attaches it to the Stripe customer and stores locally
 */
export class PaymentMethodsController {
  constructor(
    @repository(PaymentMethodRepository)
    public paymentMethodRepository: PaymentMethodRepository,
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
   * Get or create Stripe customer for a tenant
   *
   * Looks for existing customer ID in:
   * 1. Existing payment methods (stripeCustomerId field)
   * 2. Stripe customer search by tenant ID metadata
   * 3. Creates new customer if not found
   */
  private async getOrCreateStripeCustomer(tenantId: string): Promise<string> {
    const tenant = await this.tenantRepository.findById(tenantId);

    // Check if we have the customer ID in any existing payment method
    const existingPaymentMethods =
      await this.paymentMethodRepository.findByTenantId(tenantId);
    if (existingPaymentMethods.length > 0 && existingPaymentMethods[0].stripeCustomerId) {
      const existingCustomerId = existingPaymentMethods[0].stripeCustomerId;
      // Verify customer still exists in Stripe
      const customer = await this.stripeService.getCustomer(existingCustomerId);
      if (customer) {
        return existingCustomerId;
      }
    }

    // Try to find by tenant ID in Stripe
    const foundCustomer =
      await this.stripeService.findCustomerByTenantId(tenantId);
    if (foundCustomer) {
      return foundCustomer.id;
    }

    // Create new customer
    const contact = tenant.contacts?.[0];
    const newCustomer = await this.stripeService.createCustomer({
      tenantId,
      email: contact?.email || `tenant-${tenantId}@billing.local`,
      name: tenant.name,
      metadata: {
        tenantKey: tenant.key,
      },
    });

    return newCustomer.id;
  }

  /**
   * Create a SetupIntent for collecting payment method
   *
   * This creates a SetupIntent that the frontend uses with Stripe Elements
   * to securely collect card details.
   */
  @authorize({
    permissions: [PermissionKey.CreateBillingPaymentSource],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @post(`${basePath}/setup-intent`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'SetupIntent created for collecting payment method',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
              properties: {
                clientSecret: {type: 'string'},
                setupIntentId: {type: 'string'},
              },
            },
          },
        },
      },
    },
  })
  async createSetupIntent(): Promise<SetupIntentResponse> {
    if (!this.stripeService.isEnabled()) {
      throw new HttpErrors.ServiceUnavailable(
        'Payment processing is not configured',
      );
    }

    const tenantId = this.getTenantId();
    const stripeCustomerId = await this.getOrCreateStripeCustomer(tenantId);

    const setupIntent =
      await this.stripeService.createSetupIntent(stripeCustomerId);

    this.logger?.info(
      `[PaymentMethods] Created SetupIntent for tenant ${tenantId}`,
    );

    return {
      clientSecret: setupIntent.client_secret!,
      setupIntentId: setupIntent.id,
    };
  }

  /**
   * Add a new payment method
   *
   * After frontend collects card details via Stripe Elements and creates
   * a PaymentMethod, call this endpoint with the pm_xxx ID to attach it
   * to the tenant.
   */
  @authorize({
    permissions: [PermissionKey.CreateBillingPaymentSource],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @post(basePath, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Payment method added successfully',
        content: {
          [CONTENT_TYPE.JSON]: {schema: getModelSchemaRefSF(PaymentMethod)},
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
            required: ['stripePaymentMethodId'],
            properties: {
              stripePaymentMethodId: {
                type: 'string',
                description: 'Stripe payment method ID (pm_xxx)',
              },
              setAsDefault: {
                type: 'boolean',
                description: 'Set as default payment method',
              },
            },
          },
        },
      },
    })
    dto: CreatePaymentMethodDto,
  ): Promise<PaymentMethod> {
    if (!this.stripeService.isEnabled()) {
      throw new HttpErrors.ServiceUnavailable(
        'Payment processing is not configured',
      );
    }

    const tenantId = this.getTenantId();

    // Check if payment method already exists locally
    const existing =
      await this.paymentMethodRepository.findByStripePaymentMethodId(
        dto.stripePaymentMethodId,
      );
    if (existing) {
      throw new HttpErrors.Conflict(
        'This payment method is already registered',
      );
    }

    // Get or create Stripe customer
    const stripeCustomerId = await this.getOrCreateStripeCustomer(tenantId);

    // Attach the payment method to the customer in Stripe
    const stripePaymentMethod = await this.stripeService.attachPaymentMethod({
      paymentMethodId: dto.stripePaymentMethodId,
      customerId: stripeCustomerId,
      setAsDefault: dto.setAsDefault,
    });

    // Parse the payment method details
    const parsed = this.stripeService.parsePaymentMethod(stripePaymentMethod);

    // If setting as default, unset current defaults
    if (dto.setAsDefault) {
      await this.paymentMethodRepository.updateAll(
        {isDefault: false} as object,
        {tenantId, isDefault: true, deleted: false} as object,
      );
    }

    // Check if this is the first payment method (should be default)
    const existingMethods =
      await this.paymentMethodRepository.findByTenantId(tenantId);
    const isFirstMethod = existingMethods.length === 0;

    // Create local record
    const paymentMethod = await this.paymentMethodRepository.create({
      tenantId,
      stripePaymentMethodId: stripePaymentMethod.id,
      stripeCustomerId,
      type: parsed.type,
      cardDetails: parsed.cardDetails,
      bankAccountDetails: parsed.bankAccountDetails,
      billingName: parsed.billingDetails?.name,
      billingEmail: parsed.billingDetails?.email,
      billingAddress: parsed.billingDetails?.address,
      isDefault: dto.setAsDefault || isFirstMethod,
    });

    this.logger?.info(
      `[PaymentMethods] Added payment method ${paymentMethod.id} for tenant ${tenantId}`,
    );

    return paymentMethod;
  }

  @authorize({
    permissions: [PermissionKey.GetBillingPaymentSource],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/count`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'PaymentMethod count for tenant',
        content: {[CONTENT_TYPE.JSON]: {schema: CountSchema}},
      },
    },
  })
  async count(
    @param.where(PaymentMethod) where?: Where<PaymentMethod>,
  ): Promise<Count> {
    const tenantId = this.getTenantId();
    return this.paymentMethodRepository.count({
      ...where,
      tenantId,
      deleted: false,
    } as object);
  }

  @authorize({
    permissions: [PermissionKey.GetBillingPaymentSource],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(basePath, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Array of PaymentMethod instances for tenant',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'array',
              items: getModelSchemaRefSF(PaymentMethod),
            },
          },
        },
      },
    },
  })
  async find(
    @param.filter(PaymentMethod) filter?: Filter<PaymentMethod>,
  ): Promise<PaymentMethod[]> {
    const tenantId = this.getTenantId();

    return this.paymentMethodRepository.find({
      ...filter,
      where: {
        ...(filter?.where || {}),
        tenantId,
        deleted: false,
      } as object,
    });
  }

  @authorize({
    permissions: [PermissionKey.GetBillingPaymentSource],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/{id}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'PaymentMethod instance',
        content: {
          [CONTENT_TYPE.JSON]: {schema: getModelSchemaRefSF(PaymentMethod)},
        },
      },
    },
  })
  async findById(@param.path.string('id') id: string): Promise<PaymentMethod> {
    const tenantId = this.getTenantId();

    const paymentMethod = await this.paymentMethodRepository.findOne({
      where: {id, tenantId, deleted: false} as object,
    });

    if (!paymentMethod) {
      throw new HttpErrors.NotFound('Payment method not found');
    }

    return paymentMethod;
  }

  /**
   * Set a payment method as default
   */
  @authorize({
    permissions: [PermissionKey.UpdateBillingPaymentSource],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @patch(`${basePath}/{id}/set-default`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Payment method set as default',
        content: {
          [CONTENT_TYPE.JSON]: {schema: getModelSchemaRefSF(PaymentMethod)},
        },
      },
    },
  })
  async setAsDefault(
    @param.path.string('id') id: string,
  ): Promise<PaymentMethod> {
    const tenantId = this.getTenantId();

    const paymentMethod = await this.paymentMethodRepository.findOne({
      where: {id, tenantId, deleted: false} as object,
    });

    if (!paymentMethod) {
      throw new HttpErrors.NotFound('Payment method not found');
    }

    // Update in Stripe
    if (
      this.stripeService.isEnabled() &&
      paymentMethod.stripeCustomerId &&
      paymentMethod.stripePaymentMethodId
    ) {
      await this.stripeService.updateCustomer(paymentMethod.stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethod.stripePaymentMethodId,
        },
      });
    }

    // Update locally
    await this.paymentMethodRepository.setAsDefault(tenantId, id);

    this.logger?.info(
      `[PaymentMethods] Set payment method ${id} as default for tenant ${tenantId}`,
    );

    return this.paymentMethodRepository.findById(id);
  }

  /**
   * Delete (detach) a payment method
   */
  @authorize({
    permissions: [PermissionKey.DeleteBillingPaymentSource],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @del(`${basePath}/{id}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.NO_CONTENT]: {
        description: 'Payment method deleted',
      },
    },
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    const tenantId = this.getTenantId();

    const paymentMethod = await this.paymentMethodRepository.findOne({
      where: {id, tenantId, deleted: false} as object,
    });

    if (!paymentMethod) {
      throw new HttpErrors.NotFound('Payment method not found');
    }

    // Detach from Stripe
    if (
      this.stripeService.isEnabled() &&
      paymentMethod.stripePaymentMethodId
    ) {
      try {
        await this.stripeService.detachPaymentMethod(
          paymentMethod.stripePaymentMethodId,
        );
      } catch (error) {
        this.logger?.warn(
          `[PaymentMethods] Failed to detach from Stripe: ${error}`,
        );
        // Continue with local deletion even if Stripe fails
      }
    }

    // Soft delete locally
    await this.paymentMethodRepository.updateById(id, {
      deleted: true,
      deletedOn: new Date(),
    } as object);

    this.logger?.info(
      `[PaymentMethods] Deleted payment method ${id} for tenant ${tenantId}`,
    );

    // If this was the default, set another as default
    if (paymentMethod.isDefault) {
      const remaining =
        await this.paymentMethodRepository.findByTenantId(tenantId);
      if (remaining.length > 0) {
        await this.paymentMethodRepository.setAsDefault(
          tenantId,
          remaining[0].id,
        );
        this.logger?.info(
          `[PaymentMethods] Set ${remaining[0].id} as new default`,
        );
      }
    }
  }
}
