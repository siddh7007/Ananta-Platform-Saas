/**
 * Platform Configuration Manifest
 *
 * Centralized configuration for the SaaS platform including:
 * - Platform branding and identity
 * - Subscription plan definitions with feature flags
 * - Plan-based UI feature access
 * - Registration and onboarding settings
 *
 * This manifest enables white-labeling and multi-tenant customization.
 *
 * @see env.schema.ts for environment variable validation
 * @see navigation.ts for role-based navigation
 */

import { z } from 'zod';

// =============================================================================
// Schema Definitions
// =============================================================================

/**
 * Plan tier enum - matches backend Plan enum
 */
export const PlanTierSchema = z.enum([
  'FREE',
  'BASIC',
  'STANDARD',
  'PREMIUM',
  'ENTERPRISE',
]);
export type PlanTier = z.infer<typeof PlanTierSchema>;

/**
 * Feature flag keys - features that can be enabled/disabled per plan
 */
export const FeatureFlagSchema = z.enum([
  'billing',
  'workflows',
  'monitoring',
  'auditLogs',
  'analytics',
  'notifications',
  'customBranding',
  'apiAccess',
  'sso',
  'multiUser',
  'customIntegrations',
  'prioritySupport',
  'dedicatedManager',
  'onPremise',
]);
export type FeatureFlag = z.infer<typeof FeatureFlagSchema>;

/**
 * Plan limits schema
 */
export const PlanLimitsSchema = z.object({
  /** Max users (-1 for unlimited) */
  users: z.number(),
  /** Storage in GB (-1 for unlimited) */
  storage: z.number(),
  /** API calls per month (-1 for unlimited) */
  apiCalls: z.number(),
  /** Max projects/workspaces */
  projects: z.number().optional(),
  /** Max workflows */
  workflows: z.number().optional(),
});
export type PlanLimits = z.infer<typeof PlanLimitsSchema>;

/**
 * Subscription plan schema
 */
export const PlanSchema = z.object({
  /** Unique plan ID (e.g., 'plan-basic') */
  id: z.string(),
  /** Display name */
  name: z.string(),
  /** Plan tier */
  tier: PlanTierSchema,
  /** Marketing description */
  description: z.string(),
  /** Monthly price in dollars */
  price: z.number(),
  /** Billing cycle */
  billingCycle: z.enum(['monthly', 'yearly']),
  /** Feature list for marketing */
  features: z.array(z.string()),
  /** Numeric limits */
  limits: PlanLimitsSchema,
  /** Feature flags enabled for this plan */
  enabledFeatures: z.array(FeatureFlagSchema),
  /** Show "Popular" badge */
  isPopular: z.boolean().optional(),
  /** Custom badge text */
  badge: z.string().optional(),
  /** CTA button text */
  ctaText: z.string().optional(),
});
export type Plan = z.infer<typeof PlanSchema>;

/**
 * Platform branding schema
 */
export const BrandingSchema = z.object({
  /** Platform name */
  name: z.string(),
  /** Short tagline */
  tagline: z.string(),
  /** Full description */
  description: z.string(),
  /** Logo URL */
  logoUrl: z.string().optional(),
  /** Favicon URL */
  faviconUrl: z.string().optional(),
  /** Primary brand color (hex) */
  primaryColor: z.string().optional(),
  /** Support email */
  supportEmail: z.string().email().optional(),
  /** Documentation URL */
  docsUrl: z.string().url().optional(),
  /** Terms of service URL */
  termsUrl: z.string().url().optional(),
  /** Privacy policy URL */
  privacyUrl: z.string().url().optional(),
  /** Company name for legal */
  companyName: z.string().optional(),
  /** Copyright year */
  copyrightYear: z.number().optional(),
});
export type Branding = z.infer<typeof BrandingSchema>;

/**
 * Registration/onboarding settings
 */
export const RegistrationConfigSchema = z.object({
  /** Enable self-service registration */
  enabled: z.boolean(),
  /** Require email verification */
  requireEmailVerification: z.boolean(),
  /** Default plan for new registrations */
  defaultPlanId: z.string(),
  /** Plans available for self-service signup */
  availablePlans: z.array(z.string()),
  /** Require company/org name */
  requireCompanyName: z.boolean(),
  /** Custom fields for registration form */
  customFields: z.array(z.object({
    name: z.string(),
    label: z.string(),
    type: z.enum(['text', 'email', 'tel', 'select', 'checkbox']),
    required: z.boolean(),
    options: z.array(z.string()).optional(),
  })).optional(),
});
export type RegistrationConfig = z.infer<typeof RegistrationConfigSchema>;

