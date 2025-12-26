/**
 * Workflow input and output types
 */

import {
  TenantTier,
  IdPProvider,
  InfrastructureProvider,
  Contact,
  Address,
  ResourceData,
  PlanFeature,
} from './common.types';

// ============================================
// Provision Tenant Workflow
// ============================================

export interface TenantProvisioningInput {
  tenantId: string;
  tenantKey: string;
  tenantName: string;
  tier: TenantTier;
  domains: string[];
  contacts: Contact[];
  address?: Address;

  subscription: {
    id: string;
    planId: string;
    tier: TenantTier;
    startDate: string;
    endDate: string;
    features?: PlanFeature[];
    limits?: {
      maxUsers?: number;
      maxComponents?: number;
      maxStorageGb?: number;
      maxApiCalls?: number;
    };
  };

  idpConfig?: {
    provider: IdPProvider;
    createOrganization?: boolean;
    createAdminUser?: boolean;
    ssoEnabled?: boolean;
    mfaEnabled?: boolean;
  };

  infrastructureConfig?: {
    provider: InfrastructureProvider;
    region?: string;
    customVariables?: Record<string, string>;
  };

  notificationConfig?: {
    sendWelcomeEmail?: boolean;
    notifyAdmins?: boolean;
    customTemplateId?: string;
  };
}

export interface TenantProvisioningResult {
  success: boolean;
  tenantId: string;
  workflowId: string;

  // On success
  appPlaneUrl?: string;
  adminPortalUrl?: string;
  resources?: ResourceData[];
  idpOrganizationId?: string;
  idpClientId?: string;
  schemaName?: string;
  storageBucket?: string;

  // On failure
  error?: string;
  failedStep?: string;
  compensationExecuted?: boolean;
}

export interface ProvisioningStatus {
  step: ProvisioningStep;
  progress: number;
  message?: string;
  startedAt: string;
  updatedAt: string;
}

export type ProvisioningStep =
  | 'initializing'
  | 'updating_status'
  | 'creating_idp_organization'
  | 'creating_admin_user'
  | 'provisioning_database'
  | 'provisioning_storage'
  | 'provisioning_infrastructure'
  | 'deploying_application'
  | 'configuring_dns'
  | 'creating_resources'
  | 'activating_tenant'
  | 'creating_billing_customer'
  | 'creating_subscription'
  | 'sending_notifications'
  | 'provisioning_app_plane'
  | 'completed'
  | 'failed'
  | 'compensation';

// ============================================
// Deprovision Tenant Workflow
// ============================================

export interface TenantDeprovisioningInput {
  tenantId: string;
  tenantKey: string;
  tier: TenantTier;

  options?: {
    deleteData?: boolean;
    deleteBackups?: boolean;
    gracePeriodDays?: number;
    notifyUsers?: boolean;
  };
}

export interface TenantDeprovisioningResult {
  success: boolean;
  tenantId: string;
  workflowId: string;

  deletedResources?: ResourceData[];
  error?: string;
  failedStep?: string;
}

export type DeprovisioningStep =
  | 'initializing'
  | 'updating_status'
  | 'notifying_users'
  | 'backing_up_data'
  | 'removing_application'
  | 'destroying_infrastructure'
  | 'removing_idp_organization'
  | 'cleaning_up_resources'
  | 'finalizing'
  | 'completed'
  | 'failed';

// ============================================
// Deploy Tenant Workflow (Updates)
// ============================================

export interface TenantDeploymentInput {
  tenantId: string;
  tenantKey: string;
  tier: TenantTier;

  deployment: {
    version: string;
    imageTag?: string;
    configChanges?: Record<string, unknown>;
    rollbackOnFailure?: boolean;
  };
}

export interface TenantDeploymentResult {
  success: boolean;
  tenantId: string;
  workflowId: string;

  deployedVersion?: string;
  previousVersion?: string;
  rolledBack?: boolean;
  error?: string;
}
