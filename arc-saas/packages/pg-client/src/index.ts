/**
 * @arc-saas/pg-client
 *
 * PostgreSQL client utilities for ARC SaaS tenant applications.
 * Provides multi-tenant database access with schema isolation.
 */

export { TenantPgClient, createTenantClient } from './client';
export { TenantPool, createTenantPool } from './pool';
export { TenantQueryBuilder } from './query-builder';
export { withTransaction } from './transaction';

export type {
  TenantPgConfig,
  TenantConnectionOptions,
  QueryResult,
  TenantContext,
} from './types';

export {
  PgClientError,
  ConnectionError,
  QueryError,
  TenantNotFoundError,
} from './errors';
