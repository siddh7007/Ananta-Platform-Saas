import {Middleware, MiddlewareContext} from '@loopback/rest';
import {ValueOrPromise} from '@loopback/core';
import {StructuredLoggerService} from '../services/structured-logger.service';

/**
 * Request logging middleware that hooks into the HTTP request/response lifecycle.
 * This runs BEFORE the request is processed and AFTER the response is sent.
 *
 * Unlike interceptors (which wrap method invocations), middleware wraps the entire
 * HTTP request lifecycle, ensuring accurate timing and status code capture.
 */
export class RequestLoggerMiddleware {
  private logger: StructuredLoggerService;

  constructor() {
    // Create a simple logger instance (middleware runs before DI context is fully available)
    this.logger = new StructuredLoggerService();
  }

  /**
   * Factory function to create the middleware.
   */
  static provider(): Middleware {
    const instance = new RequestLoggerMiddleware();
    return instance.handle.bind(instance);
  }

  /**
   * Middleware handler that logs request start/completion with accurate timing.
   */
  async handle(
    ctx: MiddlewareContext,
    next: () => ValueOrPromise<unknown>,
  ): Promise<void> {
    const startTime = Date.now();
    const correlationId = this.logger.generateCorrelationId();

    // Extract request details
    const {request, response} = ctx;
    const method = request.method;
    const path = request.url;
    const userAgent = request.headers['user-agent'] ?? 'unknown';
    const ip =
      (request.headers['x-forwarded-for'] as string) ??
      request.socket?.remoteAddress ??
      'unknown';

    // Log request start
    this.logger.info(`[HTTP] ${method} ${path} - Started`, {
      correlationId,
      method,
      path,
      userAgent,
      ip: typeof ip === 'string' ? ip : ip,
    });

    // Set correlation ID header on response for tracing
    response.setHeader('X-Correlation-Id', correlationId);

    try {
      // Execute the rest of the middleware chain and controller
      await next();

      // Log successful completion - this runs AFTER the response is prepared
      const duration = Date.now() - startTime;
      const statusCode = response.statusCode;

      this.logger.info(`[HTTP] ${method} ${path} - Completed`, {
        correlationId,
        method,
        path,
        duration,
        statusCode,
        status: statusCode < 400 ? 'success' : 'error',
      });
    } catch (error) {
      // Log error - this catches unhandled errors in the middleware chain
      const duration = Date.now() - startTime;
      const statusCode = response.statusCode || 500;

      this.logger.error(
        `[HTTP] ${method} ${path} - Failed`,
        error instanceof Error ? error : new Error(String(error)),
        {
          correlationId,
          method,
          path,
          duration,
          statusCode,
          status: 'error',
        },
      );

      // Re-throw the error so LoopBack can handle it
      throw error;
    }
  }
}
