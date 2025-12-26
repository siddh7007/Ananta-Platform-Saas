/**
 * Identity Provider Activities
 *
 * Handles Auth0 and Keycloak organization/realm management for tenant isolation.
 */

import { Context } from '@temporalio/activity';
import { ManagementClient as Auth0ManagementClient } from 'auth0';
import KcAdminClient from '@keycloak/keycloak-admin-client';
import { config } from '../config';
import {
  CreateIdPOrganizationInput,
  IdPOrganizationResult,
  DeleteIdPOrganizationInput,
  DeactivateIdPUserInput,
  DeactivateIdPUserResult,
} from '../types';
import { createLogger } from '../utils/logger';
import { generateSecurePassword } from '../utils/crypto';
import { createActivityTracer } from '../observability/activity-tracer';
import {
  InvalidConfigurationError,
  InvalidCredentialsError,
  ResourceNotFoundError,
} from '../utils/errors';

const logger = createLogger('idp-activities');

// ============================================
// Auth0 Client
// ============================================

let auth0Client: Auth0ManagementClient | null = null;

function getAuth0Client(): Auth0ManagementClient {
  if (!auth0Client && config.auth0.enabled) {
    logger.debug('Initializing Auth0 Management client', { domain: config.auth0.domain });
    auth0Client = new Auth0ManagementClient({
      domain: config.auth0.domain,
      clientId: config.auth0.clientId,
      clientSecret: config.auth0.clientSecret,
    });
  }
  if (!auth0Client) {
    throw new InvalidConfigurationError('Auth0 is not configured');
  }
  return auth0Client;
}

// ============================================
// Keycloak Client
// ============================================

