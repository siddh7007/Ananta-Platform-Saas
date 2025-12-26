/**
 * Enrichment Stream Service
 *
 * Centralized SSE connection management for BOM enrichment progress.
 * Features:
 * - Single EventSource per BOM to prevent duplicate connections
 * - Exponential backoff reconnection strategy
 * - Connection health monitoring
 * - Automatic cleanup on errors/completion
 * - Multi-subscriber support (multiple components can listen to same BOM)
 */

import type { EnrichmentEvent } from '../hooks/useEnrichmentStream';

export interface StreamOptions {
  bomId: string;
  onConnected?: () => void;
  onMessage: (event: EnrichmentEvent) => void;
  onError?: (error: Error) => void;
  /** Max reconnection attempts before giving up (default: 5) */
  maxReconnectAttempts?: number;
  /** Initial reconnect delay in ms (default: 1000) */
  reconnectInterval?: number;
  /** Max reconnect delay in ms (default: 30000) */
  maxReconnectInterval?: number;
}

export interface StreamConnection {
  bomId: string;
  eventSource: EventSource;
  subscribers: Set<StreamOptions>;
  reconnectAttempts: number;
  reconnectTimer: NodeJS.Timeout | null;
  lastEventTime: number;
  status: 'connecting' | 'connected' | 'reconnecting' | 'closed' | 'error';
}

// Global connection registry (one EventSource per BOM)
const connections = new Map<string, StreamConnection>();

/**
 * Create or attach to existing SSE stream for a BOM
 */
export function createEnrichmentStream(
  url: string,
  options: StreamOptions
): StreamConnection {
  const { bomId, onConnected, onMessage, onError } = options;
  const maxReconnectAttempts = options.maxReconnectAttempts ?? 5;
  const initialReconnectInterval = options.reconnectInterval ?? 1000;
  const maxReconnectInterval = options.maxReconnectInterval ?? 30000;

  // Check if connection already exists
  let connection = connections.get(bomId);

  if (connection) {
    console.log('[StreamService] Reusing existing connection for BOM:', bomId);
    connection.subscribers.add(options);

    // If already connected, immediately call onConnected
    if (connection.status === 'connected') {
      onConnected?.();
    }

    return connection;
  }

  console.log('[StreamService] Creating new EventSource for BOM:', bomId);

  // Create new EventSource
  const eventSource = new EventSource(url);

  // Create connection object
  connection = {
    bomId,
    eventSource,
    subscribers: new Set([options]),
    reconnectAttempts: 0,
    reconnectTimer: null,
    lastEventTime: Date.now(),
    status: 'connecting',
  };

  connections.set(bomId, connection);

  /**
   * Calculate exponential backoff delay
   */
  const getReconnectDelay = (attempt: number): number => {
    const delay = Math.min(
      initialReconnectInterval * Math.pow(2, attempt),
      maxReconnectInterval
    );
    // Add jitter (±20%)
    const jitter = delay * 0.2 * (Math.random() - 0.5);
    return Math.floor(delay + jitter);
  };

  /**
   * Attempt reconnection
   */
  const reconnect = () => {
    const conn = connections.get(bomId);
    if (!conn) return;

    if (conn.reconnectAttempts >= maxReconnectAttempts) {
      console.error('[StreamService] Max reconnect attempts reached for BOM:', bomId);
      const error = new Error(`Failed to connect after ${maxReconnectAttempts} attempts`);
      conn.status = 'error';

      // Notify all subscribers
      conn.subscribers.forEach(sub => sub.onError?.(error));

      // Clean up connection
      closeEnrichmentStream(conn);
      return;
    }

    conn.reconnectAttempts++;
    const delay = getReconnectDelay(conn.reconnectAttempts - 1);

    console.log(`[StreamService] Reconnecting in ${delay}ms (attempt ${conn.reconnectAttempts}/${maxReconnectAttempts})`);
    conn.status = 'reconnecting';

    conn.reconnectTimer = setTimeout(() => {
      console.log('[StreamService] Creating new connection...');
      const newConnection = createEnrichmentStream(url, options);

      // Migrate subscribers from old connection
      conn.subscribers.forEach(sub => {
        if (sub !== options) {
          newConnection.subscribers.add(sub);
        }
      });
    }, delay);
  };

  // EventSource event handlers
  eventSource.addEventListener('open', () => {
    console.log('[StreamService] SSE connection opened for BOM:', bomId);
    const conn = connections.get(bomId);
    if (conn) {
      conn.status = 'connected';
      conn.reconnectAttempts = 0;
      conn.lastEventTime = Date.now();

      // Notify all subscribers
      conn.subscribers.forEach(sub => sub.onConnected?.());
    }
  });

  eventSource.addEventListener('message', (e: MessageEvent) => {
    const conn = connections.get(bomId);
    if (!conn) return;

    conn.lastEventTime = Date.now();

    try {
      const event: EnrichmentEvent = JSON.parse(e.data);
      console.log('[StreamService] Message received:', event.event_type);

      // Notify all subscribers
      conn.subscribers.forEach(sub => sub.onMessage(event));

      // Auto-close on completion/failure
      if (event.event_type === 'enrichment.completed' || event.event_type === 'enrichment.error') {
        console.log('[StreamService] Enrichment finished, closing connection');
        setTimeout(() => closeEnrichmentStream(conn), 1000); // Small delay for final events
      }
    } catch (err) {
      console.error('[StreamService] Failed to parse event:', err);
    }
  });

  eventSource.addEventListener('error', (e: Event) => {
    console.error('[StreamService] SSE error for BOM:', bomId, e);
    const conn = connections.get(bomId);
    if (!conn) return;

    const error = new Error('SSE connection error');
    conn.status = 'error';

    // Notify subscribers
    conn.subscribers.forEach(sub => sub.onError?.(error));

    // Attempt reconnection if EventSource is still open
    if (eventSource.readyState === EventSource.CONNECTING) {
      console.log('[StreamService] Connection lost, will attempt reconnect');
      reconnect();
    } else if (eventSource.readyState === EventSource.CLOSED) {
      console.log('[StreamService] Connection closed by server');
      closeEnrichmentStream(conn);
    }
  });

  // Custom event types from CNS API
  eventSource.addEventListener('connected', () => {
    console.log('[StreamService] Received connected event');
  });

  eventSource.addEventListener('enrichment.started', (e: any) => {
    console.log('[StreamService] Enrichment started event');
    handleCustomEvent(e, bomId);
  });

  eventSource.addEventListener('enrichment.progress', (e: any) => {
    handleCustomEvent(e, bomId);
  });

  eventSource.addEventListener('enrichment.component.completed', (e: any) => {
    handleCustomEvent(e, bomId);
  });

  eventSource.addEventListener('enrichment.component.failed', (e: any) => {
    handleCustomEvent(e, bomId);
  });

  eventSource.addEventListener('enrichment.completed', (e: any) => {
    console.log('[StreamService] Enrichment completed event');
    handleCustomEvent(e, bomId);
  });

  eventSource.addEventListener('enrichment.error', (e: any) => {
    console.error('[StreamService] Enrichment error event');
    handleCustomEvent(e, bomId);
  });

  return connection;
}

