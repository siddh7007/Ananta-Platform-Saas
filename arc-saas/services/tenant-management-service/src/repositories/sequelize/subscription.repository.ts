import {Getter, inject} from '@loopback/core';
import {BelongsToAccessor, Entity, repository} from '@loopback/repository';
import {IAuthUserWithPermissions} from '@sourceloop/core';
import {AuthenticationBindings} from 'loopback4-authentication';
import {SequelizeDataSource} from '@loopback/sequelize';
import {SequelizeUserModifyCrudRepository} from '@sourceloop/core/sequelize';
import {Subscription, SubscriptionRelations, Tenant} from '../../models';
import {TenantRepository} from './tenant.repository';
import {TenantManagementDbSourceName} from '../../types';

export class SubscriptionRepository<
  T extends Subscription = Subscription,
> extends SequelizeUserModifyCrudRepository<
  T,
  typeof Subscription.prototype.id,
  SubscriptionRelations
> {
  public readonly tenant: BelongsToAccessor<
    Tenant,
    typeof Subscription.prototype.id
  >;

  constructor(
    @inject(`datasources.${TenantManagementDbSourceName}`)
    dataSource: SequelizeDataSource,
    @inject.getter(AuthenticationBindings.CURRENT_USER)
    public readonly getCurrentUser: Getter<IAuthUserWithPermissions>,
    @repository.getter('TenantRepository')
    protected tenantRepositoryGetter: Getter<TenantRepository>,
    @inject('models.Subscription')
    private readonly subscription: typeof Entity & {prototype: T},
  ) {
    super(subscription, dataSource, getCurrentUser);
    this.tenant = this.createBelongsToAccessorFor(
      'tenant',
      tenantRepositoryGetter,
    );
    this.registerInclusionResolver('tenant', this.tenant.inclusionResolver);
  }
}
