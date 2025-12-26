/**
 * Structured Logger for Temporal Worker Service
 *
 * Provides consistent, structured logging with:
 * - Log levels (trace, debug, info, warn, error)
 * - Correlation IDs for tracing
 * - JSON formatting for production
 * - Context-aware logging
 */

export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
}

export interface LogContext {
  tenantId?: string;
  workflowId?: string;
  activityName?: string;
  correlationId?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

const LOG_LEVEL_MAP: Record<string, LogLevel> = {
  trace: LogLevel.TRACE,
  debug: LogLevel.DEBUG,
  info: LogLevel.INFO,
  warn: LogLevel.WARN,
  error: LogLevel.ERROR,
};

class Logger {
  private currentLevel: LogLevel;
  private isProduction: boolean;

  constructor() {
    const envLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();
    this.currentLevel = LOG_LEVEL_MAP[envLevel] ?? LogLevel.INFO;
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.currentLevel;
  }

  private formatMessage(
    level: string,
    message: string,
    context?: LogContext,
    error?: Error
  ): string {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
    };

    if (context && Object.keys(context).length > 0) {
      entry.context = context;
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: this.isProduction ? undefined : error.stack,
      };
    }

    if (this.isProduction) {
      return JSON.stringify(entry);
    }

    // Pretty print for development
    let output = `[${entry.timestamp}] [${entry.level}] ${message}`;
    if (entry.context) {
      output += ` ${JSON.stringify(entry.context)}`;
    }
    if (entry.error) {
      output += `\n  Error: ${entry.error.name}: ${entry.error.message}`;
      if (entry.error.stack) {
        output += `\n  Stack: ${entry.error.stack}`;
      }
    }
    return output;
  }

  trace(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.TRACE)) {
      console.log(this.formatMessage('trace', message, context));
    }
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(this.formatMessage('debug', message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatMessage('info', message, context));
    }
  }

  warn(message: string, context?: LogContext, error?: Error): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage('warn', message, context, error));
    }
  }

  error(message: string, context?: LogContext, error?: Error): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage('error', message, context, error));
    }
  }

  /**
   * Create a child logger with preset context
   */
  child(context: LogContext): ChildLogger {
    return new ChildLogger(this, context);
  }
}

class ChildLogger {
  constructor(
    private parent: Logger,
    private context: LogContext
  ) {}

  private mergeContext(additionalContext?: LogContext): LogContext {
    return { ...this.context, ...additionalContext };
  }

  trace(message: string, context?: LogContext): void {
    this.parent.trace(message, this.mergeContext(context));
  }

  debug(message: string, context?: LogContext): void {
    this.parent.debug(message, this.mergeContext(context));
  }

  info(message: string, context?: LogContext): void {
    this.parent.info(message, this.mergeContext(context));
  }

  warn(message: string, context?: LogContext, error?: Error): void {
    this.parent.warn(message, this.mergeContext(context), error);
  }

  error(message: string, context?: LogContext, error?: Error): void {
    this.parent.error(message, this.mergeContext(context), error);
  }

  /**
   * Create a child logger with additional context merged with the current context
   */
  child(additionalContext: LogContext): ChildLogger {
    return new ChildLogger(this.parent, this.mergeContext(additionalContext));
  }
}

// Export singleton instance
export const logger = new Logger();

// Export types for external use
export type { ChildLogger };

// Export Logger type for type annotations
export type { Logger };

/**
 * Create a named logger instance (child logger with component context)
 * This is the preferred way to create loggers in activities and services.
 *
 * @param componentName - The name of the component/module using the logger
 * @returns A child logger with the component name in context
 */
export function createLogger(componentName: string): ChildLogger {
  return logger.child({ component: componentName });
}