/**
 * Handle custom SSE event types
 */
function handleCustomEvent(e: MessageEvent, bomId: string) {
  const conn = connections.get(bomId);
  if (!conn) return;

  conn.lastEventTime = Date.now();

  try {
    const event: EnrichmentEvent = JSON.parse(e.data);
    conn.subscribers.forEach(sub => sub.onMessage(event));
  } catch (err) {
    console.error('[StreamService] Failed to parse custom event:', err);
  }
}

/**
 * Close and cleanup an enrichment stream
 */
export function closeEnrichmentStream(connection: StreamConnection): void {
  const { bomId, eventSource, reconnectTimer } = connection;

  console.log('[StreamService] Closing connection for BOM:', bomId);

  // Clear reconnect timer
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    connection.reconnectTimer = null;
  }

  // Close EventSource
  try {
    eventSource.close();
  } catch (err) {
    console.error('[StreamService] Error closing EventSource:', err);
  }

  // Update status
  connection.status = 'closed';

  // Remove from registry
  connections.delete(bomId);
}

/**
 * Unsubscribe a specific subscriber from a stream
 */
export function unsubscribeFromStream(bomId: string, options: StreamOptions): void {
  const connection = connections.get(bomId);
  if (!connection) return;

  connection.subscribers.delete(options);

  // If no more subscribers, close the connection
  if (connection.subscribers.size === 0) {
    console.log('[StreamService] No more subscribers, closing connection for BOM:', bomId);
    closeEnrichmentStream(connection);
  }
}

/**
 * Get health status of a stream connection
 */
export function getStreamHealth(bomId: string): {
  exists: boolean;
  status: StreamConnection['status'] | null;
  subscriberCount: number;
  reconnectAttempts: number;
  timeSinceLastEvent: number | null;
  readyState: number | null;
} {
  const connection = connections.get(bomId);

  if (!connection) {
    return {
      exists: false,
      status: null,
      subscriberCount: 0,
      reconnectAttempts: 0,
      timeSinceLastEvent: null,
      readyState: null,
    };
  }

  return {
    exists: true,
    status: connection.status,
    subscriberCount: connection.subscribers.size,
    reconnectAttempts: connection.reconnectAttempts,
    timeSinceLastEvent: Date.now() - connection.lastEventTime,
    readyState: connection.eventSource.readyState,
  };
}

/**
 * Get all active connections (for debugging)
 */
export function getActiveConnections(): Map<string, StreamConnection> {
  return new Map(connections);
}

/**
 * Force close all connections (for cleanup on app unmount)
 */
export function closeAllStreams(): void {
  console.log('[StreamService] Closing all active connections');
  connections.forEach(conn => closeEnrichmentStream(conn));
}

// Cleanup on window unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    closeAllStreams();
  });
}
