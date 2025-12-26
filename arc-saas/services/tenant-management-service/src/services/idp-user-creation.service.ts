import {injectable, BindingScope} from '@loopback/core';
import {repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {TenantRepository, TenantMgmtConfigRepository} from '../repositories/sequelize';
import {CreateIdpUserPayload, IdpResp, IdPKey} from '../types';
import {KeycloakIdpProvider} from '../providers/idp-provider/idp-keycloak.provider';
import {ManagementClient, UserCreate} from 'auth0';
import {Tenant} from '../models';

/**
 * Service for creating users in Identity Providers (Keycloak, Auth0, etc.)
 * This service routes user creation to the appropriate IdP based on tenant configuration.
 */
@injectable({scope: BindingScope.TRANSIENT})
export class IdpUserCreationService {
  private keycloakProvider: KeycloakIdpProvider;

  constructor(
    @repository(TenantRepository)
    private readonly tenantRepository: TenantRepository,
    @repository(TenantMgmtConfigRepository)
    private readonly tenantConfigRepository: TenantMgmtConfigRepository,
  ) {
    this.keycloakProvider = new KeycloakIdpProvider();
  }

  /**
   * Create a user in the tenant's configured Identity Provider.
   * Supports both Keycloak and Auth0.
   *
   * @param payload - User creation payload
   * @returns IdP response with authId
   */
  async createUser(payload: CreateIdpUserPayload): Promise<IdpResp> {
    // 1. Get tenant to determine which IdP to use
    const tenant = await this.tenantRepository.findById(payload.tenantId);

    if (!tenant) {
      throw new HttpErrors.NotFound(`Tenant ${payload.tenantId} not found`);
    }

    // 2. Get identity provider from tenant (defaults to Keycloak in database)
    const identityProvider = tenant.identityProvider ?? IdPKey.KEYCLOAK;

    // 3. Route to appropriate IdP based on tenant configuration
    switch (identityProvider) {
      case IdPKey.KEYCLOAK:
        return this.createKeycloakUser(tenant, payload);

      case IdPKey.AUTH0:
        return this.createAuth0User(tenant, payload);

      case IdPKey.COGNITO:
        throw new HttpErrors.NotImplemented(
          'AWS Cognito user creation not yet implemented',
        );

      default:
        throw new HttpErrors.BadRequest(
          `Unknown identity provider: ${identityProvider}`,
        );
    }
  }

  /**
   * Create user in Keycloak.
   * Uses the existing KeycloakIdpProvider to create user in the tenant's realm.
   * Cloud-agnostic: retrieves realm name from database instead of cloud-specific services.
   */
  private async createKeycloakUser(
    tenant: Tenant,
    payload: CreateIdpUserPayload,
  ): Promise<IdpResp> {
    try {
      // 1. Authenticate as Keycloak admin
      const token = await this.keycloakProvider.authenticateAdmin();

      // 2. Get tenant's Keycloak configuration from database (cloud-agnostic)
      const keycloakConfig = await this.tenantConfigRepository.findOne({
        where: {
          tenantId: tenant.id,
          configKey: IdPKey.KEYCLOAK,
        },
      });

      if (!keycloakConfig || !keycloakConfig.configValue) {
        throw new HttpErrors.NotFound(
          `Keycloak configuration not found for tenant ${tenant.key}`,
        );
      }

      // Extract realm name from config
      const realmName = keycloakConfig.configValue.realm_name;

      if (!realmName) {
        throw new HttpErrors.NotFound(
          `Keycloak realm name not configured for tenant ${tenant.key}`,
        );
      }

      // 3. Create user in Keycloak realm
      const user = await this.keycloakProvider.createUser(
        realmName,
        payload.email, // username
        payload.password,
        payload.firstName,
        payload.lastName,
        payload.email,
        token,
      );

      return {
        authId: user.id,
      };
    } catch (error) {
      throw new HttpErrors.InternalServerError(
        `Failed to create Keycloak user: ${error.message}`,
      );
    }
  }

  /**
   * Create user in Auth0.
   * Uses the existing Auth0IdpProvider to create user in the tenant's organization.
   * Cloud-agnostic: retrieves Auth0 configuration from database instead of environment variables.
   */
  private async createAuth0User(
    tenant: Tenant,
    payload: CreateIdpUserPayload,
  ): Promise<IdpResp> {
    try {
      // 1. Get tenant's Auth0 configuration from database (cloud-agnostic)
      const auth0Config = await this.tenantConfigRepository.findOne({
        where: {
          tenantId: tenant.id,
          configKey: IdPKey.AUTH0,
        },
      });

      if (!auth0Config || !auth0Config.configValue) {
        throw new HttpErrors.NotFound(
          `Auth0 configuration not found for tenant ${tenant.key}`,
        );
      }

      // 2. Initialize Auth0 Management Client with tenant-specific credentials
      const management = new ManagementClient({
        domain: process.env.AUTH0_DOMAIN ?? '',
        clientId: process.env.AUTH0_CLIENT_ID ?? '',
        clientSecret: process.env.AUTH0_CLIENT_SECRET ?? '',
        audience: process.env.AUTH0_AUDIENCE,
      });

      // 3. Get connection from tenant config
      const connection =
        auth0Config.configValue.connection ??
        'Username-Password-Authentication';

      // 4. Create user data
      const userData: UserCreate = {
        email: payload.email,
        connection: connection,
        password: payload.password,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        email_verified: false, // User should verify email
        // eslint-disable-next-line @typescript-eslint/naming-convention
        verify_email: true, // Send verification email
        // eslint-disable-next-line @typescript-eslint/naming-convention
        given_name: payload.firstName,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        family_name: payload.lastName,
        name: `${payload.firstName} ${payload.lastName}`,
      };

      // 5. Create user in Auth0
      const user = await management.users.create(userData);

      // 6. Get organization ID from config or tenant key
      const orgName = auth0Config.configValue.organization_name ?? tenant.key;
      const orgResponse = await management.organizations.getByName({
        name: orgName,
      });

      if (!orgResponse.data || !orgResponse.data.id) {
        throw new HttpErrors.NotFound(
          `Auth0 organization '${orgName}' not found for tenant ${tenant.key}`,
        );
      }

      if (!user.data.user_id) {
        throw new HttpErrors.InternalServerError(
          'Auth0 user created but user_id not returned',
        );
      }

      // 7. Add user to organization
      await management.organizations.addMembers(
        {id: orgResponse.data.id},
        {members: [user.data.user_id]},
      );

      return {
        authId: user.data.user_id,
      };
    } catch (error) {
      throw new HttpErrors.InternalServerError(
        `Failed to create Auth0 user: ${error.message}`,
      );
    }
  }
}
