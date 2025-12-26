/**
 * Subscription and Billing types for the customer portal
 * Aligned with subscription-service API contracts
 */

/**
 * Subscription status values
 * Aligned with subscription-service and Stripe statuses
 */
export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'cancelled'
  | 'paused'
  | 'expired'
  | 'pending'
  | 'inactive';

/**
 * Plan tier levels
 */
export type PlanTier = 'free' | 'starter' | 'basic' | 'standard' | 'professional' | 'premium' | 'enterprise';

/**
 * Billing interval
 */
export type BillingInterval = 'month' | 'year';

/**
 * Plan limits for usage tracking
 */
export interface PlanLimits {
  maxBoms: number;
  maxComponentLookups: number;
  maxUsers: number;
  maxApiCalls: number;
  maxStorage?: number; // in MB
}

/**
 * Subscription plan
 */
export interface Plan {
  id: string;
  name: string;
  description?: string;
  tier: PlanTier;
  price: number;
  currency: string;
  interval: BillingInterval;
  features: string[];
  limits: PlanLimits;
  isPopular?: boolean;
  stripePriceId?: string;
}

/**
 * Tenant subscription
 */
export interface Subscription {
  id: string;
  tenantId: string;
  status: SubscriptionStatus;
  planId: string;
  plan?: Plan;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAt?: string;
  canceledAt?: string;
  trialStart?: string;
  trialEnd?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Invoice status from Stripe
 */
export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';

/**
 * Invoice from billing history
 */
export interface Invoice {
  id: string;
  number: string;
  subscriptionId?: string;
  amount: number;
  amountDue: number;
  amountPaid: number;
  currency: string;
  status: InvoiceStatus;
  pdfUrl?: string;
  hostedUrl?: string;
  dueDate?: string;
  paidAt?: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  lines?: InvoiceLineItem[];
}

/**
 * Invoice line item
 */
export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitAmount: number;
  amount: number;
}

/**
 * Usage metrics for current billing period
 */
export interface UsageMetrics {
  // BOM usage
  bomCount: number;
  bomLimit: number;
  bomUsagePercent: number;

  // Component lookup usage
  componentLookups: number;
  componentLookupLimit: number;
  componentLookupUsagePercent: number;

  // API call usage
  apiCalls: number;
  apiCallLimit: number;
  apiCallUsagePercent: number;

  // Team member usage
  usersCount: number;
  usersLimit: number;
  usersUsagePercent: number;

  // Period info
  periodStart: string;
  periodEnd: string;
  daysRemaining: number;
}

/**
 * Portal session response
 */
export interface PortalSessionResponse {
  url: string;
  returnUrl?: string;
}

/**
 * Checkout session response
 */
export interface CheckoutSessionResponse {
  url: string;
  sessionId: string;
}

/**
 * Subscription status display configuration
 */
export const SUBSCRIPTION_STATUS_CONFIG: Record<
  SubscriptionStatus,
  { label: string; color: string; description: string }
> = {
  active: {
    label: 'Active',
    color: 'green',
    description: 'Subscription is active and in good standing',
  },
  trialing: {
    label: 'Trial',
    color: 'blue',
    description: 'Currently in trial period',
  },
  past_due: {
    label: 'Past Due',
    color: 'red',
    description: 'Payment failed - please update payment method',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'gray',
    description: 'Subscription has been cancelled',
  },
  paused: {
    label: 'Paused',
    color: 'yellow',
    description: 'Subscription is temporarily paused',
  },
  expired: {
    label: 'Expired',
    color: 'gray',
    description: 'Subscription has expired',
  },
  pending: {
    label: 'Pending',
    color: 'yellow',
    description: 'Subscription is pending activation',
  },
  inactive: {
    label: 'Inactive',
    color: 'gray',
    description: 'Subscription is not active',
  },
};

/**
 * Plan tier display configuration
 */
export const PLAN_TIER_CONFIG: Record<
  PlanTier,
  { label: string; color: string }
> = {
  free: { label: 'Free', color: 'gray' },
  starter: { label: 'Starter', color: 'blue' },
  basic: { label: 'Basic', color: 'blue' },
  standard: { label: 'Standard', color: 'indigo' },
  professional: { label: 'Professional', color: 'purple' },
  premium: { label: 'Premium', color: 'amber' },
  enterprise: { label: 'Enterprise', color: 'slate' },
};

/**
 * Get status badge color class
 */
export function getSubscriptionStatusColor(status: SubscriptionStatus): string {
  const config = SUBSCRIPTION_STATUS_CONFIG[status];
  switch (config?.color) {
    case 'green':
      return 'bg-green-100 text-green-700';
    case 'blue':
      return 'bg-blue-100 text-blue-700';
    case 'red':
      return 'bg-red-100 text-red-700';
    case 'yellow':
      return 'bg-yellow-100 text-yellow-700';
    case 'gray':
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

/**
 * Get plan tier badge color class
 */
export function getPlanTierColor(tier: PlanTier): string {
  const config = PLAN_TIER_CONFIG[tier];
  switch (config?.color) {
    case 'blue':
      return 'bg-blue-100 text-blue-700';
    case 'indigo':
      return 'bg-indigo-100 text-indigo-700';
    case 'purple':
      return 'bg-purple-100 text-purple-700';
    case 'amber':
      return 'bg-amber-100 text-amber-700';
    case 'slate':
      return 'bg-slate-100 text-slate-700';
    case 'gray':
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

/**
 * Format currency amount
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100); // Stripe amounts are in cents
}

/**
 * Format billing interval
 */
export function formatInterval(interval: BillingInterval): string {
  return interval === 'month' ? 'mo' : 'yr';
}

/**
 * Calculate usage percentage (capped at 100)
 */
export function calculateUsagePercent(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min(Math.round((used / limit) * 100), 100);
}

/**
 * Get usage bar color based on percentage
 */
export function getUsageBarColor(percent: number): string {
  if (percent >= 90) return 'bg-red-500';
  if (percent >= 75) return 'bg-yellow-500';
  return 'bg-blue-500';
}
