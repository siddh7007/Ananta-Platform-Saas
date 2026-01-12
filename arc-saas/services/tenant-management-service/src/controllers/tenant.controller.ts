import {
  Count,
  CountSchema,
  Filter,
  repository,
  Where,
} from '@loopback/repository';
import {del, get, param, patch, post, put, requestBody, HttpErrors} from '@loopback/rest';
import {
  CONTENT_TYPE,
  getModelSchemaRefSF,
  IAuthUserWithPermissions,
  OPERATION_SECURITY_SPEC,
  STATUS_CODE,
} from '@sourceloop/core';
import {authenticate, AuthenticationBindings, STRATEGY} from 'loopback4-authentication';
import {authorize} from 'loopback4-authorization';
import {TenantRepository} from '../repositories/tenant.repository';
import {UserRepository} from '../repositories/sequelize/user.repository';
import {SubscriptionDTO, Tenant, TenantOnboardDTO, UserInvitation} from '../models';
import {PermissionKey} from '../permissions';
import {inject, service} from '@loopback/core';
import {OnboardingService, TemporalProvisioningService} from '../services';
import {InvitationService} from '../services/invitation.service';
import {AuditLoggerService} from '../services/audit-logger.service';
import {IProvisioningService} from '../types';

const basePath = '/tenants';

export class TenantController {
  constructor(
    @repository(TenantRepository)
    private readonly tenantRepository: TenantRepository,
    @repository(UserRepository)
    private readonly userRepository: UserRepository,
    @service(OnboardingService)
    private readonly onboarding: OnboardingService,
    @service(TemporalProvisioningService)
    private readonly provisioningService: IProvisioningService<SubscriptionDTO>,
    @service(InvitationService)
    private readonly invitationService: InvitationService,
    @service(AuditLoggerService)
    private readonly auditLogger: AuditLoggerService,
    @inject(AuthenticationBindings.CURRENT_USER, {optional: true})
    private readonly currentUser?: IAuthUserWithPermissions,
  ) {}

