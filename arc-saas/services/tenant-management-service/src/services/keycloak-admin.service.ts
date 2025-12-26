import {injectable, BindingScope} from '@loopback/core';
import {repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import axios, {AxiosInstance} from 'axios';
import qs from 'qs';
import {TenantRepository, TenantMgmtConfigRepository} from '../repositories/sequelize';
import {IdPKey} from '../types';

/**
 * Keycloak session information
 */
export interface KeycloakSession {
  id: string;
  username: string;
  userId: string;
  ipAddress: string;
  start: number;
  lastAccess: number;
  clients: Record<string, string>;
}

/**
 * Keycloak user MFA/credential information
 */
export interface KeycloakCredential {
  id: string;
  type: string;
  userLabel: string;
  createdDate: number;
  credentialData: string;
}

/**
 * Keycloak login event from admin events API
 */
export interface KeycloakLoginEvent {
  time: number;
  type: string;
  realmId: string;
  clientId: string;
  userId: string;
  sessionId: string;
  ipAddress: string;
  details: Record<string, string>;
}

/**
 * User sessions response
 */
export interface UserSessionsResponse {
  sessions: KeycloakSession[];
  count: number;
}

/**
 * MFA status response
 */
export interface MfaStatusResponse {
  enabled: boolean;
  configuredMethods: string[];
  credentials: KeycloakCredential[];
}

/**
 * Login events response
 */
export interface LoginEventsResponse {
  events: KeycloakLoginEvent[];
  count: number;
}

/**
 * Keycloak realm role representation
 */
export interface KeycloakRole {
  id?: string;
  name: string;
  description?: string;
  composite?: boolean;
  clientRole?: boolean;
  containerId?: string;
}

/**
 * Service for extended Keycloak Admin API operations.
 * Provides functionality for:
 * - User session management (list, terminate)
 * - MFA status and credential management
 * - Login event auditing
 * - Password reset triggers
 *
 * This service complements the existing KeycloakIdpProvider by adding
 * admin operations that are useful for tenant/user management UIs.
 */
@injectable({scope: BindingScope.TRANSIENT})
export class KeycloakAdminService {
  private axiosInstance: AxiosInstance;
  private tokenCache: {token: string; expiry: number} | null = null;

  constructor(
    @repository(TenantRepository)
    private readonly tenantRepository: TenantRepository,
    @repository(TenantMgmtConfigRepository)
    private readonly tenantConfigRepository: TenantMgmtConfigRepository,
  ) {
    this.axiosInstance = axios.create({
      baseURL: process.env.KEYCLOAK_HOST,
      timeout: 10000,
    });
  }

  /**
   * Authenticate as Keycloak admin and cache the token.
   * Token is cached for 50 seconds (Keycloak default token life is 60s).
   */
  async getAdminToken(): Promise<string> {
    const now = Date.now();

    // Return cached token if still valid (with 10s buffer)
    if (this.tokenCache && this.tokenCache.expiry > now + 10000) {
      return this.tokenCache.token;
    }

    const response = await this.axiosInstance.post(
      '/realms/master/protocol/openid-connect/token',
      qs.stringify({
        username: process.env.KEYCLOAK_ADMIN_USERNAME,
        password: process.env.KEYCLOAK_ADMIN_PASSWORD,
        grant_type: 'password',
        client_id: 'admin-cli',
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    const token = response.data.access_token;
    // Cache for 50 seconds
    this.tokenCache = {
      token,
      expiry: now + 50000,
    };

    return token;
  }

  /**
   * Get the Keycloak realm name for a tenant.
   * Looks up the realm from tenant configuration.
   */
  async getRealmForTenant(tenantId: string): Promise<string> {
    const tenant = await this.tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new HttpErrors.NotFound(`Tenant ${tenantId} not found`);
    }

    const keycloakConfig = await this.tenantConfigRepository.findOne({
      where: {
        tenantId: tenant.id,
        configKey: IdPKey.KEYCLOAK,
      },
    });

    if (!keycloakConfig?.configValue?.realm_name) {
      // Fall back to tenant key as realm name
      return tenant.key;
    }

    return keycloakConfig.configValue.realm_name;
  }

  // =====================================
  // User Sessions Management
  // =====================================

  /**
   * Get all active sessions for a user in a specific realm.
   *
   * @param realmName - Keycloak realm name
   * @param userId - Keycloak user ID (authId)
   * @returns List of active sessions
   */
  async getUserSessions(realmName: string, userId: string): Promise<UserSessionsResponse> {
    const token = await this.getAdminToken();

    try {
      const response = await this.axiosInstance.get<KeycloakSession[]>(
        `/admin/realms/${realmName}/users/${userId}/sessions`,
        {
          headers: {Authorization: `Bearer ${token}`},
        },
      );

      return {
        sessions: response.data,
        count: response.data.length,
      };
    } catch (error) {
      if (error.response?.status === 404) {
        return {sessions: [], count: 0};
      }
      throw new HttpErrors.InternalServerError(
        `Failed to get user sessions: ${error.message}`,
      );
    }
  }

  /**
   * Terminate a specific user session.
   *
   * @param realmName - Keycloak realm name
   * @param sessionId - Session ID to terminate
   */
  async terminateSession(realmName: string, sessionId: string): Promise<void> {
    const token = await this.getAdminToken();

    try {
      await this.axiosInstance.delete(
        `/admin/realms/${realmName}/sessions/${sessionId}`,
        {
          headers: {Authorization: `Bearer ${token}`},
        },
      );
    } catch (error) {
      if (error.response?.status === 404) {
        throw new HttpErrors.NotFound(`Session ${sessionId} not found`);
      }
      throw new HttpErrors.InternalServerError(
        `Failed to terminate session: ${error.message}`,
      );
    }
  }

  /**
   * Terminate all sessions for a user (logout from all devices).
   *
   * @param realmName - Keycloak realm name
   * @param userId - Keycloak user ID
   */
  async terminateAllUserSessions(realmName: string, userId: string): Promise<void> {
    const token = await this.getAdminToken();

    try {
      await this.axiosInstance.post(
        `/admin/realms/${realmName}/users/${userId}/logout`,
        {},
        {
          headers: {Authorization: `Bearer ${token}`},
        },
      );
    } catch (error) {
      throw new HttpErrors.InternalServerError(
        `Failed to terminate all sessions: ${error.message}`,
      );
    }
  }

  // =====================================
  // MFA / Credential Management
  // =====================================

  /**
   * Get MFA status and configured credentials for a user.
   *
   * @param realmName - Keycloak realm name
   * @param userId - Keycloak user ID
   * @returns MFA status including configured methods
   */
  async getMfaStatus(realmName: string, userId: string): Promise<MfaStatusResponse> {
    const token = await this.getAdminToken();

    try {
      const response = await this.axiosInstance.get<KeycloakCredential[]>(
        `/admin/realms/${realmName}/users/${userId}/credentials`,
        {
          headers: {Authorization: `Bearer ${token}`},
        },
      );

      const credentials = response.data;

      // Identify MFA methods (otp = TOTP, webauthn = Security Key)
      const mfaMethods = credentials
        .filter(c => c.type === 'otp' || c.type === 'webauthn' || c.type === 'webauthn-passwordless')
        .map(c => c.type);

      return {
        enabled: mfaMethods.length > 0,
        configuredMethods: [...new Set(mfaMethods)],
        credentials: credentials,
      };
    } catch (error) {
      if (error.response?.status === 404) {
        return {enabled: false, configuredMethods: [], credentials: []};
      }
      throw new HttpErrors.InternalServerError(
        `Failed to get MFA status: ${error.message}`,
      );
    }
  }

  /**
   * Remove a specific credential (e.g., disable MFA).
   *
   * @param realmName - Keycloak realm name
   * @param userId - Keycloak user ID
   * @param credentialId - Credential ID to remove
   */
  async removeCredential(
    realmName: string,
    userId: string,
    credentialId: string,
  ): Promise<void> {
    const token = await this.getAdminToken();

    try {
      await this.axiosInstance.delete(
        `/admin/realms/${realmName}/users/${userId}/credentials/${credentialId}`,
        {
          headers: {Authorization: `Bearer ${token}`},
        },
      );
    } catch (error) {
      if (error.response?.status === 404) {
        throw new HttpErrors.NotFound(`Credential ${credentialId} not found`);
      }
      throw new HttpErrors.InternalServerError(
        `Failed to remove credential: ${error.message}`,
      );
    }
  }

  // =====================================
  // Login Events / Audit
  // =====================================

  /**
   * Get login events for a user.
   * Requires event logging to be enabled in the realm.
   *
   * @param realmName - Keycloak realm name
   * @param userId - Keycloak user ID (optional - if not provided, gets all events)
   * @param maxResults - Maximum number of events to return (default 100)
   * @returns Login events
   */
  async getLoginEvents(
    realmName: string,
    userId?: string,
    maxResults: number = 100,
  ): Promise<LoginEventsResponse> {
    const token = await this.getAdminToken();

    try {
      const params: Record<string, string | number> = {
        max: maxResults,
        type: 'LOGIN,LOGIN_ERROR,LOGOUT,LOGOUT_ERROR',
      };

      if (userId) {
        params.user = userId;
      }

      const response = await this.axiosInstance.get<KeycloakLoginEvent[]>(
        `/admin/realms/${realmName}/events`,
        {
          headers: {Authorization: `Bearer ${token}`},
          params,
        },
      );

      return {
        events: response.data,
        count: response.data.length,
      };
    } catch (error) {
      // Events may not be enabled - return empty
      if (error.response?.status === 500) {
        return {events: [], count: 0};
      }
      throw new HttpErrors.InternalServerError(
        `Failed to get login events: ${error.message}`,
      );
    }
  }

  /**
   * Get admin events (user management actions) for auditing.
   *
   * @param realmName - Keycloak realm name
   * @param maxResults - Maximum number of events to return
   * @returns Admin events
   */
  async getAdminEvents(
    realmName: string,
    maxResults: number = 100,
  ): Promise<{events: unknown[]; count: number}> {
    const token = await this.getAdminToken();

    try {
      const response = await this.axiosInstance.get(
        `/admin/realms/${realmName}/admin-events`,
        {
          headers: {Authorization: `Bearer ${token}`},
          params: {max: maxResults},
        },
      );

      return {
        events: response.data,
        count: response.data.length,
      };
    } catch (error) {
      return {events: [], count: 0};
    }
  }

  // =====================================
  // Password Management
  // =====================================

  /**
   * Trigger a password reset email for a user.
   *
   * @param realmName - Keycloak realm name
   * @param userId - Keycloak user ID
   */
  async sendPasswordResetEmail(realmName: string, userId: string): Promise<void> {
    const token = await this.getAdminToken();

    try {
      await this.axiosInstance.put(
        `/admin/realms/${realmName}/users/${userId}/execute-actions-email`,
        ['UPDATE_PASSWORD'],
        {
          headers: {Authorization: `Bearer ${token}`},
        },
      );
    } catch (error) {
      throw new HttpErrors.InternalServerError(
        `Failed to send password reset email: ${error.message}`,
      );
    }
  }

  /**
   * Force password reset on next login.
   *
   * @param realmName - Keycloak realm name
   * @param userId - Keycloak user ID
   */
  async forcePasswordReset(realmName: string, userId: string): Promise<void> {
    const token = await this.getAdminToken();

    try {
      await this.axiosInstance.put(
        `/admin/realms/${realmName}/users/${userId}`,
        {
          requiredActions: ['UPDATE_PASSWORD'],
        },
        {
          headers: {Authorization: `Bearer ${token}`},
        },
      );
    } catch (error) {
      throw new HttpErrors.InternalServerError(
        `Failed to set required password reset: ${error.message}`,
      );
    }
  }

  // =====================================
  // User Status Management
  // =====================================

  /**
   * Enable or disable a user in Keycloak.
   *
   * @param realmName - Keycloak realm name
   * @param userId - Keycloak user ID
   * @param enabled - Whether user should be enabled
   */
  async setUserEnabled(
    realmName: string,
    userId: string,
    enabled: boolean,
  ): Promise<void> {
    const token = await this.getAdminToken();

    try {
      await this.axiosInstance.put(
        `/admin/realms/${realmName}/users/${userId}`,
        {enabled},
        {
          headers: {Authorization: `Bearer ${token}`},
        },
      );
    } catch (error) {
      throw new HttpErrors.InternalServerError(
        `Failed to ${enabled ? 'enable' : 'disable'} user: ${error.message}`,
      );
    }
  }

  /**
   * Get Keycloak user details.
   *
   * @param realmName - Keycloak realm name
   * @param userId - Keycloak user ID
   * @returns User details
   */
  async getUser(realmName: string, userId: string): Promise<unknown> {
    const token = await this.getAdminToken();

    try {
      const response = await this.axiosInstance.get(
        `/admin/realms/${realmName}/users/${userId}`,
        {
          headers: {Authorization: `Bearer ${token}`},
        },
      );
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        throw new HttpErrors.NotFound(`User ${userId} not found in Keycloak`);
      }
      throw new HttpErrors.InternalServerError(
        `Failed to get user: ${error.message}`,
      );
    }
  }

  /**
   * Search for users in a realm.
   *
   * @param realmName - Keycloak realm name
   * @param search - Search string (email, username, etc.)
   * @param maxResults - Maximum results
   */
  async searchUsers(
    realmName: string,
    search: string,
    maxResults: number = 20,
  ): Promise<unknown[]> {
    const token = await this.getAdminToken();

    try {
      const response = await this.axiosInstance.get(
        `/admin/realms/${realmName}/users`,
        {
          headers: {Authorization: `Bearer ${token}`},
          params: {search, max: maxResults},
        },
      );
      return response.data;
    } catch (error) {
      throw new HttpErrors.InternalServerError(
        `Failed to search users: ${error.message}`,
      );
    }
  }

  // =====================================
  // Realm Configuration
  // =====================================

  /**
   * Get realm info including brute force detection settings.
   *
   * @param realmName - Keycloak realm name
   */
  async getRealmInfo(realmName: string): Promise<unknown> {
    const token = await this.getAdminToken();

    try {
      const response = await this.axiosInstance.get(
        `/admin/realms/${realmName}`,
        {
          headers: {Authorization: `Bearer ${token}`},
        },
      );
      return response.data;
    } catch (error) {
      throw new HttpErrors.InternalServerError(
        `Failed to get realm info: ${error.message}`,
      );
    }
  }

  /**
   * Check if a user is currently locked out (brute force protection).
   *
   * @param realmName - Keycloak realm name
   * @param userId - Keycloak user ID
   */
  async isUserLockedOut(realmName: string, userId: string): Promise<boolean> {
    const token = await this.getAdminToken();

    try {
      const response = await this.axiosInstance.get(
        `/admin/realms/${realmName}/attack-detection/brute-force/users/${userId}`,
        {
          headers: {Authorization: `Bearer ${token}`},
        },
      );
      return response.data.disabled === true;
    } catch (error) {
      // If brute force protection not enabled, user is not locked
      return false;
    }
  }

  /**
   * Unlock a user that was locked due to brute force detection.
   *
   * @param realmName - Keycloak realm name
   * @param userId - Keycloak user ID
   */
  async unlockUser(realmName: string, userId: string): Promise<void> {
    const token = await this.getAdminToken();

    try {
      await this.axiosInstance.delete(
        `/admin/realms/${realmName}/attack-detection/brute-force/users/${userId}`,
        {
          headers: {Authorization: `Bearer ${token}`},
        },
      );
    } catch (error) {
      throw new HttpErrors.InternalServerError(
        `Failed to unlock user: ${error.message}`,
      );
    }
  }

  // =====================================
  // Role Management
  // =====================================

  /**
   * Get all realm roles from Keycloak.
   *
   * @param realmName - Keycloak realm name
   * @returns Array of realm roles
   */
  async getRealmRoles(realmName: string): Promise<KeycloakRole[]> {
    const token = await this.getAdminToken();

    try {
      const response = await this.axiosInstance.get<KeycloakRole[]>(
        `/admin/realms/${realmName}/roles`,
        {
          headers: {Authorization: `Bearer ${token}`},
        },
      );
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return [];
      }
      throw new HttpErrors.InternalServerError(
        `Failed to get realm roles: ${error.message}`,
      );
    }
  }

  /**
   * Get a specific realm role by name.
   *
   * @param realmName - Keycloak realm name
   * @param roleName - Role name
   * @returns Role details or null if not found
   */
  async getRealmRoleByName(realmName: string, roleName: string): Promise<KeycloakRole | null> {
    const token = await this.getAdminToken();

    try {
      const response = await this.axiosInstance.get<KeycloakRole>(
        `/admin/realms/${realmName}/roles/${roleName}`,
        {
          headers: {Authorization: `Bearer ${token}`},
        },
      );
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      throw new HttpErrors.InternalServerError(
        `Failed to get role: ${error.message}`,
      );
    }
  }

  /**
   * Create a new realm role in Keycloak.
   *
   * @param realmName - Keycloak realm name
   * @param role - Role details
   */
  async createRealmRole(
    realmName: string,
    role: {name: string; description?: string},
  ): Promise<void> {
    const token = await this.getAdminToken();

    try {
      await this.axiosInstance.post(
        `/admin/realms/${realmName}/roles`,
        {
          name: role.name,
          description: role.description || '',
        },
        {
          headers: {Authorization: `Bearer ${token}`},
        },
      );
    } catch (error) {
      if (error.response?.status === 409) {
        throw new HttpErrors.Conflict(`Role '${role.name}' already exists in Keycloak`);
      }
      throw new HttpErrors.InternalServerError(
        `Failed to create role in Keycloak: ${error.message}`,
      );
    }
  }

  /**
   * Update a realm role in Keycloak.
   *
   * @param realmName - Keycloak realm name
   * @param roleName - Current role name
   * @param updates - Updated role details
   */
  async updateRealmRole(
    realmName: string,
    roleName: string,
    updates: {name?: string; description?: string},
  ): Promise<void> {
    const token = await this.getAdminToken();

    try {
      await this.axiosInstance.put(
        `/admin/realms/${realmName}/roles/${roleName}`,
        {
          name: updates.name || roleName,
          description: updates.description,
        },
        {
          headers: {Authorization: `Bearer ${token}`},
        },
      );
    } catch (error) {
      if (error.response?.status === 404) {
        throw new HttpErrors.NotFound(`Role '${roleName}' not found in Keycloak`);
      }
      throw new HttpErrors.InternalServerError(
        `Failed to update role in Keycloak: ${error.message}`,
      );
    }
  }

  /**
   * Delete a realm role from Keycloak.
   *
   * @param realmName - Keycloak realm name
   * @param roleName - Role name to delete
   */
  async deleteRealmRole(realmName: string, roleName: string): Promise<void> {
    const token = await this.getAdminToken();

    try {
      await this.axiosInstance.delete(
        `/admin/realms/${realmName}/roles/${roleName}`,
        {
          headers: {Authorization: `Bearer ${token}`},
        },
      );
    } catch (error) {
      if (error.response?.status === 404) {
        // Role doesn't exist - that's fine for delete
        return;
      }
      throw new HttpErrors.InternalServerError(
        `Failed to delete role from Keycloak: ${error.message}`,
      );
    }
  }

  /**
   * Get users that have a specific realm role.
   *
   * @param realmName - Keycloak realm name
   * @param roleName - Role name
   * @param maxResults - Maximum number of users to return
   * @returns Array of users with the role
   */
  async getUsersWithRole(
    realmName: string,
    roleName: string,
    maxResults: number = 100,
  ): Promise<unknown[]> {
    const token = await this.getAdminToken();

    try {
      const response = await this.axiosInstance.get(
        `/admin/realms/${realmName}/roles/${roleName}/users`,
        {
          headers: {Authorization: `Bearer ${token}`},
          params: {max: maxResults},
        },
      );
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return [];
      }
      throw new HttpErrors.InternalServerError(
        `Failed to get users with role: ${error.message}`,
      );
    }
  }

  /**
   * Sync a platform role to Keycloak realm.
   * Creates the role if it doesn't exist, updates it if it does.
   *
   * @param realmName - Keycloak realm name
   * @param role - Platform role to sync
   * @returns Sync result
   */
  async syncRoleToKeycloak(
    realmName: string,
    role: {key: string; name: string; description?: string},
  ): Promise<{synced: boolean; created: boolean; error?: string}> {
    try {
      const existingRole = await this.getRealmRoleByName(realmName, role.key);

      if (existingRole) {
        // Update existing role
        await this.updateRealmRole(realmName, role.key, {
          description: role.description || role.name,
        });
        return {synced: true, created: false};
      } else {
        // Create new role
        await this.createRealmRole(realmName, {
          name: role.key,
          description: role.description || role.name,
        });
        return {synced: true, created: true};
      }
    } catch (error) {
      return {
        synced: false,
        created: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check connection to Keycloak and return status.
   *
   * @returns Connection status
   */
  async checkKeycloakConnection(): Promise<{
    connected: boolean;
    url: string;
    error?: string;
  }> {
    const url = process.env.KEYCLOAK_HOST || 'http://localhost:8180';

    try {
      await this.getAdminToken();
      return {connected: true, url};
    } catch (error) {
      return {
        connected: false,
        url,
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }
}
