import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Integration Tests for Billing & Subscription Flow
 * Tests Stripe portal redirects, checkout flow, and org deletion
 */

// Mock axios with all required exports
vi.mock('@/lib/axios', () => ({
  platformApi: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  // Mock circuit breaker functions - always return false (circuit closed)
  isServiceCircuitOpen: vi.fn(() => false),
  CIRCUIT_KEYS: {
    PLATFORM: 'platform',
    CNS: 'cns',
  },
  // Mock resilientPost to just use regular post
  resilientPost: vi.fn(async (api, url, data) => api.post(url, data)),
}));

// Store original window.location
const originalLocation = window.location;

// Track href and search assignments for redirect tests
let currentHref = 'http://localhost:27555/billing';
let currentSearch = '';

beforeEach(() => {
  vi.clearAllMocks();

  // Reset href tracking
  currentHref = 'http://localhost:27555/billing';
  currentSearch = '';

  // Delete the original location property first
  // @ts-expect-error - delete location for mocking
  delete window.location;

  // Create a mock location object with proper getters/setters
  Object.defineProperty(window, 'location', {
    value: {
      get href() {
        return currentHref;
      },
      set href(value: string) {
        currentHref = value;
      },
      get search() {
        return currentSearch;
      },
      set search(value: string) {
        currentSearch = value;
      },
      origin: 'http://localhost:27555',
      pathname: '/billing',
      protocol: 'http:',
      host: 'localhost:27555',
      hostname: 'localhost',
      port: '27555',
      hash: '',
      assign: vi.fn((url: string) => {
        currentHref = url;
      }),
      replace: vi.fn((url: string) => {
        currentHref = url;
      }),
      reload: vi.fn(),
      ancestorOrigins: {} as DOMStringList,
      toString: () => currentHref,
    },
    writable: true,
    configurable: true,
  });

  // Mock history.replaceState
  vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
});

afterEach(() => {
  Object.defineProperty(window, 'location', {
    value: originalLocation,
    writable: true,
    configurable: true,
  });
});

describe('Billing Portal Session', () => {
  it('should call correct endpoint for portal session', async () => {
    const { platformApi } = await import('@/lib/axios');
    vi.mocked(platformApi.post).mockResolvedValue({
      data: { url: 'https://billing.stripe.com/session/xxx' },
    });

    const { createBillingPortalSession } = await import('@/services/billing.service');
    const result = await createBillingPortalSession();

    expect(platformApi.post).toHaveBeenCalledWith('/billing/portal-session', {
      returnUrl: 'http://localhost:27555/billing',
    });
    expect(result.url).toBe('https://billing.stripe.com/session/xxx');
  });

  it('should redirect to Stripe portal on openBillingPortal', async () => {
    const { platformApi } = await import('@/lib/axios');
    vi.mocked(platformApi.post).mockResolvedValue({
      data: { url: 'https://billing.stripe.com/session/xxx' },
    });

    const { openBillingPortal } = await import('@/services/billing.service');
    const result = await openBillingPortal();

    expect(result).toEqual({
      success: true,
      url: 'https://billing.stripe.com/session/xxx',
    });
  });
});

describe('Checkout Session', () => {
  it('should create checkout session with correct URLs', async () => {
    const { platformApi } = await import('@/lib/axios');
    vi.mocked(platformApi.post).mockResolvedValue({
      data: { url: 'https://checkout.stripe.com/xxx', sessionId: 'cs_xxx' },
    });

    const { createCheckoutSession } = await import('@/services/billing.service');
    const result = await createCheckoutSession('plan-premium', 'http://localhost:27555/billing');

    expect(platformApi.post).toHaveBeenCalledWith('/billing/checkout-session', {
      planId: 'plan-premium',
      successUrl: 'http://localhost:27555/billing?session_id={CHECKOUT_SESSION_ID}&status=success',
      cancelUrl: 'http://localhost:27555/billing?status=cancelled',
    });
    expect(result.url).toBe('https://checkout.stripe.com/xxx');
    expect(result.sessionId).toBe('cs_xxx');
  });

  it('should redirect to checkout on openPlanCheckout', async () => {
    const { platformApi } = await import('@/lib/axios');
    vi.mocked(platformApi.post).mockResolvedValue({
      data: { url: 'https://checkout.stripe.com/xxx', sessionId: 'cs_xxx' },
    });

    const { openPlanCheckout } = await import('@/services/billing.service');
    const result = await openPlanCheckout('plan-premium');

    expect(result).toEqual({
      success: true,
      url: 'https://checkout.stripe.com/xxx',
    });
  });
});

