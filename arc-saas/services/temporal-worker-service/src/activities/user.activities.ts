/**
 * User Provisioning Activities
 *
 * Handles user creation and setup for customer signups within a tenant.
 * This includes:
 * - Creating user in Keycloak (within tenant's realm)
 * - Creating user profile in the database
 * - Sending welcome notification via Novu
 */

import { Context } from '@temporalio/activity';
import KcAdminClient from '@keycloak/keycloak-admin-client';
import { Pool } from 'pg';
import { Novu } from '@novu/api';
import { config } from '../config';
import { createLogger } from '../utils/logger';
import { createActivityTracer } from '../observability/activity-tracer';
import { generateSecurePassword } from '../utils/crypto';
import {
  InvalidConfigurationError,
  InvalidCredentialsError,
  ResourceNotFoundError,
  ServiceUnavailableError,
} from '../utils/errors';

const logger = createLogger('user-activities');

// ============================================
// Types
// ============================================

export interface CreateUserInput {
  tenantId: string;
  tenantKey: string;
  email: string;
  firstName: string;
  lastName: string;
  password?: string;
  role?: string;
  metadata?: Record<string, string>;
}

export interface CreateUserResult {
  userId: string;
  email: string;
  keycloakUserId?: string;
  createdAt: string;
}

export interface CreateUserProfileInput {
  tenantId: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  metadata?: Record<string, string>;
}

export interface SendUserWelcomeInput {
  tenantId: string;
  tenantKey: string;
  tenantName: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  loginUrl: string;
  appUrl: string;
}

// ============================================
// Database Pool
// ============================================

let dbPool: Pool | null = null;

function getDbPool(): Pool {
  if (!dbPool) {
    dbPool = new Pool({
      host: config.database.host,
      port: config.database.port,
      user: config.database.user,
      password: config.database.password,
      database: config.database.database,
      ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
      max: 10,
    });
  }
  return dbPool;
}

// ============================================
// Keycloak Client
// ============================================

async function getKeycloakClient(realmName: string): Promise<KcAdminClient> {
  if (!config.keycloak.enabled) {
    throw new InvalidConfigurationError('Keycloak is not configured');
  }

  const kcClient = new KcAdminClient({
    baseUrl: config.keycloak.url,
    realmName: realmName,
  });

  try {
    // Authenticate with master realm first
    kcClient.setConfig({ realmName: 'master' });
    await kcClient.auth({
      clientId: config.keycloak.adminClientId,
      username: config.keycloak.adminUsername,
      password: config.keycloak.adminPassword,
      grantType: 'password',
    });
    // Then switch to target realm
    kcClient.setConfig({ realmName });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Keycloak authentication failed', { error: message });
    throw new InvalidCredentialsError(`Keycloak authentication failed: ${message}`);
  }

  return kcClient;
}

// ============================================
// Novu Client
// ============================================

let novuClient: Novu | null = null;

function getNovuClient(): Novu {
  if (!config.novu.enabled) {
    throw new InvalidConfigurationError('Novu is not enabled');
  }

  if (!novuClient) {
    novuClient = new Novu({
      secretKey: config.novu.apiKey,
      serverURL: config.novu.backendUrl,
    });
  }

  return novuClient;
}

// ============================================
// Create User in Keycloak
// ============================================