/**
 * Full platform configuration schema
 */
export const PlatformConfigSchema = z.object({
  /** Configuration version for migrations */
  version: z.string(),
  /** Platform branding */
  branding: BrandingSchema,
  /** Available subscription plans */
  plans: z.array(PlanSchema),
  /** Registration settings */
  registration: RegistrationConfigSchema,
});
export type PlatformConfig = z.infer<typeof PlatformConfigSchema>;

// =============================================================================
// Default Configuration
// =============================================================================

/**
 * Default subscription plans
 * Synced with backend plan.controller.ts
 */
export const DEFAULT_PLANS: Plan[] = [
  {
    id: 'plan-free',
    name: 'Free',
    tier: 'FREE',
    description: 'Get started for free - perfect for personal projects',
    price: 0,
    billingCycle: 'monthly',
    features: [
      '1 user',
      '1 GB storage',
      'Community support',
      'Basic dashboard',
    ],
    limits: {
      users: 1,
      storage: 1,
      apiCalls: 1000,
      projects: 1,
      workflows: 5,
    },
    enabledFeatures: [],
    ctaText: 'Start Free',
  },
  {
    id: 'plan-basic',
    name: 'Basic',
    tier: 'BASIC',
    description: 'Perfect for small teams getting started',
    price: 29,
    billingCycle: 'monthly',
    features: [
      'Up to 5 users',
      '10 GB storage',
      'Email support',
      'Basic analytics',
      'API access',
    ],
    limits: {
      users: 5,
      storage: 10,
      apiCalls: 10000,
      projects: 5,
      workflows: 25,
    },
    enabledFeatures: ['apiAccess', 'multiUser'],
    ctaText: 'Get Started',
  },
  {
    id: 'plan-standard',
    name: 'Standard',
    tier: 'STANDARD',
    description: 'Best for growing businesses',
    price: 79,
    billingCycle: 'monthly',
    features: [
      'Up to 25 users',
      '100 GB storage',
      'Priority email support',
      'Advanced analytics',
      'API access',
      'Custom integrations',
      'SSO authentication',
    ],
    limits: {
      users: 25,
      storage: 100,
      apiCalls: 100000,
      projects: 25,
      workflows: 100,
    },
    enabledFeatures: [
      'apiAccess',
      'multiUser',
      'analytics',
      'customIntegrations',
      'sso',
      'workflows',
      'monitoring',
      'notifications',
    ],
    isPopular: true,
    badge: 'Most Popular',
    ctaText: 'Start Trial',
  },
  {
    id: 'plan-premium',
    name: 'Premium',
    tier: 'PREMIUM',
    description: 'For enterprises with advanced needs',
    price: 199,
    billingCycle: 'monthly',
    features: [
      'Unlimited users',
      '1 TB storage',
      '24/7 phone & email support',
      'Enterprise analytics',
      'Unlimited API access',
      'Custom integrations',
      'SSO authentication',
      'Dedicated account manager',
      'Custom SLA',
      'On-premise deployment option',
    ],
    limits: {
      users: -1, // unlimited
      storage: 1000,
      apiCalls: -1, // unlimited
      projects: -1,
      workflows: -1,
    },
    enabledFeatures: [
      'billing',
      'workflows',
      'monitoring',
      'auditLogs',
      'analytics',
      'notifications',
      'customBranding',
      'apiAccess',
      'sso',
      'multiUser',
      'customIntegrations',
      'prioritySupport',
      'dedicatedManager',
      'onPremise',
    ],
    badge: 'Enterprise',
    ctaText: 'Contact Sales',
  },
];

/**
 * Default platform branding
 */
export const DEFAULT_BRANDING: Branding = {
  name: 'Ananta SaaS',
  tagline: 'Multi-tenant platform management',
  description: 'A comprehensive SaaS control plane for managing multi-tenant applications with automated provisioning, billing, and monitoring.',
  supportEmail: 'support@ananta-saas.com',
  companyName: 'Ananta Platform',
  copyrightYear: new Date().getFullYear(),
};

/**
 * Default registration configuration
 */
