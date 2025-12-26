/**
 * OpenTelemetry Configuration for Temporal Worker Service
 *
 * Provides:
 * - Distributed tracing with Jaeger exporter
 * - Metrics with Prometheus exporter
 * - Temporal SDK integration
 * - Custom span attributes for workflow/activity context
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import {
  SEMRESATTRS_SERVICE_NAME as ATTR_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION as ATTR_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT as ATTR_DEPLOYMENT_ENVIRONMENT,
} from '@opentelemetry/semantic-conventions';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import {
  PeriodicExportingMetricReader,
  MeterProvider,
  ConsoleMetricExporter,
} from '@opentelemetry/sdk-metrics';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import {
  Context,
  context,
  trace,
  Span,
  SpanKind,
  SpanStatusCode,
  Tracer,
  Meter,
  metrics,
  Counter,
  Histogram,
  UpDownCounter,
} from '@opentelemetry/api';
import { createLogger } from '../utils/logger';

const logger = createLogger('opentelemetry');

// ============================================
// Configuration
// ============================================

interface TelemetryConfig {
  enabled: boolean;
  serviceName: string;
  serviceVersion: string;
  environment: string;
  jaeger: {
    enabled: boolean;
    host: string;
    port: number;
  };
  otlp: {
    enabled: boolean;
    endpoint: string;
  };
  prometheus: {
    enabled: boolean;
    port: number;
  };
  console: {
    enabled: boolean;
  };
}

function getConfig(): TelemetryConfig {
  // Match the existing arc-saas pattern: ENABLE_TRACING=1 enables both Jaeger and Console
  const tracingEnabled = !!+(process.env.ENABLE_TRACING ?? 0);

  return {
    enabled: tracingEnabled,
    serviceName: process.env.SERVICE_NAME || 'temporal-worker-service',
    serviceVersion: process.env.SERVICE_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    jaeger: {
      // When ENABLE_TRACING=1, Jaeger is enabled by default (matching other services)
      enabled: tracingEnabled,
      host: process.env.OPENTELEMETRY_HOST || 'localhost',
      port: process.env.OPENTELEMETRY_PORT ? +process.env.OPENTELEMETRY_PORT : 6832,
    },
    otlp: {
      // Extended feature: OTLP exporter for modern stacks (opt-in)
      enabled: process.env.OTLP_ENABLED === 'true',
      endpoint: process.env.OTLP_ENDPOINT || 'http://localhost:4317',
    },
    prometheus: {
      // Extended feature: Prometheus metrics (opt-in)
      enabled: process.env.PROMETHEUS_ENABLED === 'true',
      port: parseInt(process.env.PROMETHEUS_PORT || '9464', 10),
    },
    console: {
      // When ENABLE_TRACING=1, Console exporter is enabled by default (matching other services)
      enabled: tracingEnabled,
    },
  };
}

// ============================================
// Global State
// ============================================

let sdk: NodeSDK | null = null;
let tracerProvider: NodeTracerProvider | null = null;
let meterProvider: MeterProvider | null = null;
let isInitialized = false;

// ============================================
// Initialization
// ============================================

/**
 * Initialize OpenTelemetry SDK
 */
