/**
 * OpenTelemetry Browser Instrumentation
 *
 * Provides distributed tracing for the Customer Portal frontend.
 * Exports traces to the shared arc-saas Jaeger instance via OTLP HTTP.
 *
 * Infrastructure:
 * - Uses arc-saas-jaeger container (docker-compose up -d jaeger)
 * - OTLP endpoint: http://localhost:4318/v1/traces
 * - Jaeger UI: http://localhost:16686
 *
 * Features:
 * - Automatic fetch/XHR instrumentation
 * - Trace context propagation to backend services (W3C traceparent header)
 * - Custom span creation for user interactions
 * - Environment-aware configuration
 */

import { WebTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-web';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { XMLHttpRequestInstrumentation } from '@opentelemetry/instrumentation-xml-http-request';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { Resource } from '@opentelemetry/resources';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import type { Span } from '@opentelemetry/api';

// Semantic conventions for resource attributes
// Using string literals for compatibility across versions
const ATTR_SERVICE_NAME = 'service.name';
const ATTR_SERVICE_VERSION = 'service.version';
const ATTR_DEPLOYMENT_ENVIRONMENT = 'deployment.environment';

// Configuration from environment
const OTEL_EXPORTER_ENDPOINT =
  import.meta.env.VITE_OTEL_EXPORTER_ENDPOINT || 'http://localhost:4318/v1/traces';
const SERVICE_NAME = import.meta.env.VITE_SERVICE_NAME || 'cbp-frontend';
const SERVICE_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';
const ENVIRONMENT = import.meta.env.MODE || 'development';
const OTEL_ENABLED = import.meta.env.VITE_OTEL_ENABLED !== 'false';

// URLs to propagate trace context to (backend services)
const PROPAGATE_TRACE_URLS = [
  import.meta.env.VITE_PLATFORM_API_URL || 'http://localhost:14000',
  import.meta.env.VITE_CNS_API_URL || 'http://localhost:27200',
  import.meta.env.VITE_SUPABASE_API_URL || 'http://localhost:27810',
];

// URLs to ignore (don't trace these requests)
const IGNORE_URLS = [
  /\/health$/,
  /\/metrics$/,
  /favicon\.ico$/,
  /\.hot-update\./,
  /sockjs-node/,
  /@vite/,
];

let provider: WebTracerProvider | null = null;
let isInitialized = false;

/**
 * Initialize OpenTelemetry tracing
 * Should be called once at application startup (before React renders)
 */
export function initTelemetry(): void {
  if (isInitialized) {
    console.warn('[Telemetry] Already initialized, skipping');
    return;
  }

  if (!OTEL_ENABLED) {
    console.log('[Telemetry] Disabled via VITE_OTEL_ENABLED=false');
    return;
  }

  try {
    // Create resource with service metadata
    const resource = new Resource({
      [ATTR_SERVICE_NAME]: SERVICE_NAME,
      [ATTR_SERVICE_VERSION]: SERVICE_VERSION,
      [ATTR_DEPLOYMENT_ENVIRONMENT]: ENVIRONMENT,
    });

    // Create OTLP exporter
    const exporter = new OTLPTraceExporter({
      url: OTEL_EXPORTER_ENDPOINT,
      headers: {},
    });

    // Create provider with batch processor
    provider = new WebTracerProvider({
      resource,
      spanProcessors: [new BatchSpanProcessor(exporter)],
    });

    // Use Zone.js for async context propagation
    provider.register({
      contextManager: new ZoneContextManager(),
    });

    // Register auto-instrumentation
    registerInstrumentations({
      instrumentations: [
        new FetchInstrumentation({
          propagateTraceHeaderCorsUrls: PROPAGATE_TRACE_URLS,
          clearTimingResources: true,
          ignoreUrls: IGNORE_URLS,
          applyCustomAttributesOnSpan: (span, request, response) => {
            // Add custom attributes to fetch spans
            // Use type guards to safely access properties
            const req = request as { url?: string };
            const res = response as { headers?: { get: (name: string) => string | null } };

            if (req?.url) {
              span.setAttribute('http.request.url', req.url);
            }
            if (res?.headers?.get) {
              const contentLength = res.headers.get('content-length');
              if (contentLength) {
                span.setAttribute('http.response.content_length', parseInt(contentLength, 10));
              }
            }
          },
        }),
        new XMLHttpRequestInstrumentation({
          propagateTraceHeaderCorsUrls: PROPAGATE_TRACE_URLS,
          clearTimingResources: true,
          ignoreUrls: IGNORE_URLS,
        }),
      ],
    });

    isInitialized = true;
    console.log('[Telemetry] Initialized successfully', {
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      environment: ENVIRONMENT,
      exporter: OTEL_EXPORTER_ENDPOINT,
    });
  } catch (error) {
    console.error('[Telemetry] Failed to initialize:', error);
  }
}

/**
 * Get the tracer instance for creating custom spans
 */
export function getTracer(name?: string) {
  return trace.getTracer(name || SERVICE_NAME, SERVICE_VERSION);
}

/**
 * Create a custom span for tracking user interactions or business logic
 *
 * @example
 * ```typescript
 * await withSpan('bom.upload', async (span) => {
 *   span.setAttribute('bom.filename', file.name);
 *   await uploadBom(file);
 * });
 * ```
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Record<string, string | number | boolean>
): Promise<T> {
  const tracer = getTracer();
  return tracer.startActiveSpan(name, async (span) => {
    try {
      // Add initial attributes
      if (attributes) {
        Object.entries(attributes).forEach(([key, value]) => {
          span.setAttribute(key, value);
        });
      }

      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Create a synchronous span (for non-async operations)
 */
export function withSyncSpan<T>(
  name: string,
  fn: (span: Span) => T,
  attributes?: Record<string, string | number | boolean>
): T {
  const tracer = getTracer();
  const span = tracer.startSpan(name);

  try {
    if (attributes) {
      Object.entries(attributes).forEach(([key, value]) => {
        span.setAttribute(key, value);
      });
    }

    const result = fn(span);
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    span.recordException(error instanceof Error ? error : new Error(String(error)));
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Add an event to the current active span
 */
export function addSpanEvent(
  name: string,
  attributes?: Record<string, string | number | boolean>
): void {
  const activeSpan = trace.getActiveSpan();
  if (activeSpan) {
    activeSpan.addEvent(name, attributes);
  }
}

/**
 * Set attributes on the current active span
 */
export function setSpanAttributes(
  attributes: Record<string, string | number | boolean>
): void {
  const activeSpan = trace.getActiveSpan();
  if (activeSpan) {
    Object.entries(attributes).forEach(([key, value]) => {
      activeSpan.setAttribute(key, value);
    });
  }
}

/**
 * Get the current trace context for manual propagation
 * Useful when making requests outside of fetch/XHR (e.g., WebSocket)
 */
export function getTraceContext(): { traceparent?: string; tracestate?: string } {
  const activeSpan = trace.getActiveSpan();
  if (!activeSpan) {
    return {};
  }

  const spanContext = activeSpan.spanContext();
  const traceparent = `00-${spanContext.traceId}-${spanContext.spanId}-0${spanContext.traceFlags}`;

  return { traceparent };
}

/**
 * Shutdown the telemetry provider (call on app unmount)
 */
export async function shutdownTelemetry(): Promise<void> {
  if (provider) {
    try {
      await provider.shutdown();
      console.log('[Telemetry] Shutdown complete');
    } catch (error) {
      console.error('[Telemetry] Shutdown error:', error);
    }
  }
}

// Re-export common types for convenience
export type { Span };
export { SpanStatusCode, trace };
