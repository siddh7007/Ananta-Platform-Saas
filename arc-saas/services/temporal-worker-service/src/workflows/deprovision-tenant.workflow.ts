/**
 * Deprovision Tenant Workflow
 *
 * Orchestrates the complete tenant deprovisioning process:
 * - Graceful shutdown with optional grace period
 * - Data backup before deletion (optional)
 * - Multi-step teardown (Application, Infrastructure, IdP)
 * - Resource cleanup
 *
 * IMPORTANT: Workflows must be deterministic. Do NOT use:
 * - console.log (use log from @temporalio/workflow instead)
 * - Date.now() or new Date() for logic (only for display)
 * - Math.random()
 * - External API calls (use activities instead)
 */

import {
  proxyActivities,
  defineSignal,
  defineQuery,
  setHandler,
  ApplicationFailure,
  sleep,
  workflowInfo,
  log,
} from '@temporalio/workflow';

import type * as idpActivities from '../activities/idp.activities';
import type * as infraActivities from '../activities/infrastructure.activities';
import type * as deployActivities from '../activities/deployment.activities';
import type * as tenantActivities from '../activities/tenant.activities';
import type * as notificationActivities from '../activities/notification.activities';

import {
  TenantDeprovisioningInput,
  TenantDeprovisioningResult,
  DeprovisioningStep,
} from '../types';

// Non-retryable error types for configuration
const NON_RETRYABLE_ERRORS = [
  'InvalidConfigurationError',
  'InvalidCredentialsError',
  'ResourceAlreadyExistsError',
  'ResourceNotFoundError',
  'ValidationError',
  'PermissionDeniedError',
];

// ============================================
// Activity Proxies
// ============================================

const idp = proxyActivities<typeof idpActivities>({
  startToCloseTimeout: '5 minutes',
  scheduleToCloseTimeout: '10 minutes',
  retry: {
    initialInterval: '10s',
    backoffCoefficient: 2,
    maximumAttempts: 3,
    maximumInterval: '2 minutes',
    nonRetryableErrorTypes: NON_RETRYABLE_ERRORS,
  },
});

const infra = proxyActivities<typeof infraActivities>({
  startToCloseTimeout: '30 minutes',
  scheduleToCloseTimeout: '45 minutes',
  heartbeatTimeout: '2 minutes',
  retry: {
    initialInterval: '30s',
    backoffCoefficient: 2,
    maximumAttempts: 3,
    maximumInterval: '5 minutes',
    nonRetryableErrorTypes: NON_RETRYABLE_ERRORS,
  },
});

const deploy = proxyActivities<typeof deployActivities>({
  startToCloseTimeout: '15 minutes',
  scheduleToCloseTimeout: '30 minutes',
  heartbeatTimeout: '1 minute',
  retry: {
    initialInterval: '15s',
    backoffCoefficient: 2,
    maximumAttempts: 3,
    maximumInterval: '3 minutes',
    nonRetryableErrorTypes: NON_RETRYABLE_ERRORS,
  },
});

const tenant = proxyActivities<typeof tenantActivities>({
  startToCloseTimeout: '30 seconds',
  scheduleToCloseTimeout: '2 minutes',
  retry: {
    maximumAttempts: 5,
    initialInterval: '1s',
    maximumInterval: '30 seconds',
    nonRetryableErrorTypes: NON_RETRYABLE_ERRORS,
  },
});

const notification = proxyActivities<typeof notificationActivities>({
  startToCloseTimeout: '30 seconds',
  scheduleToCloseTimeout: '2 minutes',
  retry: {
    maximumAttempts: 3,
    initialInterval: '2s',
    maximumInterval: '30 seconds',
    nonRetryableErrorTypes: NON_RETRYABLE_ERRORS,
  },
});

// ============================================
// Status Type
// ============================================

interface DeprovisioningStatus {
  step: DeprovisioningStep;
  progress: number;
  message?: string;
  startedAt: string;
  updatedAt: string;
}

// ============================================
// Signals and Queries
// ============================================

export const deprovisioningCancelledSignal = defineSignal('deprovisioningCancelled');

export const getDeprovisioningStatusQuery =
  defineQuery<DeprovisioningStatus>('getDeprovisioningStatus');

// ============================================
// Input Validation
// ============================================

function validateInput(input: TenantDeprovisioningInput): void {
  if (!input.tenantId || typeof input.tenantId !== 'string') {
    throw ApplicationFailure.nonRetryable('tenantId is required', 'ValidationError');
  }
  if (!input.tenantKey || typeof input.tenantKey !== 'string') {
    throw ApplicationFailure.nonRetryable('tenantKey is required', 'ValidationError');
  }
  if (!input.tier || !['silo', 'pooled', 'bridge'].includes(input.tier)) {
    throw ApplicationFailure.nonRetryable('Invalid tier', 'ValidationError');
  }
}

// ============================================
// Main Workflow
// ============================================

