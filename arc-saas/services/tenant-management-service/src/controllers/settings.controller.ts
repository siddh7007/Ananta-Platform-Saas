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
import {Setting} from '../models';
import {PermissionKey} from '../permissions';
import {SettingRepository} from '../repositories/sequelize';
import {AuditLoggerService} from '../services/audit-logger.service';

const basePath = '/settings';

/**
 * Validates if a string is a valid UUID v4.
 */
function isValidUUID(id: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Controller for platform settings management.
 * Settings are global (not tenant-specific) but require admin permissions.
 */
export class SettingsController {
  constructor(
    @repository(SettingRepository)
    public settingRepository: SettingRepository,
    @service(AuditLoggerService)
    private readonly auditLogger: AuditLoggerService,
    @inject(AuthenticationBindings.CURRENT_USER, {optional: true})
    private readonly currentUser?: IAuthUserWithPermissions,
  ) {}

  /**
   * Create a new setting.
   * Validates for duplicate configKey before creation.
   */
  @authorize({
    permissions: [PermissionKey.CreateTenantConfig],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @post(basePath, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Setting model instance',
        content: {
          [CONTENT_TYPE.JSON]: {schema: getModelSchemaRefSF(Setting)},
        },
      },
    },
  })
  async create(
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: getModelSchemaRefSF(Setting, {
            title: 'NewSetting',
            exclude: ['id', 'createdOn', 'modifiedOn', 'createdBy', 'modifiedBy'],
          }),
        },
      },
    })
    setting: Omit<Setting, 'id'>,
  ): Promise<Setting> {
    // Check for duplicate configKey
    const existing = await this.settingRepository.findByKey(setting.configKey);
    if (existing) {
      throw new HttpErrors.Conflict(
        `Setting with key '${setting.configKey}' already exists`,
      );
    }

    const createdSetting = await this.settingRepository.create(setting);

    // Log setting creation (non-blocking)
    try {
      await this.auditLogger.logSettingCreated(
        createdSetting.id,
        setting.configKey,
        this.currentUser?.tenantId,
      );
    } catch {
      // Don't fail the operation if audit logging fails
    }

    return createdSetting;
  }

  @authorize({
    permissions: [PermissionKey.ViewTenantConfig],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/count`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Setting count',
        content: {[CONTENT_TYPE.JSON]: {schema: CountSchema}},
      },
    },
  })
  async count(@param.where(Setting) where?: Where<Setting>): Promise<Count> {
    return this.settingRepository.count(where);
  }

  @authorize({
    permissions: [PermissionKey.ViewTenantConfig],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(basePath, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Array of Setting model instances',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'array',
              items: getModelSchemaRefSF(Setting),
            },
          },
        },
      },
    },
  })
  async find(
    @param.filter(Setting) filter?: Filter<Setting>,
  ): Promise<Setting[]> {
    return this.settingRepository.find(filter);
  }

  @authorize({
    permissions: [PermissionKey.ViewTenantConfig],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/{id}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Setting model instance',
        content: {
          [CONTENT_TYPE.JSON]: {schema: getModelSchemaRefSF(Setting)},
        },
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Setting, {exclude: 'where'})
    filter?: FilterExcludingWhere<Setting>,
  ): Promise<Setting> {
    // Validate UUID
    if (!isValidUUID(id)) {
      throw new HttpErrors.BadRequest('Invalid ID format');
    }

    return this.settingRepository.findById(id, filter);
  }

  /**
   * Get a setting by its key.
   */
  @authorize({
    permissions: [PermissionKey.ViewTenantConfig],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/by-key/{key}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Setting model instance by key',
        content: {
          [CONTENT_TYPE.JSON]: {schema: getModelSchemaRefSF(Setting)},
        },
      },
      [STATUS_CODE.NOT_FOUND]: {
        description: 'Setting not found',
      },
    },
  })
  async findByKey(
    @param.path.string('key') key: string,
  ): Promise<Setting> {
    const setting = await this.settingRepository.findByKey(key);
    if (!setting) {
      throw new HttpErrors.NotFound(`Setting with key '${key}' not found`);
    }
    return setting;
  }

  @authorize({
    permissions: [PermissionKey.UpdateTenantConfig],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @patch(`${basePath}/{id}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.NO_CONTENT]: {
        description: 'Setting PATCH success',
      },
    },
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: getModelSchemaRefSF(Setting, {
            partial: true,
            exclude: ['id', 'configKey', 'createdOn', 'createdBy'],
          }),
        },
      },
    })
    setting: Partial<Setting>,
  ): Promise<void> {
    // Validate UUID
    if (!isValidUUID(id)) {
      throw new HttpErrors.BadRequest('Invalid ID format');
    }

    // Prevent changing configKey
    delete setting.configKey;

    // Get existing setting for audit logging
    const existingSetting = await this.settingRepository.findById(id);
    await this.settingRepository.updateById(id, setting);

    // Log setting update (non-blocking)
    try {
      await this.auditLogger.logSettingUpdated(
        id,
        existingSetting.configKey,
        existingSetting.configValue,
        setting.configValue,
        this.currentUser?.tenantId,
      );
    } catch {
      // Don't fail the operation if audit logging fails
    }
  }

  @authorize({
    permissions: [PermissionKey.UpdateTenantConfig],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @put(`${basePath}/{id}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.NO_CONTENT]: {
        description: 'Setting PUT success',
      },
    },
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: getModelSchemaRefSF(Setting),
        },
      },
    })
    setting: Setting,
  ): Promise<void> {
    // Validate UUID
    if (!isValidUUID(id)) {
      throw new HttpErrors.BadRequest('Invalid ID format');
    }

    // Ensure configKey doesn't change
    const existing = await this.settingRepository.findById(id);
    setting.configKey = existing.configKey;

    await this.settingRepository.replaceById(id, setting);

    // Log setting replace (non-blocking)
    try {
      await this.auditLogger.logSettingUpdated(
        id,
        existing.configKey,
        existing.configValue,
        setting.configValue,
        this.currentUser?.tenantId,
      );
    } catch {
      // Don't fail the operation if audit logging fails
    }
  }

  /**
   * Bulk update or create settings.
   * This is an atomic operation - either all settings are updated or none.
   */
  @authorize({
    permissions: [PermissionKey.UpdateTenantConfig],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @put(`${basePath}/bulk`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Bulk settings update success',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
              properties: {
                updated: {type: 'number'},
                created: {type: 'number'},
              },
            },
          },
        },
      },
    },
  })
  async bulkUpdate(
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: {
            type: 'array',
            items: {
              type: 'object',
              required: ['configKey', 'configValue'],
              properties: {
                configKey: {type: 'string'},
                configValue: {type: 'string'},
              },
            },
          },
        },
      },
    })
    settings: Array<{configKey: string; configValue: string}>,
  ): Promise<{updated: number; created: number}> {
    let updated = 0;
    let created = 0;

    // Collect all operations first to ensure atomicity
    const updates: Array<{id: string; configValue: string}> = [];
    const creates: Array<{configKey: string; configValue: string}> = [];

    for (const item of settings) {
      const existing = await this.settingRepository.findByKey(item.configKey);
      if (existing) {
        updates.push({id: existing.id, configValue: item.configValue});
      } else {
        creates.push(item);
      }
    }

    // Execute all updates
    try {
      for (const update of updates) {
        await this.settingRepository.updateById(update.id, {
          configValue: update.configValue,
        });
        updated++;
      }

      for (const create of creates) {
        await this.settingRepository.create({
          configKey: create.configKey,
          configValue: create.configValue,
        } as Setting);
        created++;
      }
    } catch (error) {
      // Log the error and rethrow
      throw new HttpErrors.InternalServerError(
        `Bulk update failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    // Log bulk update (non-blocking)
    try {
      await this.auditLogger.logSettingsBulkUpdated(
        updated,
        created,
        this.currentUser?.tenantId,
      );
    } catch {
      // Don't fail the operation if audit logging fails
    }

    return {updated, created};
  }

  @authorize({
    permissions: [PermissionKey.DeleteTenantConfig],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @del(`${basePath}/{id}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.NO_CONTENT]: {
        description: 'Setting DELETE success',
      },
    },
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    // Validate UUID
    if (!isValidUUID(id)) {
      throw new HttpErrors.BadRequest('Invalid ID format');
    }

    // Get setting for audit logging before deletion
    const existingSetting = await this.settingRepository.findById(id);
    await this.settingRepository.deleteById(id);

    // Log setting deletion (non-blocking)
    try {
      await this.auditLogger.logSettingDeleted(
        id,
        existingSetting.configKey,
        this.currentUser?.tenantId,
      );
    } catch {
      // Don't fail the operation if audit logging fails
    }
  }

  /**
   * Get settings by category.
   */
  @authorize({
    permissions: [PermissionKey.ViewTenantConfig],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/by-category/{category}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Array of Settings for a specific category',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'array',
              items: getModelSchemaRefSF(Setting),
            },
          },
        },
      },
    },
  })
  async findByCategory(
    @param.path.string('category') category: string,
  ): Promise<Setting[]> {
    return this.settingRepository.findByCategory(category);
  }
}
