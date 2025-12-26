/**
 * Sync User Role Workflow
 *
 * Orchestrates synchronization of user roles from Control Plane to App Plane.
 * This workflow is triggered when:
 * - A user role is assigned
 * - A user role is updated
 * - A user role is revoked
 *
 * Benefits of using Temporal for this workflow:
 * - Ensures eventual consistency between Control Plane and App Plane
 * - Automatic retries with exponential backoff
 * - Full audit trail of all role sync operations
 * - Visibility into sync status via Temporal UI
 */

import {
  proxyActivities,
  defineQuery,
  setHandler,
  ApplicationFailure,
  workflowInfo,
  log,
} from '@temporalio/workflow';

import type * as supabaseActivities from '../activities/supabase-app-plane.activities';
import type * as idpActivities from '../activities/idp.activities';
import { ACTIVITY_TIMEOUTS, RETRY_POLICY } from '../config/workflow.config';

// ============================================
// Types
// ============================================

export type RoleSyncOperation = 'assign' | 'update' | 'revoke';

export interface SyncUserRoleInput {
  operation: RoleSyncOperation;
  tenantId: string;
  tenantKey: string;
  userId: string; // Control Plane user ID
  userEmail: string;
  firstName?: string;
  lastName?: string;
  keycloakUserId?: string;
  roleKey: string;
  previousRoleKey?: string; // For updates
  scopeType?: 'tenant' | 'workspace' | 'project';
  scopeId?: string;
  performedBy: string; // Who made the role change
  idpProvider?: 'keycloak' | 'auth0' | 'cognito'; // GAP-008 FIX: IdP provider for user deactivation
}

export interface SyncUserRoleResult {
  success: boolean;
  operation: RoleSyncOperation;
  tenantId: string;
  userId: string;
  roleKey: string;
  appPlaneUserId?: string;
  error?: string;
}

export interface RoleSyncWorkflowStatus {
  step: 'validating' | 'syncing_user' | 'syncing_role' | 'completed' | 'failed';
  progress: number;
  operation: RoleSyncOperation;
  message?: string;
}

// ============================================
// Configuration
// ============================================

const ROLE_SYNC_CONFIG = {
  ACTIVITY_TIMEOUTS: {
    START_TO_CLOSE: ACTIVITY_TIMEOUTS.START_TO_CLOSE,
    SCHEDULE_TO_CLOSE: ACTIVITY_TIMEOUTS.SCHEDULE_TO_CLOSE,
  },
  RETRY: {
    initialInterval: RETRY_POLICY.INITIAL_INTERVAL,
    backoffCoefficient: RETRY_POLICY.BACKOFF_COEFFICIENT,
    maximumAttempts: RETRY_POLICY.MAXIMUM_ATTEMPTS,
    maximumInterval: RETRY_POLICY.MAXIMUM_INTERVAL,
    nonRetryableErrorTypes: [
      'ValidationError',
      'TenantNotFoundError',
      'UserNotFoundError',
    ],
  },
};

// ============================================
// Activity Proxy
// ============================================

const appPlane = proxyActivities<typeof supabaseActivities>({
  startToCloseTimeout: ROLE_SYNC_CONFIG.ACTIVITY_TIMEOUTS.START_TO_CLOSE as any,
  scheduleToCloseTimeout: ROLE_SYNC_CONFIG.ACTIVITY_TIMEOUTS.SCHEDULE_TO_CLOSE as any,
  retry: {
    initialInterval: ROLE_SYNC_CONFIG.RETRY.initialInterval as any,
    backoffCoefficient: ROLE_SYNC_CONFIG.RETRY.backoffCoefficient,
    maximumAttempts: ROLE_SYNC_CONFIG.RETRY.maximumAttempts,
    maximumInterval: ROLE_SYNC_CONFIG.RETRY.maximumInterval as any,
    nonRetryableErrorTypes: ROLE_SYNC_CONFIG.RETRY.nonRetryableErrorTypes,
  },
});

