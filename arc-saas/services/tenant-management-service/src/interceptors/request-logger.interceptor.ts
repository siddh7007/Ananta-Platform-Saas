import {
  injectable,
  Interceptor,
  InvocationContext,
  InvocationResult,
  Provider,
  ValueOrPromise,
  inject,
} from '@loopback/core';
import {RestBindings, Request} from '@loopback/rest';
import {StructuredLoggerService} from '../services/structured-logger.service';

/**
 * Request logging interceptor that uses StructuredLoggerService
 * to provide correlation IDs and structured JSON logging for all HTTP requests.
 */
@injectable()
export class RequestLoggerInterceptor implements Provider<Interceptor> {
  constructor(
    @inject('services.StructuredLoggerService')
    private logger: StructuredLoggerService,
  ) {}

  value(): Interceptor {
    return this.intercept.bind(this);
  }

  async intercept(
    invocationCtx: InvocationContext,
    next: () => ValueOrPromise<InvocationResult>,
  ): Promise<InvocationResult> {
    const startTime = Date.now();

    // Try to get the request object from context
    let request: Request | undefined;
    try {
      request = await invocationCtx.get(RestBindings.Http.REQUEST, {
        optional: true,
      });
    } catch {
      // Request not available in context (e.g., non-HTTP invocation)
    }

    // Generate correlation ID for this request
    const correlationId = this.logger.generateCorrelationId();

    // Extract request details
    const method = request?.method ?? 'UNKNOWN';
    const path = request?.url ?? 'unknown';
    const userAgent = request?.headers?.['user-agent'] ?? 'unknown';
    const ip =
      request?.headers?.['x-forwarded-for'] ??
      request?.socket?.remoteAddress ??
      'unknown';

    // Log request start
    this.logger.info(`Request started: ${method} ${path}`, {
      correlationId,
      method,
      path,
      userAgent,
      ip: typeof ip === 'string' ? ip : ip[0],
    });

    try {
      // Execute the controller method
      const result = await next();

      // Log successful completion
      const duration = Date.now() - startTime;
      this.logger.info(`Request completed: ${method} ${path}`, {
        correlationId,
        method,
        path,
        duration,
        status: 'success',
      });

      return result;
    } catch (error) {
      // Log error
      const duration = Date.now() - startTime;
      this.logger.error(
        `Request failed: ${method} ${path}`,
        error instanceof Error ? error : new Error(String(error)),
        {
          correlationId,
          method,
          path,
          duration,
          status: 'error',
        },
      );

      // Re-throw the error
      throw error;
    }
  }
}
