/**
 * Fluent query builder for tenant database operations
 */

import { TenantPgClient } from './client';

type OrderDirection = 'ASC' | 'DESC';
type WhereOperator = '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'ILIKE' | 'IN' | 'NOT IN' | 'IS NULL' | 'IS NOT NULL';

interface WhereCondition {
  column: string;
  operator: WhereOperator;
  value: unknown;
}

interface OrderClause {
  column: string;
  direction: OrderDirection;
}

/**
 * Fluent query builder
 */
export class TenantQueryBuilder<T extends Record<string, unknown> = Record<string, unknown>> {
  private _table: string;
  private _select: string[] = ['*'];
  private _where: WhereCondition[] = [];
  private _orderBy: OrderClause[] = [];
  private _limit?: number;
  private _offset?: number;
  private _joins: string[] = [];
  private _groupBy: string[] = [];
  private _having: string[] = [];

  constructor(
    private client: TenantPgClient,
    table: string
  ) {
    this._table = table;
  }

  /**
   * Select specific columns
   */
  select(...columns: string[]): this {
    this._select = columns;
    return this;
  }

  /**
   * Add a where clause
   */
  where(column: string, operator: WhereOperator, value: unknown): this;
  where(column: string, value: unknown): this;
  where(column: string, operatorOrValue: WhereOperator | unknown, value?: unknown): this {
    if (value === undefined) {
      this._where.push({ column, operator: '=', value: operatorOrValue });
    } else {
      this._where.push({ column, operator: operatorOrValue as WhereOperator, value });
    }
    return this;
  }

  /**
   * Where equals
   */
  whereEquals(column: string, value: unknown): this {
    return this.where(column, '=', value);
  }

  /**
   * Where not equals
   */
  whereNot(column: string, value: unknown): this {
    return this.where(column, '!=', value);
  }

  /**
   * Where in array
   */
  whereIn(column: string, values: unknown[]): this {
    return this.where(column, 'IN', values);
  }

  /**
   * Where not in array
   */
  whereNotIn(column: string, values: unknown[]): this {
    return this.where(column, 'NOT IN', values);
  }

  /**
   * Where null
   */
  whereNull(column: string): this {
    this._where.push({ column, operator: 'IS NULL', value: null });
    return this;
  }

  /**
   * Where not null
   */
  whereNotNull(column: string): this {
    this._where.push({ column, operator: 'IS NOT NULL', value: null });
    return this;
  }

  /**
   * Where like (case-sensitive)
   */
  whereLike(column: string, pattern: string): this {
    return this.where(column, 'LIKE', pattern);
  }

  /**
   * Where ilike (case-insensitive)
   */
  whereILike(column: string, pattern: string): this {
    return this.where(column, 'ILIKE', pattern);
  }

  /**
   * Add order by
   */
  orderBy(column: string, direction: OrderDirection = 'ASC'): this {
    this._orderBy.push({ column, direction });
    return this;
  }

  /**
   * Order by descending
   */
  orderByDesc(column: string): this {
    return this.orderBy(column, 'DESC');
  }

  /**
   * Set limit
   */
  limit(count: number): this {
    this._limit = count;
    return this;
  }

  /**
   * Set offset
   */
  offset(count: number): this {
    this._offset = count;
    return this;
  }

  /**
   * Add a join
   */
  join(table: string, on: string): this {
    this._joins.push(`JOIN ${table} ON ${on}`);
    return this;
  }

  /**
   * Add a left join
   */
  leftJoin(table: string, on: string): this {
    this._joins.push(`LEFT JOIN ${table} ON ${on}`);
    return this;
  }

  /**
   * Add group by
   */
  groupBy(...columns: string[]): this {
    this._groupBy.push(...columns);
    return this;
  }

  /**
   * Build the SQL query
   */
  private buildSelect(): { sql: string; params: unknown[] } {
    const params: unknown[] = [];
    let paramIndex = 1;

    let sql = `SELECT ${this._select.join(', ')} FROM ${this._table}`;

    // Joins
    if (this._joins.length > 0) {
      sql += ` ${this._joins.join(' ')}`;
    }

    // Where clauses
    if (this._where.length > 0) {
      const conditions = this._where.map((w) => {
        if (w.operator === 'IS NULL' || w.operator === 'IS NOT NULL') {
          return `${w.column} ${w.operator}`;
        }
        if (w.operator === 'IN' || w.operator === 'NOT IN') {
          const values = w.value as unknown[];
          const placeholders = values.map(() => `$${paramIndex++}`);
          params.push(...values);
          return `${w.column} ${w.operator} (${placeholders.join(', ')})`;
        }
        params.push(w.value);
        return `${w.column} ${w.operator} $${paramIndex++}`;
      });
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Group by
    if (this._groupBy.length > 0) {
      sql += ` GROUP BY ${this._groupBy.join(', ')}`;
    }

    // Having
    if (this._having.length > 0) {
      sql += ` HAVING ${this._having.join(' AND ')}`;
    }

    // Order by
    if (this._orderBy.length > 0) {
      const orders = this._orderBy.map((o) => `${o.column} ${o.direction}`);
      sql += ` ORDER BY ${orders.join(', ')}`;
    }

    // Limit
    if (this._limit !== undefined) {
      sql += ` LIMIT ${this._limit}`;
    }

    // Offset
    if (this._offset !== undefined) {
      sql += ` OFFSET ${this._offset}`;
    }

    return { sql, params };
  }

  /**
   * Execute the query and get all results
   */
  async get(): Promise<T[]> {
    const { sql, params } = this.buildSelect();
    const result = await this.client.query<T>(sql, params);
    return result.rows;
  }

  /**
   * Get first result
   */
  async first(): Promise<T | null> {
    this._limit = 1;
    const results = await this.get();
    return results[0] || null;
  }

  /**
   * Get count
   */
  async count(): Promise<number> {
    const originalSelect = this._select;
    this._select = ['COUNT(*) as count'];
    const { sql, params } = this.buildSelect();
    this._select = originalSelect;

    const result = await this.client.query<{ count: string }>(sql, params);
    return parseInt(result.rows[0]?.count || '0', 10);
  }

  /**
   * Check if any records exist
   */
  async exists(): Promise<boolean> {
    const count = await this.count();
    return count > 0;
  }

  /**
   * Get paginated results
   */
  async paginate(page = 1, pageSize = 20) {
    const total = await this.count();
    const totalPages = Math.ceil(total / pageSize);

    this._limit = pageSize;
    this._offset = (page - 1) * pageSize;

    const data = await this.get();

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
   * Pluck a single column
   */
  async pluck<K extends keyof T>(column: K): Promise<T[K][]> {
    this._select = [column as string];
    const results = await this.get();
    return results.map((r) => r[column]);
  }

  /**
   * Get the raw SQL
   */
  toSql(): { sql: string; params: unknown[] } {
    return this.buildSelect();
  }
}
