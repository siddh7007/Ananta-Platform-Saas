import {model, property, belongsTo} from '@loopback/repository';
import {UserModifiableEntity} from '@sourceloop/core';
import {BillingCycle} from './billing-cycle.model';
import {Currency} from './currency.model';

@model({
  name: 'plans',
})
export class Plan extends UserModifiableEntity {
  @property({
    type: 'string',
    id: true,
    generated: true,
  })
  id: string;

  @property({
    type: 'string',
    description: 'name of the plan',
    required: true,
  })
  name: string;

  @property({
    type: 'string',
    description: 'description of the plan',
  })
  description?: string;

  @property({
    type: 'string',
    required: true,
    description: 'Tier of the plan.',
  })
  tier: string;

  @property({
    type: 'string',
    description: 'Size of the plan.',
  })
  size?: string;

  @property({
    type: 'number',
    required: true,
  })
  price: number;

  // Trial configuration
  @property({
    type: 'boolean',
    default: false,
    name: 'trial_enabled',
    description: 'Whether this plan offers a trial period',
  })
  trialEnabled?: boolean;

  @property({
    type: 'number',
    name: 'trial_duration',
    description: 'Duration of trial period',
  })
  trialDuration?: number;

  @property({
    type: 'string',
    name: 'trial_duration_unit',
    description: 'Unit for trial duration (day, week, month)',
  })
  trialDurationUnit?: string;

  // Plan limits and quotas
  @property({
    type: 'object',
    name: 'limits',
    description: 'Resource limits for this plan (e.g., {orders_per_month: 1000, storage_gb: 10})',
  })
  limits?: object;

  // Features as array for easy lookup
  @property({
    type: 'array',
    itemType: 'string',
    description: 'List of feature keys enabled for this plan',
  })
  features?: string[];

  // Plan visibility
  @property({
    type: 'boolean',
    default: true,
    name: 'is_public',
    description: 'Whether this plan is publicly visible',
  })
  isPublic?: boolean;

  @property({
    type: 'boolean',
    default: true,
    name: 'is_active',
    description: 'Whether this plan is currently available for new subscriptions',
  })
  isActive?: boolean;

  @property({
    type: 'number',
    name: 'sort_order',
    description: 'Display order for plan listing',
  })
  sortOrder?: number;

  @property({
    type: 'object',
    name: 'meta_data',
    description: 'Meta data of the plan',
  })
  metaData?: object;

  // Stripe integration
  @property({
    type: 'string',
    name: 'stripe_price_id',
    description: 'Stripe Price ID for this plan',
  })
  stripePriceId?: string;

  @property({
    type: 'string',
    name: 'stripe_product_id',
    description: 'Stripe Product ID for this plan',
  })
  stripeProductId?: string;

  @belongsTo(
    () => BillingCycle,
    {
      keyTo: 'id',
    },
    {
      name: 'billing_cycle_id',
    },
  )
  billingCycleId: string;

  @belongsTo(() => Currency, undefined, {
    name: 'currency_id',
  })
  currencyId: string;

  constructor(data?: Partial<Plan>) {
    super(data);
  }
}

export interface PlanRelations {}

export type PlanWithRelations = Plan;
