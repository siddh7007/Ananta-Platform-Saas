import {inject, service} from '@loopback/core';
import {repository} from '@loopback/repository';
import {
  get,
  HttpErrors,
  param,
  post,
  requestBody,
  del,
} from '@loopback/rest';
import {
  CONTENT_TYPE,
  IAuthUserWithPermissions,
  OPERATION_SECURITY_SPEC,
  STATUS_CODE,
} from '@sourceloop/core';
import {
  authenticate,
  AuthenticationBindings,
  STRATEGY,
} from 'loopback4-authentication';
import {authorize} from 'loopback4-authorization';
import {PermissionKey} from '../permissions';
import {TenantRepository} from '../repositories/sequelize';
import {KeycloakAdminService, KeycloakRole} from '../services/keycloak-admin.service';
import {AuditLoggerService, AuditTargetType} from '../services/audit-logger.service';
import {IdPKey} from '../types';
import {TenantMgmtConfigRepository} from '../repositories/sequelize';

const basePath = '/keycloak';

/**
 * Controller for Keycloak admin operations related to roles.
 * Provides endpoints to:
 * - View Keycloak realm roles
 * - Sync platform roles to Keycloak
 * - Check Keycloak connection status
 * - Get users assigned to specific roles
 *
 * This complements the existing RolesController by adding Keycloak-specific
 * visibility and sync operations for the admin UI.
 */
export class KeycloakRolesController {
  constructor(
    @service(KeycloakAdminService)
    private readonly keycloakAdmin: KeycloakAdminService,
    @service(AuditLoggerService)
    private readonly auditLogger: AuditLoggerService,
    @repository(TenantRepository)
    private readonly tenantRepository: TenantRepository,
    @repository(TenantMgmtConfigRepository)
    private readonly tenantConfigRepository: TenantMgmtConfigRepository,
    @inject(AuthenticationBindings.CURRENT_USER, {optional: true})
    private readonly currentUser?: IAuthUserWithPermissions,
  ) {}

  /**
   * Get the current user's tenant ID for multi-tenant isolation.
   */
  private getTenantId(): string {
    if (!this.currentUser?.tenantId) {
      throw new HttpErrors.Forbidden('Tenant context required');
    }
    return this.currentUser.tenantId;
  }

  /**
   * Get the Keycloak realm name for a tenant.
   * Uses realm_name from config (consistent with KeycloakAdminService).
   */
  private async getRealmForTenant(tenantId: string): Promise<string> {
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

    if (keycloakConfig?.configValue) {
      const config = keycloakConfig.configValue as Record<string, unknown>;
      // Check realm_name first (primary), then realm (legacy), then fall back to tenant key
      if (config.realm_name && typeof config.realm_name === 'string') {
        return config.realm_name;
      }
      if (config.realm && typeof config.realm === 'string') {
        return config.realm;
      }
    }

    // Default realm name based on tenant key
    return tenant.key || 'arc-saas';
  }

  /**
   * Get the list of protected system roles that should not be deleted.
   * Includes Keycloak default roles which are dynamically named based on realm.
   */
  private getProtectedSystemRoles(realmName: string): string[] {
    return [
      // Platform system roles
      'super_admin',
      'admin',
      'owner',
      'engineer',
      'analyst',
      // Keycloak built-in roles
      'offline_access',
      'uma_authorization',
      // Dynamic default roles based on realm name
      `default-roles-${realmName}`,
    ];
  }

