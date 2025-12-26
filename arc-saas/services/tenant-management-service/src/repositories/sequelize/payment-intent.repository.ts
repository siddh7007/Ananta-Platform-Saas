import {Getter, inject} from '@loopback/core';
import {BelongsToAccessor, Entity, repository} from '@loopback/repository';
import {IAuthUserWithPermissions} from '@sourceloop/core';
import {AuthenticationBindings} from 'loopback4-authentication';
import {SequelizeDataSource} from '@loopback/sequelize';
import {SequelizeUserModifyCrudRepository} from '@sourceloop/core/sequelize';
import {
  PaymentIntent,
  PaymentIntentRelations,
  Tenant,
  Invoice,
} from '../../models';
import {TenantRepository} from './tenant.repository';
import {InvoiceRepository} from './invoice.repository';
import {TenantManagementDbSourceName} from '../../types';
import {PaymentIntentStatus} from '../../enums';

export class PaymentIntentRepository<
  T extends PaymentIntent = PaymentIntent,
> extends SequelizeUserModifyCrudRepository<
  T,
  typeof PaymentIntent.prototype.id,
  PaymentIntentRelations
> {
  public readonly tenant: BelongsToAccessor<
    Tenant,
    typeof PaymentIntent.prototype.id
  >;

  public readonly invoice: BelongsToAccessor<
    Invoice,
    typeof PaymentIntent.prototype.id
  >;

  constructor(
    @inject(`datasources.${TenantManagementDbSourceName}`)
    dataSource: SequelizeDataSource,
    @inject.getter(AuthenticationBindings.CURRENT_USER)
    public readonly getCurrentUser: Getter<IAuthUserWithPermissions>,
    @repository.getter('TenantRepository')
    protected tenantRepositoryGetter: Getter<TenantRepository>,
    @repository.getter('InvoiceRepository')
    protected invoiceRepositoryGetter: Getter<InvoiceRepository>,
    @inject('models.PaymentIntent')
    private readonly paymentIntent: typeof Entity & {prototype: T},
  ) {
    super(paymentIntent, dataSource, getCurrentUser);

    this.tenant = this.createBelongsToAccessorFor(
      'tenant',
      tenantRepositoryGetter,
    );
    this.registerInclusionResolver('tenant', this.tenant.inclusionResolver);

    this.invoice = this.createBelongsToAccessorFor(
      'invoice',
      invoiceRepositoryGetter,
    );
    this.registerInclusionResolver('invoice', this.invoice.inclusionResolver);
  }

  /**
   * Find all payment intents for a tenant
   */
  async findByTenantId(tenantId: string): Promise<T[]> {
    return this.find({
      where: {
        tenantId,
        deleted: false,
      } as object,
      order: ['createdOn DESC'],
    });
  }

  /**
   * Find payment intents for an invoice
   */
  async findByInvoiceId(invoiceId: string): Promise<T[]> {
    return this.find({
      where: {
        invoiceId,
        deleted: false,
      } as object,
      order: ['createdOn DESC'],
    });
  }

  /**
   * Find payment intent by Stripe payment intent ID
   */
  async findByStripePaymentIntentId(
    stripePaymentIntentId: string,
  ): Promise<T | null> {
    return this.findOne({
      where: {
        stripePaymentIntentId,
        deleted: false,
      } as object,
    });
  }

  /**
   * Find successful payment intents for a tenant (for revenue reporting)
   */
  async findSuccessfulByTenantId(tenantId: string): Promise<T[]> {
    return this.find({
      where: {
        tenantId,
        status: PaymentIntentStatus.SUCCEEDED,
        deleted: false,
      } as object,
      order: ['succeededAt DESC'],
    });
  }

  /**
   * Find payment intents by status
   */
  async findByStatus(status: PaymentIntentStatus): Promise<T[]> {
    return this.find({
      where: {
        status,
        deleted: false,
      } as object,
    });
  }
}