export function initTelemetry(): void {
  const config = getConfig();

  if (!config.enabled) {
    logger.info('Telemetry disabled - skipping initialization');
    return;
  }

  if (isInitialized) {
    logger.warn('Telemetry already initialized');
    return;
  }

  logger.info('Initializing OpenTelemetry', {
    serviceName: config.serviceName,
    environment: config.environment,
    jaegerEnabled: config.jaeger.enabled,
    otlpEnabled: config.otlp.enabled,
    prometheusEnabled: config.prometheus.enabled,
  });

  // Create resource with service metadata
  const resource = new Resource({
    [ATTR_SERVICE_NAME]: config.serviceName,
    [ATTR_SERVICE_VERSION]: config.serviceVersion,
    [ATTR_DEPLOYMENT_ENVIRONMENT]: config.environment,
    'service.instance.id': process.env.HOSTNAME || `worker-${process.pid}`,
    'temporal.task_queue': process.env.TEMPORAL_TASK_QUEUE || 'tenant-provisioning',
    'temporal.namespace': process.env.TEMPORAL_NAMESPACE || 'arc-saas',
  });

  // Create tracer provider
  tracerProvider = new NodeTracerProvider({ resource });

  // Add span processors based on configuration
  if (config.jaeger.enabled) {
    const jaegerExporter = new JaegerExporter({
      host: config.jaeger.host,
      port: config.jaeger.port,
    });
    tracerProvider.addSpanProcessor(new BatchSpanProcessor(jaegerExporter));
    logger.info('Jaeger exporter configured', {
      host: config.jaeger.host,
      port: config.jaeger.port,
    });
  }

  if (config.otlp.enabled) {
    const otlpExporter = new OTLPTraceExporter({
      url: config.otlp.endpoint,
    });
    tracerProvider.addSpanProcessor(new BatchSpanProcessor(otlpExporter));
    logger.info('OTLP trace exporter configured', {
      endpoint: config.otlp.endpoint,
    });
  }

  if (config.console.enabled) {
    tracerProvider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));
    logger.info('Console trace exporter enabled');
  }

  // Register tracer provider with propagator
  tracerProvider.register({
    propagator: new W3CTraceContextPropagator(),
  });

  // Set up metrics
  const metricReaders = [];

  if (config.prometheus.enabled) {
    const prometheusExporter = new PrometheusExporter({
      port: config.prometheus.port,
    });
    metricReaders.push(prometheusExporter);
    logger.info('Prometheus metrics exporter configured', {
      port: config.prometheus.port,
    });
  }

  if (config.otlp.enabled) {
    const otlpMetricExporter = new OTLPMetricExporter({
      url: config.otlp.endpoint,
    });
    metricReaders.push(
      new PeriodicExportingMetricReader({
        exporter: otlpMetricExporter,
        exportIntervalMillis: 15000,
      })
    );
  }

  if (config.console.enabled) {
    metricReaders.push(
      new PeriodicExportingMetricReader({
        exporter: new ConsoleMetricExporter(),
        exportIntervalMillis: 60000,
      })
    );
  }

  if (metricReaders.length > 0) {
    meterProvider = new MeterProvider({
      resource,
      readers: metricReaders,
    });
    metrics.setGlobalMeterProvider(meterProvider);
  }

  isInitialized = true;
  logger.info('OpenTelemetry initialized successfully');
}

/**
 * Shutdown telemetry gracefully
 */
export async function shutdownTelemetry(): Promise<void> {
  if (!isInitialized) {
    return;
  }

  logger.info('Shutting down OpenTelemetry');

  try {
    if (tracerProvider) {
      await tracerProvider.shutdown();
    }
    if (meterProvider) {
      await meterProvider.shutdown();
    }
    if (sdk) {
      await sdk.shutdown();
    }
    isInitialized = false;
    logger.info('OpenTelemetry shutdown complete');
  } catch (error) {
    logger.error('Error shutting down OpenTelemetry', { error });
  }
}

// ============================================
// Tracer & Meter Access
// ============================================

const TRACER_NAME = 'temporal-worker';
const METER_NAME = 'temporal-worker';

/**
 * Get the tracer for creating spans
 */
export function getTracer(): Tracer {
  return trace.getTracer(TRACER_NAME);
}

/**
 * Get the meter for creating metrics
 */
export function getMeter(): Meter {
  return metrics.getMeter(METER_NAME);
}

// ============================================
// Temporal-Specific Metrics
// ============================================

let temporalMetrics: {
  workflowsStarted: Counter;
  workflowsCompleted: Counter;
  workflowsFailed: Counter;
  activitiesExecuted: Counter;
  activitiesSucceeded: Counter;
  activitiesFailed: Counter;
  activityDuration: Histogram;
  workflowDuration: Histogram;
  activeWorkflows: UpDownCounter;
  compensationsExecuted: Counter;
} | null = null;

/**
 * Get or create Temporal-specific metrics
 */
export function getTemporalMetrics() {
  if (temporalMetrics) {
    return temporalMetrics;
  }

  const meter = getMeter();

  temporalMetrics = {
    // Workflow metrics
    workflowsStarted: meter.createCounter('temporal.workflows.started', {
      description: 'Number of workflows started',
    }),
    workflowsCompleted: meter.createCounter('temporal.workflows.completed', {
      description: 'Number of workflows completed successfully',
    }),
    workflowsFailed: meter.createCounter('temporal.workflows.failed', {
      description: 'Number of workflows that failed',
    }),
    workflowDuration: meter.createHistogram('temporal.workflow.duration', {
      description: 'Workflow execution duration in seconds',
      unit: 's',
    }),
    activeWorkflows: meter.createUpDownCounter('temporal.workflows.active', {
      description: 'Number of currently active workflows',
    }),

    // Activity metrics
    activitiesExecuted: meter.createCounter('temporal.activities.executed', {
      description: 'Number of activities executed',
    }),
    activitiesSucceeded: meter.createCounter('temporal.activities.succeeded', {
      description: 'Number of activities completed successfully',
    }),
    activitiesFailed: meter.createCounter('temporal.activities.failed', {
      description: 'Number of activities that failed',
    }),
    activityDuration: meter.createHistogram('temporal.activity.duration', {
      description: 'Activity execution duration in seconds',
      unit: 's',
    }),

    // Compensation metrics
    compensationsExecuted: meter.createCounter('temporal.compensations.executed', {
      description: 'Number of saga compensations executed',
    }),
  };

  return temporalMetrics;
}

