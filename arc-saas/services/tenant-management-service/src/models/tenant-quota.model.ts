import {belongsTo, model, property} from '@loopback/repository';
import {UserModifiableEntity} from '@sourceloop/core';
import {Tenant} from './tenant.model';
import {UsageMetricType} from './usage-event.model';

/**
 * Model for managing per-tenant usage quotas and limits.
 * Quotas can be set per metric type with soft and hard limits.
 */
@model({
  name: 'tenant_quotas',
  description: 'Per-tenant usage quotas and limits for metered billing',
})
export class TenantQuota extends UserModifiableEntity {
  @property({
    type: 'string',
    id: true,
    generated: true,
  })
  id: string;

  @belongsTo(() => Tenant, undefined, {
    name: 'tenant_id',
    description: 'ID of the tenant this quota applies to',
  })
  tenantId: string;

  @property({
    type: 'string',
    required: true,
    name: 'metric_type',
    description: 'Type of usage metric this quota applies to',
    jsonSchema: {
      enum: Object.values(UsageMetricType),
    },
  })
  metricType: UsageMetricType;

  @property({
    type: 'string',
    name: 'metric_name',
    description: 'Human-readable name for the quota (e.g., "API Requests")',
  })
  metricName?: string;

  @property({
    type: 'number',
    required: true,
    name: 'soft_limit',
    description: 'Soft limit - triggers warning when reached',
  })
  softLimit: number;

  @property({
    type: 'number',
    required: true,
    name: 'hard_limit',
    description: 'Hard limit - blocks/throttles when reached',
  })
  hardLimit: number;

  @property({
    type: 'number',
    name: 'current_usage',
    description: 'Current period usage (cached for quick lookups)',
    default: 0,
  })
  currentUsage: number;

  @property({
    type: 'string',
    description: 'Unit of measurement',
    default: 'units',
  })
  unit: string;

  @property({
    type: 'string',
    name: 'reset_period',
    description: 'How often quota resets',
    jsonSchema: {
      enum: ['hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'],
    },
    default: 'monthly',
  })
  resetPeriod: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';

  @property({
    type: 'date',
    name: 'last_reset',
    description: 'When quota was last reset',
  })
  lastReset?: Date;

  @property({
    type: 'date',
    name: 'next_reset',
    description: 'When quota will next reset',
  })
  nextReset?: Date;

  @property({
    type: 'number',
    name: 'overage_rate',
    description: 'Cost per unit over the hard limit (if overages allowed)',
    default: 0,
  })
  overageRate: number;

  @property({
    type: 'boolean',
    name: 'allow_overage',
    description: 'Whether to allow usage over hard limit with overage charges',
    default: false,
  })
  allowOverage: boolean;

  @property({
    type: 'boolean',
    name: 'is_active',
    description: 'Whether this quota is actively enforced',
    default: true,
  })
  isActive: boolean;

  @property({
    type: 'object',
    description: 'Additional metadata',
  })
  metadata?: Record<string, unknown>;

  constructor(data?: Partial<TenantQuota>) {
    super(data);
  }
}

export interface TenantQuotaRelations {
  tenant?: Tenant;
}

export type TenantQuotaWithRelations = TenantQuota & TenantQuotaRelations;
