import {Getter, inject} from '@loopback/core';
import {BelongsToAccessor, Entity, repository} from '@loopback/repository';
import {SequelizeDataSource, SequelizeCrudRepository} from '@loopback/sequelize';

import {AuditLog, AuditLogRelations, Tenant} from '../../models';
import {TenantRepository} from './tenant.repository';
import {TenantManagementDbSourceName} from '../../types';

/**
 * AuditLog repository for immutable audit logging.
 * No soft delete or modification tracking - logs are append-only.
 */
export class AuditLogRepository<
  T extends AuditLog = AuditLog,
> extends SequelizeCrudRepository<
  T,
  typeof AuditLog.prototype.id,
  AuditLogRelations
> {
  /**
   * Tenant for multi-tenant isolation.
   */
  public readonly tenant: BelongsToAccessor<
    Tenant,
    typeof AuditLog.prototype.id
  >;

  constructor(
    @inject(`datasources.${TenantManagementDbSourceName}`)
    dataSource: SequelizeDataSource,
    @repository.getter('TenantRepository')
    protected tenantRepositoryGetter: Getter<TenantRepository>,
    @inject('models.AuditLog')
    private readonly auditLog: typeof Entity & {prototype: T},
  ) {
    super(auditLog as any, dataSource);

    // BelongsTo: AuditLog -> Tenant
    this.tenant = this.createBelongsToAccessorFor(
      'tenant',
      tenantRepositoryGetter,
    );
    this.registerInclusionResolver('tenant', this.tenant.inclusionResolver);
  }
}
