import {inject, service} from '@loopback/core';
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
  HttpErrors,
  param,
  patch,
  post,
  put,
  requestBody,
} from '@loopback/rest';
import {
  CONTENT_TYPE,
  getModelSchemaRefSF,
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
import {UserRole} from '../models';
import {RoleScopeType} from '../enums';
import {PermissionKey} from '../permissions';
import {UserRoleRepository, UserRepository, TenantRepository} from '../repositories/sequelize';
import {ActivityLoggerService} from '../services/activity-logger.service';
import {AuditLoggerService} from '../services/audit-logger.service';
import {TemporalClientService} from '../services/temporal-client.service';

const basePath = '/roles';

/**
 * Validates if a string is a valid UUID (any version).
 */
function isValidUUID(id: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Controller for managing user roles (RBAC).
 * Supports multi-tenant isolation - users can only access roles within their tenant.
 */
export class RolesController {
  constructor(
    @repository(UserRoleRepository)
    public userRoleRepository: UserRoleRepository,
    @repository(UserRepository)
    private readonly userRepository: UserRepository,
    @repository(TenantRepository)
    private readonly tenantRepository: TenantRepository,
    @service(ActivityLoggerService)
    private readonly activityLogger: ActivityLoggerService,
    @service(AuditLoggerService)
    private readonly auditLogger: AuditLoggerService,
    @service(TemporalClientService)
    private readonly temporalClient: TemporalClientService,
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
   * Create a new user role assignment.
   * Validates for duplicate assignments and applies tenant isolation.
   */
  @authorize({
    permissions: [PermissionKey.AssignRole],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @post(basePath, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'UserRole model instance',
        content: {
          [CONTENT_TYPE.JSON]: {schema: getModelSchemaRefSF(UserRole)},
        },
      },
    },
  })
  async create(
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: getModelSchemaRefSF(UserRole, {
            title: 'NewUserRole',
            exclude: ['id', 'createdOn', 'modifiedOn', 'createdBy', 'modifiedBy'],
          }),
        },
      },
    })
    userRole: Omit<UserRole, 'id'>,
  ): Promise<UserRole> {
    // Validate UUIDs
    if (userRole.userId && !isValidUUID(userRole.userId)) {
      throw new HttpErrors.BadRequest('Invalid userId format');
    }
    if (userRole.tenantId && !isValidUUID(userRole.tenantId)) {
      throw new HttpErrors.BadRequest('Invalid tenantId format');
    }

    // Apply default scopeType if not provided
    if (!userRole.scopeType) {
      userRole.scopeType = RoleScopeType.Tenant;
    }

    // Check for duplicate role assignment
    const existing = await this.userRoleRepository.findOne({
      where: {
        userId: userRole.userId,
        roleKey: userRole.roleKey,
        tenantId: userRole.tenantId,
        scopeType: userRole.scopeType,
        scopeId: userRole.scopeId ?? undefined,
      } as any,
    });

    if (existing) {
      throw new HttpErrors.Conflict(
        `Role '${userRole.roleKey}' is already assigned to this user`,
      );
    }

    const createdRole = await this.userRoleRepository.create(userRole);

    // Log role assignment
    let user: {email?: string; firstName?: string; lastName?: string; authId?: string} | null = null;
    const tenantId = userRole.tenantId || this.getTenantId();
    try {
      user = userRole.userId
        ? await this.userRepository.findById(userRole.userId)
        : null;

      await this.activityLogger.logRoleAssigned(
        userRole.userId || 'unknown',
        tenantId,
        userRole.roleKey || 'unknown',
        this.currentUser?.id?.toString(),
      );
      await this.auditLogger.logRoleAssigned(
        userRole.userId || 'unknown',
        user?.email || 'unknown',
        userRole.roleKey || 'unknown',
        tenantId,
      );
    } catch {
      // Don't fail the operation if logging fails
    }

    // Sync role to App Plane via Temporal workflow
    try {
      // Skip sync if user info is incomplete (required for workflow)
      if (!user?.email) {
        console.warn('Cannot sync role to App Plane: user email not found', {
          userId: userRole.userId,
          tenantId,
        });
        return createdRole;
      }

      // Get tenant key for App Plane sync
      const tenant = await this.tenantRepository.findById(tenantId);
      if (!tenant?.key) {
        console.warn('Cannot sync role to App Plane: tenant key not found', {tenantId});
        return createdRole;
      }

      await this.temporalClient.startSyncUserRoleWorkflow({
        operation: 'assign',
        tenantId,
        tenantKey: tenant.key,
        userId: userRole.userId || '',
        userEmail: user.email,
        firstName: user?.firstName,
        lastName: user?.lastName,
        keycloakUserId: user?.authId,
        roleKey: userRole.roleKey || '',
        scopeType: userRole.scopeType,
        scopeId: userRole.scopeId,
        performedBy: this.currentUser?.id?.toString() || 'system',
      });
    } catch (syncError) {
      // Don't fail the operation if workflow triggering fails
      // Role sync is non-critical and can be retried
      console.warn('Failed to trigger App Plane role sync workflow', {
        roleId: createdRole.id,
        error: syncError instanceof Error ? syncError.message : 'Unknown error',
      });
    }

    return createdRole;
  }

  @authorize({
    permissions: [PermissionKey.ViewRole],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/count`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'UserRole count',
        content: {[CONTENT_TYPE.JSON]: {schema: CountSchema}},
      },
    },
  })
  async count(@param.where(UserRole) where?: Where<UserRole>): Promise<Count> {
    // Apply tenant isolation
    const tenantId = this.getTenantId();
    const tenantWhere = {...where, tenantId} as Where<UserRole>;
    return this.userRoleRepository.count(tenantWhere);
  }

  @authorize({
    permissions: [PermissionKey.ViewRole],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(basePath, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Array of UserRole model instances',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'array',
              items: getModelSchemaRefSF(UserRole, {includeRelations: true}),
            },
          },
        },
      },
    },
  })
  async find(
    @param.filter(UserRole) filter?: Filter<UserRole>,
  ): Promise<UserRole[]> {
    // Apply tenant isolation
    const tenantId = this.getTenantId();
    const tenantFilter: Filter<UserRole> = {
      ...filter,
      where: {...filter?.where, tenantId} as Where<UserRole>,
    };
    return this.userRoleRepository.find(tenantFilter);
  }

  @authorize({
    permissions: [PermissionKey.ViewRole],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/{id}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'UserRole model instance',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: getModelSchemaRefSF(UserRole, {includeRelations: true}),
          },
        },
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(UserRole, {exclude: 'where'})
    filter?: FilterExcludingWhere<UserRole>,
  ): Promise<UserRole> {
    // Validate UUID
    if (!isValidUUID(id)) {
      throw new HttpErrors.BadRequest('Invalid ID format');
    }

    const role = await this.userRoleRepository.findById(id, filter);

    // Verify tenant isolation
    const tenantId = this.getTenantId();
    if (role.tenantId !== tenantId) {
      throw new HttpErrors.NotFound(`Role with id ${id} not found`);
    }

    return role;
  }

  @authorize({
    permissions: [PermissionKey.UpdateRole],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @patch(`${basePath}/{id}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.NO_CONTENT]: {
        description: 'UserRole PATCH success',
      },
    },
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: getModelSchemaRefSF(UserRole, {
            partial: true,
            exclude: ['id', 'userId', 'tenantId', 'createdOn', 'createdBy'],
          }),
        },
      },
    })
    userRole: Partial<UserRole>,
  ): Promise<void> {
    // Validate UUID
    if (!isValidUUID(id)) {
      throw new HttpErrors.BadRequest('Invalid ID format');
    }

    // Verify tenant isolation before update
    const existing = await this.userRoleRepository.findById(id);
    const tenantId = this.getTenantId();
    if (existing.tenantId !== tenantId) {
      throw new HttpErrors.NotFound(`Role with id ${id} not found`);
    }

    // Prevent changing userId or tenantId
    delete userRole.userId;
    delete userRole.tenantId;

    // Track if roleKey is changing (for App Plane sync)
    const previousRoleKey = existing.roleKey;
    const isRoleKeyChanging = userRole.roleKey && userRole.roleKey !== previousRoleKey;

    await this.userRoleRepository.updateById(id, userRole);

    // Sync role update to App Plane if roleKey changed
    if (isRoleKeyChanging) {
      try {
        const user = existing.userId
          ? await this.userRepository.findById(existing.userId)
          : null;

        // Skip sync if user email is not available
        if (!user?.email) {
          console.warn('Cannot sync role update to App Plane: user email not found', {
            userId: existing.userId,
            tenantId,
          });
          return;
        }

        const tenant = await this.tenantRepository.findById(tenantId);
        if (!tenant?.key) {
          console.warn('Cannot sync role update to App Plane: tenant key not found', {tenantId});
          return;
        }

        await this.temporalClient.startSyncUserRoleWorkflow({
          operation: 'update',
          tenantId,
          tenantKey: tenant.key,
          userId: existing.userId || '',
          userEmail: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          keycloakUserId: user.authId,
          roleKey: userRole.roleKey || '',
          previousRoleKey,
          scopeType: userRole.scopeType || existing.scopeType,
          scopeId: userRole.scopeId || existing.scopeId,
          performedBy: this.currentUser?.id?.toString() || 'system',
        });
      } catch (syncError) {
        // Don't fail the operation if workflow triggering fails
        console.warn('Failed to trigger App Plane role update sync workflow', {
          roleId: id,
          error: syncError instanceof Error ? syncError.message : 'Unknown error',
        });
      }
    }
  }

  @authorize({
    permissions: [PermissionKey.UpdateRole],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @put(`${basePath}/{id}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.NO_CONTENT]: {
        description: 'UserRole PUT success',
      },
    },
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: getModelSchemaRefSF(UserRole),
        },
      },
    })
    userRole: UserRole,
  ): Promise<void> {
    // Validate UUID
    if (!isValidUUID(id)) {
      throw new HttpErrors.BadRequest('Invalid ID format');
    }

    // Verify tenant isolation before replace
    const existing = await this.userRoleRepository.findById(id);
    const tenantId = this.getTenantId();
    if (existing.tenantId !== tenantId) {
      throw new HttpErrors.NotFound(`Role with id ${id} not found`);
    }

    // Ensure tenantId remains unchanged
    userRole.tenantId = tenantId;

    // Track if roleKey is changing (for App Plane sync)
    const previousRoleKey = existing.roleKey;
    const isRoleKeyChanging = userRole.roleKey && userRole.roleKey !== previousRoleKey;

    await this.userRoleRepository.replaceById(id, userRole);

    // Sync role update to App Plane if roleKey changed
    if (isRoleKeyChanging) {
      try {
        const user = existing.userId
          ? await this.userRepository.findById(existing.userId)
          : null;

        // Skip sync if user email is not available
        if (!user?.email) {
          console.warn('Cannot sync role update to App Plane: user email not found', {
            userId: existing.userId,
            tenantId,
          });
          return;
        }

        const tenant = await this.tenantRepository.findById(tenantId);
        if (!tenant?.key) {
          console.warn('Cannot sync role update to App Plane: tenant key not found', {tenantId});
          return;
        }

        await this.temporalClient.startSyncUserRoleWorkflow({
          operation: 'update',
          tenantId,
          tenantKey: tenant.key,
          userId: existing.userId || '',
          userEmail: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          keycloakUserId: user.authId,
          roleKey: userRole.roleKey || '',
          previousRoleKey,
          scopeType: userRole.scopeType || existing.scopeType,
          scopeId: userRole.scopeId || existing.scopeId,
          performedBy: this.currentUser?.id?.toString() || 'system',
        });
      } catch (syncError) {
        // Don't fail the operation if workflow triggering fails
        console.warn('Failed to trigger App Plane role update sync workflow', {
          roleId: id,
          error: syncError instanceof Error ? syncError.message : 'Unknown error',
        });
      }
    }
  }

  @authorize({
    permissions: [PermissionKey.RevokeRole],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @del(`${basePath}/{id}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.NO_CONTENT]: {
        description: 'UserRole DELETE success',
      },
    },
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    // Validate UUID
    if (!isValidUUID(id)) {
      throw new HttpErrors.BadRequest('Invalid ID format');
    }

    // Verify tenant isolation before delete
    const existing = await this.userRoleRepository.findById(id);
    const tenantId = this.getTenantId();
    if (existing.tenantId !== tenantId) {
      throw new HttpErrors.NotFound(`Role with id ${id} not found`);
    }

    await this.userRoleRepository.deleteById(id);

    // Log role revocation
    let user: {email?: string; firstName?: string; lastName?: string; authId?: string} | null = null;
    try {
      user = existing.userId
        ? await this.userRepository.findById(existing.userId)
        : null;

      await this.activityLogger.logRoleRevoked(
        existing.userId || 'unknown',
        tenantId,
        existing.roleKey || 'unknown',
        this.currentUser?.id?.toString(),
      );
      await this.auditLogger.logRoleRevoked(
        existing.userId || 'unknown',
        user?.email || 'unknown',
        existing.roleKey || 'unknown',
        tenantId,
      );
    } catch {
      // Don't fail the operation if logging fails
    }

    // Sync role revocation to App Plane via Temporal workflow
    try {
      // Skip sync if user email is not available
      if (!user?.email) {
        console.warn('Cannot sync role revocation to App Plane: user email not found', {
          userId: existing.userId,
          tenantId,
        });
        return;
      }

      // Get tenant key for App Plane sync
      const tenant = await this.tenantRepository.findById(tenantId);
      if (!tenant?.key) {
        console.warn('Cannot sync role revocation to App Plane: tenant key not found', {tenantId});
        return;
      }

      await this.temporalClient.startSyncUserRoleWorkflow({
        operation: 'revoke',
        tenantId,
        tenantKey: tenant.key,
        userId: existing.userId || '',
        userEmail: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        keycloakUserId: user.authId,
        roleKey: existing.roleKey || '',
        scopeType: existing.scopeType,
        scopeId: existing.scopeId,
        performedBy: this.currentUser?.id?.toString() || 'system',
      });
    } catch (syncError) {
      // Don't fail the operation if workflow triggering fails
      // Role sync is non-critical and can be retried
      console.warn('Failed to trigger App Plane role revocation sync workflow', {
        roleId: id,
        error: syncError instanceof Error ? syncError.message : 'Unknown error',
      });
    }
  }

  /**
   * Get roles for a specific user within the current tenant.
   */
  @authorize({
    permissions: [PermissionKey.ViewRole],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/by-user/{userId}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Array of UserRole for a specific user',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'array',
              items: getModelSchemaRefSF(UserRole, {includeRelations: true}),
            },
          },
        },
      },
    },
  })
  async findByUser(
    @param.path.string('userId') userId: string,
    @param.filter(UserRole, {exclude: 'where'})
    filter?: FilterExcludingWhere<UserRole>,
  ): Promise<UserRole[]> {
    // Validate UUID
    if (!isValidUUID(userId)) {
      throw new HttpErrors.BadRequest('Invalid userId format');
    }

    // Apply tenant isolation
    const tenantId = this.getTenantId();
    return this.userRoleRepository.find({
      ...filter,
      where: {userId, tenantId} as Where<UserRole>,
    });
  }

  /**
   * Get roles for a specific tenant.
   * Only accessible if user belongs to that tenant.
   */
  @authorize({
    permissions: [PermissionKey.ViewRole],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/by-tenant/{tenantId}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Array of UserRole for a specific tenant',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'array',
              items: getModelSchemaRefSF(UserRole, {includeRelations: true}),
            },
          },
        },
      },
    },
  })
  async findByTenant(
    @param.path.string('tenantId') tenantId: string,
    @param.filter(UserRole, {exclude: 'where'})
    filter?: FilterExcludingWhere<UserRole>,
  ): Promise<UserRole[]> {
    // Validate UUID
    if (!isValidUUID(tenantId)) {
      throw new HttpErrors.BadRequest('Invalid tenantId format');
    }

    // Verify user has access to this tenant
    const userTenantId = this.getTenantId();
    if (tenantId !== userTenantId) {
      throw new HttpErrors.Forbidden('Access denied to this tenant');
    }

    return this.userRoleRepository.find({
      ...filter,
      where: {tenantId} as Where<UserRole>,
    });
  }
}
