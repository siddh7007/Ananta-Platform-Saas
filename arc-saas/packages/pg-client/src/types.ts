/**
 * Type definitions for pg-client
 */

import { PoolConfig, QueryResultRow } from 'pg';

/**
 * Tenant context for database operations
 */
export interface TenantContext {
  tenantId: string;
  tenantKey: string;
  schema: string;
}

/**
 * PostgreSQL configuration for tenant connections
 */
export interface TenantPgConfig {
  /** Database host */
  host: string;
  /** Database port */
  port: number;
  /** Database name */
  database: string;
  /** Database user */
  user: string;
  /** Database password */
  password: string;
  /** Enable SSL */
  ssl?: boolean | { rejectUnauthorized: boolean };
  /** Connection pool settings */
  pool?: {
    /** Minimum pool size */
    min?: number;
    /** Maximum pool size */
    max?: number;
    /** Idle timeout in milliseconds */
    idleTimeoutMillis?: number;
    /** Connection timeout in milliseconds */
    connectionTimeoutMillis?: number;
  };
}

/**
 * Options for tenant connection
 */
export interface TenantConnectionOptions {
  /** Tenant identifier */
  tenantId: string;
  /** Tenant key (used for schema name) */
  tenantKey: string;
  /** Schema isolation strategy */
  isolationStrategy: 'schema' | 'database' | 'row';
  /** Custom schema name (defaults to tenant_${tenantKey}) */
  schemaName?: string;
  /** Database override for silo tenants */
  databaseOverride?: string;
}

/**
 * Query result with typed rows
 */
export interface QueryResult<T extends QueryResultRow = QueryResultRow> {
  rows: T[];
  rowCount: number;
  fields: Array<{
    name: string;
    dataTypeID: number;
  }>;
}

/**
 * Paginated query result
 */
export interface PaginatedResult<T extends QueryResultRow = QueryResultRow> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Query options
 */
export interface QueryOptions {
  /** Query timeout in milliseconds */
  timeout?: number;
  /** Enable query logging */
  logging?: boolean;
}

/**
 * Transaction options
 */
export interface TransactionOptions {
  /** Isolation level */
  isolationLevel?: 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';
  /** Read only transaction */
  readOnly?: boolean;
}

/**
 * Pool configuration extending pg PoolConfig
 */
export type TenantPoolConfig = PoolConfig & {
  /** Tenant context */
  tenant: TenantContext;
};
