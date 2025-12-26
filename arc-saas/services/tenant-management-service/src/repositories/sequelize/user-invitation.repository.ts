import {Getter, inject} from '@loopback/core';
import {BelongsToAccessor, Entity, repository} from '@loopback/repository';
import {SequelizeDataSource} from '@loopback/sequelize';
import {SequelizeUserModifyCrudRepository} from '@sourceloop/core/sequelize';
import {IAuthUserWithPermissions} from '@sourceloop/core';
import {AuthenticationBindings} from 'loopback4-authentication';

import {
  UserInvitation,
  UserInvitationRelations,
  User,
  Tenant,
} from '../../models';
import {UserRepository} from './user.repository';
import {TenantRepository} from './tenant.repository';
import {TenantManagementDbSourceName} from '../../types';

/**
 * UserInvitation repository for managing email-based user invitation workflow.
 * Handles invitation tokens, expiration, and acceptance tracking.
 */
export class UserInvitationRepository<
  T extends UserInvitation = UserInvitation,
> extends SequelizeUserModifyCrudRepository<
  T,
  typeof UserInvitation.prototype.id,
  UserInvitationRelations
> {
  /**
   * User who sent the invitation.
   */
  public readonly invitedByUser: BelongsToAccessor<
    User,
    typeof UserInvitation.prototype.id
  >;

  /**
   * Tenant for multi-tenant isolation.
   */
  public readonly tenant: BelongsToAccessor<
    Tenant,
    typeof UserInvitation.prototype.id
  >;

  /**
   * User created upon invitation acceptance.
   */
  public readonly acceptedByUser: BelongsToAccessor<
    User,
    typeof UserInvitation.prototype.id
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
    @inject('models.UserInvitation')
    private readonly userInvitation: typeof Entity & {prototype: T},
  ) {
    super(userInvitation as any, dataSource, getCurrentUser);

    // BelongsTo: UserInvitation -> User (invitedBy)
    this.invitedByUser = this.createBelongsToAccessorFor(
      'invitedByUser',
      userRepositoryGetter,
    );
    this.registerInclusionResolver(
      'invitedByUser',
      this.invitedByUser.inclusionResolver,
    );

    // BelongsTo: UserInvitation -> Tenant
    this.tenant = this.createBelongsToAccessorFor(
      'tenant',
      tenantRepositoryGetter,
    );
    this.registerInclusionResolver('tenant', this.tenant.inclusionResolver);

    // BelongsTo: UserInvitation -> User (acceptedBy)
    this.acceptedByUser = this.createBelongsToAccessorFor(
      'acceptedByUser',
      userRepositoryGetter,
    );
    this.registerInclusionResolver(
      'acceptedByUser',
      this.acceptedByUser.inclusionResolver,
    );
  }
}
