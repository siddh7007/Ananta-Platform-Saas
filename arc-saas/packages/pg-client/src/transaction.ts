/**
 * Transaction utilities for tenant database operations
 */

import { PoolClient } from 'pg';
import { TenantPool } from './pool';
import { TransactionError } from './errors';
import { TransactionOptions } from './types';

/**
 * Execute operations within a transaction
 */
export async function withTransaction<T>(
  pool: TenantPool,
  callback: (client: PoolClient) => Promise<T>,
  options?: TransactionOptions
): Promise<T> {
  const client = await pool.getClient();

  try {
    // Start transaction with optional isolation level
    let beginSql = 'BEGIN';
    if (options?.isolationLevel) {
      beginSql += ` ISOLATION LEVEL ${options.isolationLevel}`;
    }
    if (options?.readOnly) {
      beginSql += ' READ ONLY';
    }

    await client.query(beginSql);

    const result = await callback(client);

    await client.query('COMMIT');

    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw new TransactionError(
      `Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error instanceof Error ? error : undefined
    );
  } finally {
    client.release();
  }
}

/**
 * Transaction helper class for more control
 */
export class Transaction {
  private client: PoolClient | null = null;
  private committed = false;
  private rolledBack = false;

  constructor(private pool: TenantPool) {}

  /**
   * Begin the transaction
   */
  async begin(options?: TransactionOptions): Promise<void> {
    if (this.client) {
      throw new TransactionError('Transaction already started');
    }

    this.client = await this.pool.getClient();

    let beginSql = 'BEGIN';
    if (options?.isolationLevel) {
      beginSql += ` ISOLATION LEVEL ${options.isolationLevel}`;
    }
    if (options?.readOnly) {
      beginSql += ' READ ONLY';
    }

    await this.client.query(beginSql);
  }

  /**
   * Execute a query within the transaction
   */
  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number }> {
    if (!this.client) {
      throw new TransactionError('Transaction not started');
    }
    if (this.committed || this.rolledBack) {
      throw new TransactionError('Transaction already ended');
    }

    const result = await this.client.query(sql, params);
    return {
      rows: result.rows as T[],
      rowCount: result.rowCount || 0,
    };
  }

  /**
   * Commit the transaction
   */
  async commit(): Promise<void> {
    if (!this.client) {
      throw new TransactionError('Transaction not started');
    }
    if (this.committed || this.rolledBack) {
      throw new TransactionError('Transaction already ended');
    }

    await this.client.query('COMMIT');
    this.committed = true;
    this.client.release();
    this.client = null;
  }

  /**
   * Rollback the transaction
   */
  async rollback(): Promise<void> {
    if (!this.client) {
      throw new TransactionError('Transaction not started');
    }
    if (this.committed || this.rolledBack) {
      throw new TransactionError('Transaction already ended');
    }

    await this.client.query('ROLLBACK');
    this.rolledBack = true;
    this.client.release();
    this.client = null;
  }

  /**
   * Create a savepoint
   */
  async savepoint(name: string): Promise<void> {
    if (!this.client) {
      throw new TransactionError('Transaction not started');
    }
    await this.client.query(`SAVEPOINT ${name}`);
  }

  /**
   * Rollback to a savepoint
   */
  async rollbackTo(name: string): Promise<void> {
    if (!this.client) {
      throw new TransactionError('Transaction not started');
    }
    await this.client.query(`ROLLBACK TO SAVEPOINT ${name}`);
  }

  /**
   * Release a savepoint
   */
  async releaseSavepoint(name: string): Promise<void> {
    if (!this.client) {
      throw new TransactionError('Transaction not started');
    }
    await this.client.query(`RELEASE SAVEPOINT ${name}`);
  }

  /**
   * Get transaction state
   */
  get state(): 'pending' | 'active' | 'committed' | 'rolledBack' {
    if (this.committed) return 'committed';
    if (this.rolledBack) return 'rolledBack';
    if (this.client) return 'active';
    return 'pending';
  }
}
