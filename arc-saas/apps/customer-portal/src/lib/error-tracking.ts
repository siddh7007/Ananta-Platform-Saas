/**
 * Error Tracking Integration
 *
 * Sentry-ready error tracking wrapper.
 * When Sentry DSN is configured, errors are sent to Sentry.
 * Otherwise, errors are logged to console.
 *
 * Enable Sentry:
 * - npm install @sentry/react
 * - Set VITE_SENTRY_DSN in .env
 * - Set VITE_SENTRY_ENVIRONMENT (default: 'development')
 */

import { logger } from '@/lib/logger';

// Error context for additional metadata
export interface ErrorContext {
  userId?: string;
  tenantId?: string;
  component?: string;
  action?: string;
  extra?: Record<string, unknown>;
}

// Sentry-like severity levels
export type ErrorSeverity = 'fatal' | 'error' | 'warning' | 'info' | 'debug';

// Global error context (set during auth/tenant init)
let globalContext: ErrorContext = {};

// Sentry instance (lazy loaded)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sentryModule: any = null;
let sentryInitialized = false;

/**
 * Check if Sentry DSN is configured
 */
function isSentryConfigured(): boolean {
  return Boolean(import.meta.env.VITE_SENTRY_DSN);
}

/**
 * Check if Sentry is available and initialized
 */
function isSentryAvailable(): boolean {
  return sentryInitialized && sentryModule !== null;
}

/**
 * Get Sentry configuration from env
 */
function getSentryConfig() {
  return {
    dsn: import.meta.env.VITE_SENTRY_DSN || '',
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || 'development',
    release: import.meta.env.VITE_APP_VERSION || '0.0.0',
  };
}

/**
 * Initialize error tracking
 * Call this once during app startup
 *
 * To enable Sentry:
 * 1. Install: npm install @sentry/react
 * 2. Set VITE_SENTRY_DSN in .env
 * 3. Optionally set VITE_SENTRY_ENVIRONMENT (default: 'development')
 */
export async function initErrorTracking(): Promise<void> {
  if (!isSentryConfigured()) {
    logger.info('Error tracking: Console mode (no Sentry DSN configured)');
    return;
  }

  try {
    // Dynamic import - Vite will tree-shake this if @sentry/react is not installed
    // VULN-004 FIXED: Removed Function() constructor (requires 'unsafe-eval' CSP)
    // Using dynamic import() instead of new Function() - no CSP unsafe-eval needed
    const sentryModulePath = '@sentry/react';
    sentryModule = await import(/* @vite-ignore */ sentryModulePath);
    const config = getSentryConfig();

    sentryModule.init({
      dsn: config.dsn,
      environment: config.environment,
      release: config.release,
      integrations: [
        sentryModule.browserTracingIntegration(),
        sentryModule.replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
      tracesSampleRate: config.environment === 'production' ? 0.1 : 1.0,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
    });

    sentryInitialized = true;
    logger.info('Error tracking initialized (Sentry)');
  } catch {
    // Sentry not installed - fall back to console logging
    logger.warn('Sentry package not installed, using console logging for errors');
    sentryModule = null;
    sentryInitialized = false;
  }
}

/**
 * Set global error context (user/tenant info)
 */
export function setErrorContext(context: ErrorContext): void {
  globalContext = { ...globalContext, ...context };

  if (isSentryAvailable()) {
    if (context.userId) {
      sentryModule.setUser({ id: context.userId });
    }
    if (context.tenantId) {
      sentryModule.setTag('tenant_id', context.tenantId);
    }
  }
}

/**
 * Clear error context (on logout)
 */
export function clearErrorContext(): void {
  globalContext = {};

  if (isSentryAvailable()) {
    sentryModule.setUser(null);
  }
}

/**
 * Capture an exception
 */
export function captureException(
  error: Error,
  context?: ErrorContext,
  severity: ErrorSeverity = 'error'
): void {
  const mergedContext = { ...globalContext, ...context };

  // Always log to console
  logger.error(`[${severity.toUpperCase()}] ${error.message}`, {
    error,
    context: mergedContext,
  });

  if (isSentryAvailable()) {
    sentryModule.withScope((scope: { setLevel: (l: string) => void; setTag: (k: string, v: string) => void; setExtras: (e: Record<string, unknown>) => void }) => {
      scope.setLevel(severity);

      if (mergedContext.component) {
        scope.setTag('component', mergedContext.component);
      }
      if (mergedContext.action) {
        scope.setTag('action', mergedContext.action);
      }
      if (mergedContext.extra) {
        scope.setExtras(mergedContext.extra);
      }

      sentryModule.captureException(error);
    });
  }
}

/**
 * Capture a message (for non-error events)
 */
export function captureMessage(
  message: string,
  context?: ErrorContext,
  severity: ErrorSeverity = 'info'
): void {
  const mergedContext = { ...globalContext, ...context };

  // Always log to console
  logger.info(`[${severity.toUpperCase()}] ${message}`, { context: mergedContext });

  if (isSentryAvailable()) {
    sentryModule.withScope((scope: { setLevel: (l: string) => void; setTag: (k: string, v: string) => void; setExtras: (e: Record<string, unknown>) => void }) => {
      scope.setLevel(severity);

      if (mergedContext.component) {
        scope.setTag('component', mergedContext.component);
      }
      if (mergedContext.action) {
        scope.setTag('action', mergedContext.action);
      }
      if (mergedContext.extra) {
        scope.setExtras(mergedContext.extra);
      }

      sentryModule.captureMessage(message);
    });
  }
}

/**
 * Create a breadcrumb for user actions
 */
export function addBreadcrumb(
  message: string,
  category: string = 'user',
  data?: Record<string, unknown>
): void {
  logger.debug(`[BREADCRUMB:${category}] ${message}`, data);

  if (isSentryAvailable()) {
    sentryModule.addBreadcrumb({
      message,
      category,
      data,
      level: 'info',
    });
  }
}

/**
 * Start a performance transaction
 */
export function startTransaction(
  name: string,
  op: string = 'navigation'
): { finish: () => void } {
  const startTime = performance.now();

  logger.debug(`[TRANSACTION:${op}] ${name} started`);

  return {
    finish: () => {
      const duration = Math.round(performance.now() - startTime);
      logger.debug(`[TRANSACTION:${op}] ${name} finished (${duration}ms)`);
    },
  };
}

/**
 * React Error Boundary wrapper component props
 */
export interface ErrorBoundaryFallbackProps {
  error: Error;
  resetError: () => void;
}

/**
 * Error boundary onError handler
 * Use this with react-error-boundary's onError prop
 */
export function handleErrorBoundary(error: Error, info: { componentStack: string }): void {
  captureException(error, {
    component: 'ErrorBoundary',
    extra: { componentStack: info.componentStack },
  });
}

/**
 * Wrap an async function with error tracking
 */
export function withErrorTracking<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  context: ErrorContext
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      captureException(error as Error, context);
      throw error;
    }
  }) as T;
}

/**
 * API error tracking wrapper
 */
export function trackApiError(
  method: string,
  url: string,
  status: number,
  error: Error
): void {
  captureException(error, {
    action: `API ${method} ${url}`,
    extra: {
      method,
      url,
      status,
    },
  });
}

export default {
  init: initErrorTracking,
  setContext: setErrorContext,
  clearContext: clearErrorContext,
  captureException,
  captureMessage,
  addBreadcrumb,
  startTransaction,
  trackApiError,
};
