import {inject, service} from '@loopback/core';
import {repository} from '@loopback/repository';
import {get, param, post, requestBody} from '@loopback/rest';
import {
  CONTENT_TYPE,
  OPERATION_SECURITY_SPEC,
  STATUS_CODE,
  ILogger,
  LOGGER,
} from '@sourceloop/core';
import {authenticate, STRATEGY} from 'loopback4-authentication';
import {authorize} from 'loopback4-authorization';
import {TenantRepository} from '../repositories';
import {PermissionKey} from '../permissions';
import {TemporalProvisioningService} from '../services/temporal-provisioning.service';
import {SubscriptionDTO} from '../models';
import {model, property} from '@loopback/repository';

/**
 * DTO for creating/provisioning a user
 */
@model()
export class CreateUserDTO {
  @property({
    type: 'string',
    required: true,
  })
  email: string;

  @property({
    type: 'string',
    required: true,
  })
  firstName: string;

  @property({
    type: 'string',
    required: true,
  })
  lastName: string;

  @property({
    type: 'string',
  })
  password?: string;

  @property({
    type: 'string',
    default: 'user',
  })
  role?: string;

  @property({
    type: 'object',
  })
  metadata?: Record<string, string>;
}

/**
 * Response for user provisioning
 */
@model()
export class ProvisionUserResponse {
  @property({
    type: 'string',
    required: true,
  })
  workflowId: string;

  @property({
    type: 'string',
    required: true,
  })
  message: string;
}

const basePath = '/tenants/{tenantId}/users';

/**
 * User Controller
 *
 * Handles user provisioning and management within a tenant
 */
export class UserController {
  constructor(
    @repository(TenantRepository)
    private readonly tenantRepository: TenantRepository,
    @service(TemporalProvisioningService)
    private readonly provisioningService: TemporalProvisioningService<SubscriptionDTO>,
    @inject(LOGGER.LOGGER_INJECT)
    private readonly logger: ILogger,
  ) {}

  /**
   * Provision a new user within a tenant
   *
   * This starts a Temporal workflow that:
   * 1. Creates the user in Keycloak (IdP)
   * 2. Creates the user profile in the database
   * 3. Sends a welcome notification via Novu
   */
  @authorize({
    permissions: [PermissionKey.ProvisionUser],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @post(basePath, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'User provisioning started',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
              properties: {
                workflowId: {type: 'string'},
                message: {type: 'string'},
              },
            },
          },
        },
      },
    },
  })
  async provisionUser(
    @param.path.string('tenantId') tenantId: string,
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: {
            type: 'object',
            required: ['email', 'firstName', 'lastName'],
            properties: {
              email: {type: 'string', format: 'email'},
              firstName: {type: 'string'},
              lastName: {type: 'string'},
              password: {type: 'string'},
              role: {type: 'string'},
              metadata: {type: 'object'},
            },
          },
        },
      },
    })
    dto: CreateUserDTO,
  ): Promise<ProvisionUserResponse> {
    // Get tenant details
    const tenant = await this.tenantRepository.findById(tenantId);

    this.logger.info(`Starting user provisioning for ${dto.email} in tenant ${tenant.key}`);

    // Start the user provisioning workflow
    const result = await this.provisioningService.provisionUser({
      tenantId: tenant.id!,
      tenantKey: tenant.key,
      tenantName: tenant.name,
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      password: dto.password,
      role: dto.role || 'user',
      metadata: dto.metadata,
      appUrl: process.env.CUSTOMER_PORTAL_URL || 'http://localhost:27100',
      loginUrl: `${process.env.KEYCLOAK_URL || 'http://localhost:8180'}/realms/${tenant.key}/account`,
    });

    return {
      workflowId: result.workflowId,
      message: `User provisioning started for ${dto.email}`,
    };
  }

  /**
   * Get the status of a user provisioning workflow
   */
  @authorize({
    permissions: [PermissionKey.ViewUser],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/provisioning/{workflowId}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'User provisioning status',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
              properties: {
                step: {type: 'string'},
                progress: {type: 'number'},
                message: {type: 'string'},
                startedAt: {type: 'string'},
                updatedAt: {type: 'string'},
              },
            },
          },
        },
      },
    },
  })
  async getProvisioningStatus(
    @param.path.string('tenantId') tenantId: string,
    @param.path.string('workflowId') workflowId: string,
  ) {
    return this.provisioningService.getUserProvisioningStatus(workflowId);
  }
}
