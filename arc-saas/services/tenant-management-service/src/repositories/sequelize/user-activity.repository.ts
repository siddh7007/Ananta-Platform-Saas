import {Getter, inject} from '@loopback/core';
import {BelongsToAccessor, Entity, repository} from '@loopback/repository';
import {SequelizeDataSource, SequelizeCrudRepository} from '@loopback/sequelize';

import {UserActivity, UserActivityRelations, User, Tenant} from '../../models';
import {UserRepository} from './user.repository';
import {TenantRepository} from './tenant.repository';
import {TenantManagementDbSourceName} from '../../types';

/**
 * UserActivity repository for immutable activity logging (audit trail).
 * No soft delete or user modification tracking (activities are append-only).
 */
export class UserActivityRepository<
  T extends UserActivity = UserActivity,
> extends SequelizeCrudRepository<
  T,
  typeof UserActivity.prototype.id,
  UserActivityRelations
> {
  /**
   * User who performed the activity.
   */
  public readonly user: BelongsToAccessor<
    User,
    typeof UserActivity.prototype.id
  >;

  /**
   * Tenant for multi-tenant isolation.
   */
  public readonly tenant: BelongsToAccessor<
    Tenant,
    typeof UserActivity.prototype.id
  >;

  constructor(
    @inject(`datasources.${TenantManagementDbSourceName}`)
    dataSource: SequelizeDataSource,
    @repository.getter('UserRepository')
    protected userRepositoryGetter: Getter<UserRepository>,
    @repository.getter('TenantRepository')
    protected tenantRepositoryGetter: Getter<TenantRepository>,
    @inject('models.UserActivity')
    private readonly userActivity: typeof Entity & {prototype: T},
  ) {
    super(userActivity as any, dataSource);

    // BelongsTo: UserActivity -> User
    this.user = this.createBelongsToAccessorFor('user', userRepositoryGetter);
    this.registerInclusionResolver('user', this.user.inclusionResolver);

    // BelongsTo: UserActivity -> Tenant
    this.tenant = this.createBelongsToAccessorFor(
      'tenant',
      tenantRepositoryGetter,
    );
    this.registerInclusionResolver('tenant', this.tenant.inclusionResolver);
  }
}