// ============================================
// Span Helpers
// ============================================

/**
 * Create a span for a workflow execution
 */
export function createWorkflowSpan(
  workflowType: string,
  workflowId: string,
  runId: string,
  tenantId: string
): Span {
  const tracer = getTracer();
  return tracer.startSpan(`workflow.${workflowType}`, {
    kind: SpanKind.INTERNAL,
    attributes: {
      'temporal.workflow.type': workflowType,
      'temporal.workflow.id': workflowId,
      'temporal.run.id': runId,
      'tenant.id': tenantId,
    },
  });
}

/**
 * Create a span for an activity execution
 */
export function createActivitySpan(
  activityName: string,
  workflowId: string,
  tenantId: string
): Span {
  const tracer = getTracer();
  return tracer.startSpan(`activity.${activityName}`, {
    kind: SpanKind.INTERNAL,
    attributes: {
      'temporal.activity.name': activityName,
      'temporal.workflow.id': workflowId,
      'tenant.id': tenantId,
    },
  });
}

/**
 * Create a span for a compensation/rollback
 */
export function createCompensationSpan(
  compensationType: string,
  workflowId: string,
  tenantId: string,
  originalError: string
): Span {
  const tracer = getTracer();
  const m = getTemporalMetrics();
  m.compensationsExecuted.add(1, {
    type: compensationType,
    tenant_id: tenantId,
  });

  return tracer.startSpan(`compensation.${compensationType}`, {
    kind: SpanKind.INTERNAL,
    attributes: {
      'temporal.compensation.type': compensationType,
      'temporal.workflow.id': workflowId,
      'tenant.id': tenantId,
      'compensation.trigger.error': originalError,
    },
  });
}

/**
 * Record activity execution
 */
export function recordActivityExecution(
  activityName: string,
  tenantId: string,
  tier: string,
  success: boolean,
  durationMs: number
): void {
  const m = getTemporalMetrics();
  const attributes = {
    activity: activityName,
    tenant_id: tenantId,
    tier,
  };

  m.activitiesExecuted.add(1, attributes);

  if (success) {
    m.activitiesSucceeded.add(1, attributes);
  } else {
    m.activitiesFailed.add(1, attributes);
  }

  m.activityDuration.record(durationMs / 1000, attributes);
}

/**
 * Record workflow execution
 */
export function recordWorkflowExecution(
  workflowType: string,
  tenantId: string,
  tier: string,
  success: boolean,
  durationMs: number
): void {
  const m = getTemporalMetrics();
  const attributes = {
    workflow: workflowType,
    tenant_id: tenantId,
    tier,
  };

  if (success) {
    m.workflowsCompleted.add(1, attributes);
  } else {
    m.workflowsFailed.add(1, attributes);
  }

  m.workflowDuration.record(durationMs / 1000, attributes);
}

// ============================================
// Context Propagation Helpers
// ============================================

/**
 * Execute a function within a span context
 */
export async function withSpan<T>(
  spanName: string,
  attributes: Record<string, string | number | boolean>,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  const tracer = getTracer();
  const span = tracer.startSpan(spanName, {
    kind: SpanKind.INTERNAL,
    attributes,
  });

  try {
    const result = await context.with(trace.setSpan(context.active(), span), () => fn(span));
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
 * Get current trace context for logging
 */
export function getTraceContext(): { traceId: string; spanId: string } | null {
  const span = trace.getSpan(context.active());
  if (!span) {
    return null;
  }

  const spanContext = span.spanContext();
  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
  };
}

// ============================================
// Health Check
// ============================================

/**
 * Check if telemetry is healthy
 */
export function isTelemetryHealthy(): boolean {
  return isInitialized;
}

export default {
  initTelemetry,
  shutdownTelemetry,
  getTracer,
  getMeter,
  getTemporalMetrics,
  createWorkflowSpan,
  createActivitySpan,
  createCompensationSpan,
  recordActivityExecution,
  recordWorkflowExecution,
  withSpan,
  getTraceContext,
  isTelemetryHealthy,
};
