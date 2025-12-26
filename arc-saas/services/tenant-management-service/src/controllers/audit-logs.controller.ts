import {inject} from '@loopback/core';
import {
  Count,
  CountSchema,
  Filter,
  FilterExcludingWhere,
  repository,
  Where,
} from '@loopback/repository';
import {get, HttpErrors, param, post, requestBody} from '@loopback/rest';
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
import {AuditLog} from '../models';
import {PermissionKey} from '../permissions';
import {AuditLogRepository} from '../repositories/sequelize';

const basePath = '/audit-logs';

/**
 * Validates if a string is a valid UUID (any version).
 * Accepts UUID v1-v5 and test UUIDs like a0000000-0000-0000-0000-000000000000
 */
function isValidUUID(id: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Controller for audit logs following ARC audit-service pattern.
 * Provides access to the audit trail with multi-tenant isolation.
 */
export class AuditLogsController {
  constructor(
    @repository(AuditLogRepository)
    public auditLogRepository: AuditLogRepository,
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
  @post(basePath, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'AuditLog model instance',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: getModelSchemaRefSF(AuditLog),
          },
        },
      },
    },
  })
  async create(
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: getModelSchemaRefSF(AuditLog, {
            title: 'NewAuditLog',
            exclude: ['id'],
          }),
        },
      },
    })
    auditLog: Omit<AuditLog, 'id'>,
  ): Promise<AuditLog> {
    // Set tenant from current user if not provided
    if (!auditLog.tenantId) {
      auditLog.tenantId = this.getTenantId();
    }
    // Set timestamp if not provided
    if (!auditLog.timestamp) {
      auditLog.timestamp = new Date();
    }
    return this.auditLogRepository.create(auditLog);
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
        description: 'AuditLog model count',
        content: {[CONTENT_TYPE.JSON]: {schema: CountSchema}},
      },
    },
  })
  async count(@param.where(AuditLog) where?: Where<AuditLog>): Promise<Count> {
    // Apply tenant isolation
    const tenantId = this.getTenantId();
    const tenantWhere = {...where, tenantId} as Where<AuditLog>;
    return this.auditLogRepository.count(tenantWhere);
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
        description: 'Array of AuditLog model instances',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'array',
              items: getModelSchemaRefSF(AuditLog, {includeRelations: true}),
            },
          },
        },
      },
    },
  })
  async find(
    @param.filter(AuditLog) filter?: Filter<AuditLog>,
  ): Promise<AuditLog[]> {
    // Apply tenant isolation
    const tenantId = this.getTenantId();
    const tenantFilter: Filter<AuditLog> = {
      ...filter,
      where: {...filter?.where, tenantId} as Where<AuditLog>,
      order: filter?.order ?? ['timestamp DESC'],
    };
    return this.auditLogRepository.find(tenantFilter);
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
        description: 'AuditLog model instance',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: getModelSchemaRefSF(AuditLog, {includeRelations: true}),
          },
        },
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(AuditLog, {exclude: 'where'})
    filter?: FilterExcludingWhere<AuditLog>,
  ): Promise<AuditLog> {
    // Validate UUID
    if (!isValidUUID(id)) {
      throw new HttpErrors.BadRequest('Invalid ID format');
    }

    const log = await this.auditLogRepository.findById(id, filter);

    // Verify tenant isolation
    const tenantId = this.getTenantId();
    if (log.tenantId !== tenantId) {
      throw new HttpErrors.NotFound(`AuditLog with id ${id} not found`);
    }

    return log;
  }

  /**
   * Get audit logs for a specific action type.
   */
  @authorize({
    permissions: [PermissionKey.ViewUserActivity],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/by-action/{action}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Array of AuditLog for a specific action prefix',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'array',
              items: getModelSchemaRefSF(AuditLog, {includeRelations: true}),
            },
          },
        },
      },
    },
  })
  async findByAction(
    @param.path.string('action') action: string,
    @param.filter(AuditLog, {exclude: 'where'})
    filter?: FilterExcludingWhere<AuditLog>,
  ): Promise<AuditLog[]> {
    const tenantId = this.getTenantId();
    return this.auditLogRepository.find({
      ...filter,
      where: {
        tenantId,
        action: {like: `${action}%`},
      } as Where<AuditLog>,
      order: filter?.order ?? ['timestamp DESC'],
    });
  }

  /**
   * Get audit logs for a specific target entity.
   */
  @authorize({
    permissions: [PermissionKey.ViewUserActivity],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/by-target/{targetType}/{targetId}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Array of AuditLog for a specific target',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'array',
              items: getModelSchemaRefSF(AuditLog, {includeRelations: true}),
            },
          },
        },
      },
    },
  })
  async findByTarget(
    @param.path.string('targetType') targetType: string,
    @param.path.string('targetId') targetId: string,
    @param.filter(AuditLog, {exclude: 'where'})
    filter?: FilterExcludingWhere<AuditLog>,
  ): Promise<AuditLog[]> {
    // Validate UUID
    if (!isValidUUID(targetId)) {
      throw new HttpErrors.BadRequest('Invalid targetId format');
    }

    const tenantId = this.getTenantId();
    return this.auditLogRepository.find({
      ...filter,
      where: {tenantId, targetType, targetId} as Where<AuditLog>,
      order: filter?.order ?? ['timestamp DESC'],
    });
  }

  /**
   * Get audit logs by actor (user who performed actions).
   */
  @authorize({
    permissions: [PermissionKey.ViewUserActivity],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/by-actor/{actorId}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Array of AuditLog for a specific actor',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'array',
              items: getModelSchemaRefSF(AuditLog, {includeRelations: true}),
            },
          },
        },
      },
    },
  })
  async findByActor(
    @param.path.string('actorId') actorId: string,
    @param.filter(AuditLog, {exclude: 'where'})
    filter?: FilterExcludingWhere<AuditLog>,
  ): Promise<AuditLog[]> {
    // Validate UUID
    if (!isValidUUID(actorId)) {
      throw new HttpErrors.BadRequest('Invalid actorId format');
    }

    const tenantId = this.getTenantId();
    return this.auditLogRepository.find({
      ...filter,
      where: {tenantId, actorId} as Where<AuditLog>,
      order: filter?.order ?? ['timestamp DESC'],
    });
  }

  /**
   * Get audit logs for a specific tenant.
   * This endpoint allows platform admins or users with ViewUserActivity
   * permission to view audit logs for tenants they manage.
   */
  @authorize({
    permissions: [
      PermissionKey.ViewAuditLogsAnyTenant,
      PermissionKey.ViewUserActivity,
    ],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/by-tenant/{tenantId}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Array of AuditLog for a specific tenant',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'array',
              items: getModelSchemaRefSF(AuditLog, {includeRelations: true}),
            },
          },
        },
      },
    },
  })
  async findByTenant(
    @param.path.string('tenantId') tenantId: string,
    @param.query.number('limit') limit?: number,
    @param.query.number('skip') skip?: number,
    @param.query.string('action') action?: string,
    @param.query.string('startDate') startDate?: string,
    @param.query.string('endDate') endDate?: string,
  ): Promise<AuditLog[]> {
    // Validate UUID
    if (!isValidUUID(tenantId)) {
      throw new HttpErrors.BadRequest('Invalid tenantId format');
    }

    // Build where clause with optional filters
    const whereClause: Where<AuditLog> = {tenantId};

    // Add action prefix filter
    if (action) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (whereClause as any).action = {like: `${action}%`};
    }

    // Add date range filter
    if (startDate || endDate) {
      const timestampFilter: Record<string, Date> = {};
      if (startDate) {
        timestampFilter.gte = new Date(startDate);
      }
      if (endDate) {
        timestampFilter.lte = new Date(endDate);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (whereClause as any).timestamp = timestampFilter;
    }

    return this.auditLogRepository.find({
      where: whereClause,
      order: ['timestamp DESC'],
      limit: limit ?? 50,
      skip: skip ?? 0,
    });
  }

  /**
   * Get audit log count for a specific tenant.
   */
  @authorize({
    permissions: [
      PermissionKey.ViewAuditLogsAnyTenant,
      PermissionKey.ViewUserActivity,
    ],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/by-tenant/{tenantId}/count`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'AuditLog count for a specific tenant',
        content: {[CONTENT_TYPE.JSON]: {schema: CountSchema}},
      },
    },
  })
  async countByTenant(
    @param.path.string('tenantId') tenantId: string,
    @param.query.string('action') action?: string,
  ): Promise<Count> {
    // Validate UUID
    if (!isValidUUID(tenantId)) {
      throw new HttpErrors.BadRequest('Invalid tenantId format');
    }

    const whereClause: Where<AuditLog> = {tenantId};
    if (action) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (whereClause as any).action = {like: `${action}%`};
    }

    return this.auditLogRepository.count(whereClause);
  }
}