// GAP-008 FIX: IdP activities proxy for user deactivation
const idp = proxyActivities<typeof idpActivities>({
  startToCloseTimeout: ROLE_SYNC_CONFIG.ACTIVITY_TIMEOUTS.START_TO_CLOSE as any,
  scheduleToCloseTimeout: ROLE_SYNC_CONFIG.ACTIVITY_TIMEOUTS.SCHEDULE_TO_CLOSE as any,
  retry: {
    initialInterval: ROLE_SYNC_CONFIG.RETRY.initialInterval as any,
    backoffCoefficient: ROLE_SYNC_CONFIG.RETRY.backoffCoefficient,
    maximumAttempts: 2, // Fewer retries for IdP - App Plane deactivation is more critical
    maximumInterval: ROLE_SYNC_CONFIG.RETRY.maximumInterval as any,
    nonRetryableErrorTypes: ROLE_SYNC_CONFIG.RETRY.nonRetryableErrorTypes,
  },
});

// ============================================
// Queries
// ============================================

export const getRoleSyncStatusQuery = defineQuery<RoleSyncWorkflowStatus>(
  'getRoleSyncStatus'
);

// ============================================
// Input Validation
// ============================================

function validateInput(input: SyncUserRoleInput): void {
  if (!input.operation || !['assign', 'update', 'revoke'].includes(input.operation)) {
    throw ApplicationFailure.nonRetryable(
      'Invalid operation. Must be assign, update, or revoke',
      'ValidationError'
    );
  }
  if (!input.tenantId || typeof input.tenantId !== 'string') {
    throw ApplicationFailure.nonRetryable('tenantId is required', 'ValidationError');
  }
  if (!input.tenantKey || typeof input.tenantKey !== 'string') {
    throw ApplicationFailure.nonRetryable('tenantKey is required', 'ValidationError');
  }
  if (!input.userId || typeof input.userId !== 'string') {
    throw ApplicationFailure.nonRetryable('userId is required', 'ValidationError');
  }
  if (!input.userEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.userEmail)) {
    throw ApplicationFailure.nonRetryable('Valid userEmail is required', 'ValidationError');
  }
  if (!input.roleKey || typeof input.roleKey !== 'string') {
    throw ApplicationFailure.nonRetryable('roleKey is required', 'ValidationError');
  }
  if (!input.performedBy || typeof input.performedBy !== 'string') {
    throw ApplicationFailure.nonRetryable('performedBy is required', 'ValidationError');
  }
}

// ============================================
// Main Workflow
// ============================================

