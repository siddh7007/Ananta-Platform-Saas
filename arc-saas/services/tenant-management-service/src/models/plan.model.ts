import {model, property} from '@loopback/repository';
import {UserModifiableEntity} from '@sourceloop/core';

@model({
  name: 'plans',
  description: 'Subscription plan model',
})
export class SubscriptionPlan extends UserModifiableEntity {
  @property({
    type: 'string',
    id: true,
    description: 'Plan ID (e.g., plan-basic, plan-standard)',
  })
  id: string;

  @property({
    type: 'string',
    required: true,
    description: 'Display name of the plan',
  })
  name: string;

  @property({
    type: 'string',
    description: 'Plan description',
  })
  description?: string;

  @property({
    type: 'string',
    required: true,
    description: 'Plan tier (FREE, BASIC, STANDARD, PREMIUM, ENTERPRISE)',
    jsonSchema: {
      enum: ['FREE', 'BASIC', 'STANDARD', 'PREMIUM', 'ENTERPRISE'],
    },
  })
  tier: string;

  @property({
    type: 'number',
    required: true,
    description: 'Price in dollars',
  })
  price: number;

  @property({
    type: 'string',
    required: true,
    name: 'billing_cycle',
    description: 'Billing cycle (month, quarter, year)',
    jsonSchema: {
      enum: ['month', 'quarter', 'year'],
    },
    default: 'month',
  })
  billingCycle: string;

  @property({
    type: 'object',
    description: 'List of features included in this plan (stored as JSON array)',
    default: [],
    postgresql: {dataType: 'jsonb'},
  })
  features: string[];

  @property({
    type: 'boolean',
    name: 'is_active',
    description: 'Whether this plan is available for subscription',
    default: true,
  })
  isActive: boolean;

  @property({
    type: 'object',
    description: 'Plan limits (maxUsers, maxStorage, maxProjects, maxApiCalls)',
    postgresql: {dataType: 'jsonb'},
  })
  limits?: {
    maxUsers?: number | null;
    maxStorage?: number | null;
    maxProjects?: number | null;
    maxApiCalls?: number | null;
  };

  @property({
    type: 'boolean',
    name: 'trial_enabled',
    description: 'Whether trial is enabled for this plan',
    default: false,
  })
  trialEnabled?: boolean;

  @property({
    type: 'number',
    name: 'trial_duration',
    description: 'Trial duration',
    default: 14,
  })
  trialDuration?: number;

  @property({
    type: 'string',
    name: 'trial_duration_unit',
    description: 'Trial duration unit (days, weeks, months)',
    jsonSchema: {
      enum: ['days', 'weeks', 'months'],
    },
    default: 'days',
  })
  trialDurationUnit?: string;

  @property({
    type: 'string',
    name: 'stripe_product_id',
    description: 'Stripe Product ID',
  })
  stripeProductId?: string;

  @property({
    type: 'string',
    name: 'stripe_price_id',
    description: 'Stripe Price ID',
  })
  stripePriceId?: string;

  @property({
    type: 'boolean',
    name: 'is_popular',
    description: 'Mark this plan as popular/recommended',
    default: false,
  })
  isPopular?: boolean;

  @property({
    type: 'number',
    name: 'sort_order',
    description: 'Display sort order',
    default: 0,
  })
  sortOrder?: number;

  constructor(data?: Partial<SubscriptionPlan>) {
    super(data);
  }
}

export interface SubscriptionPlanRelations {}

export type SubscriptionPlanWithRelations = SubscriptionPlan & SubscriptionPlanRelations;
