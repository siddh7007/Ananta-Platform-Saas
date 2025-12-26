/**
 * WebSocket Client for Real-Time BOM Job Progress
 *
 * Provides a typed WebSocket client for connecting to CNS service
 * and receiving real-time progress updates for BOM enrichment jobs.
 */

import { getCnsBaseUrl } from './cnsApi';

export type WebSocketEventType =
  | 'connected'
  | 'progress'
  | 'status_change'
  | 'item_completed'
  | 'item_failed'
  | 'completed'
  | 'error'
  | 'ping'
  | 'pong';

export interface WebSocketMessage {
  event: WebSocketEventType;
  job_id: string;
  data: any;
  timestamp: string;
}

export interface ProgressData {
  progress: number;
  total_items: number;
  enriched_count: number;
  failed_count: number;
  current_item: number;
  message: string;
}

export interface ItemCompletedData {
  item_number: number;
  total_items: number;
  mpn: string;
  manufacturer: string;
  component_id: string;
}

export interface ItemFailedData {
  item_number: number;
  total_items: number;
  mpn: string;
  manufacturer: string;
  error: string;
}

export interface CompletedData {
  status: 'completed' | 'completed_with_errors';
  total_items: number;
  enriched_count: number;
  failed_count: number;
  message: string;
}

export interface StatusChangeData {
  status: string;
  message: string;
  total_items?: number;
}

export interface ErrorData {
  status: string;
  error: string;
  message: string;
}

type EventCallback = (message: WebSocketMessage) => void;

export class BOMJobWebSocketClient {
  private ws: WebSocket | null = null;
  private jobId: string;
  private baseUrl: string;
  private callbacks: Map<WebSocketEventType, EventCallback[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private pingInterval: NodeJS.Timeout | null = null;
  private shouldReconnect = true;

  constructor(jobId: string, baseUrl?: string) {
    this.jobId = jobId;
    // Convert HTTP URL to WebSocket URL
    const cnsUrl = baseUrl || getCnsBaseUrl();
    this.baseUrl = cnsUrl.replace(/^http/, 'ws');
  }

  /**
   * Connect to the WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = `${this.baseUrl}/api/ws/jobs/${this.jobId}/progress`;
        console.log(`[WebSocket] Connecting to ${wsUrl}...`);

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log(`[WebSocket] Connected to job ${this.jobId}`);
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;
          this.startPingInterval();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            console.log(`[WebSocket] Event: ${message.event}`, message.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('[WebSocket] Failed to parse message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[WebSocket] Error:', error);
          reject(error);
        };

        this.ws.onclose = (event) => {
          console.log(`[WebSocket] Closed (code: ${event.code}, reason: ${event.reason})`);
          this.stopPingInterval();

          if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
            console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

            setTimeout(() => {
              this.connect().catch(console.error);
            }, delay);
          }
        };
      } catch (error) {
        console.error('[WebSocket] Connection failed:', error);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    this.shouldReconnect = false;
    this.stopPingInterval();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    console.log('[WebSocket] Disconnected');
  }

  /**
   * Register a callback for a specific event type
   */
  on(event: WebSocketEventType, callback: EventCallback): void {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, []);
    }
    this.callbacks.get(event)!.push(callback);
  }

  /**
   * Remove a callback for a specific event type
   */
  off(event: WebSocketEventType, callback: EventCallback): void {
    const callbacks = this.callbacks.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Remove all callbacks
   */
  removeAllListeners(): void {
    this.callbacks.clear();
  }

  /**
   * Send a ping to keep the connection alive
   */
  private sendPing(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'ping' }));
    }
  }

  /**
   * Start sending periodic pings
   */
  private startPingInterval(): void {
    this.stopPingInterval();
    // Send ping every 25 seconds (server timeout is 30 seconds)
    this.pingInterval = setInterval(() => this.sendPing(), 25000);
  }

  /**
   * Stop sending periodic pings
   */
  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(message: WebSocketMessage): void {
    const callbacks = this.callbacks.get(message.event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(message);
        } catch (error) {
          console.error(`[WebSocket] Error in ${message.event} callback:`, error);
        }
      });
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Get current connection state
   */
  getState(): string {
    if (!this.ws) return 'CLOSED';

    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'CONNECTING';
      case WebSocket.OPEN: return 'OPEN';
      case WebSocket.CLOSING: return 'CLOSING';
      case WebSocket.CLOSED: return 'CLOSED';
      default: return 'UNKNOWN';
    }
  }
}

/**
 * Create and connect to a BOM job WebSocket
 *
 * Example usage:
 * ```typescript
 * const wsClient = createBOMJobWebSocket('job-id-123');
 *
 * wsClient.on('progress', (message) => {
 *   const data = message.data as ProgressData;
 *   console.log(`Progress: ${data.progress}%`);
 *   updateProgressBar(data.progress);
 * });
 *
 * wsClient.on('completed', (message) => {
 *   const data = message.data as CompletedData;
 *   console.log(`Completed: ${data.enriched_count} enriched, ${data.failed_count} failed`);
 * });
 *
 * await wsClient.connect();
 *
 * // Later, when done:
 * wsClient.disconnect();
 * ```
 */
export function createBOMJobWebSocket(jobId: string, baseUrl?: string): BOMJobWebSocketClient {
  return new BOMJobWebSocketClient(jobId, baseUrl);
}