async function getKeycloakClient(): Promise<KcAdminClient> {
  if (!config.keycloak.enabled) {
    throw new InvalidConfigurationError('Keycloak is not configured');
  }

  logger.debug('Initializing Keycloak admin client', { url: config.keycloak.url });

  const kcClient = new KcAdminClient({
    baseUrl: config.keycloak.url,
    realmName: config.keycloak.realm,
  });

  try {
    await kcClient.auth({
      clientId: config.keycloak.adminClientId,
      username: config.keycloak.adminUsername,
      password: config.keycloak.adminPassword,
      grantType: 'password',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Keycloak authentication failed', { error: message });
    throw new InvalidCredentialsError(`Keycloak authentication failed: ${message}`);
  }

  return kcClient;
}

// ============================================
// Create IdP Organization
// ============================================

export async function createIdPOrganization(
  input: CreateIdPOrganizationInput
): Promise<IdPOrganizationResult> {
  const tracer = createActivityTracer('createIdPOrganization', input.tenantId);
  tracer.start();
  tracer.addAttributes({ provider: input.provider, tenantKey: input.tenantKey });

  const ctx = Context.current();
  ctx.heartbeat('Starting IdP organization creation');

  logger.info('Creating IdP organization', {
    tenantId: input.tenantId,
    tenantKey: input.tenantKey,
    provider: input.provider,
  });

  try {
    let result: IdPOrganizationResult;

    if (input.provider === 'auth0') {
      result = await createAuth0Organization(input);
    } else if (input.provider === 'keycloak') {
      result = await createKeycloakRealm(input);
    } else {
      throw new InvalidConfigurationError(`Unsupported IdP provider: ${input.provider}`);
    }

    tracer.success(result);
    logger.info('IdP organization created successfully', {
      tenantId: input.tenantId,
      organizationId: result.organizationId,
      provider: input.provider,
    });

    return result;
  } catch (error) {
    tracer.failure(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

// ============================================
// Auth0 Implementation
// ============================================

async function createAuth0Organization(
  input: CreateIdPOrganizationInput
): Promise<IdPOrganizationResult> {
  const auth0 = getAuth0Client();
  const ctx = Context.current();

  try {
    // Step 1: Create organization
    ctx.heartbeat('Creating Auth0 organization');

    const orgResponse = await auth0.organizations.create({
      name: input.tenantKey,
      display_name: input.tenantName,
      branding: {
        colors: {
          primary: '#635DFF',
          page_background: '#FFFFFF',
        },
      },
      metadata: {
        tenantId: input.tenantId,
        tier: 'enterprise',
      },
    });
    const org = orgResponse.data;

    // Step 2: Create application (client) for the tenant
    ctx.heartbeat('Creating Auth0 application');

    const clientResponse = await auth0.clients.create({
      name: `${input.tenantName} Application`,
      app_type: 'spa',
      callbacks: input.domains.map((d) => `https://${d}/callback`),
      allowed_logout_urls: input.domains.map((d) => `https://${d}`),
      web_origins: input.domains.map((d) => `https://${d}`),
      grant_types: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_method: 'none',
      oidc_conformant: true,
    });
    const client = clientResponse.data;

    // Step 3: Enable organization for the client
    ctx.heartbeat('Enabling organization for client');

    await auth0.organizations.addEnabledConnection({ id: org.id! }, {
      connection_id: await getAuth0DefaultConnectionId(auth0),
      assign_membership_on_login: false,
    });

    // Step 4: Create admin user
    ctx.heartbeat('Creating admin user');

    const adminUserResponse = await auth0.users.create({
      email: input.adminContact.email,
      name: `${input.adminContact.firstName} ${input.adminContact.lastName}`,
      connection: 'Username-Password-Authentication',
      password: generateSecurePassword(),
      email_verified: false,
      app_metadata: {
        tenantId: input.tenantId,
        role: 'admin',
      },
    });
    const adminUser = adminUserResponse.data;

    // Step 5: Add user to organization
    ctx.heartbeat('Adding user to organization');

    await auth0.organizations.addMembers({ id: org.id! }, {
      members: [adminUser.user_id!],
    });

    // Step 6: Send password reset email
    ctx.heartbeat('Sending password reset email');

    await auth0.tickets.changePassword({
      user_id: adminUser.user_id,
      result_url: `https://${input.domains[0]}/login`,
    });

    return {
      provider: 'auth0',
      organizationId: org.id!,
      clientId: client.client_id!,
      clientSecret: client.client_secret,
      adminUserId: adminUser.user_id!,
      loginUrl: `https://${config.auth0.domain}/authorize?organization=${org.id}`,
      metadata: {
        organizationName: org.name,
        createdAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to create Auth0 organization: ${message}`);
  }
}

async function getAuth0DefaultConnectionId(
  auth0: Auth0ManagementClient
): Promise<string> {
  const connections = await auth0.connections.getAll({
    name: 'Username-Password-Authentication',
  });

  if (connections.data.length === 0) {
    throw new Error('Default Auth0 connection not found');
  }

  return connections.data[0].id!;
}

// ============================================
// Keycloak Implementation
// ============================================

async function createKeycloakRealm(
  input: CreateIdPOrganizationInput
): Promise<IdPOrganizationResult> {
  const kc = await getKeycloakClient();
  const ctx = Context.current();

  // Use shared CBP realm for Customer Portal users instead of per-tenant realms
  // This allows single sign-on across all tenants using the Customer Portal
  // Configure via: CBP_USERS_REALM_NAME (default: cbp-users)
  const useCbpRealm = process.env.USE_CBP_USERS_REALM === 'true';
  const cbpRealmName = process.env.CBP_USERS_REALM_NAME || 'cbp-users';
  const realmName = useCbpRealm ? cbpRealmName : `tenant-${input.tenantKey}`;

  try {
    // Step 1: Create realm (skip if using shared cbp-users realm)
    ctx.heartbeat('Setting up Keycloak realm');

    if (!useCbpRealm) {
      // Create per-tenant realm
      await kc.realms.create({
        realm: realmName,
        enabled: true,
        displayName: input.tenantName,
        loginWithEmailAllowed: true,
        duplicateEmailsAllowed: false,
        resetPasswordAllowed: true,
        editUsernameAllowed: false,
        bruteForceProtected: true,
        permanentLockout: false,
        maxFailureWaitSeconds: 900,
        minimumQuickLoginWaitSeconds: 60,
        waitIncrementSeconds: 60,
        quickLoginCheckMilliSeconds: 1000,
        maxDeltaTimeSeconds: 43200,
        failureFactor: 5,
        sslRequired: 'external',
        attributes: {
          tenantId: input.tenantId,
        },
      });
    }
    // For cbp-users realm, it should already exist (pre-created by setup script)

    // Step 2: Create client (skip if using shared cbp-users realm - uses existing customer-portal client)
    ctx.heartbeat('Setting up Keycloak client');

    let clientId: string;
    let clientSecret: string | undefined;
    let internalClientId: string | undefined;

    if (useCbpRealm) {
      // For shared realm, use existing customer-portal client (public client, no secret)
      clientId = 'customer-portal';
      const clients = await kc.clients.find({
        realm: realmName,
        clientId,
      });
      internalClientId = clients[0]?.id;
    } else {
      // Create per-tenant client
      clientId = `${input.tenantKey}-app`;
      clientSecret = generateSecurePassword();

      await kc.clients.create({
        realm: realmName,
        clientId,
        name: `${input.tenantName} Application`,
        enabled: true,
        publicClient: false,
        secret: clientSecret,
        redirectUris: input.domains.map((d) => `https://${d}/*`),
        webOrigins: input.domains.map((d) => `https://${d}`),
        protocol: 'openid-connect',
        standardFlowEnabled: true,
        directAccessGrantsEnabled: false,
        serviceAccountsEnabled: false,
        attributes: {
          'pkce.code.challenge.method': 'S256',
        },
      });

      // Get the created client's internal ID
      const clients = await kc.clients.find({
        realm: realmName,
        clientId,
      });
      internalClientId = clients[0]?.id;
    }

    // Step 3: Create admin user
    ctx.heartbeat('Creating admin user');

    const tempPassword = generateSecurePassword();

    await kc.users.create({
      realm: realmName,
      username: input.adminContact.email,
      email: input.adminContact.email,
      firstName: input.adminContact.firstName,
      lastName: input.adminContact.lastName,
      enabled: true,
      emailVerified: false,
      credentials: [
        {
          type: 'password',
          value: tempPassword,
          temporary: true,
        },
      ],
      attributes: {
        tenantId: [input.tenantId],
        tenantKey: [input.tenantKey],  // For multi-tenant isolation in shared realm
        role: [useCbpRealm ? 'owner' : 'admin'],  // CBP role for shared realm
      },
    });

    // Get the created user
    const users = await kc.users.find({
      realm: realmName,
      email: input.adminContact.email,
    });
    const adminUserId = users[0]?.id;

    // Step 4: Assign admin role
    ctx.heartbeat('Assigning admin role');

    if (useCbpRealm && adminUserId) {
      // For shared cbp-users realm, assign realm-level 'owner' role
      // CBP role hierarchy: super_admin > owner > admin > engineer > analyst
      const availableRealmRoles = await kc.roles.find({ realm: realmName });
      const ownerRole = availableRealmRoles.find((r) => r.name === 'owner');

      if (ownerRole) {
        await kc.users.addRealmRoleMappings({
          realm: realmName,
          id: adminUserId,
          roles: [{ id: ownerRole.id!, name: ownerRole.name! }],
        });
        logger.info('Assigned owner role to admin user', {
          userId: adminUserId,
          role: 'owner',
          realm: realmName,
        });
      } else {
        logger.warn('Owner role not found in cbp-users realm, skipping role assignment');
      }
    } else if (adminUserId) {
      // For per-tenant realm, use realm-management admin role
      const realmMgmtClients = await kc.clients.find({
        realm: realmName,
        clientId: 'realm-management',
      });

      if (realmMgmtClients.length > 0) {
        const realmMgmtClientId = realmMgmtClients[0].id!;
        const availableRoles = await kc.clients.listRoles({
          realm: realmName,
          id: realmMgmtClientId,
        });

        const adminRole = availableRoles.find((r) => r.name === 'realm-admin');
        if (adminRole) {
          await kc.users.addClientRoleMappings({
            realm: realmName,
            id: adminUserId,
            clientUniqueId: realmMgmtClientId,
            roles: [{ id: adminRole.id!, name: adminRole.name! }],
          });
        }
      }
    }

    // Step 5: Configure email settings if SMTP is configured
    ctx.heartbeat('Configuring realm settings');

    // Send password reset email will be handled by Keycloak when user logs in

    return {
      provider: 'keycloak',
      organizationId: realmName,
      clientId,
      clientSecret,
      adminUserId: adminUserId || '',
      loginUrl: `${config.keycloak.url}/realms/${realmName}/protocol/openid-connect/auth`,
      metadata: {
        realmName,
        internalClientId,
        createdAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to create Keycloak realm: ${message}`);
  }
}

// ============================================
// Delete IdP Organization
// ============================================

export async function deleteIdPOrganization(
  input: DeleteIdPOrganizationInput
): Promise<void> {
  const tracer = createActivityTracer('deleteIdPOrganization', input.tenantId);
  tracer.start();
  tracer.addAttributes({ provider: input.provider, organizationId: input.organizationId });

  const ctx = Context.current();
  ctx.heartbeat('Deleting IdP organization');

  logger.info('Deleting IdP organization', {
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    provider: input.provider,
  });

  try {
    if (input.provider === 'auth0') {
      await deleteAuth0Organization(input.organizationId);
    } else if (input.provider === 'keycloak') {
      await deleteKeycloakRealm(input.organizationId);
    } else {
      throw new InvalidConfigurationError(`Unsupported IdP provider: ${input.provider}`);
    }

    tracer.success();
    logger.info('IdP organization deleted successfully', {
      tenantId: input.tenantId,
      organizationId: input.organizationId,
    });
  } catch (error) {
    tracer.failure(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

async function deleteAuth0Organization(organizationId: string): Promise<void> {
  const auth0 = getAuth0Client();

  try {
    // Get all members and remove them first
    const membersResponse = await auth0.organizations.getMembers({ id: organizationId });
    const membersList = membersResponse.data || [];

    for (const member of membersList) {
      await auth0.organizations.deleteMembers(
        { id: organizationId },
        { members: [member.user_id!] }
      );
    }

    // Delete the organization
    await auth0.organizations.delete({ id: organizationId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to delete Auth0 organization: ${message}`);
  }
}

async function deleteKeycloakRealm(realmName: string): Promise<void> {
  const kc = await getKeycloakClient();

  try {
    await kc.realms.del({ realm: realmName });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to delete Keycloak realm: ${message}`);
  }
}

// ============================================
// GAP-008 FIX: Deactivate IdP User
// ============================================

/**
 * Deactivates a user in the Identity Provider when their role is revoked.
 * This prevents continued access via IdP even after role revocation in the app plane.
 */
export async function deactivateIdPUser(
  input: DeactivateIdPUserInput
): Promise<DeactivateIdPUserResult> {
  const tracer = createActivityTracer('deactivateIdPUser', input.tenantId);
  tracer.start();
  tracer.addAttributes({ provider: input.provider, userEmail: input.userEmail });

  const ctx = Context.current();
  ctx.heartbeat('Deactivating IdP user');

  logger.info('Deactivating IdP user', {
    tenantId: input.tenantId,
    tenantKey: input.tenantKey,
    userEmail: input.userEmail,
    provider: input.provider,
  });

  try {
    let result: DeactivateIdPUserResult;

    if (input.provider === 'auth0') {
      result = await deactivateAuth0User(input);
    } else if (input.provider === 'keycloak') {
      result = await deactivateKeycloakUser(input);
    } else {
      throw new InvalidConfigurationError(`Unsupported IdP provider: ${input.provider}`);
    }

    tracer.success(result);
    logger.info('IdP user deactivated successfully', {
      tenantId: input.tenantId,
      userEmail: input.userEmail,
      provider: input.provider,
      userId: result.userId,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    tracer.failure(error instanceof Error ? error : new Error(String(error)));

    // Return failure result instead of throwing - allows workflow to continue
    // even if IdP deactivation fails (App Plane deactivation is more critical)
    logger.warn('IdP user deactivation failed (non-fatal)', {
      tenantId: input.tenantId,
      userEmail: input.userEmail,
      error: errorMessage,
    });

    return {
      success: false,
      provider: input.provider,
      userEmail: input.userEmail,
      deactivated: false,
      error: errorMessage,
    };
  }
}

async function deactivateAuth0User(
  input: DeactivateIdPUserInput
): Promise<DeactivateIdPUserResult> {
  const auth0 = getAuth0Client();

  try {
    // Find user by email
    const usersResponse = await auth0.users.getAll({
      q: `email:"${input.userEmail}"`,
      search_engine: 'v3',
    });

    const users = usersResponse.data || [];
    if (users.length === 0) {
      logger.warn('User not found in Auth0', { email: input.userEmail });
      return {
        success: true,
        provider: 'auth0',
        userEmail: input.userEmail,
        deactivated: false,
        error: 'User not found in Auth0',
      };
    }

    const user = users[0];

    // Block the user (Auth0's way of deactivating)
    await auth0.users.update({ id: user.user_id! }, { blocked: true });

    return {
      success: true,
      provider: 'auth0',
      userEmail: input.userEmail,
      deactivated: true,
      userId: user.user_id,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to deactivate Auth0 user: ${message}`);
  }
}

async function deactivateKeycloakUser(
  input: DeactivateIdPUserInput
): Promise<DeactivateIdPUserResult> {
  const kc = await getKeycloakClient();

  // Determine realm name - use shared CBP realm or per-tenant realm
  const useCbpRealm = process.env.USE_CBP_USERS_REALM === 'true';
  const cbpRealmName = process.env.CBP_USERS_REALM_NAME || 'cbp-users';
  const realmName = input.realmName || (useCbpRealm ? cbpRealmName : `tenant-${input.tenantKey}`);

  try {
    // Find user by email in the realm
    const users = await kc.users.find({
      realm: realmName,
      email: input.userEmail,
      exact: true,
    });

    if (users.length === 0) {
      logger.warn('User not found in Keycloak', { email: input.userEmail, realm: realmName });
      return {
        success: true,
        provider: 'keycloak',
        userEmail: input.userEmail,
        deactivated: false,
        error: `User not found in Keycloak realm ${realmName}`,
      };
    }

    const user = users[0];

    // Disable the user
    await kc.users.update(
      { realm: realmName, id: user.id! },
      { enabled: false }
    );

    logger.info('Keycloak user disabled', {
      userId: user.id,
      email: input.userEmail,
      realm: realmName,
    });

    return {
      success: true,
      provider: 'keycloak',
      userEmail: input.userEmail,
      deactivated: true,
      userId: user.id,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to deactivate Keycloak user: ${message}`);
  }
}

// Note: generateSecurePassword is now imported from '../utils/crypto'
