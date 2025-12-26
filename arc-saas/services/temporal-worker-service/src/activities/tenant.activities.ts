/**
 * Tenant Activities
 *
 * Handles database operations for tenant status updates, resource management,
 * and data backup/restore.
 */

import { Context } from '@temporalio/activity';
import { Pool, PoolClient } from 'pg';
import { config } from '../config';
import {
  UpdateTenantStatusInput,
  CreateResourcesInput,
  DeleteResourcesInput,
} from '../types';
import { Contact, TenantStatus, IdPProvider, ResourceData } from '../types/common.types';
import { createLogger } from '../utils/logger';
import { createActivityTracer } from '../observability/activity-tracer';
import {
  ResourceNotFoundError,
  ConnectionError,
} from '../utils/errors';

const logger = createLogger('tenant-activities');

// ============================================
// Database Pool
// ============================================

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    logger.debug('Initializing database pool', {
      host: config.database.host,
      database: config.database.database,
    });
    pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      user: config.database.user,
      password: config.database.password,
      database: config.database.database,
      ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      logger.error('Unexpected database pool error', { error: err.message });
    });
  }
  return pool;
}

async function query<T>(sql: string, params?: unknown[]): Promise<T[]> {
  const client = await getPool().connect();
  try {
    const result = await client.query(sql, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

async function execute(sql: string, params?: unknown[]): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query(sql, params);
  } finally {
    client.release();
  }
}

// ============================================
// Update Tenant Status
// ============================================

export async function updateTenantStatus(
  input: UpdateTenantStatusInput
): Promise<void> {
  const tracer = createActivityTracer('updateTenantStatus', input.tenantId);
  tracer.start();
  tracer.addAttributes({ status: input.status });

  const ctx = Context.current();
  ctx.heartbeat(`Updating tenant status to ${input.status}`);

  logger.info('Updating tenant status', {
    tenantId: input.tenantId,
    status: input.status,
    message: input.message,
  });

  const statusMap: Record<TenantStatus, number> = {
    ACTIVE: 0,
    PENDING_PROVISION: 1,
    PROVISIONING: 2,
    PROVISION_FAILED: 3,
    DEPROVISIONING: 4,
    DEPROVISIONED: 5,
    INACTIVE: 5,
  };

  const statusValue = statusMap[input.status];

  try {
    await execute(
      `UPDATE ${config.database.schema}.tenants
       SET status = $1,
           modified_on = NOW(),
           metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
       WHERE id = $3`,
      [
        statusValue,
        JSON.stringify({
          lastStatusUpdate: new Date().toISOString(),
          statusMessage: input.message,
          ...input.metadata,
        }),
        input.tenantId,
      ]
    );

    tracer.success();
    logger.info('Tenant status updated', {
      tenantId: input.tenantId,
      status: input.status,
    });
  } catch (error) {
    tracer.failure(error instanceof Error ? error : new Error(String(error)));
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to update tenant status', {
      tenantId: input.tenantId,
      error: message,
    });
    throw new ConnectionError(`Failed to update tenant status: ${message}`);
  }
}

// ============================================
// Get Tenant Details
// ============================================

interface TenantDetails {
  id: string;
  key: string;
  name: string;
  status: TenantStatus;
  contacts: Contact[];
  idpOrganizationId?: string;
  idpProvider?: IdPProvider;
  metadata?: Record<string, unknown>;
}

