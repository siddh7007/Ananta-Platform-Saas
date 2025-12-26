import {belongsTo, model, property} from '@loopback/repository';
import {UserModifiableEntity} from '@sourceloop/core';
import {Tenant} from './tenant.model';
import {UsageMetricType} from './usage-event.model';

/**
 * Model for storing aggregated usage summaries per tenant per period.
 * Pre-computed aggregates for faster reporting and billing calculations.
 */
@model({
  name: 'usage_summaries',
  description: 'Aggregated usage summaries by tenant and billing period',
})
export class UsageSummary extends UserModifiableEntity {
  @property({
    type: 'string',
    id: true,
    generated: true,
  })
  id: string;

  @belongsTo(() => Tenant, undefined, {
    name: 'tenant_id',
    description: 'ID of the tenant this summary is for',
  })
  tenantId: string;

  @property({
    type: 'string',
    required: true,
    name: 'metric_type',
    description: 'Type of usage metric',
    jsonSchema: {
      enum: Object.values(UsageMetricType),
    },
  })
  metricType: UsageMetricType;

  @property({
    type: 'string',
    required: true,
    name: 'billing_period',
    description: 'Billing period (YYYY-MM format)',
  })
  billingPeriod: string;

  @property({
    type: 'number',
    required: true,
    name: 'total_quantity',
    description: 'Total usage quantity for the period',
    default: 0,
  })
  totalQuantity: number;

  @property({
    type: 'number',
    name: 'included_quantity',
    description: 'Quantity included in plan',
    default: 0,
  })
  includedQuantity: number;

  @property({
    type: 'number',
    name: 'overage_quantity',
    description: 'Quantity over plan limit (subject to overage charges)',
    default: 0,
  })
  overageQuantity: number;

  @property({
    type: 'number',
    name: 'overage_amount',
    description: 'Total overage charges for the period',
    default: 0,
  })
  overageAmount: number;

  @property({
    type: 'string',
    description: 'Unit of measurement',
    default: 'units',
  })
  unit: string;

  @property({
    type: 'number',
    name: 'event_count',
    description: 'Number of individual usage events aggregated',
    default: 0,
  })
  eventCount: number;

  @property({
    type: 'number',
    name: 'peak_usage',
    description: 'Peak usage during the period (for metrics like storage)',
  })
  peakUsage?: number;

  @property({
    type: 'number',
    name: 'average_usage',
    description: 'Average usage during the period',
  })
  averageUsage?: number;

  @property({
    type: 'date',
    name: 'period_start',
    description: 'Start of billing period',
  })
  periodStart?: Date;

  @property({
    type: 'date',
    name: 'period_end',
    description: 'End of billing period',
  })
  periodEnd?: Date;

  @property({
    type: 'date',
    name: 'last_updated',
    description: 'When this summary was last recalculated',
  })
  lastUpdated?: Date;

  @property({
    type: 'object',
    description: 'Additional metadata',
  })
  metadata?: Record<string, unknown>;

  constructor(data?: Partial<UsageSummary>) {
    super(data);
  }
}

export interface UsageSummaryRelations {
  tenant?: Tenant;
}

export type UsageSummaryWithRelations = UsageSummary & UsageSummaryRelations;
