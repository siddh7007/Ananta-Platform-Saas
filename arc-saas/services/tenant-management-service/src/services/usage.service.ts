import {injectable, BindingScope, inject} from '@loopback/core';
import {repository, Where} from '@loopback/repository';
import {IAuthUserWithPermissions} from '@sourceloop/core';
import {AuthenticationBindings} from 'loopback4-authentication';
import {
  UsageEventRepository,
  TenantQuotaRepository,
  UsageSummaryRepository,
  SubscriptionRepository,
} from '../repositories/sequelize';
import {
  UsageEvent,
  UsageMetricType,
  TenantQuota,
  UsageSummary,
  Subscription,
} from '../models';

/**
 * Input for recording a usage event
 */
export interface RecordUsageInput {
  tenantId: string;
  metricType: UsageMetricType;
  quantity: number;
  unit?: string;
  source?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Usage status for a tenant
 */
export interface UsageStatus {
  metricType: UsageMetricType;
  metricName: string;
  currentUsage: number;
  softLimit: number;
  hardLimit: number;
  percentUsed: number;
  isOverSoftLimit: boolean;
  isOverHardLimit: boolean;
  unit: string;
  remainingAllowance: number;
  allowOverage: boolean;
  overageRate: number;
}

/**
 * Plan quota configuration with overage settings
 */
interface PlanQuotaConfig {
  metricType: UsageMetricType;
  metricName: string;
  softLimit: number;
  hardLimit: number;
  unit: string;
  allowOverage: boolean;
  overageRate: number; // Cost per unit over hard limit
}

/**
 * Usage trend data point
 */
export interface UsageTrendPoint {
  period: string;
  quantity: number;
  eventCount: number;
}

/**
 * Service for managing tenant usage tracking, quotas, and analytics.
 */
@injectable({scope: BindingScope.TRANSIENT})
export class UsageService {
  constructor(
    @repository(UsageEventRepository)
    private readonly usageEventRepo: UsageEventRepository,
    @repository(TenantQuotaRepository)
    private readonly tenantQuotaRepo: TenantQuotaRepository,
    @repository(UsageSummaryRepository)
    private readonly usageSummaryRepo: UsageSummaryRepository,
    @repository(SubscriptionRepository)
    private readonly subscriptionRepo: SubscriptionRepository,
    @inject(AuthenticationBindings.CURRENT_USER, {optional: true})
    private readonly currentUser?: IAuthUserWithPermissions,
  ) {}