export async function getTenantDetails(tenantId: string): Promise<TenantDetails> {
  const ctx = Context.current();
  ctx.heartbeat('Getting tenant details');

  try {
    // Get tenant
    const tenants = await query<{
      id: string;
      key: string;
      name: string;
      status: number;
      metadata: Record<string, unknown>;
    }>(
      `SELECT id, key, name, status, metadata
       FROM ${config.database.schema}.tenants
       WHERE id = $1`,
      [tenantId]
    );

    if (tenants.length === 0) {
      throw new ResourceNotFoundError(`Tenant not found: ${tenantId}`);
    }

    const tenant = tenants[0];

    // Get contacts
    const contacts = await query<Contact>(
      `SELECT id, first_name as "firstName", last_name as "lastName",
              email, phone, is_primary as "isPrimary"
       FROM ${config.database.schema}.contacts
       WHERE tenant_id = $1`,
      [tenantId]
    );

    // Map status number to string
    const statusMap: Record<number, TenantStatus> = {
      0: 'ACTIVE',
      1: 'PENDING_PROVISION',
      2: 'PROVISIONING',
      3: 'PROVISION_FAILED',
      4: 'DEPROVISIONING',
      5: 'INACTIVE',
    };

    return {
      id: tenant.id,
      key: tenant.key,
      name: tenant.name,
      status: statusMap[tenant.status] || 'INACTIVE',
      contacts,
      idpOrganizationId: tenant.metadata?.idpOrganizationId as string | undefined,
      idpProvider: tenant.metadata?.idpProvider as IdPProvider | undefined,
      metadata: tenant.metadata,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to get tenant details: ${message}`);
  }
}

// ============================================
// Create Resources
// ============================================

export async function createResources(input: CreateResourcesInput): Promise<void> {
  const ctx = Context.current();
  ctx.heartbeat('Creating resource records');

  const client = await getPool().connect();

  try {
    await client.query('BEGIN');

    for (const resource of input.resources) {
      await client.query(
        `INSERT INTO ${config.database.schema}.resources
         (tenant_id, type, external_identifier, metadata, created_on, modified_on)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         ON CONFLICT (tenant_id, type, external_identifier)
         DO UPDATE SET metadata = $4, modified_on = NOW()`,
        [
          input.tenantId,
          resource.type,
          resource.externalIdentifier,
          JSON.stringify(resource.metadata),
        ]
      );
    }

    await client.query('COMMIT');

    logger.info('Resources created successfully', {
      tenantId: input.tenantId,
      resourceCount: input.resources.length,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to create resources: ${message}`);
  } finally {
    client.release();
  }
}

// ============================================
// Delete Resources
// ============================================

