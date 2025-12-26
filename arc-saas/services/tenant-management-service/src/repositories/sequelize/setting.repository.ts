import {Getter, inject} from '@loopback/core';
import {Entity} from '@loopback/repository';
import {SequelizeDataSource} from '@loopback/sequelize';
import {SequelizeUserModifyCrudRepository} from '@sourceloop/core/sequelize';
import {IAuthUserWithPermissions} from '@sourceloop/core';
import {AuthenticationBindings} from 'loopback4-authentication';

import {Setting, SettingRelations} from '../../models';
import {TenantManagementDbSourceName} from '../../types';

/**
 * Setting repository for platform configuration management.
 */
export class SettingRepository<
  T extends Setting = Setting,
> extends SequelizeUserModifyCrudRepository<
  T,
  typeof Setting.prototype.id,
  SettingRelations
> {
  constructor(
    @inject(`datasources.${TenantManagementDbSourceName}`)
    dataSource: SequelizeDataSource,
    @inject.getter(AuthenticationBindings.CURRENT_USER)
    public readonly getCurrentUser: Getter<IAuthUserWithPermissions>,
    @inject('models.Setting')
    private readonly setting: typeof Entity & {prototype: T},
  ) {
    super(setting as any, dataSource, getCurrentUser);
  }

  /**
   * Find a setting by its key
   */
  async findByKey(configKey: string): Promise<T | null> {
    return this.findOne({where: {configKey} as any});
  }

  /**
   * Get all public settings
   */
  async findPublic(): Promise<T[]> {
    return this.find({where: {isPublic: true} as any});
  }

  /**
   * Get settings by category
   */
  async findByCategory(category: string): Promise<T[]> {
    return this.find({where: {category} as any});
  }
}