export async function createKeycloakUser(input: CreateUserInput): Promise<CreateUserResult> {
  const tracer = createActivityTracer('createKeycloakUser', input.tenantId);
  tracer.start();
  tracer.addAttributes({ email: input.email, tenantKey: input.tenantKey });

  const ctx = Context.current();
  ctx.heartbeat('Creating user in Keycloak');

  logger.info('Creating user in Keycloak', {
    tenantId: input.tenantId,
    tenantKey: input.tenantKey,
    email: input.email,
  });

  // Tenant realm name convention
  const realmName = `tenant-${input.tenantKey}`;

  try {
    const kc = await getKeycloakClient(realmName);

    // Check if realm exists
    ctx.heartbeat('Checking realm existence');
    try {
      await kc.realms.findOne({ realm: realmName });
    } catch (error) {
      throw new ResourceNotFoundError('Tenant realm', `${realmName} - Please provision the tenant first`);
    }

    // Check if user already exists
    const existingUsers = await kc.users.find({
      realm: realmName,
      email: input.email,
    });

    if (existingUsers.length > 0) {
      logger.info('User already exists in Keycloak', {
        email: input.email,
        userId: existingUsers[0].id,
      });

      tracer.success({ userId: existingUsers[0].id, existing: true });
      return {
        userId: existingUsers[0].id!,
        email: input.email,
        keycloakUserId: existingUsers[0].id,
        createdAt: new Date().toISOString(),
      };
    }

    // Create the user
    ctx.heartbeat('Creating Keycloak user');

    const tempPassword = input.password || generateSecurePassword();

    await kc.users.create({
      realm: realmName,
      username: input.email,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      enabled: true,
      emailVerified: false,
      credentials: [
        {
          type: 'password',
          value: tempPassword,
          temporary: !input.password, // If password provided, don't make it temporary
        },
      ],
      attributes: {
        tenantId: [input.tenantId],
        role: [input.role || 'user'],
        ...Object.fromEntries(
          Object.entries(input.metadata || {}).map(([k, v]) => [k, [v]])
        ),
      },
    });

    // Get the created user's ID
    const users = await kc.users.find({
      realm: realmName,
      email: input.email,
    });

    const userId = users[0]?.id;

    if (!userId) {
      throw new Error('User was created but could not be retrieved');
    }

    // Assign role if specified
    if (input.role && input.role !== 'user') {
      ctx.heartbeat('Assigning user role');

      // Get realm roles
      const realmRoles = await kc.roles.find({ realm: realmName });
      const targetRole = realmRoles.find((r) => r.name === input.role);

      if (targetRole) {
        await kc.users.addRealmRoleMappings({
          realm: realmName,
          id: userId,
          roles: [{ id: targetRole.id!, name: targetRole.name! }],
        });
      }
    }

    logger.info('User created in Keycloak successfully', {
      tenantId: input.tenantId,
      email: input.email,
      userId,
    });

    tracer.success({ userId });
    return {
      userId,
      email: input.email,
      keycloakUserId: userId,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    tracer.failure(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

// ============================================
// Create User Profile in Database
// ============================================

export async function createUserProfile(input: CreateUserProfileInput): Promise<void> {
  const tracer = createActivityTracer('createUserProfile', input.tenantId);
  tracer.start();
  tracer.addAttributes({ email: input.email, userId: input.userId });

  const ctx = Context.current();
  ctx.heartbeat('Creating user profile in database');

  logger.info('Creating user profile in database', {
    tenantId: input.tenantId,
    userId: input.userId,
    email: input.email,
  });

  const pool = getDbPool();

  try {
    // Check if profile already exists
    const existing = await pool.query(
      `SELECT id FROM ${config.database.schema}.user_profiles WHERE tenant_id = $1 AND email = $2`,
      [input.tenantId, input.email]
    );

    if (existing.rows.length > 0) {
      logger.info('User profile already exists', {
        tenantId: input.tenantId,
        email: input.email,
      });
      tracer.success({ existing: true });
      return;
    }

    // Create the profile
    await pool.query(
      `INSERT INTO ${config.database.schema}.user_profiles
       (id, tenant_id, keycloak_user_id, email, first_name, last_name, role, metadata, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
      [
        input.userId,
        input.tenantId,
        input.userId,
        input.email,
        input.firstName,
        input.lastName,
        input.role,
        JSON.stringify(input.metadata || {}),
      ]
    );

    logger.info('User profile created successfully', {
      tenantId: input.tenantId,
      userId: input.userId,
    });

    tracer.success({ userId: input.userId });
  } catch (error) {
    tracer.failure(error instanceof Error ? error : new Error(String(error)));
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new ServiceUnavailableError(`Failed to create user profile: ${message}`);
  }
}

// ============================================
// Send User Welcome Notification
// ============================================

export async function sendUserWelcomeNotification(input: SendUserWelcomeInput): Promise<void> {
  const tracer = createActivityTracer('sendUserWelcomeNotification', input.tenantId);
  tracer.start();
  tracer.addAttributes({ email: input.email, userId: input.userId });

  const ctx = Context.current();
  ctx.heartbeat('Sending welcome notification');

  logger.info('Sending user welcome notification', {
    tenantId: input.tenantId,
    userId: input.userId,
    email: input.email,
  });

  if (!config.novu.enabled) {
    logger.warn('Novu not enabled, skipping welcome notification');
    tracer.success({ skipped: true });
    return;
  }

  try {
    const novu = getNovuClient();

    // Create subscriber ID for this user
    const subscriberId = `tenant-${input.tenantKey}-user-${input.userId}`;

    // Create or update subscriber
    ctx.heartbeat('Creating Novu subscriber');
    try {
      await novu.subscribers.create({
        subscriberId,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        data: {
          tenantId: input.tenantId,
          tenantKey: input.tenantKey,
        },
      });
    } catch (subError) {
      logger.debug('Subscriber may already exist', {
        subscriberId,
        note: subError instanceof Error ? subError.message : 'Unknown',
      });
    }

    // Trigger the welcome notification
    ctx.heartbeat('Triggering welcome notification');
    await novu.trigger({
      workflowId: 'user-welcome',
      to: {
        subscriberId,
        email: input.email,
      },
      payload: {
        firstName: input.firstName,
        lastName: input.lastName,
        tenantName: input.tenantName,
        loginUrl: input.loginUrl,
        appUrl: input.appUrl,
        supportEmail: config.novu.supportEmail,
      },
    });

    logger.info('User welcome notification sent', {
      tenantId: input.tenantId,
      userId: input.userId,
      email: input.email,
    });

    tracer.success({ subscriberId });
  } catch (error) {
    tracer.failure(error instanceof Error ? error : new Error(String(error)));
    // Don't throw - notification failure shouldn't fail the workflow
    logger.error('Failed to send welcome notification', {
      tenantId: input.tenantId,
      email: input.email,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// ============================================
// Delete User (for compensation/rollback)
// ============================================

export async function deleteKeycloakUser(
  tenantKey: string,
  userId: string
): Promise<void> {
  const tracer = createActivityTracer('deleteKeycloakUser', tenantKey);
  tracer.start();

  const ctx = Context.current();
  ctx.heartbeat('Deleting user from Keycloak');

  const realmName = `tenant-${tenantKey}`;

  try {
    const kc = await getKeycloakClient(realmName);
    await kc.users.del({ realm: realmName, id: userId });

    logger.info('User deleted from Keycloak', { tenantKey, userId });
    tracer.success();
  } catch (error) {
    tracer.failure(error instanceof Error ? error : new Error(String(error)));
    logger.error('Failed to delete user from Keycloak', {
      tenantKey,
      userId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    throw error;
  }
}

export async function deleteUserProfile(
  tenantId: string,
  userId: string
): Promise<void> {
  const tracer = createActivityTracer('deleteUserProfile', tenantId);
  tracer.start();

  const ctx = Context.current();
  ctx.heartbeat('Deleting user profile from database');

  const pool = getDbPool();

  try {
    await pool.query(
      `DELETE FROM ${config.database.schema}.user_profiles WHERE tenant_id = $1 AND id = $2`,
      [tenantId, userId]
    );

    logger.info('User profile deleted', { tenantId, userId });
    tracer.success();
  } catch (error) {
    tracer.failure(error instanceof Error ? error : new Error(String(error)));
    logger.error('Failed to delete user profile', {
      tenantId,
      userId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    throw error;
  }
}
