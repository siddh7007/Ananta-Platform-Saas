import {inject, service} from '@loopback/core';
import {repository, Filter, Where} from '@loopback/repository';
import {
  get,
  HttpErrors,
  param,
  post,
  requestBody,
} from '@loopback/rest';
import {
  CONTENT_TYPE,
  IAuthUserWithPermissions,
  OPERATION_SECURITY_SPEC,
  STATUS_CODE,
} from '@sourceloop/core';
import {
  authenticate,
  AuthenticationBindings,
  STRATEGY,
} from 'loopback4-authentication';
import {authorize} from 'loopback4-authorization';
import {PermissionKey} from '../permissions';
import {
  UsageEventRepository,
  TenantQuotaRepository,
  UsageSummaryRepository,
} from '../repositories/sequelize';
import {UsageService, RecordUsageInput} from '../services/usage.service';
import {UsageEvent, UsageMetricType, TenantQuota, UsageSummary} from '../models';

const basePath = '/usage';

/**
 * Controller for tenant usage tracking and metered billing.
 * Provides endpoints to:
 * - Record usage events
 * - Query usage status and quotas
 * - View usage trends and analytics
 * - Manage tenant quotas
 */
export class UsageController {
  constructor(
    @service(UsageService)
    private readonly usageService: UsageService,
    @repository(UsageEventRepository)
    private readonly usageEventRepo: UsageEventRepository,
    @repository(TenantQuotaRepository)
    private readonly quotaRepo: TenantQuotaRepository,
    @repository(UsageSummaryRepository)
    private readonly summaryRepo: UsageSummaryRepository,
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

  // =====================================
  // Usage Events
  // =====================================

  /**
   * Record a usage event (for internal services/API calls).
   * This can be called from app-plane services to report consumption.
   */
  @authorize({
    permissions: [PermissionKey.CreateSubscription], // Re-use subscription permission for now
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @post(`${basePath}/events`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Usage event recorded',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
              properties: {
                id: {type: 'string'},
                metricType: {type: 'string'},
                quantity: {type: 'number'},
                billingPeriod: {type: 'string'},
              },
            },
          },
        },
      },
    },
  })
  async recordUsage(
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: {
            type: 'object',
            required: ['metricType', 'quantity'],
            properties: {
              metricType: {
                type: 'string',
                enum: Object.values(UsageMetricType),
                description: 'Type of usage metric',
              },
              quantity: {type: 'number', description: 'Amount of usage'},
              unit: {type: 'string', description: 'Unit of measurement'},
              source: {type: 'string', description: 'Source service reporting usage'},
              resourceId: {type: 'string', description: 'Optional resource ID'},
              metadata: {type: 'object', description: 'Additional metadata'},
            },
          },
        },
      },
    })
    input: Omit<RecordUsageInput, 'tenantId'>,
  ): Promise<UsageEvent> {
    const tenantId = this.getTenantId();
    return this.usageService.recordUsage({...input, tenantId});
  }

  /**
   * Get usage events for the current tenant.
   */
  @authorize({
    permissions: [PermissionKey.ViewSubscription],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/events`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Array of usage events',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: {type: 'string'},
                  metricType: {type: 'string'},
                  quantity: {type: 'number'},
                  unit: {type: 'string'},
                  eventTimestamp: {type: 'string', format: 'date-time'},
                  billingPeriod: {type: 'string'},
                },
              },
            },
          },
        },
      },
    },
  })
  async getUsageEvents(
    @param.query.string('metricType') metricType?: string,
    @param.query.string('billingPeriod') billingPeriod?: string,
    @param.query.number('limit') limit?: number,
  ): Promise<UsageEvent[]> {
    const tenantId = this.getTenantId();
    const where: Where<UsageEvent> = {tenantId} as Where<UsageEvent>;

    if (metricType) {
      (where as Record<string, unknown>).metricType = metricType;
    }
    if (billingPeriod) {
      (where as Record<string, unknown>).billingPeriod = billingPeriod;
    }

    return this.usageEventRepo.find({
      where,
      order: ['eventTimestamp DESC'],
      limit: limit || 100,
    });
  }

  // =====================================
  // Usage Status & Quotas
  // =====================================

  /**
   * Get current usage status for all metrics.
   */
  @authorize({
    permissions: [PermissionKey.ViewSubscription],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/status`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Usage status for all metrics',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  metricType: {type: 'string'},
                  metricName: {type: 'string'},
                  currentUsage: {type: 'number'},
                  softLimit: {type: 'number'},
                  hardLimit: {type: 'number'},
                  percentUsed: {type: 'number'},
                  isOverSoftLimit: {type: 'boolean'},
                  isOverHardLimit: {type: 'boolean'},
                  unit: {type: 'string'},
                  remainingAllowance: {type: 'number'},
                },
              },
            },
          },
        },
      },
    },
  })
  async getUsageStatus(): Promise<unknown[]> {
    const tenantId = this.getTenantId();
    return this.usageService.getUsageStatus(tenantId);
  }

  /**
   * Get tenant quotas.
   */
  @authorize({
    permissions: [PermissionKey.ViewSubscription],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/quotas`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Array of tenant quotas',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {type: 'array'},
          },
        },
      },
    },
  })
  async getQuotas(): Promise<TenantQuota[]> {
    const tenantId = this.getTenantId();
    return this.quotaRepo.find({
      where: {tenantId} as Where<TenantQuota>,
    });
  }

  /**
   * Check if a specific quota is exceeded.
   */
  @authorize({
    permissions: [PermissionKey.ViewSubscription],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/quotas/{metricType}/check`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Quota check result',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
              properties: {
                exceeded: {type: 'boolean'},
                currentUsage: {type: 'number'},
                limit: {type: 'number'},
              },
            },
          },
        },
      },
    },
  })
  async checkQuota(
    @param.path.string('metricType') metricType: string,
  ): Promise<{exceeded: boolean; currentUsage?: number; limit?: number}> {
    const tenantId = this.getTenantId();
    const result = await this.usageService.checkQuotaExceeded(
      tenantId,
      metricType as UsageMetricType,
    );
    return {
      exceeded: result.exceeded,
      currentUsage: result.quota?.currentUsage,
      limit: result.quota?.hardLimit,
    };
  }

  // =====================================
  // Usage Analytics & Trends
  // =====================================

  /**
   * Get usage trend for a specific metric.
   */
  @authorize({
    permissions: [PermissionKey.ViewSubscription],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/trends/{metricType}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Usage trend data',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  period: {type: 'string'},
                  quantity: {type: 'number'},
                  eventCount: {type: 'number'},
                },
              },
            },
          },
        },
      },
    },
  })
  async getUsageTrend(
    @param.path.string('metricType') metricType: string,
    @param.query.number('months') months?: number,
  ): Promise<unknown[]> {
    const tenantId = this.getTenantId();
    return this.usageService.getUsageTrend(
      tenantId,
      metricType as UsageMetricType,
      months || 6,
    );
  }

  /**
   * Get usage analytics summary for a billing period.
   */
  @authorize({
    permissions: [PermissionKey.ViewSubscription],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/analytics`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Usage analytics',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
              properties: {
                period: {type: 'string'},
                metrics: {type: 'array'},
                totalOverageAmount: {type: 'number'},
              },
            },
          },
        },
      },
    },
  })
  async getUsageAnalytics(
    @param.query.string('billingPeriod') billingPeriod?: string,
  ): Promise<unknown> {
    const tenantId = this.getTenantId();
    return this.usageService.getUsageAnalytics(tenantId, billingPeriod);
  }

  /**
   * Get usage summaries for the current tenant.
   */
  @authorize({
    permissions: [PermissionKey.ViewSubscription],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/summaries`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Array of usage summaries',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {type: 'array'},
          },
        },
      },
    },
  })
  async getUsageSummaries(
    @param.query.string('billingPeriod') billingPeriod?: string,
    @param.query.number('limit') limit?: number,
  ): Promise<UsageSummary[]> {
    const tenantId = this.getTenantId();
    const where: Where<UsageSummary> = {tenantId} as Where<UsageSummary>;

    if (billingPeriod) {
      (where as Record<string, unknown>).billingPeriod = billingPeriod;
    }

    return this.summaryRepo.find({
      where,
      order: ['billingPeriod DESC'],
      limit: limit || 12,
    });
  }

  // =====================================
  // Quota Management
  // =====================================

  /**
   * Initialize quotas for a tenant based on their plan.
   * If planId is not provided, looks up from tenant's active subscription.
   * Called when subscription is created or plan changes.
   */
  @authorize({
    permissions: [PermissionKey.UpdateSubscription],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @post(`${basePath}/quotas/initialize`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Quotas initialized',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
              properties: {
                quotasCreated: {type: 'number'},
                planTier: {type: 'string'},
              },
            },
          },
        },
      },
    },
  })
  async initializeQuotas(
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: {
            type: 'object',
            properties: {
              planId: {type: 'string', description: 'Optional plan ID (tier name like basic, standard, premium). If not provided, looks up from active subscription.'},
            },
          },
        },
      },
    })
    body?: {planId?: string},
  ): Promise<{quotasCreated: number; planTier: string}> {
    const tenantId = this.getTenantId();
    const quotas = await this.usageService.initializeQuotasForPlan(tenantId, body?.planId);
    const planTier = await this.usageService.getPlanTierForTenant(tenantId);
    return {quotasCreated: quotas.length, planTier};
  }

  /**
   * Reset quotas for a new billing period (current tenant only).
   */
  @authorize({
    permissions: [PermissionKey.UpdateSubscription],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @post(`${basePath}/quotas/reset`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Quotas reset result',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
              properties: {
                reset: {type: 'number'},
                skipped: {type: 'number'},
              },
            },
          },
        },
      },
    },
  })
  async resetQuotas(): Promise<{reset: number; skipped: number}> {
    const tenantId = this.getTenantId();
    return this.usageService.resetQuotasForPeriod(tenantId);
  }

  /**
   * Force reset all quotas for current tenant (admin operation).
   * Resets regardless of nextReset date.
   */
  @authorize({
    permissions: [PermissionKey.UpdateSubscription],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @post(`${basePath}/quotas/force-reset`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Force reset result',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
              properties: {
                reset: {type: 'number'},
              },
            },
          },
        },
      },
    },
  })
  async forceResetQuotas(): Promise<{reset: number}> {
    const tenantId = this.getTenantId();
    return this.usageService.forceResetAllQuotas(tenantId);
  }

  // =====================================
  // Admin/Scheduler Operations (super_admin only)
  // =====================================

  /**
   * Reset all tenant quotas that are due for reset.
   * This endpoint should be called by a scheduler (cron job or Temporal workflow).
   * Requires super_admin permission.
   */
  @authorize({
    permissions: [PermissionKey.SuperAdmin], // Only super admins
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @post(`${basePath}/admin/reset-all-due`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Batch reset result',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
              properties: {
                tenantsProcessed: {type: 'number'},
                quotasReset: {type: 'number'},
                errors: {type: 'array'},
              },
            },
          },
        },
      },
    },
  })
  async resetAllDueQuotas(): Promise<{
    tenantsProcessed: number;
    quotasReset: number;
    errors: Array<{tenantId: string; error: string}>;
  }> {
    return this.usageService.resetAllDueQuotas();
  }
}