  /**
   * Check Keycloak connection status.
   * Useful for admin dashboard to show IdP health.
   */
  @authorize({
    permissions: [PermissionKey.ViewRole],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/status`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Keycloak connection status',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
              properties: {
                connected: {type: 'boolean'},
                url: {type: 'string'},
                error: {type: 'string'},
              },
            },
          },
        },
      },
    },
  })
  async checkStatus(): Promise<{connected: boolean; url: string; error?: string}> {
    return this.keycloakAdmin.checkKeycloakConnection();
  }

  /**
   * Get all realm roles from Keycloak for the current tenant's realm.
   */
  @authorize({
    permissions: [PermissionKey.ViewRole],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/roles`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Array of Keycloak realm roles',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: {type: 'string'},
                  name: {type: 'string'},
                  description: {type: 'string'},
                  composite: {type: 'boolean'},
                  clientRole: {type: 'boolean'},
                },
              },
            },
          },
        },
      },
    },
  })
  async getRoles(): Promise<KeycloakRole[]> {
    const tenantId = this.getTenantId();
    const realmName = await this.getRealmForTenant(tenantId);
    return this.keycloakAdmin.getRealmRoles(realmName);
  }

  /**
   * Get a specific Keycloak role by name.
   */
  @authorize({
    permissions: [PermissionKey.ViewRole],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/roles/{roleName}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Keycloak role details',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
              properties: {
                id: {type: 'string'},
                name: {type: 'string'},
                description: {type: 'string'},
                composite: {type: 'boolean'},
                clientRole: {type: 'boolean'},
              },
            },
          },
        },
      },
      [STATUS_CODE.NOT_FOUND]: {
        description: 'Role not found',
      },
    },
  })
  async getRoleByName(
    @param.path.string('roleName') roleName: string,
  ): Promise<KeycloakRole> {
    const tenantId = this.getTenantId();
    const realmName = await this.getRealmForTenant(tenantId);

    const role = await this.keycloakAdmin.getRealmRoleByName(realmName, roleName);
    if (!role) {
      throw new HttpErrors.NotFound(`Role '${roleName}' not found in Keycloak`);
    }
    return role;
  }

  /**
   * Get users assigned to a specific Keycloak role.
   */
  @authorize({
    permissions: [PermissionKey.ViewRole],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/roles/{roleName}/users`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Array of users with the role',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: {type: 'string'},
                  username: {type: 'string'},
                  email: {type: 'string'},
                  firstName: {type: 'string'},
                  lastName: {type: 'string'},
                  enabled: {type: 'boolean'},
                },
              },
            },
          },
        },
      },
    },
  })
  async getUsersWithRole(
    @param.path.string('roleName') roleName: string,
    @param.query.number('limit') limit?: number,
  ): Promise<unknown[]> {
    const tenantId = this.getTenantId();
    const realmName = await this.getRealmForTenant(tenantId);
    return this.keycloakAdmin.getUsersWithRole(realmName, roleName, limit ?? 100);
  }

  /**
   * Sync a platform role to Keycloak.
   * Creates the role in Keycloak if it doesn't exist, updates if it does.
   */
  @authorize({
    permissions: [PermissionKey.AssignRole],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @post(`${basePath}/roles/sync`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Role sync result',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
              properties: {
                synced: {type: 'boolean'},
                created: {type: 'boolean'},
              },
            },
          },
        },
      },
      [STATUS_CODE.INTERNAL_SERVER_ERROR]: {
        description: 'Sync failed',
      },
    },
  })
  async syncRole(
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: {
            type: 'object',
            required: ['key', 'name'],
            properties: {
              key: {type: 'string', description: 'Role key (used as role name in Keycloak)'},
              name: {type: 'string', description: 'Human-readable role name'},
              description: {type: 'string', description: 'Role description'},
            },
          },
        },
      },
    })
    role: {key: string; name: string; description?: string},
  ): Promise<{synced: boolean; created: boolean}> {
    const tenantId = this.getTenantId();
    const realmName = await this.getRealmForTenant(tenantId);

    const result = await this.keycloakAdmin.syncRoleToKeycloak(realmName, role);

    // If sync failed, throw an HTTP error so the client knows
    if (!result.synced) {
      throw new HttpErrors.InternalServerError(
        result.error || `Failed to sync role '${role.key}' to Keycloak`,
      );
    }

    // Log the sync operation (async, non-blocking)
    try {
      await this.auditLogger.log({
        action: 'KEYCLOAK_ROLE_SYNC',
        targetType: AuditTargetType.ROLE,
        targetId: role.key,
        targetName: role.name,
        tenantId,
        details: {
          realm: realmName,
          roleKey: role.key,
          roleName: role.name,
          created: result.created,
        },
      });
    } catch {
      // Don't fail the operation if logging fails
    }

    return {synced: result.synced, created: result.created};
  }

  /**
   * Delete a role from Keycloak.
   * This is an admin-only operation that should be used with caution.
   */
  @authorize({
    permissions: [PermissionKey.RevokeRole],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @del(`${basePath}/roles/{roleName}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.NO_CONTENT]: {
        description: 'Role deleted from Keycloak',
      },
    },
  })
  async deleteRole(
    @param.path.string('roleName') roleName: string,
  ): Promise<void> {
    const tenantId = this.getTenantId();
    const realmName = await this.getRealmForTenant(tenantId);

    // Prevent deletion of system roles (dynamically includes realm-specific default roles)
    const protectedRoles = this.getProtectedSystemRoles(realmName);
    if (protectedRoles.includes(roleName)) {
      throw new HttpErrors.Forbidden(`Cannot delete system role '${roleName}'`);
    }

    await this.keycloakAdmin.deleteRealmRole(realmName, roleName);

    // Log the deletion
    try {
      await this.auditLogger.log({
        action: 'KEYCLOAK_ROLE_DELETE',
        targetType: AuditTargetType.ROLE,
        targetId: roleName,
        targetName: roleName,
        tenantId,
        details: {
          realm: realmName,
          roleName,
        },
      });
    } catch {
      // Don't fail the operation if logging fails
    }
  }

  /**
   * Get realm information including brute force protection settings.
   */
  @authorize({
    permissions: [PermissionKey.ViewRole],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/realm`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Keycloak realm information',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
              properties: {
                realm: {type: 'string'},
                displayName: {type: 'string'},
                enabled: {type: 'boolean'},
                bruteForceProtected: {type: 'boolean'},
                registrationAllowed: {type: 'boolean'},
                resetPasswordAllowed: {type: 'boolean'},
              },
            },
          },
        },
      },
    },
  })
  async getRealmInfo(): Promise<unknown> {
    const tenantId = this.getTenantId();
    const realmName = await this.getRealmForTenant(tenantId);
    return this.keycloakAdmin.getRealmInfo(realmName);
  }
}
