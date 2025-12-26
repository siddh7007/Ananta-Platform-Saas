/**
 * Logging utility for Admin App
 * Integrates with OpenTelemetry tracing for correlation
 *
 * Environment flags:
 * - VITE_ENABLE_API_LOGGING: 'true' to enable detailed API logging (default in dev)
 * - Production builds automatically disable debug logs unless explicitly enabled
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  traceId?: string;
  spanId?: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Check if API logging is enabled via environment variable
 * Defaults to true in development, false in production
 */
const isLoggingEnabled = (): boolean => {
  const envFlag = import.meta.env.VITE_ENABLE_API_LOGGING;
  if (envFlag !== undefined && envFlag !== '') {
    return envFlag === 'true';
  }
  // Default: enabled in development, disabled in production
  return import.meta.env.MODE !== 'production';
};

const getLogLevel = (): LogLevel => {
  // If logging is disabled, only allow errors
  if (!isLoggingEnabled()) {
    return "error";
  }
  const env = import.meta.env.MODE || "development";
  return env === "production" ? "info" : "debug";
};

const shouldLog = (level: LogLevel): boolean => {
  const currentLevel = getLogLevel();
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
};

const formatLogEntry = (level: LogLevel, message: string, context?: LogContext): LogEntry => {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
    // Add trace context if available from OpenTelemetry
    traceId: (window as any).__OTEL_TRACE_ID__,
    spanId: (window as any).__OTEL_SPAN_ID__,
  };
};

const sendToBackend = async (entry: LogEntry): Promise<void> => {
  // In production, send logs to backend for aggregation
  if (import.meta.env.MODE === "production" && entry.level !== "debug") {
    try {
      await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
    } catch {
      // Silently fail - don't cause issues if logging backend is down
    }
  }
};

const log = (level: LogLevel, message: string, context?: LogContext): void => {
  if (!shouldLog(level)) return;

  const entry = formatLogEntry(level, message, context);

  // Console output with colors
  const colors: Record<LogLevel, string> = {
    debug: "color: gray",
    info: "color: blue",
    warn: "color: orange",
    error: "color: red",
  };

  const prefix = `[${entry.timestamp}] [${level.toUpperCase()}]`;

  if (context && Object.keys(context).length > 0) {
    console.log(`%c${prefix} ${message}`, colors[level], context);
  } else {
    console.log(`%c${prefix} ${message}`, colors[level]);
  }

  // Send to backend for error/warn in production
  if (level === "error" || level === "warn") {
    sendToBackend(entry);
  }
};

export const logger = {
  debug: (message: string, context?: LogContext) => log("debug", message, context),
  info: (message: string, context?: LogContext) => log("info", message, context),
  warn: (message: string, context?: LogContext) => log("warn", message, context),
  error: (message: string, context?: LogContext) => log("error", message, context),
};

// Error boundary logging helper
export const logError = (error: Error, errorInfo?: React.ErrorInfo): void => {
  logger.error("React error boundary caught error", {
    error: error.message,
    stack: error.stack,
    componentStack: errorInfo?.componentStack,
  });
};