export async function syncUserRoleWorkflow(
  input: SyncUserRoleInput
): Promise<SyncUserRoleResult> {
  const { workflowId } = workflowInfo();

  // Validate input
  validateInput(input);

  log.info('Starting sync user role workflow', {
    operation: input.operation,
    tenantId: input.tenantId,
    userId: input.userId,
    userEmail: input.userEmail,
    roleKey: input.roleKey,
  });

  // Workflow state
  let status: RoleSyncWorkflowStatus = {
    step: 'validating',
    progress: 0,
    operation: input.operation,
  };

  // Set up query handler
  setHandler(getRoleSyncStatusQuery, () => status);

  try {
    // ========================================
    // Step 1: Validation
    // ========================================
    status = {
      step: 'validating',
      progress: 20,
      operation: input.operation,
      message: 'Validating role sync request...',
    };

    log.info('Validated role sync request', {
      operation: input.operation,
      tenantId: input.tenantId,
    });

    // ========================================
    // Step 2: Sync based on operation
    // ========================================

    let appPlaneUserId: string | undefined;

    switch (input.operation) {
      case 'assign': {
        // For role assignment, create/update user in App Plane
        status = {
          step: 'syncing_user',
          progress: 50,
          operation: input.operation,
          message: 'Creating/updating user in App Plane...',
        };

        log.info('Syncing user to App Plane for role assignment', {
          email: input.userEmail,
          role: input.roleKey,
        });

        const userResult = await appPlane.createAppPlaneUser({
          tenantId: input.tenantId,
          tenantKey: input.tenantKey,
          userEmail: input.userEmail,
          firstName: input.firstName,
          lastName: input.lastName,
          keycloakUserId: input.keycloakUserId,
          role: input.roleKey,
          invitedBy: input.performedBy,
        });

        appPlaneUserId = userResult.userId;

        log.info('User synced to App Plane', {
          appPlaneUserId,
          created: userResult.created,
        });
        break;
      }

      case 'update': {
        // For role update, update the user's role in App Plane
        status = {
          step: 'syncing_role',
          progress: 50,
          operation: input.operation,
          message: `Updating user role from ${input.previousRoleKey} to ${input.roleKey}...`,
        };

        log.info('Updating user role in App Plane', {
          email: input.userEmail,
          previousRole: input.previousRoleKey,
          newRole: input.roleKey,
        });

        const updateResult = await appPlane.updateAppPlaneUserRole({
          tenantId: input.tenantId,
          userEmail: input.userEmail,
          newRole: input.roleKey,
          previousRole: input.previousRoleKey,
        });

        appPlaneUserId = updateResult.userId;

        log.info('User role updated in App Plane', {
          appPlaneUserId,
        });
        break;
      }

      case 'revoke': {
        // For role revocation, deactivate user membership in App Plane
        status = {
          step: 'syncing_role',
          progress: 50,
          operation: input.operation,
          message: 'Revoking user role in App Plane...',
        };

        log.info('Revoking user role in App Plane', {
          email: input.userEmail,
          role: input.roleKey,
        });

        const revokeResult = await appPlane.revokeAppPlaneUserRole({
          tenantId: input.tenantId,
          userEmail: input.userEmail,
          role: input.roleKey,
        });

        appPlaneUserId = revokeResult.userId;

        log.info('User role revoked in App Plane', {
          appPlaneUserId,
          deactivated: revokeResult.deactivated,
        });

        // GAP-008 FIX: Also deactivate user in IdP to prevent continued access
        if (input.idpProvider && (input.idpProvider === 'keycloak' || input.idpProvider === 'auth0')) {
          status = {
            step: 'syncing_role',
            progress: 75,
            operation: input.operation,
            message: 'Deactivating user in Identity Provider...',
          };

          log.info('Deactivating user in IdP', {
            email: input.userEmail,
            provider: input.idpProvider,
          });

          const idpResult = await idp.deactivateIdPUser({
            tenantId: input.tenantId,
            tenantKey: input.tenantKey,
            provider: input.idpProvider,
            userEmail: input.userEmail,
          });

          if (idpResult.success) {
            log.info('User deactivated in IdP', {
              email: input.userEmail,
              provider: input.idpProvider,
              idpUserId: idpResult.userId,
              deactivated: idpResult.deactivated,
            });
          } else {
            // Log warning but don't fail the workflow - App Plane deactivation succeeded
            log.warn('IdP user deactivation failed (non-fatal)', {
              email: input.userEmail,
              provider: input.idpProvider,
              error: idpResult.error,
            });
          }
        }
        break;
      }
    }

    // ========================================
    // Complete!
    // ========================================
    status = {
      step: 'completed',
      progress: 100,
      operation: input.operation,
      message: `Role ${input.operation} synced successfully`,
    };

    log.info('Sync user role workflow completed successfully', {
      operation: input.operation,
      tenantId: input.tenantId,
      userId: input.userId,
      appPlaneUserId,
    });

    return {
      success: true,
      operation: input.operation,
      tenantId: input.tenantId,
      userId: input.userId,
      roleKey: input.roleKey,
      appPlaneUserId,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    status = {
      step: 'failed',
      progress: 0,
      operation: input.operation,
      message: `Failed: ${errorMessage}`,
    };

    log.error('Sync user role workflow failed', {
      operation: input.operation,
      tenantId: input.tenantId,
      userId: input.userId,
      error: errorMessage,
    });

    // Re-throw the error so Temporal marks the workflow as FAILED
    throw error;
  }
}