  @authorize({
    permissions: [PermissionKey.CreateTenant],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @post(basePath, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Tenant model instance',
        content: {
          [CONTENT_TYPE.JSON]: {schema: getModelSchemaRefSF(Tenant)},
        },
      },
    },
  })
  async create(
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: getModelSchemaRefSF(TenantOnboardDTO, {
            title: 'NewTenantOnboarding',
            exclude: [],
          }),
        },
      },
    })
    dto: TenantOnboardDTO,
  ): Promise<Tenant> {
    const tenant = await this.onboarding.onboard(dto);

    // Log tenant creation (non-blocking)
    try {
      await this.auditLogger.logTenantCreated(tenant.id, tenant.name || dto.name, {
        key: tenant.key,
        adminEmail: dto.adminEmail,
      });
    } catch {
      // Don't fail the operation if audit logging fails
    }

    return tenant;
  }

  @authorize({
    permissions: [PermissionKey.ProvisionTenant],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @post(`${basePath}/{id}/provision`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.NO_CONTENT]: {
        description: 'Provisioning success',
      },
    },
  })
  async provision(
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: getModelSchemaRefSF(SubscriptionDTO, {
            title: 'SubscriptionDTO',
          }),
        },
      },
    })
    subscription: SubscriptionDTO,
    @param.path.string('id') id: string,
  ): Promise<void> {
    const tenantDetails = await this.tenantRepository.findById(id, {
      include: ['contacts', 'address'],
    });

    await this.provisioningService.provisionTenant(
      tenantDetails,
      subscription,
    );

    // Log tenant provisioning (non-blocking)
    try {
      await this.auditLogger.logTenantProvisioned(
        id,
        tenantDetails.name || 'unknown',
        subscription.planId,
      );
    } catch {
      // Don't fail the operation if audit logging fails
    }
  }

  @authorize({
    permissions: [PermissionKey.ViewTenant],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/count`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Tenant model count',
        content: {[CONTENT_TYPE.JSON]: {schema: CountSchema}},
      },
    },
  })
  async count(@param.where(Tenant) where?: Where<Tenant>): Promise<Count> {
    return this.tenantRepository.count(where);
  }

  @authorize({
    permissions: [PermissionKey.ViewTenant],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(basePath, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Array of Tenant model instances',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'array',
              items: getModelSchemaRefSF(Tenant, {includeRelations: true}),
            },
          },
        },
      },
    },
  })
  async find(@param.filter(Tenant) filter?: Filter<Tenant>): Promise<Tenant[]> {
    return this.tenantRepository.find(filter);
  }

  @authorize({
    permissions: [PermissionKey.UpdateTenant],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @patch(basePath, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Tenant PATCH success',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: getModelSchemaRefSF(Tenant),
          },
        },
      },
    },
  })
  async updateAll(
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: getModelSchemaRefSF(Tenant, {partial: true}),
        },
      },
    })
    tenant: Tenant,
    @param.where(Tenant) where?: Where<Tenant>,
  ): Promise<Count> {
    return this.tenantRepository.updateAll(tenant, where);
  }


  /**
   * Get the current tenant based on X-Tenant-Id header or user's tenantId.
   * This endpoint is used by CBP frontend to get the current organization.
   * The route must be declared BEFORE the {id} route to take precedence.
   */
  @authorize({
    permissions: ['*'],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/current`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Current tenant for the authenticated user',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: getModelSchemaRefSF(Tenant, {includeRelations: true}),
          },
        },
      },
      [STATUS_CODE.NOT_FOUND]: {
        description: 'No tenant found for current user',
      },
    },
  })
  async findCurrentTenant(
    @inject('request') request: {headers: Record<string, string | undefined>},
  ): Promise<Tenant> {
    // First try X-Tenant-Id header (set by frontend tenant selector)
    const headerTenantId = request?.headers?.['x-tenant-id'];
    // Fall back to JWT tenantId
    const tenantId = headerTenantId || this.currentUser?.tenantId;

    if (!tenantId) {
      throw new HttpErrors.NotFound('No tenant context available. Please select a tenant.');
    }

    try {
      const tenant = await this.tenantRepository.findById(tenantId, {
        include: ['contacts', 'address'],
      });
      return tenant;
    } catch {
      throw new HttpErrors.NotFound(`Tenant with id ${tenantId} not found`);
    }
  }

  /**
   * Update the current tenant based on X-Tenant-Id header or user's tenantId.
   * This endpoint is used by CBP frontend to update the current organization.
   * Requires admin+ role.
   */
  @authorize({
    permissions: [PermissionKey.UpdateTenant],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @patch(`${basePath}/current`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Updated tenant',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: getModelSchemaRefSF(Tenant, {includeRelations: true}),
          },
        },
      },
      [STATUS_CODE.NOT_FOUND]: {
        description: 'No tenant found for current user',
      },
    },
  })
  async updateCurrentTenant(
    @inject('request') request: {headers: Record<string, string | undefined>},
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: getModelSchemaRefSF(Tenant, {partial: true}),
        },
      },
    })
    tenantUpdate: Partial<Tenant>,
  ): Promise<Tenant> {
    // First try X-Tenant-Id header (set by frontend tenant selector)
    const headerTenantId = request?.headers?.['x-tenant-id'];
    // Fall back to JWT tenantId
    const tenantId = headerTenantId || this.currentUser?.tenantId;

    if (!tenantId) {
      throw new HttpErrors.NotFound('No tenant context available. Please select a tenant.');
    }

    // Prevent updating sensitive fields
    delete tenantUpdate.id;
    delete tenantUpdate.key;
    delete tenantUpdate.status;

    const existingTenant = await this.tenantRepository.findById(tenantId);
    await this.tenantRepository.updateById(tenantId, tenantUpdate);

    // Log tenant update (non-blocking)
    try {
      await this.auditLogger.logTenantUpdated(
        tenantId,
        existingTenant.name || 'unknown',
        tenantUpdate as unknown as Record<string, unknown>,
      );
    } catch {
      // Don't fail the operation if audit logging fails
    }

    // Return updated tenant
    return this.tenantRepository.findById(tenantId, {
      include: ['contacts', 'address'],
    });
  }

  /**
   * Delete the current tenant (requires owner role).
   * This endpoint is used by CBP frontend for the danger zone delete operation.
   */
  @authorize({
    permissions: [PermissionKey.DeleteTenant],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @del(`${basePath}/current`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Tenant deleted successfully',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
              properties: {
                success: {type: 'boolean'},
                message: {type: 'string'},
              },
            },
          },
        },
      },
      [STATUS_CODE.NOT_FOUND]: {
        description: 'No tenant found for current user',
      },
      [STATUS_CODE.BAD_REQUEST]: {
        description: 'Confirmation does not match tenant name',
      },
    },
  })
  async deleteCurrentTenant(
    @inject('request') request: {headers: Record<string, string | undefined>},
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: {
            type: 'object',
            required: ['confirmation'],
            properties: {
              confirmation: {type: 'string', description: 'Type the tenant name to confirm deletion'},
            },
          },
        },
      },
    })
    body: {confirmation: string},
  ): Promise<{success: boolean; message: string}> {
    // First try X-Tenant-Id header (set by frontend tenant selector)
    const headerTenantId = request?.headers?.['x-tenant-id'];
    // Fall back to JWT tenantId
    const tenantId = headerTenantId || this.currentUser?.tenantId;

    if (!tenantId) {
      throw new HttpErrors.NotFound('No tenant context available. Please select a tenant.');
    }

    const tenant = await this.tenantRepository.findById(tenantId);

    // Verify confirmation matches tenant name
    if (body.confirmation !== tenant.name) {
      throw new HttpErrors.BadRequest('Confirmation does not match tenant name');
    }

    // Delete tenant
    await this.tenantRepository.deleteById(tenantId);

    // Log tenant deletion (non-blocking)
    try {
      await this.auditLogger.logTenantDeleted(tenantId, tenant.name || 'unknown');
    } catch {
      // Don't fail the operation if audit logging fails
    }

    return {
      success: true,
      message: `Tenant "${tenant.name}" has been deleted`,
    };
  }

  /**
   * Get tenants belonging to the current authenticated user.
   * This endpoint returns tenants where the user is a member.
   * The route must be declared BEFORE the {id} route to take precedence.
   */
  @authorize({
    permissions: ['*'],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/my-tenants`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Array of tenants the current user belongs to',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'array',
              items: getModelSchemaRefSF(Tenant, {includeRelations: true}),
            },
          },
        },
      },
    },
  })
  async findMyTenants(): Promise<Tenant[]> {
    // DEBUG: Log the entire currentUser object
    console.log(`[my-tenants] currentUser object:`, JSON.stringify(this.currentUser, null, 2));
    console.log(`[my-tenants] currentUser.id:`, this.currentUser?.id);
    console.log(`[my-tenants] currentUser.tenantId:`, this.currentUser?.tenantId);

    // First try tenantId from the current user's JWT token
    let tenantId = this.currentUser?.tenantId;

    // If not in JWT, look up from database using user ID (Keycloak sub claim)
    // The JWT 'sub' claim contains the Keycloak user ID which matches our user.id
    if (!tenantId && this.currentUser?.id) {
      try {
        console.log(`[my-tenants] No tenantId in JWT, looking up user ${this.currentUser.id} in database`);
        const user = await this.userRepository.findById(this.currentUser.id);
        console.log(`[my-tenants] User lookup result:`, JSON.stringify(user, null, 2));
        tenantId = user?.tenantId;
        if (tenantId) {
          console.log(`[my-tenants] Found tenantId ${tenantId} for user ${this.currentUser.id} in database`);
        }
      } catch (err) {
        console.log(`[my-tenants] User ${this.currentUser.id} not found in database:`, err);
      }
    }

    if (!tenantId) {
      // User has no tenant assigned - return empty array
      console.log(`[my-tenants] No tenant found for user ${this.currentUser?.id}`);
      return [];
    }

    // Return the user's assigned tenant
    try {
      console.log(`[my-tenants] Looking up tenant ${tenantId}`);
      // Use findOne with explicit filter to bypass soft-delete scope issues
      const tenant = await this.tenantRepository.findOne({
        where: {
          id: tenantId,
        },
      });
      console.log(`[my-tenants] Found tenant:`, tenant?.name);
      if (!tenant) {
        console.log(`[my-tenants] Tenant ${tenantId} query returned null`);
        return [];
      }
      return [tenant];
    } catch (error) {
      console.error(`[my-tenants] Error details:`, error);
      // Tenant not found - return empty array
      console.log(`[my-tenants] Tenant ${tenantId} not found for user ${this.currentUser?.id}`);
      return [];
    }
  }


  @authorize({
    permissions: [PermissionKey.ViewTenant],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/by-key/{key}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Tenant model instance by key',
        content: {
          [CONTENT_TYPE.JSON]: {schema: getModelSchemaRefSF(Tenant)},
        },
      },
      [STATUS_CODE.NOT_FOUND]: {
        description: 'Tenant not found',
      },
    },
  })
  async findByKey(
    @param.path.string('key') key: string,
    @param.filter(Tenant, {exclude: 'where'})
    filter?: Filter<Tenant>,
  ): Promise<Tenant> {
    const tenants = await this.tenantRepository.find({
      ...filter,
      where: {key},
    });

    if (tenants.length === 0) {
      throw new HttpErrors.NotFound(`Tenant with key '${key}' not found`);
    }

    return tenants[0];
  }

  @authorize({
    permissions: [PermissionKey.ViewTenant],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/{id}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Tenant model instance',
        content: {
          [CONTENT_TYPE.JSON]: {schema: getModelSchemaRefSF(Tenant)},
        },
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Tenant, {exclude: 'where'})
    filter?: Filter<Tenant>,
  ): Promise<Tenant> {
    return this.tenantRepository.findById(id, filter);
  }

  @authorize({
    permissions: [PermissionKey.UpdateTenant],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @patch(`${basePath}/{id}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.NO_CONTENT]: {
        description: 'Tenant PATCH success',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: getModelSchemaRefSF(Tenant),
          },
        },
      },
    },
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: getModelSchemaRefSF(Tenant, {partial: true}),
        },
      },
    })
    tenant: Tenant,
  ): Promise<void> {
    const existingTenant = await this.tenantRepository.findById(id);
    await this.tenantRepository.updateById(id, tenant);

    // Log tenant update (non-blocking)
    try {
      await this.auditLogger.logTenantUpdated(
        id,
        existingTenant.name || 'unknown',
        tenant as unknown as Record<string, unknown>,
      );
    } catch {
      // Don't fail the operation if audit logging fails
    }
  }

  @authorize({
    permissions: [PermissionKey.UpdateTenant],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @put(`${basePath}/{id}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.NO_CONTENT]: {
        description: 'Tenant PUT success',
      },
    },
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() tenant: Tenant,
  ): Promise<void> {
    const existingTenant = await this.tenantRepository.findById(id);
    await this.tenantRepository.replaceById(id, tenant);

    // Log tenant replace (non-blocking)
    try {
      await this.auditLogger.logTenantUpdated(
        id,
        existingTenant.name || 'unknown',
        {replaced: true, newData: tenant as unknown as Record<string, unknown>},
      );
    } catch {
      // Don't fail the operation if audit logging fails
    }
  }

  @authorize({
    permissions: [PermissionKey.DeleteTenant],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @del(`${basePath}/{id}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.NO_CONTENT]: {
        description: 'Tenant DELETE success',
      },
    },
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    const existingTenant = await this.tenantRepository.findById(id);
    await this.tenantRepository.deleteById(id);

    // Log tenant deletion (non-blocking)
    try {
      await this.auditLogger.logTenantDeleted(id, existingTenant.name || 'unknown');
    } catch {
      // Don't fail the operation if audit logging fails
    }
  }

  /**
   * Create a user invitation for a specific tenant.
   * This endpoint creates an invitation and sends an email to the invitee.
   */
  @authorize({
    permissions: [PermissionKey.CreateInvitation],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @post(`${basePath}/{id}/invitations`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'UserInvitation model instance',
        content: {
          [CONTENT_TYPE.JSON]: {schema: getModelSchemaRefSF(UserInvitation)},
        },
      },
    },
  })
  async createInvitation(
    @param.path.string('id') tenantId: string,
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: {
            type: 'object',
            required: ['email', 'role'],
            properties: {
              email: {type: 'string', format: 'email'},
              role: {type: 'string'},
              invitedBy: {type: 'string'},
            },
          },
        },
      },
    })
    invitationData: {
      email: string;
      role: string;
      invitedBy?: string;
    },
  ): Promise<UserInvitation> {
    // Verify tenant exists
    const tenant = await this.tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new HttpErrors.NotFound(`Tenant with id ${tenantId} not found`);
    }

    // Create invitation with tenant ID from path
    return this.invitationService.createInvitation({
      email: invitationData.email,
      role: invitationData.role,
      tenantId: tenantId,
      invitedBy: invitationData.invitedBy || 'system',
    } as unknown as Omit<UserInvitation, 'id' | 'token' | 'status' | 'expiresAt' | 'acceptedAt' | 'acceptedBy'>);
  }

  /**
   * Validate tenant and IdP configuration for user invitation workflow.
   * This endpoint is called by Temporal activities to check if tenant
   * is active and has valid IdP configuration before inviting users.
   */
  @authorize({
    permissions: [PermissionKey.ViewTenant],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/{id}/idp-config/validate`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'IdP configuration validation result',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
              properties: {
                valid: {type: 'boolean'},
                identityProvider: {type: 'string'},
                message: {type: 'string'},
              },
            },
          },
        },
      },
      [STATUS_CODE.NOT_FOUND]: {
        description: 'Tenant not found',
      },
      [STATUS_CODE.PRECONDITION_FAILED]: {
        description: 'Tenant not active or IdP config invalid',
      },
    },
  })
  async validateIdPConfig(
    @param.path.string('id') id: string,
  ): Promise<{valid: boolean; identityProvider: string; message?: string}> {
    // Check tenant exists and is active
    const tenant = await this.tenantRepository.findById(id, {
      include: ['resources'],
    });

    if (!tenant) {
      throw new HttpErrors.NotFound(`Tenant with id ${id} not found`);
    }

    // Check tenant status is ACTIVE (status = 0)
    if (tenant.status !== 0) {
      throw new HttpErrors.PreconditionFailed(
        `Tenant is not active. Current status: ${tenant.status}`,
      );
    }

    // Check identity provider is configured
    if (!tenant.identityProvider) {
      throw new HttpErrors.PreconditionFailed(
        'Identity provider not configured for tenant',
      );
    }

    // For now, we trust that if tenant is active and has identityProvider set,
    // the IdP is properly configured. In a production system, you might want to
    // check the resources table for IdP-specific configuration.

    return {
      valid: true,
      identityProvider: tenant.identityProvider,
      message: 'Tenant and IdP configuration are valid',
    };
  }
}
