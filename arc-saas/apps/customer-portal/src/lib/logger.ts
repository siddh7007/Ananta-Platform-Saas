/**
 * Configurable logger for debugging API requests and application state
 *
 * Enable logging:
 * - localStorage.setItem('cbp:debug', 'true')
 * - Set VITE_DEBUG=true in .env
 *
 * Log levels:
 * - localStorage.setItem('cbp:logLevel', 'debug|info|warn|error')
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

interface LoggerConfig {
  enabled: boolean;
  level: LogLevel;
  prefix: string;
  timestamps: boolean;
}

const DEFAULT_CONFIG: LoggerConfig = {
  enabled: false,
  level: 'info',
  prefix: '[CBP]',
  timestamps: true,
};

/**
 * Get current logger configuration from localStorage/env
 */
function getConfig(): LoggerConfig {
  const config = { ...DEFAULT_CONFIG };

  // Check localStorage first (allows runtime toggling)
  if (typeof window !== 'undefined' && window.localStorage) {
    const debugFlag = localStorage.getItem('cbp:debug');
    if (debugFlag === 'true') {
      config.enabled = true;
    }

    const levelFlag = localStorage.getItem('cbp:logLevel') as LogLevel | null;
    if (levelFlag && LOG_LEVELS[levelFlag] !== undefined) {
      config.level = levelFlag;
    }

    const timestampFlag = localStorage.getItem('cbp:timestamps');
    if (timestampFlag === 'false') {
      config.timestamps = false;
    }
  }

  // Environment variable override
  if (import.meta.env.VITE_DEBUG === 'true') {
    config.enabled = true;
  }

  // Always enable in development
  if (import.meta.env.DEV) {
    config.enabled = true;
  }

  return config;
}

/**
 * Format log message with optional timestamp
 */
function formatMessage(prefix: string, category: string, message: string, timestamps: boolean): string {
  const parts: string[] = [];

  if (timestamps) {
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const ms = now.getMilliseconds().toString().padStart(3, '0');
    parts.push(`[${time}.${ms}]`);
  }

  parts.push(prefix);
  if (category) {
    parts.push(`[${category}]`);
  }
  parts.push(message);

  return parts.join(' ');
}

/**
 * Check if log level should be output
 */
function shouldLog(configLevel: LogLevel, messageLevel: LogLevel): boolean {
  return LOG_LEVELS[messageLevel] >= LOG_LEVELS[configLevel];
}

/**
 * Create a logger instance
 */
export function createLogger(category: string = '') {
  return {
    debug(message: string, ...args: unknown[]) {
      const config = getConfig();
      if (config.enabled && shouldLog(config.level, 'debug')) {
        console.debug(formatMessage(config.prefix, category, message, config.timestamps), ...args);
      }
    },

    info(message: string, ...args: unknown[]) {
      const config = getConfig();
      if (config.enabled && shouldLog(config.level, 'info')) {
        console.info(formatMessage(config.prefix, category, message, config.timestamps), ...args);
      }
    },

    warn(message: string, ...args: unknown[]) {
      const config = getConfig();
      if (config.enabled && shouldLog(config.level, 'warn')) {
        console.warn(formatMessage(config.prefix, category, message, config.timestamps), ...args);
      }
    },

    error(message: string, error?: Error | unknown, context?: Record<string, unknown>) {
      const config = getConfig();
      // Always log errors in production - critical for debugging
      const shouldOutput = config.enabled || import.meta.env.PROD;

      if (shouldOutput && shouldLog(config.level, 'error')) {
        const formattedMsg = formatMessage(config.prefix, category, message, config.timestamps);

        if (error && context) {
          console.error(formattedMsg, error, context);
        } else if (error) {
          console.error(formattedMsg, error);
        } else if (context) {
          console.error(formattedMsg, context);
        } else {
          console.error(formattedMsg);
        }

        // TODO: Send to external logging service in production
        // if (import.meta.env.PROD) {
        //   sendToExternalLogger({ level: 'error', category, message, error, context });
        // }
      }
    },

    /**
     * Log API request/response
     */
    api(method: string, url: string, status?: number, duration?: number) {
      const config = getConfig();
      if (!config.enabled) return;

      const statusEmoji = status
        ? status >= 200 && status < 300
          ? 'OK'
          : status >= 400
            ? 'ERR'
            : 'REDIRECT'
        : 'PENDING';

      const durationStr = duration !== undefined ? `(${duration}ms)` : '';
      const statusStr = status !== undefined ? `${status}` : '...';

      console.log(
        formatMessage(config.prefix, 'API', `${method.toUpperCase()} ${url} -> ${statusStr} ${statusEmoji} ${durationStr}`, config.timestamps)
      );
    },

    /**
     * Log with timing measurement
     */
    time(label: string): () => void {
      const config = getConfig();
      const start = performance.now();

      if (config.enabled) {
        console.log(formatMessage(config.prefix, 'TIMER', `${label} started`, config.timestamps));
      }

      return () => {
        const duration = Math.round(performance.now() - start);
        if (config.enabled) {
          console.log(formatMessage(config.prefix, 'TIMER', `${label} completed (${duration}ms)`, config.timestamps));
        }
      };
    },

    /**
     * Group related logs
     */
    group(label: string, fn: () => void) {
      const config = getConfig();
      if (config.enabled) {
        console.group(formatMessage(config.prefix, category, label, config.timestamps));
        fn();
        console.groupEnd();
      } else {
        fn();
      }
    },

    /**
     * Log a table of data
     */
    table(data: unknown[], columns?: string[]) {
      const config = getConfig();
      if (config.enabled) {
        console.table(data, columns);
      }
    },
  };
}

// Default logger instance
export const logger = createLogger();

// Specialized loggers
export const apiLogger = createLogger('API');
export const authLogger = createLogger('AUTH');
export const tenantLogger = createLogger('TENANT');
export const routeLogger = createLogger('ROUTE');
export const wsLogger = createLogger('WEBSOCKET');
export const componentLogger = createLogger('COMPONENT');
export const exportLogger = createLogger('EXPORT');

/**
 * Enable debug mode at runtime
 */
export function enableDebug(level: LogLevel = 'debug') {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem('cbp:debug', 'true');
    localStorage.setItem('cbp:logLevel', level);
    console.log('[CBP] Debug mode enabled. Refresh to see logs.');
  }
}

/**
 * Disable debug mode at runtime
 */
export function disableDebug() {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.removeItem('cbp:debug');
    localStorage.removeItem('cbp:logLevel');
    console.log('[CBP] Debug mode disabled.');
  }
}

/**
 * Check if debug mode is enabled
 */
export function isDebugEnabled(): boolean {
  return getConfig().enabled;
}

// Expose debug functions on window for console access
if (typeof window !== 'undefined') {
  (window as unknown as { cbpDebug: { enable: typeof enableDebug; disable: typeof disableDebug; isEnabled: typeof isDebugEnabled } }).cbpDebug = {
    enable: enableDebug,
    disable: disableDebug,
    isEnabled: isDebugEnabled,
  };
}

export default logger;
