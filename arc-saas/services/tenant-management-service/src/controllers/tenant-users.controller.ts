import {inject} from '@loopback/core';
import {
  Count,
  CountSchema,
  Filter,
  repository,
  Where,
} from '@loopback/repository';
import {del, get, HttpErrors, param, patch, requestBody} from '@loopback/rest';
import {
  CONTENT_TYPE,
  getModelSchemaRefSF,
  IAuthUserWithPermissions,
  OPERATION_SECURITY_SPEC,
  STATUS_CODE,
} from '@sourceloop/core';
import {authenticate, AuthenticationBindings, STRATEGY} from 'loopback4-authentication';
import {authorize} from 'loopback4-authorization';
import {service} from '@loopback/core';
import {UserRepository, UserRoleRepository} from '../repositories/sequelize';
import {User} from '../models';
import {PermissionKey} from '../permissions';
import {ActivityLoggerService} from '../services/activity-logger.service';
import {AuditLoggerService} from '../services/audit-logger.service';

const basePath = '/tenant-users';

/**
 * Tenant-scoped user management controller.
 * Provides endpoints to list and count users belonging to a specific tenant.
 * Used by customer portal to manage users within their tenant context.
 */
export class TenantUsersController {
  constructor(
    @repository(UserRepository)
    private readonly userRepository: UserRepository,
    @repository(UserRoleRepository)
    private readonly userRoleRepository: UserRoleRepository,
    @service(ActivityLoggerService)
    private readonly activityLogger: ActivityLoggerService,
    @service(AuditLoggerService)
    private readonly auditLogger: AuditLoggerService,
    @inject(AuthenticationBindings.CURRENT_USER, {optional: true})
    private readonly currentUser?: IAuthUserWithPermissions,
  ) {}

  /**
   * Get the current user's tenant ID for multi-tenant isolation and logging.
   */
  private getTenantId(): string {
    if (!this.currentUser?.tenantId) {
      throw new HttpErrors.Forbidden('Tenant context required');
    }
    return this.currentUser.tenantId;
  }

