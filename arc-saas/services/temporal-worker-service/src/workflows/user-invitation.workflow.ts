/**
 * User Invitation Workflow
 *
 * Orchestrates the complete user invitation process:
 * - Validates tenant exists and is active
 * - Validates IdP configuration
 * - Creates invitation record with secure token
 * - Sends invitation email via Novu
 *
 * Benefits of using Temporal for this workflow:
 * - Full visibility in Temporal UI
 * - Automatic retries with backoff
 * - Audit trail of all invitation activities
 * - Easy debugging and monitoring
 */

import {
  proxyActivities,
  defineQuery,
  setHandler,
  ApplicationFailure,
  workflowInfo,
  log,
} from '@temporalio/workflow';

import type * as invitationActivities from '../activities/invitation.activities';
import type * as supabaseActivities from '../activities/supabase-app-plane.activities';
import {USER_INVITATION_CONFIG} from '../config/workflow.config';

// ============================================
// Types
// ============================================

export interface UserInvitationInput {
  email: string;
  firstName?: string;
  lastName?: string;
  roleKey: string;
  tenantId: string;
  tenantKey?: string; // For App Plane sync
  invitedBy: string;
  expiresInDays?: number; // Default: 7 days
  syncToAppPlane?: boolean; // Default: true - sync user to App Plane (Supabase)
}

export interface UserInvitationResult {
  success: boolean;
  invitationId: string;
  token: string;
  expiresAt: string;
  emailSent: boolean;
  appPlaneSynced?: boolean; // Whether user was created in App Plane
  appPlaneUserId?: string; // User ID in App Plane (Supabase)
  error?: string;
}

export interface InvitationWorkflowStatus {
  step: 'validating' | 'creating_invitation' | 'sending_email' | 'syncing_app_plane' | 'completed' | 'failed';
  progress: number;
  message?: string;
  emailSent?: boolean;
  appPlaneSynced?: boolean;
}

// ============================================
// Activity Proxy
// ============================================

const invitation = proxyActivities<typeof invitationActivities>({
  startToCloseTimeout: USER_INVITATION_CONFIG.ACTIVITY_TIMEOUTS.START_TO_CLOSE as any,
  scheduleToCloseTimeout: USER_INVITATION_CONFIG.ACTIVITY_TIMEOUTS.SCHEDULE_TO_CLOSE as any,
  retry: {
    initialInterval: USER_INVITATION_CONFIG.RETRY.initialInterval as any,
    backoffCoefficient: USER_INVITATION_CONFIG.RETRY.backoffCoefficient,
    maximumAttempts: USER_INVITATION_CONFIG.RETRY.maximumAttempts,
    maximumInterval: USER_INVITATION_CONFIG.RETRY.maximumInterval as any,
    nonRetryableErrorTypes: USER_INVITATION_CONFIG.RETRY.nonRetryableErrorTypes,
  },
});

// App Plane (Supabase) activities for syncing users
const appPlane = proxyActivities<typeof supabaseActivities>({
  startToCloseTimeout: '30 seconds',
  scheduleToCloseTimeout: '2 minutes',
  retry: {
    initialInterval: '1 second',
    backoffCoefficient: 2,
    maximumAttempts: 3,
    maximumInterval: '30 seconds',
    nonRetryableErrorTypes: ['ValidationError'],
  },
});

// ============================================
// Queries
// ============================================

export const getInvitationStatusQuery = defineQuery<InvitationWorkflowStatus>(
  'getInvitationStatus'
);

// ============================================
// Input Validation
// ============================================

function validateInput(input: UserInvitationInput): void {
  if (!input.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    throw ApplicationFailure.nonRetryable('Invalid email address', 'ValidationError');
  }
  if (!input.roleKey || typeof input.roleKey !== 'string') {
    throw ApplicationFailure.nonRetryable('roleKey is required', 'ValidationError');
  }
  if (!input.tenantId || typeof input.tenantId !== 'string') {
    throw ApplicationFailure.nonRetryable('tenantId is required', 'ValidationError');
  }
  if (!input.invitedBy || typeof input.invitedBy !== 'string') {
    throw ApplicationFailure.nonRetryable('invitedBy is required', 'ValidationError');
  }
}

// ============================================
// Main Workflow
// ============================================

