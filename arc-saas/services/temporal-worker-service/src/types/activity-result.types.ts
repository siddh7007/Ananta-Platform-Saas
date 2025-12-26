/**
 * Activity input and result types
 */

import {
  TenantTier,
  IdPProvider,
  Contact,
  ResourceData,
  TenantStatus,
} from './common.types';

// ============================================
// IdP Activities
// ============================================

export interface CreateIdPOrganizationInput {
  tenantId: string;
  tenantKey: string;
  tenantName: string;
  provider: IdPProvider;
  domains: string[];
  adminContact: Contact;
  config?: {
    ssoEnabled?: boolean;
    mfaEnabled?: boolean;
    passwordPolicy?: 'low' | 'medium' | 'high';
    sessionLifetimeMinutes?: number;
  };
}

export interface IdPOrganizationResult {
  provider: IdPProvider;
  organizationId: string;
  clientId: string;
  clientSecret?: string;
  adminUserId: string;
  loginUrl: string;
  metadata?: Record<string, unknown>;
}

export interface DeleteIdPOrganizationInput {
  tenantId: string;
  provider: IdPProvider;
  organizationId: string;
}

/**
 * GAP-008 FIX: Input for deactivating a user in the Identity Provider
 * Used when revoking user roles to prevent continued IdP access
 */
export interface DeactivateIdPUserInput {
  tenantId: string;
  tenantKey: string;
  provider: IdPProvider;
  userEmail: string;
  realmName?: string; // Optional: specific realm name if not using tenant-key derivation
}

/**
 * GAP-008 FIX: Result of IdP user deactivation
 */
export interface DeactivateIdPUserResult {
  success: boolean;
  provider: IdPProvider;
  userEmail: string;
  deactivated: boolean;
  userId?: string;
  error?: string;
}

// ============================================
// Infrastructure Activities (Terraform)
// ============================================

export interface ProvisionInfrastructureInput {
  tenantId: string;
  tenantKey: string;
  tier: TenantTier;
  region?: string;
  idpOrganizationId?: string;
  customVariables?: Record<string, string>;
}

export interface InfrastructureResult {
  runId: string;
  status: 'applied' | 'planned' | 'errored';
  outputs: Record<string, string>;
  resources: ResourceData[];
  logs?: string;
}

export interface DestroyInfrastructureInput {
  tenantId: string;
  tenantKey: string;
  tier: TenantTier;
  force?: boolean;
}

export interface TerraformRunStatus {
  runId: string;
  status: 'pending' | 'planning' | 'planned' | 'planned_and_finished' | 'applying' | 'applied' | 'errored' | 'cancelled';
  message?: string;
  planSummary?: {
    add: number;
    change: number;
    destroy: number;
  };
}

// ============================================
// Deployment Activities
// ============================================

export interface DeployApplicationInput {
  tenantId: string;
  tenantKey: string;
  tier: TenantTier;
  infrastructureOutputs: Record<string, string>;
  version?: string;
  imageTag?: string;
  config?: Record<string, unknown>;
}

export interface DeploymentResult {
  deploymentId: string;
  status: 'deployed' | 'failed' | 'rolled_back';
  appPlaneUrl: string;
  adminPortalUrl?: string;
  resources: ResourceData[];
  version: string;
  healthCheckPassed: boolean;
}

export interface RollbackDeploymentInput {
  tenantId: string;
  deploymentId: string;
  previousVersion?: string;
}

// ============================================
// Tenant Status Activities
// ============================================

export interface UpdateTenantStatusInput {
  tenantId: string;
  status: TenantStatus;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateResourcesInput {
  tenantId: string;
  resources: ResourceData[];
}

export interface DeleteResourcesInput {
  tenantId: string;
  resourceIds?: string[];
  deleteAll?: boolean;
}

// ============================================
// Notification Activities
// ============================================

export interface SendEmailInput {
  templateId: string;
  recipients: Array<{
    email: string;
    name?: string;
  }>;
  data: Record<string, unknown>;
  attachments?: Array<{
    filename: string;
    content: string;
    contentType: string;
  }>;
}

export interface SendWelcomeEmailInput {
  tenantId: string;
  tenantName: string;
  contacts: Contact[];
  appPlaneUrl: string;
  adminPortalUrl?: string;
  loginUrl?: string;
}

export interface SendProvisioningFailedEmailInput {
  tenantId: string;
  tenantName: string;
  contacts: Contact[];
  error: string;
  failedStep?: string;
  supportEmail?: string;
}

export interface NotificationResult {
  messageId: string;
  status: 'sent' | 'queued' | 'failed';
  recipients: string[];
  provider?: 'novu';
}

// ============================================
// DNS Activities
// ============================================

export interface ConfigureDnsInput {
  tenantId: string;
  tenantKey: string;
  domains: string[];
  targetEndpoint: string;
  recordType?: 'A' | 'CNAME' | 'ALIAS';
}

export interface DnsResult {
  configured: boolean;
  records: Array<{
    domain: string;
    recordType: string;
    value: string;
    ttl: number;
  }>;
}