  /**
   * Get current billing period in YYYY-MM format
   */
  getCurrentBillingPeriod(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Record a usage event and update quotas
   */
  async recordUsage(input: RecordUsageInput): Promise<UsageEvent> {
    const now = new Date();
    const billingPeriod = this.getCurrentBillingPeriod();

    // Create usage event
    const event = await this.usageEventRepo.create({
      tenantId: input.tenantId,
      metricType: input.metricType,
      quantity: input.quantity,
      unit: input.unit || 'units',
      eventTimestamp: now,
      billingPeriod,
      source: input.source,
      resourceId: input.resourceId,
      metadata: input.metadata,
    });

    // Update quota current usage (if quota exists)
    await this.updateQuotaUsage(input.tenantId, input.metricType, input.quantity);

    // Update summary (async, don't block)
    this.updateSummary(input.tenantId, input.metricType, billingPeriod).catch(err => {
      console.error('Failed to update usage summary:', err);
    });

    return event;
  }

  /**
   * Update quota current usage
   */
  private async updateQuotaUsage(
    tenantId: string,
    metricType: UsageMetricType,
    quantity: number,
  ): Promise<void> {
    const quota = await this.tenantQuotaRepo.findOne({
      where: {tenantId, metricType, isActive: true} as Where<TenantQuota>,
    });

    if (quota) {
      await this.tenantQuotaRepo.updateById(quota.id, {
        currentUsage: (quota.currentUsage || 0) + quantity,
      });
    }
  }

  /**
   * Update or create usage summary for a period
   */
  private async updateSummary(
    tenantId: string,
    metricType: UsageMetricType,
    billingPeriod: string,
  ): Promise<void> {
    // Get existing summary
    let summary = await this.usageSummaryRepo.findOne({
      where: {tenantId, metricType, billingPeriod} as Where<UsageSummary>,
    });

    // Aggregate usage for the period
    const events = await this.usageEventRepo.find({
      where: {tenantId, metricType, billingPeriod} as Where<UsageEvent>,
    });

    const totalQuantity = events.reduce((sum, e) => sum + e.quantity, 0);
    const eventCount = events.length;

    // Get quota for included quantity
    const quota = await this.tenantQuotaRepo.findOne({
      where: {tenantId, metricType, isActive: true} as Where<TenantQuota>,
    });

    const includedQuantity = quota?.hardLimit || 0;
    const overageQuantity = Math.max(0, totalQuantity - includedQuantity);
    const overageAmount = quota?.allowOverage
      ? overageQuantity * (quota.overageRate || 0)
      : 0;

    if (summary) {
      await this.usageSummaryRepo.updateById(summary.id, {
        totalQuantity,
        eventCount,
        includedQuantity,
        overageQuantity,
        overageAmount,
        lastUpdated: new Date(),
      });
    } else {
      await this.usageSummaryRepo.create({
        tenantId,
        metricType,
        billingPeriod,
        totalQuantity,
        eventCount,
        includedQuantity,
        overageQuantity,
        overageAmount,
        unit: events[0]?.unit || 'units',
        lastUpdated: new Date(),
      });
    }
  }

  /**
   * Get usage status for a tenant (all metrics)
   */
  async getUsageStatus(tenantId: string): Promise<UsageStatus[]> {
    const quotas = await this.tenantQuotaRepo.find({
      where: {tenantId, isActive: true} as Where<TenantQuota>,
    });

    return quotas.map(quota => {
      const percentUsed = quota.hardLimit > 0
        ? (quota.currentUsage / quota.hardLimit) * 100
        : 0;

      return {
        metricType: quota.metricType,
        metricName: quota.metricName || this.getMetricDisplayName(quota.metricType),
        currentUsage: quota.currentUsage,
        softLimit: quota.softLimit,
        hardLimit: quota.hardLimit,
        percentUsed: Math.round(percentUsed * 100) / 100,
        isOverSoftLimit: quota.currentUsage >= quota.softLimit,
        isOverHardLimit: quota.currentUsage >= quota.hardLimit,
        unit: quota.unit,
        remainingAllowance: Math.max(0, quota.hardLimit - quota.currentUsage),
        allowOverage: quota.allowOverage,
        overageRate: quota.overageRate,
      };
    });
  }

  /**
   * Get usage trend for a metric over time
   */
  async getUsageTrend(
    tenantId: string,
    metricType: UsageMetricType,
    months: number = 6,
  ): Promise<UsageTrendPoint[]> {
    const summaries = await this.usageSummaryRepo.find({
      where: {tenantId, metricType} as Where<UsageSummary>,
      order: ['billingPeriod DESC'],
      limit: months,
    });

    return summaries
      .map(s => ({
        period: s.billingPeriod,
        quantity: s.totalQuantity,
        eventCount: s.eventCount,
      }))
      .reverse();
  }

  /**
   * Check if tenant has exceeded quota
   */
  async checkQuotaExceeded(
    tenantId: string,
    metricType: UsageMetricType,
  ): Promise<{exceeded: boolean; quota?: TenantQuota}> {
    const quota = await this.tenantQuotaRepo.findOne({
      where: {tenantId, metricType, isActive: true} as Where<TenantQuota>,
    });

    if (!quota) {
      return {exceeded: false};
    }

    const exceeded = quota.currentUsage >= quota.hardLimit && !quota.allowOverage;
    return {exceeded, quota};
  }

  /**
   * Get plan quota configuration based on plan tier.
   * Plan tiers are: free, basic, standard, premium, enterprise
   */
  private getPlanQuotaConfig(planTier: string): PlanQuotaConfig[] {
    // Normalize plan tier to lowercase
    const tier = planTier.toLowerCase().replace('plan-', '');

    // Define quota configurations per plan tier with overage settings
    const planConfigs: Record<string, PlanQuotaConfig[]> = {
      'free': [
        {metricType: UsageMetricType.API_CALLS, metricName: 'API Requests', softLimit: 800, hardLimit: 1000, unit: 'requests', allowOverage: false, overageRate: 0},
        {metricType: UsageMetricType.STORAGE_GB, metricName: 'Storage', softLimit: 0.8, hardLimit: 1, unit: 'GB', allowOverage: false, overageRate: 0},
        {metricType: UsageMetricType.USERS, metricName: 'Users', softLimit: 1, hardLimit: 1, unit: 'users', allowOverage: false, overageRate: 0},
      ],
      'basic': [
        {metricType: UsageMetricType.API_CALLS, metricName: 'API Requests', softLimit: 8000, hardLimit: 10000, unit: 'requests', allowOverage: true, overageRate: 0.001}, // $0.001 per extra request
        {metricType: UsageMetricType.STORAGE_GB, metricName: 'Storage', softLimit: 8, hardLimit: 10, unit: 'GB', allowOverage: true, overageRate: 0.10}, // $0.10 per extra GB
        {metricType: UsageMetricType.USERS, metricName: 'Users', softLimit: 5, hardLimit: 5, unit: 'users', allowOverage: true, overageRate: 5.00}, // $5 per extra user
      ],
      'standard': [
        {metricType: UsageMetricType.API_CALLS, metricName: 'API Requests', softLimit: 80000, hardLimit: 100000, unit: 'requests', allowOverage: true, overageRate: 0.0005}, // $0.0005 per extra request
        {metricType: UsageMetricType.STORAGE_GB, metricName: 'Storage', softLimit: 80, hardLimit: 100, unit: 'GB', allowOverage: true, overageRate: 0.08}, // $0.08 per extra GB
        {metricType: UsageMetricType.USERS, metricName: 'Users', softLimit: 25, hardLimit: 25, unit: 'users', allowOverage: true, overageRate: 3.00}, // $3 per extra user
      ],
      'premium': [
        {metricType: UsageMetricType.API_CALLS, metricName: 'API Requests', softLimit: 900000, hardLimit: 1000000, unit: 'requests', allowOverage: true, overageRate: 0.0001}, // $0.0001 per extra request
        {metricType: UsageMetricType.STORAGE_GB, metricName: 'Storage', softLimit: 900, hardLimit: 1000, unit: 'GB', allowOverage: true, overageRate: 0.05}, // $0.05 per extra GB
        {metricType: UsageMetricType.USERS, metricName: 'Users', softLimit: 100, hardLimit: 100, unit: 'users', allowOverage: true, overageRate: 2.00}, // $2 per extra user
      ],
      'enterprise': [
        // Enterprise has very high limits and unlimited users
        {metricType: UsageMetricType.API_CALLS, metricName: 'API Requests', softLimit: 9000000, hardLimit: 10000000, unit: 'requests', allowOverage: true, overageRate: 0.00005},
        {metricType: UsageMetricType.STORAGE_GB, metricName: 'Storage', softLimit: 9000, hardLimit: 10000, unit: 'GB', allowOverage: true, overageRate: 0.03},
        {metricType: UsageMetricType.USERS, metricName: 'Users', softLimit: 1000000, hardLimit: 1000000, unit: 'users', allowOverage: true, overageRate: 0}, // Unlimited
      ],
    };

    // Return config for the tier, or default to basic
    return planConfigs[tier] || planConfigs['basic'];
  }

  /**
   * Get the plan tier from a tenant's active subscription
   */
  async getPlanTierForTenant(tenantId: string): Promise<string> {
    const subscription = await this.subscriptionRepo.findOne({
      where: {
        tenantId,
        status: 'active',
      } as Where<Subscription>,
    });

    if (!subscription) {
      // No active subscription, return free tier
      return 'free';
    }

    // Extract tier from planId (e.g., "plan-basic" -> "basic")
    // Also handles direct tier names and UUIDs with metadata
    const planId = subscription.planId || '';

    // Check if planId matches known patterns
    if (planId.startsWith('plan-')) {
      return planId.replace('plan-', '');
    }

    // Check if it's a direct tier name
    const knownTiers = ['free', 'basic', 'standard', 'premium', 'enterprise'];
    if (knownTiers.includes(planId.toLowerCase())) {
      return planId.toLowerCase();
    }

    // Default to basic if we can't determine the tier
    return 'basic';
  }

  /**
   * Initialize default quotas for a tenant based on their plan.
   * If planId is not provided, looks up from tenant's active subscription.
   */
  async initializeQuotasForPlan(
    tenantId: string,
    planId?: string,
  ): Promise<TenantQuota[]> {
    // Determine the plan tier
    let planTier: string;
    if (planId) {
      // Use provided planId (normalize it)
      planTier = planId.toLowerCase().replace('plan-', '');
    } else {
      // Look up from tenant's subscription
      planTier = await this.getPlanTierForTenant(tenantId);
    }

    const quotaConfigs = this.getPlanQuotaConfig(planTier);
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const createdQuotas: TenantQuota[] = [];

    for (const config of quotaConfigs) {
      // Check if quota already exists
      const existing = await this.tenantQuotaRepo.findOne({
        where: {tenantId, metricType: config.metricType} as Where<TenantQuota>,
      });

      if (existing) {
        // Update existing quota with new plan limits (but preserve currentUsage)
        await this.tenantQuotaRepo.updateById(existing.id, {
          softLimit: config.softLimit,
          hardLimit: config.hardLimit,
          allowOverage: config.allowOverage,
          overageRate: config.overageRate,
          metricName: config.metricName,
        });
        // Fetch updated quota
        const updated = await this.tenantQuotaRepo.findById(existing.id);
        createdQuotas.push(updated);
      } else {
        const quota = await this.tenantQuotaRepo.create({
          tenantId,
          metricType: config.metricType,
          metricName: config.metricName,
          softLimit: config.softLimit,
          hardLimit: config.hardLimit,
          unit: config.unit,
          currentUsage: 0,
          resetPeriod: 'monthly',
          lastReset: now,
          nextReset: nextMonth,
          allowOverage: config.allowOverage,
          overageRate: config.overageRate,
          isActive: true,
        });
        createdQuotas.push(quota);
      }
    }

    return createdQuotas;
  }

  /**
   * Reset quotas for a new billing period for a specific tenant.
   * Only resets quotas that are due for reset.
   */
  async resetQuotasForPeriod(tenantId: string): Promise<{reset: number; skipped: number}> {
    const quotas = await this.tenantQuotaRepo.find({
      where: {tenantId, isActive: true} as Where<TenantQuota>,
    });

    const now = new Date();
    let reset = 0;
    let skipped = 0;

    for (const quota of quotas) {
      // Skip quotas that don't reset
      if (quota.resetPeriod === 'never') {
        skipped++;
        continue;
      }

      // Check if reset is due
      if (quota.nextReset && quota.nextReset <= now) {
        const nextReset = this.calculateNextReset(now, quota.resetPeriod);
        await this.tenantQuotaRepo.updateById(quota.id, {
          currentUsage: 0,
          lastReset: now,
          nextReset,
        });
        reset++;
      } else {
        skipped++;
      }
    }

    return {reset, skipped};
  }

  /**
   * Calculate the next reset date based on reset period.
   */
  private calculateNextReset(
    from: Date,
    resetPeriod: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never',
  ): Date {
    const next = new Date(from);

    switch (resetPeriod) {
      case 'hourly':
        next.setHours(next.getHours() + 1, 0, 0, 0);
        break;
      case 'daily':
        next.setDate(next.getDate() + 1);
        next.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        next.setHours(0, 0, 0, 0);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1, 1);
        next.setHours(0, 0, 0, 0);
        break;
      case 'yearly':
        next.setFullYear(next.getFullYear() + 1, 0, 1);
        next.setHours(0, 0, 0, 0);
        break;
      default:
        // 'never' - return far future date
        next.setFullYear(next.getFullYear() + 100);
    }

    return next;
  }