describe('Stripe Return Status Handling', () => {
  it('should detect success status from URL', async () => {
    // Update the tracked search value
    currentSearch = '?status=success&session_id=cs_xxx';

    const { checkStripeReturnStatus } = await import('@/services/billing.service');
    const status = checkStripeReturnStatus();

    expect(status).toBe('success');
  });

  it('should detect cancelled status from URL', async () => {
    // Update the tracked search value
    currentSearch = '?status=cancelled';

    const { checkStripeReturnStatus } = await import('@/services/billing.service');
    const status = checkStripeReturnStatus();

    expect(status).toBe('cancelled');
  });

  it('should return null when no status in URL', async () => {
    // currentSearch is already '' from beforeEach

    const { checkStripeReturnStatus } = await import('@/services/billing.service');
    const status = checkStripeReturnStatus();

    expect(status).toBeNull();
  });

  it('should return null for invalid status', async () => {
    // Update the tracked search value
    currentSearch = '?status=invalid';

    const { checkStripeReturnStatus } = await import('@/services/billing.service');
    const status = checkStripeReturnStatus();

    expect(status).toBeNull();
  });
});

describe('Subscription API Contracts', () => {
  it('should call /subscriptions/current for getCurrentSubscription', async () => {
    const { platformApi } = await import('@/lib/axios');
    const mockSubscription = {
      id: 'sub-123',
      status: 'active',
      planId: 'plan-basic',
      currentPeriodStart: '2025-01-01',
      currentPeriodEnd: '2025-02-01',
    };
    vi.mocked(platformApi.get).mockResolvedValue({ data: mockSubscription });

    const { getCurrentSubscription } = await import('@/services/billing.service');
    const result = await getCurrentSubscription();

    expect(platformApi.get).toHaveBeenCalledWith('/subscriptions/current');
    expect(result).toEqual(mockSubscription);
  });

  it('should return null when subscription not found (404)', async () => {
    const { platformApi } = await import('@/lib/axios');
    vi.mocked(platformApi.get).mockRejectedValue({ response: { status: 404 } });

    const { getCurrentSubscription } = await import('@/services/billing.service');
    const result = await getCurrentSubscription();

    expect(result).toBeNull();
  });

  it('should call /subscriptions/cancel for cancelSubscription', async () => {
    const { platformApi } = await import('@/lib/axios');
    vi.mocked(platformApi.post).mockResolvedValue({ data: { status: 'cancelled' } });

    const { cancelSubscription } = await import('@/services/billing.service');
    await cancelSubscription();

    expect(platformApi.post).toHaveBeenCalledWith('/subscriptions/cancel');
  });

  it('should call /subscriptions/resume for resumeSubscription', async () => {
    const { platformApi } = await import('@/lib/axios');
    vi.mocked(platformApi.post).mockResolvedValue({ data: { status: 'active' } });

    const { resumeSubscription } = await import('@/services/billing.service');
    await resumeSubscription();

    expect(platformApi.post).toHaveBeenCalledWith('/subscriptions/resume');
  });

  it('should call /subscriptions/change-plan for requestPlanChange', async () => {
    const { platformApi } = await import('@/lib/axios');
    vi.mocked(platformApi.post).mockResolvedValue({
      data: { requestId: 'req-123', status: 'pending' },
    });

    const { requestPlanChange } = await import('@/services/billing.service');
    const result = await requestPlanChange('plan-premium');

    expect(platformApi.post).toHaveBeenCalledWith('/subscriptions/change-plan', {
      planId: 'plan-premium',
    });
    expect(result.requestId).toBe('req-123');
    expect(result.status).toBe('pending');
  });
});

describe('Invoice API Contracts', () => {
  it('should call /invoices with pagination params', async () => {
    const { platformApi } = await import('@/lib/axios');
    vi.mocked(platformApi.get).mockResolvedValue({
      data: { data: [], total: 0 },
    });

    const { getInvoices } = await import('@/services/billing.service');
    await getInvoices({ page: 2, limit: 10, status: 'paid' });

    expect(platformApi.get).toHaveBeenCalledWith('/invoices', {
      params: { page: 2, limit: 10, status: 'paid' },
    });
  });

  it('should use default pagination when no params', async () => {
    const { platformApi } = await import('@/lib/axios');
    vi.mocked(platformApi.get).mockResolvedValue({
      data: { data: [], total: 0 },
    });

    const { getInvoices } = await import('@/services/billing.service');
    await getInvoices();

    expect(platformApi.get).toHaveBeenCalledWith('/invoices', {
      params: { page: 1, limit: 20, status: undefined },
    });
  });
});

