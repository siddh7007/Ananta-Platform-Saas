import {inject, service} from '@loopback/core';
import {repository} from '@loopback/repository';
import {
  del,
  get,
  HttpErrors,
  param,
  post,
} from '@loopback/rest';
import {
  CONTENT_TYPE,
  IAuthUserWithPermissions,
  OPERATION_SECURITY_SPEC,
  STATUS_CODE,
} from '@sourceloop/core';
import {authenticate, AuthenticationBindings, STRATEGY} from 'loopback4-authentication';
import {authorize} from 'loopback4-authorization';
import {UserRepository} from '../repositories/sequelize';
import {PermissionKey} from '../permissions';
import {
  KeycloakAdminService,
  UserSessionsResponse,
  MfaStatusResponse,
  LoginEventsResponse,
} from '../services/keycloak-admin.service';
import {AuditLoggerService} from '../services/audit-logger.service';
import {User} from '../models';

const basePath = '/users/{userId}/identity';

/**
 * User Identity Management Controller.
 * Provides endpoints for managing user identity in Keycloak:
 * - Sessions (view, terminate)
 * - MFA status and credentials
 * - Login events and audit
 * - Password reset
 * - Account lockout management
 *
 * SECURITY: All operations enforce tenant isolation - users can only
 * manage identities within their own tenant unless they have platform-level
 * super admin privileges.
 */
export class UserIdentityController {
  constructor(
    @repository(UserRepository)
    private readonly userRepository: UserRepository,
    @service(KeycloakAdminService)
    private readonly keycloakAdmin: KeycloakAdminService,
    @service(AuditLoggerService)
    private readonly auditLogger: AuditLoggerService,
    @inject(AuthenticationBindings.CURRENT_USER, {optional: true})
    private readonly currentUser?: IAuthUserWithPermissions,
  ) {}

  /**
   * Get current user's tenant ID or throw if not authenticated.
   */
  private getTenantId(): string {
    if (!this.currentUser?.tenantId) {
      throw new HttpErrors.Forbidden('Tenant context required');
    }
    return this.currentUser.tenantId;
  }

  /**
   * Check if current user is a platform super admin (can bypass tenant restrictions).
   */
  private isPlatformAdmin(): boolean {
    // Platform admin typically has no tenantId or has a special flag
    // Check for super-admin permission
    const permissions = this.currentUser?.permissions || [];
    return permissions.includes(PermissionKey.SuperAdmin) ||
           permissions.includes('*');
  }

  /**
   * Validate UUID format
   */
  private isValidUUID(id: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }

  /**
   * Verify that the current user can access the target user.
   * Enforces tenant isolation unless caller is a platform admin.
   * Returns the user if access is allowed, throws Forbidden otherwise.
   */
  private async verifyTenantAccess(userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new HttpErrors.NotFound(`User ${userId} not found`);
    }

    // Platform admins can access any user
    if (this.isPlatformAdmin()) {
      return user;
    }

    // Regular users can only access users in their own tenant
    const callerTenantId = this.getTenantId();
    if (user.tenantId !== callerTenantId) {
      throw new HttpErrors.Forbidden(
        'You do not have permission to manage this user',
      );
    }

