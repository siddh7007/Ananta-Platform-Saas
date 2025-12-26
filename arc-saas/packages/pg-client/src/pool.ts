/**
 * Tenant-aware PostgreSQL connection pool
 */

import { Pool, PoolClient, PoolConfig } from 'pg';
import { TenantPgConfig, TenantConnectionOptions, TenantContext } from './types';
import { ConnectionError, SchemaNotFoundError } from './errors';

/**
 * Pool manager for tenant connections
 */
export class TenantPool {
  private pool: Pool;
  private tenant: TenantContext;
  private config: TenantPgConfig;

  constructor(config: TenantPgConfig, options: TenantConnectionOptions) {
    this.config = config;
    this.tenant = {
      tenantId: options.tenantId,
      tenantKey: options.tenantKey,
      schema: options.schemaName || `tenant_${options.tenantKey}`,
    };

    const poolConfig: PoolConfig = {
      host: options.databaseOverride ? config.host : config.host,
      port: config.port,
      database: options.databaseOverride || config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl,
      min: config.pool?.min || 2,
      max: config.pool?.max || 10,
      idleTimeoutMillis: config.pool?.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config.pool?.connectionTimeoutMillis || 5000,
    };

    this.pool = new Pool(poolConfig);

    // Set search_path on each new connection
    this.pool.on('connect', (client: PoolClient) => {
      if (options.isolationStrategy === 'schema') {
        client.query(`SET search_path TO ${this.tenant.schema}, public`);
      }
    });

    this.pool.on('error', (err: Error) => {
      console.error('Unexpected pool error:', err);
    });
  }

  /**
   * Get tenant context
   */
  getTenant(): TenantContext {
    return { ...this.tenant };
  }

  /**
   * Get a client from the pool
   */
  async getClient(): Promise<PoolClient> {
    try {
      const client = await this.pool.connect();
      return client;
    } catch (error) {
      throw new ConnectionError(
        `Failed to get client for tenant ${this.tenant.tenantKey}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Execute a query
   */
  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number }> {
    const result = await this.pool.query(text, params);
    return {
      rows: result.rows as T[],
      rowCount: result.rowCount || 0,
    };
  }

  /**
   * Verify schema exists
   */
  async verifySchema(): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1`,
      [this.tenant.schema]
    );

    if (result.rowCount === 0) {
      throw new SchemaNotFoundError(this.tenant.schema);
    }

    return true;
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    total: number;
    idle: number;
    waiting: number;
  } {
    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
    };
  }

  /**
   * End the pool
   */
  async end(): Promise<void> {
    await this.pool.end();
  }
}

/**
 * Create a tenant pool
 */
export function createTenantPool(
  config: TenantPgConfig,
  options: TenantConnectionOptions
): TenantPool {
  return new TenantPool(config, options);
}

/**
 * Pool manager for multiple tenants
 */
export class TenantPoolManager {
  private pools: Map<string, TenantPool> = new Map();
  private config: TenantPgConfig;

  constructor(config: TenantPgConfig) {
    this.config = config;
  }

  /**
   * Get or create a pool for a tenant
   */
  getPool(options: TenantConnectionOptions): TenantPool {
    const key = `${options.tenantKey}-${options.isolationStrategy}`;

    let pool = this.pools.get(key);
    if (!pool) {
      pool = new TenantPool(this.config, options);
      this.pools.set(key, pool);
    }

    return pool;
  }

  /**
   * Close a specific tenant pool
   */
  async closePool(tenantKey: string): Promise<void> {
    for (const [key, pool] of this.pools.entries()) {
      if (key.startsWith(tenantKey)) {
        await pool.end();
        this.pools.delete(key);
      }
    }
  }

  /**
   * Close all pools
   */
  async closeAll(): Promise<void> {
    const promises = Array.from(this.pools.values()).map((pool) => pool.end());
    await Promise.all(promises);
    this.pools.clear();
  }

  /**
   * Get all pool statistics
   */
  getAllStats(): Record<string, { total: number; idle: number; waiting: number }> {
    const stats: Record<string, { total: number; idle: number; waiting: number }> = {};
    for (const [key, pool] of this.pools.entries()) {
      stats[key] = pool.getStats();
    }
    return stats;
  }
}
