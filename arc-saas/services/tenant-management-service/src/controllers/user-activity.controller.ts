import {inject} from '@loopback/core';
import {
  Count,
  CountSchema,
  Filter,
  FilterExcludingWhere,
  repository,
  Where,
} from '@loopback/repository';
import {get, HttpErrors, param} from '@loopback/rest';
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
import {UserActivity} from '../models';
import {PermissionKey} from '../permissions';
import {UserActivityRepository} from '../repositories/sequelize';

const basePath = '/user-activities';

/**
 * Validates if a string is a valid UUID v4.
 */
function isValidUUID(id: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Controller for user activity / audit logs.
 * Provides read-only access to the audit trail with multi-tenant isolation.
 */
export class UserActivityController {
  constructor(
    @repository(UserActivityRepository)
    public userActivityRepository: UserActivityRepository,
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

  @authorize({
    permissions: [PermissionKey.ViewUserActivity],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/count`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'UserActivity count',
        content: {[CONTENT_TYPE.JSON]: {schema: CountSchema}},
      },
    },
  })
  async count(
    @param.where(UserActivity) where?: Where<UserActivity>,
  ): Promise<Count> {
    // Apply tenant isolation
    const tenantId = this.getTenantId();
    const tenantWhere = {...where, tenantId} as Where<UserActivity>;
    return this.userActivityRepository.count(tenantWhere);
  }

  @authorize({
    permissions: [PermissionKey.ViewUserActivity],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(basePath, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Array of UserActivity model instances (audit logs)',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'array',
              items: getModelSchemaRefSF(UserActivity, {includeRelations: true}),
            },
          },
        },
      },
    },
  })
  async find(
    @param.filter(UserActivity) filter?: Filter<UserActivity>,
  ): Promise<UserActivity[]> {
    // Apply tenant isolation
    const tenantId = this.getTenantId();
    const tenantFilter: Filter<UserActivity> = {
      ...filter,
      where: {...filter?.where, tenantId} as Where<UserActivity>,
      order: filter?.order ?? ['occurredAt DESC'],
    };
    return this.userActivityRepository.find(tenantFilter);
  }

  @authorize({
    permissions: [PermissionKey.ViewUserActivity],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/{id}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'UserActivity model instance',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: getModelSchemaRefSF(UserActivity, {includeRelations: true}),
          },
        },
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(UserActivity, {exclude: 'where'})
    filter?: FilterExcludingWhere<UserActivity>,
  ): Promise<UserActivity> {
    // Validate UUID
    if (!isValidUUID(id)) {
      throw new HttpErrors.BadRequest('Invalid ID format');
    }

    const activity = await this.userActivityRepository.findById(id, filter);

    // Verify tenant isolation
    const tenantId = this.getTenantId();
    if (activity.tenantId !== tenantId) {
      throw new HttpErrors.NotFound(`Activity with id ${id} not found`);
    }

    return activity;
  }

  /**
   * Get activities for a specific tenant.
   * Only accessible if user belongs to that tenant.
   */
  @authorize({
    permissions: [PermissionKey.ViewUserActivity],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/by-tenant/{tenantId}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Array of UserActivity for a specific tenant',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'array',
              items: getModelSchemaRefSF(UserActivity, {includeRelations: true}),
            },
          },
        },
      },
    },
  })
  async findByTenant(
    @param.path.string('tenantId') tenantId: string,
    @param.filter(UserActivity, {exclude: 'where'})
    filter?: FilterExcludingWhere<UserActivity>,
  ): Promise<UserActivity[]> {
    // Validate UUID
    if (!isValidUUID(tenantId)) {
      throw new HttpErrors.BadRequest('Invalid tenantId format');
    }

    // Verify user has access to this tenant
    const userTenantId = this.getTenantId();
    if (tenantId !== userTenantId) {
      throw new HttpErrors.Forbidden('Access denied to this tenant');
    }

    return this.userActivityRepository.find({
      ...filter,
      where: {tenantId} as Where<UserActivity>,
      order: filter?.order ?? ['occurredAt DESC'],
    });
  }

  /**
   * Get activities for a specific user within the current tenant.
   */
  @authorize({
    permissions: [PermissionKey.ViewUserActivity],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/by-user/{userId}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Array of UserActivity for a specific user',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'array',
              items: getModelSchemaRefSF(UserActivity, {includeRelations: true}),
            },
          },
        },
      },
    },
  })
  async findByUser(
    @param.path.string('userId') userId: string,
    @param.filter(UserActivity, {exclude: 'where'})
    filter?: FilterExcludingWhere<UserActivity>,
  ): Promise<UserActivity[]> {
    // Validate UUID
    if (!isValidUUID(userId)) {
      throw new HttpErrors.BadRequest('Invalid userId format');
    }

    // Apply tenant isolation
    const tenantId = this.getTenantId();
    return this.userActivityRepository.find({
      ...filter,
      where: {userId, tenantId} as Where<UserActivity>,
      order: filter?.order ?? ['occurredAt DESC'],
    });
  }
}
