/**
 * Centralized Logging Utility
 *
 * Provides structured logging with context, log levels, and optional
 * remote logging integration (e.g., Sentry, LogRocket, DataDog).
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogContext {
  module?: string;
  action?: string;
  userId?: string;
  tenantId?: string;
  requestId?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: LogContext;
  timestamp: Date;
  error?: Error;
  stack?: string;
}

class Logger {
  private minLevel: LogLevel;
  private enableConsole: boolean;
  private enableRemote: boolean;

  constructor() {
    // Configure from environment
    const logLevel = process.env.NEXT_PUBLIC_LOG_LEVEL || 'INFO';
    this.minLevel = this.parseLogLevel(logLevel);
    this.enableConsole = process.env.NEXT_PUBLIC_ENABLE_CONSOLE_LOGGING !== 'false';
    this.enableRemote = process.env.NEXT_PUBLIC_ENABLE_REMOTE_LOGGING === 'true';
  }

  private parseLogLevel(level: string): LogLevel {
    switch (level.toUpperCase()) {
      case 'DEBUG':
        return LogLevel.DEBUG;
      case 'INFO':
        return LogLevel.INFO;
      case 'WARN':
        return LogLevel.WARN;
      case 'ERROR':
        return LogLevel.ERROR;
      default:
        return LogLevel.INFO;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.minLevel;
  }

  private formatMessage(entry: LogEntry): string {
    const levelName = LogLevel[entry.level];
    const timestamp = entry.timestamp.toISOString();
    const moduleName = entry.context?.module ? `[${entry.context.module}]` : '';

    return `${timestamp} ${levelName} ${moduleName} ${entry.message}`;
  }

  private logToConsole(entry: LogEntry): void {
    if (!this.enableConsole) return;

    const formatted = this.formatMessage(entry);

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(formatted, entry.context, entry.error);
        break;
      case LogLevel.INFO:
        console.info(formatted, entry.context);
        break;
      case LogLevel.WARN:
        console.warn(formatted, entry.context, entry.error);
        break;
      case LogLevel.ERROR:
        console.error(formatted, entry.context, entry.error);
        if (entry.stack) {
          console.error(entry.stack);
        }
        break;
    }
  }

  private logToRemote(entry: LogEntry): void {
    if (!this.enableRemote) return;

    // TODO: Integrate with remote logging service (Sentry, LogRocket, DataDog)
    // Example Sentry integration:
    // if (window.Sentry && entry.level >= LogLevel.ERROR) {
    //   window.Sentry.captureException(entry.error || new Error(entry.message), {
    //     level: LogLevel[entry.level].toLowerCase(),
    //     contexts: { custom: entry.context },
    //   });
    // }
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      context,
      timestamp: new Date(),
      error,
      stack: error?.stack,
    };

    this.logToConsole(entry);
    this.logToRemote(entry);
  }

  /**
   * Debug-level logging (verbose, development only)
   */
  public debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Info-level logging (general information)
   */
  public info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Warning-level logging (recoverable errors)
   */
  public warn(message: string, context?: LogContext, error?: Error): void {
    this.log(LogLevel.WARN, message, context, error);
  }

  /**
   * Error-level logging (critical failures)
   */
  public error(message: string, context?: LogContext, error?: Error): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  /**
   * Log API request (info level)
   */
  public apiRequest(method: string, url: string, context?: LogContext): void {
    this.info(`API Request: ${method.toUpperCase()} ${url}`, {
      ...context,
      module: 'API',
      action: 'request',
    });
  }

  /**
   * Log API response (info level for success, error for failures)
   */
  public apiResponse(
    method: string,
    url: string,
    status: number,
    duration?: number,
    context?: LogContext,
  ): void {
    const message = `API Response: ${method.toUpperCase()} ${url} - ${status}`;
    const enrichedContext = {
      ...context,
      module: 'API',
      action: 'response',
      status,
      duration,
    };

    if (status >= 400) {
      this.error(message, enrichedContext);
    } else {
      this.info(message, enrichedContext);
    }
  }

  /**
   * Log authentication event
   */
  public auth(action: string, context?: LogContext): void {
    this.info(`Auth: ${action}`, {
      ...context,
      module: 'Auth',
      action,
    });
  }

  /**
   * Log user action (info level)
   */
  public userAction(action: string, context?: LogContext): void {
    this.info(`User Action: ${action}`, {
      ...context,
      module: 'User',
      action,
    });
  }

  /**
   * Log performance metric
   */
  public performance(metric: string, value: number, context?: LogContext): void {
    this.debug(`Performance: ${metric} = ${value}ms`, {
      ...context,
      module: 'Performance',
      metric,
      value,
    });
  }
}

// Singleton instance
export const logger = new Logger();

// Export convenience functions
export const logDebug = logger.debug.bind(logger);
export const logInfo = logger.info.bind(logger);
export const logWarn = logger.warn.bind(logger);
export const logError = logger.error.bind(logger);
export const logApiRequest = logger.apiRequest.bind(logger);
export const logApiResponse = logger.apiResponse.bind(logger);
export const logAuth = logger.auth.bind(logger);
export const logUserAction = logger.userAction.bind(logger);
export const logPerformance = logger.performance.bind(logger);
