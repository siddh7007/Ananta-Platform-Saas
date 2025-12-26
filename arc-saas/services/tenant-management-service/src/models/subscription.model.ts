import {belongsTo, model, property} from '@loopback/repository';
import {UserModifiableEntity} from '@sourceloop/core';
import {Tenant} from './tenant.model';

@model({
  name: 'subscriptions',
  description: 'Subscription model representing tenant subscriptions to plans',
})
export class Subscription extends UserModifiableEntity {
  @property({
    type: 'string',
    id: true,
    generated: true,
  })
  id: string;

  @belongsTo(() => Tenant, undefined, {
    name: 'tenant_id',
    description: 'ID of the tenant this subscription belongs to',
  })
  tenantId: string;

  @property({
    type: 'string',
    required: true,
    description: 'ID of the plan (e.g., plan-basic, plan-standard, plan-premium)',
  })
  planId: string;

  @property({
    type: 'string',
    required: true,
    description: 'Name of the plan',
  })
  planName: string;

  @property({
    type: 'string',
    required: true,
    description: 'Plan tier (basic, standard, premium)',
    jsonSchema: {
      enum: ['free', 'starter', 'basic', 'standard', 'professional', 'premium', 'enterprise'],
    },
  })
  planTier: string;

  @property({
    type: 'string',
    required: true,
    description: 'Subscription status',
    jsonSchema: {
      enum: ['active', 'trialing', 'past_due', 'cancelled', 'paused', 'expired', 'pending', 'inactive'],
    },
    default: 'active',
  })
  status: string;

  @property({
    type: 'date',
    required: true,
    name: 'current_period_start',
    description: 'Start of current billing period',
  })
  currentPeriodStart: Date;

  @property({
    type: 'date',
    required: true,
    name: 'current_period_end',
    description: 'End of current billing period',
  })
  currentPeriodEnd: Date;

  @property({
    type: 'date',
    name: 'trial_start',
    description: 'Start of trial period',
  })
  trialStart?: Date;

  @property({
    type: 'date',
    name: 'trial_end',
    description: 'End of trial period',
  })
  trialEnd?: Date;

  @property({
    type: 'number',
    required: true,
    description: 'Subscription amount',
  })
  amount: number;

  @property({
    type: 'string',
    required: true,
    default: 'USD',
    description: 'Currency code',
  })
  currency: string;

  @property({
    type: 'string',
    required: true,
    name: 'billing_cycle',
    jsonSchema: {
      enum: ['monthly', 'yearly'],
    },
    default: 'monthly',
  })
  billingCycle: 'monthly' | 'yearly';

  @property({
    type: 'boolean',
    name: 'cancel_at_period_end',
    default: false,
    description: 'Whether subscription will cancel at end of period',
  })
  cancelAtPeriodEnd: boolean;

  @property({
    type: 'date',
    name: 'canceled_at',
    description: 'When the subscription was cancelled',
  })
  canceledAt?: Date;

  @property({
    type: 'string',
    name: 'cancel_reason',
    description: 'Reason for cancellation',
  })
  cancelReason?: string;

  @property({
    type: 'object',
    description: 'Additional metadata',
  })
  metadata?: Record<string, unknown>;

  constructor(data?: Partial<Subscription>) {
    super(data);
  }
}

export interface SubscriptionRelations {
  tenant?: Tenant;
}

export type SubscriptionWithRelations = Subscription & SubscriptionRelations;
