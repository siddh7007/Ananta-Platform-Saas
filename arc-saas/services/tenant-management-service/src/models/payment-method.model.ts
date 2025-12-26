import {belongsTo, model, property} from '@loopback/repository';
import {UserModifiableEntity} from '@sourceloop/core';
import {Tenant} from './tenant.model';
import {PaymentMethodType} from '../enums';

/**
 * Card details stored for payment method (sanitized - no full card number)
 */
export interface CardDetails {
  /** Card brand (visa, mastercard, amex, etc.) */
  brand: string;
  /** Last 4 digits of card number */
  last4: string;
  /** Card expiration month (1-12) */
  expMonth: number;
  /** Card expiration year (4-digit) */
  expYear: number;
  /** Card funding type (credit, debit, prepaid) */
  funding?: string;
  /** Country of card issuer */
  country?: string;
}

/**
 * Bank account details stored for payment method
 */
export interface BankAccountDetails {
  /** Bank name */
  bankName?: string;
  /** Last 4 digits of account number */
  last4: string;
  /** Account holder type (individual, company) */
  accountHolderType?: string;
  /** Routing number (masked) */
  routingNumber?: string;
}

@model({
  name: 'payment_methods',
  description: 'Payment methods stored for tenant billing (cards, bank accounts)',
})
export class PaymentMethod extends UserModifiableEntity {
  @property({
    type: 'string',
    id: true,
    generated: true,
  })
  id: string;

  @belongsTo(() => Tenant, undefined, {
    name: 'tenant_id',
    description: 'ID of the tenant this payment method belongs to',
    required: true,
  })
  tenantId: string;

  @property({
    type: 'string',
    required: true,
    name: 'stripe_payment_method_id',
    description: 'Stripe payment method ID (pm_xxx)',
  })
  stripePaymentMethodId: string;

  @property({
    type: 'string',
    name: 'stripe_customer_id',
    description: 'Stripe customer ID (cus_xxx) for this tenant',
  })
  stripeCustomerId?: string;

  @property({
    type: 'string',
    required: true,
    description: 'Type of payment method',
    jsonSchema: {
      enum: Object.values(PaymentMethodType),
    },
  })
  type: PaymentMethodType;

  @property({
    type: 'object',
    name: 'card_details',
    description: 'Card details (if type is card)',
  })
  cardDetails?: CardDetails;

  @property({
    type: 'object',
    name: 'bank_account_details',
    description: 'Bank account details (if type is bank_account)',
  })
  bankAccountDetails?: BankAccountDetails;

  @property({
    type: 'boolean',
    name: 'is_default',
    default: false,
    description: 'Whether this is the default payment method for the tenant',
  })
  isDefault: boolean;

  @property({
    type: 'string',
    name: 'billing_name',
    description: 'Name on the payment method',
  })
  billingName?: string;

  @property({
    type: 'string',
    name: 'billing_email',
    description: 'Email associated with the payment method',
  })
  billingEmail?: string;

  @property({
    type: 'object',
    name: 'billing_address',
    description: 'Billing address for the payment method',
  })
  billingAddress?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };

  @property({
    type: 'object',
    description: 'Additional metadata from Stripe',
  })
  metadata?: Record<string, unknown>;

  constructor(data?: Partial<PaymentMethod>) {
    super(data);
  }
}

export interface PaymentMethodRelations {
  tenant?: Tenant;
}

export type PaymentMethodWithRelations = PaymentMethod & PaymentMethodRelations;