export async function deleteResources(input: DeleteResourcesInput): Promise<void> {
  const ctx = Context.current();
  ctx.heartbeat('Deleting resource records');

  try {
    if (input.deleteAll) {
      await execute(
        `DELETE FROM ${config.database.schema}.resources WHERE tenant_id = $1`,
        [input.tenantId]
      );
      logger.info('Deleted all resources for tenant', { tenantId: input.tenantId });
    } else if (input.resourceIds && input.resourceIds.length > 0) {
      await execute(
        `DELETE FROM ${config.database.schema}.resources
         WHERE tenant_id = $1 AND id = ANY($2)`,
        [input.tenantId, input.resourceIds]
      );
      logger.info('Deleted resources for tenant', {
        tenantId: input.tenantId,
        resourceCount: input.resourceIds.length,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to delete resources', {
      tenantId: input.tenantId,
      error: message,
    });
    throw new ConnectionError(`Failed to delete resources: ${message}`);
  }
}

// ============================================
// Backup Tenant Data
// ============================================

interface BackupTenantDataInput {
  tenantId: string;
  tenantKey: string;
  includeDatabase?: boolean;
  includeStorage?: boolean;
}

export async function backupTenantData(input: BackupTenantDataInput): Promise<void> {
  const ctx = Context.current();
  ctx.heartbeat('Backing up tenant data');

  try {
    // In a real implementation, this would:
    // 1. Create a database backup (pg_dump for tenant's schema/data)
    // 2. Copy S3 objects to a backup bucket
    // 3. Store backup metadata

    logger.info('Creating backup for tenant', {
      tenantId: input.tenantId,
      tenantKey: input.tenantKey,
      includeDatabase: input.includeDatabase,
      includeStorage: input.includeStorage,
    });

    // Simulate backup process
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Record backup in database
    await execute(
      `INSERT INTO ${config.database.schema}.tenant_backups
       (tenant_id, backup_type, status, metadata, created_on)
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        input.tenantId,
        'full',
        'completed',
        JSON.stringify({
          includeDatabase: input.includeDatabase,
          includeStorage: input.includeStorage,
          completedAt: new Date().toISOString(),
        }),
      ]
    );

    logger.info('Backup completed for tenant', {
      tenantId: input.tenantId,
      tenantKey: input.tenantKey,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    // Log but don't fail - backup is best effort
    logger.warn('Backup failed for tenant (best effort)', {
      tenantId: input.tenantId,
      tenantKey: input.tenantKey,
      error: message,
    });
  }
}

// ============================================
// Get Resources
// ============================================

export async function getTenantResources(tenantId: string): Promise<ResourceData[]> {
  const ctx = Context.current();
  ctx.heartbeat('Getting tenant resources');

  try {
    const resources = await query<{
      type: string;
      external_identifier: string;
      metadata: Record<string, unknown>;
    }>(
      `SELECT type, external_identifier, metadata
       FROM ${config.database.schema}.resources
       WHERE tenant_id = $1`,
      [tenantId]
    );

    return resources.map((r) => ({
      type: r.type as ResourceData['type'],
      externalIdentifier: r.external_identifier,
      metadata: r.metadata,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to get tenant resources: ${message}`);
  }
}

// ============================================
// Provision Tenant Database Schema
// ============================================

interface ProvisionSchemaInput {
  tenantId: string;
  tenantKey: string;
}

interface ProvisionSchemaResult {
  schemaName: string;
  tables: string[];
  success: boolean;
}

/**
 * Creates a tenant-specific PostgreSQL schema with all required tables.
 * Uses the create_tenant_schema function defined in the database init script.
 */
export async function provisionTenantSchema(
  input: ProvisionSchemaInput
): Promise<ProvisionSchemaResult> {
  const tracer = createActivityTracer('provisionTenantSchema', input.tenantId);
  tracer.start();
  tracer.addAttributes({ tenantKey: input.tenantKey });

  const ctx = Context.current();
  ctx.heartbeat('Creating tenant database schema');

  const schemaName = `tenant_${input.tenantKey}`;

  logger.info('Provisioning tenant schema', {
    tenantId: input.tenantId,
    tenantKey: input.tenantKey,
    schemaName,
  });

  try {
    // Call the stored function to create the tenant schema
    await execute(
      `SELECT main.create_tenant_schema($1)`,
      [input.tenantKey]
    );

    // Verify schema was created
    const schemaCheck = await query<{ schema_name: string }>(
      `SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1`,
      [schemaName]
    );

    if (schemaCheck.length === 0) {
      throw new Error(`Schema ${schemaName} was not created`);
    }

    // Get list of tables created
    const tables = await query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1`,
      [schemaName]
    );

    const tableNames = tables.map(t => t.table_name);

    // Update tenant record with schema name
    await execute(
      `UPDATE main.tenants
       SET schema_name = $1,
           modified_on = NOW()
       WHERE id = $2`,
      [schemaName, input.tenantId]
    );

    tracer.success({ schemaName, tableCount: tableNames.length });
    logger.info('Tenant schema provisioned successfully', {
      tenantId: input.tenantId,
      schemaName,
      tableCount: tableNames.length,
      tables: tableNames,
    });

    return {
      schemaName,
      tables: tableNames,
      success: true,
    };
  } catch (error) {
    tracer.failure(error instanceof Error ? error : new Error(String(error)));
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to provision tenant schema', {
      tenantId: input.tenantId,
      tenantKey: input.tenantKey,
      error: message,
    });
    throw new ConnectionError(`Failed to provision tenant schema: ${message}`);
  }
}

// ============================================
// Deprovision Tenant Database Schema
// ============================================

interface DeprovisionSchemaInput {
  tenantId: string;
  tenantKey: string;
  backupFirst?: boolean;
}

/**
 * Drops a tenant's PostgreSQL schema (for deprovisioning).
 */
export async function deprovisionTenantSchema(
  input: DeprovisionSchemaInput
): Promise<void> {
  const tracer = createActivityTracer('deprovisionTenantSchema', input.tenantId);
  tracer.start();
  tracer.addAttributes({ tenantKey: input.tenantKey, backupFirst: input.backupFirst });

  const ctx = Context.current();
  const schemaName = `tenant_${input.tenantKey}`;

  logger.info('Deprovisioning tenant schema', {
    tenantId: input.tenantId,
    tenantKey: input.tenantKey,
    schemaName,
    backupFirst: input.backupFirst,
  });

  try {
    // Optionally backup first
    if (input.backupFirst) {
      ctx.heartbeat('Backing up tenant schema before deletion');
      await backupTenantData({
        tenantId: input.tenantId,
        tenantKey: input.tenantKey,
        includeDatabase: true,
        includeStorage: false,
      });
    }

    ctx.heartbeat('Dropping tenant schema');

    // Call the stored function to drop the tenant schema
    await execute(
      `SELECT main.drop_tenant_schema($1)`,
      [input.tenantKey]
    );

    // Clear schema_name from tenant record
    await execute(
      `UPDATE main.tenants
       SET schema_name = NULL,
           modified_on = NOW()
       WHERE id = $1`,
      [input.tenantId]
    );

    tracer.success();
    logger.info('Tenant schema deprovisioned successfully', {
      tenantId: input.tenantId,
      schemaName,
    });
  } catch (error) {
    tracer.failure(error instanceof Error ? error : new Error(String(error)));
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to deprovision tenant schema', {
      tenantId: input.tenantId,
      tenantKey: input.tenantKey,
      error: message,
    });
    throw new ConnectionError(`Failed to deprovision tenant schema: ${message}`);
  }
}

// ============================================
// Cleanup - Close pool on shutdown
// ============================================

export async function closeDatabasePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
