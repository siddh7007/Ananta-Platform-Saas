import {Getter, inject} from '@loopback/core';
import {BelongsToAccessor, Entity, repository} from '@loopback/repository';
import {IAuthUserWithPermissions} from '@sourceloop/core';
import {AuthenticationBindings} from 'loopback4-authentication';
import {SequelizeDataSource} from '@loopback/sequelize';
import {SequelizeUserModifyCrudRepository} from '@sourceloop/core/sequelize';
import {UsageEvent, UsageEventRelations, Tenant} from '../../models';
import {TenantRepository} from './tenant.repository';
import {TenantManagementDbSourceName} from '../../types';

export class UsageEventRepository<
  T extends UsageEvent = UsageEvent,
> extends SequelizeUserModifyCrudRepository<
  T,
  typeof UsageEvent.prototype.id,
  UsageEventRelations
> {
  public readonly tenant: BelongsToAccessor<
    Tenant,
    typeof UsageEvent.prototype.id
  >;

  constructor(
    @inject(`datasources.${TenantManagementDbSourceName}`)
    dataSource: SequelizeDataSource,
    @inject.getter(AuthenticationBindings.CURRENT_USER)
    public readonly getCurrentUser: Getter<IAuthUserWithPermissions>,
    @repository.getter('TenantRepository')
    protected tenantRepositoryGetter: Getter<TenantRepository>,
    @inject('models.UsageEvent')
    private readonly usageEvent: typeof Entity & {prototype: T},
  ) {
    super(usageEvent, dataSource, getCurrentUser);
    this.tenant = this.createBelongsToAccessorFor(
      'tenant',
      tenantRepositoryGetter,
    );
    this.registerInclusionResolver('tenant', this.tenant.inclusionResolver);
  }
}
