/**
 * Custom error classes for pg-client
 */

/**
 * Base error for pg-client operations
 */
export class PgClientError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'PgClientError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Connection-related errors
 */
export class ConnectionError extends PgClientError {
  constructor(message: string, cause?: Error) {
    super(message, 'CONNECTION_ERROR', cause);
    this.name = 'ConnectionError';
  }
}

/**
 * Query execution errors
 */
export class QueryError extends PgClientError {
  constructor(
    message: string,
    public readonly query?: string,
    public readonly params?: unknown[],
    cause?: Error
  ) {
    super(message, 'QUERY_ERROR', cause);
    this.name = 'QueryError';
  }
}

/**
 * Tenant not found or invalid
 */
export class TenantNotFoundError extends PgClientError {
  constructor(tenantId: string) {
    super(`Tenant not found: ${tenantId}`, 'TENANT_NOT_FOUND');
    this.name = 'TenantNotFoundError';
  }
}

/**
 * Schema does not exist
 */
export class SchemaNotFoundError extends PgClientError {
  constructor(schema: string) {
    super(`Schema not found: ${schema}`, 'SCHEMA_NOT_FOUND');
    this.name = 'SchemaNotFoundError';
  }
}

/**
 * Transaction error
 */
export class TransactionError extends PgClientError {
  constructor(message: string, cause?: Error) {
    super(message, 'TRANSACTION_ERROR', cause);
    this.name = 'TransactionError';
  }
}
