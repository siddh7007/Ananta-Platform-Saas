import {injectable, BindingScope} from '@loopback/core';

/**
 * Log levels in order of severity.
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * Structured log entry that can be parsed by log aggregators (ELK, Loki, etc.)
 */
export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  version: string;
  environment: string;
  correlationId?: string;
  tenantId?: string;
  userId?: string;
  flow?: string;
  step?: string;
  duration?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Flow context for tracking multi-step operations.
 */
export interface FlowContext {
  correlationId: string;
  flow: string;
  tenantId?: string;
  userId?: string;
  startTime: number;
  steps: Array<{
    step: string;
    startTime: number;
    endTime?: number;
    status: 'started' | 'completed' | 'failed';
    error?: string;
  }>;
}

/**
 * StructuredLoggerService provides consistent JSON logging with correlation IDs
 * and flow tracking for observability. Integrates with ELK/Loki/Datadog.
 */
@injectable({scope: BindingScope.SINGLETON})
export class StructuredLoggerService {
  private readonly serviceName = 'tenant-management-service';
  private readonly serviceVersion = process.env.npm_package_version ?? '1.0.0';
  private readonly environment = process.env.NODE_ENV ?? 'development';
  private readonly logLevel: LogLevel;
  private activeFlows: Map<string, FlowContext> = new Map();

  constructor() {
    // Set log level from environment
    const envLogLevel = process.env.LOG_LEVEL?.toLowerCase();
    this.logLevel = Object.values(LogLevel).includes(envLogLevel as LogLevel)
      ? (envLogLevel as LogLevel)
      : LogLevel.INFO;
  }

