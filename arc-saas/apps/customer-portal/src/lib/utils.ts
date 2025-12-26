import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// =============================================================================
// LOGGING UTILITIES
// =============================================================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

interface Logger {
  debug: (message: string, context?: LogContext) => void;
  info: (message: string, context?: LogContext) => void;
  warn: (message: string, context?: LogContext) => void;
  error: (message: string, error?: Error | unknown, context?: LogContext) => void;
  child: (childModule: string) => Logger;
}

// Check if we're in development mode
const isDev = import.meta.env.DEV;

// Log level priorities
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Get minimum log level from environment (default: debug in dev, info in prod)
const getMinLevel = (): LogLevel => {
  const envLevel = import.meta.env.VITE_LOG_LEVEL as LogLevel | undefined;
  if (envLevel && LOG_LEVELS[envLevel] !== undefined) {
    return envLevel;
  }
  return isDev ? 'debug' : 'info';
};

const MIN_LEVEL = getMinLevel();

function formatTimestamp(): string {
  const now = new Date();
  return now.toISOString().slice(11, 23); // HH:mm:ss.SSS
}

function formatContext(context?: LogContext): string {
  if (!context || Object.keys(context).length === 0) return '';

  try {
    const pairs = Object.entries(context)
      .map(([key, value]) => {
        if (typeof value === 'string') {
          const truncated = value.length > 50 ? value.slice(0, 47) + '...' : value;
          return `${key}="${truncated}"`;
        }
        if (typeof value === 'number' || typeof value === 'boolean') {
          return `${key}=${value}`;
        }
        if (value === null) return `${key}=null`;
        if (value === undefined) return `${key}=undefined`;
        if (Array.isArray(value)) return `${key}=[${value.length} items]`;
        if (typeof value === 'object') return `${key}={...}`;
        return `${key}=${String(value)}`;
      })
      .join(' ');
    return pairs ? ` | ${pairs}` : '';
  } catch {
    return '';
  }
}

function formatError(error?: Error | unknown): string {
  if (!error) return '';
  if (error instanceof Error) return ` | Error: ${error.message}`;
  if (typeof error === 'string') return ` | Error: ${error}`;
  try {
    return ` | Error: ${JSON.stringify(error)}`;
  } catch {
    return ' | Error: [Unable to serialize]';
  }
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LEVEL];
}

/**
 * Create a logger instance for a module
 *
 * Usage:
 * ```typescript
 * import { createLogger } from '@/lib/utils';
 * const log = createLogger('MyComponent');
 * log.info('Component mounted', { bomId: '123' });
 * log.error('API call failed', error, { endpoint: '/api/boms' });
 * ```
 */
export function createLogger(module: string): Logger {
  const formatPrefix = (level: LogLevel): string => {
    const timestamp = isDev ? `${formatTimestamp()} ` : '';
    const levelIndicator = level.toUpperCase().padEnd(5);
    return `${timestamp}[${levelIndicator}] [${module}]`;
  };

  const log = (level: LogLevel, message: string, context?: LogContext): void => {
    if (!shouldLog(level)) return;
    if (level === 'debug' && !isDev) return;

    const prefix = formatPrefix(level);
    const contextStr = formatContext(context);
    const output = `${prefix} ${message}${contextStr}`;

    switch (level) {
      case 'debug':
        console.debug(output);
        break;
      case 'info':
        console.info(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'error':
        console.error(output);
        break;
    }
  };

  const logger: Logger = {
    debug: (message: string, context?: LogContext) => log('debug', message, context),
    info: (message: string, context?: LogContext) => log('info', message, context),
    warn: (message: string, context?: LogContext) => log('warn', message, context),
    error: (message: string, error?: Error | unknown, context?: LogContext) => {
      if (!shouldLog('error')) return;
      const prefix = formatPrefix('error');
      const contextStr = formatContext(context);
      const errorStr = formatError(error);
      console.error(`${prefix} ${message}${errorStr}${contextStr}`);
      if (isDev && error instanceof Error && error.stack) {
        console.error(error.stack);
      }
    },
    child: (childModule: string) => createLogger(`${module}:${childModule}`),
  };

  return logger;
}

/** Pre-configured loggers for common modules */
export const loggers = {
  bom: createLogger('BOM'),
  upload: createLogger('Upload'),
  processing: createLogger('Processing'),
  enrichment: createLogger('Enrichment'),
  risk: createLogger('Risk'),
  auth: createLogger('Auth'),
  api: createLogger('API'),
};

/**
 * Format a date for display
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a date with time
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Truncate a string to a maximum length
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Capitalize the first letter of a string
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Generate a random ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * Delay for a specified number of milliseconds
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if a value is empty (null, undefined, empty string, empty array, empty object)
 */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

// =============================================================================
// VALIDATION UTILITIES
// =============================================================================

/**
 * UUID v4 validation regex pattern
 * Matches standard UUID format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 */
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * General UUID regex (accepts any version)
 * Matches: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate if a string is a valid UUID (any version)
 * @param id - The string to validate
 * @returns true if the string is a valid UUID format
 */
export function isValidUUID(id: string | null | undefined): boolean {
  if (!id || typeof id !== 'string') return false;
  return UUID_REGEX.test(id);
}

/**
 * Validate if a string is a valid UUID v4
 * @param id - The string to validate
 * @returns true if the string is a valid UUID v4 format
 */
export function isValidUUIDv4(id: string | null | undefined): boolean {
  if (!id || typeof id !== 'string') return false;
  return UUID_V4_REGEX.test(id);
}

/**
 * Assert that a value is a valid UUID, throw error if not
 * @param id - The string to validate
 * @param paramName - Name of the parameter for error message
 * @throws Error if the string is not a valid UUID
 */
export function assertUUID(id: string | null | undefined, paramName = 'id'): asserts id is string {
  if (!isValidUUID(id)) {
    throw new Error(`Invalid UUID format for ${paramName}: ${id}`);
  }
}
