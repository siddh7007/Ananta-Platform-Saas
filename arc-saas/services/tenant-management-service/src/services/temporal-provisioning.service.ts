import {inject, service} from '@loopback/core';
import {repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {Client as TemporalClient} from '@temporalio/client';
import {ILogger, LOGGER} from '@sourceloop/core';

import {SubscriptionDTO, TenantWithRelations} from '../models';
import {TenantRepository} from '../repositories';
import {TenantStatus} from '../enums';
import {TemporalBindings, TemporalConfig} from '../keys';
import {IProvisioningService} from '../types';

/**
 * Valid deployment architecture tiers for Temporal workflow
 */
type DeploymentTier = 'silo' | 'pooled' | 'bridge';

/**
 * Plan ID to tier mapping for when only planId is provided
 */
const PLAN_ID_TO_TIER: Record<string, string> = {
  'plan-free': 'FREE',
  'plan-basic': 'BASIC',
  'plan-standard': 'STANDARD',
  'plan-premium': 'PREMIUM',
  // Fallback for legacy IDs
  'free': 'FREE',
  'basic': 'BASIC',
  'standard': 'STANDARD',
  'premium': 'PREMIUM',
};

/**
 * Normalize pricing/business tier to deployment architecture tier.
 */
function normalizeToDeploymentTier(tier: string | undefined): DeploymentTier {
  if (!tier) return 'pooled';
  const lowerTier = tier.toLowerCase();
  if (['silo', 'pooled', 'bridge'].includes(lowerTier)) return lowerTier as DeploymentTier;
  // IMPORTANT: Only Enterprise tier uses silo (dedicated infrastructure)
  // All other plans (Free, Basic/Starter, Standard/Pro, Premium) use pooled (shared Supabase with RLS)
  const tierMappings: Record<string, DeploymentTier> = {
    enterprise: 'silo',    // Only Enterprise gets dedicated infrastructure
    dedicated: 'silo',     // Explicit dedicated request
    premium: 'pooled',     // Premium uses pooled (shared infrastructure)
    standard: 'pooled',    // Standard/Pro uses pooled
    basic: 'pooled',       // Basic/Starter uses pooled
    free: 'pooled',        // Free uses pooled
    starter: 'pooled',     // Starter uses pooled
    pro: 'pooled',         // Pro uses pooled
    hybrid: 'bridge',      // Hybrid deployments
  };
  return tierMappings[lowerTier] || 'pooled';
}


/**
 * Provisioning status returned by Temporal workflow queries
 */
export interface ProvisioningStatus {
  step: string;
  progress: number;
  message?: string;
  startedAt: string;
  updatedAt: string;
}

/**
 * Result of starting a provisioning workflow
 */
export interface ProvisioningWorkflowResult {
  workflowId: string;
  runId: string;
}

/**
 * Temporal-based Provisioning Service
 *
 * Replaces the event-based provisioning with Temporal workflows for:
 * - Durable, reliable execution
 * - Automatic retries with backoff
 * - Saga compensation on failure
 * - Real-time status tracking
 */
export class TemporalProvisioningService<T extends SubscriptionDTO>
  implements IProvisioningService<T>
{
  private taskQueue: string;

  constructor(
    @inject(TemporalBindings.CLIENT)
    private temporalClient: TemporalClient,
    @inject(TemporalBindings.CONFIG, {optional: true})
    private temporalConfig: TemporalConfig | undefined,
    @repository(TenantRepository)
    private tenantRepository: TenantRepository,
    @inject(LOGGER.LOGGER_INJECT)
    private logger: ILogger,
  ) {
    this.taskQueue =
      this.temporalConfig?.taskQueue ||
      process.env.TEMPORAL_TASK_QUEUE ||
      'tenant-provisioning';
  }

  /**
   * Provision a tenant by starting a Temporal workflow
   *
   * @param tenant - The tenant to provision
   * @param subscription - The subscription details
   * @returns The workflow ID for tracking
   */
  async provisionTenant(
    tenant: TenantWithRelations,
    subscription: T,
  ): Promise<void> {
    if (!subscription.id) {
      throw new HttpErrors.BadRequest('Subscription ID is required');
    }

    // Get tier from plan object or look it up from planId
    let planTier = subscription.plan?.tier;

    if (!planTier && subscription.planId) {
      // Look up tier from planId
      planTier = PLAN_ID_TO_TIER[subscription.planId];
      this.logger.info(`Resolved tier '${planTier}' from planId '${subscription.planId}'`);
    }

    if (!planTier) {
      // Default to basic if no tier can be determined
      planTier = 'BASIC';
      this.logger.warn(
        `Tier not found for subscription: ${subscription.id}, defaulting to BASIC`,
      );
    }

    // Normalize the tier to a valid deployment tier
    const deploymentTier = normalizeToDeploymentTier(planTier);
    this.logger.info(`Normalized tier '${planTier}' to deployment tier '${deploymentTier}'`);

    // Generate workflow ID based on tenant ID for idempotency
    const workflowId = `provision-tenant-${tenant.id}`;

    this.logger.info(`Starting provisioning workflow: ${workflowId}`);

    try {
      // Start the Temporal workflow
      const handle = await this.temporalClient.workflow.start(
        'provisionTenantWorkflow',
        {
          taskQueue: this.taskQueue,
          workflowId,
          args: [
            {
              tenantId: tenant.id,
              tenantKey: tenant.key,
              tenantName: tenant.name,
              tier: deploymentTier,
              domains: tenant.domains || [],
              contacts: tenant.contacts || [],
              address: tenant.address,
              subscription: {
                id: subscription.id,
                planId: subscription.planId,
                tier: deploymentTier,
                startDate: subscription.startDate,
                endDate: subscription.endDate,
              },
              idpConfig: this.getIdpConfig(),
              infrastructureConfig: this.getInfrastructureConfig(),
              notificationConfig: {
                sendWelcomeEmail: true,
                notifyAdmins: false,
              },
            },
          ],
          // Workflow options
          workflowExecutionTimeout: '2 hours',
          workflowRunTimeout: '1 hour',
          workflowTaskTimeout: '10 seconds',
        },
      );

      this.logger.info(
        `Provisioning workflow started: ${workflowId}, runId: ${handle.workflowId}`,
      );

      // Store workflow ID in tenant metadata for later reference
      await this.tenantRepository.updateById(tenant.id, {
        status: TenantStatus.PROVISIONING,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      // Check if this is a "workflow already started" error - this is actually OK
      // It means provisioning is already in progress (idempotent behavior)
      if (message.includes('Workflow execution already started') ||
          message.includes('workflow execution already started')) {
        this.logger.info(
          `Provisioning workflow already running for tenant: ${tenant.id} - this is expected on retry`,
        );
        // Don't mark as failed - the workflow is running
        // Just return success (idempotent)
        return;
      }

      this.logger.error(`Failed to start provisioning workflow: ${message}`);

      // Update tenant status to failed
      await this.tenantRepository.updateById(tenant.id, {
        status: TenantStatus.PROVISIONFAILED,
      });

      throw new HttpErrors.InternalServerError(
        `Failed to start provisioning: ${message}`,
      );
    }
  }

  /**
   * Get the current status of a provisioning workflow
   *
   * @param tenantId - The tenant ID
   * @returns The current provisioning status
   */
  async getProvisioningStatus(tenantId: string): Promise<ProvisioningStatus> {
    const workflowId = `provision-tenant-${tenantId}`;

    try {
      const handle = this.temporalClient.workflow.getHandle(workflowId);
      const status = await handle.query<ProvisioningStatus>(
        'getProvisioningStatus',
      );
      return status;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get provisioning status: ${message}`);
      throw new HttpErrors.NotFound(
        `Provisioning workflow not found for tenant: ${tenantId}`,
      );
    }
  }

  /**
   * Cancel a provisioning workflow
   *
   * @param tenantId - The tenant ID
   */
  async cancelProvisioning(tenantId: string): Promise<void> {
    const workflowId = `provision-tenant-${tenantId}`;

    try {
      const handle = this.temporalClient.workflow.getHandle(workflowId);

      // Send cancellation signal
      await handle.signal('provisioningCancelled');

      this.logger.info(`Cancellation signal sent to workflow: ${workflowId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to cancel provisioning: ${message}`);
      throw new HttpErrors.BadRequest(`Failed to cancel provisioning: ${message}`);
    }
  }

  /**
   * Deprovision a tenant by starting a deprovisioning workflow
   *
   * @param tenantId - The tenant ID to deprovision
   * @param options - Deprovisioning options
   */
  async deprovisionTenant(
    tenantId: string,
    options?: {
      deleteData?: boolean;
      gracePeriodDays?: number;
      notifyUsers?: boolean;
    },
  ): Promise<void> {
    const tenant = await this.tenantRepository.findById(tenantId);

    if (!tenant) {
      throw new HttpErrors.NotFound(`Tenant not found: ${tenantId}`);
    }

    const workflowId = `deprovision-tenant-${tenantId}`;

    this.logger.info(`Starting deprovisioning workflow: ${workflowId}`);

    try {
      await this.temporalClient.workflow.start('deprovisionTenantWorkflow', {
        taskQueue: this.taskQueue,
        workflowId,
        args: [
          {
            tenantId: tenant.id,
            tenantKey: tenant.key,
            tier: 'pooled' as const, // Get from tenant metadata in real impl
            options: {
              deleteData: options?.deleteData ?? true,
              gracePeriodDays: options?.gracePeriodDays ?? 0,
              notifyUsers: options?.notifyUsers ?? true,
            },
          },
        ],
        workflowExecutionTimeout: '7 days', // Allow for grace period
        workflowRunTimeout: '2 hours',
      });

      await this.tenantRepository.updateById(tenantId, {
        status: TenantStatus.DEPROVISIONING,
      });

      this.logger.info(`Deprovisioning workflow started: ${workflowId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to start deprovisioning workflow: ${message}`);
      throw new HttpErrors.InternalServerError(
        `Failed to start deprovisioning: ${message}`,
      );
    }
  }

  /**
   * Provision a user by starting a Temporal workflow
   *
   * @param input - User provisioning input
   * @returns The workflow ID for tracking
   */
  async provisionUser(input: {
    tenantId: string;
    tenantKey: string;
    tenantName: string;
    email: string;
    firstName: string;
    lastName: string;
    password?: string;
    role?: string;
    metadata?: Record<string, string>;
    appUrl: string;
    loginUrl?: string;
  }): Promise<{ workflowId: string }> {
    // Generate workflow ID based on tenant and email for idempotency
    const workflowId = `provision-user-${input.tenantId}-${input.email.replace('@', '-at-')}`;

    this.logger.info(`Starting user provisioning workflow: ${workflowId}`);

    try {
      await this.temporalClient.workflow.start('provisionUserWorkflow', {
        taskQueue: this.taskQueue,
        workflowId,
        args: [input],
        workflowExecutionTimeout: '30 minutes',
        workflowRunTimeout: '15 minutes',
        workflowTaskTimeout: '10 seconds',
      });

      this.logger.info(`User provisioning workflow started: ${workflowId}`);
      return { workflowId };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to start user provisioning workflow: ${message}`);
      throw new HttpErrors.InternalServerError(
        `Failed to start user provisioning: ${message}`,
      );
    }
  }

  /**
   * Get the current status of a user provisioning workflow
   *
   * @param workflowId - The workflow ID
   * @returns The current provisioning status
   */
  async getUserProvisioningStatus(workflowId: string): Promise<ProvisioningStatus> {
    try {
      const handle = this.temporalClient.workflow.getHandle(workflowId);
      const status = await handle.query<ProvisioningStatus>(
        'getUserProvisioningStatus',
      );
      return status;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get user provisioning status: ${message}`);
      throw new HttpErrors.NotFound(
        `User provisioning workflow not found: ${workflowId}`,
      );
    }
  }

  /**
   * Get IdP configuration from environment
   */
  private getIdpConfig():
    | {
        provider: 'auth0' | 'keycloak';
        createOrganization?: boolean;
        createAdminUser?: boolean;
      }
    | undefined {
    const provider = process.env.IDP_PROVIDER as 'auth0' | 'keycloak' | undefined;

    if (!provider) {
      return undefined;
    }

    return {
      provider,
      createOrganization: true,
      createAdminUser: true,
    };
  }

  /**
   * Get infrastructure configuration from environment
   */
  private getInfrastructureConfig():
    | {
        provider: 'terraform';
        region?: string;
      }
    | undefined {
    const terraformEnabled = process.env.TERRAFORM_ENABLED === 'true';

    if (!terraformEnabled) {
      return undefined;
    }

    return {
      provider: 'terraform',
      region: process.env.AWS_REGION || 'us-east-1',
    };
  }
}
