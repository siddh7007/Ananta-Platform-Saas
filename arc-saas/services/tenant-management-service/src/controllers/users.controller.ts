import {inject} from '@loopback/core';
import {
  Count,
  CountSchema,
  Filter,
  FilterExcludingWhere,
  repository,
  Where,
} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  HttpErrors,
  param,
  patch,
  post,
  put,
  requestBody,
  response,
} from '@loopback/rest';
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
import {User, UserRole} from '../models';
import {PermissionKey} from '../permissions';
import {RoleScopeType} from '../enums';
import {ActivityLoggerService} from '../services/activity-logger.service';
import {AuditLoggerService} from '../services/audit-logger.service';

const basePath = '/users';

/**
 * User management controller.
 * Provides CRUD operations and role management for users.
 */
export class UsersController {
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
   * Get the current user's tenant ID for logging context.
   */
  private getTenantId(): string {
    return this.currentUser?.tenantId || 'system';
  }

  @authorize({
    permissions: [PermissionKey.CreateUser],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @post(basePath, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'User model instance',
        content: {
          [CONTENT_TYPE.JSON]: {schema: getModelSchemaRefSF(User)},
        },
      },
    },
  })
  async create(
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: {
            type: 'object',
            title: 'NewUserWithRole',
            required: ['email', 'tenantId'],
            properties: {
              email: {type: 'string', format: 'email'},
              firstName: {type: 'string'},
              lastName: {type: 'string'},
              username: {type: 'string'},
              tenantId: {type: 'string', format: 'uuid'},
              status: {type: 'number'},
              roleKey: {type: 'string', description: 'Optional initial role to assign'},
            },
          },
        },
      },
    })
    userData: Omit<User, 'id'> & {roleKey?: string},
  ): Promise<User> {
    // Extract roleKey before creating user (it's not a User model property)
    const {roleKey, ...user} = userData;

    const createdUser = await this.userRepository.create(user);
    const tenantId = user.tenantId || this.getTenantId();

    // BUG-003 FIX: Create UserRole record if roleKey is provided
    if (roleKey) {
      try {
        await this.userRoleRepository.create({
          userId: createdUser.id,
          roleKey: roleKey,
          tenantId: tenantId,
          scopeType: RoleScopeType.Tenant,
          scopeId: tenantId,
        });

        // Log role assignment
        await this.activityLogger.logRoleAssigned(
          createdUser.id,
          tenantId,
          roleKey,
          this.currentUser?.id?.toString(),
        );
        await this.auditLogger.logRoleAssigned(
          createdUser.id,
          user.email || 'unknown',
          roleKey,
          tenantId,
        );
      } catch (error) {
        // Log but don't fail user creation if role assignment fails
        console.warn(`Failed to assign initial role ${roleKey} to user ${createdUser.id}:`, error);
      }
    }

    // Log user creation (non-blocking)
    try {
      await this.activityLogger.logUserCreated(
        createdUser.id,
        tenantId,
        this.currentUser?.id?.toString(),
        {email: user.email, roleKey},
      );
      await this.auditLogger.logUserCreated(
        createdUser.id,
        user.email || 'unknown',
        tenantId,
      );
    } catch {
      // Don't fail the operation if audit logging fails
    }

    return createdUser;
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
        description: 'User model count',
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
        description: 'Array of User model instances',
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

  @authorize({
    permissions: [PermissionKey.UpdateUser],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @patch(basePath, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'User PATCH success count',
        content: {[CONTENT_TYPE.JSON]: {schema: CountSchema}},
      },
    },
  })
  async updateAll(
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: getModelSchemaRefSF(User, {partial: true}),
        },
      },
    })
    user: User,
    @param.where(User) where?: Where<User>,
  ): Promise<Count> {
    return this.userRepository.updateAll(user, where);
  }

  @authorize({
    permissions: [PermissionKey.ViewUser],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/{id}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'User model instance',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: getModelSchemaRefSF(User, {includeRelations: true}),
          },
        },
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(User, {exclude: 'where'})
    filter?: FilterExcludingWhere<User>,
  ): Promise<User> {
    return this.userRepository.findById(id, filter);
  }

  @authorize({
    permissions: [PermissionKey.UpdateUser],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @patch(`${basePath}/{id}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.NO_CONTENT]: {
        description: 'User PATCH success',
      },
    },
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: getModelSchemaRefSF(User, {partial: true}),
        },
      },
    })
    user: User,
  ): Promise<void> {
    const existingUser = await this.userRepository.findById(id);
    await this.userRepository.updateById(id, user);

    // Log user update (non-blocking)
    try {
      await this.auditLogger.logUserUpdated(
        id,
        existingUser.email || 'unknown',
        user as unknown as Record<string, unknown>,
        existingUser.tenantId || this.getTenantId(),
      );
    } catch {
      // Don't fail the operation if audit logging fails
    }
  }

  @authorize({
    permissions: [PermissionKey.UpdateUser],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @put(`${basePath}/{id}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.NO_CONTENT]: {
        description: 'User PUT success',
      },
    },
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: getModelSchemaRefSF(User),
        },
      },
    })
    user: User,
  ): Promise<void> {
    const existingUser = await this.userRepository.findById(id);
    await this.userRepository.replaceById(id, user);

    // Log user replace (non-blocking)
    try {
      await this.auditLogger.logUserUpdated(
        id,
        existingUser.email || 'unknown',
        {replaced: true, newData: user as unknown as Record<string, unknown>},
        existingUser.tenantId || this.getTenantId(),
      );
    } catch {
      // Don't fail the operation if audit logging fails
    }
  }

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
        description: 'User DELETE success',
      },
    },
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    const existingUser = await this.userRepository.findById(id);
    await this.userRepository.deleteById(id);

    // Log user deletion (non-blocking)
    try {
      await this.auditLogger.logUserDeleted(
        id,
        existingUser.email || 'unknown',
        existingUser.tenantId || this.getTenantId(),
      );
    } catch {
      // Don't fail the operation if audit logging fails
    }
  }

  /**
   * Suspend a user account.
   * Sets user status to suspended and prevents login.
   */
  @authorize({
    permissions: [PermissionKey.SuspendUser],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @post(`${basePath}/{id}/suspend`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.NO_CONTENT]: {
        description: 'User suspended successfully',
      },
    },
  })
  async suspend(@param.path.string('id') id: string): Promise<void> {
    const existingUser = await this.userRepository.findById(id);
    const oldStatus = existingUser.status;

    await this.userRepository.updateById(id, {
      status: 2, // UserStatus.Suspended
    });

    // Log user suspension (non-blocking)
    const tenantId = existingUser.tenantId || this.getTenantId();
    try {
      await this.activityLogger.logUserStatusChange(
        id,
        tenantId,
        oldStatus || 1,
        2,
        this.currentUser?.id?.toString(),
      );
      await this.auditLogger.logUserSuspended(
        id,
        existingUser.email || 'unknown',
        tenantId,
      );
    } catch {
      // Don't fail the operation if audit logging fails
    }
  }

  /**
   * Activate a suspended user account.
   * Sets user status to active and allows login.
   */
  @authorize({
    permissions: [PermissionKey.ActivateUser],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @post(`${basePath}/{id}/activate`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.NO_CONTENT]: {
        description: 'User activated successfully',
      },
    },
  })
  async activate(@param.path.string('id') id: string): Promise<void> {
    const existingUser = await this.userRepository.findById(id);
    const oldStatus = existingUser.status;

    await this.userRepository.updateById(id, {
      status: 1, // UserStatus.Active
    });

    // Log user activation (non-blocking)
    const tenantId = existingUser.tenantId || this.getTenantId();
    try {
      await this.activityLogger.logUserStatusChange(
        id,
        tenantId,
        oldStatus || 2,
        1,
        this.currentUser?.id?.toString(),
      );
      await this.auditLogger.logUserActivated(
        id,
        existingUser.email || 'unknown',
        tenantId,
      );
    } catch {
      // Don't fail the operation if audit logging fails
    }
  }

  /**
   * Get user roles.
   * Returns all role assignments for a specific user.
   */
  @authorize({
    permissions: [PermissionKey.ViewRole],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/{id}/roles`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Array of user role assignments',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'array',
              items: getModelSchemaRefSF(UserRole),
            },
          },
        },
      },
    },
  })
  async getRoles(@param.path.string('id') id: string): Promise<UserRole[]> {
    return this.userRoleRepository.find({
      where: {userId: id, deleted: false},
    });
  }

  /**
   * Assign a role to a user.
   * Creates a new role assignment with permissions.
   */
  @authorize({
    permissions: [PermissionKey.AssignRole],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @post(`${basePath}/{id}/roles`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Role assigned to user',
        content: {
          [CONTENT_TYPE.JSON]: {schema: getModelSchemaRefSF(UserRole)},
        },
      },
    },
  })
  async assignRole(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: getModelSchemaRefSF(UserRole, {
            title: 'AssignRole',
            exclude: ['id', 'userId', 'createdOn', 'modifiedOn', 'deleted'],
          }),
        },
      },
    })
    role: Omit<UserRole, 'id' | 'userId'>,
  ): Promise<UserRole> {
    const user = await this.userRepository.findById(id);
    const createdRole = await this.userRoleRepository.create({
      ...role,
      userId: id,
    });

    // Log role assignment (non-blocking)
    const tenantId = user.tenantId || role.tenantId || this.getTenantId();
    try {
      await this.activityLogger.logRoleAssigned(
        id,
        tenantId,
        role.roleKey || 'unknown',
        this.currentUser?.id?.toString(),
      );
      await this.auditLogger.logRoleAssigned(
        id,
        user.email || 'unknown',
        role.roleKey || 'unknown',
        tenantId,
      );
    } catch {
      // Don't fail the operation if audit logging fails
    }

    return createdRole;
  }

  /**
   * Revoke a role from a user.
   * Soft deletes the role assignment.
   */
  @authorize({
    permissions: [PermissionKey.RevokeRole],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @del(`${basePath}/{id}/roles/{roleId}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.NO_CONTENT]: {
        description: 'Role revoked from user',
      },
    },
  })
  async revokeRole(
    @param.path.string('id') id: string,
    @param.path.string('roleId') roleId: string,
  ): Promise<void> {
    const user = await this.userRepository.findById(id);
    const role = await this.userRoleRepository.findById(roleId);

    await this.userRoleRepository.deleteById(roleId);

    // Log role revocation (non-blocking)
    const tenantId = user.tenantId || role.tenantId || this.getTenantId();
    try {
      await this.activityLogger.logRoleRevoked(
        id,
        tenantId,
        role.roleKey || 'unknown',
        this.currentUser?.id?.toString(),
      );
      await this.auditLogger.logRoleRevoked(
        id,
        user.email || 'unknown',
        role.roleKey || 'unknown',
        tenantId,
      );
    } catch {
      // Don't fail the operation if audit logging fails
    }
  }
}
