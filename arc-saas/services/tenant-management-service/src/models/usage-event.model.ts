import {belongsTo, model, property} from '@loopback/repository';
import {UserModifiableEntity} from '@sourceloop/core';
import {Tenant} from './tenant.model';

/**
 * Usage metric types for tracking consumption
 */
export enum UsageMetricType {
  API_CALLS = 'api_calls',
  STORAGE_GB = 'storage_gb',
  USERS = 'users',
  WORKFLOWS = 'workflows',
  INTEGRATIONS = 'integrations',
  CUSTOM = 'custom',
}

/**
 * Model for tracking tenant usage events/consumption.
 * Each event represents a discrete usage record that can be aggregated
 * for billing, analytics, and quota enforcement.
 */
@model({
  name: 'usage_events',
  description: 'Tracks tenant consumption and usage events for metered billing',
})
export class UsageEvent extends UserModifiableEntity {
  @property({
    type: 'string',
    id: true,
    generated: true,
  })
  id: string;

  @belongsTo(() => Tenant, undefined, {
    name: 'tenant_id',
    description: 'ID of the tenant this usage belongs to',
  })
  tenantId: string;

  @property({
    type: 'string',
    required: true,
    name: 'metric_type',
    description: 'Type of usage metric being tracked',
    jsonSchema: {
      enum: Object.values(UsageMetricType),
    },
  })
  metricType: UsageMetricType;

  @property({
    type: 'string',
    name: 'metric_name',
    description: 'Human-readable name for the metric (e.g., "API Requests")',
  })
  metricName?: string;

  @property({
    type: 'number',
    required: true,
    description: 'Quantity of usage (e.g., number of API calls, GB stored)',
    default: 1,
  })
  quantity: number;

  @property({
    type: 'string',
    description: 'Unit of measurement (e.g., "requests", "GB", "users")',
    default: 'units',
  })
  unit: string;

  @property({
    type: 'date',
    required: true,
    name: 'event_timestamp',
    description: 'When the usage event occurred',
  })
  eventTimestamp: Date;

  @property({
    type: 'string',
    name: 'billing_period',
    description: 'Billing period this event belongs to (YYYY-MM format)',
  })
  billingPeriod?: string;

  @property({
    type: 'string',
    description: 'Source service that reported this usage',
  })
  source?: string;

  @property({
    type: 'string',
    name: 'resource_id',
    description: 'Optional ID of the resource associated with usage',
  })
  resourceId?: string;

  @property({
    type: 'object',
    description: 'Additional metadata about the usage event',
  })
  metadata?: Record<string, unknown>;

  constructor(data?: Partial<UsageEvent>) {
    super(data);
  }
}

export interface UsageEventRelations {
  tenant?: Tenant;
}

export type UsageEventWithRelations = UsageEvent & UsageEventRelations;
