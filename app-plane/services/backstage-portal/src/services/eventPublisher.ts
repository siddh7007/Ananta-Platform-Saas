/**
 * Event Publisher Service for Backstage Portal
 *
 * Publishes authentication and admin events to RabbitMQ via CNS API endpoint.
 */

import { getCnsBaseUrl } from './cnsConfig';

const CNS_API_URL = getCnsBaseUrl();

interface EventPayload {
  routing_key: string;
  event_type: string;
  data: Record<string, any>;
  priority?: number;
}

/**
 * Publish event to RabbitMQ via CNS backend
 * Non-blocking - logs errors but doesn't throw
 */
const publishEvent = async (payload: EventPayload): Promise<boolean> => {
  try {
    const response = await fetch(`${CNS_API_URL}/api/events/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.warn('[EventPublisher] Failed to publish event:', payload.routing_key, response.statusText);
      return false;
    }

    if (import.meta.env.DEV) {
      console.log('[EventPublisher] Published:', payload.routing_key);
    }

    return true;
  } catch (error) {
    console.error('[EventPublisher] Error publishing event:', error);
    return false;
  }
};

/**
 * Generic event publisher for custom events
 */
export const publishCustomEvent = async (
  routingKey: string,
  eventType: string,
  data: Record<string, any>,
  priority: number = 3
): Promise<boolean> => {
  return publishEvent({
    routing_key: routingKey,
    event_type: eventType,
    data,
    priority,
  });
};

/**
 * Event Priority Levels:
 * 1-2: Low (analytics, non-critical tracking)
 * 3-5: Normal (CRUD operations, user actions)
 * 6-8: High (security events, data deletion, admin actions)
 * 9-10: Critical (system failures, security alerts)
 */