    return user;
  }

  /**
   * Verify that the session belongs to the specified user before terminating.
   * Returns true if session is owned by the user, throws if not.
   */
  private async verifySessionOwnership(
    realmName: string,
    keycloakUserId: string,
    sessionId: string,
  ): Promise<void> {
    // Get all sessions for this user and verify the sessionId is in the list
    const sessionsResponse = await this.keycloakAdmin.getUserSessions(
      realmName,
      keycloakUserId,
    );

    const sessionBelongsToUser = sessionsResponse.sessions.some(
      s => s.id === sessionId,
    );

    if (!sessionBelongsToUser) {
      throw new HttpErrors.Forbidden(
        'Session does not belong to this user or does not exist',
      );
    }
  }

  // =====================================
  // Sessions Management
  // =====================================

  /**
   * Get all active sessions for a user.
   * Returns session details including IP, start time, and connected clients.
   */
  @authorize({
    permissions: [PermissionKey.ViewUserSessions],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/sessions`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'User sessions from Keycloak',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
              properties: {
                sessions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: {type: 'string'},
                      username: {type: 'string'},
                      userId: {type: 'string'},
                      ipAddress: {type: 'string'},
                      start: {type: 'number'},
                      lastAccess: {type: 'number'},
                      clients: {type: 'object'},
                    },
                  },
                },
                count: {type: 'number'},
              },
            },
          },
        },
      },
    },
  })
  async getSessions(
    @param.path.string('userId') userId: string,
  ): Promise<UserSessionsResponse> {
    if (!this.isValidUUID(userId)) {
      throw new HttpErrors.BadRequest('Invalid user ID format');
    }

    // Verify tenant access
    const user = await this.verifyTenantAccess(userId);

    if (!user.authId) {
      throw new HttpErrors.BadRequest('User has no Keycloak identity');
    }

    // Get realm for this tenant
    const realmName = await this.keycloakAdmin.getRealmForTenant(
      user.tenantId || this.getTenantId(),
    );

    return this.keycloakAdmin.getUserSessions(realmName, user.authId);
  }

  /**
   * Terminate a specific session for a user.
   * Forces logout from a single device/session.
   * Validates that the session actually belongs to the user before terminating.
   */
  @authorize({
    permissions: [PermissionKey.TerminateUserSession],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @del(`${basePath}/sessions/{sessionId}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.NO_CONTENT]: {
        description: 'Session terminated successfully',
      },
    },
  })
  async terminateSession(
    @param.path.string('userId') userId: string,
    @param.path.string('sessionId') sessionId: string,
  ): Promise<void> {
    if (!this.isValidUUID(userId)) {
      throw new HttpErrors.BadRequest('Invalid user ID format');
    }

    if (!sessionId || sessionId.trim() === '') {
      throw new HttpErrors.BadRequest('Session ID is required');
    }

    // Verify tenant access
    const user = await this.verifyTenantAccess(userId);

    if (!user.authId) {
      throw new HttpErrors.BadRequest('User has no Keycloak identity');
    }

    const realmName = await this.keycloakAdmin.getRealmForTenant(
      user.tenantId || this.getTenantId(),
    );

    // CRITICAL: Verify the session belongs to this user before terminating
    await this.verifySessionOwnership(realmName, user.authId, sessionId);

    await this.keycloakAdmin.terminateSession(realmName, sessionId);

    // Audit log
    try {
      await this.auditLogger.log({
        action: 'USER_SESSION_TERMINATED',
        targetId: userId,
        targetType: 'user',
        details: {sessionId, email: user.email},
        tenantId: user.tenantId || this.getTenantId(),
      });
    } catch {
      // Don't fail if audit fails
    }
  }

  /**
   * Terminate all sessions for a user.
   * Forces logout from all devices (global logout).
   */
  @authorize({
    permissions: [PermissionKey.TerminateUserSession],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @post(`${basePath}/sessions/terminate-all`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.NO_CONTENT]: {
        description: 'All sessions terminated successfully',
      },
    },
  })
  async terminateAllSessions(
    @param.path.string('userId') userId: string,
  ): Promise<void> {
    if (!this.isValidUUID(userId)) {
      throw new HttpErrors.BadRequest('Invalid user ID format');
    }

    // Verify tenant access
    const user = await this.verifyTenantAccess(userId);

    if (!user.authId) {
      throw new HttpErrors.BadRequest('User has no Keycloak identity');
    }

    const realmName = await this.keycloakAdmin.getRealmForTenant(
      user.tenantId || this.getTenantId(),
    );

    await this.keycloakAdmin.terminateAllUserSessions(realmName, user.authId);

    // Audit log
    try {
      await this.auditLogger.log({
        action: 'USER_ALL_SESSIONS_TERMINATED',
        targetId: userId,
        targetType: 'user',
        details: {email: user.email},
        tenantId: user.tenantId || this.getTenantId(),
      });
    } catch {
      // Don't fail if audit fails
    }
  }

  // =====================================
  // MFA Management
  // =====================================

  /**
   * Get MFA status for a user.
   * Returns whether MFA is enabled and what methods are configured.
   */
  @authorize({
    permissions: [PermissionKey.ViewUserMfa],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/mfa`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'User MFA status',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
              properties: {
                enabled: {type: 'boolean'},
                configuredMethods: {
                  type: 'array',
                  items: {type: 'string'},
                },
                credentials: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: {type: 'string'},
                      type: {type: 'string'},
                      userLabel: {type: 'string'},
                      createdDate: {type: 'number'},
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  async getMfaStatus(
    @param.path.string('userId') userId: string,
  ): Promise<MfaStatusResponse> {
    if (!this.isValidUUID(userId)) {
      throw new HttpErrors.BadRequest('Invalid user ID format');
    }

    // Verify tenant access
    const user = await this.verifyTenantAccess(userId);

    if (!user.authId) {
      return {enabled: false, configuredMethods: [], credentials: []};
    }

    const realmName = await this.keycloakAdmin.getRealmForTenant(
      user.tenantId || this.getTenantId(),
    );

    return this.keycloakAdmin.getMfaStatus(realmName, user.authId);
  }

  /**
   * Remove a specific MFA credential (e.g., disable TOTP).
   */
  @authorize({
    permissions: [PermissionKey.ManageUserMfa],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @del(`${basePath}/mfa/credentials/{credentialId}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.NO_CONTENT]: {
        description: 'MFA credential removed successfully',
      },
    },
  })
  async removeMfaCredential(
    @param.path.string('userId') userId: string,
    @param.path.string('credentialId') credentialId: string,
  ): Promise<void> {
    if (!this.isValidUUID(userId)) {
      throw new HttpErrors.BadRequest('Invalid user ID format');
    }

    if (!credentialId || credentialId.trim() === '') {
      throw new HttpErrors.BadRequest('Credential ID is required');
    }

    // Verify tenant access
    const user = await this.verifyTenantAccess(userId);

    if (!user.authId) {
      throw new HttpErrors.BadRequest('User has no Keycloak identity');
    }

    const realmName = await this.keycloakAdmin.getRealmForTenant(
      user.tenantId || this.getTenantId(),
    );

    await this.keycloakAdmin.removeCredential(realmName, user.authId, credentialId);

    // Audit log
    try {
      await this.auditLogger.log({
        action: 'USER_MFA_CREDENTIAL_REMOVED',
        targetId: userId,
        targetType: 'user',
        details: {credentialId, email: user.email},
        tenantId: user.tenantId || this.getTenantId(),
      });
    } catch {
      // Don't fail if audit fails
    }
  }

  // =====================================
  // Login Events / Audit
  // =====================================

  /**
   * Get login events for a user.
   * Returns recent login attempts, successes, and failures.
   */
  @authorize({
    permissions: [PermissionKey.ViewLoginEvents],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/login-events`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'User login events from Keycloak',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
              properties: {
                events: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      time: {type: 'number'},
                      type: {type: 'string'},
                      realmId: {type: 'string'},
                      clientId: {type: 'string'},
                      userId: {type: 'string'},
                      sessionId: {type: 'string'},
                      ipAddress: {type: 'string'},
                      details: {type: 'object'},
                    },
                  },
                },
                count: {type: 'number'},
              },
            },
          },
        },
      },
    },
  })
  async getLoginEvents(
    @param.path.string('userId') userId: string,
    @param.query.number('limit') limit: number = 50,
    @param.query.number('maxResults') maxResults?: number,
  ): Promise<LoginEventsResponse> {
    if (!this.isValidUUID(userId)) {
      throw new HttpErrors.BadRequest('Invalid user ID format');
    }

    // Verify tenant access
    const user = await this.verifyTenantAccess(userId);

    if (!user.authId) {
      return {events: [], count: 0};
    }

    const realmName = await this.keycloakAdmin.getRealmForTenant(
      user.tenantId || this.getTenantId(),
    );

    // Support both 'limit' and 'maxResults' query params for backwards compatibility
    const effectiveLimit = maxResults ?? limit;
    return this.keycloakAdmin.getLoginEvents(realmName, user.authId, effectiveLimit);
  }

  // =====================================
  // Password Management
  // =====================================

  /**
   * Trigger a password reset email for a user.
   */
  @authorize({
    permissions: [PermissionKey.ResetUserPassword],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @post(`${basePath}/password-reset`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.NO_CONTENT]: {
        description: 'Password reset email sent successfully',
      },
    },
  })
  async sendPasswordResetEmail(
    @param.path.string('userId') userId: string,
  ): Promise<void> {
    if (!this.isValidUUID(userId)) {
      throw new HttpErrors.BadRequest('Invalid user ID format');
    }

    // Verify tenant access
    const user = await this.verifyTenantAccess(userId);

    if (!user.authId) {
      throw new HttpErrors.BadRequest('User has no Keycloak identity');
    }

    const realmName = await this.keycloakAdmin.getRealmForTenant(
      user.tenantId || this.getTenantId(),
    );

    await this.keycloakAdmin.sendPasswordResetEmail(realmName, user.authId);

    // Audit log
    try {
      await this.auditLogger.log({
        action: 'USER_PASSWORD_RESET_SENT',
        targetId: userId,
        targetType: 'user',
        details: {email: user.email},
        tenantId: user.tenantId || this.getTenantId(),
      });
    } catch {
      // Don't fail if audit fails
    }
  }

  /**
   * Force password reset on next login.
   */
  @authorize({
    permissions: [PermissionKey.ResetUserPassword],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @post(`${basePath}/force-password-reset`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.NO_CONTENT]: {
        description: 'User will be required to reset password on next login',
      },
    },
  })
  async forcePasswordReset(
    @param.path.string('userId') userId: string,
  ): Promise<void> {
    if (!this.isValidUUID(userId)) {
      throw new HttpErrors.BadRequest('Invalid user ID format');
    }

    // Verify tenant access
    const user = await this.verifyTenantAccess(userId);

    if (!user.authId) {
      throw new HttpErrors.BadRequest('User has no Keycloak identity');
    }

    const realmName = await this.keycloakAdmin.getRealmForTenant(
      user.tenantId || this.getTenantId(),
    );

    await this.keycloakAdmin.forcePasswordReset(realmName, user.authId);

    // Audit log
    try {
      await this.auditLogger.log({
        action: 'USER_PASSWORD_RESET_FORCED',
        targetId: userId,
        targetType: 'user',
        details: {email: user.email},
        tenantId: user.tenantId || this.getTenantId(),
      });
    } catch {
      // Don't fail if audit fails
    }
  }

  // =====================================
  // Account Lockout Management
  // =====================================

  /**
   * Check if a user is locked out due to brute force protection.
   */
  @authorize({
    permissions: [PermissionKey.ViewUserMfa],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/lockout-status`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'User lockout status',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
              properties: {
                isLockedOut: {type: 'boolean'},
              },
            },
          },
        },
      },
    },
  })
  async getLockoutStatus(
    @param.path.string('userId') userId: string,
  ): Promise<{isLockedOut: boolean}> {
    if (!this.isValidUUID(userId)) {
      throw new HttpErrors.BadRequest('Invalid user ID format');
    }

    // Verify tenant access
    const user = await this.verifyTenantAccess(userId);

    if (!user.authId) {
      return {isLockedOut: false};
    }

    const realmName = await this.keycloakAdmin.getRealmForTenant(
      user.tenantId || this.getTenantId(),
    );

    const isLockedOut = await this.keycloakAdmin.isUserLockedOut(realmName, user.authId);
    return {isLockedOut};
  }

  /**
   * Unlock a user that was locked due to brute force protection.
   */
  @authorize({
    permissions: [PermissionKey.UnlockUser],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @post(`${basePath}/unlock`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.NO_CONTENT]: {
        description: 'User unlocked successfully',
      },
    },
  })
  async unlockUser(
    @param.path.string('userId') userId: string,
  ): Promise<void> {
    if (!this.isValidUUID(userId)) {
      throw new HttpErrors.BadRequest('Invalid user ID format');
    }

    // Verify tenant access
    const user = await this.verifyTenantAccess(userId);

    if (!user.authId) {
      throw new HttpErrors.BadRequest('User has no Keycloak identity');
    }

    const realmName = await this.keycloakAdmin.getRealmForTenant(
      user.tenantId || this.getTenantId(),
    );

    await this.keycloakAdmin.unlockUser(realmName, user.authId);

    // Audit log
    try {
      await this.auditLogger.log({
        action: 'USER_UNLOCKED',
        targetId: userId,
        targetType: 'user',
        details: {email: user.email},
        tenantId: user.tenantId || this.getTenantId(),
      });
    } catch {
      // Don't fail if audit fails
    }
  }

  // =====================================
  // Keycloak User Details
  // =====================================

  /**
   * Get detailed Keycloak user information.
   * Returns the full Keycloak user representation.
   */
  @authorize({
    permissions: [PermissionKey.ViewUserMfa],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/keycloak-details`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Keycloak user details',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
              properties: {
                id: {type: 'string'},
                username: {type: 'string'},
                email: {type: 'string'},
                emailVerified: {type: 'boolean'},
                enabled: {type: 'boolean'},
                firstName: {type: 'string'},
                lastName: {type: 'string'},
                createdTimestamp: {type: 'number'},
                attributes: {type: 'object'},
                requiredActions: {type: 'array', items: {type: 'string'}},
              },
            },
          },
        },
      },
    },
  })
  async getKeycloakDetails(
    @param.path.string('userId') userId: string,
  ): Promise<unknown> {
    if (!this.isValidUUID(userId)) {
      throw new HttpErrors.BadRequest('Invalid user ID format');
    }

    // Verify tenant access
    const user = await this.verifyTenantAccess(userId);

    if (!user.authId) {
      throw new HttpErrors.BadRequest('User has no Keycloak identity');
    }

    const realmName = await this.keycloakAdmin.getRealmForTenant(
      user.tenantId || this.getTenantId(),
    );

    return this.keycloakAdmin.getUser(realmName, user.authId);
  }
}
