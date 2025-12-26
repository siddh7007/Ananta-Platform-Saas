/**
 * Observability Module
 *
 * Exports all observability utilities for tracing, metrics, and logging.
 */

export {
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
} from './opentelemetry';

export { ActivityTracer, createActivityTracer } from './activity-tracer';
