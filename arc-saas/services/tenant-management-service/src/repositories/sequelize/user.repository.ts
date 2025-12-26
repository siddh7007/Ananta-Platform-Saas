import {Getter, inject} from '@loopback/core';
import {
  BelongsToAccessor,
  Entity,
  HasManyRepositoryFactory,
  repository,
} from '@loopback/repository';
import {SequelizeDataSource} from '@loopback/sequelize';
import {SequelizeUserModifyCrudRepository} from '@sourceloop/core/sequelize';
import {IAuthUserWithPermissions} from '@sourceloop/core';
import {AuthenticationBindings} from 'loopback4-authentication';

import {
  User,
  UserRelations,
  Tenant,
  UserRole,
  UserActivity,
} from '../../models';
import {TenantRepository} from './tenant.repository';
import {UserRoleRepository} from './user-role.repository';
import {UserActivityRepository} from './user-activity.repository';
import {TenantManagementDbSourceName} from '../../types';

/**
 * User repository for managing platform users.
 * Supports soft delete and user modification tracking.
 */
export class UserRepository<
  T extends User = User,
> extends SequelizeUserModifyCrudRepository<
  T,
  typeof User.prototype.id,
  UserRelations
> {
  /**
   * Tenant this user belongs to.
   */
  public readonly tenant: BelongsToAccessor<Tenant, typeof User.prototype.id>;

  /**
   * Roles assigned to this user.
   */
  public readonly roles: HasManyRepositoryFactory<
    UserRole,
    typeof User.prototype.id
  >;

  /**
   * Activity log entries for this user (audit trail).
   */
  public readonly activities: HasManyRepositoryFactory<
    UserActivity,
    typeof User.prototype.id
  >;

  constructor(
    @inject(`datasources.${TenantManagementDbSourceName}`)
    dataSource: SequelizeDataSource,
    @inject.getter(AuthenticationBindings.CURRENT_USER)
    public readonly getCurrentUser: Getter<IAuthUserWithPermissions>,
    @repository.getter('TenantRepository')
    protected tenantRepositoryGetter: Getter<TenantRepository>,
    @repository.getter('UserRoleRepository')
    protected userRoleRepositoryGetter: Getter<UserRoleRepository>,
    @repository.getter('UserActivityRepository')
    protected userActivityRepositoryGetter: Getter<UserActivityRepository>,
    @inject('models.User')
    private readonly user: typeof Entity & {prototype: T},
  ) {
    super(user as any, dataSource, getCurrentUser);

    // BelongsTo: User -> Tenant
    this.tenant = this.createBelongsToAccessorFor(
      'tenant',
      tenantRepositoryGetter,
    );
    this.registerInclusionResolver('tenant', this.tenant.inclusionResolver);

    // HasMany: User -> UserRole
    this.roles = this.createHasManyRepositoryFactoryFor(
      'roles',
      userRoleRepositoryGetter,
    );
    this.registerInclusionResolver('roles', this.roles.inclusionResolver);

    // HasMany: User -> UserActivity
    this.activities = this.createHasManyRepositoryFactoryFor(
      'activities',
      userActivityRepositoryGetter,
    );
    this.registerInclusionResolver(
      'activities',
      this.activities.inclusionResolver,
    );
  }
}