  /**
   * Reset all tenant quotas that are due for reset.
   * This method should be called by a scheduled job (cron/temporal).
   * Returns summary of all resets performed.
   */
  async resetAllDueQuotas(): Promise<{
    tenantsProcessed: number;
    quotasReset: number;
    errors: Array<{tenantId: string; error: string}>;
  }> {
    const now = new Date();

    // Find all quotas due for reset
    const quotas = await this.tenantQuotaRepo.find({
      where: {
        isActive: true,
        deleted: false,
      } as Where<TenantQuota>,
    });

    // Filter to quotas that need reset
    const dueQuotas = quotas.filter(q =>
      q.resetPeriod !== 'never' &&
      q.nextReset &&
      q.nextReset <= now
    );

    const tenantsSet = new Set<string>();
    let quotasReset = 0;
    const errors: Array<{tenantId: string; error: string}> = [];

    for (const quota of dueQuotas) {
      try {
        const nextReset = this.calculateNextReset(now, quota.resetPeriod);
        await this.tenantQuotaRepo.updateById(quota.id, {
          currentUsage: 0,
          lastReset: now,
          nextReset,
        });
        tenantsSet.add(quota.tenantId);
        quotasReset++;
      } catch (err) {
        errors.push({
          tenantId: quota.tenantId,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return {
      tenantsProcessed: tenantsSet.size,
      quotasReset,
      errors,
    };
  }

  /**
   * Force reset all quotas for a tenant (admin operation).
   * Resets regardless of nextReset date.
   */
  async forceResetAllQuotas(tenantId: string): Promise<{reset: number}> {
    const quotas = await this.tenantQuotaRepo.find({
      where: {tenantId, isActive: true} as Where<TenantQuota>,
    });

    const now = new Date();
    let reset = 0;

    for (const quota of quotas) {
      const nextReset = this.calculateNextReset(now, quota.resetPeriod);
      await this.tenantQuotaRepo.updateById(quota.id, {
        currentUsage: 0,
        lastReset: now,
        nextReset,
      });
      reset++;
    }

    return {reset};
  }

  /**
   * Get aggregated usage analytics for a tenant
   */
  async getUsageAnalytics(tenantId: string, billingPeriod?: string): Promise<{
    period: string;
    metrics: Array<{
      metricType: UsageMetricType;
      metricName: string;
      totalUsage: number;
      includedUsage: number;
      overageUsage: number;
      overageAmount: number;
      unit: string;
    }>;
    totalOverageAmount: number;
  }> {
    const period = billingPeriod || this.getCurrentBillingPeriod();

    const summaries = await this.usageSummaryRepo.find({
      where: {tenantId, billingPeriod: period} as Where<UsageSummary>,
    });

    const metrics = summaries.map(s => ({
      metricType: s.metricType,
      metricName: this.getMetricDisplayName(s.metricType),
      totalUsage: s.totalQuantity,
      includedUsage: Math.min(s.totalQuantity, s.includedQuantity),
      overageUsage: s.overageQuantity,
      overageAmount: s.overageAmount,
      unit: s.unit,
    }));

    const totalOverageAmount = metrics.reduce((sum, m) => sum + m.overageAmount, 0);

    return {period, metrics, totalOverageAmount};
  }

  /**
   * Get display name for a metric type
   */
  private getMetricDisplayName(metricType: UsageMetricType): string {
    const names: Record<UsageMetricType, string> = {
      [UsageMetricType.API_CALLS]: 'API Requests',
      [UsageMetricType.STORAGE_GB]: 'Storage',
      [UsageMetricType.USERS]: 'Users',
      [UsageMetricType.WORKFLOWS]: 'Workflows',
      [UsageMetricType.INTEGRATIONS]: 'Integrations',
      [UsageMetricType.CUSTOM]: 'Custom',
    };
    return names[metricType] || metricType;
  }
}
