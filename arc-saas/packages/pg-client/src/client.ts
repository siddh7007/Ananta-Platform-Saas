/**
 * Tenant PostgreSQL Client
 *
 * High-level client for tenant database operations with
 * built-in schema isolation and query utilities.
 */

import { TenantPool, createTenantPool } from './pool';
import { TenantPgConfig, TenantConnectionOptions, QueryResult, PaginatedResult } from './types';
import { QueryError } from './errors';

/**
 * High-level PostgreSQL client for tenant operations
 */
export class TenantPgClient {
  private pool: TenantPool;
  private options: TenantConnectionOptions;

  constructor(config: TenantPgConfig, options: TenantConnectionOptions) {
    this.options = options;
    this.pool = createTenantPool(config, options);
  }

  /**
   * Get tenant info
   */
  get tenant() {
    return this.pool.getTenant();
  }

  /**
   * Execute a raw query
   */
  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<QueryResult<T>> {
    try {
      const result = await this.pool.query<T>(sql, params);
      return {
        rows: result.rows,
        rowCount: result.rowCount,
        fields: [],
      };
    } catch (error) {
      throw new QueryError(
        `Query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        sql,
        params,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Find all records from a table
   */
  async findAll<T extends Record<string, unknown>>(
    table: string,
    options?: {
      where?: Record<string, unknown>;
      orderBy?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<T[]> {
    let sql = `SELECT * FROM ${table}`;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (options?.where && Object.keys(options.where).length > 0) {
      const conditions = Object.entries(options.where).map(([key, value]) => {
        params.push(value);
        return `${key} = $${paramIndex++}`;
      });
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    if (options?.orderBy) {
      sql += ` ORDER BY ${options.orderBy}`;
    }

    if (options?.limit) {
      sql += ` LIMIT ${options.limit}`;
    }

    if (options?.offset) {
      sql += ` OFFSET ${options.offset}`;
    }

    const result = await this.query<T>(sql, params);
    return result.rows;
  }

  /**
   * Find one record by ID or conditions
   */
  async findOne<T extends Record<string, unknown>>(
    table: string,
    where: Record<string, unknown>
  ): Promise<T | null> {
    const results = await this.findAll<T>(table, { where, limit: 1 });
    return results[0] || null;
  }

  /**
   * Find by ID
   */
  async findById<T extends Record<string, unknown>>(
    table: string,
    id: string | number,
    idColumn = 'id'
  ): Promise<T | null> {
    return this.findOne<T>(table, { [idColumn]: id });
  }

  /**
   * Find with pagination
   */
  async findPaginated<T extends Record<string, unknown>>(
    table: string,
    options: {
      page?: number;
      pageSize?: number;
      where?: Record<string, unknown>;
      orderBy?: string;
    } = {}
  ): Promise<PaginatedResult<T>> {
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const offset = (page - 1) * pageSize;

    // Get total count
    let countSql = `SELECT COUNT(*) as total FROM ${table}`;
    const countParams: unknown[] = [];

    if (options.where && Object.keys(options.where).length > 0) {
      let paramIndex = 1;
      const conditions = Object.entries(options.where).map(([key, value]) => {
        countParams.push(value);
        return `${key} = $${paramIndex++}`;
      });
      countSql += ` WHERE ${conditions.join(' AND ')}`;
    }

    const countResult = await this.query<{ total: string }>(countSql, countParams);
    const total = parseInt(countResult.rows[0]?.total || '0', 10);

    // Get data
    const data = await this.findAll<T>(table, {
      where: options.where,
      orderBy: options.orderBy,
      limit: pageSize,
      offset,
    });

    const totalPages = Math.ceil(total / pageSize);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  /**
   * Insert a record
   */
  async insert<T extends Record<string, unknown>>(
    table: string,
    data: Record<string, unknown>
  ): Promise<T> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`);

    const sql = `
      INSERT INTO ${table} (${keys.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;

    const result = await this.query<T>(sql, values);
    return result.rows[0];
  }

  /**
   * Insert multiple records
   */
  async insertMany<T extends Record<string, unknown>>(
    table: string,
    records: Record<string, unknown>[]
  ): Promise<T[]> {
    if (records.length === 0) return [];

    const keys = Object.keys(records[0]);
    const values: unknown[] = [];
    const valuePlaceholders: string[] = [];

    records.forEach((record, rowIndex) => {
      const rowPlaceholders = keys.map((key, colIndex) => {
        values.push(record[key]);
        return `$${rowIndex * keys.length + colIndex + 1}`;
      });
      valuePlaceholders.push(`(${rowPlaceholders.join(', ')})`);
    });

    const sql = `
      INSERT INTO ${table} (${keys.join(', ')})
      VALUES ${valuePlaceholders.join(', ')}
      RETURNING *
    `;

    const result = await this.query<T>(sql, values);
    return result.rows;
  }

  /**
   * Update records
   */
  async update<T extends Record<string, unknown>>(
    table: string,
    where: Record<string, unknown>,
    data: Record<string, unknown>
  ): Promise<T[]> {
    const dataKeys = Object.keys(data);
    const dataValues = Object.values(data);
    const whereKeys = Object.keys(where);
    const whereValues = Object.values(where);

    let paramIndex = 1;
    const setClause = dataKeys.map((key) => `${key} = $${paramIndex++}`).join(', ');
    const whereClause = whereKeys.map((key) => `${key} = $${paramIndex++}`).join(' AND ');

    const sql = `
      UPDATE ${table}
      SET ${setClause}
      WHERE ${whereClause}
      RETURNING *
    `;

    const result = await this.query<T>(sql, [...dataValues, ...whereValues]);
    return result.rows;
  }

  /**
   * Update by ID
   */
  async updateById<T extends Record<string, unknown>>(
    table: string,
    id: string | number,
    data: Record<string, unknown>,
    idColumn = 'id'
  ): Promise<T | null> {
    const results = await this.update<T>(table, { [idColumn]: id }, data);
    return results[0] || null;
  }

  /**
   * Delete records
   */
  async delete(table: string, where: Record<string, unknown>): Promise<number> {
    const keys = Object.keys(where);
    const values = Object.values(where);
    const whereClause = keys.map((key, i) => `${key} = $${i + 1}`).join(' AND ');

    const sql = `DELETE FROM ${table} WHERE ${whereClause}`;
    const result = await this.query(sql, values);
    return result.rowCount;
  }

  /**
   * Delete by ID
   */
  async deleteById(
    table: string,
    id: string | number,
    idColumn = 'id'
  ): Promise<boolean> {
    const count = await this.delete(table, { [idColumn]: id });
    return count > 0;
  }

  /**
   * Check if record exists
   */
  async exists(table: string, where: Record<string, unknown>): Promise<boolean> {
    const keys = Object.keys(where);
    const values = Object.values(where);
    const whereClause = keys.map((key, i) => `${key} = $${i + 1}`).join(' AND ');

    const sql = `SELECT 1 FROM ${table} WHERE ${whereClause} LIMIT 1`;
    const result = await this.query(sql, values);
    return result.rowCount > 0;
  }

  /**
   * Count records
   */
  async count(table: string, where?: Record<string, unknown>): Promise<number> {
    let sql = `SELECT COUNT(*) as count FROM ${table}`;
    const params: unknown[] = [];

    if (where && Object.keys(where).length > 0) {
      const conditions = Object.entries(where).map(([key, value], i) => {
        params.push(value);
        return `${key} = $${i + 1}`;
      });
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    const result = await this.query<{ count: string }>(sql, params);
    return parseInt(result.rows[0]?.count || '0', 10);
  }

  /**
   * Verify connection and schema
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.pool.verifySchema();
      await this.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get pool statistics
   */
  getPoolStats() {
    return this.pool.getStats();
  }

  /**
   * Close the client
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}

/**
 * Create a tenant client
 */
export function createTenantClient(
  config: TenantPgConfig,
  options: TenantConnectionOptions
): TenantPgClient {
  return new TenantPgClient(config, options);
}
