/**
 * User Provisioning Workflow
 *
 * This workflow handles the complete user provisioning process when a customer signs up.
 * It follows a saga pattern with compensation for rollback on failure.
 *
 * Steps:
 * 1. Create user in Keycloak (within tenant's realm)
 * 2. Create user profile in the database
 * 3. Send welcome notification via Novu
 *
 * On failure, compensation activities run in reverse order to clean up.
 */

import {
  proxyActivities,
  defineSignal,
  defineQuery,
  setHandler,
  ApplicationFailure,
} from '@temporalio/workflow';

import type {
  CreateUserInput,
  CreateUserResult,
  CreateUserProfileInput,
  SendUserWelcomeInput,
} from '../activities/user.activities';

// ============================================
// Activity Proxies
// ============================================

const userActivities = proxyActivities<{
  createKeycloakUser: (input: CreateUserInput) => Promise<CreateUserResult>;
  createUserProfile: (input: CreateUserProfileInput) => Promise<void>;
  sendUserWelcomeNotification: (input: SendUserWelcomeInput) => Promise<void>;
  deleteKeycloakUser: (tenantKey: string, userId: string) => Promise<void>;
  deleteUserProfile: (tenantId: string, userId: string) => Promise<void>;
}>({
  startToCloseTimeout: '2 minutes',
  retry: {
    maximumAttempts: 3,
    initialInterval: '1 second',
    backoffCoefficient: 2,
    maximumInterval: '30 seconds',
  },
});

// ============================================
// Workflow Input/Output Types
// ============================================

export interface ProvisionUserInput {
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
}

export interface ProvisionUserResult {
  userId: string;
  email: string;
  keycloakUserId?: string;
  status: 'completed' | 'failed' | 'cancelled';
  completedAt: string;
  error?: string;
}

export interface UserProvisioningStatus {
  currentStep: string;
  completedSteps: string[];
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  error?: string;
  userId?: string;
}

// ============================================
// Signals and Queries
// ============================================

export const userProvisioningCancelledSignal = defineSignal('userProvisioningCancelled');
export const getUserProvisioningStatusQuery = defineQuery<UserProvisioningStatus>('getUserProvisioningStatus');

// ============================================
// Workflow Implementation
// ============================================

export async function provisionUserWorkflow(
  input: ProvisionUserInput
): Promise<ProvisionUserResult> {
  // Workflow state
  let isCancelled = false;
  let currentStep = 'initializing';
  let status: UserProvisioningStatus['status'] = 'running';
  let error: string | undefined;
  let userId: string | undefined;

  const completedSteps: string[] = [];
  const compensationStack: Array<() => Promise<void>> = [];

  // Set up signal handler for cancellation
  setHandler(userProvisioningCancelledSignal, () => {
    isCancelled = true;
  });

  // Set up query handler for status
  setHandler(getUserProvisioningStatusQuery, () => ({
    currentStep,
    completedSteps,
    status,
    error,
    userId,
  }));

  // Helper to check cancellation
  const checkCancellation = async () => {
    if (isCancelled) {
      throw ApplicationFailure.nonRetryable('User provisioning was cancelled');
    }
  };

  try {
    // ========================================
    // Step 1: Create User in Keycloak
    // ========================================
    await checkCancellation();
    currentStep = 'creating_keycloak_user';

    const userResult = await userActivities.createKeycloakUser({
      tenantId: input.tenantId,
      tenantKey: input.tenantKey,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      password: input.password,
      role: input.role || 'user',
      metadata: input.metadata,
    });

    userId = userResult.userId;
    completedSteps.push('keycloak_user_created');

    // Add compensation for rollback
    compensationStack.push(async () => {
      await userActivities.deleteKeycloakUser(input.tenantKey, userId!);
    });

    // ========================================
    // Step 2: Create User Profile in Database
    // ========================================
    await checkCancellation();
    currentStep = 'creating_user_profile';

    await userActivities.createUserProfile({
      tenantId: input.tenantId,
      userId: userId,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role || 'user',
      metadata: input.metadata,
    });

    completedSteps.push('user_profile_created');

    // Add compensation for rollback
    compensationStack.push(async () => {
      await userActivities.deleteUserProfile(input.tenantId, userId!);
    });

    // ========================================
    // Step 3: Send Welcome Notification
    // ========================================
    await checkCancellation();
    currentStep = 'sending_welcome_notification';

    const loginUrl = input.loginUrl || `${input.appUrl}/login`;

    await userActivities.sendUserWelcomeNotification({
      tenantId: input.tenantId,
      tenantKey: input.tenantKey,
      tenantName: input.tenantName,
      userId: userId,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      loginUrl: loginUrl,
      appUrl: input.appUrl,
    });

    completedSteps.push('welcome_notification_sent');

    // ========================================
    // Complete
    // ========================================
    currentStep = 'completed';
    status = 'completed';

    return {
      userId: userId,
      email: input.email,
      keycloakUserId: userResult.keycloakUserId,
      status: 'completed',
      completedAt: new Date().toISOString(),
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    error = errorMessage;

    // Check if this was a cancellation
    if (isCancelled) {
      status = 'cancelled';
      currentStep = 'compensating';

      // Run compensation in reverse order
      for (const compensate of compensationStack.reverse()) {
        try {
          await compensate();
        } catch (compError) {
          // Log but continue with other compensations
          console.error('Compensation failed:', compError);
        }
      }

      return {
        userId: userId || '',
        email: input.email,
        status: 'cancelled',
        completedAt: new Date().toISOString(),
        error: 'User provisioning was cancelled',
      };
    }

    // Regular failure - run compensation
    status = 'failed';
    currentStep = 'compensating';

    for (const compensate of compensationStack.reverse()) {
      try {
        await compensate();
      } catch (compError) {
        console.error('Compensation failed:', compError);
      }
    }

    return {
      userId: userId || '',
      email: input.email,
      status: 'failed',
      completedAt: new Date().toISOString(),
      error: errorMessage,
    };
  }
}
