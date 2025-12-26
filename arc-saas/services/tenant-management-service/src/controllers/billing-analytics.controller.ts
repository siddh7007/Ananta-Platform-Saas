import {inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {get, HttpErrors, param} from '@loopback/rest';
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
  SubscriptionRepository,
  InvoiceRepository,
  TenantRepository,
} from '../repositories';
import {UserRepository} from '../repositories/sequelize';
import {InvoiceStatus} from '../enums';

const basePath = '/billing';

/**
 * Plan price lookup map.
 * Matches the PLANS constant in plan.controller.ts
 */
const PLAN_PRICES: Record<string, number> = {
  'plan-basic': 29,
  'plan-standard': 79,
  'plan-premium': 199,
  // Fallback for legacy or unknown plans
  basic: 29,
  standard: 79,
  premium: 199,
};

/**
 * Default page size for paginated endpoints
 */
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * Get plan price by plan ID
 */
function getPlanPrice(planId: string | undefined): number {
  if (!planId) return 0;
  const normalizedId = planId.toLowerCase();
  return PLAN_PRICES[normalizedId] ?? 0;
}

/**
 * Controller for billing analytics and metrics.
 * Provides dashboard data for admin billing overview.
 */
export class BillingAnalyticsController {
  constructor(
    @repository(SubscriptionRepository)
    public subscriptionRepository: SubscriptionRepository,
    @repository(InvoiceRepository)
    public invoiceRepository: InvoiceRepository,
    @repository(TenantRepository)
    public tenantRepository: TenantRepository,
    @repository(UserRepository)
    public userRepository: UserRepository,
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

  /**
   * Get billing metrics summary
   */
  @authorize({
    permissions: [PermissionKey.ViewSubscription, PermissionKey.ViewInvoice],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/metrics`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Billing metrics summary',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
              properties: {
                totalRevenue: {type: 'number'},
                activeSubscriptions: {type: 'number'},
                totalTenants: {type: 'number'},
                pendingInvoices: {type: 'number'},
                mrr: {type: 'number', description: 'Monthly Recurring Revenue'},
                arr: {type: 'number', description: 'Annual Recurring Revenue'},
              },
            },
          },
        },
      },
    },
  })
  async getMetrics(): Promise<{
    totalRevenue: number;
    activeSubscriptions: number;
    totalTenants: number;
    pendingInvoices: number;
    mrr: number;
    arr: number;
  }> {
    // Count active subscriptions
    const activeSubscriptions = await this.subscriptionRepository.count({
      status: 'active',
    });

    // Count total tenants
    const totalTenants = await this.tenantRepository.count();

    // Get pending invoices (status not paid) - InvoiceStatus.PAID = 1
    const pendingInvoices = await this.invoiceRepository.count({
      status: {neq: InvoiceStatus.PAID},
    } as any);

    // Calculate total revenue from paid invoices
    const invoices = await this.invoiceRepository.find({
      where: {status: InvoiceStatus.PAID},
    });
    const totalRevenue = invoices.reduce(
      (sum, inv) => sum + (Number(inv.amount) || 0),
      0,
    );

    // Calculate MRR from actual plan prices
    const subscriptions = await this.subscriptionRepository.find({
      where: {status: 'active'},
    });

    // Sum up MRR based on actual plan prices
    const mrr = subscriptions.reduce((sum, sub) => {
      const planPrice = getPlanPrice(sub.planId);
      return sum + planPrice;
    }, 0);
    const arr = mrr * 12;

    return {
      totalRevenue,
      activeSubscriptions: activeSubscriptions.count,
      totalTenants: totalTenants.count,
      pendingInvoices: pendingInvoices.count,
      mrr,
      arr,
    };
  }

  /**
   * Get invoices list for billing dashboard with pagination
   */
  @authorize({
    permissions: [PermissionKey.ViewInvoice],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/invoices`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'List of invoices for billing dashboard',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
              properties: {
                data: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: {type: 'string'},
                      tenantId: {type: 'string'},
                      amount: {type: 'number'},
                      status: {type: 'string'},
                      dueDate: {type: 'string'},
                      paidAt: {type: 'string'},
                      createdOn: {type: 'string'},
                    },
                  },
                },
                total: {type: 'number'},
                page: {type: 'number'},
                pageSize: {type: 'number'},
                totalPages: {type: 'number'},
              },
            },
          },
        },
      },
    },
  })
  async getInvoices(
    @param.query.number('page') page: number = 1,
    @param.query.number('pageSize') pageSize: number = DEFAULT_PAGE_SIZE,
    @param.query.string('status') status?: string,
  ): Promise<{
    data: any[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    // Validate pagination parameters
    if (page < 1) page = 1;
    if (pageSize < 1) pageSize = DEFAULT_PAGE_SIZE;
    if (pageSize > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE;

    // Build where clause
    const where: any = {};
    if (status) {
      // Convert string status to InvoiceStatus enum value (integer)
      const statusMap: Record<string, InvoiceStatus> = {
        pending: InvoiceStatus.PENDING,
        paid: InvoiceStatus.PAID,
        cancelled: InvoiceStatus.CANCELLED,
      };
      const normalizedStatus = status.toLowerCase();
      if (normalizedStatus in statusMap) {
        where.status = statusMap[normalizedStatus];
      } else {
        // If numeric value provided, parse it
        const numericStatus = parseInt(status, 10);
        if (!isNaN(numericStatus) && numericStatus >= 0 && numericStatus <= 2) {
          where.status = numericStatus;
        }
      }
    }

    const count = await this.invoiceRepository.count(where);
    const invoices = await this.invoiceRepository.find({
      where,
      order: ['createdOn DESC'],
      limit: pageSize,
      skip: (page - 1) * pageSize,
    });

    return {
      data: invoices,
      total: count.count,
      page,
      pageSize,
      totalPages: Math.ceil(count.count / pageSize),
    };
  }

  /**
   * Get revenue breakdown by plan
   */
  @authorize({
    permissions: [PermissionKey.ViewSubscription],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/revenue-by-plan`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Revenue breakdown by subscription plan',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  planId: {type: 'string'},
                  planName: {type: 'string'},
                  subscriptionCount: {type: 'number'},
                  monthlyRevenue: {type: 'number'},
                  price: {type: 'number'},
                },
              },
            },
          },
        },
      },
    },
  })
  async getRevenueByPlan(): Promise<
    Array<{
      planId: string;
      planName: string;
      subscriptionCount: number;
      monthlyRevenue: number;
      price: number;
    }>
  > {
    // Get all active subscriptions grouped by plan
    const subscriptions = await this.subscriptionRepository.find({
      where: {status: 'active'},
    });

    // Group by planId
    const planMap = new Map<string, {count: number; planId: string}>();
    for (const sub of subscriptions) {
      const planId = sub.planId || 'unknown';
      const existing = planMap.get(planId) || {count: 0, planId};
      existing.count++;
      planMap.set(planId, existing);
    }

    // Convert to array with actual revenue from plan prices
    const result: Array<{
      planId: string;
      planName: string;
      subscriptionCount: number;
      monthlyRevenue: number;
      price: number;
    }> = [];

    for (const [planId, data] of planMap) {
      const price = getPlanPrice(planId);
      result.push({
        planId,
        planName: this.formatPlanName(planId),
        subscriptionCount: data.count,
        price,
        monthlyRevenue: data.count * price,
      });
    }

    // Sort by monthly revenue descending
    result.sort((a, b) => b.monthlyRevenue - a.monthlyRevenue);

    return result;
  }

  /**
   * Format plan ID to human-readable name
   */
  private formatPlanName(planId: string): string {
    // Handle format like "plan-basic" -> "Basic"
    const name = planId.replace(/^plan-/, '').replace(/-/g, ' ');
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  /**
   * Get monthly revenue data for charts
   */
  @authorize({
    permissions: [PermissionKey.ViewInvoice],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/monthly-revenue`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Monthly revenue data for the past 12 months',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  month: {type: 'string'},
                  revenue: {type: 'number'},
                  invoiceCount: {type: 'number'},
                },
              },
            },
          },
        },
      },
    },
  })
  async getMonthlyRevenue(
    @param.query.number('months') months: number = 12,
  ): Promise<
    Array<{
      month: string;
      revenue: number;
      invoiceCount: number;
    }>
  > {
    // Validate months parameter
    if (months < 1) months = 1;
    if (months > 24) months = 24;

    // Get invoices from the past N months
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const invoices = await this.invoiceRepository.find({
      where: {
        createdOn: {gte: startDate},
        status: InvoiceStatus.PAID,
      } as any,
    });

    // Group by month
    const monthMap = new Map<string, {revenue: number; count: number}>();

    for (const invoice of invoices) {
      const date = new Date(invoice.createdOn || new Date());
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      const existing = monthMap.get(monthKey) || {revenue: 0, count: 0};
      existing.revenue += Number(invoice.amount) || 0;
      existing.count++;
      monthMap.set(monthKey, existing);
    }

    // Convert to sorted array
    const result: Array<{month: string; revenue: number; invoiceCount: number}> =
      [];
    for (const [month, data] of monthMap) {
      result.push({
        month,
        revenue: data.revenue,
        invoiceCount: data.count,
      });
    }

    // Sort by month
    result.sort((a, b) => a.month.localeCompare(b.month));

    return result;
  }

  /**
   * Get subscription growth data
   */
  @authorize({
    permissions: [PermissionKey.ViewSubscription],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/subscription-growth`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Subscription growth data',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
              properties: {
                totalActive: {type: 'number'},
                newThisMonth: {type: 'number'},
                churnedThisMonth: {type: 'number'},
                growthRate: {type: 'number'},
              },
            },
          },
        },
      },
    },
  })
  async getSubscriptionGrowth(): Promise<{
    totalActive: number;
    newThisMonth: number;
    churnedThisMonth: number;
    growthRate: number;
  }> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Total active subscriptions
    const totalActive = await this.subscriptionRepository.count({
      status: 'active',
    });

    // New subscriptions this month (created this month and active)
    const newThisMonth = await this.subscriptionRepository.count({
      status: 'active',
      createdOn: {gte: startOfMonth},
    } as any);

    // Churned subscriptions this month (cancelled this month)
    const churnedThisMonth = await this.subscriptionRepository.count({
      status: 'cancelled',
      modifiedOn: {gte: startOfMonth},
    } as any);

    // Calculate growth rate (new - churned) / total last month
    const totalLastMonth = await this.subscriptionRepository.count({
      status: 'active',
      createdOn: {lt: startOfMonth},
    } as any);

    const growthRate =
      totalLastMonth.count > 0
        ? ((newThisMonth.count - churnedThisMonth.count) /
            totalLastMonth.count) *
          100
        : 0;

    return {
      totalActive: totalActive.count,
      newThisMonth: newThisMonth.count,
      churnedThisMonth: churnedThisMonth.count,
      growthRate: Math.round(growthRate * 100) / 100,
    };
  }

  /**
   * Get usage summary for current tenant's billing period.
   * Used by customer portal billing page to display usage metrics.
   */
  @authorize({
    permissions: [PermissionKey.ViewSubscription],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/usage`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Usage summary for current billing period',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
              properties: {
                tenantId: {type: 'string'},
                period: {
                  type: 'object',
                  properties: {
                    start: {type: 'string'},
                    end: {type: 'string'},
                  },
                },
                usage: {
                  type: 'object',
                  properties: {
                    boms: {
                      type: 'object',
                      properties: {
                        used: {type: 'number'},
                        limit: {type: 'number'},
                      },
                    },
                    components: {
                      type: 'object',
                      properties: {
                        used: {type: 'number'},
                        limit: {type: 'number'},
                      },
                    },
                    users: {
                      type: 'object',
                      properties: {
                        used: {type: 'number'},
                        limit: {type: 'number'},
                      },
                    },
                    apiCalls: {
                      type: 'object',
                      properties: {
                        used: {type: 'number'},
                        limit: {type: 'number'},
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  async getUsage(): Promise<{
    tenantId: string;
    period: {start: string; end: string};
    usage: {
      boms: {used: number; limit: number};
      components: {used: number; limit: number};
      users: {used: number; limit: number};
      apiCalls: {used: number; limit: number};
    };
  }> {
    const tenantId = this.getTenantId();

    // Get tenant's active subscription
    const subscriptions = await this.subscriptionRepository.find({
      where: {tenantId, status: 'active'},
      order: ['createdOn DESC'],
      limit: 1,
    });

    const subscription = subscriptions.length > 0 ? subscriptions[0] : null;

    // Determine billing period from subscription or use current month
    let periodStart: Date;
    let periodEnd: Date;

    if (subscription?.currentPeriodStart && subscription?.currentPeriodEnd) {
      periodStart = new Date(subscription.currentPeriodStart);
      periodEnd = new Date(subscription.currentPeriodEnd);
    } else {
      // Default to current month if no subscription
      const now = new Date();
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    // Get actual user count for this tenant
    const activeUserCount = await this.userRepository.count({
      tenantId,
      deleted: false,
      status: 1, // UserStatus.Active
    });

    // TODO: Get BOM count from App Plane (Supabase)
    // TODO: Get component count from App Plane
    // TODO: Implement API call tracking
    // For now, returning real user count and mock limits based on plan tier

    // Determine limits based on subscription plan
    let limits = {
      boms: 100,
      components: 10000,
      users: 10,
      apiCalls: 50000,
    };

    if (subscription) {
      // Adjust limits based on plan tier
      switch (subscription.planTier) {
        case 'free':
        case 'starter':
          limits = {boms: 10, components: 1000, users: 3, apiCalls: 5000};
          break;
        case 'basic':
          limits = {boms: 50, components: 5000, users: 5, apiCalls: 25000};
          break;
        case 'standard':
          limits = {boms: 100, components: 10000, users: 10, apiCalls: 50000};
          break;
        case 'professional':
        case 'premium':
          limits = {boms: 500, components: 50000, users: 25, apiCalls: 250000};
          break;
        case 'enterprise':
          limits = {boms: -1, components: -1, users: -1, apiCalls: -1}; // Unlimited
          break;
      }
    }

    return {
      tenantId,
      period: {
        start: periodStart.toISOString(),
        end: periodEnd.toISOString(),
      },
      usage: {
        boms: {used: 0, limit: limits.boms}, // TODO: Query App Plane Supabase
        components: {used: 0, limit: limits.components}, // TODO: Query App Plane
        users: {used: activeUserCount.count, limit: limits.users}, // ✓ REAL DATA
        apiCalls: {used: 0, limit: limits.apiCalls}, // TODO: Implement tracking
      },
    };
  }
}
