import {model, property, belongsTo} from '@loopback/repository';
import {SubscriptionStatus} from '../enums/subscription-status.enum';
import {numericEnumValues} from '../utils';
import {UserModifiableEntity} from '@sourceloop/core';
import {Plan} from './plan.model';
import {Invoice} from './invoice.model';

@model({
  name: 'subscriptions',
})
export class Subscription extends UserModifiableEntity {
  @property({
    type: 'string',
    id: true,
    generated: true,
  })
  id: string;

  @property({
    type: 'string',
    required: true,
    name: 'subscriber_id',
  })
  subscriberId: string;

  @property({
    type: 'string',
    required: true,
    name: 'start_date',
  })
  startDate: string;

  @property({
    type: 'string',
    required: true,
    name: 'end_date',
  })
  endDate: string;

  @property({
    type: 'number',
    required: true,
    description:
      'status of the subscription, it can be - 0(pending), 1(active), 2(inactive), 3(cancelled) and 4(expired)',
    jsonSchema: {
      enum: numericEnumValues(SubscriptionStatus),
    },
  })
  status: SubscriptionStatus;

  // Trial support
  @property({
    type: 'boolean',
    default: false,
    name: 'is_trial',
    description: 'Whether this subscription is currently in trial period',
  })
  isTrial?: boolean;

  @property({
    type: 'string',
    name: 'trial_end_date',
    description: 'End date of the trial period',
  })
  trialEndDate?: string;

  // Renewal tracking
  @property({
    type: 'boolean',
    default: true,
    name: 'auto_renew',
    description: 'Whether subscription should auto-renew at end of period',
  })
  autoRenew?: boolean;

  @property({
    type: 'number',
    default: 0,
    name: 'renewal_count',
    description: 'Number of times this subscription has been renewed',
  })
  renewalCount?: number;

  @property({
    type: 'string',
    name: 'cancelled_at',
    description: 'Date when the subscription was cancelled',
  })
  cancelledAt?: string;

  @property({
    type: 'string',
    name: 'cancellation_reason',
    description: 'Reason for cancellation',
  })
  cancellationReason?: string;

  // Upgrade/downgrade tracking
  @property({
    type: 'string',
    name: 'previous_plan_id',
    description: 'Previous plan ID if this is a plan change',
  })
  previousPlanId?: string;

  @property({
    type: 'string',
    name: 'plan_changed_at',
    description: 'Date when the plan was changed',
  })
  planChangedAt?: string;

  // Proration credit
  @property({
    type: 'number',
    name: 'proration_credit',
    description: 'Credit amount from prorated plan change',
  })
  prorationCredit?: number;

  // External references
  @property({
    type: 'string',
    name: 'external_subscription_id',
    description: 'ID of subscription in external billing provider (Stripe, etc.)',
  })
  externalSubscriptionId?: string;

  @property({
    type: 'object',
    name: 'meta_data',
    description: 'Additional subscription metadata',
  })
  metaData?: object;

  @belongsTo(() => Plan, undefined, {
    description: 'plan id of the subscription',
    name: 'plan_id',
  })
  planId: string;

  @belongsTo(() => Invoice, undefined, {
    description: 'invoice id of the subscription',
    name: 'invoice_id',
  })
  invoiceId: string;

  constructor(data?: Partial<Subscription>) {
    super(data);
  }
}

export interface SubscriptionRelations {
  plan: Plan;
}

export type SubscriptionWithRelations = Subscription & SubscriptionRelations;