export async function deprovisionTenantWorkflow(
  input: TenantDeprovisioningInput
): Promise<TenantDeprovisioningResult> {
  const { workflowId } = workflowInfo();

  // Validate input first
  validateInput(input);

  log.info('Starting tenant deprovisioning workflow', {
    tenantId: input.tenantId,
    tenantKey: input.tenantKey,
    tier: input.tier,
    gracePeriodDays: input.options?.gracePeriodDays,
  });

  // Workflow state
  let status: DeprovisioningStatus = {
    step: 'initializing',
    progress: 0,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  let cancelled = false;

  // Helper to update status
  const updateStatus = (step: DeprovisioningStep, progress: number, message?: string) => {
    status = {
      step,
      progress,
      message,
      startedAt: status.startedAt,
      updatedAt: new Date().toISOString(),
    };
    log.debug('Status updated', { step, progress, message });
  };

  // Set up signal and query handlers
  setHandler(deprovisioningCancelledSignal, () => {
    cancelled = true;
    log.info('Received cancellation signal', { tenantId: input.tenantId });
  });

  setHandler(getDeprovisioningStatusQuery, () => status);

  try {
    // ========================================
    // Step 1: Update tenant status to DEPROVISIONING
    // ========================================
    updateStatus('updating_status', 5, 'Initiating deprovisioning...');

    await tenant.updateTenantStatus({
      tenantId: input.tenantId,
      status: 'DEPROVISIONING',
      message: 'Deprovisioning workflow started',
    });

    // ========================================
    // Step 2: Notify users (if enabled)
    // ========================================
    if (input.options?.notifyUsers) {
      updateStatus('notifying_users', 10, 'Notifying users...');

      // Get tenant details for notification
      const tenantDetails = await tenant.getTenantDetails(input.tenantId);

      if (tenantDetails.contacts.length > 0) {
        await notification.sendDeprovisioningNotification({
          tenantId: input.tenantId,
          tenantName: tenantDetails.name,
          contacts: tenantDetails.contacts,
          gracePeriodDays: input.options.gracePeriodDays,
        });
      }
    }

    // ========================================
    // Step 3: Wait for grace period (if specified)
    // ========================================
    if (input.options?.gracePeriodDays && input.options.gracePeriodDays > 0) {
      updateStatus(
        'notifying_users',
        15,
        `Waiting ${input.options.gracePeriodDays} days grace period...`
      );

      // Sleep for grace period (in production this could be days)
      const gracePeriodMs = input.options.gracePeriodDays * 24 * 60 * 60 * 1000;
      await sleep(gracePeriodMs);

      // Check if cancelled during grace period
      if (cancelled) {
        // Revert to active if cancelled during grace period
        await tenant.updateTenantStatus({
          tenantId: input.tenantId,
          status: 'ACTIVE',
          message: 'Deprovisioning cancelled during grace period',
        });

        return {
          success: false,
          tenantId: input.tenantId,
          workflowId,
          error: 'Deprovisioning cancelled by user during grace period',
          failedStep: 'notifying_users',
        };
      }
    }

    // ========================================
    // Step 4: Backup data (if enabled)
    // ========================================
    if (input.options?.deleteData === false) {
      updateStatus('backing_up_data', 25, 'Backing up tenant data...');

      await tenant.backupTenantData({
        tenantId: input.tenantId,
        tenantKey: input.tenantKey,
        includeDatabase: true,
        includeStorage: true,
      });
    }

    // ========================================
    // Step 5: Remove application deployment
    // ========================================
    updateStatus('removing_application', 40, 'Removing application...');

    await deploy.removeDeployment({
      tenantId: input.tenantId,
      tenantKey: input.tenantKey,
      tier: input.tier,
    });

    // ========================================
    // Step 6: Destroy infrastructure
    // ========================================
    updateStatus('destroying_infrastructure', 60, 'Destroying infrastructure...');

    const destroyResult = await infra.destroyInfrastructure({
      tenantId: input.tenantId,
      tenantKey: input.tenantKey,
      tier: input.tier,
      force: true,
    });

    // ========================================
    // Step 7: Remove IdP organization
    // ========================================
    updateStatus('removing_idp_organization', 75, 'Removing identity provider...');

    // Get IdP info from tenant metadata
    const tenantDetails = await tenant.getTenantDetails(input.tenantId);

    if (tenantDetails.idpOrganizationId && tenantDetails.idpProvider) {
      await idp.deleteIdPOrganization({
        tenantId: input.tenantId,
        provider: tenantDetails.idpProvider,
        organizationId: tenantDetails.idpOrganizationId,
      });
    }

    // ========================================
    // Step 8: Clean up resource records
    // ========================================
    updateStatus('cleaning_up_resources', 85, 'Cleaning up resources...');

    await tenant.deleteResources({
      tenantId: input.tenantId,
      deleteAll: true,
    });

    // ========================================
    // Step 9: Finalize - Update tenant status
    // ========================================
    updateStatus('finalizing', 95, 'Finalizing...');

    await tenant.updateTenantStatus({
      tenantId: input.tenantId,
      status: 'DEPROVISIONED',
      message: 'Deprovisioning completed successfully',
      metadata: {
        deprovisionedAt: new Date().toISOString(),
        dataBackedUp: input.options?.deleteData === false,
      },
    });

    // ========================================
    // Complete!
    // ========================================
    updateStatus('completed', 100, 'Deprovisioning completed');

    log.info('Deprovisioning workflow completed successfully', {
      tenantId: input.tenantId,
    });

    return {
      success: true,
      tenantId: input.tenantId,
      workflowId,
      deletedResources: destroyResult.deletedResources,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const failedStep = status.step;

    log.error('Deprovisioning failed', {
      tenantId: input.tenantId,
      failedStep,
      error: errorMessage,
    });

    // Update tenant status to indicate partial failure
    try {
      await tenant.updateTenantStatus({
        tenantId: input.tenantId,
        status: 'INACTIVE',
        message: `Deprovisioning failed: ${errorMessage}`,
        metadata: {
          failedAt: failedStep,
          error: errorMessage,
          requiresManualCleanup: true,
        },
      });
    } catch (statusError) {
      log.error('Failed to update tenant status', {
        error: statusError instanceof Error ? statusError.message : 'Unknown',
      });
    }

    updateStatus('failed', 0, `Deprovisioning failed: ${errorMessage}`);

    return {
      success: false,
      tenantId: input.tenantId,
      workflowId,
      error: errorMessage,
      failedStep,
    };
  }
}