  /**
   * Generate a unique correlation ID for tracking requests across services.
   */
  generateCorrelationId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${random}`;
  }

  /**
   * Start tracking a new flow (multi-step operation).
   * @param flow - Flow identifier (e.g., 'tenant-provisioning', 'user-onboarding')
   * @param context - Optional context (tenantId, userId)
   * @returns Correlation ID for the flow
   */
  startFlow(
    flow: string,
    context?: {tenantId?: string; userId?: string},
  ): string {
    const correlationId = this.generateCorrelationId();
    const flowContext: FlowContext = {
      correlationId,
      flow,
      tenantId: context?.tenantId,
      userId: context?.userId,
      startTime: Date.now(),
      steps: [],
    };

    this.activeFlows.set(correlationId, flowContext);

    this.info(`Flow started: ${flow}`, {
      correlationId,
      flow,
      tenantId: context?.tenantId,
      userId: context?.userId,
    });

    return correlationId;
  }

  /**
   * Log a step within a flow.
   * @param correlationId - Flow correlation ID
   * @param step - Step identifier
   * @param status - Step status
   * @param metadata - Additional context
   */
  logStep(
    correlationId: string,
    step: string,
    status: 'started' | 'completed' | 'failed',
    metadata?: Record<string, unknown>,
  ): void {
    const flowContext = this.activeFlows.get(correlationId);
    if (!flowContext) {
      this.warn(`Flow not found for correlationId: ${correlationId}`, {
        correlationId,
        step,
      });
      return;
    }

    const now = Date.now();

    if (status === 'started') {
      flowContext.steps.push({
        step,
        startTime: now,
        status: 'started',
      });
    } else {
      const existingStep = flowContext.steps.find(
        s => s.step === step && s.status === 'started',
      );
      if (existingStep) {
        existingStep.endTime = now;
        existingStep.status = status;
        if (status === 'failed' && metadata?.error) {
          existingStep.error = String(metadata.error);
        }
      }
    }

    const duration =
      status !== 'started'
        ? flowContext.steps.find(s => s.step === step)?.startTime
          ? now -
            (flowContext.steps.find(s => s.step === step)?.startTime ?? now)
          : undefined
        : undefined;

    this.info(`Step ${status}: ${step}`, {
      correlationId,
      flow: flowContext.flow,
      step,
      tenantId: flowContext.tenantId,
      userId: flowContext.userId,
      duration,
      ...metadata,
    });
  }

  /**
   * Complete a flow (mark as finished).
   * @param correlationId - Flow correlation ID
   * @param success - Whether the flow completed successfully
   * @param metadata - Additional context
   */
  completeFlow(
    correlationId: string,
    success: boolean,
    metadata?: Record<string, unknown>,
  ): void {
    const flowContext = this.activeFlows.get(correlationId);
    if (!flowContext) {
      this.warn(`Flow not found for correlationId: ${correlationId}`, {
        correlationId,
      });
      return;
    }

    const duration = Date.now() - flowContext.startTime;
    const completedSteps = flowContext.steps.filter(
      s => s.status === 'completed',
    ).length;
    const failedSteps = flowContext.steps.filter(
      s => s.status === 'failed',
    ).length;

    const level = success ? LogLevel.INFO : LogLevel.ERROR;
    this.log(level, `Flow ${success ? 'completed' : 'failed'}: ${flowContext.flow}`, {
      correlationId,
      flow: flowContext.flow,
      tenantId: flowContext.tenantId,
      userId: flowContext.userId,
      duration,
      totalSteps: flowContext.steps.length,
      completedSteps,
      failedSteps,
      success,
      ...metadata,
    });

    // Clean up
    this.activeFlows.delete(correlationId);
  }

  /**
   * Log at DEBUG level.
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log at INFO level.
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log at WARN level.
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log at ERROR level with optional error object.
   */
  error(
    message: string,
    error?: Error | unknown,
    context?: Record<string, unknown>,
  ): void {
    const errorDetails =
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
            code: (error as unknown as {code?: string}).code,
          }
        : error
        ? {name: 'Error', message: String(error)}
        : undefined;

    this.log(LogLevel.ERROR, message, {
      ...context,
      error: errorDetails,
    });
  }

  /**
   * Core logging method that outputs structured JSON.
   */
  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
  ): void {
    // Check log level threshold
    const levelOrder = [
      LogLevel.DEBUG,
      LogLevel.INFO,
      LogLevel.WARN,
      LogLevel.ERROR,
    ];
    if (levelOrder.indexOf(level) < levelOrder.indexOf(this.logLevel)) {
      return;
    }

    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.serviceName,
      version: this.serviceVersion,
      environment: this.environment,
      correlationId: context?.correlationId as string | undefined,
      tenantId: context?.tenantId as string | undefined,
      userId: context?.userId as string | undefined,
      flow: context?.flow as string | undefined,
      step: context?.step as string | undefined,
      duration: context?.duration as number | undefined,
    };

    // Add error if present
    if (context?.error) {
      entry.error = context.error as StructuredLogEntry['error'];
    }

    // Add remaining metadata
    const knownKeys = [
      'correlationId',
      'tenantId',
      'userId',
      'flow',
      'step',
      'duration',
      'error',
    ];
    const metadata: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(context ?? {})) {
      if (!knownKeys.includes(key)) {
        metadata[key] = value;
      }
    }
    if (Object.keys(metadata).length > 0) {
      entry.metadata = metadata;
    }

    // Output as JSON
    const jsonLine = JSON.stringify(entry);

    // Use appropriate console method
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(jsonLine);
        break;
      case LogLevel.INFO:
        console.info(jsonLine);
        break;
      case LogLevel.WARN:
        console.warn(jsonLine);
        break;
      case LogLevel.ERROR:
        console.error(jsonLine);
        break;
    }
  }

  /**
   * Create a child logger with pre-set context.
   * Useful for request-scoped logging.
   */
  child(context: {
    correlationId?: string;
    tenantId?: string;
    userId?: string;
  }): ChildLogger {
    return new ChildLogger(this, context);
  }
}

/**
 * Child logger with pre-set context for request-scoped logging.
 */
export class ChildLogger {
  constructor(
    private readonly parent: StructuredLoggerService,
    private readonly context: {
      correlationId?: string;
      tenantId?: string;
      userId?: string;
    },
  ) {}

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.parent.debug(message, {...this.context, ...metadata});
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.parent.info(message, {...this.context, ...metadata});
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.parent.warn(message, {...this.context, ...metadata});
  }

  error(
    message: string,
    error?: Error | unknown,
    metadata?: Record<string, unknown>,
  ): void {
    this.parent.error(message, error, {...this.context, ...metadata});
  }

  logStep(
    step: string,
    status: 'started' | 'completed' | 'failed',
    metadata?: Record<string, unknown>,
  ): void {
    if (this.context.correlationId) {
      this.parent.logStep(this.context.correlationId, step, status, metadata);
    }
  }
}

// Export singleton instance for convenience
let _instance: StructuredLoggerService | undefined;
export function getLogger(): StructuredLoggerService {
  if (!_instance) {
    _instance = new StructuredLoggerService();
  }
  return _instance;
}
