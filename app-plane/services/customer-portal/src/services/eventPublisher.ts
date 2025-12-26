/**
 * Event Publisher Service
 *
 * Publishes events to RabbitMQ via backend API endpoint.
 * Events are used for:
 * - WebSocket notifications
 * - Audit logging
 * - Analytics
 * - Workflow triggers
 *
 * Events are "fire-and-forget" - failures don't block operations
 */

import { getCnsBaseUrl } from './cnsApi';

const CNS_API_URL = getCnsBaseUrl();

/**
 * Get auth headers for CNS API calls
 */
function getAuthHeaders(): HeadersInit {
  const auth0Token = localStorage.getItem('auth0_access_token');
  if (auth0Token) {
    return { 'Authorization': `Bearer ${auth0Token}` };
  }
  return {};
}

interface EventPayload {
  routing_key: string;
  event_type: string;
  data: Record<string, any>;
  priority?: number;
}

/**
 * Retry configuration based on event priority
 */
const getRetryConfig = (priority: number) => {
  if (priority >= 8) {
    return { maxRetries: 5, initialDelay: 100 };
  } else if (priority >= 5) {
    return { maxRetries: 3, initialDelay: 200 };
  } else {
    return { maxRetries: 2, initialDelay: 500 };
  }
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Publish event to RabbitMQ via backend with exponential backoff retry
 */
const publishEvent = async (payload: EventPayload): Promise<boolean> => {
  const priority = payload.priority || 3;
  const { maxRetries, initialDelay } = getRetryConfig(priority);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`${CNS_API_URL}/api/events/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        if (response.status >= 400 && response.status < 500) {
          console.warn('[EventPublisher] Client error, not retrying:', payload.routing_key, response.statusText);
          return false;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (import.meta.env.DEV) {
        const retryMsg = attempt > 0 ? ` (after ${attempt} retries)` : '';
        console.log(`[EventPublisher] Published: ${payload.routing_key}${retryMsg}`);
      }
      return true;

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === maxRetries) {
        console.error(`[EventPublisher] Failed after ${maxRetries} retries:`, payload.routing_key, lastError.message);
        return false;
      }
      const delay = initialDelay * Math.pow(2, attempt);
      console.warn(`[EventPublisher] Attempt ${attempt + 1}/${maxRetries + 1} failed, retrying in ${delay}ms...`, lastError.message);
      await sleep(delay);
    }
  }
  return false;
};

export const Events = {
  BOM: {
    uploaded: async (bomId: string, tenantId: string, userId: string, filename: string, totalItems: number) => {
      return publishEvent({
        routing_key: 'customer.bom.uploaded',
        event_type: 'bom_uploaded',
        data: { bom_id: bomId, organization_id: tenantId, user_id: userId, filename, total_items: totalItems },
        priority: 7,
      });
    },
    edited: async (bomId: string, tenantId: string, userId: string, changes: Record<string, any>) => {
      return publishEvent({
        routing_key: 'customer.bom.edited',
        event_type: 'bom_edited',
        data: { bom_id: bomId, organization_id: tenantId, user_id: userId, changes },
        priority: 3,
      });
    },
    deleted: async (bomId: string, tenantId: string, userId: string, bomName?: string) => {
      return publishEvent({
        routing_key: 'customer.bom.deleted',
        event_type: 'bom_deleted',
        data: { bom_id: bomId, organization_id: tenantId, user_id: userId, bom_name: bomName },
        priority: 4,
      });
    },
    validated: async (bomId: string, tenantId: string, grade: string, issues: number) => {
      return publishEvent({
        routing_key: 'customer.bom.validated',
        event_type: 'bom_validated',
        data: { bom_id: bomId, organization_id: tenantId, grade, issues },
        priority: 3,
      });
    },
  },
  Project: {
    created: async (projectId: string, tenantId: string, userId: string, projectName: string) => {
      return publishEvent({
        routing_key: 'customer.project.created',
        event_type: 'project_created',
        data: { project_id: projectId, organization_id: tenantId, user_id: userId, project_name: projectName },
        priority: 4,
      });
    },
    edited: async (projectId: string, tenantId: string, userId: string, changes: Record<string, any>) => {
      return publishEvent({
        routing_key: 'customer.project.edited',
        event_type: 'project_edited',
        data: { project_id: projectId, organization_id: tenantId, user_id: userId, changes },
        priority: 3,
      });
    },
    deleted: async (projectId: string, tenantId: string, userId: string, projectName?: string, bomCount?: number) => {
      return publishEvent({
        routing_key: 'customer.project.deleted',
        event_type: 'project_deleted',
        data: { project_id: projectId, organization_id: tenantId, user_id: userId, project_name: projectName, bom_count: bomCount },
        priority: 5,
      });
    },
  },
  Organization: {
    deleted: async (orgId: string, userId: string, orgName?: string) => {
      return publishEvent({
        routing_key: 'customer.organization.deleted',
        event_type: 'organization_deleted',
        data: { organization_id: orgId, user_id: userId, organization_name: orgName },
        priority: 8,
      });
    },
    memberAdded: async (orgId: string, userId: string, newMemberId: string, role: string) => {
      return publishEvent({
        routing_key: 'customer.organization.member_added',
        event_type: 'organization_member_added',
        data: { organization_id: orgId, user_id: userId, new_member_id: newMemberId, role },
        priority: 4,
      });
    },
    memberRemoved: async (orgId: string, userId: string, removedMemberId: string) => {
      return publishEvent({
        routing_key: 'customer.organization.member_removed',
        event_type: 'organization_member_removed',
        data: { organization_id: orgId, user_id: userId, removed_member_id: removedMemberId },
        priority: 5,
      });
    },
  },
  User: {
    deleted: async (deletedUserId: string, tenantId: string, adminId: string) => {
      return publishEvent({
        routing_key: 'customer.user.deleted',
        event_type: 'user_deleted',
        data: { deleted_user_id: deletedUserId, organization_id: tenantId, admin_id: adminId },
        priority: 6,
      });
    },
  },
};

export const publishCustomEvent = async (
  routingKey: string,
  eventType: string,
  data: Record<string, any>,
  priority: number = 3
): Promise<boolean> => {
  return publishEvent({ routing_key: routingKey, event_type: eventType, data, priority });
};
