import {Getter, inject} from '@loopback/core';
import {BelongsToAccessor, Entity, repository} from '@loopback/repository';
import {IAuthUserWithPermissions} from '@sourceloop/core';
import {AuthenticationBindings} from 'loopback4-authentication';
import {SequelizeDataSource} from '@loopback/sequelize';
import {SequelizeUserModifyCrudRepository} from '@sourceloop/core/sequelize';
import {PaymentMethod, PaymentMethodRelations, Tenant} from '../../models';
import {TenantRepository} from './tenant.repository';
import {TenantManagementDbSourceName} from '../../types';

export class PaymentMethodRepository<
  T extends PaymentMethod = PaymentMethod,
> extends SequelizeUserModifyCrudRepository<
  T,
  typeof PaymentMethod.prototype.id,
  PaymentMethodRelations
> {
  public readonly tenant: BelongsToAccessor<
    Tenant,
    typeof PaymentMethod.prototype.id
  >;

  constructor(
    @inject(`datasources.${TenantManagementDbSourceName}`)
    dataSource: SequelizeDataSource,
    @inject.getter(AuthenticationBindings.CURRENT_USER)
    public readonly getCurrentUser: Getter<IAuthUserWithPermissions>,
    @repository.getter('TenantRepository')
    protected tenantRepositoryGetter: Getter<TenantRepository>,
    @inject('models.PaymentMethod')
    private readonly paymentMethod: typeof Entity & {prototype: T},
  ) {
    super(paymentMethod, dataSource, getCurrentUser);
    this.tenant = this.createBelongsToAccessorFor(
      'tenant',
      tenantRepositoryGetter,
    );
    this.registerInclusionResolver('tenant', this.tenant.inclusionResolver);
  }

  /**
   * Find all payment methods for a tenant
   */
  async findByTenantId(tenantId: string): Promise<T[]> {
    return this.find({
      where: {
        tenantId,
        deleted: false,
      } as object,
    });
  }

  /**
   * Find the default payment method for a tenant
   */
  async findDefaultForTenant(tenantId: string): Promise<T | null> {
    return this.findOne({
      where: {
        tenantId,
        isDefault: true,
        deleted: false,
      } as object,
    });
  }

  /**
   * Find payment method by Stripe payment method ID
   */
  async findByStripePaymentMethodId(
    stripePaymentMethodId: string,
  ): Promise<T | null> {
    return this.findOne({
      where: {
        stripePaymentMethodId,
        deleted: false,
      } as object,
    });
  }

  /**
   * Set a payment method as default and unset others
   */
  async setAsDefault(tenantId: string, paymentMethodId: string): Promise<void> {
    // Unset current default
    await this.updateAll(
      {isDefault: false} as object,
      {tenantId, isDefault: true, deleted: false} as object,
    );

    // Set new default
    await this.updateById(paymentMethodId, {isDefault: true} as object);
  }
}
