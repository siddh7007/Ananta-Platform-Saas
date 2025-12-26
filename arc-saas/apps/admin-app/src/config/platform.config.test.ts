/**
 * Platform Configuration Tests
 *
 * Tests for the centralized platform manifest including:
 * - Schema validation
 * - Plan helpers
 * - Feature flag checks
 * - Configuration parsing
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  // Schema types
  PlanTierSchema,
  FeatureFlagSchema,
  PlanLimitsSchema,
  PlanSchema,
  BrandingSchema,
  RegistrationConfigSchema,
  PlatformConfigSchema,
  // Default values
  DEFAULT_PLANS,
  DEFAULT_BRANDING,
  DEFAULT_REGISTRATION,
  DEFAULT_PLATFORM_CONFIG,
  // Helper functions
  getPlanById,
  getPlanByTier,
  isPlanFeatureEnabled,
  getPlanFeatures,
  getPlanPriceMap,
  getRegistrationPlans,
  hasFeatureAccess,
  getUpgradePlanForFeature,
  validatePlatformConfig,
  safeParsePlatformConfig,
  getPlatformConfig,
  clearPlatformConfigCache,
  setPlatformConfig,
  // Types
  type Plan,
  type PlanTier,
  type FeatureFlag,
} from './platform.config';

describe('PlanTierSchema', () => {
  it('should accept valid plan tiers', () => {
    expect(PlanTierSchema.parse('FREE')).toBe('FREE');
    expect(PlanTierSchema.parse('BASIC')).toBe('BASIC');
    expect(PlanTierSchema.parse('STANDARD')).toBe('STANDARD');
    expect(PlanTierSchema.parse('PREMIUM')).toBe('PREMIUM');
    expect(PlanTierSchema.parse('ENTERPRISE')).toBe('ENTERPRISE');
  });

  it('should reject invalid plan tiers', () => {
    expect(() => PlanTierSchema.parse('INVALID')).toThrow();
    expect(() => PlanTierSchema.parse('basic')).toThrow(); // case sensitive
    expect(() => PlanTierSchema.parse('')).toThrow();
  });
});

describe('FeatureFlagSchema', () => {
  it('should accept valid feature flags', () => {
    expect(FeatureFlagSchema.parse('billing')).toBe('billing');
    expect(FeatureFlagSchema.parse('workflows')).toBe('workflows');
    expect(FeatureFlagSchema.parse('monitoring')).toBe('monitoring');
    expect(FeatureFlagSchema.parse('sso')).toBe('sso');
    expect(FeatureFlagSchema.parse('apiAccess')).toBe('apiAccess');
  });

  it('should reject invalid feature flags', () => {
    expect(() => FeatureFlagSchema.parse('invalid')).toThrow();
    expect(() => FeatureFlagSchema.parse('BILLING')).toThrow(); // case sensitive
  });
});

describe('DEFAULT_PLANS', () => {
  it('should have 4 default plans', () => {
    expect(DEFAULT_PLANS).toHaveLength(4);
  });

  it('should include free, basic, standard, and premium plans', () => {
    const planIds = DEFAULT_PLANS.map(p => p.id);
    expect(planIds).toContain('plan-free');
    expect(planIds).toContain('plan-basic');
    expect(planIds).toContain('plan-standard');
    expect(planIds).toContain('plan-premium');
  });

  it('should have correct prices', () => {
    expect(getPlanById('plan-free')?.price).toBe(0);
    expect(getPlanById('plan-basic')?.price).toBe(29);
    expect(getPlanById('plan-standard')?.price).toBe(79);
    expect(getPlanById('plan-premium')?.price).toBe(199);
  });

  it('should mark standard as popular', () => {
    const standard = getPlanById('plan-standard');
    expect(standard?.isPopular).toBe(true);
  });

  it('should have ascending prices', () => {
    const prices = DEFAULT_PLANS.map(p => p.price);
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
    }
  });

  it('should have valid limits for each plan', () => {
    DEFAULT_PLANS.forEach(plan => {
      expect(plan.limits.users).toBeDefined();
      expect(plan.limits.storage).toBeDefined();
      expect(plan.limits.apiCalls).toBeDefined();
    });
  });
});

describe('DEFAULT_BRANDING', () => {
  it('should have required fields', () => {
    expect(DEFAULT_BRANDING.name).toBe('Ananta SaaS');
    expect(DEFAULT_BRANDING.tagline).toBeTruthy();
    expect(DEFAULT_BRANDING.description).toBeTruthy();
  });

  it('should have current copyright year', () => {
    expect(DEFAULT_BRANDING.copyrightYear).toBe(new Date().getFullYear());
  });
});

describe('DEFAULT_REGISTRATION', () => {
  it('should be enabled by default', () => {
    expect(DEFAULT_REGISTRATION.enabled).toBe(true);
  });

  it('should require email verification', () => {
    expect(DEFAULT_REGISTRATION.requireEmailVerification).toBe(true);
  });

  it('should have plan-basic as default plan', () => {
    expect(DEFAULT_REGISTRATION.defaultPlanId).toBe('plan-basic');
  });

  it('should not include free plan in available plans', () => {
    expect(DEFAULT_REGISTRATION.availablePlans).not.toContain('plan-free');
    expect(DEFAULT_REGISTRATION.availablePlans).toContain('plan-basic');
    expect(DEFAULT_REGISTRATION.availablePlans).toContain('plan-standard');
    expect(DEFAULT_REGISTRATION.availablePlans).toContain('plan-premium');
  });
});

describe('getPlanById', () => {
  it('should return plan for valid ID', () => {
    const plan = getPlanById('plan-basic');
    expect(plan).toBeDefined();
    expect(plan?.name).toBe('Basic');
  });

  it('should return undefined for invalid ID', () => {
    const plan = getPlanById('plan-invalid');
    expect(plan).toBeUndefined();
  });
});

describe('getPlanByTier', () => {
  it('should return plan for valid tier', () => {
    const plan = getPlanByTier('STANDARD');
    expect(plan).toBeDefined();
    expect(plan?.id).toBe('plan-standard');
  });

  it('should return undefined for invalid tier', () => {
    const plan = getPlanByTier('INVALID' as PlanTier);
    expect(plan).toBeUndefined();
  });
});

describe('isPlanFeatureEnabled', () => {
  it('should return true for enabled features', () => {
    // Premium has all features
    expect(isPlanFeatureEnabled('plan-premium', 'billing')).toBe(true);
    expect(isPlanFeatureEnabled('plan-premium', 'sso')).toBe(true);
    expect(isPlanFeatureEnabled('plan-premium', 'monitoring')).toBe(true);
  });

  it('should return false for disabled features', () => {
    // Free has no features
    expect(isPlanFeatureEnabled('plan-free', 'billing')).toBe(false);
    expect(isPlanFeatureEnabled('plan-free', 'sso')).toBe(false);
  });

  it('should return false for invalid plan ID', () => {
    expect(isPlanFeatureEnabled('invalid-plan', 'billing')).toBe(false);
  });

  it('should correctly check standard plan features', () => {
    expect(isPlanFeatureEnabled('plan-standard', 'sso')).toBe(true);
    expect(isPlanFeatureEnabled('plan-standard', 'monitoring')).toBe(true);
    expect(isPlanFeatureEnabled('plan-standard', 'billing')).toBe(false);
    expect(isPlanFeatureEnabled('plan-standard', 'dedicatedManager')).toBe(false);
  });
});

describe('getPlanFeatures', () => {
  it('should return all features for premium plan', () => {
    const features = getPlanFeatures('plan-premium');
    expect(features).toContain('billing');
    expect(features).toContain('sso');
    expect(features).toContain('monitoring');
    expect(features).toContain('dedicatedManager');
  });

  it('should return empty array for free plan', () => {
    const features = getPlanFeatures('plan-free');
    expect(features).toHaveLength(0);
  });

  it('should return empty array for invalid plan', () => {
    const features = getPlanFeatures('invalid-plan');
    expect(features).toHaveLength(0);
  });
});

describe('getPlanPriceMap', () => {
  it('should return price map with all plans', () => {
    const priceMap = getPlanPriceMap();
    expect(priceMap['plan-free']).toBe(0);
    expect(priceMap['plan-basic']).toBe(29);
    expect(priceMap['plan-standard']).toBe(79);
    expect(priceMap['plan-premium']).toBe(199);
  });
});

describe('getRegistrationPlans', () => {
  it('should return only plans available for registration', () => {
    const plans = getRegistrationPlans();
    expect(plans.length).toBe(3);
    expect(plans.map(p => p.id)).not.toContain('plan-free');
  });
});

describe('hasFeatureAccess', () => {
  it('should return false if no plan ID provided', () => {
    expect(hasFeatureAccess(undefined, 'billing')).toBe(false);
  });

  it('should return true for plan with feature', () => {
    expect(hasFeatureAccess('plan-premium', 'billing')).toBe(true);
  });

  it('should return false for plan without feature', () => {
    expect(hasFeatureAccess('plan-basic', 'billing')).toBe(false);
  });
});

describe('getUpgradePlanForFeature', () => {
  it('should suggest standard for basic user wanting sso', () => {
    const upgradePlan = getUpgradePlanForFeature('plan-basic', 'sso');
    expect(upgradePlan).toBeDefined();
    expect(upgradePlan?.id).toBe('plan-standard');
  });

  it('should suggest premium for standard user wanting dedicatedManager', () => {
    const upgradePlan = getUpgradePlanForFeature('plan-standard', 'dedicatedManager');
    expect(upgradePlan).toBeDefined();
    expect(upgradePlan?.id).toBe('plan-premium');
  });

  it('should return undefined if already on highest plan', () => {
    const upgradePlan = getUpgradePlanForFeature('plan-premium', 'billing');
    expect(upgradePlan).toBeUndefined();
  });

  it('should return undefined for invalid plan', () => {
    const upgradePlan = getUpgradePlanForFeature('invalid-plan', 'billing');
    expect(upgradePlan).toBeUndefined();
  });
});

describe('validatePlatformConfig', () => {
  it('should validate default config', () => {
    expect(() => validatePlatformConfig(DEFAULT_PLATFORM_CONFIG)).not.toThrow();
  });

  it('should throw for invalid config', () => {
    expect(() => validatePlatformConfig({})).toThrow();
    expect(() => validatePlatformConfig({ version: '1.0.0' })).toThrow();
  });
});

describe('safeParsePlatformConfig', () => {
  it('should return success for valid config', () => {
    const result = safeParsePlatformConfig(DEFAULT_PLATFORM_CONFIG);
    expect(result.success).toBe(true);
  });

  it('should return error for invalid config', () => {
    const result = safeParsePlatformConfig({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  });
});

describe('getPlatformConfig caching', () => {
  beforeEach(() => {
    clearPlatformConfigCache();
  });

  afterEach(() => {
    clearPlatformConfigCache();
  });

  it('should return default config', () => {
    const config = getPlatformConfig();
    expect(config.version).toBe('1.0.0');
    expect(config.plans.length).toBe(4);
  });

  it('should cache config on subsequent calls', () => {
    const config1 = getPlatformConfig();
    const config2 = getPlatformConfig();
    expect(config1).toBe(config2); // Same reference
  });
});

describe('setPlatformConfig', () => {
  beforeEach(() => {
    clearPlatformConfigCache();
  });

  afterEach(() => {
    clearPlatformConfigCache();
  });

  it('should update cached config', () => {
    const customConfig: typeof DEFAULT_PLATFORM_CONFIG = {
      ...DEFAULT_PLATFORM_CONFIG,
      version: '2.0.0',
      branding: {
        ...DEFAULT_BRANDING,
        name: 'Custom SaaS',
      },
    };

    setPlatformConfig(customConfig);
    const config = getPlatformConfig();

    expect(config.version).toBe('2.0.0');
    expect(config.branding.name).toBe('Custom SaaS');
  });

  it('should throw for invalid config', () => {
    expect(() => setPlatformConfig({} as any)).toThrow();
  });
});

describe('PlanSchema validation', () => {
  it('should validate a valid plan', () => {
    const validPlan = {
      id: 'plan-test',
      name: 'Test Plan',
      tier: 'BASIC',
      description: 'A test plan',
      price: 10,
      billingCycle: 'monthly',
      features: ['Feature 1', 'Feature 2'],
      limits: {
        users: 5,
        storage: 10,
        apiCalls: 1000,
      },
      enabledFeatures: ['apiAccess'],
    };

    expect(() => PlanSchema.parse(validPlan)).not.toThrow();
  });

  it('should reject plan with invalid tier', () => {
    const invalidPlan = {
      id: 'plan-test',
      name: 'Test Plan',
      tier: 'INVALID_TIER',
      description: 'A test plan',
      price: 10,
      billingCycle: 'monthly',
      features: [],
      limits: { users: 1, storage: 1, apiCalls: 100 },
      enabledFeatures: [],
    };

    expect(() => PlanSchema.parse(invalidPlan)).toThrow();
  });

  it('should reject plan with invalid feature flag', () => {
    const invalidPlan = {
      id: 'plan-test',
      name: 'Test Plan',
      tier: 'BASIC',
      description: 'A test plan',
      price: 10,
      billingCycle: 'monthly',
      features: [],
      limits: { users: 1, storage: 1, apiCalls: 100 },
      enabledFeatures: ['invalidFeature'],
    };

    expect(() => PlanSchema.parse(invalidPlan)).toThrow();
  });
});

describe('Plan feature hierarchy', () => {
  it('should have more features in higher tier plans', () => {
    const freeFeatures = getPlanFeatures('plan-free');
    const basicFeatures = getPlanFeatures('plan-basic');
    const standardFeatures = getPlanFeatures('plan-standard');
    const premiumFeatures = getPlanFeatures('plan-premium');

    expect(basicFeatures.length).toBeGreaterThanOrEqual(freeFeatures.length);
    expect(standardFeatures.length).toBeGreaterThanOrEqual(basicFeatures.length);
    expect(premiumFeatures.length).toBeGreaterThanOrEqual(standardFeatures.length);
  });

  it('premium should have all features', () => {
    const premiumFeatures = getPlanFeatures('plan-premium');
    const allFeatures: FeatureFlag[] = [
      'billing',
      'workflows',
      'monitoring',
      'auditLogs',
      'analytics',
      'customBranding',
      'apiAccess',
      'sso',
      'multiUser',
      'customIntegrations',
      'prioritySupport',
      'dedicatedManager',
      'onPremise',
    ];

    allFeatures.forEach(feature => {
      expect(premiumFeatures).toContain(feature);
    });
  });
});