describe('Usage Metrics API', () => {
  it('should call /billing/usage for getUsageSummary', async () => {
    const { platformApi } = await import('@/lib/axios');
    const mockUsage = {
      tenantId: 'tenant-123',
      period: { start: '2025-01-01', end: '2025-02-01' },
      usage: {
        boms: { used: 5, limit: 10 },
        components: { used: 100, limit: 1000 },
        users: { used: 3, limit: 5 },
        apiCalls: { used: 500, limit: 10000 },
      },
    };
    vi.mocked(platformApi.get).mockResolvedValue({ data: mockUsage });

    const { getUsageSummary } = await import('@/services/billing.service');
    const result = await getUsageSummary();

    expect(platformApi.get).toHaveBeenCalledWith('/billing/usage');
    expect(result).toEqual(mockUsage);
  });

  it('should calculate usage metrics with percentages', async () => {
    const { platformApi } = await import('@/lib/axios');
    const mockUsage = {
      tenantId: 'tenant-123',
      period: {
        start: '2025-01-01',
        end: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days from now
      },
      usage: {
        boms: { used: 5, limit: 10 },
        components: { used: 100, limit: 1000 },
        users: { used: 3, limit: 5 },
        apiCalls: { used: 500, limit: 10000 },
      },
    };
    vi.mocked(platformApi.get).mockResolvedValue({ data: mockUsage });

    const { getUsageMetrics } = await import('@/services/billing.service');
    const result = await getUsageMetrics();

    expect(result.bomCount).toBe(5);
    expect(result.bomLimit).toBe(10);
    expect(result.bomUsagePercent).toBe(50);
    expect(result.usersCount).toBe(3);
    expect(result.usersLimit).toBe(5);
    expect(result.usersUsagePercent).toBe(60);
    expect(result.daysRemaining).toBeGreaterThan(0);
  });

  it('should call /billing/analytics for getBillingAnalytics', async () => {
    const { platformApi } = await import('@/lib/axios');
    vi.mocked(platformApi.get).mockResolvedValue({
      data: { currentMrr: 7900, projectedMrr: 9900, usageTrend: [] },
    });

    const { getBillingAnalytics } = await import('@/services/billing.service');
    const result = await getBillingAnalytics();

    expect(platformApi.get).toHaveBeenCalledWith('/billing/analytics');
    expect(result.currentMrr).toBe(7900);
  });
});

describe('Plan API Contracts', () => {
  it('should call /plans for getPlans', async () => {
    const { platformApi } = await import('@/lib/axios');
    const mockPlans = [
      { id: 'plan-basic', name: 'Basic', price: 2900 },
      { id: 'plan-standard', name: 'Standard', price: 7900 },
    ];
    vi.mocked(platformApi.get).mockResolvedValue({ data: { data: mockPlans } });

    const { getPlans } = await import('@/services/billing.service');
    const result = await getPlans();

    expect(platformApi.get).toHaveBeenCalledWith('/plans');
    expect(result).toHaveLength(2);
  });

  it('should call /plans/:id for getPlan', async () => {
    const { platformApi } = await import('@/lib/axios');
    vi.mocked(platformApi.get).mockResolvedValue({
      data: { id: 'plan-premium', name: 'Premium' },
    });

    const { getPlan } = await import('@/services/billing.service');
    const result = await getPlan('plan-premium');

    expect(platformApi.get).toHaveBeenCalledWith('/plans/plan-premium');
    expect(result.id).toBe('plan-premium');
  });
});

describe('Organization Delete Flow', () => {
  it('should call correct endpoint for deleteOrganization', async () => {
    const { platformApi } = await import('@/lib/axios');
    vi.mocked(platformApi.delete).mockResolvedValue({ data: {} });

    const { deleteOrganization } = await import('@/services/organization.service');
    await deleteOrganization('Test Org');

    expect(platformApi.delete).toHaveBeenCalledWith('/tenants/current', {
      data: { confirmation: 'Test Org' },
    });
  });

  it('should call correct endpoint for getOrganization', async () => {
    const { platformApi } = await import('@/lib/axios');
    vi.mocked(platformApi.get).mockResolvedValue({
      data: { id: 'tenant-123', name: 'Test Org' },
    });

    const { getOrganization } = await import('@/services/organization.service');
    const result = await getOrganization();

    expect(platformApi.get).toHaveBeenCalledWith('/tenants/current');
    expect(result.name).toBe('Test Org');
  });

  it('should call correct endpoint for updateOrganization', async () => {
    const { platformApi } = await import('@/lib/axios');
    vi.mocked(platformApi.patch).mockResolvedValue({
      data: { id: 'tenant-123', name: 'Updated Org' },
    });

    const { updateOrganization } = await import('@/services/organization.service');
    const result = await updateOrganization({ name: 'Updated Org' });

    expect(platformApi.patch).toHaveBeenCalledWith('/tenants/current', {
      name: 'Updated Org',
    });
    expect(result.name).toBe('Updated Org');
  });
});

