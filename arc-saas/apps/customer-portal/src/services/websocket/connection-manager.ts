/**
 * WebSocket Connection Manager
 * CBP-P2-007: Real-Time Enrichment Status Updates
 *
 * Manages WebSocket connections with auto-reconnect, heartbeat,
 * and subscription management for real-time updates.
 */

import { wsLogger } from '@/lib/logger';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WebSocketEventHandler = (...args: any[]) => void;

export interface EnrichmentProgress {
  bomId: string;
  totalItems: number;
  processedItems: number;
  enrichedItems: number;
  errorItems: number;
  currentItem?: {
    mpn: string;
    status: 'processing' | 'enriched' | 'error';
    message?: string;
  };
  estimatedTimeRemaining?: number;
}

export interface EnrichmentComplete {
  bomId: string;
  totalEnriched: number;
  totalErrors: number;
  duration: number;
}

export interface EnrichmentError {
  bomId: string;
  message: string;
  code?: string;
}

export interface BomUpdate {
  bomId: string;
  type: 'created' | 'updated' | 'deleted';
  data?: unknown;
}

export type WebSocketMessage =
  | { type: 'enrichment.progress'; data: EnrichmentProgress }
  | { type: 'enrichment.complete'; data: EnrichmentComplete }
  | { type: 'enrichment.error'; data: EnrichmentError }
  | { type: 'bom.updated'; data: BomUpdate }
  | { type: 'pong'; data: null };

type MessageType = WebSocketMessage['type'];

class SimpleEventEmitter {
  private events: Map<string, Set<WebSocketEventHandler>> = new Map();

  on(event: string, handler: WebSocketEventHandler): void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(handler);
  }

  off(event: string, handler: WebSocketEventHandler): void {
    this.events.get(event)?.delete(handler);
  }

  emit(event: string, ...args: unknown[]): void {
    this.events.get(event)?.forEach((handler) => {
      try {
        handler(...args);
      } catch (e) {
        wsLogger.error(`Error in event handler for ${event}`, e);
      }
    });
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
  }
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

class WebSocketManager extends SimpleEventEmitter {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private currentToken: string | null = null;
  private subscriptions: Set<string> = new Set();
  private status: ConnectionStatus = 'disconnected';

  constructor(url: string) {
    super();
    this.url = url;
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  connect(token: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    if (this.ws?.readyState === WebSocket.CONNECTING) return;

    this.currentToken = token;
    this.status = 'connecting';
    this.emit('status', this.status);

    try {
      const wsUrl = new URL(this.url);
      wsUrl.searchParams.set('token', token);

      this.ws = new WebSocket(wsUrl.toString());

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.status = 'connected';
        this.emit('connected');
        this.emit('status', this.status);
        this.startHeartbeat();

        // Re-subscribe to all previous subscriptions
        this.subscriptions.forEach((bomId) => {
          this.sendSubscription(bomId, true);
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          this.emit(message.type, message.data);
          this.emit('message', message);
        } catch (e) {
          wsLogger.error('Failed to parse WebSocket message', e, { data: event.data });
        }
      };

      this.ws.onclose = (event) => {
        this.stopHeartbeat();
        this.status = 'disconnected';
        this.emit('disconnected', { code: event.code, reason: event.reason });
        this.emit('status', this.status);

        // Attempt reconnection for non-clean closes
        if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        wsLogger.error('WebSocket error occurred', error);
        this.emit('error', error);
      };
    } catch (e) {
      wsLogger.error('Failed to create WebSocket connection', e, { url: this.url });
      this.status = 'disconnected';
      this.emit('status', this.status);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      30000 // Max 30 seconds
    );

    this.reconnectAttempts++;
    this.status = 'reconnecting';
    this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });
    this.emit('status', this.status);

    this.reconnectTimeout = setTimeout(() => {
      if (this.currentToken) {
        this.connect(this.currentToken);
      }
    }, delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private sendSubscription(bomId: string, subscribe: boolean): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: subscribe ? 'subscribe' : 'unsubscribe',
          resource: 'bom',
          id: bomId,
        })
      );
    }
  }

  subscribe(bomId: string): void {
    this.subscriptions.add(bomId);
    this.sendSubscription(bomId, true);
  }

  unsubscribe(bomId: string): void {
    this.subscriptions.delete(bomId);
    this.sendSubscription(bomId, false);
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.stopHeartbeat();
    this.subscriptions.clear();
    this.currentToken = null;
    this.reconnectAttempts = 0;

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.status = 'disconnected';
    this.emit('status', this.status);
  }
}

// Singleton instance
const WS_URL = typeof import.meta !== 'undefined' && import.meta.env?.VITE_WS_URL
  ? import.meta.env.VITE_WS_URL
  : 'wss://api.ananta.com/ws';

export const wsManager = new WebSocketManager(WS_URL);

export default wsManager;
