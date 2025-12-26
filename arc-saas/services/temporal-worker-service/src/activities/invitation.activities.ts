/**
 * User Invitation Activities
 *
 * Temporal activities for the user invitation workflow.
 * These activities call the tenant-management-service APIs to:
 * - Validate tenant and IdP configuration
 * - Create invitation records
 * - Send invitation emails via Novu
 */

import axios from 'axios';
import { ApplicationFailure } from '@temporalio/activity';
import { config } from '../config';
import { createLogger } from '../utils/logger';

const logger = createLogger('invitation-activities');

// ============================================
// Types
// ============================================

export interface ValidateTenantAndIdPInput {
  tenantId: string;
}

export interface CreateInvitationInput {
  email: string;
  firstName?: string;
  lastName?: string;
  roleKey: string;
  tenantId: string;
  invitedBy: string;
  expiresInDays: number;
}

export interface InvitationRecord {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roleKey: string;
  tenantId: string;
  invitedBy: string;
  token: string;
  expiresAt: string;
  status: string;
}

export interface SendInvitationEmailInput {
  invitationId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roleKey: string;
  tenantId: string;
  token: string;
  expiresAt: string;
}

export interface EmailSendResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

// ============================================
// Helper Functions
// ============================================

function getTenantManagementServiceUrl(): string {
  return config.services?.tenantManagement?.url || 'http://localhost:4300';
}

/**
 * Create axios error with ApplicationFailure for better Temporal UI display
 */
function handleAxiosError(error: unknown, operation: string): never {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message;
    const errorType = error.response?.data?.error?.name || 'ServiceError';

    logger.error(`${operation} failed`, {
      status,
      message,
      errorType,
    });

    // Map HTTP status to Temporal error types
    if (status === 404) {
      throw ApplicationFailure.nonRetryable(
        message,
        'TenantNotFoundError'
      );
    } else if (status === 412 || status === 400) {
      throw ApplicationFailure.nonRetryable(
        message,
        errorType === 'PreconditionFailed' ? 'IdPConfigNotFoundError' : 'ValidationError'
      );
    } else if (status === 401 || status === 403) {
      throw ApplicationFailure.nonRetryable(
        message,
        'AuthorizationError'
      );
    } else {
      // Retryable server errors
      throw ApplicationFailure.retryable(message);
    }
  }

  // Unknown error
  const message = error instanceof Error ? error.message : 'Unknown error';
  logger.error(`${operation} failed with unknown error`, { error: message });
  throw ApplicationFailure.retryable(message);
}

// ============================================
// Activities
// ============================================

/**
 * Validate tenant exists, is active, and has IdP configuration
 */
export async function validateTenantAndIdPConfig(
  input: ValidateTenantAndIdPInput
): Promise<{ valid: true }> {
  const baseUrl = getTenantManagementServiceUrl();

  try {
    logger.info('Validating tenant and IdP configuration', {
      tenantId: input.tenantId,
    });

    // Call tenant-management-service API to validate
    // This endpoint will check:
    // 1. Tenant exists
    // 2. Tenant status is ACTIVE
    // 3. IdP configuration exists
    // 4. IdP-specific config is valid (realm_name for Keycloak, connection for Auth0)
    const response = await axios.get(
      `${baseUrl}/tenants/${input.tenantId}/idp-config/validate`,
      {
        timeout: 10000,
      }
    );

    logger.info('Tenant and IdP configuration valid', {
      tenantId: input.tenantId,
      identityProvider: response.data.identityProvider,
    });

    return { valid: true };
  } catch (error) {
    handleAxiosError(error, 'validateTenantAndIdPConfig');
  }
}

/**
 * Create invitation record with secure token and expiration
 */
export async function createInvitationRecord(
  input: CreateInvitationInput
): Promise<InvitationRecord> {
  const baseUrl = getTenantManagementServiceUrl();

  try {
    logger.info('Creating invitation record', {
      email: input.email,
      roleKey: input.roleKey,
      tenantId: input.tenantId,
    });

    // Call tenant-management-service API to create invitation
    const response = await axios.post<InvitationRecord>(
      `${baseUrl}/user-invitations`,
      {
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        roleKey: input.roleKey,
        tenantId: input.tenantId,
        invitedBy: input.invitedBy,
        expiresInDays: input.expiresInDays,
      },
      {
        timeout: 10000,
      }
    );

    logger.info('Invitation record created', {
      invitationId: response.data.id,
      expiresAt: response.data.expiresAt,
    });

    return response.data;
  } catch (error) {
    handleAxiosError(error, 'createInvitationRecord');
  }
}

/**
 * Send invitation email via Novu
 */
export async function sendInvitationEmail(
  input: SendInvitationEmailInput
): Promise<EmailSendResult> {
  const baseUrl = getTenantManagementServiceUrl();

  try {
    logger.info('Sending invitation email', {
      invitationId: input.invitationId,
      email: input.email,
    });

    // Call tenant-management-service API to send invitation email
    const response = await axios.post<EmailSendResult>(
      `${baseUrl}/user-invitations/${input.invitationId}/send-email`,
      {
        token: input.token,
        expiresAt: input.expiresAt,
      },
      {
        timeout: 15000, // Novu might take a bit longer
      }
    );

    logger.info('Invitation email sent', {
      invitationId: input.invitationId,
      transactionId: response.data.transactionId,
      success: response.data.success,
    });

    return response.data;
  } catch (error) {
    // Email sending failures should not fail the entire workflow
    // Log the error and return failure status
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.message || error.message;
      logger.error('Failed to send invitation email', {
        invitationId: input.invitationId,
        error: message,
      });

      return {
        success: false,
        error: message,
      };
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to send invitation email', {
      invitationId: input.invitationId,
      error: message,
    });

    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Resend invitation email for an existing invitation
 */
export async function resendInvitationEmail(
  invitationId: string
): Promise<EmailSendResult> {
  const baseUrl = getTenantManagementServiceUrl();

  try {
    logger.info('Resending invitation email', { invitationId });

    const response = await axios.post<EmailSendResult>(
      `${baseUrl}/user-invitations/${invitationId}/resend`,
      {},
      {
        timeout: 15000,
      }
    );

    logger.info('Invitation email resent', {
      invitationId,
      transactionId: response.data.transactionId,
      success: response.data.success,
    });

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.message || error.message;
      logger.error('Failed to resend invitation email', {
        invitationId,
        error: message,
      });

      return {
        success: false,
        error: message,
      };
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to resend invitation email', {
      invitationId,
      error: message,
    });

    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Delete an invitation record (compensation/rollback).
 * Used when email sending fails to clean up orphaned invitation records.
 *
 * @param input - Invitation ID to delete
 */
export async function deleteInvitationRecord(input: {
  invitationId: string;
}): Promise<void> {
  logger.info('Deleting invitation record (compensation)', {
    invitationId: input.invitationId,
  });

  try {
    const baseUrl = getTenantManagementServiceUrl();
    const response = await axios.delete(
      `${baseUrl}/user-invitations/${input.invitationId}`,
    );

    logger.info('Invitation record deleted successfully (compensation)', {
      invitationId: input.invitationId,
      status: response.status,
    });
  } catch (error) {
    handleAxiosError(error, 'Delete invitation record');
  }
}
