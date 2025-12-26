import {inject, service} from '@loopback/core';
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
  param,
  patch,
  post,
  put,
  requestBody,
  HttpErrors,
} from '@loopback/rest';
import {
  CONTENT_TYPE,
  IAuthUserWithPermissions,
  OPERATION_SECURITY_SPEC,
  STATUS_CODE,
} from '@sourceloop/core';
import {authenticate, AuthenticationBindings, STRATEGY} from 'loopback4-authentication';
import {authorize} from 'loopback4-authorization';
import {PermissionKey} from '../permissions';
import {Subscription} from '../models';
import {SubscriptionRepository} from '../repositories/subscription.repository';
import {TenantRepository} from '../repositories/tenant.repository';
import {AuditLoggerService} from '../services/audit-logger.service';

const basePath = '/subscriptions';

interface SubscriptionWithTenant {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantKey: string;
  planId: string;
  planName: string;
  planTier: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialStart?: string;
  trialEnd?: string;
  amount: number;
  currency: string;
  billingCycle: 'monthly' | 'yearly';
  cancelAtPeriodEnd: boolean;
  canceledAt?: string;
  cancelReason?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
}

export class SubscriptionController {
  constructor(
    @repository(SubscriptionRepository)
    private readonly subscriptionRepository: SubscriptionRepository,
    @repository(TenantRepository)
    private readonly tenantRepository: TenantRepository,
    @service(AuditLoggerService)
    private readonly auditLogger: AuditLoggerService,
    @inject(AuthenticationBindings.CURRENT_USER, {optional: true})
    private readonly currentUser?: IAuthUserWithPermissions,
  ) {}

  /**
   * Get the current user's tenant ID for multi-tenant isolation.
   */
  private getTenantId(): string {
    if (!this.currentUser?.tenantId) {
      throw new HttpErrors.Forbidden('Tenant context required');
    }
    return this.currentUser.tenantId;
  }

