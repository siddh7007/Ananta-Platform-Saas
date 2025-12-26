import { platformApi, resilientPost, CIRCUIT_KEYS, isServiceCircuitOpen } from '@/lib/axios';
import type {
  Subscription,
  Plan,
  Invoice,
  UsageMetrics,
  PortalSessionResponse as BillingPortalSession,
  CheckoutSessionResponse,
} from '@/types/subscription';
import { calculateUsagePercent } from '@/types/subscription';
import type {
  UsageStatus,
  TenantQuota,
  UsageTrend,
  UsageAnalytics,
  UsageSummary as UsageSummaryType,
  UsageEvent,
  QuotaCheckResult,
  UsageMetricType,
} from '@/types/usage';

/**
 * Stripe Portal Error Types
 */
export class StripePortalError extends Error {
  code: StripePortalErrorCode;
  retryable: boolean;

  constructor(message: string, code: StripePortalErrorCode, retryable = false) {
    super(message);
    this.name = 'StripePortalError';
    this.code = code;
    this.retryable = retryable;
  }
}

export type StripePortalErrorCode =
  | 'CIRCUIT_OPEN'
  | 'NETWORK_ERROR'
  | 'STRIPE_ERROR'
  | 'CONFIG_ERROR'
  | 'UNAUTHORIZED';

// Re-export types for convenience
export type { Subscription, Plan, Invoice, UsageMetrics } from '@/types/subscription';

/**
 * Billing service
 * Handles subscription, billing, and usage operations
 * Owner-actionable: Portal redirects for billing/plan management
 * All other roles: Read-only access to subscription/usage data
 */

/**
 * Usage summary (legacy format, mapped to UsageMetrics)
 */
export interface UsageSummary {
  tenantId: string;
  period: {
    start: string;
    end: string;
  };
  usage: {
    boms: { used: number; limit: number };
    components: { used: number; limit: number };
    users: { used: number; limit: number };
    apiCalls: { used: number; limit: number };
  };
}

/**
 * Pagination params
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
}

/**
 * Invoice filter params
 */
