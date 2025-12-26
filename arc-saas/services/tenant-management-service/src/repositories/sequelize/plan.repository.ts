import {inject} from '@loopback/core';
import {Entity} from '@loopback/repository';
import {SequelizeDataSource, SequelizeCrudRepository} from '@loopback/sequelize';
import {SubscriptionPlan, SubscriptionPlanRelations} from '../../models';
import {TenantManagementDbSourceName} from '../../types';

export class SubscriptionPlanRepository<
  T extends SubscriptionPlan = SubscriptionPlan,
> extends SequelizeCrudRepository<
  T,
  typeof SubscriptionPlan.prototype.id,
  SubscriptionPlanRelations
> {
  constructor(
    @inject(`datasources.${TenantManagementDbSourceName}`)
    dataSource: SequelizeDataSource,
    @inject('models.SubscriptionPlan')
    private readonly subscriptionPlan: typeof Entity & {prototype: T},
  ) {
    super(subscriptionPlan as any, dataSource);
  }
}
