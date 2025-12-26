/**
 * Logging utility for Customer App
 * Tenant-aware logging with OpenTelemetry integration
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
  tenantId?: string;
  traceId?: string;
  spanId?: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Get tenant from current context
const getTenantId = (): string | undefined => {
  try {
    const hostname = window.location.hostname;
    const parts = hostname.split(".");
    if (parts.length >= 2) {
      return parts[0]; // subdomain = tenant key
    }
  } catch {
    return undefined;
  }
  return undefined;
};

const getLogLevel = (): LogLevel => {
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
    tenantId: getTenantId(),
    traceId: (window as any).__OTEL_TRACE_ID__,
    spanId: (window as any).__OTEL_SPAN_ID__,
  };
};

const sendToBackend = async (entry: LogEntry): Promise<void> => {
  if (import.meta.env.MODE === "production" && entry.level !== "debug") {
    try {
      const token = localStorage.getItem("arc_customer_token");
      await fetch("/api/logs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(entry),
      });
    } catch {
      // Silently fail
    }
  }
};

const log = (level: LogLevel, message: string, context?: LogContext): void => {
  if (!shouldLog(level)) return;

  const entry = formatLogEntry(level, message, context);

  const colors: Record<LogLevel, string> = {
    debug: "color: gray",
    info: "color: blue",
    warn: "color: orange",
    error: "color: red",
  };

  const tenantPrefix = entry.tenantId ? `[${entry.tenantId}]` : "";
  const prefix = `[${entry.timestamp}] ${tenantPrefix} [${level.toUpperCase()}]`;

  if (context && Object.keys(context).length > 0) {
    console.log(`%c${prefix} ${message}`, colors[level], context);
  } else {
    console.log(`%c${prefix} ${message}`, colors[level]);
  }

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

export const logError = (error: Error, errorInfo?: React.ErrorInfo): void => {
  logger.error("React error boundary caught error", {
    error: error.message,
    stack: error.stack,
    componentStack: errorInfo?.componentStack,
  });
};
