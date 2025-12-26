/**
 * Activity Tracer
 *
 * A utility wrapper that automatically traces activity executions,
 * records metrics, and integrates with the structured logger.
 */

import { Context } from '@temporalio/activity';
import { Span, SpanStatusCode } from '@opentelemetry/api';
import {
  createActivitySpan,
  recordActivityExecution,
  getTraceContext,
} from './opentelemetry';
import { createLogger, ChildLogger } from '../utils/logger';

export interface ActivityTracerOptions {
  activityName: string;
  tenantId: string;
  tier?: string;
  workflowId?: string;
  additionalAttributes?: Record<string, string | number | boolean>;
}

export interface TracedActivityResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  durationMs: number;
}

/**
 * Activity Tracer - wraps activity execution with tracing and metrics
 */
export class ActivityTracer {
  private readonly logger: ChildLogger;
  private readonly options: ActivityTracerOptions;
  private span: Span | null = null;
  private startTime: number = 0;

  constructor(options: ActivityTracerOptions) {
    this.options = options;
    this.logger = createLogger(options.activityName).child({
      tenantId: options.tenantId,
      tier: options.tier,
      workflowId: options.workflowId,
    });
  }

  /**
   * Start tracing an activity
   */
  start(): this {
    this.startTime = Date.now();
    this.span = createActivitySpan(
      this.options.activityName,
      this.options.workflowId || 'unknown',
      this.options.tenantId
    );

    // Add additional attributes if provided
    if (this.options.additionalAttributes) {
      for (const [key, value] of Object.entries(this.options.additionalAttributes)) {
        this.span.setAttribute(key, value);
      }
    }

    // Add tier information
    if (this.options.tier) {
      this.span.setAttribute('tenant.tier', this.options.tier);
    }

    this.logger.info(`Starting activity: ${this.options.activityName}`);
    return this;
  }

  /**
   * Add an event to the current span
   */
  addEvent(name: string, attributes?: Record<string, string | number | boolean>): this {
    if (this.span) {
      this.span.addEvent(name, attributes);
    }
    return this;
  }

  /**
   * Add attributes to the current span
   */
  addAttributes(attributes: Record<string, string | number | boolean>): this {
    if (this.span) {
      for (const [key, value] of Object.entries(attributes)) {
        this.span.setAttribute(key, value);
      }
    }
    return this;
  }

  /**
   * Mark the activity as successful
   */
  success<T>(result?: T): TracedActivityResult<T> {
    const durationMs = Date.now() - this.startTime;

    if (this.span) {
      this.span.setStatus({ code: SpanStatusCode.OK });
      this.span.setAttribute('activity.duration_ms', durationMs);
      this.span.end();
    }

    recordActivityExecution(
      this.options.activityName,
      this.options.tenantId,
      this.options.tier || 'unknown',
      true,
      durationMs
    );

    this.logger.info(`Activity completed successfully: ${this.options.activityName}`, {
      durationMs,
    });

    return {
      success: true,
      result,
      durationMs,
    };
  }

  /**
   * Mark the activity as failed
   */
  failure(error: Error): TracedActivityResult<never> {
    const durationMs = Date.now() - this.startTime;

    if (this.span) {
      this.span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      this.span.recordException(error);
      this.span.setAttribute('activity.duration_ms', durationMs);
      this.span.setAttribute('error.type', error.name);
      this.span.setAttribute('error.message', error.message);
      this.span.end();
    }

    recordActivityExecution(
      this.options.activityName,
      this.options.tenantId,
      this.options.tier || 'unknown',
      false,
      durationMs
    );

    this.logger.error(`Activity failed: ${this.options.activityName}`, {
      durationMs,
      error: error.message,
      errorType: error.name,
    });

    return {
      success: false,
      error,
      durationMs,
    };
  }

  /**
   * Get the logger for this activity
   */
  getLogger(): ChildLogger {
    return this.logger;
  }

  /**
   * Get trace context for external calls
   */
  getTraceContext(): { traceId: string; spanId: string } | null {
    return getTraceContext();
  }
}

/**
 * Create an activity tracer from Temporal activity context
 */
export function createActivityTracer(
  activityName: string,
  tenantId: string,
  tier?: string
): ActivityTracer {
  let workflowId: string | undefined;

  try {
    const ctx = Context.current();
    workflowId = ctx.info.workflowExecution.workflowId;
  } catch {
    // Activity context not available (e.g., in tests)
  }

  return new ActivityTracer({
    activityName,
    tenantId,
    tier,
    workflowId,
  });
}

/**
 * Wrap an activity function with automatic tracing
 *
 * @example
 * ```ts
 * export const myActivity = withTracing(
 *   'myActivity',
 *   async (input: MyInput) => {
 *     // Activity implementation
 *     return result;
 *   }
 * );
 * ```
 */
export function withTracing<TInput extends { tenantId: string; tier?: string }, TOutput>(
  activityName: string,
  fn: (input: TInput) => Promise<TOutput>
): (input: TInput) => Promise<TOutput> {
  return async (input: TInput): Promise<TOutput> => {
    const tracer = createActivityTracer(activityName, input.tenantId, input.tier);
    tracer.start();

    try {
      const result = await fn(input);
      tracer.success(result);
      return result;
    } catch (error) {
      tracer.failure(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  };
}

/**
 * Decorator for tracing async activity methods
 * Note: TypeScript decorators require experimentalDecorators
 */
export function Traced(activityName?: string) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;
    const name = activityName || propertyKey;

    descriptor.value = async function (
      this: unknown,
      input: { tenantId: string; tier?: string },
      ...args: unknown[]
    ) {
      const tracer = createActivityTracer(name, input.tenantId, input.tier);
      tracer.start();

      try {
        const result = await originalMethod.apply(this, [input, ...args]);
        tracer.success(result);
        return result;
      } catch (error) {
        tracer.failure(error instanceof Error ? error : new Error(String(error)));
        throw error;
      }
    };

    return descriptor;
  };
}

export default {
  ActivityTracer,
  createActivityTracer,
  withTracing,
  Traced,
};