export const DEFAULT_REGISTRATION: RegistrationConfig = {
  enabled: true,
  requireEmailVerification: true,
  defaultPlanId: 'plan-basic',
  availablePlans: ['plan-basic', 'plan-standard', 'plan-premium'],
  requireCompanyName: true,
};

/**
 * Default full platform configuration
 */
export const DEFAULT_PLATFORM_CONFIG: PlatformConfig = {
  version: '1.0.0',
  branding: DEFAULT_BRANDING,
  plans: DEFAULT_PLANS,
  registration: DEFAULT_REGISTRATION,
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get plan by ID
 */
export function getPlanById(planId: string, config = DEFAULT_PLATFORM_CONFIG): Plan | undefined {
  return config.plans.find(p => p.id === planId);
}

/**
 * Get plan by tier
 */
export function getPlanByTier(tier: PlanTier, config = DEFAULT_PLATFORM_CONFIG): Plan | undefined {
  return config.plans.find(p => p.tier === tier);
}

/**
 * Check if a feature is enabled for a plan
 */
export function isPlanFeatureEnabled(
  planId: string,
  feature: FeatureFlag,
  config = DEFAULT_PLATFORM_CONFIG
): boolean {
  const plan = getPlanById(planId, config);
  if (!plan) return false;
  return plan.enabledFeatures.includes(feature);
}

/**
 * Get all features enabled for a plan
 */
export function getPlanFeatures(
  planId: string,
  config = DEFAULT_PLATFORM_CONFIG
): FeatureFlag[] {
  const plan = getPlanById(planId, config);
  return plan?.enabledFeatures ?? [];
}

/**
 * Get plan price map for revenue calculations
 */
export function getPlanPriceMap(config = DEFAULT_PLATFORM_CONFIG): Record<string, number> {
  return config.plans.reduce((acc, plan) => {
    acc[plan.id] = plan.price;
    return acc;
  }, {} as Record<string, number>);
}

/**
 * Get plans available for registration
 */
export function getRegistrationPlans(config = DEFAULT_PLATFORM_CONFIG): Plan[] {
  return config.plans.filter(p => config.registration.availablePlans.includes(p.id));
}

/**
 * Check if user's plan has access to a feature
 * Combines environment feature flags with plan-based access
 */
export function hasFeatureAccess(
  userPlanId: string | undefined,
  feature: FeatureFlag,
  config = DEFAULT_PLATFORM_CONFIG
): boolean {
  // If no plan, deny access to premium features
  if (!userPlanId) {
    return false;
  }

  return isPlanFeatureEnabled(userPlanId, feature, config);
}

/**
 * Get upgrade suggestion for a feature
 */
export function getUpgradePlanForFeature(
  currentPlanId: string,
  feature: FeatureFlag,
  config = DEFAULT_PLATFORM_CONFIG
): Plan | undefined {
  const currentPlan = getPlanById(currentPlanId, config);
  if (!currentPlan) return undefined;

  // Find the cheapest plan that has this feature
  const eligiblePlans = config.plans
    .filter(p => p.price > currentPlan.price && isPlanFeatureEnabled(p.id, feature, config))
    .sort((a, b) => a.price - b.price);

  return eligiblePlans[0];
}

/**
 * Validate and parse platform config
 */
export function validatePlatformConfig(data: unknown): PlatformConfig {
  return PlatformConfigSchema.parse(data);
}

/**
 * Safe validation with error handling
 */
export function safeParsePlatformConfig(data: unknown) {
  return PlatformConfigSchema.safeParse(data);
}

// =============================================================================
// Singleton Instance
// =============================================================================

let cachedConfig: PlatformConfig | null = null;

/**
 * Get platform configuration (with caching)
 * In the future, this could load from API or local storage
 */
export function getPlatformConfig(): PlatformConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  // For now, return default config
  // Future: Load from API, localStorage, or environment
  cachedConfig = DEFAULT_PLATFORM_CONFIG;
  return cachedConfig;
}

/**
 * Clear cached config (for testing or config updates)
 */
export function clearPlatformConfigCache(): void {
  cachedConfig = null;
}

/**
 * Update platform config (for admin UI)
 */
export function setPlatformConfig(config: PlatformConfig): void {
  const validated = validatePlatformConfig(config);
  cachedConfig = validated;
}

// =============================================================================
// Export singleton
// =============================================================================

export const platformConfig = getPlatformConfig();