export interface InvoiceFilterParams extends PaginationParams {
  status?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Get current subscription for tenant
 */
export async function getCurrentSubscription(): Promise<Subscription | null> {
  try {
    const response = await platformApi.get('/subscriptions/current');
    return response.data;
  } catch (error: unknown) {
    if ((error as { response?: { status?: number } })?.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Transform API plan response to UI Plan type
 */
function transformPlan(apiPlan: Record<string, unknown>): Plan {
  const limits = apiPlan.limits as Record<string, unknown> | undefined;
  return {
    id: apiPlan.id as string,
    name: apiPlan.name as string,
    description: apiPlan.description as string | undefined,
    tier: ((apiPlan.tier as string) || 'basic').toLowerCase() as Plan['tier'],
    price: parseFloat(String(apiPlan.price || 0)),
    currency: 'USD', // Default currency
    interval: ((apiPlan.billingCycle as string) || 'month') as Plan['interval'],
    features: (apiPlan.features as string[]) || [],
    limits: {
      maxBoms: (limits?.maxProjects as number) ?? 10,
      maxComponentLookups: (limits?.maxApiCalls as number) ?? 1000,
      maxUsers: (limits?.maxUsers as number) ?? 5,
      maxApiCalls: (limits?.maxApiCalls as number) ?? 10000,
      maxStorage: (limits?.maxStorage as number) ?? 1024,
    },
    isPopular: apiPlan.isPopular as boolean | undefined,
    stripePriceId: apiPlan.stripePriceId as string | undefined,
  };
}

/**
 * Get all available plans
 */
export async function getPlans(): Promise<Plan[]> {
  const response = await platformApi.get('/plans');
  const rawPlans = response.data.data ?? response.data;
  return (rawPlans as Record<string, unknown>[]).map(transformPlan);
}

/**
 * Get a specific plan by ID
 */
export async function getPlan(planId: string): Promise<Plan> {
  const response = await platformApi.get(`/plans/${planId}`);
  return response.data;
}

/**
 * Get invoices for tenant (paginated)
 */
export async function getInvoices(params?: {
  page?: number;
  limit?: number;
  status?: string;
}): Promise<{ data: Invoice[]; total: number }> {
  const response = await platformApi.get('/invoices', {
    params: {
      page: params?.page ?? 1,
      limit: params?.limit ?? 20,
      status: params?.status,
    },
  });

  return {
    data: response.data.data ?? response.data,
    total: response.data.total ?? response.data.length,
  };
}

/**
 * Get usage summary for current billing period
 */
export async function getUsageSummary(): Promise<UsageSummary> {
  const response = await platformApi.get('/billing/usage');
  return response.data;
}

/**
 * Request access to Stripe billing portal
 * Returns a URL to redirect the user to
 * Includes circuit breaker protection and proper error handling
 */
export async function createBillingPortalSession(): Promise<BillingPortalSession> {
  // Check circuit breaker before making request
  if (isServiceCircuitOpen(CIRCUIT_KEYS.PLATFORM)) {
    throw new StripePortalError(
      'Service temporarily unavailable. Please try again in a few moments.',
      'CIRCUIT_OPEN',
      true
    );
  }

  try {
    const response = await resilientPost<BillingPortalSession>(
      platformApi,
      '/billing/portal-session',
      { returnUrl: window.location.href },
      `${CIRCUIT_KEYS.PLATFORM}:billing-portal`
    );

    if (!response.data?.url) {
      throw new StripePortalError(
        'Invalid response from billing service',
        'CONFIG_ERROR',
        true
      );
    }

    return response.data;
  } catch (error) {
    if (error instanceof StripePortalError) {
      throw error;
    }

    // Handle specific HTTP errors
    const status = (error as { response?: { status?: number } })?.response?.status;

    if (status === 401) {
      throw new StripePortalError(
        'Your session has expired. Please log in again.',
        'UNAUTHORIZED',
        false
      );
    }

    if (status === 403 || status === 404) {
      throw new StripePortalError(
        'No active subscription found. Please contact support.',
        'STRIPE_ERROR',
        false
      );
    }

    // Network or server error
    throw new StripePortalError(
      'Unable to connect to billing service. Please check your connection and try again.',
        'NETWORK_ERROR',
        true
      );
  }
}

/**
 * Request plan change (upgrade/downgrade)
 * This creates a request that goes through platform approval
 */
export async function requestPlanChange(newPlanId: string): Promise<{
  requestId: string;
  status: 'pending' | 'approved' | 'rejected';
  message?: string;
}> {
  const response = await platformApi.post('/subscriptions/change-plan', {
    planId: newPlanId,
  });
  return response.data;
}

/**
 * Cancel subscription at period end
 * @returns The updated Subscription object with cancelAt date set
 */
export async function cancelSubscription(): Promise<Subscription> {
  const response = await platformApi.post('/subscriptions/cancel');
  return response.data;
}

/**
 * Resume a cancelled subscription (before period end)
 */
export async function resumeSubscription(): Promise<Subscription> {
  const response = await platformApi.post('/subscriptions/resume');
  return response.data;
}

/**
 * Get billing analytics (owner/admin only)
 */
export async function getBillingAnalytics(): Promise<{
  currentMrr: number;
  projectedMrr: number;
  usageTrend: { date: string; value: number }[];
}> {
  const response = await platformApi.get('/billing/analytics');
  return response.data;
}

// ============================================
// Usage Metrics (with calculated percentages)
// ============================================

/**
 * Get usage metrics for current billing period
 * Returns calculated percentages for progress bars
 */
export async function getUsageMetrics(): Promise<UsageMetrics> {
  const summary = await getUsageSummary();

  // Calculate days remaining in period
  const periodEnd = new Date(summary.period.end);
  const now = new Date();
  const daysRemaining = Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  return {
    bomCount: summary.usage.boms.used,
    bomLimit: summary.usage.boms.limit,
    bomUsagePercent: calculateUsagePercent(summary.usage.boms.used, summary.usage.boms.limit),

    componentLookups: summary.usage.components.used,
    componentLookupLimit: summary.usage.components.limit,
    componentLookupUsagePercent: calculateUsagePercent(summary.usage.components.used, summary.usage.components.limit),

    apiCalls: summary.usage.apiCalls.used,
    apiCallLimit: summary.usage.apiCalls.limit,
    apiCallUsagePercent: calculateUsagePercent(summary.usage.apiCalls.used, summary.usage.apiCalls.limit),

    usersCount: summary.usage.users.used,
    usersLimit: summary.usage.users.limit,
    usersUsagePercent: calculateUsagePercent(summary.usage.users.used, summary.usage.users.limit),

    periodStart: summary.period.start,
    periodEnd: summary.period.end,
    daysRemaining,
  };
}

// ============================================
// Stripe Portal Integration (owner only)
// ============================================

/**
 * Create checkout session for plan upgrade/change
 * Redirects to Stripe Checkout
 * Includes circuit breaker protection and proper error handling
 */
export async function createCheckoutSession(
  planId: string,
  returnUrl: string
): Promise<CheckoutSessionResponse> {
  // Check circuit breaker before making request
  if (isServiceCircuitOpen(CIRCUIT_KEYS.PLATFORM)) {
    throw new StripePortalError(
      'Service temporarily unavailable. Please try again in a few moments.',
      'CIRCUIT_OPEN',
      true
    );
  }

  try {
    const response = await resilientPost<CheckoutSessionResponse>(
      platformApi,
      '/billing/checkout-session',
      {
        planId,
        successUrl: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}&status=success`,
        cancelUrl: `${returnUrl}?status=cancelled`,
      },
      `${CIRCUIT_KEYS.PLATFORM}:checkout`
    );

    if (!response.data?.url) {
      throw new StripePortalError(
        'Invalid response from checkout service',
        'CONFIG_ERROR',
        true
      );
    }

    return response.data;
  } catch (error) {
    if (error instanceof StripePortalError) {
      throw error;
    }

    // Handle specific HTTP errors
    const status = (error as { response?: { status?: number } })?.response?.status;

    if (status === 401) {
      throw new StripePortalError(
        'Your session has expired. Please log in again.',
        'UNAUTHORIZED',
        false
      );
    }

    if (status === 404) {
      throw new StripePortalError(
        'The selected plan is no longer available.',
        'STRIPE_ERROR',
        false
      );
    }

    if (status === 403) {
      throw new StripePortalError(
        'You do not have permission to change plans. Please contact your organization owner.',
        'UNAUTHORIZED',
        false
      );
    }

    // Network or server error
    throw new StripePortalError(
      'Unable to create checkout session. Please check your connection and try again.',
      'NETWORK_ERROR',
      true
    );
  }
}

/**
 * Result type for portal operations
 */
export interface PortalResult {
  success: boolean;
  url?: string;
  error?: StripePortalError;
}

/**
 * Open Stripe billing portal in current window
 * For managing payment methods, viewing invoices, cancellation
 * Returns a result object instead of throwing to allow UI handling
 */
export async function openBillingPortal(): Promise<PortalResult> {
  try {
    const { url } = await createBillingPortalSession();
    return { success: true, url };
  } catch (error) {
    if (error instanceof StripePortalError) {
      return { success: false, error };
    }
    return {
      success: false,
      error: new StripePortalError(
        'An unexpected error occurred',
        'NETWORK_ERROR',
        true
      ),
    };
  }
}

/**
 * Open Stripe checkout for plan change
 * Returns a result object instead of throwing to allow UI handling
 */
export async function openPlanCheckout(planId: string): Promise<PortalResult> {
  try {
    const { url } = await createCheckoutSession(planId, window.location.href);
    return { success: true, url };
  } catch (error) {
    if (error instanceof StripePortalError) {
      return { success: false, error };
    }
    return {
      success: false,
      error: new StripePortalError(
        'An unexpected error occurred',
        'NETWORK_ERROR',
        true
      ),
    };
  }
}

/**
 * Check if returning from Stripe with success/cancel status
 */
export function checkStripeReturnStatus(): 'success' | 'cancelled' | null {
  const params = new URLSearchParams(window.location.search);
  const status = params.get('status');
  if (status === 'success' || status === 'cancelled') {
    return status;
  }
  return null;
}

/**
 * Clear Stripe return status from URL
 */
export function clearStripeReturnStatus(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('status');
  url.searchParams.delete('session_id');
  window.history.replaceState({}, '', url.toString());
}

// =====================================
// USAGE ANALYTICS FUNCTIONS
// =====================================

/**
 * Get current usage status for all metrics
 * Shows usage vs quotas with percentage and warnings
 */
export async function getUsageStatus(): Promise<UsageStatus[]> {
  try {
    const response = await platformApi.get('/usage/status');
    return response.data;
  } catch (error: unknown) {
    if ((error as { response?: { status?: number } })?.response?.status === 404) {
      return [];
    }
    throw error;
  }
}

/**
 * Get tenant quotas
 * Returns all configured quotas for the current tenant
 */
export async function getQuotas(): Promise<TenantQuota[]> {
  try {
    const response = await platformApi.get('/usage/quotas');
    return response.data;
  } catch (error: unknown) {
    if ((error as { response?: { status?: number } })?.response?.status === 404) {
      return [];
    }
    throw error;
  }
}

/**
 * Check if a specific quota is exceeded
 */
export async function checkQuotaExceeded(metricType: string): Promise<QuotaCheckResult> {
  try {
    const response = await platformApi.get(`/usage/quotas/${metricType}/check`);
    return response.data;
  } catch (error: unknown) {
    if ((error as { response?: { status?: number } })?.response?.status === 404) {
      return { exceeded: false };
    }
    throw error;
  }
}

/**
 * Get usage trend for a specific metric
 * Shows historical usage over time (default: last 6 months)
 */
export async function getUsageTrend(
  metricType: string,
  months: number = 6
): Promise<UsageTrend[]> {
  try {
    const response = await platformApi.get(`/usage/trends/${metricType}`, {
      params: { months },
    });
    return response.data;
  } catch (error: unknown) {
    if ((error as { response?: { status?: number } })?.response?.status === 404) {
      return [];
    }
    throw error;
  }
}

/**
 * Get usage analytics summary for current billing period
 * Includes overage amounts and costs
 */
export async function getUsageAnalytics(billingPeriod?: string): Promise<UsageAnalytics> {
  try {
    const response = await platformApi.get('/usage/analytics', {
      params: billingPeriod ? { billingPeriod } : undefined,
    });
    return response.data;
  } catch (error: unknown) {
    if ((error as { response?: { status?: number } })?.response?.status === 404) {
      return {
        period: billingPeriod || new Date().toISOString().slice(0, 7),
        metrics: [],
      };
    }
    throw error;
  }
}

/**
 * Get usage summaries by billing period
 * Historical usage summaries for past periods
 */
export async function getUsageSummaries(
  billingPeriod?: string,
  limit: number = 12
): Promise<UsageSummaryType[]> {
  try {
    const response = await platformApi.get('/usage/summaries', {
      params: {
        billingPeriod,
        limit,
      },
    });
    return response.data;
  } catch (error: unknown) {
    if ((error as { response?: { status?: number } })?.response?.status === 404) {
      return [];
    }
    throw error;
  }
}

/**
 * Get usage events
 * Raw usage events for debugging/audit
 */
export async function getUsageEvents(params?: {
  metricType?: string;
  billingPeriod?: string;
  limit?: number;
}): Promise<UsageEvent[]> {
  try {
    const response = await platformApi.get('/usage/events', { params });
    return response.data;
  } catch (error: unknown) {
    if ((error as { response?: { status?: number } })?.response?.status === 404) {
      return [];
    }
    throw error;
  }
}

export default {
  // Subscriptions & Plans
  getCurrentSubscription,
  getPlans,
  getPlan,
  requestPlanChange,
  cancelSubscription,
  resumeSubscription,
  // Invoices
  getInvoices,
  getBillingAnalytics,
  // Legacy Usage (deprecated - use new usage functions)
  getUsageSummary,
  getUsageMetrics,
  // New Usage Analytics
  getUsageStatus,
  getQuotas,
  checkQuotaExceeded,
  getUsageTrend,
  getUsageAnalytics,
  getUsageSummaries,
  getUsageEvents,
  // Stripe Portal
  createBillingPortalSession,
  createCheckoutSession,
  openBillingPortal,
  openPlanCheckout,
  checkStripeReturnStatus,
  clearStripeReturnStatus,
  // Errors
  StripePortalError,
};