describe('Subscription Types', () => {
  describe('calculateUsagePercent', () => {
    it('should calculate percentage correctly', async () => {
      const { calculateUsagePercent } = await import('@/types/subscription');

      expect(calculateUsagePercent(50, 100)).toBe(50);
      expect(calculateUsagePercent(75, 100)).toBe(75);
      expect(calculateUsagePercent(33, 100)).toBe(33);
    });

    it('should cap at 100%', async () => {
      const { calculateUsagePercent } = await import('@/types/subscription');

      expect(calculateUsagePercent(150, 100)).toBe(100);
      expect(calculateUsagePercent(200, 100)).toBe(100);
    });

    it('should return 0 for zero limit', async () => {
      const { calculateUsagePercent } = await import('@/types/subscription');

      expect(calculateUsagePercent(50, 0)).toBe(0);
      expect(calculateUsagePercent(0, 0)).toBe(0);
    });
  });

  describe('getUsageBarColor', () => {
    it('should return red for 90%+', async () => {
      const { getUsageBarColor } = await import('@/types/subscription');

      expect(getUsageBarColor(90)).toContain('red');
      expect(getUsageBarColor(95)).toContain('red');
      expect(getUsageBarColor(100)).toContain('red');
    });

    it('should return yellow for 75-89%', async () => {
      const { getUsageBarColor } = await import('@/types/subscription');

      expect(getUsageBarColor(75)).toContain('yellow');
      expect(getUsageBarColor(85)).toContain('yellow');
      expect(getUsageBarColor(89)).toContain('yellow');
    });

    it('should return blue for < 75%', async () => {
      const { getUsageBarColor } = await import('@/types/subscription');

      expect(getUsageBarColor(0)).toContain('blue');
      expect(getUsageBarColor(50)).toContain('blue');
      expect(getUsageBarColor(74)).toContain('blue');
    });
  });

  describe('formatCurrency', () => {
    it('should format USD amounts correctly', async () => {
      const { formatCurrency } = await import('@/types/subscription');

      expect(formatCurrency(2900)).toBe('$29.00');
      expect(formatCurrency(7900)).toBe('$79.00');
      expect(formatCurrency(19900)).toBe('$199.00');
    });

    it('should handle different currencies', async () => {
      const { formatCurrency } = await import('@/types/subscription');

      expect(formatCurrency(2900, 'EUR')).toMatch(/29/);
      expect(formatCurrency(2900, 'GBP')).toMatch(/29/);
    });
  });

  describe('getSubscriptionStatusColor', () => {
    it('should return green for active', async () => {
      const { getSubscriptionStatusColor } = await import('@/types/subscription');

      expect(getSubscriptionStatusColor('active')).toContain('green');
    });

    it('should return blue for trialing', async () => {
      const { getSubscriptionStatusColor } = await import('@/types/subscription');

      expect(getSubscriptionStatusColor('trialing')).toContain('blue');
    });

    it('should return red for past_due', async () => {
      const { getSubscriptionStatusColor } = await import('@/types/subscription');

      expect(getSubscriptionStatusColor('past_due')).toContain('red');
    });

    it('should return yellow for pending/paused', async () => {
      const { getSubscriptionStatusColor } = await import('@/types/subscription');

      expect(getSubscriptionStatusColor('pending')).toContain('yellow');
      expect(getSubscriptionStatusColor('paused')).toContain('yellow');
    });

    it('should return gray for cancelled/expired/inactive', async () => {
      const { getSubscriptionStatusColor } = await import('@/types/subscription');

      expect(getSubscriptionStatusColor('cancelled')).toContain('gray');
      expect(getSubscriptionStatusColor('expired')).toContain('gray');
      expect(getSubscriptionStatusColor('inactive')).toContain('gray');
    });
  });
});

describe('Plan Configuration', () => {
  it('should define all subscription statuses', async () => {
    const { SUBSCRIPTION_STATUS_CONFIG } = await import('@/types/subscription');

    const statuses = [
      'active',
      'trialing',
      'past_due',
      'cancelled',
      'paused',
      'expired',
      'pending',
      'inactive',
    ];

    statuses.forEach((status) => {
      expect(SUBSCRIPTION_STATUS_CONFIG[status as keyof typeof SUBSCRIPTION_STATUS_CONFIG]).toBeDefined();
    });
  });

  it('should define all plan tiers', async () => {
    const { PLAN_TIER_CONFIG } = await import('@/types/subscription');

    const tiers = ['free', 'starter', 'basic', 'standard', 'professional', 'premium', 'enterprise'];

    tiers.forEach((tier) => {
      expect(PLAN_TIER_CONFIG[tier as keyof typeof PLAN_TIER_CONFIG]).toBeDefined();
    });
  });
});