export async function userInvitationWorkflow(
  input: UserInvitationInput
): Promise<UserInvitationResult> {
  const { workflowId } = workflowInfo();

  // Validate input
  validateInput(input);

  log.info('Starting user invitation workflow', {
    email: input.email,
    roleKey: input.roleKey,
    tenantId: input.tenantId,
  });

  // Workflow state
  let status: InvitationWorkflowStatus = {
    step: 'validating',
    progress: 0,
  };

  // Set up query handler
  setHandler(getInvitationStatusQuery, () => status);

  try {
    // ========================================
    // Step 1: Validate tenant and IdP config
    // ========================================
    status = {
      step: 'validating',
      progress: 20,
      message: 'Validating tenant and IdP configuration...',
    };

    log.info('Validating tenant and IdP configuration', { tenantId: input.tenantId });

    await invitation.validateTenantAndIdPConfig({
      tenantId: input.tenantId,
    });

    log.info('Validation successful');

    // ========================================
    // Step 2: Create invitation record
    // ========================================
    status = {
      step: 'creating_invitation',
      progress: 50,
      message: 'Creating invitation record...',
    };

    log.info('Creating invitation record', { email: input.email });

    const invitationRecord = await invitation.createInvitationRecord({
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      roleKey: input.roleKey,
      tenantId: input.tenantId,
      invitedBy: input.invitedBy,
      expiresInDays: input.expiresInDays || USER_INVITATION_CONFIG.DEFAULT_EXPIRES_IN_DAYS,
    });

    log.info('Invitation record created', {
      invitationId: invitationRecord.id,
      expiresAt: invitationRecord.expiresAt,
    });

    // ========================================
    // Step 3: Send invitation email via Novu
    // ========================================
    status = {
      step: 'sending_email',
      progress: 80,
      message: 'Sending invitation email...',
    };

    log.info('Sending invitation email', {
      email: input.email,
      invitationId: invitationRecord.id,
    });

    let emailResult;
    try {
      emailResult = await invitation.sendInvitationEmail({
        invitationId: invitationRecord.id,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        roleKey: input.roleKey,
        tenantId: input.tenantId,
        token: invitationRecord.token,
        expiresAt: invitationRecord.expiresAt,
      });

      log.info('Invitation email sent', {
        transactionId: emailResult.transactionId,
        success: emailResult.success,
      });
    } catch (emailError) {
      // Compensation: Delete invitation record if email fails
      log.error('Email sending failed, rolling back invitation record', {
        invitationId: invitationRecord.id,
        error: emailError instanceof Error ? emailError.message : 'Unknown error',
      });

      try {
        await invitation.deleteInvitationRecord({
          invitationId: invitationRecord.id,
        });
        log.info('Invitation record deleted successfully (compensation)', {
          invitationId: invitationRecord.id,
        });
      } catch (deleteError) {
        log.error('Failed to delete invitation record during compensation', {
          invitationId: invitationRecord.id,
          error: deleteError instanceof Error ? deleteError.message : 'Unknown error',
        });
        // Continue to throw original email error even if compensation fails
      }

      // Re-throw the original email error
      throw emailError;
    }

    // ========================================
    // Step 4: Sync user to App Plane (Supabase)
    // ========================================
    let appPlaneSynced = false;
    let appPlaneUserId: string | undefined;

    // Only sync to App Plane if explicitly enabled (default: true)
    const shouldSyncToAppPlane = input.syncToAppPlane !== false;

    if (shouldSyncToAppPlane) {
      status = {
        step: 'syncing_app_plane',
        progress: 90,
        message: 'Syncing user to App Plane...',
        emailSent: emailResult.success,
      };

      log.info('Syncing invited user to App Plane', {
        email: input.email,
        tenantId: input.tenantId,
        role: input.roleKey,
      });

      try {
        const appPlaneResult = await appPlane.createAppPlaneUser({
          tenantId: input.tenantId,
          tenantKey: input.tenantKey || input.tenantId, // Use tenantId as fallback
          userEmail: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          role: input.roleKey,
          invitedBy: input.invitedBy,
        });

        appPlaneSynced = appPlaneResult.created;
        appPlaneUserId = appPlaneResult.userId;

        log.info('User synced to App Plane successfully', {
          userId: appPlaneResult.userId,
          email: input.email,
        });
      } catch (appPlaneError) {
        // App Plane sync failure is non-critical - log but continue
        // The user can still be synced later via the sync-user-role workflow
        log.warn('Failed to sync user to App Plane (non-fatal)', {
          email: input.email,
          tenantId: input.tenantId,
          error: appPlaneError instanceof Error ? appPlaneError.message : 'Unknown error',
        });
        // Don't throw - invitation was successful, App Plane sync can be retried
      }
    }

    // ========================================
    // Complete!
    // ========================================
    status = {
      step: 'completed',
      progress: 100,
      message: 'Invitation sent successfully',
      emailSent: emailResult.success,
      appPlaneSynced,
    };

    log.info('User invitation workflow completed successfully', {
      invitationId: invitationRecord.id,
      email: input.email,
      appPlaneSynced,
      appPlaneUserId,
    });

    return {
      success: true,
      invitationId: invitationRecord.id,
      token: invitationRecord.token,
      expiresAt: invitationRecord.expiresAt,
      emailSent: emailResult.success,
      appPlaneSynced,
      appPlaneUserId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    status = {
      step: 'failed',
      progress: 0,
      message: `Failed: ${errorMessage}`,
    };

    log.error('User invitation workflow failed', {
      email: input.email,
      tenantId: input.tenantId,
      error: errorMessage,
    });

    // Re-throw the error so Temporal marks the workflow as FAILED
    // This ensures proper visibility in the Temporal UI
    throw error;
  }
}
