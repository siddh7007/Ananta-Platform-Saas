import {belongsTo, model, property} from '@loopback/repository';
import {UserModifiableEntity} from '@sourceloop/core';
import {Tenant} from './tenant.model';
import {Invoice} from './invoice.model';
import {PaymentIntentStatus} from '../enums';

@model({
  name: 'payment_intents',
  description: 'Payment intents tracking payment attempts for invoices',
})
export class PaymentIntent extends UserModifiableEntity {
  @property({
    type: 'string',
    id: true,
    generated: true,
  })
  id: string;

  @belongsTo(() => Tenant, undefined, {
    name: 'tenant_id',
    description: 'ID of the tenant this payment intent belongs to',
    required: true,
  })
  tenantId: string;

  @belongsTo(() => Invoice, undefined, {
    name: 'invoice_id',
    description: 'ID of the invoice this payment is for',
  })
  invoiceId?: string;

  @property({
    type: 'string',
    required: true,
    name: 'stripe_payment_intent_id',
    description: 'Stripe payment intent ID (pi_xxx)',
  })
  stripePaymentIntentId: string;

  @property({
    type: 'string',
    name: 'stripe_customer_id',
    description: 'Stripe customer ID (cus_xxx)',
  })
  stripeCustomerId?: string;

  @property({
    type: 'string',
    name: 'stripe_payment_method_id',
    description: 'Stripe payment method ID used (pm_xxx)',
  })
  stripePaymentMethodId?: string;

  @property({
    type: 'number',
    required: true,
    description: 'Amount in smallest currency unit (cents for USD)',
  })
  amount: number;

  @property({
    type: 'string',
    required: true,
    default: 'usd',
    description: 'Three-letter ISO currency code (lowercase)',
  })
  currency: string;

  @property({
    type: 'string',
    required: true,
    description: 'Payment intent status',
    jsonSchema: {
      enum: Object.values(PaymentIntentStatus),
    },
    default: PaymentIntentStatus.REQUIRES_PAYMENT_METHOD,
  })
  status: PaymentIntentStatus;

  @property({
    type: 'string',
    name: 'client_secret',
    description: 'Client secret for frontend payment confirmation',
  })
  clientSecret?: string;

  @property({
    type: 'string',
    description: 'Description of what this payment is for',
  })
  description?: string;

  @property({
    type: 'string',
    name: 'receipt_email',
    description: 'Email to send receipt to',
  })
  receiptEmail?: string;

  @property({
    type: 'string',
    name: 'failure_code',
    description: 'Error code if payment failed',
  })
  failureCode?: string;

  @property({
    type: 'string',
    name: 'failure_message',
    description: 'Human-readable failure message',
  })
  failureMessage?: string;

  @property({
    type: 'date',
    name: 'succeeded_at',
    description: 'When the payment succeeded',
  })
  succeededAt?: Date;

  @property({
    type: 'date',
    name: 'cancelled_at',
    description: 'When the payment was cancelled',
  })
  cancelledAt?: Date;

  @property({
    type: 'string',
    name: 'cancellation_reason',
    description: 'Reason for cancellation',
  })
  cancellationReason?: string;

  @property({
    type: 'number',
    name: 'amount_received',
    description: 'Amount actually received (may differ due to currency conversion)',
  })
  amountReceived?: number;

  @property({
    type: 'object',
    description: 'Additional metadata',
  })
  metadata?: Record<string, unknown>;

  constructor(data?: Partial<PaymentIntent>) {
    super(data);
  }
}

export interface PaymentIntentRelations {
  tenant?: Tenant;
  invoice?: Invoice;
}

export type PaymentIntentWithRelations = PaymentIntent & PaymentIntentRelations;
