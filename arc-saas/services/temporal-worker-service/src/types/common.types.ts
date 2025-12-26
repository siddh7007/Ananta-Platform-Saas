/**
 * Common types shared across workflows and activities
 */

export type TenantTier = 'silo' | 'pooled' | 'bridge';

/**
 * Plan tiers for billing (different from infrastructure TenantTier)
 *
 * Mapping from billing tiers to infrastructure:
 * - FREE, BASIC, STANDARD, PREMIUM → pooled (shared Supabase with RLS)
 * - ENTERPRISE → silo (dedicated infrastructure)
 *
 * Note: Only ENTERPRISE gets dedicated infrastructure (silo).
 * All other tiers (including Premium at $199/mo) use the pooled model.
 */
export type PlanTier = 'FREE' | 'BASIC' | 'STANDARD' | 'PREMIUM' | 'ENTERPRISE';

/**
 * Maps billing plan tier to infrastructure deployment tier
 * - FREE, BASIC, STANDARD, PREMIUM → pooled (shared Supabase with RLS)
 * - ENTERPRISE → silo (dedicated infrastructure)
 */
export function planTierToInfraTier(planTier: PlanTier): TenantTier {
  switch (planTier) {
    case 'ENTERPRISE':
      return 'silo';
    case 'FREE':
    case 'BASIC':
    case 'STANDARD':
    case 'PREMIUM':
    default:
      return 'pooled';
  }
}

export type TenantStatus =
  | 'ACTIVE'
  | 'PENDING_PROVISION'
  | 'PROVISIONING'
  | 'PROVISION_FAILED'
  | 'DEPROVISIONING'
  | 'DEPROVISIONED'
  | 'INACTIVE';

export type IdPProvider = 'auth0' | 'keycloak';

export type InfrastructureProvider = 'terraform' | 'aws-cdk' | 'pulumi';

export interface Contact {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  isPrimary?: boolean;
}

export interface Address {
  id?: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

export interface ResourceData {
  type: ResourceType;
  externalIdentifier: string;
  metadata: Record<string, unknown>;
}

export type ResourceType =
  | 'bucket'
  | 'database'
  | 'container'
  | 'dns_record'
  | 'load_balancer'
  | 'vpc'
  | 'subnet'
  | 'security_group'
  | 'iam_role'
  | 'secret'
  | 'certificate';

export interface PlanFeature {
  name: string;
  value: string | number | boolean;
}

export interface Subscription {
  id: string;
  subscriberId: string;
  planId: string;
  tier: TenantTier;
  startDate: string;
  endDate: string;
  status: number;
  features?: PlanFeature[];
}

export interface TenantConfig {
  customDomain?: string;
  theme?: Record<string, string>;
  features?: Record<string, boolean>;
  limits?: Record<string, number>;
}

/**
 * Notification types - aligned with tenant-management-service
 * @see services/tenant-management-service/src/enums/notification-type.enum.ts
 */
export enum NotificationType {
  ValidateLead = 'validate_lead',
  WelcomeTenant = 'tenant_welcome',
  ProvisioningFailed = 'provisioning_failed',
  Deprovisioning = 'deprovisioning',
  InApp = 'in_app',
}
