import {Getter, inject} from '@loopback/core';
import {BelongsToAccessor, Entity, repository} from '@loopback/repository';
import {SequelizeDataSource} from '@loopback/sequelize';
import {SequelizeUserModifyCrudRepository} from '@sourceloop/core/sequelize';
import {IAuthUserWithPermissions} from '@sourceloop/core';
import {AuthenticationBindings} from 'loopback4-authentication';

import {UserRole, UserRoleRelations, User, Tenant} from '../../models';
import {UserRepository} from './user.repository';
import {TenantRepository} from './tenant.repository';
import {TenantManagementDbSourceName} from '../../types';

/**
 * UserRole repository for managing RBAC role assignments.
 * Supports hierarchical scopes (tenant, workspace, project) and soft delete.
 */
export class UserRoleRepository<
  T extends UserRole = UserRole,
> extends SequelizeUserModifyCrudRepository<
  T,
  typeof UserRole.prototype.id,
  UserRoleRelations
> {
  /**
   * User this role is assigned to.
   */
  public readonly user: BelongsToAccessor<User, typeof UserRole.prototype.id>;

  /**
   * Tenant for multi-tenant isolation.
   */
  public readonly tenant: BelongsToAccessor<
    Tenant,
    typeof UserRole.prototype.id
  >;

  constructor(
    @inject(`datasources.${TenantManagementDbSourceName}`)
    dataSource: SequelizeDataSource,
    @inject.getter(AuthenticationBindings.CURRENT_USER)
    public readonly getCurrentUser: Getter<IAuthUserWithPermissions>,
    @repository.getter('UserRepository')
    protected userRepositoryGetter: Getter<UserRepository>,
    @repository.getter('TenantRepository')
    protected tenantRepositoryGetter: Getter<TenantRepository>,
    @inject('models.UserRole')
    private readonly userRole: typeof Entity & {prototype: T},
  ) {
    super(userRole as any, dataSource, getCurrentUser);

    // BelongsTo: UserRole -> User
    this.user = this.createBelongsToAccessorFor('user', userRepositoryGetter);
    this.registerInclusionResolver('user', this.user.inclusionResolver);

    // BelongsTo: UserRole -> Tenant
    this.tenant = this.createBelongsToAccessorFor(
      'tenant',
      tenantRepositoryGetter,
    );
    this.registerInclusionResolver('tenant', this.tenant.inclusionResolver);
  }
}