  @authorize({
    permissions: [PermissionKey.CreateSubscription],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @post(basePath, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Subscription model instance',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
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
            properties: {
              tenantId: {type: 'string'},
              planId: {type: 'string'},
              planName: {type: 'string'},
              planTier: {type: 'string'},
              status: {type: 'string'},
              currentPeriodStart: {type: 'string', format: 'date-time'},
              currentPeriodEnd: {type: 'string', format: 'date-time'},
              trialStart: {type: 'string', format: 'date-time'},
              trialEnd: {type: 'string', format: 'date-time'},
              amount: {type: 'number'},
              currency: {type: 'string'},
              billingCycle: {type: 'string', enum: ['monthly', 'yearly']},
              cancelAtPeriodEnd: {type: 'boolean'},
              metadata: {type: 'object'},
            },
            required: [
              'tenantId',
              'planId',
              'planName',
              'planTier',
              'amount',
              'currentPeriodStart',
              'currentPeriodEnd',
            ],
          },
        },
      },
    })
    subscription: Omit<Subscription, 'id' | 'createdOn' | 'modifiedOn'>,
  ): Promise<Subscription> {
    // Verify tenant exists
    const tenant = await this.tenantRepository.findById(subscription.tenantId);
    const createdSub = await this.subscriptionRepository.create(subscription);

    // Log subscription creation (non-blocking)
    try {
      await this.auditLogger.logSubscriptionCreated(
        createdSub.id,
        subscription.tenantId,
        tenant.name || 'unknown',
        subscription.planId,
        subscription.planName,
      );
    } catch {
      // Don't fail the operation if audit logging fails
    }

    return createdSub;
  }

  @authorize({
    permissions: [PermissionKey.ViewSubscription],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/count`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Subscription model count',
        content: {[CONTENT_TYPE.JSON]: {schema: CountSchema}},
      },
    },
  })
  async count(
    @param.where(Subscription) where?: Where<Subscription>,
  ): Promise<Count> {
    const tenantId = this.getTenantId();
    return this.subscriptionRepository.count({
      ...where,
      tenantId,
    });
  }

  @authorize({
    permissions: [PermissionKey.ViewSubscription],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(basePath, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Array of Subscription model instances with tenant info',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'array',
              items: {
                type: 'object',
              },
            },
          },
        },
      },
    },
  })
  async find(
    @param.filter(Subscription) filter?: Filter<Subscription>,
  ): Promise<SubscriptionWithTenant[]> {
    const tenantId = this.getTenantId();

    // Enforce tenant isolation by merging tenant filter
    const subscriptions = await this.subscriptionRepository.find({
      ...filter,
      where: {
        ...filter?.where,
        tenantId,
      },
      include: ['tenant'],
    });

    // Enrich with tenant info
    return subscriptions.map(sub => {
      const tenant = (sub as any).tenant;
      return {
        id: sub.id,
        tenantId: sub.tenantId,
        tenantName: tenant?.name || 'Unknown',
        tenantKey: tenant?.key || 'unknown',
        planId: sub.planId,
        planName: sub.planName,
        planTier: sub.planTier,
        status: sub.status,
        currentPeriodStart: sub.currentPeriodStart?.toISOString(),
        currentPeriodEnd: sub.currentPeriodEnd?.toISOString(),
        trialStart: sub.trialStart?.toISOString(),
        trialEnd: sub.trialEnd?.toISOString(),
        amount: sub.amount,
        currency: sub.currency,
        billingCycle: sub.billingCycle,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        canceledAt: sub.canceledAt?.toISOString(),
        cancelReason: sub.cancelReason,
        metadata: sub.metadata,
        createdAt: sub.createdOn?.toISOString() || new Date().toISOString(),
        updatedAt: sub.modifiedOn?.toISOString(),
      };
    });
  }

  @authorize({
    permissions: [PermissionKey.ViewSubscription],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/{id}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Subscription model instance with tenant info',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
            },
          },
        },
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Subscription, {exclude: 'where'})
    filter?: Filter<Subscription>,
  ): Promise<SubscriptionWithTenant> {
    const tenantId = this.getTenantId();

    const sub = await this.subscriptionRepository.findById(id, {
      ...filter,
      include: ['tenant'],
    });

    // Verify subscription belongs to current tenant
    if (sub.tenantId !== tenantId) {
      throw new HttpErrors.Forbidden('Cannot access subscription from another tenant');
    }

    const tenant = (sub as any).tenant;
    return {
      id: sub.id,
      tenantId: sub.tenantId,
      tenantName: tenant?.name || 'Unknown',
      tenantKey: tenant?.key || 'unknown',
      planId: sub.planId,
      planName: sub.planName,
      planTier: sub.planTier,
      status: sub.status,
      currentPeriodStart: sub.currentPeriodStart?.toISOString(),
      currentPeriodEnd: sub.currentPeriodEnd?.toISOString(),
      trialStart: sub.trialStart?.toISOString(),
      trialEnd: sub.trialEnd?.toISOString(),
      amount: sub.amount,
      currency: sub.currency,
      billingCycle: sub.billingCycle,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      canceledAt: sub.canceledAt?.toISOString(),
      cancelReason: sub.cancelReason,
      metadata: sub.metadata,
      createdAt: sub.createdOn?.toISOString() || new Date().toISOString(),
      updatedAt: sub.modifiedOn?.toISOString(),
    };
  }

  @authorize({
    permissions: [PermissionKey.UpdateSubscription],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @patch(`${basePath}/{id}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.NO_CONTENT]: {
        description: 'Subscription PATCH success',
      },
    },
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: {
            type: 'object',
            properties: {
              status: {type: 'string'},
              planId: {type: 'string'},
              planName: {type: 'string'},
              planTier: {type: 'string'},
              currentPeriodStart: {type: 'string', format: 'date-time'},
              currentPeriodEnd: {type: 'string', format: 'date-time'},
              amount: {type: 'number'},
              currency: {type: 'string'},
              billingCycle: {type: 'string', enum: ['monthly', 'yearly']},
              cancelAtPeriodEnd: {type: 'boolean'},
              cancelReason: {type: 'string'},
              metadata: {type: 'object'},
            },
          },
        },
      },
    })
    subscription: Partial<Subscription>,
  ): Promise<void> {
    const tenantId = this.getTenantId();

    const existingSub = await this.subscriptionRepository.findById(id, {
      include: ['tenant'],
    });

    // Verify subscription belongs to current tenant
    if (existingSub.tenantId !== tenantId) {
      throw new HttpErrors.Forbidden('Cannot update subscription from another tenant');
    }

    const tenant = (existingSub as any).tenant;

    // If canceling, set canceledAt timestamp
    if (subscription.cancelAtPeriodEnd === true) {
      subscription.canceledAt = new Date();
    }
    await this.subscriptionRepository.updateById(id, subscription);

    // Log subscription update (non-blocking)
    try {
      if (subscription.cancelAtPeriodEnd === true) {
        await this.auditLogger.logSubscriptionCancelled(
          id,
          existingSub.tenantId,
          tenant?.name || 'unknown',
          subscription.cancelReason,
        );
      } else if (subscription.planId && subscription.planId !== existingSub.planId) {
        await this.auditLogger.logSubscriptionPlanChanged(
          id,
          existingSub.tenantId,
          tenant?.name || 'unknown',
          existingSub.planId,
          subscription.planId,
        );
      } else {
        await this.auditLogger.logSubscriptionUpdated(
          id,
          existingSub.tenantId,
          tenant?.name || 'unknown',
          subscription as unknown as Record<string, unknown>,
        );
      }
    } catch {
      // Don't fail the operation if audit logging fails
    }
  }

  @authorize({
    permissions: [PermissionKey.UpdateSubscription],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @put(`${basePath}/{id}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.NO_CONTENT]: {
        description: 'Subscription PUT success',
      },
    },
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() subscription: Subscription,
  ): Promise<void> {
    const tenantId = this.getTenantId();

    const existingSub = await this.subscriptionRepository.findById(id, {
      include: ['tenant'],
    });

    // Verify subscription belongs to current tenant
    if (existingSub.tenantId !== tenantId) {
      throw new HttpErrors.Forbidden('Cannot replace subscription from another tenant');
    }

    const tenant = (existingSub as any).tenant;
    await this.subscriptionRepository.replaceById(id, subscription);

    // Log subscription replace (non-blocking)
    try {
      await this.auditLogger.logSubscriptionUpdated(
        id,
        existingSub.tenantId,
        tenant?.name || 'unknown',
        {replaced: true, newData: subscription as unknown as Record<string, unknown>},
      );
    } catch {
      // Don't fail the operation if audit logging fails
    }
  }

  @authorize({
    permissions: [PermissionKey.UpdateSubscription],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @del(`${basePath}/{id}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.NO_CONTENT]: {
        description: 'Subscription DELETE success',
      },
    },
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    const tenantId = this.getTenantId();

    const existingSub = await this.subscriptionRepository.findById(id);

    // Verify subscription belongs to current tenant
    if (existingSub.tenantId !== tenantId) {
      throw new HttpErrors.Forbidden('Cannot delete subscription from another tenant');
    }

    await this.subscriptionRepository.deleteById(id);
  }
}
