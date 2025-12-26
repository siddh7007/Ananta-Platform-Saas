/**
 * App Plane Webhook Activities
 *
 * Activities for notifying the App Plane of Control Plane events.
 * Uses signed webhooks for secure communication.
 */

import crypto from 'crypto';
import { ApplicationFailure } from '@temporalio/activity';
import { createLogger } from '../utils/logger';

const logger = createLogger('app-plane-webhook-activities');

// Configuration from environment
const APP_PLANE_WEBHOOK_URL = process.env.APP_PLANE_WEBHOOK_URL || 'http://webhook-bridge:27600';
const APP_PLANE_WEBHOOK_SECRET = process.env.APP_PLANE_WEBHOOK_SECRET || 'your-webhook-secret';
const WEBHOOK_TIMEOUT_MS = 30000;

/**
 * Generate HMAC signature for webhook payload
 */
function generateSignature(payload: string, secret: string): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Input types for webhook activities
 */
export interface TenantProvisionedWebhookInput {
  tenantId: string;
  tenantKey: string;
  tenantName: string;
  planId?: string;
  adminUser: {
    email: string;
    firstName: string;
    lastName: string;
    keycloakUserId?: string;  // If Keycloak user was created during provisioning
  };
  limits: {
    maxUsers?: number;
    maxComponents?: number;
    maxStorageGb?: number;
  };
  keycloakRealm?: string;  // If per-tenant Keycloak realm was created
  // Added for callback confirmation
  workflowId?: string;       // Temporal workflow ID for callback signal
  temporalNamespace?: string; // Temporal namespace (default: arc-saas)
}

export interface SubscriptionChangedWebhookInput {
  tenantId: string;
  tenantKey: string;
  oldPlanId?: string;
  newPlanId: string;
  newLimits: {
    maxUsers?: number;
    maxComponents?: number;
    maxStorageGb?: number;
  };
}

export interface UserInvitedWebhookInput {
  tenantId: string;
  tenantKey: string;
  userEmail: string;
  role: string;
  invitedBy?: string;
}

export interface TenantDeprovisionedWebhookInput {
  tenantId: string;
  tenantKey: string;
  reason?: string;
  hardDelete?: boolean;  // If true, permanently delete; otherwise soft-delete
}

export interface KeycloakRealmCreatedWebhookInput {
  tenantId: string;
  tenantKey: string;
  realmName: string;
  realmUrl: string;
}

export interface WebhookResult {
  success: boolean;
  statusCode?: number;
  response?: unknown;
  error?: string;
}

/**
 * Send webhook to App Plane with retry and signature verification
 */
async function sendWebhook(
  endpoint: string,
  eventType: string,
  payload: unknown
): Promise<WebhookResult> {
  const url = `${APP_PLANE_WEBHOOK_URL}${endpoint}`;
  const body = JSON.stringify(payload);
  const signature = generateSignature(body, APP_PLANE_WEBHOOK_SECRET);

  logger.info(`Sending ${eventType} webhook to App Plane`, { url, tenantId: (payload as { tenantId?: string }).tenantId });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': eventType,
        'X-Webhook-Timestamp': new Date().toISOString(),
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseData = await response.json().catch(() => null);

    if (!response.ok) {
      logger.error(`Webhook failed with status ${response.status}`, {
        url,
        statusCode: response.status,
        response: responseData,
      });

      // Retry on 5xx errors, fail permanently on 4xx
      if (response.status >= 500) {
        throw new Error(`Webhook failed with status ${response.status}: ${JSON.stringify(responseData)}`);
      } else {
        throw ApplicationFailure.nonRetryable(
          `Webhook rejected by App Plane: ${response.status} - ${JSON.stringify(responseData)}`,
          'WebhookRejectedError'
        );
      }
    }

    logger.info(`Webhook ${eventType} sent successfully`, {
      url,
      statusCode: response.status,
      response: responseData,
    });

    return {
      success: true,
      statusCode: response.status,
      response: responseData,
    };
  } catch (error) {
    if (error instanceof ApplicationFailure) {
      throw error;
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Webhook ${eventType} failed`, { url, error: errorMessage });

    // Network errors are retryable
    throw new Error(`Failed to send webhook: ${errorMessage}`);
  }
}

/**
 * Notify App Plane that a tenant has been provisioned
 *
 * This is called at the end of successful tenant provisioning to bootstrap
 * the tenant's resources in the App Plane (organization, admin user, etc.)
 */
export async function notifyTenantProvisioned(
  input: TenantProvisionedWebhookInput
): Promise<WebhookResult> {
  logger.info('Notifying App Plane of tenant provisioning', {
    tenantId: input.tenantId,
    tenantKey: input.tenantKey,
  });

  return sendWebhook('/webhooks/tenant-provisioned', 'tenant.provisioned', input);
}

/**
 * Notify App Plane that a subscription has changed
 *
 * This is called when a tenant upgrades/downgrades their plan to update
 * limits and features in the App Plane.
 */
export async function notifySubscriptionChanged(
  input: SubscriptionChangedWebhookInput
): Promise<WebhookResult> {
  logger.info('Notifying App Plane of subscription change', {
    tenantId: input.tenantId,
    oldPlanId: input.oldPlanId,
    newPlanId: input.newPlanId,
  });

  return sendWebhook('/webhooks/subscription-changed', 'subscription.changed', input);
}

/**
 * Notify App Plane that a user has been invited
 *
 * This is called when a user invitation is created in the Control Plane
 * to create corresponding user in the App Plane.
 */
export async function notifyUserInvited(
  input: UserInvitedWebhookInput
): Promise<WebhookResult> {
  logger.info('Notifying App Plane of user invitation', {
    tenantId: input.tenantId,
    userEmail: input.userEmail,
    role: input.role,
  });

  return sendWebhook('/webhooks/user-invited', 'user.invited', input);
}

/**
 * Notify App Plane that a tenant has been deprovisioned
 *
 * This is called when a tenant is being removed to clean up
 * their resources in the App Plane.
 */
export async function notifyTenantDeprovisioned(
  input: TenantDeprovisionedWebhookInput
): Promise<WebhookResult> {
  logger.info('Notifying App Plane of tenant deprovisioning', {
    tenantId: input.tenantId,
    tenantKey: input.tenantKey,
    reason: input.reason,
    hardDelete: input.hardDelete,
  });

  return sendWebhook('/webhooks/tenant-deprovisioned', 'tenant.deprovisioned', input);
}

/**
 * Notify App Plane that a Keycloak realm was created for a tenant
 *
 * This is called when a per-tenant Keycloak realm is created to enable
 * SSO in the App Plane.
 */
export async function notifyKeycloakRealmCreated(
  input: KeycloakRealmCreatedWebhookInput
): Promise<WebhookResult> {
  logger.info('Notifying App Plane of Keycloak realm creation', {
    tenantId: input.tenantId,
    tenantKey: input.tenantKey,
    realmName: input.realmName,
  });

  return sendWebhook('/webhooks/keycloak-realm-created', 'keycloak.realm.created', input);
}
