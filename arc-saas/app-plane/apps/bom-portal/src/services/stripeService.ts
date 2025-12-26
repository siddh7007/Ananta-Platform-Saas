/**
 * Stripe Subscription Service
 *
 * Provides methods to interact with the Stripe subscription API.
 * Handles customer creation, subscription management, checkout sessions,
 * and billing portal access.
 *
 * The actual base URL is provided via VITE_CNS_API_URL at build/run time.
 */

import { loadStripe, Stripe } from '@stripe/stripe-js';

// API base URL - uses same CNS API endpoint
const DEFAULT_API_BASE_URL = 'http://localhost:27800';
const API_BASE_URL = import.meta.env.VITE_CNS_API_URL || DEFAULT_API_BASE_URL;

// Stripe publishable key
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';

// Singleton Stripe instance
let stripePromise: Promise<Stripe | null> | null = null;

/**
 * Get or initialize the Stripe.js instance
 */
export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise && STRIPE_PUBLISHABLE_KEY) {
    stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
  }
  return stripePromise || Promise.resolve(null);
}

/**
 * Check if Stripe is configured
 */
export function isStripeConfigured(): boolean {
  return Boolean(STRIPE_PUBLISHABLE_KEY);
}

// ============================================================================
// Type Definitions
// ============================================================================

export type PlanTier = 'free' | 'starter' | 'professional' | 'enterprise';
export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'paused'
  | 'incomplete'
  | 'incomplete_expired';

export interface BillingInfo {
  organization_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: SubscriptionStatus;
  plan_tier: PlanTier;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean;
  billing_email: string | null;
  billing_name: string | null;
}

export interface CreateCustomerRequest {
  organization_id: string;
  email: string;
  name: string;
  metadata?: Record<string, string>;
}

export interface CreateCustomerResponse {
  success: boolean;
  customer_id?: string;
  message?: string;
}

export interface CreateSubscriptionRequest {
  organization_id: string;
  customer_id: string;
  plan_tier: PlanTier;
  trial_days?: number;
}

export interface SubscriptionResponse {
  success: boolean;
  subscription_id?: string;
  client_secret?: string;
  status?: string;
  message?: string;
}

export interface CheckoutSessionResponse {
  success: boolean;
  session_id?: string;
  url?: string;
  message?: string;
}

export interface PortalSessionResponse {
  success: boolean;
  url?: string;
  message?: string;
}

export interface InvoiceInfo {
  id: string;
  number: string | null;
  amount_due: number;
  amount_paid: number;
  currency: string;
  status: string;
  created: string;
  period_start: string | null;
  period_end: string | null;
  invoice_pdf: string | null;
  hosted_invoice_url: string | null;
}

export interface PaymentMethodInfo {
  id: string;
  type: string;
  card_brand: string | null;
  card_last4: string | null;
  card_exp_month: number | null;
  card_exp_year: number | null;
  is_default: boolean;
}

export interface PlanFeatures {
  plan_tier: PlanTier;
  monthly_bom_uploads: number;
  monthly_enrichments: number;
  monthly_api_calls: number;
  max_team_members: number;
  max_projects: number;
  api_access: boolean;
  priority_support: boolean;
  custom_integrations: boolean;
  dedicated_support: boolean;
  sso_enabled: boolean;
  audit_logs: boolean;
  advanced_analytics: boolean;
  display_price_cents: number | null;
  display_price_interval: string;
}

// ============================================================================
// API Error Handling
// ============================================================================

class StripeApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'StripeApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.detail || errorData.message || errorMessage;
    } catch {
      // Use default error message if JSON parsing fails
    }
    throw new StripeApiError(errorMessage, response.status);
  }
  return response.json();
}

// ============================================================================
// Stripe API Service Class
// ============================================================================

class StripeApiService {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Get headers including auth token from localStorage
   */
  private getHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add auth token if available (check Auth0, Supabase, and legacy keys)
    const token = localStorage.getItem('auth0_access_token')
      || localStorage.getItem('supabase_access_token')
      || localStorage.getItem('access_token');
    console.log('[StripeService] Token sources:', {
      auth0: !!localStorage.getItem('auth0_access_token'),
      supabase: !!localStorage.getItem('supabase_access_token'),
      legacy: !!localStorage.getItem('access_token'),
      hasToken: !!token,
    });
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Add organization ID header (required by CNS billing API)
    const organizationId = localStorage.getItem('organization_id');
    if (organizationId) {
      headers['X-Organization-ID'] = organizationId;
    }