  /**
   * Validate UUID format for IDs
   */
  private validateUUID(id: string, fieldName = 'ID'): void {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      throw new HttpErrors.BadRequest(`Invalid ${fieldName} format`);
    }
  }

  /**
   * Get the current user's role hierarchy level
   */
  private async getCurrentUserRoleLevel(): Promise<number> {
    const roleHierarchy: Record<string, number> = {
      analyst: 1,
      engineer: 2,
      admin: 3,
      owner: 4,
      super_admin: 5,
    };

    const tenantId = this.getTenantId();
    const userRole = await this.userRoleRepository.findOne({
      where: {userId: this.currentUser?.id, tenantId},
    });

    return roleHierarchy[userRole?.roleKey || 'analyst'] || 1;
  }

  /**
   * Check if target role can be assigned by current user
   */
  private async canAssignRole(targetRoleKey: string): Promise<boolean> {
    const roleHierarchy: Record<string, number> = {
      analyst: 1,
      engineer: 2,
      admin: 3,
      owner: 4,
      super_admin: 5,
    };

    const currentUserLevel = await this.getCurrentUserRoleLevel();
    const targetRoleLevel = roleHierarchy[targetRoleKey] || 1;

    // Can only assign roles at or below your own level
    // Exception: only owner/super_admin can assign owner role
    if (targetRoleKey === 'owner' && currentUserLevel < 4) {
      return false;
    }

    return currentUserLevel >= targetRoleLevel;
  }

  @authorize({
    permissions: [PermissionKey.ViewUser],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/count`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'User model count for tenant',
        content: {[CONTENT_TYPE.JSON]: {schema: CountSchema}},
      },
    },
  })
  async count(@param.where(User) where?: Where<User>): Promise<Count> {
    return this.userRepository.count(where);
  }

  @authorize({
    permissions: [PermissionKey.ViewUser],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(basePath, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Array of User model instances for tenant',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'array',
              items: getModelSchemaRefSF(User, {includeRelations: true}),
            },
          },
        },
      },
    },
  })
  async find(@param.filter(User) filter?: Filter<User>): Promise<User[]> {
    return this.userRepository.find(filter);
  }

  /**
   * Get users by tenant ID.
   * Returns all users belonging to the specified tenant.
   */
  @authorize({
    permissions: [PermissionKey.ViewUser],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/by-tenant/{tenantId}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Array of User model instances for a specific tenant',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'array',
              items: getModelSchemaRefSF(User, {includeRelations: true}),
            },
          },
        },
      },
    },
  })
  async findByTenant(
    @param.path.string('tenantId') tenantId: string,
    @param.filter(User, {exclude: 'where'}) filter?: Filter<User>,
  ): Promise<User[]> {
    // SECURITY: Validate tenant ID format
    this.validateUUID(tenantId, 'Tenant ID');

    // SECURITY: Enforce multi-tenant isolation - can only query own tenant
    const currentTenantId = this.getTenantId();
    if (tenantId !== currentTenantId) {
      throw new HttpErrors.Forbidden('Cannot access users from another tenant');
    }

    return this.userRepository.find({
      ...filter,
      where: {tenantId, deleted: false},
    });
  }

  /**
   * Count users by tenant ID.
   */
  @authorize({
    permissions: [PermissionKey.ViewUser],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/by-tenant/{tenantId}/count`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'User count for a specific tenant',
        content: {[CONTENT_TYPE.JSON]: {schema: CountSchema}},
      },
    },
  })
  async countByTenant(
    @param.path.string('tenantId') tenantId: string,
  ): Promise<Count> {
    // SECURITY: Validate tenant ID format
    this.validateUUID(tenantId, 'Tenant ID');

    // SECURITY: Enforce multi-tenant isolation - can only query own tenant
    const currentTenantId = this.getTenantId();
    if (tenantId !== currentTenantId) {
      throw new HttpErrors.Forbidden('Cannot access users from another tenant');
    }

    return this.userRepository.count({tenantId, deleted: false});
  }

  /**
   * Update a tenant user's role.
   * Used by customer portal admins to manage team member roles.
   */
  @authorize({
    permissions: [PermissionKey.UpdateUser],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @patch(`${basePath}/{id}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'User updated successfully',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: getModelSchemaRefSF(User),
          },
        },
      },
    },
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: {
            type: 'object',
            title: 'UpdateUserRole',
            properties: {
              roleKey: {type: 'string', description: 'Role to assign to the user'},
              status: {type: 'number', description: 'User status (active, suspended, etc.)'},
            },
          },
        },
      },
    })
    body: {roleKey?: string; status?: number},
  ): Promise<User> {
    // SECURITY: Validate user ID format
    this.validateUUID(id, 'User ID');

    const tenantId = this.getTenantId();

    // Verify user belongs to current tenant
    const user = await this.userRepository.findById(id);
    if (user.tenantId !== tenantId) {
      throw new HttpErrors.Forbidden('Cannot update user from another tenant');
    }

    // Prevent self-modification of role
    if (this.currentUser?.id === id && body.roleKey) {
      throw new HttpErrors.BadRequest('Cannot change your own role');
    }

    // Update user role if provided
    if (body.roleKey) {
      // SECURITY: Validate role hierarchy - prevent privilege escalation
      const canAssign = await this.canAssignRole(body.roleKey);
      if (!canAssign) {
        throw new HttpErrors.Forbidden(
          `Insufficient permissions to assign role '${body.roleKey}'. You can only assign roles at or below your own level.`
        );
      }

      // Find existing role assignment
      const existingRole = await this.userRoleRepository.findOne({
        where: {userId: id, tenantId},
      });

      if (existingRole) {
        // Update existing role
        await this.userRoleRepository.updateById(existingRole.id, {
          roleKey: body.roleKey,
        });
      } else {
        // Create new role assignment
        await this.userRoleRepository.create({
          userId: id,
          tenantId,
          roleKey: body.roleKey,
        });
      }

      // Log role change
      try {
        await this.activityLogger.logActivity({
          userId: this.currentUser?.id || 'system',
          tenantId,
          action: 'user.role.updated',
          entityType: 'user',
          entityId: id,
          metadata: {
            roleKey: body.roleKey,
            previousRole: existingRole?.roleKey,
          },
        });

        await this.auditLogger.log({
          tenantId,
          action: 'UPDATE',
          targetType: 'USER',
          targetId: id,
          targetName: user.email,
          details: {roleKey: body.roleKey, previousRole: existingRole?.roleKey},
        });
      } catch (err) {
        console.error('[INFO] Failed to log role update:', err);
      }
    }

    // Update status if provided
    if (body.status !== undefined) {
      await this.userRepository.updateById(id, {status: body.status});
    }

    return this.userRepository.findById(id);
  }

  /**
   * Remove a user from the tenant.
   * Used by customer portal owners to remove team members.
   * Performs soft delete by setting deleted flag.
   */
  @authorize({
    permissions: [PermissionKey.DeleteUser],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @del(`${basePath}/{id}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.NO_CONTENT]: {
        description: 'User removed successfully',
      },
    },
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    // SECURITY: Validate user ID format
    this.validateUUID(id, 'User ID');

    const tenantId = this.getTenantId();

    // Verify user belongs to current tenant
    const user = await this.userRepository.findById(id);
    if (user.tenantId !== tenantId) {
      throw new HttpErrors.Forbidden('Cannot delete user from another tenant');
    }

    // Prevent self-deletion
    if (this.currentUser?.id === id) {
      throw new HttpErrors.BadRequest('Cannot delete your own account');
    }

    // Check if user is the owner - prevent owner deletion
    const ownerRole = await this.userRoleRepository.findOne({
      where: {userId: id, tenantId, roleKey: 'owner'},
    });
    if (ownerRole) {
      throw new HttpErrors.BadRequest('Cannot delete the tenant owner');
    }

    // Soft delete user
    await this.userRepository.updateById(id, {deleted: true, deletedOn: new Date()});

    // Delete user role assignments
    await this.userRoleRepository.deleteAll({userId: id, tenantId});

    // Log user deletion
    try {
      await this.activityLogger.logActivity({
        userId: this.currentUser?.id || 'system',
        tenantId,
        action: 'user.deleted',
        entityType: 'user',
        entityId: id,
        metadata: {
          email: user.email,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        },
      });

      await this.auditLogger.log({
        tenantId,
        action: 'DELETE',
        targetType: 'USER',
        targetId: id,
        targetName: user.email,
        details: {deleted: true},
      });
    } catch (err) {
      console.error('[INFO] Failed to log user deletion:', err);
    }
  }
}