    return headers;
  }

  // --------------------------------------------------------------------------
  // Health Check
  // --------------------------------------------------------------------------

  async checkHealth(): Promise<{ status: string; provider: string; configured: boolean }> {
    const response = await fetch(`${this.baseUrl}/api/health`, {
      headers: this.getHeaders(),
    });
    return handleResponse(response);
  }

  // --------------------------------------------------------------------------
  // Subscription Management (uses auth context for org_id)
  // --------------------------------------------------------------------------

  async getCurrentSubscription(): Promise<Record<string, unknown> | null> {
    console.log('[StripeService] getCurrentSubscription calling:', `${this.baseUrl}/api/billing/subscription`);
    const response = await fetch(`${this.baseUrl}/api/billing/subscription`, {
      headers: this.getHeaders(),
    });
    console.log('[StripeService] getCurrentSubscription response status:', response.status);
    if (response.status === 204 || response.status === 404) {
      console.log('[StripeService] getCurrentSubscription - no subscription found');
      return null;
    }
    const result = await handleResponse<Record<string, unknown>>(response);
    console.log('[StripeService] getCurrentSubscription result:', result);
    return result;
  }

  async updateSubscription(
    _organizationId: string,
    _subscriptionId: string,
    newPlanTier: PlanTier
  ): Promise<SubscriptionResponse> {
    // Note: Backend uses auth context for org/subscription, not explicit IDs
    const response = await fetch(`${this.baseUrl}/api/billing/subscription/update`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        plan_slug: newPlanTier,
      }),
    });
    return handleResponse(response);
  }

  async cancelSubscription(
    _organizationId: string,
    _subscriptionId: string,
    atPeriodEnd: boolean = true
  ): Promise<SubscriptionResponse> {
    // Note: Backend uses auth context for org/subscription
    const response = await fetch(`${this.baseUrl}/api/billing/subscription/cancel`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        cancel_immediately: !atPeriodEnd,
      }),
    });
    return handleResponse(response);
  }

  async reactivateSubscription(_subscriptionId: string): Promise<SubscriptionResponse> {
    const response = await fetch(`${this.baseUrl}/api/billing/subscription/reactivate`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return handleResponse(response);
  }

  // --------------------------------------------------------------------------
  // Checkout & Portal Sessions
  // --------------------------------------------------------------------------

  async createCheckoutSession(
    _organizationId: string,
    _customerId: string,
    planTier: PlanTier
  ): Promise<CheckoutSessionResponse> {
    // Note: Backend uses auth context for org_id
    const response = await fetch(`${this.baseUrl}/api/billing/checkout`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        plan_slug: planTier,
        billing_interval: 'month',
        success_url: `${window.location.origin}/billing?success=true`,
        cancel_url: `${window.location.origin}/billing?canceled=true`,
      }),
    });

    const result = await handleResponse<{ checkout_url: string; session_id: string; provider: string }>(response);
    return {
      success: true,
      session_id: result.session_id,
      url: result.checkout_url,
    };
  }

  async createBillingPortalSession(
    _organizationId: string,
    _customerId: string
  ): Promise<PortalSessionResponse> {
    // Note: Backend uses auth context for org_id
    const response = await fetch(`${this.baseUrl}/api/billing/portal`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        return_url: `${window.location.origin}/billing`,
      }),
    });

    const result = await handleResponse<{ portal_url: string; provider: string }>(response);
    return {
      success: true,
      url: result.portal_url,
    };
  }

  // --------------------------------------------------------------------------
  // Billing Information
  // --------------------------------------------------------------------------

  async getBillingInfo(_organizationId: string): Promise<BillingInfo> {
    console.log('[StripeService] getBillingInfo called for org:', _organizationId);
    // Fetch subscription and usage info from backend
    try {
      const [subscription, usage] = await Promise.all([
        this.getCurrentSubscription(),
        this.getUsage(),
      ]);
      console.log('[StripeService] subscription:', subscription);
      console.log('[StripeService] usage:', usage);

      // Map to BillingInfo structure expected by UI
      const result = {
        organization_id: _organizationId,
        stripe_customer_id: subscription?.customer_id as string | null || null,
        stripe_subscription_id: subscription?.subscription_id as string | null || null,
        subscription_status: (subscription?.status as SubscriptionStatus) || 'trialing',
        plan_tier: ((subscription?.plan as Record<string, unknown>)?.slug as PlanTier) || 'free',
        current_period_start: subscription?.current_period_start as string | null || null,
        current_period_end: subscription?.current_period_end as string | null || null,
        trial_end: subscription?.trial_end as string | null || null,
        cancel_at_period_end: subscription?.cancel_at_period_end as boolean || false,
        billing_email: null,
        billing_name: null,
      };
      console.log('[StripeService] getBillingInfo result:', result);
      return result;
    } catch (err) {
      console.error('[StripeService] getBillingInfo error:', err);
      throw err;
    }
  }

  async getUsage(): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.baseUrl}/api/billing/usage`, {
      headers: this.getHeaders(),
    });
    return handleResponse(response);
  }

  async getInvoices(_customerId: string, limit: number = 10): Promise<InvoiceInfo[]> {
    // Backend uses auth context, not explicit customer ID
    const response = await fetch(
      `${this.baseUrl}/api/billing/invoices?limit=${limit}`,
      { headers: this.getHeaders() }
    );
    return handleResponse(response);
  }

  async getPaymentMethods(_customerId: string): Promise<PaymentMethodInfo[]> {
    // Not implemented in current backend - return empty for now
    console.warn('Payment methods endpoint not yet implemented');
    return [];
  }

  // --------------------------------------------------------------------------
  // Plans
  // --------------------------------------------------------------------------

  async getAvailablePlans(): Promise<PlanFeatures[]> {
    const response = await fetch(`${this.baseUrl}/api/billing/plans`, {
      headers: this.getHeaders(),
    });

    // Map backend response to PlanFeatures format
    const plans = await handleResponse<Array<{
      id: string;
      name: string;
      tier: string;
      slug: string;
      price_monthly: number;
      price_yearly?: number;
      currency: string;
      billing_interval: string;
      trial_days: number;
      limits: Record<string, number>;
      features: string[];
      description?: string;
      is_popular: boolean;
    }>>(response);

    return plans.map(plan => ({
      plan_tier: plan.slug as PlanTier,
      monthly_bom_uploads: plan.limits.max_bom_uploads_per_month || 0,
      monthly_enrichments: plan.limits.max_components_per_bom || 0,
      monthly_api_calls: plan.limits.max_api_calls_per_month || 0,
      max_team_members: plan.limits.max_members || 0,
      max_projects: plan.limits.max_projects || 0,
      api_access: plan.tier !== 'free',
      priority_support: plan.tier === 'professional' || plan.tier === 'enterprise',
      custom_integrations: plan.tier === 'enterprise',
      dedicated_support: plan.tier === 'enterprise',
      sso_enabled: plan.tier === 'enterprise',
      audit_logs: plan.tier !== 'free',
      advanced_analytics: plan.tier === 'professional' || plan.tier === 'enterprise',
      display_price_cents: plan.price_monthly,
      display_price_interval: plan.billing_interval,
    }));
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format cents to currency string
 */
export function formatCurrency(cents: number | null, currency: string = 'usd'): string {
  if (cents === null) {
    return 'Custom';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

/**
 * Format date string
 */
export function formatDate(dateString: string | null): string {
  if (!dateString) {
    return 'N/A';
  }
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Get plan display name
 */
export function getPlanDisplayName(tier: PlanTier): string {
  const names: Record<PlanTier, string> = {
    free: 'Free',
    starter: 'Starter',
    professional: 'Professional',
    enterprise: 'Enterprise',
  };
  return names[tier] || tier;
}

/**
 * Get subscription status color for MUI
 */
export function getStatusColor(
  status: SubscriptionStatus
): 'success' | 'warning' | 'error' | 'default' | 'info' {
  const colors: Record<SubscriptionStatus, 'success' | 'warning' | 'error' | 'default' | 'info'> = {
    active: 'success',
    trialing: 'info',
    past_due: 'warning',
    canceled: 'error',
    unpaid: 'error',
    paused: 'warning',
    incomplete: 'warning',
    incomplete_expired: 'error',
  };
  return colors[status] || 'default';
}

/**
 * Get subscription status display text
 */
export function getStatusDisplayText(status: SubscriptionStatus): string {
  const texts: Record<SubscriptionStatus, string> = {
    active: 'Active',
    trialing: 'Trial',
    past_due: 'Past Due',
    canceled: 'Canceled',
    unpaid: 'Unpaid',
    paused: 'Paused',
    incomplete: 'Incomplete',
    incomplete_expired: 'Expired',
  };
  return texts[status] || status;
}

/**
 * Check if plan upgrade is available
 */
export function canUpgrade(currentTier: PlanTier, targetTier: PlanTier): boolean {
  const tierOrder: PlanTier[] = ['free', 'starter', 'professional', 'enterprise'];
  const currentIndex = tierOrder.indexOf(currentTier);
  const targetIndex = tierOrder.indexOf(targetTier);
  return targetIndex > currentIndex;
}

/**
 * Check if plan downgrade is available
 */
export function canDowngrade(currentTier: PlanTier, targetTier: PlanTier): boolean {
  const tierOrder: PlanTier[] = ['free', 'starter', 'professional', 'enterprise'];
  const currentIndex = tierOrder.indexOf(currentTier);
  const targetIndex = tierOrder.indexOf(targetTier);
  return targetIndex < currentIndex && targetIndex >= 0;
}

// ============================================================================
// Exports
// ============================================================================

// Create singleton instance
export const stripeApiService = new StripeApiService(API_BASE_URL);

// Re-export types
export { StripeApiError };
